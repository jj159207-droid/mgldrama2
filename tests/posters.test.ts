import {test,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {NextRequest} from 'next/server';
import {optimizePoster,storePoster,MAX_POSTER_OUTPUT} from '../lib/posters';
import {bodyBytes,setSessionCookie,json} from '../lib/server';
import * as posters from '../app/api/posters/route';
import * as readiness from '../app/api/readiness/route';
import * as health from '../app/api/health/route';
process.env.SUPABASE_URL='https://posters.test.invalid';process.env.SUPABASE_SECRET_KEY='sb_secret_fake_server_test_key';
const originalFetch=global.fetch;let admin=true,uploads=0;
const fixture=()=>sharp({create:{width:480,height:720,channels:3,background:'#af9832'}}).jpeg().toBuffer();
beforeEach(()=>{admin=true;uploads=0;delete process.env.SITE_URL;global.fetch=async(input,init)=>{
 const u=new URL(String(input));assert.equal(u.origin,'https://posters.test.invalid');
 if(u.pathname==='/rest/v1/app_sessions')return Response.json([{user_id:admin?null:1,is_admin:admin}]);
 if(u.pathname.includes('/storage/v1/object/public/')){assert.equal(init?.method,'HEAD');return new Response(null,{status:200});}
 if(u.pathname.startsWith('/storage/v1/object/kino-posters/')){
  uploads++;const h=new Headers(init?.headers);assert.equal(h.get('apikey'),process.env.SUPABASE_SECRET_KEY);assert.equal(h.get('Authorization'),null);assert.equal(h.get('content-type'),'image/webp');assert.equal(h.get('x-upsert'),'false');
  assert.equal(h.get('cache-control'),'max-age=31536000');return Response.json({Key:u.pathname});
 }
 throw new Error('Unexpected test request');
};});
after(()=>{global.fetch=originalFetch;});
const request=(body:Uint8Array,extra:Record<string,string>={})=>new NextRequest('https://app.test/api/posters',{method:'POST',headers:{'Content-Type':'image/jpeg',cookie:`kino_session_v2=${'a'.repeat(64)}`,...extra},body:new Uint8Array(body)});

test('real image processing produces a stripped 600x900 WebP below 200 KB',async()=>{
 const output=await optimizePoster(await fixture());const meta=await sharp(output).metadata();
 assert.equal(meta.format,'webp');assert.equal(meta.width,600);assert.equal(meta.height,900);assert.equal(meta.exif,undefined);assert.ok(output.length<=MAX_POSTER_OUTPUT);
});
test('SVG, disguised non-images and oversized files are rejected',async()=>{
 await assert.rejects(optimizePoster(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>')));
 await assert.rejects(optimizePoster(Buffer.from('not an image')));
 await assert.rejects(optimizePoster(Buffer.alloc(4000001)));
 assert.equal((await posters.POST(request(new Uint8Array([1]),{'Content-Type':'image/svg+xml'}))).status,415);
});
test('only a same-origin admin can upload; a regular account is blocked before storage',async()=>{
 const input=await fixture();admin=false;assert.equal((await posters.POST(request(input))).status,403);assert.equal(uploads,0);
 admin=true;assert.equal((await posters.POST(request(input,{origin:'https://evil.test'}))).status,403);assert.equal(uploads,0);
 const r=await posters.POST(request(input));assert.equal(r.status,200);assert.equal(uploads,1);const result=await r.json();assert.match(result.url,/\/object\/public\/kino-posters\/v1\/[a-f0-9]{64}\.webp$/);assert.equal(JSON.stringify(result).includes('sb_secret'),false);
});
test('a lost upload response can be retried without duplicate objects or overwritten images',async()=>{
 const input=await fixture();const first=await storePoster(input);const mock=global.fetch;
 global.fetch=async(path,init)=>init?.method==='POST'?Response.json({error:'Duplicate',statusCode:'409'},{status:400}):mock(path,init);
 const retry=await storePoster(input);assert.deepEqual(retry,first);
 const changed=await storePoster(await sharp({create:{width:20,height:30,channels:3,background:'#444444'}}).png().toBuffer());assert.notEqual(changed.path,first.path);
});
test('storage failure or a non-public bucket never reports successful upload',async()=>{
 const input=await fixture();const mock=global.fetch;
 global.fetch=async(path,init)=>String(path).includes('/storage/')?Response.json({error:'failure'},{status:503}):mock(path,init);
 assert.equal((await posters.POST(request(input))).status,502);
 global.fetch=async(path,init)=>init?.method==='HEAD'?new Response(null,{status:403}):mock(path,init);
 const r=await posters.POST(request(input));assert.equal(r.status,502);assert.equal((await r.json()).code,'STORAGE_NOT_PUBLIC');
});
test('chunked request bodies are stopped at the byte cap without content-length',async()=>{
 let cancelled=false;const stream=new ReadableStream<Uint8Array>({pull(c){c.enqueue(new Uint8Array(8000));},cancel(){cancelled=true;}});
 const req=new NextRequest('https://app.test',{method:'POST',body:stream,duplex:'half'} as ConstructorParameters<typeof NextRequest>[1]);
 await assert.rejects(bodyBytes(req,10000),e=>e instanceof Error&&'status' in e&&e.status===413);assert.equal(cancelled,true);
});
test('production session cookie is secure and health discloses only liveness/version',async()=>{
 const old=process.env.NODE_ENV;Object.assign(process.env,{NODE_ENV:'production'});
 try{const cookie=setSessionCookie(json({ok:true}),'a'.repeat(64),3600).headers.get('set-cookie')!;for(const flag of ['Secure','HttpOnly','SameSite=strict'])assert.match(cookie,new RegExp(flag,'i'));}
 finally{Object.assign(process.env,{NODE_ENV:old});if(old===undefined)Reflect.deleteProperty(process.env,'NODE_ENV');}
 const value=await (await health.GET()).json();assert.deepEqual(Object.keys(value).sort(),['ok','version']);assert.equal(value.version,'2026-09-12.1');
});
test('detailed readiness is admin-only',async()=>{
 admin=false;assert.equal((await readiness.GET(request(new Uint8Array([1])))).status,403);
});
