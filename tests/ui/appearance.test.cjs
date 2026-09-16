const assert=require('node:assert/strict');
const {test,beforeEach,afterEach,after}=require('node:test');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<meta name="theme-color" content="#090d13"><div id="root"></div>',{url:'https://app.test',pretendToBeVisual:true});
Object.assign(global,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,CustomEvent:dom.window.CustomEvent,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
const path=require('node:path'),repo=path.resolve(__dirname,'../..'),outfile=path.join(repo,'node_modules/.cache/appearance-bundle.cjs');
require('esbuild').buildSync({stdin:{contents:'export {default as Editor} from "./app/components/AppearanceEditor";export {default as useAppearance} from "./app/components/useSiteAppearance";',resolveDir:repo,loader:'tsx'},bundle:true,platform:'node',format:'cjs',jsx:'automatic',packages:'external',alias:{'@/app':path.join(repo,'app'),'@/lib':path.join(repo,'lib')},outfile});
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client'),{Editor,useAppearance}=require(outfile);
let root,current,writes,saved,closed,loadFailure,saveFailure,confirmations;
const originalFetch=global.fetch;
beforeEach(()=>{
 root=createRoot(document.getElementById('root'));current={layout:1,tone:25,revision:0};writes=[];saved=[];closed=0;loadFailure=0;saveFailure=0;confirmations=0;
 window.confirm=()=>{confirmations++;return true;};
 global.fetch=async(url,opts={})=>{
  assert.equal(url,'/api/appearance');
  if(opts.method==='PUT'){
   const body=JSON.parse(opts.body);writes.push(body);
   if(saveFailure)return Response.json({message:'Хадгалж чадсангүй.'},{status:saveFailure});
   if(body.revision!==current.revision)return Response.json({message:'Өөр цонхноос өөрчилсөн байна.'},{status:409});
   current={...body,revision:body.revision+1};
  }else if(loadFailure)return Response.json({message:'Unavailable'},{status:loadFailure});
  return Response.json({appearance:{...current}});
 };
});
afterEach(async()=>{await act(async()=>root.unmount());global.fetch=originalFetch;});
after(()=>dom.window.close());
const editor=()=>React.createElement(Editor,{onClose:()=>closed++,onSaved:v=>saved.push(v)},React.createElement('main',{className:'cinema-site'},'Бодит киноны жагсаалт'));
const render=()=>act(async()=>root.render(editor()));
const click=selector=>act(async()=>{const element=document.querySelector(selector);assert.ok(element,selector);element.click();});
const range=(id,value)=>act(async()=>{const input=document.getElementById(id);Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,String(value));input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
const preview=()=>document.querySelector('.appearance-preview-content');

test('four layouts and continuous colors are draft-only until explicitly saved; reset restores last save',async()=>{
 await render();assert.ok(document.querySelector('dialog').open);assert.equal(document.body.style.overflow,'hidden');
 const initialColor=preview().style.getPropertyValue('--accent');
 for(let layout=1;layout<=4;layout++){await range('appearance-layout',layout);assert.equal(preview().dataset.layout,String(layout));}
 await range('appearance-tone',73);assert.notEqual(preview().style.getPropertyValue('--accent'),initialColor);
 assert.equal(writes.length,0);assert.equal(saved.length,0);
 await click('.appearance-reset');assert.equal(preview().dataset.layout,'1');assert.equal(preview().style.getPropertyValue('--accent'),initialColor);
 await range('appearance-layout',3);await range('appearance-tone',80);await click('.appearance-save');
 assert.deepEqual(writes,[{layout:3,tone:80,revision:0}]);assert.deepEqual(saved,[{layout:3,tone:80,revision:1}]);
 assert.match(document.querySelector('[role="status"]').textContent,/Хадгалагдлаа/);assert.ok(document.querySelector('.appearance-save').disabled);
 await range('appearance-tone',0);await click('.appearance-reset');assert.equal(document.getElementById('appearance-tone').value,'80');
 await click('.appearance-back');assert.equal(closed,1);assert.equal(confirmations,0);
});

test('unsaved edits can be kept or discarded on Back and Escape',async()=>{
 await render();await range('appearance-tone',100);
 window.confirm=()=>false;await click('.appearance-back');assert.equal(closed,0);
 await act(async()=>document.querySelector('dialog').dispatchEvent(new dom.window.Event('cancel',{cancelable:true})));assert.equal(closed,0);
 window.confirm=()=>true;await act(async()=>window.dispatchEvent(new CustomEvent('adminBackPress')));assert.equal(closed,1);assert.equal(writes.length,0);
});

test('load failures disable writes; failed save keeps the draft available for retry',async()=>{
 loadFailure=503;await render();assert.ok(document.querySelector('[role="alert"]'));assert.ok(document.getElementById('appearance-tone').disabled);
 await click('.appearance-save');assert.equal(writes.length,0);
 loadFailure=0;await click('.appearance-notice button');await range('appearance-layout',2);await range('appearance-tone',60);
 saveFailure=502;await click('.appearance-save');assert.equal(saved.length,0);assert.equal(preview().dataset.layout,'2');assert.equal(document.getElementById('appearance-tone').value,'60');assert.ok(!document.querySelector('.appearance-save').disabled);
 saveFailure=0;await click('.appearance-save');assert.equal(saved.length,1);assert.equal(saved[0].tone,60);
});

test('a concurrent admin update cannot be overwritten until current settings are reloaded',async()=>{
 await render();await range('appearance-tone',90);current={layout:4,tone:10,revision:1};
 await click('.appearance-save');assert.equal(saved.length,0);assert.equal(current.tone,10);assert.ok(document.getElementById('appearance-tone').disabled);
 await click('.appearance-notice button');assert.equal(preview().dataset.layout,'4');assert.equal(document.getElementById('appearance-tone').value,'10');
 await range('appearance-tone',55);await click('.appearance-save');assert.deepEqual(saved,[{layout:4,tone:55,revision:2}]);
});

test('slow initial reads do not replace newer editor state after a StrictMode remount',async()=>{
 const replies=[];global.fetch=()=>new Promise(resolve=>replies.push(resolve));
 await act(async()=>root.render(React.createElement(React.StrictMode,null,editor())));assert.equal(replies.length,2);
 await act(async()=>replies[1](Response.json({appearance:{layout:2,tone:50,revision:3}})));
 await range('appearance-tone',80);
 await act(async()=>replies[0](Response.json({appearance:{layout:1,tone:25,revision:0}})));
 assert.equal(preview().dataset.layout,'2');assert.equal(document.getElementById('appearance-tone').value,'80');
});

test('public appearance refreshes across visits and keeps the last good palette during outages',async()=>{
 function PublicSite(){const {appearance}=useAppearance();return React.createElement('main',{'data-layout':appearance.layout,'data-tone':appearance.tone});}
 current={layout:4,tone:90,revision:8};await act(async()=>root.render(React.createElement(PublicSite)));
 assert.equal(document.querySelector('main').dataset.layout,'4');const color=document.documentElement.style.getPropertyValue('--accent');assert.ok(color);
 loadFailure=503;await act(async()=>window.dispatchEvent(new dom.window.Event('focus')));assert.equal(document.documentElement.style.getPropertyValue('--accent'),color);
 loadFailure=0;current={layout:2,tone:0,revision:9};await act(async()=>window.dispatchEvent(new dom.window.Event('focus')));
 assert.equal(document.querySelector('main').dataset.layout,'2');assert.notEqual(document.documentElement.style.getPropertyValue('--accent'),color);
 // A delayed stale service response must not undo a newer save.
 current={layout:1,tone:25,revision:7};await act(async()=>window.dispatchEvent(new dom.window.Event('focus')));assert.equal(document.querySelector('main').dataset.layout,'2');
});
