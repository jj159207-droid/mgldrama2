import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';

// Exercise the actual Next.js config rather than checking a copied list.
const require=createRequire(import.meta.url);
const makeConfig=require('../next.config.js') as () => Promise<{
  headers:()=>Promise<Array<{source:string;headers:Array<{key:string;value:string}>}>>
}>;

test('production browser security headers protect every route without blocking video frames',async()=>{
 const config=await makeConfig();
 const routes=await config.headers();
 const all=routes.find(item=>item.source==='/:path*');
 assert.ok(all);
 const headers=new Map(all.headers.map(item=>[item.key,item.value]));
 assert.equal(headers.get('X-Content-Type-Options'),'nosniff');
 assert.equal(headers.get('X-Frame-Options'),'DENY');
 assert.equal(headers.get('Cross-Origin-Opener-Policy'),'same-origin');
 assert.equal(headers.get('X-Permitted-Cross-Domain-Policies'),'none');
 assert.equal(headers.get('X-DNS-Prefetch-Control'),'off');
 const csp=headers.get('Content-Security-Policy')||'';
 for(const rule of ["base-uri 'self'","object-src 'none'","frame-ancestors 'none'","form-action 'self'","upgrade-insecure-requests"]){
   assert.ok(csp.includes(rule),`Missing CSP rule: ${rule}`);
 }
 // Do not forbid third-party iframe video providers until production playback
 // has been fully tested across iOS Safari and Android Chrome.
 assert.equal(csp.includes('frame-src'),false);
 assert.ok(routes.some(item=>item.source==='/sw.js'));
});
