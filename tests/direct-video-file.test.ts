import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {directMovieFileName,isDirectMp4Response} from '../lib/direct-video-file';

test('direct file names are safe and keep Mongolian names',()=>{
  assert.equal(directMovieFileName('Миний кино: 1/2 <тусгай>?'), 'Миний кино 1 2 тусгай - TAZA SITE.mp4');
  assert.equal(directMovieFileName(''), 'Кино - TAZA SITE.mp4');
  assert.equal(directMovieFileName('CON'), 'Кино CON - TAZA SITE.mp4');
  assert.ok(directMovieFileName('a'.repeat(200)).length<115);
  assert.ok(!/[<>:"/\\|?*]/.test(directMovieFileName('abc | <>')));
});

test('only readable MP4 response types are saved',()=>{
  assert.equal(isDirectMp4Response(new Response('x',{headers:{'content-type':'video/mp4'}})),true);
  assert.equal(isDirectMp4Response(new Response('x',{headers:{'content-type':'video/mp4; charset=binary'}})),true);
  assert.equal(isDirectMp4Response(new Response('x',{headers:{'content-type':'application/octet-stream'}})),true);
  assert.equal(isDirectMp4Response(new Response('<html/>',{headers:{'content-type':'text/html'}})),false);
  assert.equal(isDirectMp4Response(new Response('not found',{status:404,headers:{'content-type':'video/mp4'}})),false);
});

test('direct MP4 saving asks for a file in the click handler before awaiting network',()=>{
  const source=readFileSync(new URL('../app/components/OfflineDownloadButton.tsx',import.meta.url),'utf8');
  const handler=source.split('const saveDirectFile=async()=>{')[1]?.split('  return <div className=')[0]||'';
  assert.ok(handler.includes('handlePromise=picker('));
  assert.ok(handler.indexOf('handlePromise=picker(')<handler.indexOf('await handlePromise'));
  assert.ok(handler.indexOf('handlePromise=picker(')<handler.indexOf("fetch(`/api/playback?id="));
  assert.match(handler,/pipeTo\(writable\)/);
  assert.match(handler,/isDirectMp4Response/);
  assert.match(handler,/credentials:'same-origin'/);
  assert.match(handler,/MP4 файл татах/);
  assert.ok(!handler.includes("window.location.href=url"));
});
