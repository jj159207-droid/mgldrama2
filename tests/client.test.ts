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
