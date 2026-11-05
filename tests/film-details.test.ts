import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filmPlans, relatedFilms, trailerUrl, getVideoEmbed} from '../lib/film-details';

test('recommendations are the three most viewed other movies in the same category',()=>{
  const selected={id:1,badge:'Хэлтэй|Хятад',views:999};
  const films=[selected,{id:2,badge:'Хадмал|Хятад',views:20},{id:3,badge:'Хэлтэй|Гадаад',views:1000},
    {id:4,badge:'Хэлтэй|Хятад',views:40},{id:5,badge:'Хадмал|Хятад',views:40},
    {id:6,badge:'Хэлтэй|Хятад',views:10},{id:4,badge:'Хэлтэй|Хятад',views:40}];
  const before=structuredClone(films);
  assert.deepEqual(relatedFilms(films,selected).map(f=>f.id),[5,4,2]);
  assert.deepEqual(films,before);
  assert.deepEqual(relatedFilms([selected],selected),[]);
});

test('legacy category helper exposes the current bounded 72-hour plan',()=>{
  for(const [category,key] of [['Эротик','erotic'],['Хятад','hyatad'],['Гадаад','gadaad']]){
    assert.deepEqual(filmPlans({id:1,badge:`Хадмал|${category}`}),[
      {id:`${key}_3day`,hours:72,category,price:12500},
    ]);
  }
  assert.deepEqual(filmPlans({id:1,badge:'Хэлтэй|Unknown'}),[]);
});

test('a trailer must be explicit and safe, never the full movie URL',()=>{
  const full='https://video.example/private.mp4',preview='https://video.example/trailer.mp4';
  assert.equal(trailerUrl({url:full}),'');
  assert.equal(trailerUrl({url:`${full}|||${preview}`}),preview);
  assert.equal(trailerUrl({preview_url:preview,url:full}),preview);
  assert.equal(trailerUrl({preview_url:'javascript:alert(1)',url:full}),'');
  assert.equal(trailerUrl({preview_url:'http://video.example/trailer.mp4'}),'');
});

test('video embeds handle signed media and supported provider links without unsafe URLs',()=>{
  assert.deepEqual(getVideoEmbed('https://video.example/clip.MP4?token=test'),{type:'video',src:'https://video.example/clip.MP4?token=test'});
  assert.deepEqual(getVideoEmbed('https://youtu.be/abcdefghijk'),{type:'youtube',src:'https://www.youtube-nocookie.com/embed/abcdefghijk?playsinline=1'});
  assert.deepEqual(getVideoEmbed('https://drive.google.com/file/d/test-id/view'),{type:'iframe',src:'https://drive.google.com/file/d/test-id/preview'});
  assert.deepEqual(getVideoEmbed('javascript:alert(1)'),{type:'iframe',src:''});
  assert.equal(getVideoEmbed('https://youtube.com.evil.test/watch?v=abcdefghijk').type,'iframe');
});

test('Bunny direct-play pages are embedded with the matching library player and tokens preserved',()=>{
  const guid='7088fc08-ea3d-4126-840d-c47aa324b637';
  assert.deepEqual(
    getVideoEmbed(`https://player.mediadelivery.net/play/617966/${guid}?autoplay=true`),
    {type:'iframe',src:`https://player.mediadelivery.net/embed/617966/${guid}?autoplay=true`}
  );
  assert.deepEqual(
    getVideoEmbed(`https://iframe.mediadelivery.net/play/617966/${guid}`),
    {type:'iframe',src:`https://iframe.mediadelivery.net/embed/617966/${guid}`}
  );
  assert.deepEqual(
    getVideoEmbed(`https://vz-617966.b-cdn.net/${guid}/playlist.m3u8`),
    {type:'iframe',src:`https://player.mediadelivery.net/embed/617966/${guid}`}
  );
  assert.equal(
    getVideoEmbed(`https://vz-617966.b-cdn.net/${guid}/playlist.m3u8?token=private`).src,
    `https://vz-617966.b-cdn.net/${guid}/playlist.m3u8?token=private`,
    'Do not silently discard signed media token'
  );
});
