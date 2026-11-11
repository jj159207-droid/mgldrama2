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
let root,session,entitled,purchased,credits,orders,requests,failCatalog,failPlayback,authGate,filmGate,loginGate,deviceGate,playbackGate,clipboard,entryAllowed,walletBalance,manualPhoneMode,manualPhoneFilm,manualAllowed;
const originalFetch=global.fetch;
const defer=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)};};
beforeEach(()=>{
 session={};entitled=false;purchased=new Set();credits=0;orders=[];requests=[];manualPhoneMode='none';manualPhoneFilm=null;manualAllowed=false;failCatalog=false;failPlayback=false;authGate=null;filmGate=null;loginGate=null;deviceGate=null;playbackGate=null;clipboard=[];entryAllowed=true;walletBalance=0;
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
   if(url.searchParams.get('recover')==='1')return Response.json({user:session.user||null,recovered:!!session.user});
   if(!session.user)session={user:{id:12,phone:'',user_id:'GTESTDEVICE',guest:true}};
   return Response.json(session);
  }
  if(url.pathname==='/api/phone-grants/claim'){
    const body=JSON.parse(opts.body||'{}');
    if(body.phone!=='99112233'||manualPhoneMode==='none')
      return Response.json({message:'Энэ дугаарт үзэх эрх байхгүй.',code:'PHONE_GRANT_MISSING'},{status:403});
    if(manualPhoneMode==='single'){
      if(manualPhoneFilm===null)manualPhoneFilm=body.film_id;
      if(manualPhoneFilm!==body.film_id)
        return Response.json({message:'Энэ киноны эрх ашиглагдсан.',code:'PHONE_GRANT_DIFFERENT_FILM'},{status:403});
    }
    manualAllowed=true;
    return Response.json({ok:true,access_type:manualPhoneMode});
  }
  if(url.pathname==='/api/entry-access')return Response.json({allowed:entryAllowed,reason:entryAllowed?'paid':'payment_required'});
  if(url.pathname==='/api/access')return Response.json({access:{...(entitled?{monthly:Date.now()+30*86400000}:{}),...Object.fromEntries([...purchased].map(id=>[`film_${id}`,Date.now()+30*86400000]))},bundleRemaining:credits});
  if(url.pathname==='/api/wallet')return Response.json({balance:walletBalance});
  if(url.pathname==='/api/settings')return Response.json({bankName:'Хаан банк',bankAccount:'5252017169',accountName:'Т.Жаргалбаяр',bankIban:'MN030000000000000000',messengerUrl:'https://m.me/1453362271192628'});
  if(url.pathname==='/api/appearance')return Response.json({appearance:{layout:1,tone:25,revision:0}});
  if(url.pathname==='/api/playback'){
   if(playbackGate)await playbackGate.promise;
   if(failPlayback)return Response.json({message:'Backend unavailable'},{status:503});
   const id=Number(url.searchParams.get('id')),film=films.find(f=>f.id===id);
   if(!film)return Response.json({message:'Кино олдсонгүй.'},{status:404});
   // Full video remains protected until a valid admin grant or payment exists.
   const phoneAllowed=manualAllowed&&(manualPhoneMode==='all'||manualPhoneFilm===id);
   if(!session.admin&&!session.user&&!phoneAllowed)return Response.json({code:'SUBSCRIPTION_REQUIRED',message:'Үзэх эрх шаардлагатай.'},{status:403});
   if(!session.admin&&!entitled&&!purchased.has(id)&&!phoneAllowed){
     if(credits>0){credits--;purchased.add(id);}
     else return Response.json({code:'SUBSCRIPTION_REQUIRED',message:'Үзэх эрх шаардлагатай.'},{status:403});
    }
   return Response.json({...film,locked:false});
  }
  if(url.pathname==='/api/public-catalog'){
   if(failCatalog)return Response.json({message:'Unavailable'},{status:503});
   // A public catalog must never expose private/full film playback URLs.
   return Response.json(films.map(({url,...film})=>film));
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
     const order={...body,id:90+orders.length,amount:body.plan==='wallet_topup'?Number(body.amount):body.plan==='single'?2500:body.plan==='pick_2_30d_5000'?5000:body.plan==='all_30d_9000'?9000:body.plan==='pick_5_30d_10000'?10000:body.plan==='pick_40_30d_12000'?12000:body.plan==='entry_72h'?12500:body.plan==='all_48h'?7900:15000,status:'pending',created_at:new Date().toISOString()};orders.push(order);return Response.json([order]);
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
const choosePlan=async(index)=>{const el=document.querySelectorAll('.taza-offer-card')[index];assert.ok(el,'plan '+index);await act(async()=>el.click());};
const fill=async(selector,value)=>act(async()=>{const el=document.querySelector(selector);assert.ok(el,selector);Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
const login=async()=>{await fill('#user-phone','99112233');await fill('#user-pin','1234');await act(async()=>document.querySelector('.login-dialog form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));};
const enterPhone=async(phone='99112233')=>{await fill('#phone-unlock-input',phone);await act(async()=>document.querySelector('#phone-unlock-input').closest('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));};
const pop=async(url,state={page:'home'})=>act(async()=>{window.history.replaceState(state,'',url);window.dispatchEvent(new dom.window.PopStateEvent('popstate',{state}));});
const movie=()=>document.querySelector('.full-player video')?.getAttribute('src');
const title=()=>document.querySelector('#selected-film-title')?.textContent;
const confirmSubscription=async()=>{
 assert.equal(orders.length,1,'payment order must exist before bank confirmation');
 const order=orders[0];
 assert.ok((order.plan==='pick_2_30d_5000'&&order.amount===5000)||(order.plan==='all_30d_9000'&&order.amount===9000));
 order.status='confirmed';
 if(order.plan==='pick_2_30d_5000')credits+=2;else entitled=true;
 await act(async()=>{window.dispatchEvent(new dom.window.Event('focus'));await new Promise(resolve=>setTimeout(resolve,10));});

};

test('TAZA full watch opens exactly two 2/45 movie options',async()=>{
 await render('/?film=7&fbclid=tracking');
 assert.equal(title(),'Гэрэл');await click('.film-hero-watch');
 assert.equal(document.querySelectorAll('.taza-offer-card').length,2);
 const text=document.querySelector('.taza-offer-dialog').textContent;
 for(const part of ['2 кино','5,000₮','45 кино бүгд','9,000₮','200₮'])assert.ok(text.includes(part),part);
 assert.equal(document.querySelector('#phone-unlock-input'),null);
 assert.equal(orders.length,0);
});
test('TAZA shows no phone registration or PIN when an unpaid visitor checks access',async()=>{
 await render('/?film=7');
 assert.equal(document.querySelector('#user-phone'),null);
 assert.equal(document.querySelector('#user-pin'),null);
 await click('.film-hero-watch');
 const restore=document.querySelector('.taza-offer-restore');
 assert.ok(restore);
 assert.match(restore.textContent,/Эрхээ шалгах/);
 await act(async()=>restore.click());
 assert.equal(document.querySelector('.login-dialog'),null);
 assert.equal(document.querySelector('#user-pin'),null);
 assert.match(document.querySelector('.app-alert')?.textContent||'',/төлсөн|браузер/i);
 assert.equal(requests.filter(r=>r.path==='/api/auth'&&r.method==='POST').length,0);
 assert.equal(orders.length,0);
});
test('paid device checks access without a phone number or PIN',async()=>{
 session={user:{id:12,phone:'',guest:true}};entitled=true;
 await render('/');
 const check=[...document.querySelectorAll('.footer-links button')].find(el=>el.textContent.includes('Төлсөн эрхээ шалгах'));
 assert.ok(check);
 await act(async()=>check.click());
 assert.match(document.querySelector('.app-notice')?.textContent||'',/эрх олдлоо/);
 assert.equal(document.querySelector('.login-dialog'),null);
 assert.equal(requests.filter(r=>r.path==='/api/auth'&&r.method==='POST').length,0);
 assert.equal(orders.length,0);
});
test('all 45 films create a 9,000₮ six-digit pending order',async()=>{
 await render('/?film=7');await click('.film-hero-watch');await choosePlan(1);
 assert.equal(orders.length,1);
 assert.equal(orders[0].plan,'all_30d_9000');
 assert.equal(orders[0].amount,9000);
 assert.match(orders[0].ref_code,/^\d{6}$/);
 assert.ok(document.querySelector('.wallet-single-ref'));
 assert.equal(movie(),undefined);
});
test('2 movies create 5,000₮ pending order without phone entry',async()=>{
 await render('/?film=7');await click('.film-hero-watch');await choosePlan(0);
 assert.equal(orders.length,1);
 assert.equal(orders[0].plan,'pick_2_30d_5000');
 assert.equal(orders[0].amount,5000);
 assert.match(orders[0].ref_code,/^\d{6}$/);
 assert.equal(document.querySelector('#phone-unlock-input'),null);
 assert.equal(movie(),undefined);
});
test('missing trailer never falls back to a private movie, and a failed trailer can be closed',async()=>{
 const preview=films[0].preview_url;films[0].preview_url='';
 try {await render('/?film=7');assert.equal(document.querySelector('.detail-poster').disabled,true);await click('.detail-poster');assert.equal(document.querySelector('video'),null);}finally{films[0].preview_url=preview;}
 await pop('/?film=34');
 if(document.querySelector('.detail-poster'))await click('.detail-poster');
 const trailer=document.querySelector('video[data-trailer]');assert.ok(trailer,'trailer auto-opens when a preview exists');
 await act(async()=>trailer.dispatchEvent(new dom.window.Event('error')));
 assert.ok(document.querySelector('.trailer-error'));await click('.trailer-close');assert.ok(document.querySelector('.detail-poster'));assert.equal(document.querySelector('video'),null);
});
test('related film full watch presents both packages',async()=>{
 const original=films.length;
 films.push({id:8,title:'Найз',badge:'Хэлтэй|Гадаад',views:50},{id:9,title:'Салхи',badge:'Хадмал|Гадаад',views:200},{id:10,title:'Зам',badge:'Хэлтэй|Гадаад',views:100},{id:11,title:'Уул',badge:'Хэлтэй|Гадаад',views:80});
 try{
   await render('/?film=7&fbclid=tracking');
   assert.deepEqual([...document.querySelectorAll('.related-film h3')].map(x=>x.textContent),['Салхи','Зам','Уул']);
   await click('.related-film');assert.equal(title(),'Салхи');
   await click('.film-hero-watch');
   assert.equal(document.querySelectorAll('.taza-offer-card').length,2);
   assert.equal(orders.length,0);
 }finally{films.splice(original);}
});
test('closing package choices creates no payment order',async()=>{
 await render('/?film=7');await click('.film-hero-watch');
 assert.equal(document.querySelectorAll('.taza-offer-card').length,2);
 assert.equal(orders.length,0);
 await click('[aria-label="Сонголт хаах"]');
 assert.equal(document.querySelector('.taza-offer-dialog'),null);
 assert.equal(requests.filter(r=>r.path==='/api/playback').length,1,'server checks rights before opening package choices');
});
test('leaving during a full movie request prevents its late result from opening a player',async()=>{
 session={user:{id:12,phone:'99112233'}};entitled=true;await render('/?film=34');playbackGate=defer();await click('.film-hero-watch');await click('.film-back');
 await act(async()=>playbackGate.resolve());assert.ok(document.querySelector('.catalog-browser'));assert.equal(movie(),undefined);
});
test('full player Back returns to the main page and stops playback',async()=>{
 session={user:{id:12,phone:'99112233'}};entitled=true;await render('/?film=34');await click('.film-hero-watch');assert.equal(movie(),films[1].url);
 const before=requests.filter(r=>r.path==='/api/playback').length;
 await click('[aria-label="Нүүр рүү буцах"]');
 assert.ok(document.querySelector('.site-header'));assert.equal(window.location.search,'');assert.equal(movie(),undefined);assert.equal(requests.filter(r=>r.path==='/api/playback').length,before);
});
test('45-film 9,000₮ pending order stays locked before SMS confirmation',async()=>{
 await render('/?film=7');await click('.film-hero-watch');await choosePlan(1);
 assert.equal(orders.length,1);
 assert.equal(orders[0].plan,'all_30d_9000');
 assert.equal(orders[0].amount,9000);
 assert.match(orders[0].ref_code,/^\d{6}$/);
 assert.equal(orders[0].status,'pending');
 assert.equal(movie(),undefined);
});
test('Facebook direct film link opens plans and six-digit checkout',async()=>{
 failCatalog=true;await render('/?utm_source=facebook&film=34&fbclid=tracking');
 assert.equal(title(),'Алсын зам');
 await click('.film-hero-watch');assert.equal(document.querySelectorAll('.taza-offer-card').length,2);
 await choosePlan(1);
 assert.equal(orders.length,1);
 assert.equal(orders[0].plan,'all_30d_9000');
 assert.equal(orders[0].amount,9000);
 assert.equal(movie(),undefined);
});
test('guest checkout waits for Safari identity restoration before opening purchase options',async()=>{
 authGate=defer();await render('/?film=7');
 assert.equal(document.querySelector('.film-hero-watch').disabled,true);
 assert.equal(document.querySelectorAll('.taza-offer-card').length,0);
 await act(async()=>authGate.resolve());
 assert.equal(document.querySelector('.film-hero-watch').disabled,false);
 await click('.film-hero-watch');
 assert.equal(document.querySelectorAll('.taza-offer-card').length,2);
 await choosePlan(0);
 assert.equal(orders.length,1);
 assert.equal(orders[0].amount,5000);
});
test('guest identity is created only after a package selection',async()=>{
 await render('/?film=7&fbclid=tracking');
 await click('.film-hero-watch');
 assert.equal(requests.some(r=>r.path==='/api/device'&&r.query!=='?recover=1'),false);
 await choosePlan(1);
 assert.equal(requests.some(r=>r.path==='/api/device'&&r.query!=='?recover=1'),true);
 assert.equal(orders.length,1);
 assert.equal(orders[0].plan,'all_30d_9000');
 assert.equal(movie(),undefined);
});
test('normal catalog movie selection also creates a reloadable direct link',async()=>{
 await render();await act(async()=>[...document.querySelectorAll('.movie-main')].find(b=>b.textContent.includes('Гэрэл')).click());
 assert.equal(title(),'Гэрэл');assert.equal(window.location.search,'?film=7');
 await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(App)));
 assert.equal(title(),'Гэрэл');assert.equal(orders.length,0);
});
test('already-paid visitor clicking the package banner never gets a second bank order',async()=>{
 session={user:{id:12,phone:'99112233'}};entitled=true;
 await render();
 await click('.header-nav button');
 assert.equal(document.querySelectorAll('.taza-offer-card').length,2);
 await choosePlan(1);
 assert.equal(orders.length,0,'active all-film entitlement should skip checkout');
 assert.match(document.querySelector('.app-notice')?.textContent||'',/эрх идэвхтэй.*Дахин төлбөр/);
 assert.equal(document.querySelector('.checkout-dialog'),null);
});
test('existing paid member can watch without another order',async()=>{
 session={user:{id:12,phone:'99112233'}};entitled=true;
 await render('/?film=7');
 assert.equal(title(),'Гэрэл');
 await click('.film-hero-watch');
 assert.equal(movie(),films[0].url);
 assert.equal(orders.length,0);
});

test('free movie detail never creates a device identity',async()=>{
 deviceGate=defer();
 await render('/?film=7');
 assert.equal(requests.filter(r=>r.path==='/api/device'&&r.query!=='?recover=1').length,0);
 await click('.film-back');
 assert.ok(document.querySelector('.catalog-browser'));
 assert.equal(orders.length,0);
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
 session={user:{id:12,phone:'99112233'}};entitled=true;failPlayback=true;await render('/?film=34');await click('.film-hero-watch');assert.ok(document.querySelector('.detail-watch-error'));
 failPlayback=false;await click('.film-hero-watch');assert.equal(movie(),films[1].url);
});
test('back and forward select films without checkout',async()=>{
 await render('/?film=7');
 assert.equal(title(),'Гэрэл');
 assert.equal(document.querySelector('.checkout-inline'),null);
 await pop('/',{page:'home'});assert.ok(document.querySelector('.catalog-browser'));
 await pop('/?film=34',{page:'film'});assert.equal(title(),'Алсын зам');
 await pop('/?film=7',{page:'film'});assert.equal(title(),'Гэрэл');
 assert.equal(orders.length,0);
});
test('admin session does not trigger a payment wall or new guest registration',async()=>{
 session={admin:true};
 await render('/?film=7');
 assert.equal(title(),'Гэрэл');
 assert.equal(document.querySelector('.checkout-inline'),null);
 assert.equal(document.querySelector('.login-dialog'),null);
 assert.equal(requests.some(r=>r.path==='/api/device'),false);
 assert.equal(orders.length,0);
});
test('an admin session previews full playback without replacing itself with a guest device',async()=>{
 session={admin:true};await render('/?film=34');assert.equal(title(),'Алсын зам');assert.equal(movie(),undefined);
 const beforeDevice=requests.filter(r=>r.path==='/api/device').length;
 await click('.film-hero-watch');assert.equal(document.querySelector('.login-dialog'),null);assert.equal(movie(),films[1].url);assert.equal(requests.filter(r=>r.path==='/api/device').length,beforeDevice);
 assert.equal(document.querySelector('.admin-surface'),null);
});
test('home header offers 2/45 and waits for deliberate package selection',async()=>{
 await render('/');await click('.header-nav button');
 assert.equal(document.querySelectorAll('.taza-offer-card').length,2);
 const text=document.querySelector('.taza-offer-dialog').textContent;
 for(const part of ['2 кино','5,000₮','45 кино бүгд','9,000₮','200₮'])assert.ok(text.includes(part),part);
 assert.equal(orders.length,0);
 await click('.taza-offer-featured');
 assert.equal(orders.length,1);
 assert.equal(orders[0].plan,'all_30d_9000');
 assert.equal(orders[0].amount,9000);
 assert.ok(document.querySelector('.wallet-single-ref'));
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
 session={user:{id:12,phone:'99112233'}};entitled=true;await render('/?film=34');await click('.film-hero-watch');assert.equal(movie(),films[1].url);
 await traverse('back');assert.ok(document.querySelector('.site-header'));assert.equal(movie(),undefined);assert.equal(window.location.search,'');
 const before=requests.filter(r=>r.path==='/api/playback').length;
 await traverse('forward');assert.equal(title(),'Алсын зам');assert.equal(movie(),undefined);assert.equal(requests.filter(r=>r.path==='/api/playback').length,before);
});
test('native Back after paid playback reaches the homepage without another checkout',async()=>{
 session={user:{id:12,phone:'99112233'}};entitled=true;
 await render('/?film=7');
 await click('.film-hero-watch');
 assert.equal(movie(),films[0].url);
 assert.equal(orders.length,0);
 await traverse('back');
 assert.ok(document.querySelector('.site-header'));
 assert.equal(movie(),undefined);
 assert.equal(document.querySelector('.checkout-inline'),null);
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

test('bank details show 6-digit transfer reference after package selection',async()=>{
 await render('/?film=7&fbclid=ad');await click('.film-hero-watch');await choosePlan(0);
 assert.equal(orders.length,1);
 const text=document.body.textContent;
 assert.match(text,/Хаан банк/i);
 assert.match(text,/Т\.Жаргалбаяр/);
 assert.match(text,/5252017169/);
 assert.match(text,/Гүйлгээний утга/);
 assert.match(text,new RegExp(orders[0].ref_code));
 assert.match(text,/5,000₮/);
 assert.equal(document.querySelector('#phone-unlock-input'),null);
});