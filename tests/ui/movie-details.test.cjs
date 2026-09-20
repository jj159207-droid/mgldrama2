// DOM behavior tests with same-origin API fixtures; no live accounts or video playback.
const assert=require('node:assert/strict');
const {test,beforeEach,afterEach,after}=require('node:test');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="root"></div>',{url:'https://app.test/',pretendToBeVisual:true});
Object.assign(global,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,CustomEvent:dom.window.CustomEvent,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});
dom.window.scrollTo=()=>{};
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
const path=require('node:path');
const repo=path.resolve(__dirname,'../..');
const outfile=path.join(repo,'node_modules/.cache/movie-details-bundle.cjs');
require('esbuild').buildSync({entryPoints:[path.join(repo,'app/page.tsx')],bundle:true,platform:'node',format:'cjs',jsx:'automatic',packages:'external',alias:{'@/app':path.join(repo,'app'),'@/lib':path.join(repo,'lib')},outfile});
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client');
const App=require(outfile).default;
const films=[{id:7,title:'Гэрэл',img:'https://images.test/poster7.webp',description:'Хоёр найзын аялал. <b>Хадмалтай</b>',preview_url:'https://video.test/trailer7.mp4',views:20,free:false,locked:true,price:5000,badge:'Хадмал|Гадаад',url:'https://video.test/private7.mp4'},{id:34,title:'Алсын зам',preview_url:'https://video.test/trailer34.mp4',views:10,free:true,locked:false,price:0,badge:'Хэлтэй|Хятад',url:'https://video.test/free34.mp4'}];
let root,session,entitled,orders,requests,failCatalog,failPlayback,authGate,filmGate,loginGate,deviceGate,playbackGate,clipboard,entryAllowed,walletBalance;
const originalFetch=global.fetch;
const defer=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)};};
beforeEach(()=>{
 session={};entitled=false;orders=[];requests=[];failCatalog=false;failPlayback=false;authGate=null;filmGate=null;loginGate=null;deviceGate=null;playbackGate=null;clipboard=[];entryAllowed=true;walletBalance=0;
 window.history.replaceState({page:'home'},'', '/');
 Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>clipboard.push(value)},configurable:true});
 root=createRoot(document.getElementById('root'));
 global.fetch=async(path,opts={})=>{
  const url=new URL(path,'https://app.test');assert.equal(url.origin,'https://app.test','no external request allowed');
  requests.push({path:url.pathname,query:url.search,method:opts.method||'GET'});
  if(url.pathname==='/api/auth'){
   if(opts.method==='POST'){
    if(loginGate)await loginGate.promise;
    session={user:{id:12,phone:'99112233'}};return Response.json(session);
   }
   if(authGate)await authGate.promise;
   return Response.json(session);
  }
  if(url.pathname==='/api/device'){
   if(deviceGate)await deviceGate.promise;
   if(session.admin)return Response.json({admin:true,user:null});
   if(!session.user)session={user:{id:12,phone:'',user_id:'GTESTDEVICE',guest:true}};
   return Response.json(session);
  }
  if(url.pathname==='/api/entry-access')return Response.json({allowed:entryAllowed,reason:entryAllowed?'paid':'payment_required'});
  if(url.pathname==='/api/access')return Response.json({access:entitled?{film_7:Date.now()+86400000}:{}});
  if(url.pathname==='/api/wallet')return Response.json({balance:walletBalance});
  if(url.pathname==='/api/settings')return Response.json({});
  if(url.pathname==='/api/appearance')return Response.json({appearance:{layout:1,tone:25,revision:0}});
  if(url.pathname==='/api/playback'){
   if(playbackGate)await playbackGate.promise;
   if(failPlayback)return Response.json({message:'Backend unavailable'},{status:503});
   const id=Number(url.searchParams.get('id')),film=films.find(f=>f.id===id);
   if(!film)return Response.json({message:'Кино олдсонгүй.'},{status:404});
   if(!session.admin && !session.user)return Response.json({message:'Нэвтэрч орно уу.'},{status:403});
   if(!film.free && !session.admin && !(session.user && entitled))return Response.json({message:'Үзэх эрх байхгүй.'},{status:403});
   return Response.json({...film,locked:false});
  }
  if(url.pathname==='/api/db'){
   const [table,search='']=url.searchParams.get('path').split('?'),q=new URLSearchParams(search);
   if(table==='films'){
    const id=q.get('id')||'';const targeted=id.startsWith('eq.');
    if(targeted && filmGate)await filmGate.promise;
    if(!targeted && failCatalog)return Response.json({message:'Unavailable'},{status:503});
    return Response.json(films.filter(f=>targeted?f.id===Number(id.slice(3)):!id||f.id<Number(id.slice(3))).sort((a,b)=>b.id-a.id).map(f=>session.admin?f:{...f,url:''}));
   }
   if(table==='pending_payments'){
    if(opts.method==='POST'){
     assert.ok(session.user,'must authenticate before creating an order');
     const body=JSON.parse(opts.body);
     const existingByRef=orders.find(o=>o.ref_code===body.ref_code);
     if(existingByRef)return Response.json([existingByRef]);
     if(body.plan==='wallet_topup'){
       const existingTopup=orders.find(o=>o.plan==='wallet_topup'&&o.status==='pending'&&Number(o.amount)===Number(body.amount));
       if(existingTopup)return Response.json([existingTopup]);
     }
     const order={...body,id:90+orders.length,amount:body.plan==='wallet_topup'?Number(body.amount):body.plan==='single'?5000:body.plan==='all_48h'?7900:body.plan.endsWith('_3day')?8000:12500,status:'pending',created_at:new Date().toISOString()};orders.push(order);return Response.json([order]);
    }
    return Response.json(orders.filter(o=>(!q.has('ref_code')||o.ref_code===q.get('ref_code').slice(3))&&(!q.has('status')||o.status===q.get('status').slice(3))));
   }
   if(table==='contact_messages')return Response.json([]);
  }
  throw new Error('Unexpected test request '+path);
 };
});
afterEach(async()=>{await act(async()=>root.unmount());global.fetch=originalFetch;});
after(()=>dom.window.close());
const render=async(url='/')=>{window.history.replaceState({page:'home'},'',url);await act(async()=>root.render(React.createElement(App)));};
const click=async(selector)=>{const el=document.querySelector(selector);assert.ok(el,selector);await act(async()=>el.click());};
const fill=async(selector,value)=>act(async()=>{const el=document.querySelector(selector);assert.ok(el,selector);Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
const login=async()=>{await fill('#user-phone','99112233');await fill('#user-pin','1234');await act(async()=>document.querySelector('.login-dialog form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));};
const pop=async(url,state={page:'home'})=>act(async()=>{window.history.replaceState(state,'',url);window.dispatchEvent(new dom.window.PopStateEvent('popstate',{state}));});
const movie=()=>document.querySelector('.full-player video')?.getAttribute('src');
const title=()=>document.querySelector('#selected-film-title')?.textContent;

test('TAZA hides every movie until the 7900 MNT 72-hour package is confirmed',async()=>{
 entryAllowed=false;walletBalance=0;
 await render('/?film=7&fbclid=tracking');
 assert.equal(document.querySelector('#selected-film-title'),null);
 assert.equal(document.querySelectorAll('.movie-card').length,0);
 assert.match(document.body.textContent,/Автоматаар баталгаажиж кинонууд нээгдэнэ/);
 const pricing=document.querySelector('.wallet-entry-pricing');assert.ok(pricing);
 assert.match(pricing.textContent,/Шилжүүлэх дүн 7,900₮/);
 assert.match(pricing.textContent,/Бүх киног үзэх эрх/);
 assert.doesNotMatch(pricing.textContent,/1 кино - 2,000₮/);
 assert.doesNotMatch(pricing.textContent,/41 кино/);
 assert.doesNotMatch(pricing.textContent,/48 цаг/);
 assert.doesNotMatch(document.body.textContent,/Таны кино сайтын дансны одоогийн үлдэгдэл/);
 assert.equal(orders.length,1);assert.equal(orders[0].plan,'all_48h');assert.equal(orders[0].amount,7900);
 orders[0].status='confirmed';entryAllowed=true;entitled=true;
 await act(async()=>window.dispatchEvent(new dom.window.Event('focus')));
 await act(async()=>new Promise(resolve=>setTimeout(resolve,0)));
 assert.equal(title(),'Гэрэл');
 assert.ok(requests.some(r=>r.path==='/api/entry-access'));
});

test('poster starts only the public trailer; full playback requires its own button',async()=>{
 await render('/?film=7&fbclid=tracking');
 assert.equal(document.querySelector('video'),null);assert.equal(requests.filter(r=>r.path==='/api/playback').length,0);
 assert.equal(document.querySelector('#film-payment'),null,'payment is hidden until purchase is requested');
 assert.match(document.querySelector('.detail-description').textContent,/<b>Хадмалтай<\/b>/);assert.equal(document.querySelector('.detail-description b'),null);
 await click('.detail-poster');
 const video=document.querySelector('video[data-trailer]');assert.equal(video.getAttribute('src'),films[0].preview_url);assert.equal(video.muted,true);assert.equal(video.hasAttribute('controls'),true);
 assert.equal(requests.filter(r=>r.path==='/api/playback').length,0);assert.equal(orders.length,0);assert.equal(document.querySelector('.login-dialog'),null);
 await click('.film-continue');assert.equal(document.querySelector('video[data-trailer]'),null);assert.equal(document.querySelector('.login-dialog'),null);assert.ok(document.querySelector('#film-payment .checkout-inline'));assert.equal(orders.length,1);assert.equal(movie(),undefined);
});
test('missing trailer never falls back to a private movie, and a failed trailer can be closed',async()=>{
 const preview=films[0].preview_url;films[0].preview_url='';
 try {await render('/?film=7');assert.equal(document.querySelector('.detail-poster').disabled,true);await click('.detail-poster');assert.equal(document.querySelector('video'),null);}finally{films[0].preview_url=preview;}
 await pop('/?film=34');await click('.detail-poster');
 await act(async()=>document.querySelector('video[data-trailer]').dispatchEvent(new dom.window.Event('error')));
 assert.ok(document.querySelector('.trailer-error'));await click('.trailer-close');assert.ok(document.querySelector('.detail-poster'));assert.equal(document.querySelector('video'),null);
});
test('recommendations show top three of the category, then navigation resets trailer and packages',async()=>{
 const original=films.length;
 films.push({id:8,title:'Найз',badge:'Хэлтэй|Гадаад',views:50}, {id:9,title:'Салхи',badge:'Хадмал|Гадаад',views:200}, {id:10,title:'Зам',badge:'Хэлтэй|Гадаад',views:100}, {id:11,title:'Уул',badge:'Хэлтэй|Гадаад',views:80});
 try {
  await render('/?film=7&fbclid=tracking');assert.deepEqual([...document.querySelectorAll('.related-film h3')].map(x=>x.textContent),['Салхи','Зам','Уул']);assert.equal(document.querySelector('.detail-play span').textContent,'Трейлер үзэх');assert.equal(document.querySelector('#related-title'),null);
  assert.deepEqual([...document.querySelectorAll('.detail-plan h3')].map(x=>x.textContent),['3 хоног','30 хоног']);
  assert.deepEqual([...document.querySelectorAll('.detail-plan strong')].map(x=>x.textContent),['8,000₮','12,500₮']);
  assert.deepEqual([...document.querySelectorAll('.film-destination > section')].map(x=>x.className),['film-landing','detail-packages','detail-related']);
  await click('.detail-poster');await click('.related-film');assert.equal(title(),'Салхи');assert.equal(document.querySelector('video'),null);assert.equal(new URL(window.location.href).searchParams.get('film'),'9');assert.equal(new URL(window.location.href).searchParams.get('fbclid'),'tracking');
  await pop('/?film=34');assert.equal(document.querySelector('#detail-packages-title'),null);assert.deepEqual([...document.querySelectorAll('.detail-plan .eyebrow')].map(x=>x.textContent),['60 кино үзэх эрх','60 кино үзэх эрх']);assert.ok([...document.querySelectorAll('.detail-plan button')].every(x=>x.getAttribute('aria-label').startsWith('Хятад')));
 }finally{films.splice(original);}
});
test('a category package bought from details stays inline and opens the selected movie after payment',async()=>{
 await render('/?film=7');await click('[aria-label="Гадаад 30 хоногийн багц авах"]');assert.equal(document.querySelector('.login-dialog'),null);
 assert.equal(title(),'Гэрэл');assert.ok(document.querySelector('#film-payment .checkout-inline'));assert.equal(document.querySelector('.checkout-dialog'),null);
 assert.equal(orders.length,1);assert.equal(orders[0].film_id,null);assert.equal(orders[0].plan,'gadaad_1month');assert.equal(orders[0].amount,12500);
 orders[0].status='confirmed';entitled=true;
 await act(async()=>[...document.querySelectorAll('.checkout-back')].find(b=>b.textContent==='Төлбөрөө шалгах').click());
 assert.equal(movie(),films[0].url);assert.equal(orders.length,1);
});
test('leaving during a full movie request prevents its late result from opening a player',async()=>{
 session={user:{id:12,phone:'99112233'}};await render('/?film=34');playbackGate=defer();await click('.film-continue');await click('.film-back');
 await act(async()=>playbackGate.resolve());assert.ok(document.querySelector('.catalog-browser'));assert.equal(movie(),undefined);
});
test('full player Back returns to the main page and stops playback',async()=>{
 session={user:{id:12,phone:'99112233'}};await render('/?film=34');await click('.film-continue');assert.equal(movie(),films[1].url);
 const before=requests.filter(r=>r.path==='/api/playback').length;
 await click('[aria-label="Нүүр рүү буцах"]');
 assert.ok(document.querySelector('.site-header'));assert.equal(window.location.search,'');assert.equal(movie(),undefined);assert.equal(requests.filter(r=>r.path==='/api/playback').length,before);
});
test('a closed checkout ignores late confirmation and keeps the detail page',async()=>{
 session={user:{id:12,phone:'99112233'}};await render('/?film=7');await click('.film-continue');assert.equal(orders.length,1);
 orders[0].status='confirmed';entitled=true;playbackGate=defer();
 await act(async()=>[...document.querySelectorAll('.checkout-back')].find(b=>b.textContent==='Төлбөрөө шалгах').click());
 await click('.checkout-complete button');await act(async()=>playbackGate.resolve());
 assert.equal(title(),'Гэрэл');assert.equal(movie(),undefined);assert.equal(document.querySelector('.checkout-inline'),null);
 assert.equal(document.querySelector('#film-payment'),null);
});

test('Facebook link creates a device session and opens a free full movie without registration',async()=>{
 failCatalog=true;await render('/?utm_source=facebook&film=34&fbclid=tracking');
 assert.equal(title(),'Алсын зам');assert.equal(movie(),undefined);
 await click('.film-continue');assert.equal(document.querySelector('.login-dialog'),null);assert.equal(movie(),films[1].url);assert.equal(orders.length,0);
 assert.ok(requests.some(r=>r.path==='/api/device'));
 assert.equal(new URL(window.location.href).searchParams.get('film'),'34');
});
test('session restoration completes before selecting login or playback',async()=>{
 authGate=defer();session={user:{id:12,phone:'99112233'}};entitled=true;
 await render('/?film=7');assert.equal(movie(),undefined);assert.equal(requests.filter(r=>r.path==='/api/playback').length,0);
 await act(async()=>authGate.resolve());assert.equal(movie(),undefined);await click('.film-continue');assert.equal(movie(),films[0].url);assert.equal(orders.length,0);
});
test('guest device pays for the selected film without registration and keeps the same entitlement owner',async()=>{
 await render('/?film=7&fbclid=tracking');assert.equal(title(),'Гэрэл');assert.equal(orders.length,0);assert.equal(movie(),undefined);
 await click('.film-continue');assert.equal(document.querySelector('.login-dialog'),null);assert.ok(document.querySelector('#film-payment .checkout-inline'));assert.equal(orders.length,1);assert.equal(orders[0].film_id,7);assert.equal(orders[0].plan,'single');
 orders[0].status='confirmed';entitled=true;
 await act(async()=>[...document.querySelectorAll('.checkout-back')].find(b=>b.textContent==='Төлбөрөө шалгах').click());
 assert.equal(movie(),films[0].url);assert.equal(orders.length,1);assert.equal(new URL(window.location.href).searchParams.get('film'),'7');
});
test('normal catalog movie selection also creates a reloadable direct link',async()=>{
 await render();await act(async()=>[...document.querySelectorAll('.movie-main')].find(b=>b.textContent.includes('Гэрэл')).click());
 assert.equal(title(),'Гэрэл');assert.equal(window.location.search,'?film=7');
 await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(App)));
 assert.equal(title(),'Гэрэл');assert.equal(orders.length,0);
});
test('an already signed-in buyer keeps selection and recently acquired access avoids another order',async()=>{
 session={user:{id:12,phone:'99112233'}};await render('/?film=7');assert.equal(title(),'Гэрэл');
 entitled=true;await click('.film-continue');assert.equal(movie(),films[0].url);assert.equal(orders.length,0);
});
test('leaving while device identity is being created prevents a late guest purchase',async()=>{
 deviceGate=defer();await render('/?film=7');await click('.film-continue');await click('.film-back');
 await act(async()=>deviceGate.resolve());assert.equal(window.location.search,'');assert.ok(document.querySelector('.catalog-browser'));assert.equal(orders.length,0);assert.equal(movie(),undefined);
});
test('leaving while a movie request is pending prevents a late player from opening',async()=>{
 filmGate=defer();await render('/?film=34');await click('.film-back');await act(async()=>filmGate.resolve());
 assert.ok(document.querySelector('.catalog-browser'));assert.equal(movie(),undefined);assert.equal(window.location.search,'');
});
test('invalid and deleted links show a clear error without opening another movie',async()=>{
 await render('/?film=7&film=34');assert.match(document.querySelector('.film-link-error').textContent,/холбоос буруу/);
 assert.equal(requests.filter(r=>r.path==='/api/playback').length,0);
 await pop('/?film=999');assert.match(document.querySelector('.film-link-error').textContent,/Кино олдсонгүй/);assert.equal(movie(),undefined);assert.equal(orders.length,0);
});
test('playback connection failure can be retried on the same direct link',async()=>{
 session={user:{id:12,phone:'99112233'}};failPlayback=true;await render('/?film=34');await click('.film-continue');assert.ok(document.querySelector('.detail-watch-error'));
 failPlayback=false;await click('.film-continue');assert.equal(movie(),films[1].url);
});
test('back and forward URL events select the correct movie and close payment',async()=>{
 session={user:{id:12,phone:'99112233'}};await render('/?film=7');await click('.film-continue');assert.ok(document.querySelector('.checkout-inline'));
 await pop('/?film=7',{page:'film'});assert.equal(title(),'Гэрэл');assert.equal(document.querySelector('.checkout-inline'),null);assert.equal(orders.length,1);
 await pop('/',{page:'home'});assert.ok(document.querySelector('.catalog-browser'));
 await pop('/?film=34',{page:'film'});assert.equal(title(),'Алсын зам');assert.equal(movie(),undefined);
 await pop('/?film=7',{page:'film'});assert.equal(title(),'Гэрэл');assert.equal(movie(),undefined);
});
test('admin shares the movie page URL without private playback data and can copy manually',async()=>{
 session={admin:true};await render('/?utm_source=private');
 for(let i=0;i<5;i++)await click('[aria-label="ТАЗА САЙТ лого"]');
 await click('[aria-label="Гэрэл: зарын холбоос хуулах"]');assert.deepEqual(clipboard,['https://app.test/?film=7']);
 assert.equal(document.querySelector('[aria-label="Гэрэл: киноны холбоос"]').value,'https://app.test/?film=7');
 Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('Denied');}},configurable:true});
 await click('[aria-label="Алсын зам: зарын холбоос хуулах"]');assert.match(document.body.textContent,/өөрөө хуулна уу/);
 const input=document.querySelector('[aria-label="Алсын зам: киноны холбоос"]');await act(async()=>input.click());assert.equal(input.selectionEnd,input.value.length);
});
test('an admin session previews full playback without replacing itself with a guest device',async()=>{
 session={admin:true};await render('/?film=34');assert.equal(title(),'Алсын зам');assert.equal(movie(),undefined);
 const beforeDevice=requests.filter(r=>r.path==='/api/device').length;
 await click('.film-continue');assert.equal(document.querySelector('.login-dialog'),null);assert.equal(movie(),films[1].url);assert.equal(requests.filter(r=>r.path==='/api/device').length,beforeDevice);
 assert.equal(document.querySelector('.admin-surface'),null);
});
test('package purchase creates a guest device and remains a package without a movie ID',async()=>{
 await render();await click('.package-continue');
 assert.equal(document.querySelector('.login-dialog'),null);assert.ok(document.querySelector('.checkout-dialog'));assert.equal(orders.length,1);assert.equal(orders[0].film_id,null);assert.equal(orders[0].plan,'gadaad_3day');assert.equal(window.location.search,'');
});
test('native history back restores catalog and forward restores details without playback',async()=>{
 await render();await act(async()=>[...document.querySelectorAll('.movie-main')].find(b=>b.textContent.includes('Алсын зам')).click());
 assert.equal(title(),'Алсын зам');assert.equal(movie(),undefined);
 await act(async()=>{const done=new Promise(resolve=>window.addEventListener('popstate',resolve,{once:true}));window.history.back();await done;});
 assert.equal(window.location.search,'');assert.ok(document.querySelector('.catalog-browser'));
 await act(async()=>{const done=new Promise(resolve=>window.addEventListener('popstate',resolve,{once:true}));window.history.forward();await done;});
 assert.equal(window.location.search,'?film=34');assert.equal(title(),'Алсын зам');assert.equal(movie(),undefined);
});

const traverse=direction=>act(async()=>{const done=new Promise(resolve=>window.addEventListener('popstate',resolve,{once:true}));window.history[direction]();await done;});
test('native Back from full playback goes home; Forward requires another explicit play',async()=>{
 session={user:{id:12,phone:'99112233'}};await render('/?film=34');await click('.film-continue');assert.equal(movie(),films[1].url);
 await traverse('back');assert.ok(document.querySelector('.site-header'));assert.equal(movie(),undefined);assert.equal(window.location.search,'');
 const before=requests.filter(r=>r.path==='/api/playback').length;
 await traverse('forward');assert.equal(title(),'Алсын зам');assert.equal(movie(),undefined);assert.equal(requests.filter(r=>r.path==='/api/playback').length,before);
});
test('native Back after inline payment and playback also reaches home',async()=>{
 session={user:{id:12,phone:'99112233'}};await render('/?film=7');await click('.film-continue');assert.equal(orders.length,1);
 orders[0].status='confirmed';entitled=true;
 await act(async()=>[...document.querySelectorAll('.checkout-back')].find(b=>b.textContent==='Төлбөрөө шалгах').click());assert.equal(movie(),films[0].url);
 await traverse('back');assert.ok(document.querySelector('.site-header'));assert.equal(movie(),undefined);assert.equal(document.querySelector('.checkout-inline'),null);
});
test('a fresh Facebook movie link gets a home entry; native Back goes home and Forward restores only details',async()=>{
 await render('/?film=7&utm_source=facebook&fbclid=tracking');assert.equal(title(),'Гэрэл');
 await traverse('back');assert.ok(document.querySelector('.site-header'));assert.equal(new URL(window.location.href).searchParams.has('film'),false);assert.equal(new URL(window.location.href).searchParams.get('fbclid'),'tracking');
 await traverse('forward');assert.equal(title(),'Гэрэл');assert.equal(movie(),undefined);assert.equal(orders.length,0);
});
test('reloading a direct movie link does not add more home entries',async()=>{
 await render('/?film=34');const length=window.history.length;
 await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(App)));
 assert.equal(window.history.length,length);assert.equal(title(),'Алсын зам');await traverse('back');assert.ok(document.querySelector('.site-header'));
});
test('Back from a related movie opened from an ad also returns home',async()=>{
 const length=films.length;films.push({id:8,title:'Найз',badge:'Хэлтэй|Гадаад',views:50});
 try {await render('/?film=7');await click('.related-film');assert.equal(title(),'Найз');await traverse('back');assert.ok(document.querySelector('.site-header'));assert.equal(window.location.search,'');} finally {films.splice(length);}
});
test('a delayed admin-session response after leaving an ad never replaces the home page with management',async()=>{
 authGate=defer();session={admin:true};await render('/?film=7');await click('.film-back');await act(async()=>authGate.resolve());assert.ok(document.querySelector('.site-header'));assert.equal(document.querySelector('.admin-surface'),null);
});
