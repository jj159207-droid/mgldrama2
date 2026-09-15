import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {requestJson,RequestError} from '../lib/client';
const original=global.fetch;
after(()=>{global.fetch=original;});
test('request helper preserves headers, server error status and cancellation',async()=>{
 global.fetch=async(_,opts)=>{
  assert.equal(new Headers(opts?.headers).get('X-Test'),'kept');
  return Response.json({message:'Access denied',code:'NO_ACCESS'},{status:403});
 };
 await assert.rejects(requestJson('/test',{headers:{'X-Test':'kept'}},true),e=>e instanceof RequestError&&e.status===403&&e.code==='NO_ACCESS');
 const abort=new AbortController();abort.abort();
 global.fetch=async(_,opts)=>{assert.equal(opts?.signal?.aborted,true);throw new DOMException('Cancelled','AbortError');};
 await assert.rejects(requestJson('/test',{signal:abort.signal},true),{name:'AbortError'});
 global.fetch=async()=>new Response(null,{status:204});assert.equal(await requestJson('/test'),null);
});

test('complete catalog reader traverses a small server cap and detects a non-advancing cursor',async()=>{
 const {dbAll}=await import('../lib/client');
 const rows=Array.from({length:7},(_,i)=>({id:7-i,title:'film'}));let calls=0;
 global.fetch=async path=>{calls++;const query=new URLSearchParams(new URL(String(path),'https://app.test').searchParams.get('path')!.split('?')[1]);assert.equal(query.get('order'),'id.desc');assert.match(query.get('select')!,/id/);const cursor=Number(query.get('id')!.slice(3));return Response.json(rows.filter(r=>r.id<cursor).slice(0,2));};
 assert.deepEqual((await dbAll('films?select=title')).map(r=>r.id),[7,6,5,4,3,2,1]);assert.equal(calls,5);
 global.fetch=async()=>Response.json([{id:1}]);await assert.rejects(dbAll('films'),/бүрэн ачаалж/);
});

test('HTML outages and database errors produce readable messages without setup instructions',async()=>{
 global.fetch=async()=>new Response('<html>Deployment disabled</html>',{status:402});
 await assert.rejects(requestJson('/api/db',{},true),e=>e instanceof RequestError&&e.status===402&&e.message.includes('түр боломжгүй'));
 global.fetch=async()=>Response.json({message:'SETUP-MN.md SQL configuration',code:'DB_FAILED'},{status:502});
 await assert.rejects(requestJson('/api/db',{},true),e=>e instanceof RequestError&&e.status===502&&e.code==='DB_FAILED'&&!/SQL|SETUP/.test(e.message));
 global.fetch=async()=>new Response('broken json',{status:200});
 await assert.rejects(requestJson('/api/db',{},true),e=>e instanceof RequestError&&e.status===502&&e.code==='INVALID_RESPONSE');
});

test('quiet catalog failures and explicit cancellation do not raise a duplicate global alert',async()=>{
 const {dbAll}=await import('../lib/client');
 const target = new EventTarget();let alerts=0;
 target.addEventListener('kinoError',()=>alerts++);
 const previousWindow = Object.getOwnPropertyDescriptor(globalThis,'window');
 Object.defineProperty(globalThis,'window',{value:target,configurable:true});
 try {
  global.fetch=async()=>Response.json({message:'unavailable'},{status:503});
  await assert.rejects(dbAll('films',{},true));assert.equal(alerts,0);
  const controller=new AbortController();controller.abort();
  global.fetch=async()=>{throw new DOMException('Cancelled','AbortError');};
  await assert.rejects(requestJson('/test',{signal:controller.signal}));assert.equal(alerts,0);
 } finally {
  if(previousWindow)Object.defineProperty(globalThis,'window',previousWindow);
  else Reflect.deleteProperty(globalThis,'window');
 }
});
