import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadTazaPublicCatalog} from '../lib/public-catalog';

test('home and carousel share one in-flight public catalog request',async()=>{
 const original=global.fetch;
 let calls=0;
 try {
   global.fetch=async(_url,_options)=>{calls++;await Promise.resolve();return Response.json([{id:1,title:'Test film',img:null}]);};
   const [a,b]=await Promise.all([loadTazaPublicCatalog(),loadTazaPublicCatalog()]);
   assert.equal(calls,1);
   assert.deepEqual(a,b);
   await loadTazaPublicCatalog();
   assert.equal(calls,2,'later visits revalidate and do not reuse stale film rights');
 } finally {global.fetch=original;}
});

test('public catalog response explicitly excludes private video and account data',()=>{
 const file=readFileSync(new URL('../app/api/public-catalog/route.ts',import.meta.url),'utf8');
 assert.match(file,/Cache-Control.*|s-maxage=60/);
 assert.ok(file.includes('site_id=eq.taza'));
 const select=file.match(/const FIELDS='([^']+)'/)?.[1]?.split(',')||[];
 for(const field of ['id','title','img','preview_url'])assert.ok(select.includes(field));
 for(const privateField of ['url','user_id','phone','pin','ref_code','signed_url','site_id','payments'])assert.ok(!select.includes(privateField),privateField);
});
