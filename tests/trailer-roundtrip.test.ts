import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import ffmpeg from 'ffmpeg-static';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/trailers/route';
import { mp4Duration } from '../lib/trailer-media';

process.env.SUPABASE_URL='https://trailer-roundtrip.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY='test.key.only';
delete process.env.SITE_URL;
const videoId='12345678-1234-1234-1234-123456789abc';
const sourceUrl=`https://iframe.mediadelivery.net/embed/123/${videoId}`;
const request=()=>new NextRequest('https://app.test/api/trailers',{method:'POST',headers:{origin:'https://app.test','Content-Type':'application/json',cookie:`kino_session_v2=${'a'.repeat(64)}`},body:JSON.stringify({filmId:7,sourceUrl,startSeconds:13})});

test('real trailer generation, storage, visibility and retry form one safe roundtrip',async()=>{
 assert.ok(ffmpeg);
 const directory=await mkdtemp(join(tmpdir(),'kino-roundtrip-'));
 const originalFetch=global.fetch;
 const stored=new Map<string,Uint8Array>();
 let uploads=0,cdnReads=0,failUpload=true,failVisibility=false;
 try{
  execFileSync(ffmpeg,['-v','error','-f','lavfi','-i','testsrc2=duration=36:size=160x90:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=44100:duration=36','-c:v','libx264','-preset','ultrafast','-g','60','-sc_threshold','0','-c:a','aac','-b:a','64k','-hls_time','6','-hls_list_size','0','-hls_segment_filename',join(directory,'segment%d.ts'),join(directory,'playlist.m3u8')],{timeout:30000});
  global.fetch=async(input,init={})=>{
   const url=new URL(String(input));
   if(url.origin==='https://trailer-roundtrip.invalid'){
    if(url.pathname==='/rest/v1/app_sessions')return Response.json([{user_id:null,is_admin:true}]);
    if(url.pathname==='/rest/v1/films'){
     assert.equal(init.method,'GET','generating a preview must not update any movie or entitlement');
     return Response.json([{id:7}]);
    }
    const publicPrefix='/storage/v1/object/public/kino-trailers/';
    const uploadPrefix='/storage/v1/object/kino-trailers/';
    if(url.pathname.startsWith(publicPrefix)){
     assert.equal(init.method,'HEAD');
     return new Response(null,{status:stored.has(url.pathname.slice(publicPrefix.length))&&!failVisibility?200:404});
    }
    if(url.pathname.startsWith(uploadPrefix)){
     assert.equal(init.method,'POST');assert.equal((init.headers as Record<string,string>)['x-upsert'],'false');
     uploads++;
     if(failUpload)return Response.json({error:'StorageUnavailable'},{status:503});
     const bytes=init.body as Uint8Array;
     assert.ok(bytes instanceof Uint8Array);
     assert.ok(Math.abs(mp4Duration(Buffer.from(bytes))-12)<0.08);
     assert.ok(bytes.length<4_000_000);
     stored.set(url.pathname.slice(uploadPrefix.length),bytes);
     return Response.json({Key:'short-clip'});
    }
   }
   if(url.origin==='https://video.bunnycdn.com'){
    assert.equal(url.pathname,`/library/123/videos/${videoId}/play`);
    return Response.json({videoPlaylistUrl:`https://fixture.b-cdn.net/${videoId}/playlist.m3u8`,isPlayable:true});
   }
   if(url.origin==='https://fixture.b-cdn.net'){
    assert.ok(url.pathname.startsWith(`/${videoId}/`));cdnReads++;
    return new Response(new Uint8Array(await readFile(join(directory,url.pathname.split('/').pop()!))));
   }
   throw new Error(`Unexpected external request: ${url.origin}`);
  };
  const failed=await POST(request());assert.equal(failed.status,502);assert.equal(stored.size,0);
  failUpload=false;
  const success=await POST(request());assert.equal(success.status,200);
  const result=await success.json();assert.equal(result.durationSeconds,12);assert.equal(result.startSeconds,13);
  assert.ok(!JSON.stringify(result).includes(videoId),'private video identity must not reach a public trailer response');
  assert.equal(stored.size,1);assert.equal(uploads,2);
  const readsBefore=cdnReads;
  const retry=await POST(request());assert.equal(retry.status,200);assert.deepEqual(await retry.json(),result);
  assert.equal(cdnReads,readsBefore,'lost-response retries must reuse the stored clip');assert.equal(uploads,2);
  stored.clear();failVisibility=true;
  const invisible=await POST(request());assert.equal(invisible.status,502,'a non-public upload must not be reported as success');
  failVisibility=false;
  assert.equal((await POST(request())).status,200,'the busy lock must clear after visibility failure');
 }finally{global.fetch=originalFetch;await rm(directory,{recursive:true,force:true});}
});
