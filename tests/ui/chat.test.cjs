const assert = require('node:assert/strict');
const {test,beforeEach,afterEach,after} = require('node:test');
const {JSDOM} = require('jsdom');
const path = require('node:path');
const dom = new JSDOM('<div id="root"></div>', {url:'https://app.test',pretendToBeVisual:true});
Object.assign(global,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,CustomEvent:dom.window.CustomEvent,Image:dom.window.Image,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
const repo=path.resolve(__dirname,'../..'),out=path.join(repo,'node_modules/.cache/chat-bundle.cjs');
require('esbuild').buildSync({entryPoints:[path.join(repo,'app/components/SupportChat.tsx')],bundle:true,platform:'node',format:'cjs',jsx:'automatic',packages:'external',alias:{'@/lib':path.join(repo,'lib')},outfile:out});
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client');
const {ChatPanel,AdminChatInbox}=require(out);
const realFetch=global.fetch;
const now=new Date().toISOString();
let root,messages,writes,reads,focused,hidden,loseResponse,grants,deletes,activity,peer;
const make=(id,sender,message,read_at=null)=>({id,sender,message,client_id:`message-${id}`,created_at:now,read_at,image_url:null});
beforeEach(()=>{
  root=createRoot(document.getElementById('root'));messages=[];writes=[];reads=[];focused=true;hidden=false;loseResponse=false;
  grants=[];deletes=[];activity=[];peer={peer_online:false,peer_typing:false};
  document.hasFocus=()=>focused;
  Object.defineProperty(document,'visibilityState',{get:()=>hidden?'hidden':'visible',configurable:true});
  global.fetch=async(raw,opts={})=>{
    const url=new URL(raw,'https://app.test');assert.equal(url.origin,'https://app.test');
    if(url.pathname==='/api/chat/activity'){activity.push(JSON.parse(opts.body));return Response.json({ok:true});}
    if(url.pathname==='/api/chat/access'){
      if(opts.method==='POST'){const body=JSON.parse(opts.body);grants.push(body);if(loseResponse){loseResponse=false;throw new TypeError('Lost response');}return Response.json({grant:{expires_at:now}});}
      return Response.json({films:[{id:33,title:'Film A',badge:'Гадаад'},{id:34,title:'Film B',badge:'Хятад'}],access:{}});
    }
    if(opts.method==='DELETE'){const body=JSON.parse(opts.body);deletes.push(body);messages=messages.filter(m=>m.id>body.through);return Response.json({ok:true});}
    if(opts.method==='PATCH'){
      const body=JSON.parse(opts.body);reads.push(body);
      const reader=body.user?'admin':'user';messages=messages.map(m=>m.sender!==reader&&m.id<=body.through?{...m,read_at:now}:m);
      return Response.json({ok:true});
    }
    if(opts.method==='POST'){
      const body=JSON.parse(opts.body);writes.push(body);
      let m=messages.find(m=>m.client_id===body.client_id);
      if(!m){m={...make(messages.length+1,body.user?'admin':'user',body.message),client_id:body.client_id,image_url:body.image?'/api/chat/image?id=1':null};messages.push(m);}
      if(loseResponse){loseResponse=false;throw new TypeError('Lost response');}
      return Response.json({message:m});
    }
    if(url.searchParams.has('inbox'))return Response.json({threads:[{user_id:1,phone:'99112233',sender:'user',message:'Help',unread:2},{user_id:2,phone:'99112244',sender:'user',message:'Question',unread:0}],more:false});
    if(url.searchParams.has('summary'))return Response.json({unread:messages.filter(m=>m.sender==='admin'&&!m.read_at).length});
    return Response.json({messages,...peer});
  };
});
afterEach(async()=>{await act(async()=>root.unmount());global.fetch=realFetch;});
after(()=>dom.window.close());
const render=(Component=ChatPanel,props={})=>act(async()=>root.render(React.createElement(Component,props)));
const click=selector=>act(async()=>{const el=document.querySelector(selector);assert.ok(el,selector);el.click();});
const fill=text=>act(async()=>{const el=document.querySelector('textarea');Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(el,text);el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
const refresh=()=>act(async()=>document.dispatchEvent(new dom.window.Event('visibilitychange')));
const change=(selector,value)=>act(async()=>{const el=document.querySelector(selector);const proto=el.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new dom.window.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));});
const clickText=text=>act(async()=>{const el=[...document.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(el,text);el.click();});

test('user sends a message once, then sees the admin read receipt',async()=>{
  await render();assert.match(document.body.textContent,/Яриагаа эхлүүлье/);
  await fill('Төлбөрийн талаар асууя');await click('.chat-send');
  assert.equal(writes.length,1);assert.equal(writes[0].user,undefined);assert.match(document.querySelector('.chat-mine').textContent,/Уншаагүй/);
  assert.equal(document.querySelector('textarea').value,'');
  messages[0].read_at=now;await refresh();assert.match(document.querySelector('.chat-mine').textContent,/✓✓ Уншсан/);
});

test('the automatic receipt guidance appears before the user sends a message and contains the film/package instructions',async()=>{
  await render();assert.match(document.querySelector('.chat-welcome').textContent,/гүйлгээний утгаа буруу/);assert.match(document.querySelector('.chat-welcome').textContent,/Киноны нэр эсвэл авсан багцаа/);assert.equal(writes.length,0);
});
test('admin grants a selected film from the current conversation; lost responses retry the same grant',async()=>{
  await render(ChatPanel,{admin:true,userId:2,title:'99112244'});
  await clickText('＋ Эрх нээх');await change('.chat-action-panel select','33');await clickText('Үргэлжлүүлэх');
  assert.match(document.querySelector('.chat-action-panel').textContent,/99112244/);assert.match(document.querySelector('.chat-grant-confirm').textContent,/Film A/);
  loseResponse=true;await clickText('Баталгаажуулж эрх нээх');assert.equal(grants.length,1);assert.equal(grants[0].user,2);assert.equal(grants[0].film_id,33);assert.equal(grants[0].plan,'single');
  await clickText('Дахин шалгаж нээх');assert.equal(grants.length,2);assert.equal(grants[0].request_id,grants[1].request_id);assert.ok(document.querySelector('.chat-action-success'));assert.equal(document.querySelector('.chat-action-panel'),null);
});
test('admin can choose a three-day or monthly category package without a film',async()=>{
  await render(ChatPanel,{admin:true,userId:1,title:'99112233'});await clickText('＋ Эрх нээх');await clickText('3 хоног');await change('.chat-action-panel select','gadaad');await clickText('Үргэлжлүүлэх');await clickText('Баталгаажуулж эрх нээх');
  assert.equal(grants[0].plan,'gadaad_3day');assert.equal(grants[0].film_id,null);
  await clickText('＋ Эрх нээх');await clickText('1 сар');await change('.chat-action-panel select','all');await clickText('Үргэлжлүүлэх');await clickText('Баталгаажуулж эрх нээх');assert.equal(grants[1].plan,'all_1month');
});
test('admin delete confirmation freezes the visible boundary and preserves newly arriving messages',async()=>{
  messages=[make(1,'user','Old')];await render(ChatPanel,{admin:true,userId:1,title:'99112233'});await click('[aria-label="Энэ чатыг устгах"]');
  messages.push(make(2,'user','New'));await refresh();await clickText('Тийм, чат устгах');assert.deepEqual(deletes,[{user:1,through:1}]);assert.equal(messages.length,1);assert.equal(messages[0].id,2);
});
test('typing and online status update without sending drafts, and incoming grants refresh access',async()=>{
  peer={peer_online:true,peer_typing:true};let count=0;const update=()=>count++;window.addEventListener('kinoAccessChanged',update);
  try {
    await render();assert.match(document.querySelector('.chat-heading').textContent,/Чат нээлттэй/);assert.match(document.querySelector('.chat-typing').textContent,/Админ бичиж байна/);
    await fill('Private unsent draft');assert.ok(activity.length);assert.ok(activity.every(p=>!JSON.stringify(p).includes('Private')));
    messages.push({...make(1,'admin','Эрх нээлээ'),grant_payment_id:22});await refresh();assert.equal(count,1);await refresh();assert.equal(count,1);
  } finally {window.removeEventListener('kinoAccessChanged',update);}
});
test('failed sends retain their exact retry ID and recover without duplicate messages',async()=>{
  await render();loseResponse=true;await fill('Баримт очсон уу?');await click('.chat-send');
  assert.ok(document.querySelector('.chat-failed'));
  await click('.chat-failed button');assert.equal(writes.length,2);assert.equal(writes[0].client_id,writes[1].client_id);
  assert.equal(messages.length,1);assert.equal(document.querySelector('.chat-failed'),null);
});
test('hidden or unfocused chats are not marked read, reopening acknowledges only the received message',async()=>{
  focused=false;messages=[make(1,'admin','Хариу')];await render();assert.equal(reads.length,0);
  hidden=true;focused=true;await act(async()=>window.dispatchEvent(new dom.window.Event('focus')));assert.equal(reads.length,0);
  hidden=false;await refresh();assert.ok(reads.some(r=>r.through===1));
});
test('reading older messages does not jump or acknowledge a newly arriving message until scrolling down',async()=>{
  messages=[make(1,'admin','Өмнөх',now)];await render();
  const history=document.querySelector('.chat-history');Object.defineProperty(history,'scrollHeight',{value:1000,configurable:true});Object.defineProperty(history,'clientHeight',{value:200,configurable:true});
  await act(async()=>{history.scrollTop=0;history.dispatchEvent(new dom.window.Event('scroll',{bubbles:true}));});
  messages.push(make(2,'admin','Шинэ хариу'));await refresh();assert.equal(reads.length,0);assert.equal(history.scrollTop,0);
  await click('.chat-jump');assert.equal(reads.at(-1).through,2);
});
test('admin inbox opens the selected owner and sends replies into that conversation',async()=>{
  await render(AdminChatInbox);assert.equal(document.querySelectorAll('.chat-thread').length,2);
  await click('.chat-thread');assert.match(document.querySelector('.chat-heading').textContent,/99112233/);
  await fill('Баримтын зургаа илгээнэ үү.');await click('.chat-send');assert.equal(writes[0].user,1);
  await click('[aria-label="Чатаас буцах"]');assert.ok(document.querySelector('.chat-select-prompt'));
});
test('invalid attachments show a useful error without sending or disabling text chat',async()=>{
  await render();const input=document.querySelector('input[type=file]');
  Object.defineProperty(input,'files',{value:[new dom.window.File(['unsafe'],'x.svg',{type:'image/svg+xml'})],configurable:true});
  await act(async()=>input.dispatchEvent(new dom.window.Event('change',{bubbles:true})));
  assert.match(document.querySelector('.chat-error').textContent,/JPEG/);assert.equal(writes.length,0);
  await fill('Зураггүй мессеж');await click('.chat-send');assert.equal(writes.length,1);
});
test('attached images can be previewed, removed and enlarged from the history',async()=>{
  // JSDOM has no image decoder/canvas. Stub only those browser primitives;
  // image validation/re-encoding is separately tested against real sharp.
  const create=URL.createObjectURL,revoke=URL.revokeObjectURL;
  URL.createObjectURL=()=> 'blob:test';URL.revokeObjectURL=()=>{};
  const decode=dom.window.HTMLImageElement.prototype.decode;
  dom.window.HTMLImageElement.prototype.decode=async function(){Object.defineProperty(this,'naturalWidth',{value:10,configurable:true});Object.defineProperty(this,'naturalHeight',{value:10,configurable:true});};
  const context=dom.window.HTMLCanvasElement.prototype.getContext,dataURL=dom.window.HTMLCanvasElement.prototype.toDataURL;
  dom.window.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},drawImage(){}});
  dom.window.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/webp;base64,AAAA';
  try{
    await render();const input=document.querySelector('input[type=file]');
    const attach=()=>act(async()=>{Object.defineProperty(input,'files',{value:[new dom.window.File(['image'],'x.png',{type:'image/png'})],configurable:true});input.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
    await attach();assert.ok(document.querySelector('.chat-attachment img'));await click('[aria-label="Сонгосон зургийг хасах"]');assert.equal(document.querySelector('.chat-attachment'),null);
    await attach();await click('.chat-send');assert.ok(writes[0].image);assert.equal(writes[0].message,'');
    await click('.chat-image-button');assert.ok(document.querySelector('dialog[open] img'));await click('.chat-close-image');assert.equal(document.querySelector('dialog'),null);
  }finally{URL.createObjectURL=create;URL.revokeObjectURL=revoke;dom.window.HTMLImageElement.prototype.decode=decode;dom.window.HTMLCanvasElement.prototype.getContext=context;dom.window.HTMLCanvasElement.prototype.toDataURL=dataURL;}
});
