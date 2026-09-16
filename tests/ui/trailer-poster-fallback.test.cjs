const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const repo=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(repo,p),'utf8');

test('missing poster uses only the public trailer first frame on catalog and detail views',()=>{
  const frame=read('app/components/TrailerPosterFrame.tsx');
  const page=read('app/page.tsx');
  const landing=read('app/components/FilmLanding.tsx');
  assert.match(frame,/getVideoEmbed\(trailerUrl\(film\)\)/);
  assert.match(frame,/type !== "video"/);
  assert.match(frame,/#t=0\.1/);
  assert.match(frame,/IntersectionObserver/);
  assert.match(frame,/rootMargin: "220px"/);
  assert.match(frame,/visible && <video/);
  assert.match(page,/: <TrailerPosterFrame film=\{film\} \/>/);
  assert.match(landing,/<TrailerPosterFrame film=\{film\} className="detail-poster-video" \/>/);
  assert.doesNotMatch(frame,/film\.url\?\.split/);
});

test('uploaded image stays preferred and trailer frame remains decorative and lazy',()=>{
  const frame=read('app/components/TrailerPosterFrame.tsx');
  const page=read('app/page.tsx');
  assert.match(page,/film\.img && !failed[\s\S]*\? <img[\s\S]*: <TrailerPosterFrame/);
  assert.match(frame,/muted/);
  assert.match(frame,/playsInline/);
  assert.match(frame,/preload="metadata"/);
  assert.match(frame,/tabIndex=\{-1\}/);
  assert.match(frame,/aria-hidden="true"/);
});
