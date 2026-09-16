import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import ffmpeg from 'ffmpeg-static';
import { formatTrailerTime, generatedTrailerStart, parseTimeParts, validTrailerStart } from '../lib/trailer-spec';
import { createBunnyClip, encodeLocalClip, ffmpegArguments, mediaUrl, mp4Duration, parseBunnySource, parsePlaylist, selectSegments, variantUri } from '../lib/trailer-media';
const id='12345678-1234-1234-1234-123456789abc';
const base=new URL(`https://test.b-cdn.net/${id}/playlist.m3u8`);
const playlist='#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:8\n'+Array.from({length:5},(_,i)=>`#EXTINF:6,\nsegment${i}.ts`).join('\n')+'\n#EXT-X-ENDLIST\n';
test('trailer HH MM SS accepts zero and computes the exact twelve-second range',()=>{
 assert.equal(parseTimeParts('00','15','30'),930);assert.equal(formatTrailerTime(942),'00:15:42');
 assert.equal(parseTimeParts('0','0','0'),0);assert.equal(parseTimeParts('01','59','59'),7199);
 for(const parts of [['','0','0'],['0','60','0'],['0','0','60'],['-1','0','0'],['0','1.2','0'],['100','0','0']])assert.equal(parseTimeParts(...parts as [string,string,string]),null);
 for(const invalid of [-1,NaN,Infinity,0.5,'12',360000,null])assert.equal(validTrailerStart(invalid),false);
});
test('only generated short MP4 metadata restores an editor timestamp',()=>{
 const url=`https://test.supabase.co/storage/v1/object/public/kino-trailers/v1/${'a'.repeat(64)}.mp4#taza-trailer=1&start=930`;
 assert.equal(generatedTrailerStart(url),930);assert.equal(generatedTrailerStart(url.replace('930','-1')),null);
 assert.equal(generatedTrailerStart('https://test.b-cdn.net/full.mp4#taza-trailer=1&start=930'),null);
});
test('only Bunny embed IDs or canonical stream CDN inputs are accepted',()=>{
 assert.equal(parseBunnySource(`https://iframe.mediadelivery.net/embed/123/${id}?autoplay=true`).videoId,id);
 assert.equal(parseBunnySource(`https://test.b-cdn.net/${id}/play_720p.mp4`).videoId,id);
 for(const url of ['http://127.0.0.1/a','https://test.b-cdn.net.evil.test/a',`https://user:pass@test.b-cdn.net/${id}/playlist.m3u8`,`https://test.b-cdn.net:8443/${id}/playlist.m3u8`,'https://example.com/full.mp4'])assert.throws(()=>parseBunnySource(url));
});
test('CDN URI validation blocks local files, redirects to other hosts and encoded path traversal',()=>{
 for(const uri of ['file:///etc/passwd','http://localhost/a','https://example.com/a','../../../private.ts','/%2e%2e/private.ts','\\evil.test\\a'])assert.throws(()=>mediaUrl(uri,base,id));
 assert.equal(mediaUrl('segment0.ts',base,id).href,`https://test.b-cdn.net/${id}/segment0.ts`);
 assert.match(mediaUrl('segment0.ts',new URL(base+'?token=abc'),id).href,/token=abc/);
});
test('HLS selection downloads only the span needed and rejects a short ending',()=>{
 const parsed=parsePlaylist(playlist);assert.equal(parsed.segments[0].sequence,8);
 assert.deepEqual(selectSegments(parsed,6).map(s=>s.uri),['segment1.ts','segment2.ts']);
 assert.deepEqual(selectSegments(parsed,7).map(s=>s.uri),['segment1.ts','segment2.ts','segment3.ts']);
 assert.throws(()=>selectSegments(parsed,19),/12 секунд/);
 assert.throws(()=>parsePlaylist(playlist.replace('#EXT-X-ENDLIST','')),/HLS/);
 assert.throws(()=>parsePlaylist(playlist.replace('#EXTM3U','#EXTM3U\n#EXT-X-KEY:METHOD=SAMPLE-AES,URI="key"')),/DRM/);
 assert.throws(()=>parsePlaylist(playlist.replace('#EXTM3U','#EXTM3U\n#EXT-X-BYTERANGE:123@0')),/формат/);
});
test('variant selection favors 360p and never silently drops a separate audio track',()=>{
 assert.equal(variantUri('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720\n720.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=600000,RESOLUTION=640x360\n360.m3u8'),'360.m3u8');
 assert.throws(()=>variantUri('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2000000,AUDIO="audio"\nvideo.m3u8'),/дуу/);
});
test('FFmpeg cannot access network protocols; output is bounded to twelve seconds',()=>{
 const args=ffmpegArguments('/tmp/clip.m3u8','/tmp/out.mp4',1);assert.equal(args[args.indexOf('-protocol_whitelist')+1],'file');assert.equal(args[args.indexOf('-t')+1],'12');
 assert.ok(args.includes('0:a:0?'));assert.ok(Number.isNaN(mp4Duration(Buffer.alloc(32))));
});
test('real FFmpeg creates a twelve-second audio/video MP4 from only the selected HLS segments',async()=>{
 assert.ok(ffmpeg);const dir=await mkdtemp(join(tmpdir(),'kino-test-'));const originalFetch=global.fetch;
 try {
  execFileSync(ffmpeg,['-v','error','-f','lavfi','-i','testsrc2=duration=36:size=160x90:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=44100:duration=36','-c:v','libx264','-preset','ultrafast','-g','60','-sc_threshold','0','-c:a','aac','-b:a','64k','-hls_time','6','-hls_list_size','0','-hls_segment_filename',join(dir,'segment%d.ts'),join(dir,'playlist.m3u8')],{timeout:30000});
  const requests:string[]=[];
  global.fetch=async(input)=>{const url=new URL(String(input));assert.equal(url.origin,base.origin);requests.push(url.pathname.split('/').pop()!);return new Response(new Uint8Array(await readFile(join(dir,url.pathname.split('/').pop()!))));};
  const result=await createBunnyClip(parseBunnySource(base.href),13,ffmpeg);
  assert.equal(mp4Duration(result),12);assert.ok(result.length<4_000_000);
  assert.deepEqual(requests,['playlist.m3u8','segment2.ts','segment3.ts','segment4.ts']);
  const reference=await encodeLocalClip(ffmpeg,join(dir,'playlist.m3u8'),join(dir,'reference.mp4'),13);
  assert.equal(mp4Duration(reference),12);
 } finally {global.fetch=originalFetch;await rm(dir,{recursive:true,force:true});}
});
