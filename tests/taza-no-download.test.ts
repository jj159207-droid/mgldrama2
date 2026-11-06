import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,existsSync} from 'node:fs';

test('TAZA has online movie player only, without movie download buttons',()=>{
  const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
  assert.ok(page.includes('function VideoPage('),'keep movie player');
  assert.ok(page.includes('getVideoEmbed(mainUrl)'),'keep online playback');
  assert.ok(page.includes('Татсан кино')===false,'remove saved-movies entry');
  assert.ok(page.includes('OfflineDownloadButton')===false,'remove player download actions');
  assert.ok(page.includes('offlineEnabled')===false,'remove offline feature toggles');
  assert.ok(page.includes('TAZA_3_PLAN')&&page.includes('TAZA_6_PLAN')&&page.includes('TAZA_ALL_PLAN'),'paid 3/6/all bundles remain');
  const layout=readFileSync(new URL('../app/layout.tsx',import.meta.url),'utf8');
  assert.ok(!layout.includes('./offline.css'));
});

test('download routes and offline fallback are retired',()=>{
  const paths=[
    '../app/api/direct-download/route.ts',
    '../app/components/OfflineDownloadButton.tsx',
    '../public/offline.html',
    '../lib/offline-video.ts',
    '../lib/direct-video-file.ts'
  ];
  for(const path of paths)assert.equal(existsSync(new URL(path,import.meta.url)),false,path);
  const worker=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
  assert.ok(!worker.includes('offline.html'));
  assert.ok(!worker.includes("event.request.mode === 'navigate'"));
  assert.ok(worker.includes('push'),'keep push notifications');
});
