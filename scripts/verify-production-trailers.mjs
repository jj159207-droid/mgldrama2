// Read-only production probes. No user credentials, account changes or movie writes.
import assert from 'node:assert/strict';
const origin='https://kino-uzeh.vercel.app';
const options={redirect:'error',cache:'no-store'};
const get=(path,init={})=>fetch(origin+path,{...options,...init,signal:AbortSignal.timeout(15000)});
const probe=process.argv.includes('--probe');
for(let attempt=0;attempt<(probe?1:30);attempt++){
 try{
  const health=await get('/api/health');assert.equal(health.status,200,'production health');
  const route=await get('/api/trailers');
  if(probe){console.log(JSON.stringify({origin,health:health.status,trailerRoute:route.status}));break;}
  assert.equal(route.status,405,'the new trailer route must be deployed');
  const anonymous=await get('/api/trailers',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  assert.equal(anonymous.status,403,'anonymous users must not generate paid movie previews');
  const body=await anonymous.json();assert.match(body.message,/Админы эрх/);
  const appearance=await get('/api/appearance');assert.equal(appearance.status,200,'previous appearance feature must remain operational');
  const catalog=await get('/api/db?path='+encodeURIComponent('films?select=*&limit=2'));
  assert.equal(catalog.status,200,'catalog must stay readable');const rows=await catalog.json();assert.ok(Array.isArray(rows));
  for(const film of rows)assert.ok(!film.url||film.url.startsWith('|||'),'public catalog must not expose full movies');
  const home=await get('/');assert.equal(home.status,200,'home must load');assert.match(await home.text(),/ТАЗА САЙТ/);
  console.log(JSON.stringify({origin,health:200,trailerRoute:405,anonymousGeneration:403,appearance:200,catalog:200,home:200,paidSourcesHidden:true}));
  break;
 }catch(error){if(attempt===(probe?0:29))throw error;await new Promise(resolve=>setTimeout(resolve,10000));}
}
