import assert from 'node:assert/strict';
import {test, before, beforeEach, after} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash, randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import sharp from 'sharp';
import {NextRequest} from 'next/server';
import * as chat from '../app/api/chat/route';
import * as imageRoute from '../app/api/chat/image/route';
import * as generic from '../app/api/db/route';
import {chatImage} from '../lib/chat';

const originalFetch = global.fetch;
const pg = new PGlite();
const tokens = {user: 'a'.repeat(64), other: 'b'.repeat(64), admin: 'c'.repeat(64)};
const hash = (s:string) => createHash('sha256').update(s).digest('hex');
before(async () => {
  process.env.SUPABASE_URL = 'https://chat.test.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test.service.jwt';
  process.env.SITE_URL = 'https://app.test';
  await pg.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  await pg.exec(await readFile(new URL('../supabase/setup.sql', import.meta.url), 'utf8'));
  await pg.exec('alter table contact_messages add column user_id bigint;');
  await pg.exec("insert into users(id,phone,pin,user_id) values(1,'99112233','test','#1'),(2,'99112244','test','#2'); insert into contact_messages(user_id,message,reply,read) values(1,'Legacy question','Legacy reply',true); insert into contact_messages(message,is_announcement) values('Public announcement',true);");
  await pg.exec(await readFile(new URL('../supabase/migrations/20260915183329_private_support_chat.sql', import.meta.url), 'utf8'));
  assert.deepEqual((await pg.query('select sender,message from support_messages order by id')).rows, [{sender:'user',message:'Legacy question'},{sender:'admin',message:'Legacy reply'}]);
  assert.equal((await pg.query<{n:number}>('select count(*)::int n from contact_messages')).rows[0].n, 2);
});
beforeEach(async () => {
  await pg.exec('reset role;truncate support_threads cascade;');
  // A tiny PostgREST adapter executes the REAL SQL on isolated Postgres. No
  // production credentials, customer chats, or live network are used in tests.
  global.fetch = async (input, init) => {
    const u = new URL(String(input)); assert.equal(u.origin, 'https://chat.test.invalid');
    const table = u.pathname.replace('/rest/v1/', ''), method = init?.method || 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (table === 'app_sessions') {
      const token = u.searchParams.get('token_hash')?.slice(3);
      const who = (Object.keys(tokens) as (keyof typeof tokens)[]).find(k => hash(tokens[k]) === token);
      return Response.json(who ? [{user_id: who === 'admin' ? null : who === 'user' ? 1 : 2, is_admin: who === 'admin'}] : []);
    }
    try {
      let result;
      if (table.startsWith('rpc/')) {
        const fn = table.slice(4); assert.ok(['kino_chat_send','kino_chat_inbox','kino_chat_unread'].includes(fn));
        result = await pg.query(`select * from ${fn}(${Object.keys(body).map((k,i) => `${k} => $${i+1}`).join(',')})`, Object.values(body));
      } else {
        assert.ok(['support_messages','support_images'].includes(table), `Unexpected table ${table}`);
        const params:unknown[] = [], clauses:string[] = [];
        for (const [column, filter] of u.searchParams) {
          if (['select','order','limit'].includes(column)) continue;
          assert.match(column,/^[a-z_]+$/);
          if (filter === 'is.null') {clauses.push(`${column} is null`);continue;}
          const [op,...rest] = filter.split('.'); assert.ok(['eq','lte'].includes(op));
          params.push(rest.join('.')); clauses.push(`${column} ${op === 'eq' ? '=' : '<='} $${params.length}`);
        }
        const where = clauses.length ? `where ${clauses.join(' and ')}` : '';
        if (method === 'PATCH') {
          params.push(body.read_at);
          result = await pg.query(`update ${table} set read_at=$${params.length} ${where} returning id`, params);
        } else {
          const select = u.searchParams.get('select') || '*'; assert.match(select,/^[a-z_,*]+$/);
          result = await pg.query(`select ${select} from ${table} ${where} ${u.searchParams.has('order') ? 'order by id asc' : ''} limit ${Number(u.searchParams.get('limit') || 100)}`, params);
        }
      }
      return Response.json(result.rows.map(value => {const row=value as Record<string,unknown>;return {...row,...(row.data instanceof Uint8Array ? {data:'\\x'+Buffer.from(row.data).toString('hex')} : {})};}));
    } catch (e) {return Response.json({code:(e as {code:string}).code}, {status:400});}
  };
});
after(async () => {global.fetch = originalFetch;await pg.close();});
function req(path='/api/chat', method='GET', body?:unknown, actor:keyof typeof tokens|null='user', headers:Record<string,string>={}) {
  return new NextRequest(`https://app.test${path}`, {method,headers:{'content-type':'application/json',...(actor ? {cookie:`kino_session_v2=${tokens[actor]}`} : {}),...headers}, body:body === undefined ? undefined : JSON.stringify(body)});
}
async function send(actor:keyof typeof tokens='user', overrides:Record<string,unknown>={}) {
  const response = await chat.POST(req('/api/chat','POST',{message:'Hello',client_id:randomUUID(),...(actor === 'admin' ? {user:1} : {}),...overrides},actor));
  assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
  return (await response.json()).message;
}

test('private chat rejects anonymous access, forged owners/senders and cross-origin writes', async () => {
  for (const path of ['/api/chat','/api/chat?summary=1','/api/chat?inbox=1']) assert.equal((await chat.GET(req(path,'GET',undefined,null))).status,401);
  assert.equal((await chat.GET(req('/api/chat?inbox=1'))).status,403);
  assert.equal((await chat.GET(req('/api/chat?user=2'))).status,403);
  for (const fields of [{user:2},{sender:'admin'},{read_at:'2026-01-01'},{message:'x'.repeat(2001)},{message:'\0'}]) {
    const r = await chat.POST(req('/api/chat','POST',{message:'Hello',client_id:randomUUID(),...fields})); assert.ok([400,403].includes(r.status));
  }
  assert.equal((await chat.POST(req('/api/chat','POST',{message:'Hello',client_id:randomUUID()},'user',{origin:'https://evil.test'}))).status,403);
  assert.equal((await generic.GET(req('/api/db?path=support_messages'))).status,400);
});

test('two-way messages stay owner-scoped; read receipts apply only to the other sender and visible IDs', async () => {
  const question = await send(), answer = await send('admin', {message:'Answer'});
  await send('other',{message:'Other private thread'});
  const rows = (await (await chat.GET(req())).json()).messages;
  assert.equal(rows.length,2);assert.ok(!JSON.stringify(rows).includes('Other private thread'));
  assert.equal((await (await chat.GET(req('/api/chat?summary=1'))).json()).unread,1);
  assert.equal((await chat.PATCH(req('/api/chat','PATCH',{through:answer.id,user:2}))).status,403);
  assert.equal((await chat.PATCH(req('/api/chat','PATCH',{through:answer.id}))).status,200);
  let saved = (await pg.query<{id:number;read_at:unknown}>('select id,read_at from support_messages order by id')).rows;
  assert.equal(saved.find(m=>m.id===question.id)?.read_at,null);assert.ok(saved.find(m=>m.id===answer.id)?.read_at);
  const future = await send('admin',{message:'Unread later reply'});
  await chat.PATCH(req('/api/chat','PATCH',{through:answer.id}));
  saved = (await pg.query('select id,read_at from support_messages order by id')).rows as typeof saved;
  assert.equal(saved.find(m=>m.id===future.id)?.read_at,null);
  await chat.PATCH(req('/api/chat','PATCH',{user:1,through:question.id},'admin'));
  const inbox = await (await chat.GET(req('/api/chat?inbox=1','GET',undefined,'admin'))).json();
  assert.equal(Number(inbox.threads.find((t:{user_id:number})=>t.user_id===1).unread),0);
  assert.equal(Number(inbox.threads.find((t:{user_id:number})=>t.user_id===2).unread),1);
});

test('images are re-encoded, privately delivered, and never appear inline in list responses', async () => {
  const png = await sharp({create:{width:20,height:20,channels:3,background:'red'}}).png().toBuffer();
  const message = await send('user',{message:'',image:`data:image/png;base64,${png.toString('base64')}`});
  assert.match(message.image_url,/^\/api\/chat\/image\?id=\d+$/);
  const list = await (await chat.GET(req())).text();assert.ok(!list.includes(png.toString('base64')));assert.ok(!list.includes('data:'));
  assert.equal((await imageRoute.GET(req(message.image_url,'GET',undefined,null))).status,401);
  assert.equal((await imageRoute.GET(req(message.image_url,'GET',undefined,'other'))).status,404);
  for (const actor of ['user','admin'] as const) {
    const response = await imageRoute.GET(req(message.image_url,'GET',undefined,actor));assert.equal(response.status,200);
    assert.equal(response.headers.get('content-type'),'image/webp');assert.match(response.headers.get('cache-control')!,/no-store/);
    assert.equal((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).format,'webp');
  }
  await assert.rejects(chatImage('data:image/png;base64,'+Buffer.from('<svg><script>alert(1)</script></svg>').toString('base64')));
  await assert.rejects(chatImage('https://evil.test/image.png'));
  await assert.rejects(chatImage('data:image/png;base64,'+'A'.repeat(2800001)));
});

test('lost-response retries are idempotent and database retention removes oldest images only in that thread', async () => {
  const png = await sharp({create:{width:2,height:2,channels:3,background:'blue'}}).png().toBuffer();
  const first = await send('user',{image:`data:image/png;base64,${png.toString('base64')}`});
  await send('other',{message:'Keep this other conversation'});
  const id = randomUUID();
  const duplicate = await Promise.all(Array.from({length:5},()=>send('user',{client_id:id,message:'One message'})));
  assert.equal(new Set(duplicate.map(m=>m.id)).size,1);
  for (let i=0;i<101;i++) {
    if (i%40===0) await pg.exec('update support_threads set rate_count=0');
    await send(i%2 ? 'admin' : 'user',{message:`Message ${i}`});
  }
  assert.deepEqual((await pg.query('select user_id,count(*)::int n from support_messages group by user_id order by user_id')).rows,[{user_id:1,n:100},{user_id:2,n:1}]);
  assert.equal((await imageRoute.GET(req(first.image_url))).status,404);
  assert.equal((await pg.query<{n:number}>('select count(*)::int n from support_images')).rows[0].n,0);
  assert.equal((await pg.query<{message:string}>("select message from support_messages where user_id=1 order by id limit 1")).rows[0].message,'Message 1');
});

test('public Supabase roles cannot read chat/images or forge service RPC calls; burst sends are capped', async () => {
  for (const role of ['anon','authenticated']) {
    await pg.exec(`set role ${role}`);
    for (const table of ['support_threads','support_messages','support_images']) await assert.rejects(pg.query(`select * from ${table}`),/permission denied/);
    await assert.rejects(pg.query('select * from kino_chat_unread(null,true)'),/permission denied/);
    await assert.rejects(pg.query('select * from kino_chat_inbox()'),/permission denied/);
    await assert.rejects(pg.query('select * from kino_chat_send(1,\'admin\',\'Forged\',null,$1)',[randomUUID()]),/permission denied/);
    await pg.exec('reset role');
  }
  await pg.exec('set role service_role');
  await send();
  await pg.exec('update support_threads set rate_count=60');
  assert.equal((await chat.POST(req('/api/chat','POST',{message:'Burst',client_id:randomUUID()}))).status,429);
  assert.equal((await pg.query<{n:number}>('select count(*)::int n from support_messages')).rows[0].n,1);
});
