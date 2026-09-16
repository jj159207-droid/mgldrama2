import assert from 'node:assert/strict';
const origin='https://kino-uzeh.vercel.app';
const opts={redirect:'error',cache:'no-store'};
const get=(path,init={})=>fetch(origin+path,{...opts,...init,signal:AbortSignal.timeout(15000)});
const auth=await get('/api/auth');
assert.equal(auth.status,200,'auth status');
const authBody=await auth.json();
assert.equal(authBody.user??null,null,'anonymous probe must have no user session');
const catalog=await get('/api/db?path='+encodeURIComponent('films?select=id,title,free,locked&limit=10'));
assert.equal(catalog.status,200,'catalog status');
const films=await catalog.json();
assert.ok(Array.isArray(films)&&films.length>0,'need at least one film');
const results=[];
for(const film of films.slice(0,10)){
  const r=await get('/api/playback?id='+encodeURIComponent(film.id));
  results.push({id:film.id,title:film.title,free:film.free,locked:film.locked,status:r.status});
  assert.equal(r.status,403,`anonymous full playback must be forbidden for film ${film.id}`);
}
console.log(JSON.stringify({origin,anonymousUser:authBody.user??null,results},null,2));
