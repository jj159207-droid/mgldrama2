import fs from 'node:fs';
function replaceOnce(text, oldText, newText, label) {
  const count=text.split(oldText).length-1;
  if(count!==1)throw new Error(`${label}: expected 1 anchor, found ${count}`);
  return text.replace(oldText,newText);
}
const path='tests/ui/movie-details.test.cjs';
let text=fs.readFileSync(path,'utf8');
text=replaceOnce(text,
`let root,session,entitled,orders,requests,failCatalog,failPlayback,authGate,filmGate,loginGate,playbackGate,clipboard;`,
`let root,session,entitled,orders,requests,failCatalog,failPlayback,authGate,filmGate,loginGate,deviceGate,playbackGate,clipboard;`,
'device gate declaration');
text=replaceOnce(text,
` session={};entitled=false;orders=[];requests=[];failCatalog=false;failPlayback=false;authGate=null;filmGate=null;loginGate=null;playbackGate=null;clipboard=[];`,
` session={};entitled=false;orders=[];requests=[];failCatalog=false;failPlayback=false;authGate=null;filmGate=null;loginGate=null;deviceGate=null;playbackGate=null;clipboard=[];`,
'device gate reset');
text=replaceOnce(text,
`  if(url.pathname==='/api/device'){
   if(session.admin)return Response.json({admin:true,user:null});
   if(!session.user)session={user:{id:12,phone:'',user_id:'GTESTDEVICE',guest:true}};
   return Response.json(session);
  }`,
`  if(url.pathname==='/api/device'){
   if(deviceGate)await deviceGate.promise;
   if(session.admin)return Response.json({admin:true,user:null});
   if(!session.user)session={user:{id:12,phone:'',user_id:'GTESTDEVICE',guest:true}};
   return Response.json(session);
  }`,
'device gate fixture');
text=replaceOnce(text,
`test('closing login and leaving prevents a late login response reopening purchase',async()=>{
 await render('/?film=7');await click('.film-continue');loginGate=defer();await login();
 await click('[aria-label="Нэвтрэх цонх хаах"]');await click('.film-back');
 await act(async()=>loginGate.resolve());assert.equal(window.location.search,'');assert.ok(document.querySelector('.catalog-browser'));assert.equal(orders.length,0);assert.equal(movie(),undefined);
});`,
`test('leaving while device identity is being created prevents a late guest purchase',async()=>{
 deviceGate=defer();await render('/?film=7');await click('.film-continue');await click('.film-back');
 await act(async()=>deviceGate.resolve());assert.equal(window.location.search,'');assert.ok(document.querySelector('.catalog-browser'));assert.equal(orders.length,0);assert.equal(movie(),undefined);
});`,
'late guest navigation regression');
text=replaceOnce(text,
`test('an admin session cannot bypass the public user login gate for full playback',async()=>{
 session={admin:true};await render('/?film=34');assert.equal(title(),'Алсын зам');assert.equal(movie(),undefined);
 const before=requests.filter(r=>r.path==='/api/playback').length;
 await click('.film-continue');assert.ok(document.querySelector('.login-dialog'));assert.equal(movie(),undefined);assert.equal(requests.filter(r=>r.path==='/api/playback').length,before);
 assert.equal(document.querySelector('.admin-surface'),null);
});`,
`test('an admin session previews full playback without replacing itself with a guest device',async()=>{
 session={admin:true};await render('/?film=34');assert.equal(title(),'Алсын зам');assert.equal(movie(),undefined);
 const beforeDevice=requests.filter(r=>r.path==='/api/device').length;
 await click('.film-continue');assert.equal(document.querySelector('.login-dialog'),null);assert.equal(movie(),films[1].url);assert.equal(requests.filter(r=>r.path==='/api/device').length,beforeDevice);
 assert.equal(document.querySelector('.admin-surface'),null);
});`,
'admin playback regression');
text=replaceOnce(text,
`test('package purchase after login remains a package without a movie ID',async()=>{
 await render();await click('.package-continue');await login();
 assert.ok(document.querySelector('.checkout-dialog'));assert.equal(orders.length,1);assert.equal(orders[0].film_id,null);assert.equal(orders[0].plan,'gadaad_3day');assert.equal(window.location.search,'');
});`,
`test('package purchase creates a guest device and remains a package without a movie ID',async()=>{
 await render();await click('.package-continue');
 assert.equal(document.querySelector('.login-dialog'),null);assert.ok(document.querySelector('.checkout-dialog'));assert.equal(orders.length,1);assert.equal(orders[0].film_id,null);assert.equal(orders[0].plan,'gadaad_3day');assert.equal(window.location.search,'');
});`,
'guest package regression');
fs.writeFileSync(path,text);
console.log('Guest device race and admin UI tests updated.');
