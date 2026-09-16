import assert from 'node:assert/strict';
import { test, beforeEach, after } from 'node:test';
import { NextRequest } from 'next/server';
import { accessFromPayments, canWatch, parseBankSms, paymentExpiry, safeUrl, type Row } from '../lib/domain';
import { pinHash, pinMatches } from '../lib/server';
import * as auth from '../app/api/auth/route';
import * as api from '../app/api/db/route';
import * as playback from '../app/api/playback/route';
import * as sms from '../app/api/sms/route';
import * as settings from '../app/api/settings/route';
import * as access from '../app/api/access/route';
import * as appearance from '../app/api/appearance/route';
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
 delete process.env.SMS_ALLOWED_SENDER;nextId=100;counters={};tables={users:[],films:[{id:1,title:'Test',price:5000,locked:true,free:false,url:'https://video.example/movie.mp4',preview_url:'https://video.example/trailer.mp4',badge:'Хэлтэй|Гадаад'}],pending_payments:[],app_sessions:[],contact_messages:[],sms_logs:[],site_appearance:[{id:1,layout:1,tone:25,revision:0}]};
 global.fetch=async(input,init)=>{
  const u=new URL(String(input));assert.equal(u.origin,'https://test.invalid','test must never access real service');
  const name=u.pathname.replace('/rest/v1/','');const method=init?.method||'GET';const body=init?.body?JSON.parse(String(init.body)):null;
  if(name==='rpc/kino_claim_attempt'){const n=(counters[body.bucket_key]||0)+1;counters[body.bucket_key]=n;return Response.json([{allowed:n<=5}]);}
  assert.ok(name in tables,`unknown table ${name}`);
  tables[name].forEach(r=>{if(r.id===undefined)r.id=nextId++;});
  const match=(row:Row)=>[...u.searchParams].every(([k,v])=>{
   if(['select','order','limit'].includes(k))return true;
   if(v.startsWith('eq.'))return String(row[k])===v.slice(3);
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
const dbReq=(path:string,method='GET',body?:unknown,cookie?:string)=>req(`/api/db?path=${encodeURIComponent(path)}`,method,body,cookie);
function bankSms(ref:string,amount='5,000.00',sender='Khan Bank') {
 return sms.POST(new NextRequest('https://app.test/api/sms',{
  method:'POST',headers:{'content-type':'text/plain',authorization:`Bearer ${process.env.SMS_WEBHOOK_SECRET}`,'x-sms-sender':sender},
  body:`Tany 5***0000 dansand\nORLOGO:${amount}MNT orj\nULDEGDEL:100,000.00MNT\nbolloo.Utga:${ref}`,
 }));
}
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
test('cross-origin mutation is rejected',async()=>{const r=await auth.POST(req('/api/auth','POST',{action:'register',phone:'99112233',pin:'1234'},undefined,{origin:'https://evil.test'}));assert.equal(r.status,403);});
test('public catalog never returns full paid URL; unsafe URLs rejected',async()=>{
 const r=await api.GET(dbReq('films?select=*'));const rows=await r.json();assert.equal(rows[0].url,'|||https://video.example/trailer.mp4');assert.ok(!JSON.stringify(rows).includes('movie.mp4'));
 assert.equal(safeUrl('javascript:alert(1)'), '');assert.equal(safeUrl('https://user:pass@example.com'),'');
});
test('public user list/admin mutation and joins are blocked',async()=>{
 assert.equal((await api.GET(dbReq('users?select=*'))).status,403);
 assert.equal((await api.PATCH(dbReq('films?id=eq.1','PATCH',{price:0}))).status,403);
 assert.equal((await api.GET(dbReq('films?select=*,users(*)'))).status,400);
});
test('movie descriptions round trip through admin edits and public details without exposing full video',async()=>{
 const cookie=await admin(),description='Хоёр найзын аялал.\nМонгол хадмалтай.';
 assert.equal((await api.PATCH(dbReq('films?id=eq.1','PATCH',{description},cookie))).status,200);
 const rows=await (await api.GET(dbReq('films?id=eq.1'))).json();
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
 const mock=global.fetch;let attempts=0;
 global.fetch=async(input,init)=>{
  const url=new URL(String(input));
  if(url.pathname==='/rest/v1/films'){
   attempts++;
   if(url.searchParams.get('select')?.split(',').includes('description'))return Response.json({code:'42703'},{status:400});
  }
  return mock(input,init);
 };
 const response=await api.GET(dbReq('films?id=eq.1'));assert.equal(response.status,200);
 const rows=await response.json();assert.equal(attempts,2);assert.equal(rows[0].description,'');assert.ok(!JSON.stringify(rows).includes('movie.mp4'));
 attempts=0;
 global.fetch=async()=>{attempts++;return Response.json({code:'XX000'},{status:503});};
 assert.equal((await api.GET(dbReq('films'))).status,502);assert.equal(attempts,1);
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
 const c=await register();const body={ref_code:'123456',film_id:1,plan:'single',amount:1,status:'confirmed',user_id:999};
 let r=await api.POST(dbReq('pending_payments','POST',body,c));assert.equal(r.status,200);
 const p=(await r.json())[0];assert.equal(p.amount,5000);assert.equal(p.status,'pending');assert.equal(p.user_id,tables.users[0].id);
 r=await api.POST(dbReq('pending_payments','POST',body,c));assert.equal(r.status,200);assert.equal(tables.pending_payments.length,1);
 assert.equal((await api.PATCH(dbReq('pending_payments?ref_code=eq.123456','PATCH',{status:'confirmed'},c))).status,403);
});
test('payment read is constrained to cookie owner',async()=>{
 const c=await register();tables.pending_payments.push({id:1,user_id:999,status:'confirmed'});
 const r=await api.GET(dbReq('pending_payments?user_id=eq.999&select=*','GET',undefined,c));assert.deepEqual(await r.json(),[]);
});
test('paid playback requires own confirmed unexpired purchase',async()=>{
 const c=await register();assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,c))).status,403);
 tables.pending_payments.push({user_id:tables.users[0].id,film_id:1,plan:'single',status:'confirmed',confirmed_at:now()});
 const r=await playback.GET(req('/api/playback?id=1','GET',undefined,c));assert.equal(r.status,200);assert.equal((await r.json()).url,'https://video.example/movie.mp4');
 tables.pending_payments[0].status='revoked';assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,c))).status,403);
});
test('free playback works without account',async()=>{tables.films[0].free=true;assert.equal((await playback.GET(req('/api/playback?id=1'))).status,200);});
test('3-day and yearly plans, invalid dates and maximum expiry correct',()=>{
 const time=Date.parse('2026-01-01T00:00:00Z');const base={status:'confirmed',confirmed_at:new Date(time).toISOString()};
 assert.equal(paymentExpiry({...base,plan:'3day'}),time+3*86400000);assert.equal(paymentExpiry({...base,plan:'1year'}),time+365*86400000);
 assert.equal(paymentExpiry({...base,confirmed_at:'bad'}),0);
 const a=accessFromPayments([{...base,plan:'gadaad_1month'},{...base,plan:'all_1month',confirmed_at:new Date(time-86400000).toISOString()}],time);
 assert.equal(a.cat_gadaad,time+30*86400000);assert.equal(canWatch({id:1,locked:true},[],time),false);
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
 const body={ref_code:'654321',film_id:1,plan:'single'};
 const responses=await Promise.all([api.POST(dbReq('pending_payments','POST',body,c)),api.POST(dbReq('pending_payments','POST',body,c))]);
 assert.deepEqual(responses.map(r=>r.status),[200,200]);
 assert.deepEqual(await responses[0].json(),await responses[1].json());
 assert.equal(tables.pending_payments.length,1);
 assert.equal((await api.POST(dbReq('pending_payments','POST',body,other))).status,409);
 tables.pending_payments[0].amount=4000;
 assert.equal((await api.POST(dbReq('pending_payments','POST',body,c))).status,409);
 tables.pending_payments[0].amount=5000;tables.pending_payments[0].status='confirmed';
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
test('MacroDroid plain text validates sender and opens only purchased movie; duplicate does not extend',async()=>{
 const cookie=await register();await api.POST(dbReq('pending_payments','POST',{ref_code:'888888',film_id:1,plan:'single'},cookie));
 process.env.SMS_ALLOWED_SENDER='BANK_TEST';
 const send=(sender:string,text='ORLOGO:5,000.00MNT Utga:888888')=>sms.POST(new NextRequest('https://app.test/api/sms',{method:'POST',headers:{'content-type':'text/plain',authorization:`Bearer ${process.env.SMS_WEBHOOK_SECRET}`,'x-sms-sender':sender},body:text}));
 assert.equal((await send('OTHER')).status,403);
 assert.equal((await send('BANK_TEST')).status,200);
 const stamp=tables.pending_payments[0].confirmed_at;
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,cookie))).status,200);
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
 assert.equal((await api.POST(dbReq('pending_payments','POST',{ref_code:'410001',film_id:1,plan:'single'},owner))).status,200);
 // The order already existed for two hours when the forwarding phone lost service.
 t.mock.timers.setTime(start+2*3600000);
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,owner))).status,403);
 // No webhook is delivered during the next four hours. Then the original SMS arrives.
 const receivedAt=start+6*3600000;
 t.mock.timers.setTime(receivedAt);
 assert.equal((await bankSms('410001')).status,200);
 const payment=tables.pending_payments[0];
 assert.equal(payment.created_at,new Date(start).toISOString());
 assert.equal(payment.confirmed_at,new Date(receivedAt).toISOString());
 assert.equal(paymentExpiry(payment),receivedAt+3*86400000);
 const rights=await (await access.GET(req('/api/access','GET',undefined,owner))).json();
 assert.equal(rights.access.film_1,receivedAt+3*86400000);
 assert.equal(rights.access.film_2,undefined);
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,owner))).status,200);
 assert.equal((await playback.GET(req('/api/playback?id=2','GET',undefined,owner))).status,403);
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
  {id:88,user_id:uid,ref_code:'123456',film_id:1,amount:5000,status:'confirmed',plan:'single',created_at:now()},
  {id:89,user_id:uid,ref_code:'234567',amount:8000,status:'confirmed',plan:'all_1month',created_at:now()});
 assert.equal((await api.PATCH(dbReq('pending_payments?ref_code=eq.123456','PATCH',{status:'revoked'},ac))).status,200);
 assert.equal(tables.pending_payments[1].status,'confirmed');
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,cookie))).status,200);
 assert.equal((await api.PATCH(dbReq('pending_payments?ref_code=eq.234567','PATCH',{status:'revoked'},ac))).status,200);
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,cookie))).status,403);
 assert.equal((await api.POST(dbReq('pending_payments','POST',{ref_code:'654321',plan:'single',film_id:1},cookie))).status,200);
 tables.films[0].free=true;
 assert.equal((await playback.GET(req('/api/playback?id=1','GET',undefined,cookie))).status,200);
});


test('expired pending order cannot be reused, requiring a fresh reference',async()=>{
 const c=await register();const body={ref_code:'123456',film_id:1,plan:'single'};
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

test('settings writes require admin, validate URLs and call only the settings RPC',async()=>{
 assert.equal((await settings.PUT(req('/api/settings','PUT',{messengerUrl:'https://m.me/test'}))).status,403);
 const c=await admin();assert.equal((await settings.PUT(req('/api/settings','PUT',{messengerUrl:'javascript:alert(1)'},c))).status,400);
 const original=global.fetch;
 let writes=0;
 global.fetch=async(input,init)=>{
  const url=new URL(String(input));
  if(url.pathname.endsWith('/rpc/kino_save_settings')){
    writes++;assert.deepEqual(JSON.parse(JSON.parse(String(init?.body)).settings_value),{messengerUrl:'https://m.me/test'});return Response.json([]);
  }
  return original(input,init);
 };
 assert.equal((await settings.PUT(req('/api/settings','PUT',{messengerUrl:'https://m.me/test'},c))).status,200);assert.equal(writes,1);
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
 assert.equal((await api.GET(dbReq('films?badge=eq.Хэлтэй%7CГадаад&order=id.desc&limit=200'))).status,200);
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
 const c=await register();const body={ref_code:'234567',film_id:1,plan:'single'};
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
 assert.deepEqual(tables.site_appearance,[{id:1,layout:4,tone:77,revision:1}]);
});
test('appearance rejects unbounded or executable input without changing settings',async()=>{
 const cookie=await admin(),base={layout:1,tone:25,revision:0};
 const invalid=[null,[],{}, {...base,layout:0},{...base,layout:5},{...base,layout:'2'}, {...base,tone:-1},{...base,tone:101},{...base,tone:1.5},{...base,tone:'50'}, {...base,revision:-1},{...base,revision:0.1},{...base,css:'url(https://evil.test)'},{...base,id:2}];
 for(const value of invalid)assert.equal((await appearance.PUT(req('/api/appearance','PUT',value,cookie))).status,400);
 assert.deepEqual(tables.site_appearance,[{id:1,...base}]);
 tables.site_appearance=[];
 assert.equal((await appearance.GET()).status,503);
});
