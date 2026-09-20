// DOM behavior tests with same-origin API fixtures; no live accounts or video playback.
const assert = require('node:assert/strict');
const {test, beforeEach, afterEach, after} = require('node:test');
const {JSDOM} = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', {url:'https://app.test',pretendToBeVisual:true});
Object.assign(global,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,CustomEvent:dom.window.CustomEvent,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});
dom.window.scrollTo=()=>{};
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
const path=require('node:path');
const repo=path.resolve(__dirname,'../..');
const outfile=path.join(repo,'node_modules/.cache/catalog-bundle.cjs');
require('esbuild').buildSync({entryPoints:[path.join(repo,'app/page.tsx')],bundle:true,platform:'node',format:'cjs',jsx:'automatic',packages:'external',alias:{'@/app':path.join(repo,'app'),'@/lib':path.join(repo,'lib')},outfile});
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client');
const App=require(outfile).default;
const films=Array.from({length:30},(_,i)=>({id:i+1,title:i===1?'Гэрэл — 2':`Хотын түүх ${i+1}`,badge:`Хадмал|${['Гадаад','Хятад','Эротик'][i%3]}`,views:i*3,free:i%3===0||i===1,locked:true,price:5000,img:''}));
let root,failed,filmRequests,session,authWrites;
const originalFetch=global.fetch;
beforeEach(()=>{
 failed=false;filmRequests=0;session={};authWrites=[];window.history.replaceState({page:"home"},"", "/");
 Object.defineProperty(dom.window.navigator,'onLine',{value:true,configurable:true});
 root=createRoot(document.getElementById('root'));
 global.fetch=async(path,opts={})=>{
  if(opts.signal?.aborted)throw new DOMException('Cancelled','AbortError');
  const url=new URL(path,'https://app.test');assert.equal(url.origin,'https://app.test');
  if(url.pathname==='/api/auth'){
   if(opts.method==='POST'){
    const body=JSON.parse(opts.body);authWrites.push(body);
    if(body.action!=='admin'||body.password!=='test-existing-admin-password')return Response.json({message:'Нууц үг буруу байна.'},{status:401});
    session={admin:true};
   }
   return Response.json(session);
  }
  if(url.pathname==='/api/device'){
   if(!session.user)session={user:{id:12,phone:'',user_id:'GTESTCATALOG',guest:true}};
   return Response.json(session);
  }
  if(url.pathname==='/api/entry-access')return Response.json({allowed:true,reason:'paid'});
  if(url.pathname==='/api/access')return Response.json({access:{}});
  if(url.pathname==='/api/wallet')return Response.json({balance:6000});
  if(url.pathname==='/api/settings')return Response.json({});
  if(url.pathname==='/api/appearance')return Response.json({appearance:{layout:1,tone:25,revision:0}});
  if(url.pathname==='/api/chat')return Response.json({unread:0,threads:[]});
  if(url.pathname==='/api/db'){
   filmRequests++;
   if(failed)return Response.json({message:'SETUP-MN.md SQL',code:'DB_ERROR'},{status:502});
   const q=new URLSearchParams(url.searchParams.get('path').split('?')[1]);const filter=q.get('id');const id=Number(filter.slice(3));
   return Response.json(films.filter(f=>filter.startsWith('eq.')?f.id===id:f.id<id).sort((a,b)=>b.id-a.id));
  }
  if(url.pathname==='/api/playback')return Response.json({...films.find(f=>f.id===Number(url.searchParams.get('id'))),url:'https://example.test/movie.mp4'});
  throw new Error('Unexpected test request '+path);
 };
});
afterEach(async()=>{await act(async()=>root.unmount());global.fetch=originalFetch;});
after(()=>dom.window.close());
const render=()=>act(async()=>{root.render(React.createElement(App));});
const click=async(selector)=>{const el=document.querySelector(selector);assert.ok(el,selector);await act(async()=>el.click());};
const cardCount=()=>document.querySelectorAll('.movie-card').length;
const logo=()=>click('[aria-label="ТАЗА САЙТ лого"]');
test('the simplified catalog retains categories and pagination without search, sorting, access or count controls',async()=>{
 await render();assert.equal(cardCount(),24);
 assert.equal(document.querySelector('.catalog-controls'),null);assert.equal(document.querySelector('.catalog-results-bar'),null);assert.equal(document.querySelector('[aria-label="Кино хайх"]'),null);
 assert.match(document.querySelector('.brand').textContent,/ТАЗА САЙТ/);assert.doesNotMatch(document.querySelector('.site-footer').textContent,/Удирдах/);
 await click('.load-more');assert.equal(cardCount(),30);
 await act(async()=>[...document.querySelectorAll('.category-tabs button')].find(b=>b.textContent==='Гадаад').click());
 assert.equal(cardCount(),10);assert.equal(document.querySelector('.load-more'),null);
});
test('category selection survives the movie round trip and Back opens the main page',async()=>{
 await render();await act(async()=>[...document.querySelectorAll('.category-tabs button')].find(b=>b.textContent==='Гадаад').click());
 await click('.movie-main');assert.ok(document.querySelector('.film-landing'));assert.equal(document.querySelector('video'),null);
 await click('.film-back');assert.ok(document.querySelector('.site-header'));assert.equal(window.location.search,'');assert.equal(cardCount(),10);
 assert.equal(document.querySelector('.category-tabs .active').textContent,'Гадаад');
});
test('an unavailable catalog remains retryable without exposing internal errors',async()=>{
 failed=true;await render();assert.ok(document.querySelector('.catalog-error'));assert.equal(document.querySelector('.app-alert'),null);assert.equal(document.querySelector('.empty-state'),null);assert.doesNotMatch(document.body.textContent,/SQL|SETUP/);
 failed=false;await click('.catalog-error button');assert.equal(cardCount(),24);assert.equal(document.querySelector('.catalog-error'),null);
});
test('five logo taps within eight seconds reveal sign-in, and the existing password flow still rejects a wrong code',async t=>{
 let now=0;t.mock.method(performance,'now',()=>now);
 await render();
 for(const time of [0,2000,4000,6000]){now=time;await logo();}
 assert.equal(document.querySelector('[aria-label="Админы нууц үг"]'),null);assert.equal(authWrites.length,0);
 now=8000;await logo();const field=document.querySelector('[aria-label="Админы нууц үг"]');assert.ok(field);assert.equal(document.querySelector('.admin-surface'),null);
 const enter=async value=>act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(field,value);field.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
 const submit=()=>act(async()=>field.closest('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
 await enter('wrong');await submit();assert.match(document.body.textContent,/Нууц үг буруу/);assert.equal(document.querySelector('.admin-surface'),null);
 await enter('test-existing-admin-password');await submit();assert.ok(document.querySelector('.admin-surface'));assert.deepEqual(authWrites.at(-1),{action:'admin',password:'test-existing-admin-password'});
});
test('expired taps and clicks on the name do not unlock the admin entry',async t=>{
 let now=0;t.mock.method(performance,'now',()=>now);await render();
 for(const time of [0,2000,4000,6000]){now=time;await logo();}
 now=8001;await logo();assert.equal(document.querySelector('[aria-label="Админы нууц үг"]'),null);
 await act(async()=>new Promise(resolve=>{window.addEventListener("hashchange",resolve,{once:true});document.querySelector('[aria-label="ТАЗА САЙТ нүүр"]').click();}));assert.equal(document.querySelector('[aria-label="Админы нууц үг"]'),null);
 now=8002;await logo();assert.ok(document.querySelector('[aria-label="Админы нууц үг"]'));
});
test('an existing admin session still starts on home and opens management after the hidden gesture',async()=>{
 session={admin:true};await render();assert.ok(document.querySelector('.site-header'));assert.equal(document.querySelector('.admin-surface'),null);
 for(let i=0;i<5;i++)await logo();assert.ok(document.querySelector('.admin-surface'));assert.equal(authWrites.length,0);
});
test('reconnection retries only a failed catalog and clears the offline notice',async()=>{
 failed=true;await render();const previous=filmRequests;
 await act(async()=>{Object.defineProperty(navigator,'onLine',{value:false,configurable:true});window.dispatchEvent(new dom.window.Event('offline'));});
 assert.ok(document.querySelector('.connection-status'));
 failed=false;await act(async()=>{Object.defineProperty(navigator,'onLine',{value:true,configurable:true});window.dispatchEvent(new dom.window.Event('online'));});
 assert.equal(filmRequests,previous+2);assert.equal(cardCount(),24);assert.equal(document.querySelector('.connection-status'),null);
 const complete=filmRequests;await act(async()=>window.dispatchEvent(new dom.window.Event('online')));assert.equal(filmRequests,complete);
});

test('admin appearance entry previews the real catalog in an inert full-screen dialog',async()=>{
 session={admin:true};await render();for(let i=0;i<5;i++)await logo();
 await act(async()=>[...document.querySelectorAll('.admin-tabs button')].find(b=>b.textContent.includes('Загвар өөрчлөх')).click());
 const dialog=document.querySelector('.appearance-editor');assert.ok(dialog.open);
 assert.equal(dialog.querySelectorAll('input[type="range"]').length,2);
 assert.ok(dialog.querySelector('.appearance-preview-content[inert]'));
 assert.equal(dialog.querySelectorAll('.movie-card').length,24);
 assert.match(dialog.querySelector('.brand').textContent,/ТАЗА САЙТ/);
 await click('[aria-label="Загвар 4: Постер"]');
 assert.equal(dialog.querySelector('.appearance-preview-content').dataset.layout,'4');
 assert.equal(document.querySelector('.app-shell').dataset.layout,'1');
 window.confirm=()=>true;await click('[aria-label="Удирдах хэсэг рүү буцах"]');
 assert.ok(document.querySelector('.admin-surface'));assert.equal(document.querySelector('.appearance-editor'),null);
});
