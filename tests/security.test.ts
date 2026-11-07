import assert from 'node:assert/strict';
import { test, beforeEach, after } from 'node:test';
import { NextRequest } from 'next/server';
import { accessFromPayments, canWatch, parseBankSms, paymentExpiry, safeUrl, type Row } from '../lib/domain';
import { canAdminSite, pinHash, pinMatches } from '../lib/server';
import * as auth from '../app/api/auth/route';
import * as device from '../app/api/device/route';
import * as api from '../app/api/db/route';
import * as playback from '../app/api/playback/route';
import * as sms from '../app/api/sms/route';
import * as settings from '../app/api/settings/route';
import * as access from '../app/api/access/route';
import * as appearance from '../app/api/appearance/route';
import * as macroDownload from '../app/api/admin/macrodroid/route';
import * as smsDiagnostics from '../app/api/admin/sms-diagnostics/route';
import * as videoDiagnostics from '../app/api/admin/video-diagnostics/route';
process.env.SUPABASE_URL='https://test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY='fake.service.jwt';
process.env.ADMIN_PASSWORD='test-admin-password-long-enough';
process.env.SMS_WEBHOOK_SECRET='test-sms-secret-at-least-32-characters-long';
const originalFetch=global.fetch;
let tables:Record<string,Row[]>;
let counters:Record<string,number>;
let nextId=1;
const now=()=>new Date().toISOString();
beforeEach(()=>{
 delete process.env.SMS_ALLOWED_SENDER;nextId=100;counters={};tables={
  users:[],
  films:[{id:1,title:'Test',price:5000,locked:true,free:false,url:'https://video.example/movie.mp4',preview_url:'https://video.example/trailer.mp4',badge:'Хэлтэй|Гадаад',site_id:'taza'}],
  pending_payments:[],
  taza_pack_claims:[],
  app_sessions:[],
  guest_device_tokens:[],
  site_user_memberships:[],
  contact_messages:[],
  sms_logs:[],
  site_settings:[{site_id:'taza',messenger_url:'',bank_name:'Хаан банк',bank_account:'5251258979',account_name:'Т.Жаргалбаяр',bank_iban:'MN03000500'}],
  site_appearance:[{id:1,layout:1,tone:25,revision:0,site_id:'taza'}],
  wallet_ledger:[],
  push_subscriptions:[]
 };
 global.fetch=async(input,init)=>{
  const u=new URL(String(input));assert.equal(u.origin,'https://test.invalid','test must never access real service');
  const name=u.pathname.replace('/rest/v1/','');const method=init?.method||'GET';const body=init?.body?JSON.parse(String(init.body)):null;
  if(name==='rpc/kino_taza_claim_film'){
    const userId=Number(body.p_user),filmId=Number(body.p_film);
    if(!tables.films.some(f=>f.id===filmId && f.site_id==='taza'))return Response.json([{result:'film_missing',payment_id:null}]);
    const active=tables.pending_payments.filter(p=>Number(p.user_id)===userId&&p.site_id==='taza'&&p.status==='confirmed'&&
      ['pick_5_30d_6000','pick_10_30d_9000','pick_3_30d_5000','pick_6_30d_9500'].includes(String(p.plan))&&paymentExpiry(p)>Date.now())
      .sort((a,b)=>Number(a.id)-Number(b.id));
    for(const p of active)if(tables.taza_pack_claims.some(row=>row.payment_id===p.id&&row.film_id===filmId))return Response.json([{result:'already_claimed',payment_id:p.id}]);
    for(const p of active){
      const used=tables.taza_pack_claims.filter(row=>row.payment_id===p.id).length;
      const quota=p.plan==='pick_5_30d_6000'?5:p.plan==='pick_10_30d_9000'?10:p.plan==='pick_3_30d_5000'?3:6;
      if(used<quota){
        tables.taza_pack_claims.push({id:nextId++,site_id:'taza',user_id:userId,payment_id:p.id,film_id:filmId,claimed_at:now()});
        return Response.json([{result:'claimed',payment_id:p.id}]);
      }
    }
    return Response.json([{result:'exhausted',payment_id:null}]);
  }
  if(name==='rpc/kino_claim_attempt'){const n=(counters[body.bucket_key]||0)+1;counters[body.bucket_key]=n;return Response.json([{allowed:n<=5}]);}
  if(name==='rpc/kino_touch_site_user'){
    const site=String(body.p_site||'taza'),user=Number(body.p_user);
    const found=tables.site_user_memberships.find(r=>r.site_id===site&&Number(r.user_id)===user);
    if(found)found.last_seen_at=now();else tables.site_user_memberships.push({site_id:site,user_id:user,first_seen_at:now(),last_seen_at:now()});
    return Response.json([{ok:true}]);
  }
  if(name==='rpc/kino_site_entry_status'){
    const site=String(body.p_site||'taza'),user=Number(body.p_user);
    if(site!=='taza')return Response.json([{allowed:true,reason:'not_gated'}]);
    const sameSite=(row:Row)=>String(row.site_id||'taza')===site;
    const activeEntitlement=tables.pending_payments.some(row=>{
      if(!sameSite(row)||Number(row.user_id)!==user||row.status!=='confirmed'||['wallet_topup','wallet_admin'].includes(String(row.plan)))return false;
      return paymentExpiry({...row,status:'confirmed'})>Date.now();
    });
    return Response.json([{allowed:activeEntitlement,reason:activeEntitlement?'active_entitlement':'payment_required'}]);
  }
  assert.ok(name in tables,`unknown table ${name}`);
  tables[name].forEach(r=>{if(r.id===undefined)r.id=nextId++;});
  const match=(row:Row)=>[...u.searchParams].every(([k,v])=>{
   if(['select','order','limit'].includes(k))return true;
   if(v.startsWith('eq.')){
     const value=row[k]===undefined&&k==='site_id'?'taza':row[k];
     return String(value)===v.slice(3);
   }
   if(v.startsWith('in.(')){
     const values=v.slice(4,-1).split(',');
     return values.includes(String(row[k]));
   }
   if(v.startsWith('gt.'))return k==='id'?Number(row[k])>Number(v.slice(3)):String(row[k])>v.slice(3);
   if(v.startsWith('neq.'))return String(row[k])!==v.slice(4);
   return true;
  });
  let rows=tables[name].filter(match);
  if(u.searchParams.get('order')==='id.asc')rows.sort((a,b)=>Number(a.id)-Number(b.id));
  if(method==='GET'&&u.searchParams.has('limit'))rows=rows.slice(0,Number(u.searchParams.get('limit')));
  if(method==='POST'){
   if(name==='users'&&tables.users.some(r=>r.phone===body.phone))return Response.json({code:'23505'},{status:409});
   if(name==='pending_payments'&&tables.pending_payments.some(r=>r.ref_code===body.ref_code))return Response.json({code:'23505'},{status:409});
   const row={id:nextId++,created_at:now(),...body};tables[name].push(row);rows=[row];
  }else if(method==='PATCH')rows.forEach(r=>Object.assign(r,body));
  else if(method==='DELETE')tables[name]=tables[name].filter(r=>!rows.includes(r));
  const select=u.searchParams.get('select');
  if(select&&select!=='*')rows=rows.map(r=>Object.fromEntries(select.split(',').filter(k=>k in r).map(k=>[k,r[k]])));
  return Response.json(rows);
 };
});
after(()=>{global.fetch=originalFetch;});
function req(path:string,method='GET',body?:unknown,cookie?:string,extra:Record<string,string>={}){
 return new NextRequest(`https://app.test${path}`,{method,headers:{'Content-Type':'application/json',...(cookie?{cookie}:{}),...extra},body:body===undefined?undefined:JSON.stringify(body)});
}
async function register(phone='99112233'){
 const r=await auth.POST(req('/api/auth','POST',{action:'register',phone,pin:'1234'}));assert.equal(r.status,200);
 return r.headers.get('set-cookie')!.split(';')[0];
}
async function admin(){const r=await auth.POST(req('/api/auth','POST',{action:'admin',password:process.env.ADMIN_PASSWORD}));assert.equal(r.status,200);return r.headers.get('set-cookie')!.split(';')[0];}
function markEntryPaid(userId:number,amount=12500){
 tables.wallet_ledger.push({id:nextId++,user_id:userId,delta:amount,kind:'topup',site_id:'taza',created_at:now()});
 tables.pending_payments.push({id:nextId++,user_id:userId,ref_code:String(700000+(nextId%200000)),film_id:null,plan:'entry_72h',amount,status:'confirmed',created_at:now(),confirmed_at:now(),site_id:'taza'});
}
async function paidUser(phone='99112233'){
 const cookie=await register(phone);markEntryPaid(Number(tables.users.find(u=>u.phone===phone)?.id));return cookie;
}
const dbReq=(path:string,method='GET',body?:unknown,cookie?:string)=>req(`/api/db?path=${encodeURIComponent(path)}`,method,body,cookie);
function bankSms(ref:string,amount='5,000.00',sender='Khan Bank') {
 return sms.POST(new NextRequest('https://app.test/api/sms',{
  method:'POST',headers:{'content-type':'text/plain',authorization:`Bearer ${process.env.SMS_WEBHOOK_SECRET}`,'x-sms-sender':sender},
  body:`Tany 5***0000 dansand\nORLOGO:${amount}MNT orj\nULDEGDEL:100,000.00MNT\nbolloo.Utga:${ref}`,
 }));
}
test('only explicit master or matching site admin can access protected sites',()=>{
 assert.equal(canAdminSite(null,'taza'),false);
 assert.equal(canAdminSite({userId:null,admin:false,adminSiteId:null,masterAdmin:true},'taza'),false);
 assert.equal(canAdminSite({userId:null,admin:true,adminSiteId:null,masterAdmin:false},'taza'),false);
 assert.equal(canAdminSite({userId:null,admin:true,adminSiteId:null,masterAdmin:false},'fire'),false);
 assert.equal(canAdminSite({userId:null,admin:true,adminSiteId:'taza',masterAdmin:false},'taza'),true);
 assert.equal(canAdminSite({userId:null,admin:true,adminSiteId:'taza',masterAdmin:false},'fire'),false);
 assert.equal(canAdminSite({userId:null,admin:true,adminSiteId:null,masterAdmin:true},'fire'),true);
});
test('production SMS webhook requires a configured trusted sender before confirming',async()=>{
 // Next types NODE_ENV as readonly; scope the temporary override to this test.
 const environment=process.env as Record<string,string|undefined>;
 const prior=environment.NODE_ENV;
 delete environment.SMS_ALLOWED_SENDER;
 environment.NODE_ENV='production';
 try {
   const response=await sms.POST(req('/api/sms','POST',{text:'ORLOGO:12,000MNT Utga:123456'},undefined,{
     authorization:`Bearer ${process.env.SMS_WEBHOOK_SECRET}`,
     'x-sms-sender':'Khan Bank'
   }));
   assert.equal(response.status,503);
   assert.equal((await response.json()).code,'SMS_SENDER_CONFIG_REQUIRED');
 } finally {
   if(prior===undefined)delete environment.NODE_ENV;
   else environment.NODE_ENV=prior;
 }
});

test('PIN hashes are salted and verify; bad/legacy PINs handled',()=>{
 const h=pinHash('1234');assert.notEqual(h,pinHash('1234'));assert.ok(pinMatches('1234',h));assert.ok(!pinMatches('9999',h));assert.ok(pinMatches('1234','1234'));assert.ok(!pinMatches('1234','scrypt:bad:bad'));
});
test('registration has no shared tmp ID and never returns PIN',async()=>{
 const cookie=await register();await register('99112234');assert.equal(new Set(tables.users.map(u=>u.user_id)).size,2);assert.ok(String(tables.users[0].pin).startsWith('scrypt:'));
 const r=await auth.GET(req('/api/auth','GET',undefined,cookie));const body=await r.json();assert.equal(body.user.pin,undefined);assert.equal(body.user.phone,'99112233');
});
test('duplicate registration reports conflict',async()=>{await register();const r=await auth.POST(req('/api/auth','POST',{action:'register',phone:'99112233',pin:'1234'}));assert.equal(r.status,409);});
test('failed PIN attempts are rate limited across requests',async()=>{
 await register();for(let i=0;i<4;i++){const r=await auth.POST(req('/api/auth','POST',{action:'login',phone:'99112233',pin:'9999'}));assert.equal(r.status,401);}
 const r=await auth.POST(req('/api/auth','POST',{action:'login',phone:'99112233',pin:'1234'}));assert.equal(r.status,429);
});
test('legacy PIN is upgraded at successful login',async()=>{
 tables.users.push({id:5,phone:'99112233',pin:'1234',user_id:'#000005'});const r=await auth.POST(req('/api/auth','POST',{action:'login',phone:'99112233',pin:'1234'}));assert.equal(r.status,200);assert.ok(String(tables.users[0].pin).startsWith('scrypt:'));
});
test('logout revokes server token and forged cookie has no session',async()=>{
 const c=await register();await auth.POST(req('/api/auth','POST',{action:'logout'},c));assert.equal((await (await auth.GET(req('/api/auth','GET',undefined,c))).json()).user,null);
 assert.equal((await (await auth.GET(req('/api/auth','GET',undefined,'kino_session_v2='+'a'.repeat(64)))).json()).user,null);
});
test('anonymous device gets one persistent guest identity and can own its payment',async()=>{
 const first=await device.POST(req('/api/device','POST',{}));assert.equal(first.status,200);
 const firstBody=await first.json();assert.equal(firstBody.user.guest,true);assert.equal(firstBody.user.phone,'');assert.match(firstBody.user.user_id,/^G[A-F0-9]{12}$/);
 const cookie=first.headers.get('set-cookie')!.split(';')[0];assert.equal(tables.users.length,1);assert.equal(tables.users[0].is_guest,true);
 const second=await device.POST(req('/api/device','POST',{},cookie));assert.equal(second.status,200);assert.equal((await second.json()).user.id,firstBody.user.id);assert.equal(tables.users.length,1);
 const order=await api.POST(dbReq('pending_payments','POST',{ref_code:'654321',film_id:1,plan:'pick_5_30d_6000'},cookie));assert.equal(order.status,200);
 const saved=(await order.json())[0];assert.equal(saved.user_id,firstBody.user.id);assert.equal(saved.status,'pending');assert.equal(saved.amount,6000);
});
test('cross-origin mutation is rejected',async()=>{const r=await auth.POST(req('/api/auth','POST',{action:'register',phone:'99112233',pin:'1234'},undefined,{origin:'https://evil.test'}));assert.equal(r.status,403);});
test('Taza movie catalog is publicly available but does not reveal full video URL',async()=>{
  const r=await api.GET(dbReq('films?select=*'));
  assert.equal(r.status,200);
  const rows=await r.json();
  assert.equal(rows[0].url,'|||https://video.example/trailer.mp4');
  assert.ok(!JSON.stringify(rows).includes('movie.mp4'));
  assert.equal(tables.users.length,0,'loading public films must not sign anyone up');
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('https://user:pass@example.com'),'');
});
test('public user list/admin mutation and joins are blocked',async()=>{
 assert.equal((await api.GET(dbReq('users?select=*'))).status,403);
 assert.equal((await api.PATCH(dbReq('films?id=eq.1','PATCH',{price:0}))).status,403);
 assert.equal((await api.GET(dbReq('films?select=*,users(*)'))).status,400);
});
test('movie descriptions round trip through admin edits and public details without exposing full video',async()=>{
 const cookie=await admin(),description='Хоёр найзын аялал.\nМонгол хадмалтай.';
 assert.equal((await api.PATCH(dbReq('films?id=eq.1','PATCH',{description},cookie))).status,200);
 const viewer=await paidUser('99112234');
 const rows=await (await api.GET(dbReq('films?id=eq.1','GET',undefined,viewer))).json();
 assert.equal(rows[0].description,description);assert.ok(!JSON.stringify(rows).includes('movie.mp4'));
 assert.equal((await api.PATCH(dbReq('films?id=eq.1','PATCH',{description:''},cookie))).status,200);
 assert.equal(tables.films[0].description,'');
});
test('description edits require admin access and validate type and maximum length',async()=>{
 const user=await register();
 assert.equal((await api.PATCH(dbReq('films?id=eq.1','PATCH',{description:'Changed'},user))).status,403);
 const cookie=await admin();
 for(const description of [null,12,{},'a'.repeat(4001)])assert.equal((await api.PATCH(dbReq('films?id=eq.1','PATCH',{description},cookie))).status,400);
 assert.equal((await api.PATCH(dbReq('films?id=eq.1','PATCH',{description:'a'.repeat(4000)},cookie))).status,200);
});
test('legacy catalog retries only a missing-column failure and still redacts paid URLs',async()=>{
 const viewer=await paidUser();
 const mock=global.fetch;let attempts=0;
 global.fetch=async(input,init)=>{
  const url=new URL(String(input));
  if(url.pathname==='/rest/v1/films'){
   attempts++;
   if(url.searchParams.get('select')?.split(',').includes('description'))return Response.json({code:'42703'},{status:400});
  }
  return mock(input,init);
 };
 const response=await api.GET(dbReq('films?id=eq.1','GET',undefined,viewer));assert.equal(response.status,200);
 const rows=await response.json();assert.equal(attempts,2);assert.equal(rows[0].description,'');assert.ok(!JSON.stringify(rows).includes('movie.mp4'));
 attempts=0;
 global.fetch=async()=>{attempts++;return Response.json({code:'XX000'},{status:503});};
 assert.equal((await api.GET(dbReq('films','GET',undefined,viewer))).status,502);assert.equal(attempts,1);
});
test('legacy admin description writes report required update without dropping data',async()=>{
 const cookie=await admin(),mock=global.fetch;let writes=0;
 global.fetch=async(input,init)=>{
  if(new URL(String(input)).pathname==='/rest/v1/films'&&init?.method==='PATCH'){
   writes++;return Response.json({code:'PGRST204'},{status:400});
  }
  return mock(input,init);
 };
 const response=await api.PATCH(dbReq('films?id=eq.1','PATCH',{description:'Save me'},cookie));
 assert.equal(response.status,409);assert.equal((await response.json()).code,'FILM_DESCRIPTION_SETUP_REQUIRED');
 assert.equal(writes,1);assert.equal(tables.films[0].description,undefined);
});
test('payment price/status/owner are server controlled and retries idempotent',async()=>{
 const c=await register();const body={ref_code:'123456',film_id:1,plan:'pick_10_30d_9000',amount:1,status:'confirmed',user_id:999};
 let r=await api.POST(dbReq('pending_payments','POST',body,c));assert.equal(r.status,200);
 const p=(await r.json())[0];assert.equal(p.amount,9000);assert.equal(p.status,'pending');assert.equal(p.user_id,tables.users[0].id);
 r=await api.POST(dbReq('pending_payments','POST',body,c));assert.equal(r.status,200);assert.equal(tables.pending_payments.length,1);
 assert.equal((await api.PATCH(dbReq('pending_payments?ref_code=eq.123456','PATCH',{status:'confirmed'},c))).status,403);
});
test('payment read is constrained to cookie owner',async()=>{
 const c=await register();tables.pending_payments.push({id:1,user_id:999,status:'confirmed'});
 const r=await api.GET(dbReq('pending_payments?user_id=eq.999&select=*','GET',undefined,c));assert.deepEqual(await r.json(),[]);
});
test('TAZA full playback requires a confirmed subscription and a valid session',async()=>{
  assert.equal((await playback.GET(req('/api/playback?id=1'))).status,403);
  const cookie=await register();
  assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,cookie))).status,403);
  const created=await api.POST(dbReq('pending_payments','POST',{ref_code:'712345',plan:'all_30d_15000'},cookie));
  assert.equal(created.status,200);
  assert.equal((await created.json())[0].amount,15000);
  assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,cookie))).status,403);
  assert.equal((await bankSms('712345','15,000.00')).status,200);
  const row=tables.pending_payments[0];
  assert.equal(row.status,'confirmed');
  assert.equal(row.amount,15000);
  assert.equal(paymentExpiry(row)-Date.parse(String(row.confirmed_at)),30*86400000);
  const response=await playback.GET(req('/api/playback?id=1','GET',undefined,cookie));
  assert.equal(response.status,200);
  assert.equal((await response.json()).url,'https://video.example/movie.mp4');
});
test('TAZA rejects new purchases of the retired 12,000₮ plan but honors an old confirmed receipt',async()=>{
 const cookie=await register();
 assert.equal((await api.POST(dbReq('pending_payments','POST',{ref_code:'795432',plan:'all_30d_12000'},cookie))).status,400);
 tables.pending_payments.push({id:57,user_id:tables.users[0].id,site_id:'taza',plan:'all_30d_12000',amount:12000,status:'confirmed',confirmed_at:now()});
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,cookie))).status,200);
});

test('TAZA charges exactly 2,000₮ per selected film for 72 hours and preserves older 3,000₮ rights',async()=>{
 const cookie=await register();
 tables.films.push({...tables.films[0],id:2,title:'Other movie'});
 const order=await api.POST(dbReq('pending_payments','POST',{ref_code:'711224',plan:'single',film_id:1,amount:1,status:'confirmed'},cookie));
 assert.equal(order.status,200);
 const [pending]=await order.json();
 assert.equal(pending.amount,2000);assert.equal(pending.status,'pending');
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,cookie))).status,403);
 assert.equal((await bankSms('711224','2,000.00')).status,200);
 assert.equal(paymentExpiry(tables.pending_payments[0])-Date.parse(String(tables.pending_payments[0].confirmed_at)),72*3600000);
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,cookie))).status,200);
 assert.equal((await playback.GET(req('/api/playback?id=2','GET',undefined,cookie))).status,403);
 const legacy=await register('99887766');
 tables.pending_payments.push({id:33,user_id:tables.users[1].id,site_id:'taza',plan:'single',film_id:2,amount:3000,status:'confirmed',created_at:now(),confirmed_at:now()});
 assert.equal((await playback.GET(req('/api/playback?id=2','GET',undefined,legacy))).status,200);
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,legacy))).status,403);
});

test('5-film 6,000₮ plan opens exactly five distinct movies and preserves repeats',async()=>{
 const cookie=await register();
 for(let id=2;id<=8;id++)tables.films.push({...tables.films[0],id,title:'Movie '+id});
 const order=await api.POST(dbReq('pending_payments','POST',{ref_code:'610001',plan:'pick_5_30d_6000',amount:1,status:'confirmed'},cookie));
 assert.equal(order.status,200);
 assert.equal((await order.json())[0].amount,6000);
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,cookie))).status,403);
 assert.equal((await bankSms('610001','6,000.00')).status,200);
 const initial=await (await access.GET(req('/api/access','GET',undefined,cookie))).json();
 assert.equal(initial.bundleRemaining,5);
 for(const id of [1,2,3,4,5])assert.equal((await playback.GET(req('/api/playback?id='+id,'GET',undefined,cookie))).status,200);
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,cookie))).status,200);
 assert.equal(tables.taza_pack_claims.length,5);
 const after=await (await access.GET(req('/api/access','GET',undefined,cookie))).json();
 assert.equal(after.bundleRemaining,0);
 assert.ok(after.access.film_1>Date.now());
 assert.equal((await playback.GET(req('/api/playback?id=6','GET',undefined,cookie))).status,403);
 const other=await register('99771188');
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,other))).status,403);
 tables.pending_payments.find(p=>p.ref_code==='610001')!.confirmed_at=new Date(Date.now()-31*86400000).toISOString();
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,cookie))).status,403);
});

test('10-film 9,000₮ plan opens ten distinct movies and blocks the eleventh',async()=>{
 const cookie=await register();
 for(let id=2;id<=12;id++)tables.films.push({...tables.films[0],id,title:'Movie '+id});
 assert.equal((await api.POST(dbReq('pending_payments','POST',{ref_code:'610006',plan:'pick_10_30d_9000'},cookie))).status,200);
 assert.equal((await bankSms('610006','9,000.00')).status,200);
 for(let id=1;id<=10;id++)assert.equal((await playback.GET(req('/api/playback?id='+id,'GET',undefined,cookie))).status,200);
 assert.equal((await playback.GET(req('/api/playback?id=11','GET',undefined,cookie))).status,403);
 assert.equal(tables.taza_pack_claims.length,10);
 const a=await (await access.GET(req('/api/access','GET',undefined,cookie))).json();
 assert.equal(a.bundleRemaining,0);
});

test('video without playback URL never consumes a film credit',async()=>{
 const cookie=await register();
 tables.films[0].url='';
 assert.equal((await api.POST(dbReq('pending_payments','POST',{ref_code:'610010',plan:'pick_5_30d_6000'},cookie))).status,200);
 assert.equal((await bankSms('610010','6,000.00')).status,200);
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,cookie))).status,404);
 assert.equal(tables.taza_pack_claims.length,0);
});
test('TAZA public film catalog remains visible, paid player remains locked after expired grants',async()=>{
  assert.equal((await api.GET(dbReq('films?select=*'))).status,200);
  assert.equal((await playback.GET(req('/api/playback?id=1'))).status,403);
  const cookie=await register();
  tables.pending_payments.push({id:2,user_id:tables.users[0].id,ref_code:'654320',film_id:null,plan:'all_30d_9500',amount:9500,status:'confirmed',created_at:new Date(Date.now()-31*86400000).toISOString(),confirmed_at:new Date(Date.now()-31*86400000).toISOString(),site_id:'taza'});
  assert.equal((await api.GET(dbReq('films?select=*'))).status,200);
  assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,cookie))).status,403);
});
test('TAZA requires one all-film entitlement even for previously free rows',async()=>{
  tables.films[0].free=true;tables.films[0].locked=false;
  assert.equal((await playback.GET(req('/api/playback?id=1'))).status,403);
  const cookie=await register();
  assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,cookie))).status,403);
  tables.pending_payments.push({id:10,user_id:tables.users[0].id,plan:'all_30d_9500',amount:9500,status:'confirmed',confirmed_at:now(),site_id:'taza'});
  assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,cookie))).status,200);
  tables.films[0].free=false;tables.films[0].locked=true;
  assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,cookie))).status,200);
});
test('all package plans use 72-hour expiry while single and yearly stay distinct',()=>{
 const time=Date.parse('2026-01-01T00:00:00Z');const base={status:'confirmed',confirmed_at:new Date(time).toISOString()};
 assert.equal(paymentExpiry({...base,plan:'3day'}),time+72*3600000);
 assert.equal(paymentExpiry({...base,plan:'all_48h'}),time+72*3600000);
 assert.equal(paymentExpiry({...base,plan:'entry_72h'}),time+72*3600000);
 assert.equal(paymentExpiry({...base,plan:'gadaad_1month'}),time+72*3600000);
 assert.equal(paymentExpiry({...base,plan:'1year'}),time+365*86400000);
 assert.equal(paymentExpiry({...base,confirmed_at:'bad'}),0);
 const a=accessFromPayments([{...base,plan:'gadaad_1month'},{...base,plan:'all_1month',confirmed_at:new Date(time-86400000).toISOString()},{...base,plan:'all_48h'}],time);
 assert.equal(a.cat_gadaad,time+72*3600000);
 assert.equal(a.monthly,time+72*3600000);
 assert.equal(canWatch({id:1,locked:true,badge:'Хэлтэй|Орос'},[{...base,plan:'all_48h'}],time),true);
 assert.equal(canWatch({id:1,locked:true},[],time),false);
});
test('SMS cannot self-confirm; missing/wrong amount blocked; valid signed SMS works once',async()=>{
 tables.pending_payments.push({id:1,ref_code:'123456',amount:5000,status:'pending',created_at:now()});
 assert.equal((await sms.POST(req('/api/sms','POST',{text:'ORLOGO:5,000MNT Utga:123456'}))).status,401);
 const headers={authorization:`Bearer ${process.env.SMS_WEBHOOK_SECRET}`};
 for(const text of ['Utga:123456','ORLOGO:1MNT Utga:123456'])assert.equal((await sms.POST(req('/api/sms','POST',{text},undefined,headers))).status,400);
 assert.equal((await sms.POST(req('/api/sms','POST',{text:'ORLOGO:5,000MNT Utga:123456'},undefined,headers))).status,200);
 assert.equal(tables.pending_payments[0].status,'confirmed');
 const confirmed=tables.pending_payments[0].confirmed_at;
 assert.equal((await sms.POST(req('/api/sms','POST',{text:'ORLOGO:5,000MNT Utga:123456'},undefined,headers))).status,200);
 assert.equal(tables.pending_payments[0].confirmed_at,confirmed);
 assert.equal(parseBankSms('ZARLAGA:5000MNT Utga:123456'),null);
});
test('matched TAZA entry reference accepts any bank income above 5000 and opens every movie',async()=>{
 const cookie=await register();const uid=tables.users[0].id;
 tables.films.push({...tables.films[0],id:2,title:'Second movie'});
 tables.pending_payments.push({id:77,user_id:uid,ref_code:'567890',film_id:null,plan:'entry_72h',amount:12500,status:'pending',created_at:now(),site_id:'taza'});
 assert.equal((await bankSms('567890','5,000.00')).status,400);
 assert.equal(tables.pending_payments[0].status,'pending');
 assert.equal((await bankSms('567890','5,001.00')).status,200);
 assert.equal(tables.pending_payments[0].status,'confirmed');
 assert.equal(tables.pending_payments[0].confirmed_amount,5001);
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,cookie))).status,200);
 assert.equal((await playback.GET(req('/api/playback?id=2','GET',undefined,cookie))).status,200);
});
test('admin manual confirmation stores the actual flexible entry amount',async()=>{
 const c=await admin();
 tables.pending_payments.push({id:77,ref_code:'567891',user_id:10,film_id:null,plan:'entry_72h',amount:12500,status:'pending',created_at:now(),site_id:'taza'});
 assert.equal((await api.PATCH(dbReq('pending_payments?ref_code=eq.567891','PATCH',{status:'confirmed'},c))).status,400);
 assert.equal((await api.PATCH(dbReq('pending_payments?ref_code=eq.567891','PATCH',{status:'confirmed',confirmed_amount:6000},c))).status,200);
 assert.equal(tables.pending_payments[0].status,'confirmed');
 assert.equal(tables.pending_payments[0].confirmed_amount,6000);
});
test('admin can edit but cannot repeatedly extend confirmed payment',async()=>{
 const c=await admin();assert.equal((await api.PATCH(dbReq('films?id=eq.1','PATCH',{img:'',price:4000},c))).status,200);
 tables.pending_payments.push({id:1,ref_code:'123456',status:'confirmed',confirmed_at:now()});assert.equal((await api.PATCH(dbReq('pending_payments?ref_code=eq.123456','PATCH',{status:'confirmed'},c))).status,409);
});

test('concurrent payment creates return one order; other owners and changed purchases stay blocked',async()=>{
 const c=await register();const other=await register('99112234');
 const mock=global.fetch;
 let reads=0,release!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve;});
 global.fetch=async(input,init)=>{
   const u=new URL(String(input));
   if(u.pathname.endsWith('/pending_payments')&&(!init?.method||init.method==='GET')&&reads<2){
     const response=await mock(input,init);
     reads++;if(reads===2)release();
     await gate;return response;
   }
   return mock(input,init);
 };
 const body={ref_code:'654321',film_id:1,plan:'pick_10_30d_9000'};
 const responses=await Promise.all([api.POST(dbReq('pending_payments','POST',body,c)),api.POST(dbReq('pending_payments','POST',body,c))]);
 assert.deepEqual(responses.map(r=>r.status),[200,200]);
 assert.deepEqual(await responses[0].json(),await responses[1].json());
 assert.equal(tables.pending_payments.length,1);
 assert.equal((await api.POST(dbReq('pending_payments','POST',body,other))).status,409);
 tables.pending_payments[0].amount=4000;
 assert.equal((await api.POST(dbReq('pending_payments','POST',body,c))).status,409);
 tables.pending_payments[0].amount=9000;tables.pending_payments[0].status='confirmed';
 assert.equal((await api.POST(dbReq('pending_payments','POST',body,c))).status,200);
 assert.equal(tables.pending_payments.length,1);
 tables.pending_payments[0].status='revoked';
 assert.equal((await api.POST(dbReq('pending_payments','POST',body,c))).status,409);
});


test('admin grants a package with null film ID and free grant amount, then playback opens',async()=>{
 const userCookie=await register();const c=await admin();
 const r=await api.POST(dbReq('pending_payments','POST',{ref_code:'555555',user_id:tables.users[0].id,film_id:0,plan:'gadaad_3day',amount:8000,status:'confirmed'},c));
 assert.equal(r.status,200);assert.equal(tables.pending_payments[0].film_id,null);assert.equal(tables.pending_payments[0].amount,0);
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,userCookie))).status,200);
 assert.equal((await api.POST(dbReq('pending_payments','POST',{ref_code:'555556',user_id:tables.users[0].id,film_id:0,plan:'single',status:'confirmed'},c))).status,400);
});
test('MacroDroid JSON sms_message and X-SMS-Sender confirm 9,000 MNT once',async()=>{
 const cookie=await register();
 const created=await api.POST(dbReq('pending_payments','POST',{ref_code:'889999',plan:'pick_10_30d_9000'},cookie));
 assert.equal(created.status,200);
 process.env.SMS_ALLOWED_SENDER='Khan Bank';
 const message='Tany dansand ORLOGO:9,000.00MNT orj bolloo. Utga:889999';
 const send=(sender='Khan Bank')=>sms.POST(req('/api/sms','POST',{sms_message:message},undefined,{
  authorization:`Bearer ${process.env.SMS_WEBHOOK_SECRET}`,
  'x-sms-sender':sender,
 }));
 assert.equal((await send('unknown sender')).status,403);
 assert.equal(tables.pending_payments[0].status,'pending');
 assert.equal((await send()).status,200);
 const confirmedAt=tables.pending_payments[0].confirmed_at;
 assert.equal(tables.pending_payments[0].amount,9000);
 assert.equal(tables.pending_payments[0].status,'confirmed');
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,cookie))).status,200);
 assert.equal((await send()).status,200);
 assert.equal(tables.pending_payments[0].confirmed_at,confirmedAt);
});
test('MacroDroid plain text confirms a 6,000₮ five-film pack and duplicate does not extend',async()=>{
 const cookie=await register();tables.films.push({...tables.films[0],id:2,title:'Other movie'});
 const order=await api.POST(dbReq('pending_payments','POST',{ref_code:'888888',film_id:1,plan:'pick_5_30d_6000'},cookie));
 assert.equal(order.status,200);assert.equal((await order.json())[0].amount,6000);
 process.env.SMS_ALLOWED_SENDER='BANK_TEST';
 const send=(sender:string,text='ORLOGO:6,000.00MNT Utga:888888')=>sms.POST(new NextRequest('https://app.test/api/sms',{method:'POST',headers:{'content-type':'text/plain',authorization:`Bearer ${process.env.SMS_WEBHOOK_SECRET}`,'x-sms-sender':sender},body:text}));
 assert.equal((await send('OTHER')).status,403);
 assert.equal((await send('BANK_TEST')).status,200);
 const stamp=tables.pending_payments[0].confirmed_at;
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,cookie))).status,200);
 assert.equal((await playback.GET(req('/api/playback?id=2','GET',undefined,cookie))).status,200);
 assert.equal((await send('BANK_TEST')).status,200);assert.equal(tables.pending_payments[0].confirmed_at,stamp);
 tables.pending_payments[0].status='revoked';assert.equal((await send('BANK_TEST')).status,409);
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,cookie))).status,403);
});
test('SMS rejects malformed amounts, multiple references, outgoing and expired orders',async()=>{
 for(const text of ['ORLOGO:5,00MNT Utga:123456','ORLOGO:5000MNT Utga:1234567','ORLOGO:5000MNT Utga:123456 Utga:654321','ZARLAGA:5000MNT Utga:123456'])assert.equal(parseBankSms(text),null);
 assert.deepEqual(parseBankSms('Орлого: 5,000.00₮ Утга: 123456'),{ref:'123456',amount:5000});
 tables.pending_payments.push({id:1,ref_code:'123456',amount:5000,status:'pending',created_at:new Date(Date.now()-25*3600000).toISOString()});
 const r=await sms.POST(req('/api/sms','POST',{text:'ORLOGO:5000MNT Utga:123456'},undefined,{authorization:`Bearer ${process.env.SMS_WEBHOOK_SECRET}`}));
 assert.equal(r.status,409);assert.equal(tables.pending_payments[0].status,'pending');
});

test('four-hour delayed bank SMS opens its owner and film; viewing time starts at confirmation',async(t)=>{
 const start=Date.parse('2026-09-11T01:00:00Z');
 t.mock.timers.enable({apis:['Date'],now:start});
 process.env.SMS_ALLOWED_SENDER='Khan Bank';
 const owner=await register('99110001'),other=await register('99110002');
 tables.films.push({...tables.films[0],id:2,title:'Unpurchased film'});
 assert.equal((await api.POST(dbReq('pending_payments','POST',{ref_code:'410001',film_id:1,plan:'pick_10_30d_9000'},owner))).status,200);
 // The order already existed for two hours when the forwarding phone lost service.
 t.mock.timers.setTime(start+2*3600000);
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,owner))).status,403);
 // No webhook is delivered during the next four hours. Then the original SMS arrives.
 const receivedAt=start+6*3600000;
 t.mock.timers.setTime(receivedAt);
 assert.equal((await bankSms('410001','9,000.00')).status,200);
 const payment=tables.pending_payments[0];
 assert.equal(payment.created_at,new Date(start).toISOString());
 assert.equal(payment.confirmed_at,new Date(receivedAt).toISOString());
 assert.equal(paymentExpiry(payment),receivedAt+30*86400000);
 const rights=await (await access.GET(req('/api/access','GET',undefined,owner))).json();
 assert.equal(rights.access.monthly,undefined);
 assert.equal(rights.bundleRemaining,10);
 assert.equal(rights.access.film_2,undefined);
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,owner))).status,200);
 assert.equal((await playback.GET(req('/api/playback?id=2','GET',undefined,owner))).status,200);
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,other))).status,403);
});

test('a burst of delayed SMS and concurrent duplicates confirms every matching order once',async(t)=>{
 const instant=Date.parse('2026-09-11T10:00:00Z');
 t.mock.timers.enable({apis:['Date'],now:instant});
 process.env.SMS_ALLOWED_SENDER='Khan Bank';
 const owner=await register();
 const userId=tables.users[0].id;
 for(let i=0;i<20;i++)tables.pending_payments.push({id:200+i,user_id:userId,film_id:1,plan:'single',ref_code:String(420000+i),amount:5000,status:'pending',created_at:new Date(instant-4*3600000).toISOString()});
 const original=global.fetch;let confirmedWrites=0;
 global.fetch=async(input,init)=>{
  const response=await original(input,init);
  if(init?.method==='PATCH'&&String(input).includes('/pending_payments?')){
   const changed=await response.clone().json();
   confirmedWrites+=changed.length;
  }
  return response;
 };
 const refs=[...tables.pending_payments].reverse().flatMap(p=>[String(p.ref_code),String(p.ref_code),String(p.ref_code)]);
 const responses=await Promise.all(refs.map(ref=>bankSms(ref)));
 assert.ok(responses.every(r=>r.status===200));
 assert.equal(confirmedWrites,20);
 assert.equal(tables.pending_payments.length,20);
 assert.ok(tables.pending_payments.every(p=>p.status==='confirmed'&&p.confirmed_at===new Date(instant).toISOString()));
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,owner))).status,200);
});

test('a failed delivery remains pending and a later retry confirms the original order',async()=>{
 process.env.SMS_ALLOWED_SENDER='Khan Bank';
 tables.pending_payments.push({id:1,ref_code:'430001',amount:5000,status:'pending',created_at:new Date(Date.now()-4*3600000).toISOString()});
 const original=global.fetch;
 global.fetch=async()=>{throw new TypeError('Simulated database connection loss');};
 const failed=await bankSms('430001');
 assert.ok(failed.status>=500);
 assert.equal((await failed.json()).ok,undefined);
 assert.equal(tables.pending_payments[0].status,'pending');
 global.fetch=original;
 assert.equal((await bankSms('430001')).status,200);
 assert.equal(tables.pending_payments[0].status,'confirmed');
});

test('lost confirmation response can be retried after 24 hours without extending access',async(t)=>{
 const start=Date.parse('2026-09-11T01:00:00Z');
 t.mock.timers.enable({apis:['Date'],now:start});
 process.env.SMS_ALLOWED_SENDER='Khan Bank';
 tables.pending_payments.push({id:1,ref_code:'440001',amount:5000,plan:'single',status:'pending',created_at:new Date(start-4*3600000).toISOString()});
 const original=global.fetch;
 global.fetch=async(input,init)=>{
  const response=await original(input,init);
  if(init?.method==='PATCH')throw new TypeError('Connection lost after database commit');
  return response;
 };
 assert.ok((await bankSms('440001')).status>=500);
 const payment=tables.pending_payments[0];
 assert.equal(payment.status,'confirmed');
 const confirmedAt=payment.confirmed_at,expiry=paymentExpiry(payment);
 global.fetch=original;
 t.mock.timers.setTime(start+25*3600000);
 const retry=await bankSms('440001');
 assert.equal(retry.status,200);
 assert.deepEqual(await retry.json(),{ok:true,alreadyConfirmed:true,ref:'440001'});
 assert.equal(payment.confirmed_at,confirmedAt);
 assert.equal(paymentExpiry(payment),expiry);
 payment.status='revoked';
 assert.equal((await bankSms('440001')).status,409);
 assert.equal(payment.status,'revoked');
});

test('late delivery still rejects an untrusted sender, wrong amount or unknown six-digit code',async()=>{
 process.env.SMS_ALLOWED_SENDER='Khan Bank';
 tables.pending_payments.push({id:1,ref_code:'450001',amount:5000,status:'pending',created_at:new Date(Date.now()-4*3600000).toISOString()});
 assert.equal((await bankSms('450001','5,000.00','OTHER')).status,403);
 assert.equal((await bankSms('450001','4,999.00')).status,400);
 assert.equal((await bankSms('459999')).status,404);
 assert.equal(tables.pending_payments[0].status,'pending');
 assert.equal(tables.pending_payments[0].confirmed_at,undefined);
 assert.equal((await bankSms('450001')).status,200);
});
test('optional settings schema absence degrades gracefully; unrelated errors remain visible',async()=>{
 global.fetch=async()=>Response.json({code:'42703'},{status:400});
 const r=await settings.GET();assert.equal(r.status,200);assert.equal((await r.json()).setupRequired,true);
 global.fetch=async()=>Response.json({code:'42501'},{status:403});assert.equal((await settings.GET()).status,502);
});
test('admin cannot accidentally mutate all rows with only sorting or selection',async()=>{
 const cookie=await admin();assert.equal((await api.DELETE(dbReq('films?order=id.desc','DELETE',undefined,cookie))).status,400);
});

test('revoking one purchase preserves other rights and allows later purchases',async()=>{
 const cookie=await register();const uid=tables.users[0].id;const ac=await admin();
 tables.pending_payments.push(
  {id:88,user_id:uid,ref_code:'123456',film_id:1,amount:5000,status:'confirmed',plan:'single',created_at:now(),confirmed_at:now(),site_id:'taza'},
  {id:89,user_id:uid,ref_code:'234567',amount:8000,status:'confirmed',plan:'all_1month',created_at:now(),confirmed_at:now(),site_id:'taza'});
 assert.equal((await api.PATCH(dbReq('pending_payments?ref_code=eq.123456','PATCH',{status:'revoked'},ac))).status,200);
 assert.equal(tables.pending_payments[1].status,'confirmed');
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,cookie))).status,200);
 assert.equal((await api.PATCH(dbReq('pending_payments?ref_code=eq.234567','PATCH',{status:'revoked'},ac))).status,200);
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,cookie))).status,403);
 assert.equal((await api.POST(dbReq('pending_payments','POST',{ref_code:'654321',plan:'pick_10_30d_9000',film_id:1},cookie))).status,200);
 tables.films[0].free=true;
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,cookie))).status,403);
 assert.equal((await bankSms('654321','9,000.00')).status,200);
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,cookie))).status,200);
});


test('expired pending order cannot be reused, requiring a fresh reference',async()=>{
 const c=await register();const body={ref_code:'123456',film_id:1,plan:'pick_10_30d_9000'};
 await api.POST(dbReq('pending_payments','POST',body,c));
 tables.pending_payments[0].created_at=new Date(Date.now()-25*3600000).toISOString();
 assert.equal((await api.POST(dbReq('pending_payments','POST',body,c))).status,409);
 assert.equal(tables.pending_payments.length,1);
});

test('entitlements beyond the database page cap authorize playback and stay owner-scoped',async()=>{
 const c=await register();const uid=tables.users[0].id;
 for(let i=1;i<=405;i++)tables.pending_payments.push({id:i,user_id:uid,film_id:i===405?1:2,plan:'single',status:'confirmed',confirmed_at:now()});
 tables.pending_payments.push({id:500,user_id:999,film_id:3,plan:'single',status:'confirmed',confirmed_at:now()});
 const rows=await (await access.GET(req('/api/access','GET',undefined,c))).json();
 assert.ok(rows.access.film_1>Date.now());assert.equal(rows.access.film_3,undefined);
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,c))).status,200);
 tables.pending_payments.find(p=>p.id===405)!.status='revoked';
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,c))).status,403);
});

test('announcement deletion selects one row and preserves unrelated messages',async()=>{
 const c=await admin();
 tables.contact_messages.push({id:1,message:'first',is_announcement:true},{id:2,message:'new',is_announcement:true},{id:3,message:'chat',is_announcement:false});
 assert.equal((await api.DELETE(dbReq('contact_messages?id=eq.2','DELETE',undefined,c))).status,200);
 assert.deepEqual(tables.contact_messages.map(r=>r.id),[1,3]);
 assert.equal((await api.DELETE(dbReq('contact_messages?id=eq.1','DELETE'))).status,403);
});

test('settings writes require admin, validate URLs and stay scoped to TAZA settings',async()=>{
 assert.equal((await settings.PUT(req('/api/settings','PUT',{messengerUrl:'https://m.me/test'}))).status,403);
 const c=await admin();assert.equal((await settings.PUT(req('/api/settings','PUT',{messengerUrl:'javascript:alert(1)'},c))).status,400);
 assert.equal((await settings.PUT(req('/api/settings','PUT',{messengerUrl:'https://m.me/test'},c))).status,200);
 assert.equal(tables.site_settings.length,1);
 assert.equal(tables.site_settings[0].site_id,'taza');
 assert.equal(tables.site_settings[0].messenger_url,'https://m.me/test');
});

test('payment settings hide an invalid legacy IBAN and accept only a verified 20-character IBAN',async()=>{
 const old=await settings.GET();
 assert.equal(old.status,200);
 assert.equal((await old.json()).ibanSetupRequired,true);
 const c=await admin();
 assert.equal((await settings.PUT(req('/api/settings','PUT',{bankIban:'MN03000500'},c))).status,400);
 const valid='MN121234123456789123';
 const saved=await settings.PUT(req('/api/settings','PUT',{bankIban:valid},c));
 assert.equal(saved.status,200);
 const response=await saved.json();
 assert.equal(response.bankIban,valid);
 assert.equal(response.ibanSetupRequired,false);
 assert.equal(tables.site_settings[0].bank_iban,valid);
});

test('admin cannot save a filter label as the movie category',async()=>{
 const c=await admin();
 assert.equal((await api.PATCH(dbReq('films?id=eq.1','PATCH',{badge:'Хэлтэй|Бүгд'},c))).status,400);
 assert.equal((await api.PATCH(dbReq('films?id=eq.1','PATCH',{badge:'Хэлтэй|Гадаад'},c))).status,200);
});

test('hidden paid URLs cannot be inferred through public filters or sorting',async()=>{
 for(const query of ['url=like.https*','or=(url.like.a*,title.eq.Test)','order=url.asc','preview_url=eq.secret']){
  assert.equal((await api.GET(dbReq(`films?${query}`))).status,400);
 }
 const viewer=await paidUser();
 assert.equal((await api.GET(dbReq('films?badge=eq.Хэлтэй%7CГадаад&order=id.desc&limit=200','GET',undefined,viewer))).status,200);
});
test('reference history cannot be deleted or reassigned even through admin mutations',async()=>{
 const c=await admin();tables.pending_payments.push({id:9,ref_code:'123456',user_id:1,amount:5000,status:'confirmed',created_at:now()});
 assert.equal((await api.DELETE(dbReq('pending_payments?id=eq.9','DELETE',undefined,c))).status,405);
 assert.equal((await api.PATCH(dbReq('pending_payments?id=eq.9','PATCH',{status:'confirmed',user_id:2},c))).status,400);
 assert.equal((await api.PATCH(dbReq('pending_payments?id=eq.9','PATCH',{status:'pending'},c))).status,400);
 assert.equal(tables.pending_payments[0].status,'confirmed');assert.equal(tables.pending_payments[0].user_id,1);
});
test('configured HTTPS origin works behind an internal HTTP proxy without trusting forged headers',async()=>{
 const previous=process.env.SITE_URL;process.env.SITE_URL='https://kino.example';
 try{
  const make=(origin:string)=>new NextRequest('http://127.0.0.1:3000/api/auth',{method:'POST',headers:{origin,'Content-Type':'application/json','x-forwarded-host':'evil.test','x-forwarded-proto':'https'},body:JSON.stringify({action:'register',phone:'99112233',pin:'1234'})});
  assert.equal((await auth.POST(make('https://kino.example'))).status,200);
  assert.equal((await auth.POST(make('https://evil.test'))).status,403);
  process.env.SITE_URL='https://kino.example/wrong-path';assert.equal((await auth.POST(make('https://kino.example'))).status,503);
 }finally{if(previous===undefined)delete process.env.SITE_URL;else process.env.SITE_URL=previous;}
});
test('oversized auth and SMS requests are bounded before parsing',async()=>{
 assert.equal((await auth.POST(req('/api/auth','POST',{junk:'x'.repeat(17000)}))).status,413);
 const r=await sms.POST(new NextRequest('https://app.test/api/sms',{method:'POST',headers:{'content-type':'text/plain',authorization:`Bearer ${process.env.SMS_WEBHOOK_SECRET}`},body:'x'.repeat(13000)}));assert.equal(r.status,413);
});

test('order creation retries acknowledge an already-confirmed same purchase without renewing rights',async()=>{
 const c=await register();const body={ref_code:'234567',film_id:1,plan:'pick_10_30d_9000'};
 await api.POST(dbReq('pending_payments','POST',body,c));const confirmedAt=new Date(Date.now()-3600000).toISOString();tables.pending_payments[0].status='confirmed';tables.pending_payments[0].confirmed_at=confirmedAt;
 const r=await api.POST(dbReq('pending_payments','POST',body,c));assert.equal(r.status,200);assert.equal(tables.pending_payments.length,1);assert.equal((await r.json())[0].confirmed_at,confirmedAt);
 tables.pending_payments[0].user_id=999;const conflict=await api.POST(dbReq('pending_payments','POST',body,c));assert.equal(conflict.status,409);assert.equal((await conflict.json()).code,'REF_CONFLICT');
});


test('appearance is public but only an admin may update its bounded settings',async()=>{
 const settings={layout:4,tone:77,revision:0};
 assert.deepEqual(await (await appearance.GET()).json(),{appearance:{layout:1,tone:25,revision:0}});
 assert.match((await appearance.GET()).headers.get('cache-control')||'',/no-store/);
 assert.equal((await appearance.PUT(req('/api/appearance','PUT',settings))).status,403);
 const user=await register();
 assert.equal((await appearance.PUT(req('/api/appearance','PUT',settings,user))).status,403);
 const cookie=await admin();
 assert.equal((await appearance.PUT(req('/api/appearance','PUT',settings,cookie,{origin:'https://evil.test'}))).status,403);
 const result=await appearance.PUT(req('/api/appearance','PUT',settings,cookie));
 assert.equal(result.status,200);
 assert.deepEqual(await result.json(),{appearance:{layout:4,tone:77,revision:1}});
 assert.deepEqual(await (await appearance.GET()).json(),{appearance:{layout:4,tone:77,revision:1}});
 assert.equal((await appearance.PUT(req('/api/appearance','PUT',{...settings,layout:2},cookie))).status,409);
 assert.deepEqual(tables.site_appearance,[{id:1,layout:4,tone:77,revision:1,site_id:'taza'}]);
});
test('appearance rejects unbounded or executable input without changing settings',async()=>{
 const cookie=await admin(),base={layout:1,tone:25,revision:0};
 const invalid=[null,[],{}, {...base,layout:0},{...base,layout:5},{...base,layout:'2'}, {...base,tone:-1},{...base,tone:101},{...base,tone:1.5},{...base,tone:'50'}, {...base,revision:-1},{...base,revision:0.1},{...base,css:'url(https://evil.test)'},{...base,id:2}];
 for(const value of invalid)assert.equal((await appearance.PUT(req('/api/appearance','PUT',value,cookie))).status,400);
 assert.deepEqual(tables.site_appearance,[{id:1,...base,site_id:'taza'}]);
 tables.site_appearance=[];
 assert.equal((await appearance.GET()).status,503);
});

test('temporary MacroDroid download denies visitors and ordinary members',async(t)=>{
 t.mock.method(Date,'now',()=>Date.parse('2026-11-06T08:00:00Z'));
 const stranger=await macroDownload.GET(req('/api/admin/macrodroid'));
 assert.equal(stranger.status,403);
 assert.ok(!(await stranger.text()).includes(process.env.SMS_WEBHOOK_SECRET!));
 const user=await register();
 const member=await macroDownload.GET(req('/api/admin/macrodroid','GET',undefined,user));
 assert.equal(member.status,403);
});

test('master admin downloads matching SMS macro with private, noncacheable credentials',async(t)=>{
 // Avoid making a newly issued 1-hour admin session look expired by mocking
 // Date.now to an old fixed timestamp while new Date() uses the real time.
 const realNow=Date.now();
 t.mock.method(Date,'now',()=>realNow);
 const cookie=await admin();
 const response=await macroDownload.GET(req('/api/admin/macrodroid','GET',undefined,cookie));
 assert.equal(response.status,200);
 assert.match(response.headers.get('content-disposition')||'',/attachment; filename="TAZA_MacroDroid_SMS_12000.macro"/);
 assert.match(response.headers.get('cache-control')||'',/private.*no-store/);
 assert.equal(response.headers.get('content-type'),'application/octet-stream');
 const macro=(await response.json()).macro;
 const config=macro.m_actionList[0].requestConfig;
 assert.equal(config.urlToOpen,'https://taza.site/api/sms');
 assert.equal(config.contentType,'text/plain');
 assert.equal(config.contentBodyText,'{sms_message}');
 assert.equal(config.allowAnyCertificate,false);
 assert.equal(config.headerParams.find((v:{paramName:string})=>v.paramName==='Authorization')?.paramValue,`Bearer ${process.env.SMS_WEBHOOK_SECRET}`);
 assert.equal(config.headerParams.find((v:{paramName:string})=>v.paramName==='X-SMS-Sender')?.paramValue,'{sms_number}');
 assert.equal(macro.m_triggerList[0].enableRegexPhoneNumber,true);
 assert.equal(macro.m_triggerList[0].m_smsNumber,'(?i)^Khan[\\s-]*Bank$');
 assert.equal(macro.m_triggerList[0].enableRegex,true);
 assert.equal(macro.m_triggerList[0].m_smsContent,'(?i)(?:ORLOGO|Орлого)');
});

test('MacroDroid download expires automatically after its temporary window',async(t)=>{
 t.mock.method(Date,'now',()=>Date.parse('2026-11-13T00:00:00Z'));
 const cookie=await admin();
 const expired=await macroDownload.GET(req('/api/admin/macrodroid','GET',undefined,cookie));
 assert.equal(expired.status,410);
 assert.ok(!(await expired.text()).includes(process.env.SMS_WEBHOOK_SECRET!));
});

test('SMS diagnostics are master-admin-only and never include raw bank messages',async()=>{
 const anonymous=await smsDiagnostics.GET(req('/api/admin/sms-diagnostics'));
 assert.equal(anonymous.status,403);
 const user=await register();
 assert.equal((await smsDiagnostics.GET(req('/api/admin/sms-diagnostics','GET',undefined,user))).status,403);
 const adminCookie=await admin();
 const response=await smsDiagnostics.GET(req('/api/admin/sms-diagnostics','GET',undefined,adminCookie));
 assert.equal(response.status,200);
 assert.match(response.headers.get('cache-control')||'',/no-store/);
 const report=await response.json();
 assert.equal(report.smsEventsAvailable,false);
 assert.deepEqual(report.events,[]);
 assert.ok(Array.isArray(report.recentPending));
 assert.ok(!JSON.stringify(report).includes(process.env.SMS_WEBHOOK_SECRET!));
});
test('SMS diagnostics show pending 9000 orders without user phone or secrets',async()=>{
 const user=await register();
 const create=await api.POST(dbReq('pending_payments','POST',{ref_code:'894321',plan:'pick_10_30d_9000'},user));
 assert.equal(create.status,200);
 const adminCookie=await admin();
 const response=await smsDiagnostics.GET(req('/api/admin/sms-diagnostics','GET',undefined,adminCookie));
 assert.equal(response.status,200);
 const report=await response.json();
 assert.equal(report.recentPending.length,1);
 assert.equal(report.recentPending[0].ref,'894321');
 assert.equal(report.recentPending[0].amount,9000);
 assert.equal('phone' in report.recentPending[0],false);
});

test('video source diagnoses actual Bunny HTTP 404 privately for master admin',async()=>{
 const stranger=await videoDiagnostics.GET(req('/api/admin/video-diagnostics?id=1'));
 assert.equal(stranger.status,403);
 const userCookie=await register();
 assert.equal((await videoDiagnostics.GET(req('/api/admin/video-diagnostics?id=1','GET',undefined,userCookie))).status,403);
 const adminCookie=await admin();
 const sample='https://player.mediadelivery.net/play/617966/7088fc08-ea3d-4126-840d-c47aa324b637?token=private';
 tables.films[0].url=sample;
 const native=global.fetch;
 let probed='';
 global.fetch=async(input,init)=>{
   if(String(input).startsWith('https://player.mediadelivery.net/')){
     probed=String(input);
     assert.ok(['HEAD','GET'].includes(String(init?.method)));
     assert.equal(init?.redirect,'manual');
     assert.equal(new Headers(init?.headers).get('Referer'),'https://taza.site/');
     return new Response(null,{status:404});
   }
   return native(input,init);
 };
 try {
   const listing=await videoDiagnostics.GET(req('/api/admin/video-diagnostics','GET',undefined,adminCookie));
   assert.equal(listing.status,200);
   const list=await listing.json();
   assert.ok(list.films.some((f:{id:number})=>f.id===1));
   assert.ok(!JSON.stringify(list).includes('token=private'));
   const checked=await videoDiagnostics.GET(req('/api/admin/video-diagnostics?id=1','GET',undefined,adminCookie));
   assert.equal(checked.status,200);
   const data=await checked.json();
   assert.equal(data.httpStatus,404);
   assert.equal(data.headStatus,404);
   assert.equal(data.method,'GET');
   assert.equal(data.probe,'http');
   assert.match(probed,/\/embed\/617966\//);
   assert.ok(!JSON.stringify(data).includes('token=private'));
 } finally {global.fetch=native;}
});

test('confirmed TAZA viewers see a descriptive missing-video 404, not another payment request',async()=>{
 const cookie=await register();
 const userId=Number(tables.users[0].id);
 tables.pending_payments.push({user_id:userId,site_id:'taza',plan:'all_30d_9500',amount:9500,status:'confirmed',confirmed_at:now()});
 tables.films[0].url='';
 const result=await playback.GET(req('/api/playback?id=1','GET',undefined,cookie));
 assert.equal(result.status,404);
 assert.equal((await result.json()).code,'VIDEO_SOURCE_MISSING');
 assert.equal((await videoDiagnostics.GET(req('/api/admin/video-diagnostics?id=1','GET',undefined,cookie))).status,403);
});

test('Bunny diagnostic rechecks HEAD false 404 with GET and reports a healthy reachable player',async()=>{
 const cookie=await admin();
 tables.films[0].url='https://player.mediadelivery.net/embed/617966/7088fc08-ea3d-4126-840d-c47aa324b637';
 const native=global.fetch;
 let head=0,get=0;
 global.fetch=async(input,init)=>{
   if(String(input).startsWith('https://player.mediadelivery.net/')){
     if(init?.method==='HEAD'){head++;return new Response(null,{status:404});}
     if(init?.method==='GET'){get++;return new Response('ok',{status:200,headers:{'content-type':'text/html'}});}
     throw new Error('unexpected method');
   }
   return native(input,init);
 };
 try{
   const response=await videoDiagnostics.GET(req('/api/admin/video-diagnostics?id=1','GET',undefined,cookie));
   assert.equal(response.status,200);
   const checked=await response.json();
   assert.equal(checked.headStatus,404);
   assert.equal(checked.httpStatus,200);
   assert.equal(checked.method,'GET');
   assert.equal(head,1);
   assert.equal(get,1);
 }finally{global.fetch=native;}
});
