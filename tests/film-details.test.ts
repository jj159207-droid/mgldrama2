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

test('only the selected category packages are offered with 3 and 30 day prices',()=>{
  for(const [category,key] of [['Эротик','erotic'],['Хятад','hyatad'],['Гадаад','gadaad']]){
    assert.deepEqual(filmPlans({id:1,badge:`Хадмал|${category}`}),[
      {id:`${key}_3day`,days:3,category,price:8000},
      {id:`${key}_1month`,days:30,category,price:12500},
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
