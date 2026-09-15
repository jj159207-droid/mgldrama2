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
let root,failed,filmRequests;
const originalFetch=global.fetch;
beforeEach(()=>{
 failed=false;filmRequests=0;window.history.replaceState({page:"home"},"", "/");
 Object.defineProperty(dom.window.navigator,'onLine',{value:true,configurable:true});
 root=createRoot(document.getElementById('root'));
 global.fetch=async(path,opts={})=>{
  if(opts.signal?.aborted)throw new DOMException('Cancelled','AbortError');
  const url=new URL(path,'https://app.test');assert.equal(url.origin,'https://app.test');
  if(url.pathname==='/api/auth')return Response.json({});
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
const fill=async(value)=>act(async()=>{const el=document.querySelector('input[type=search]');Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
const select=async(selector,value)=>act(async()=>{const el=document.querySelector(selector);el.value=value;el.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
const cardCount=()=>document.querySelectorAll('.movie-card').length;
test('catalog pagination, category filtering and results count work together',async()=>{
 await render();assert.equal(cardCount(),24);assert.match(document.querySelector('.catalog-results-bar').textContent,/30 кино/);
 await click('.load-more');assert.equal(cardCount(),30);
 await act(async()=>[...document.querySelectorAll('.category-tabs button')].find(b=>b.textContent==='Гадаад').click());
 assert.equal(cardCount(),10);assert.equal(document.querySelector('.load-more'),null);
});
test('search tolerates case and punctuation; empty filters reset in one click',async()=>{
 await render();await fill('ГЭРЭЛ  2');assert.equal(cardCount(),1);
 await act(async()=>[...document.querySelectorAll('.category-tabs button')].find(b=>b.textContent==='Гадаад').click());
 assert.equal(cardCount(),0);assert.match(document.querySelector('.empty-state').textContent,/Тохирох кино олдсонгүй/);
 await click('.catalog-reset');assert.equal(cardCount(),24);assert.equal(document.querySelector('input[type=search]').value,'');
});
test('free and available filters never show locked paid cards',async()=>{
 await render();await select('.catalog-access select','free');assert.equal(cardCount(),11);
 await select('.catalog-access select','available');assert.equal(cardCount(),11);
 assert.ok([...document.querySelectorAll('.movie-price')].every(el=>el.textContent.includes('Үнэгүй')));
});
test('search and selections survive screen navigation and a movie round trip',async()=>{
 await render();await fill('гэрэл');await select('.catalog-select select','title');
 await click('[aria-label="Кино хайх"]');assert.equal(document.querySelector('input[type=search]').value,'гэрэл');assert.equal(cardCount(),1);
 await click('.movie-main');assert.ok(document.querySelector('.film-landing'));assert.equal(document.querySelector('video'),null);
 await click('.film-back');
 assert.equal(document.querySelector('input[type=search]').value,'гэрэл');assert.equal(document.querySelector('.catalog-select select').value,'title');assert.equal(cardCount(),1);
});
test('an unavailable catalog stays an error on search, without empty success or duplicate alerts',async()=>{
 failed=true;await render();assert.ok(document.querySelector('.catalog-error'));assert.equal(document.querySelector('.app-alert'),null);
 await click('[aria-label="Кино хайх"]');assert.ok(document.querySelector('.catalog-error'));assert.equal(document.querySelector('.empty-state'),null);assert.doesNotMatch(document.body.textContent,/SQL|SETUP/);
 failed=false;await click('.catalog-error button');assert.equal(cardCount(),24);assert.equal(document.querySelector('.catalog-error'),null);
});
test('reconnection retries only a failed catalog and clears the offline notice',async()=>{
 failed=true;await render();const previous=filmRequests;
 await act(async()=>{Object.defineProperty(navigator,'onLine',{value:false,configurable:true});window.dispatchEvent(new dom.window.Event('offline'));});
 assert.ok(document.querySelector('.connection-status'));
 failed=false;await act(async()=>{Object.defineProperty(navigator,'onLine',{value:true,configurable:true});window.dispatchEvent(new dom.window.Event('online'));});
 assert.equal(filmRequests,previous+2);assert.equal(cardCount(),24);assert.equal(document.querySelector('.connection-status'),null);
 const complete=filmRequests;await act(async()=>window.dispatchEvent(new dom.window.Event('online')));assert.equal(filmRequests,complete);
});
