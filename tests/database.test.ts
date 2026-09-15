import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('description upgrade preserves existing films and descriptions across repeated installs',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  await pg.exec(await readFile(new URL('../supabase/setup.sql',import.meta.url),'utf8'));
  await pg.exec("alter table films drop column description;insert into films(title,url) values('Keep film','https://video.example/private.mp4')");
  const compatibility=await readFile(new URL('../supabase/compatibility-update.sql',import.meta.url),'utf8');
  await pg.exec(compatibility);
  assert.deepEqual((await pg.query('select title,url,description from films')).rows,[{title:'Keep film',url:'https://video.example/private.mp4',description:''}]);
  await pg.exec("set role service_role;update films set description='Киноны тайлбар';reset role;");
  await pg.exec(compatibility);
  await pg.exec(await readFile(new URL('../supabase/review-install.sql',import.meta.url),'utf8'));
  assert.equal((await pg.query<{description:string}>('select description from films')).rows[0].description,'Киноны тайлбар');
  for(const role of ['anon','authenticated']){
   await pg.exec(`set role ${role}`);await assert.rejects(pg.query('select description from films'),/permission denied/);await pg.exec('reset role');
  }
 }finally{await pg.close();}
});
test('setup SQL runs, preserves records, blocks browser roles and atomically limits attempts',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  const sql=await readFile(new URL('../supabase/setup.sql',import.meta.url),'utf8');await pg.exec(sql);
  await pg.exec("insert into films(title,url) values('Existing','https://example.com/full|||https://example.com/preview');");
  await pg.exec(sql); // migration is rerunnable
  const compatibility=await readFile(new URL('../supabase/compatibility-update.sql',import.meta.url),'utf8');
  await pg.exec(compatibility);await pg.exec(compatibility);
  const {rows}=await pg.query<{title:string;preview_url:string}>('select title,preview_url from films');assert.equal(rows[0].title,'Existing');assert.equal(rows[0].preview_url,'https://example.com/preview');
  for(const role of ['anon','authenticated']){
   await pg.exec(`set role ${role}`);
   for(const table of ['users','films','pending_payments','app_sessions'])await assert.rejects(pg.query(`select * from ${table}`),/permission denied/);
   await assert.rejects(pg.query("select * from kino_claim_attempt('test')"),/permission denied/);await pg.exec('reset role');
  }
  await pg.exec('set role service_role');
  const attempts=await Promise.all(Array.from({length:8},()=>pg.query<{allowed:boolean}>("select * from kino_claim_attempt('bucket')")));
  assert.equal(attempts.filter(r=>r.rows[0].allowed).length,5);
 }finally{await pg.close();}
});


test('legacy NOT NULL film_id is relaxed for packages without changing existing film orders',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  const setup=await readFile(new URL('../supabase/setup.sql',import.meta.url),'utf8');
  await pg.exec(setup);
  await pg.exec("alter table pending_payments alter column film_id set not null; insert into pending_payments(ref_code,film_id,amount) values('111111',42,5000)");
  await assert.rejects(pg.exec("insert into pending_payments(ref_code,film_id,amount,plan) values('222222',null,0,'all_1month')"),/null/);
  const sql=await readFile(new URL('../supabase/compatibility-update.sql',import.meta.url),'utf8');
  await pg.exec(sql);await pg.exec(sql);
  await pg.exec("insert into pending_payments(ref_code,film_id,amount,plan) values('222222',null,0,'all_1month')");
  const {rows}=await pg.query<{ref_code:string;film_id:number|null}>("select ref_code,film_id from pending_payments order by ref_code");
  assert.deepEqual(rows,[{ref_code:'111111',film_id:42},{ref_code:'222222',film_id:null}]);
 }finally{await pg.close();}
});

test('revocation cancels only the selected purchase and leaves other entitlements intact',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await pg.exec(await readFile(new URL('../supabase/setup.sql',import.meta.url),'utf8'));
  const sql=await readFile(new URL('../supabase/block-access.sql',import.meta.url),'utf8');
  await pg.exec(sql);await pg.exec(sql);
  await pg.exec("insert into users(id,phone,pin,user_id) values(1,'99112233','1234','#1'),(2,'99112234','1234','#2'); insert into pending_payments(ref_code,user_id,amount,status,plan) values('111111',1,5000,'confirmed','single'),('222222',1,8000,'confirmed','all_1month'),('333333',1,5000,'pending','single'),('444444',2,5000,'confirmed','single');");
  await pg.query("select * from kino_block_access('111111')");
  assert.deepEqual((await pg.query('select access_blocked from users order by id')).rows,[{access_blocked:false},{access_blocked:false}]);
  assert.deepEqual((await pg.query('select status from pending_payments order by ref_code')).rows,[{status:'revoked'},{status:'confirmed'},{status:'pending'},{status:'confirmed'}]);
  await pg.exec('set role anon');
  await assert.rejects(pg.query("select * from kino_block_access('444444')"),/permission denied/);
 }finally{await pg.close();}
});

test('settings RPC serializes saves, preserves legacy rows and blocks browser execution',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await pg.exec(await readFile(new URL('../supabase/setup.sql',import.meta.url),'utf8'));
  const sql=await readFile(new URL('../supabase/audit-update.sql',import.meta.url),'utf8');
  await pg.exec(sql);await pg.exec(sql);
  await pg.exec('set role service_role');
  await Promise.all(Array.from({length:10},(_,i)=>pg.query('select * from kino_save_settings($1)',[JSON.stringify({messengerUrl:`https://m.me/test${i}`})])));
  assert.equal((await pg.query('select * from sms_logs')).rows.length,1);
  await pg.exec("insert into sms_logs(key,value,text) values('site_settings','old','settings'),('other','keep','other')");
  await pg.query('select * from kino_save_settings($1)',['new']);
  assert.equal((await pg.query("select * from sms_logs where key='site_settings' and value='new'")).rows.length,2);
  assert.equal((await pg.query<{value:string}>("select value from sms_logs where key='other'")).rows[0].value,'keep');
  await pg.exec('reset role');
  await pg.exec('grant select on users to public; create policy legacy_open on users for select to public using(true);');
  await pg.exec(sql);
  for(const role of ['anon','authenticated']){
   await pg.exec(`set role ${role}`);
   await assert.rejects(pg.query('select * from users'),/permission denied/);
   await assert.rejects(pg.query("select * from kino_save_settings('evil')"),/permission denied/);
   await pg.exec('reset role');
  }
 }finally{await pg.close();}
});

test('combined review installer and read-only audit run on clean and previously migrated schemas',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  const sql=await readFile(new URL('../supabase/review-install.sql',import.meta.url),'utf8');
  await pg.exec(sql);
  await pg.exec("insert into films(title,badge) values('Keep film','Хэлтэй|Гадаад'); insert into users(phone,pin,user_id) values('99112233','1234','keep-user');");
  await pg.exec(sql);
  assert.equal((await pg.query('select * from films')).rows.length,1);
  assert.equal((await pg.query('select * from users')).rows.length,1);
  const results=await pg.exec(await readFile(new URL('../supabase/verify-readonly.sql',import.meta.url),'utf8'));
  assert.ok(results.length>=5);
 }finally{await pg.close();}
});

test('poster SQL preserves data, blocks legacy public writes and safely migrates concurrent edits',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  await pg.exec(await readFile(new URL('../supabase/review-install.sql',import.meta.url),'utf8'));
  await pg.exec(`create schema storage;grant usage on schema storage to anon,authenticated,service_role;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id bigint primary key,bucket_id text,name text);alter table storage.objects enable row level security;
   grant all on storage.objects,storage.buckets to anon,authenticated,service_role;
   create policy old_open_policy on storage.objects for all to public using(true) with check(true);
   insert into storage.buckets values('other','other',false,9999999,array['image/png']);
   insert into storage.objects values(1,'kino-posters','keep'),(2,'other','other');
   insert into public.films(id,title,img) values(10,'Keep','data:image/png;base64,original');`);
  const sql=await readFile(new URL('../supabase/HTTPS-UPGRADE.sql',import.meta.url),'utf8');await pg.exec(sql);await pg.exec(sql);
  assert.equal((await pg.query('select * from storage.buckets')).rows.length,2);
  for(const role of ['anon','authenticated']){
   await pg.exec(`set role ${role}`);
   await assert.rejects(pg.exec("insert into storage.objects values(3,'kino-posters','evil')"),/row-level security/);
   await assert.rejects(pg.exec("update storage.objects set bucket_id='kino-posters' where id=2"),/row-level security/);
   await pg.exec('delete from storage.objects where id=1');
   await assert.rejects(pg.query('select * from kino_readiness()'),/permission denied/);
   await assert.rejects(pg.query("select * from kino_replace_inline_poster(10,'a','b')"),/permission denied/);
   await pg.exec('reset role');
  }
  assert.equal((await pg.query('select * from storage.objects where id=1')).rows.length,1);
  await pg.exec('set role service_role');
  await pg.exec("insert into storage.objects values(3,'kino-posters','admin-ok')");
  let rows=(await pg.query("select * from kino_replace_inline_poster(10,'stale-original','https://img.test/new.webp')")).rows;assert.equal(rows.length,0);
  rows=(await pg.query("select * from kino_replace_inline_poster(10,'data:image/png;base64,original','https://img.test/new.webp')")).rows;assert.equal(rows.length,1);
  const checks=(await pg.query<{check_name:string;ok:boolean}>('select * from kino_readiness()')).rows;assert.equal(checks.length,6);assert.ok(checks.every(c=>c.ok),JSON.stringify(checks));
 }finally{await pg.close();}
});

test('legacy payment lock retires the inspected log trigger and RPC while preserving current payment and settings writes',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  await pg.exec(await readFile(new URL('../supabase/review-install.sql',import.meta.url),'utf8'));
  // These two payment bodies and the trigger reproduce the user's SQL export.
  await pg.exec(`
   alter table public.sms_logs add column status text;
   alter table public.sms_logs add column ref_code text;
   create function public.auto_confirm_payment() returns trigger language plpgsql
   security definer set search_path to 'public' as $$
   begin
    if NEW.status = 'confirmed' and NEW.ref_code is not null then
     update pending_payments set status = 'confirmed'
     where ref_code = NEW.ref_code and status = 'pending';
    end if;
    return NEW;
   end; $$;
   create function public.confirm_payment(p_ref_code text) returns void
   language plpgsql security definer as $$
   begin
    update pending_payments set status = 'confirmed', confirmed_at = now()
    where ref_code = p_ref_code;
   end; $$;
   create trigger trigger_confirm_payment after insert on public.sms_logs
   for each row execute function public.auto_confirm_payment();
   create function public.get_film_cats() returns table(id bigint,cat text)
   language sql security definer as $$ select id,badge from public.films; $$;
   create function public.update_film_cat(bigint,text) returns void
   language sql security definer as $$ update public.films set badge=$2 where id=$1; $$;
   create table public.test_log_counter(n integer);insert into test_log_counter values(0);
   create function public.test_count_log() returns trigger language plpgsql security definer
   as $$ begin update public.test_log_counter set n=n+1;return NEW;end; $$;
   create trigger unrelated_log_trigger after insert on public.sms_logs
   for each row execute function public.test_count_log();
   insert into public.pending_payments(ref_code,amount,status,created_at,confirmed_at) values
    ('111111',5000,'pending',now()-interval '4 hours',null),
    ('222222',5000,'revoked',now()-interval '1 day',now()-interval '1 day'),
    ('333333',5000,'confirmed',now()-interval '1 day',now()-interval '1 day'),
    ('444444',5000,'pending',now()-interval '2 days',null);
  `);
  const snapshot=await pg.query('select * from pending_payments order by ref_code');
  // Demonstrate the old defects, then roll back only this local fixture exercise.
  await pg.exec('begin');
  await pg.exec("insert into sms_logs(status,ref_code) values('confirmed','111111'),('confirmed','444444')");
  const oldLogs=(await pg.query<{status:string;confirmed_at:null}>("select status,confirmed_at from pending_payments where ref_code in ('111111','444444')")).rows;
  assert.ok(oldLogs.every(row=>row.status==='confirmed'&&row.confirmed_at===null));
  await pg.exec("select confirm_payment('222222');select confirm_payment('333333');");
  const oldRpc=(await pg.query<{status:string;renewed:boolean}>("select status,confirmed_at>created_at as renewed from pending_payments where ref_code in ('222222','333333')")).rows;
  assert.ok(oldRpc.every(row=>row.status==='confirmed'&&row.renewed));
  await pg.exec('rollback');
  const beforeDefinitions=(await pg.query("select pg_get_functiondef(oid) from pg_proc where oid in ('auto_confirm_payment()'::regprocedure,'confirm_payment(text)'::regprocedure)")).rows;
  const lock=await readFile(new URL('../supabase/LEGACY-FUNCTIONS-LOCK.sql',import.meta.url),'utf8');
  let verification=(await pg.exec(lock)).at(-1)!;assert.equal(verification.rows.length,4);
  await pg.exec(lock); // a repeat must never restore the retired server EXECUTE grants
  assert.deepEqual((await pg.query('select * from pending_payments order by ref_code')).rows,snapshot.rows);
  assert.deepEqual((await pg.query("select pg_get_functiondef(oid) from pg_proc where oid in ('auto_confirm_payment()'::regprocedure,'confirm_payment(text)'::regprocedure)")).rows,beforeDefinitions);
  for(const role of ['anon','authenticated','service_role']){
   await pg.exec(`set role ${role}`);
   for(const ref of ['111111','222222','333333','444444'])await assert.rejects(pg.query('select public.confirm_payment($1)',[ref]),/permission denied/);
   await pg.exec('reset role');
  }
  await pg.exec('set role service_role');
  await pg.exec("insert into sms_logs(status,ref_code) values('confirmed','111111'),('confirmed','222222'),('confirmed','333333'),('confirmed','444444')");
  assert.deepEqual((await pg.query('select * from pending_payments order by ref_code')).rows,snapshot.rows);
  await pg.query('select * from kino_save_settings($1)',[JSON.stringify({messengerUrl:'https://m.me/example'})]);
  assert.equal((await pg.query("select * from sms_logs where key='site_settings'")).rows.length,1);
  // The current /api/sms PATCH writes this table directly after validating the SMS.
  const confirmed=(await pg.query<{status:string;confirmed_at:string|null}>("update pending_payments set status='confirmed',confirmed_at=now() where ref_code='111111' and status='pending' returning status,confirmed_at")).rows;
  assert.equal(confirmed.length,1);assert.ok(confirmed[0].confirmed_at);
  assert.equal((await pg.query("update pending_payments set status='confirmed',confirmed_at=now() where ref_code='111111' and status='pending' returning id")).rows.length,0);
  assert.equal((await pg.query<{status:string}>("select status from pending_payments where ref_code='222222'")).rows[0].status,'revoked');
  await pg.query('select * from get_film_cats()');
  await pg.exec('reset role');
  assert.equal((await pg.query<{n:number}>('select n from test_log_counter')).rows[0].n,5);
  assert.equal((await pg.query<{tgenabled:string}>("select tgenabled from pg_trigger where tgname='trigger_confirm_payment'")).rows[0].tgenabled,'D');
  await pg.exec('drop trigger trigger_confirm_payment on sms_logs;drop function auto_confirm_payment();');
  verification=(await pg.exec(lock)).at(-1)!;assert.equal(verification.rows.length,3);
 }finally{await pg.close();}
});

test('legacy payment lock rejects an unreviewed trigger attachment and rolls back its changes',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec(`create role anon;create role authenticated;create role service_role;
   create table public.sms_logs(id bigint);create table public.other_logs(id bigint);
   create function public.auto_confirm_payment() returns trigger language plpgsql as $$begin return NEW;end;$$;
   create trigger trigger_confirm_payment after insert on sms_logs for each row execute function auto_confirm_payment();
   create trigger other_attachment after insert on other_logs for each row execute function auto_confirm_payment();`);
  const lock=await readFile(new URL('../supabase/LEGACY-FUNCTIONS-LOCK.sql',import.meta.url),'utf8');
  await assert.rejects(pg.exec(lock),/Additional legacy payment trigger attachment requires review/);
  await pg.exec('rollback');
  assert.ok((await pg.query<{tgenabled:string}>("select tgenabled from pg_trigger where not tgisinternal")).rows.every(row=>row.tgenabled==='O'));
 }finally{await pg.close();}
});
