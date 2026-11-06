import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {offlineMp4Candidates,offlineExpiry,offlineMovieKey,offlineMetaKey,OFFLINE_MOVIE_CACHE} from '../lib/offline-video';

const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

test('Bunny player/embed URLs generate same-library MP4 fallback candidates',()=>{
  for(const path of ['embed','play']){
    const player=path==='embed'?'iframe.mediadelivery.net':'player.mediadelivery.net';
    const urls=offlineMp4Candidates(`https://${player}/${path}/668231/${id}`);
    assert.deepEqual(urls,[
      `https://vz-668231.b-cdn.net/${id}/play_480p.mp4`,
      `https://vz-668231.b-cdn.net/${id}/play_360p.mp4`,
      `https://vz-668231.b-cdn.net/${id}/play_720p.mp4`,
    ]);
  }
});

test('direct MP4 is usable, while unrelated, signed or unsafe URLs are rejected',()=>{
  assert.deepEqual(offlineMp4Candidates('https://videos.example/test.mp4'),['https://videos.example/test.mp4']);
  for(const input of [
    'http://videos.example/movie.mp4','javascript:alert(1)',
    'https://user:pass@example.com/movie.mp4',
    'https://iframe.mediadelivery.net/embed/668231/'+id+'?token=hidden',
    'https://example.com/embed/668231/'+id,
    'https://player.mediadelivery.net/embed/668231/wrong',
    'https://videos.example/file.m3u8',
    '',
  ]) assert.deepEqual(offlineMp4Candidates(input),[],input);
});

test('Bunny HLS manifests are only convertible on expected pull-zone hosts',()=>{
 const candidates=offlineMp4Candidates(`https://vz-123.b-cdn.net/${id}/playlist.m3u8`);
 assert.equal(candidates[0],`https://vz-123.b-cdn.net/${id}/play_480p.mp4`);
 assert.deepEqual(offlineMp4Candidates(`https://evil.example/${id}/playlist.m3u8`),[]);
});

test('cached offline access expires with actual server-issued right, not plan duration guessed on device',()=>{
 const now=Date.now(),id=42;
 assert.equal(offlineExpiry({monthly:now+50000},id),now+50000);
 assert.equal(offlineExpiry({film_42:now+70000},id),now+70000);
 assert.equal(offlineExpiry({cat_erotic:now+30000},id,'Хэлтэй|Эротик'),now+30000);
 assert.equal(offlineExpiry({film_42:now-10},id),0);
 assert.equal(offlineExpiry({},id),0);
});

test('offline library does not cache user API data and isolates movie copies',()=>{
 const sw=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
 const offline=readFileSync(new URL('../public/offline.html',import.meta.url),'utf8');
 assert.match(sw,/ASSETS = \[[^\]]*offline\.html/);
 assert.match(sw,/event\.request\.mode === 'navigate'/);
 assert.match(sw,/!ASSETS\.includes\(url\.pathname\)/);
 assert.ok(!sw.includes('addAll([\'/api/'));
 assert.ok(offline.includes('taza_age_21_session_v2'));
 assert.ok(offline.includes('Date.now()>=Number(meta.expiresAt)'));
 assert.ok(offline.includes('cache.match(key(\'movie\',meta.filmId))'));
 assert.equal(OFFLINE_MOVIE_CACHE,'taza-offline-movies-v1');
 assert.equal(offlineMovieKey(7),'/__taza_offline__/movie/7');
 assert.equal(offlineMetaKey(7),'/__taza_offline__/meta/7');
});
