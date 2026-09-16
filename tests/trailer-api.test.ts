import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/trailers/route';
process.env.SUPABASE_URL='https://trailertest.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='fake.service.jwt';
const originalFetch=global.fetch;
afterEach(()=>{global.fetch=originalFetch;});
const sourceUrl='https://iframe.mediadelivery.net/embed/123/12345678-1234-1234-1234-123456789abc';
const req=(body:unknown,admin=true,origin='https://app.test')=>new NextRequest('https://app.test/api/trailers',{method:'POST',headers:{'Content-Type':'application/json',origin,...(admin?{cookie:`kino_session_v2=${'a'.repeat(64)}`}:{})},body:JSON.stringify(body)});
function fixtures(){
 const calls:string[]=[];
 global.fetch=async(input,init)=>{
  const url=new URL(String(input));calls.push(url.href);assert.equal(url.origin,'https://trailertest.invalid','must never fetch a real account in tests');
  if(url.pathname==='/rest/v1/app_sessions')return Response.json([{user_id:null,is_admin:true}]);
  if(url.pathname==='/rest/v1/films')return Response.json(url.searchParams.get('id')==='eq.7'?[{id:7}]:[]);
  if(url.pathname.startsWith('/storage/v1/object/public/kino-trailers/')){assert.equal(init?.method,'HEAD');return new Response(null,{status:200});}
  throw new Error('Unexpected request');
 };return calls;
}
test('anonymous callers and foreign origins cannot generate or discover trailers',async()=>{
 const calls=fixtures();assert.equal((await POST(req({filmId:7,sourceUrl,startSeconds:930},false))).status,403);
 assert.equal((await POST(req({filmId:7,sourceUrl,startSeconds:930},true,'https://evil.test'))).status,403);assert.deepEqual(calls,[]);
});
test('trailer endpoint rejects invalid IDs, timestamps and arbitrary source hosts',async()=>{
 fixtures();for(const startSeconds of [-1,'930',12.5,null,360000])assert.equal((await POST(req({filmId:7,sourceUrl,startSeconds}))).status,400);
 assert.equal((await POST(req({filmId:7,sourceUrl:'https://localhost/private',startSeconds:0}))).status,422);
 assert.equal((await POST(req({filmId:99,sourceUrl,startSeconds:0}))).status,404);
});
test('cached twelve-second preview is reusable; neither full URL nor credentials are returned',async()=>{
 const calls=fixtures();const response=await POST(req({filmId:7,sourceUrl,startSeconds:930}));assert.equal(response.status,200);
 const data=await response.json();assert.equal(data.startSeconds,930);assert.equal(data.durationSeconds,12);assert.match(data.previewUrl,/kino-trailers\/v1\/[a-f0-9]{64}\.mp4#taza-trailer=1&start=930$/);
 assert.ok(!JSON.stringify(data).includes(sourceUrl));assert.ok(!JSON.stringify(data).includes('fake.service.jwt'));assert.equal(calls.length,3);
});
