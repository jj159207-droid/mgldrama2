const assert=require('node:assert/strict');
const {test,beforeEach,afterEach,after}=require('node:test');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="root"></div>',{url:'https://app.test',pretendToBeVisual:true});
Object.assign(global,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});
const path=require('node:path'),repo=path.resolve(__dirname,'../..'),outfile=path.join(repo,'node_modules/.cache/trailers-ui.cjs');
require('esbuild').buildSync({entryPoints:[path.join(repo,'app/components/TrailerEditor.tsx')],bundle:true,platform:'node',format:'cjs',jsx:'automatic',packages:'external',alias:{'@/lib':path.join(repo,'lib')},outfile});
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client'),Editor=require(outfile).default;
const source='https://iframe.mediadelivery.net/embed/123/12345678-1234-1234-1234-123456789abc';
const clip=start=>`https://test.supabase.co/storage/v1/object/public/kino-trailers/v1/${'a'.repeat(64)}.mp4#taza-trailer=1&start=${start}`;
let root,ref,calls,current,props,failed,busy;
const originalFetch=global.fetch;
beforeEach(()=>{root=createRoot(document.getElementById('root'));ref=React.createRef();calls=[];current='';failed=false;busy=[];
 props={filmId:7,videoUrl:source,value:'',onChange:v=>{current=v;},onBusyChange:v=>busy.push(v)};
 global.fetch=async(url,opts)=>{assert.equal(url,'/api/trailers');assert.equal(opts.credentials,'same-origin');const body=JSON.parse(opts.body);calls.push(body);return failed?Response.json({message:'12 секунд хүрэлцэхгүй.'},{status:422}):Response.json({previewUrl:clip(body.startSeconds),startSeconds:body.startSeconds,durationSeconds:12});};
});
afterEach(async()=>{await act(async()=>root.unmount());global.fetch=originalFetch;});after(()=>dom.window.close());
const render=()=>act(async()=>root.render(React.createElement(Editor,{...props,ref})));
const fill=(name,value)=>act(async()=>{const el=document.querySelector(`[aria-label="Трейлэр эхлэх ${name}"]`);assert.ok(el);Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
test('saving generates the selected 12-second trailer once; the full movie is never rendered',async()=>{
 await render();await fill('цаг','00');await fill('минут','15');await fill('секунд','30');assert.match(document.body.textContent,/00:15:30 → 00:15:42/);
 let saved;await act(async()=>{saved=await ref.current.prepare();});assert.equal(saved,clip(930));assert.equal(current,saved);
 assert.deepEqual(calls,[{filmId:7,sourceUrl:source,startSeconds:930}]);assert.deepEqual(busy,[true,false]);assert.equal(document.querySelector('video').getAttribute('src'),saved);
 await act(async()=>{assert.equal(await ref.current.prepare(),saved);});assert.equal(calls.length,1);
 props={...props,videoUrl:source.replace('/123/','/456/')};await render();await act(async()=>ref.current.prepare());assert.equal(calls.length,2,'source change must not reuse an old generated preview');
});
test('invalid minutes and generation errors do not replace an existing preview',async()=>{
 props={...props,value:clip(0)};await render();await fill('минут','60');await act(async()=>assert.rejects(ref.current.prepare(),/0–59/));assert.equal(calls.length,0);assert.equal(current,'');
 await fill('минут','1');failed=true;await act(async()=>assert.rejects(ref.current.prepare(),/12 секунд/));assert.equal(current,'');assert.equal(document.querySelector('video').getAttribute('src'),clip(0));assert.match(document.querySelector('[role="alert"]').textContent,/12 секунд/);
});
test('legacy separate trailers remain usable without generating or exposing a full source',async()=>{
 props={...props,value:'https://test.b-cdn.net/preview.mp4'};await render();assert.equal(document.querySelector('select').value,'link');
 await act(async()=>assert.equal(await ref.current.prepare(),props.value));assert.equal(calls.length,0);
});
