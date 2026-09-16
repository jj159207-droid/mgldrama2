// Exercise the actual movie edit panel, not a simplified look-alike.
const assert=require('node:assert/strict');
const {test,beforeEach,afterEach,after}=require('node:test');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="root"></div>',{url:'https://app.test',pretendToBeVisual:true});
Object.assign(global,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,CustomEvent:dom.window.CustomEvent,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});
const path=require('node:path'),fs=require('node:fs'),repo=path.resolve(__dirname,'../..');
const outfile=path.join(repo,'node_modules/.cache/trailer-save.cjs');
require('esbuild').buildSync({stdin:{contents:fs.readFileSync(path.join(repo,'app/page.tsx'),'utf8')+'\nexport {EditFilmPanel};',resolveDir:repo,loader:'tsx'},bundle:true,platform:'node',format:'cjs',jsx:'automatic',packages:'external',alias:{'@/app':path.join(repo,'app'),'@/lib':path.join(repo,'lib')},outfile});
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client'),{EditFilmPanel}=require(outfile);
const source='https://iframe.mediadelivery.net/embed/123/12345678-1234-1234-1234-123456789abc';
const clip=start=>`https://test.supabase.co/storage/v1/object/public/kino-trailers/v1/${'b'.repeat(64)}.mp4#taza-trailer=1&start=${start}`;
const originalFetch=global.fetch;
let root,film,done,alerts,requests,failGenerate,failSave,resolveGenerate;
beforeEach(()=>{
 root=createRoot(document.getElementById('root'));done=0;alerts=[];requests=[];failGenerate=false;failSave=false;resolveGenerate=null;
 film={id:7,title:'QA test',price:5000,op:6000,url:source,preview_url:'',description:'existing description',badge:'Хадмал|Гадаад',locked:true,free:false};
 global.alert=window.alert=message=>alerts.push(message);
 global.fetch=async(raw,init={})=>{
  const url=new URL(String(raw),'https://app.test');assert.equal(url.origin,'https://app.test');
  requests.push({path:url.pathname,body:JSON.parse(init.body||'{}')});
  if(url.pathname==='/api/trailers'){
   if(resolveGenerate)await new Promise(resolve=>{resolveGenerate=resolve;});
   if(failGenerate)return Response.json({message:'Generation failed safely'},{status:422});
   const {startSeconds}=JSON.parse(init.body);return Response.json({previewUrl:clip(startSeconds),durationSeconds:12,startSeconds});
  }
  if(url.pathname==='/api/db'){
   assert.equal(init.method,'PATCH');assert.equal(url.searchParams.get('path'),'films?id=eq.7');
   if(failSave)return Response.json({message:'Save failed safely'},{status:503});
   return Response.json([{...film,...JSON.parse(init.body)}]);
  }
  throw new Error('Unexpected request');
 };
});
afterEach(async()=>{await act(async()=>root.unmount());global.fetch=originalFetch;delete global.alert;});after(()=>dom.window.close());
const render=()=>act(async()=>root.render(React.createElement(EditFilmPanel,{f:film,onDone:()=>done++})));
const fill=(name,value)=>act(async()=>{const el=document.querySelector(`[aria-label="Трейлэр эхлэх ${name}"]`);Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
const save=()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Хадгалах'));
test('HH:MM:SS -> generate -> save persists only the chosen short preview and preserves full paid source',async()=>{
 await render();await fill('минут','15');await fill('секунд','30');await act(async()=>save().click());
 assert.deepEqual(requests.map(r=>r.path),['/api/trailers','/api/db']);assert.equal(requests[0].body.startSeconds,930);
 const payload=requests[1].body;assert.equal(payload.preview_url,clip(930));assert.equal(payload.url,source+'|||'+clip(930));
 assert.ok(!('free'in payload));assert.ok(!('locked'in payload));assert.equal(payload.description,film.description);assert.equal(done,1);assert.deepEqual(alerts,[]);
});
test('generation failure cannot save incomplete or replacement movie metadata',async()=>{
 await render();failGenerate=true;await act(async()=>save().click());assert.deepEqual(requests.map(r=>r.path),['/api/trailers']);assert.equal(done,0);assert.match(alerts[0],/Generation failed/);assert.equal(save().disabled,false);
});
test('save failure retains generated preview so a retry does not generate twice',async()=>{
 await render();failSave=true;await act(async()=>save().click());assert.equal(done,0);
 failSave=false;await act(async()=>save().click());assert.equal(done,1);assert.equal(requests.filter(r=>r.path==='/api/trailers').length,1);assert.equal(requests.filter(r=>r.path==='/api/db').length,2);
});
test('invalid time never generates, saves or closes the movie panel',async()=>{
 await render();await fill('секунд','60');await act(async()=>save().click());assert.deepEqual(requests,[]);assert.equal(done,0);assert.match(alerts[0],/0–59/);
});
test('existing stored timestamp restores and saves without generating a new clip',async()=>{
 film.preview_url=clip(930);film.url=source+'|||'+clip(930);await render();assert.match(document.body.textContent,/00:15:30 → 00:15:42/);
 await act(async()=>save().click());assert.deepEqual(requests.map(r=>r.path),['/api/db']);assert.equal(requests[0].body.preview_url,clip(930));assert.equal(done,1);
});
test('double save and navigation during generation cannot issue duplicate or stale writes',async()=>{
 await render();resolveGenerate=true;
 const button=save();await act(async()=>{button.click();button.click();});assert.equal(requests.length,1);assert.equal(document.querySelector('fieldset').disabled,true);
 await act(async()=>root.render(null));await act(async()=>resolveGenerate());assert.equal(requests.length,1);assert.equal(done,0);
});
