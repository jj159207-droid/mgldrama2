import assert from 'node:assert/strict';
import {test} from 'node:test';
import {auditCatalogMedia} from '../lib/media-audit';

test('catalog audit counts full movies, inline trailers and missing assets without leaking sources',()=>{
 const secret='https://player.mediadelivery.net/embed/123/abc';
 const films=[
  {id:1,title:'Movie A',url:secret+'|||https://trailer.example/a.mp4',img:'https://poster.example/a.png',description:'A movie'},
  {id:2,title:'Movie B',url:'|||https://trailer.example/b.mp4',img:'',description:''},
  {id:3,title:'Movie C',url:'javascript:alert(1)',preview_url:'bad-url',img:'bad-url',description:' '}
 ];
 const result=auditCatalogMedia(films);
 assert.equal(result.total,3);
 assert.equal(result.playableSourceCount,1);
 assert.equal(result.bunnySourceCount,1);
 assert.equal(result.missingFull.count,2);
 assert.deepEqual(result.missingFull.sample.map(v=>v.id),[2,3]);
 assert.equal(result.missingTrailer.count,1);
 assert.equal(result.missingTrailer.sample[0].id,3);
 assert.equal(result.missingPoster.count,2);
 assert.equal(result.missingDescription.count,2);
 assert.equal(result.truncated,false);
 assert.ok(!JSON.stringify(result).includes(secret),'Never expose paid movie URL in readiness output');
});

test('catalog audit reports a conservative truncation flag and caps issue samples',()=>{
 const rows=Array.from({length:45},(_,i)=>({id:i+1,title:`Movie ${i+1}`,url:'',img:'',description:''}));
 const result=auditCatalogMedia(rows,true);
 assert.equal(result.total,45);
 assert.equal(result.missingFull.count,45);
 assert.equal(result.missingFull.sample.length,20);
 assert.equal(result.missingFull.sample[19].id,20);
 assert.equal(result.truncated,true);
});
