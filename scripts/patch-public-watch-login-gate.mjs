import fs from 'node:fs';

function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 anchor, found ${count}`);
  return text.replace(oldText, newText);
}

const pagePath='app/page.tsx';
let page=fs.readFileSync(pagePath,'utf8');
page=replaceOnce(page,
`  const watchFilm = async (film: FilmDetails, viewerId: number | null) => {\n    const intent=playRequest.current+1;`,
`  const watchFilm = async (film: FilmDetails, viewerId: number | null) => {\n    // Public full playback always requires a normal user login. An existing\n    // hidden admin session must not bypass the public Login/Register gate.\n    if(!viewerId){\n      pendingActionRef.current={kind:"watch",film};\n      setWatching(false);setWatchError("");setShowLoginModal(true);\n      return;\n    }\n    const intent=playRequest.current+1;`,
'watchFilm login guard');
fs.writeFileSync(pagePath,page);

const testPath='tests/ui/movie-details.test.cjs';
let test=fs.readFileSync(testPath,'utf8');
test=replaceOnce(test,
`   if(!film.free && !session.admin && !(session.user && entitled))return Response.json({message:'Үзэх эрх байхгүй.'},{status:403});`,
`   if(!session.admin && !session.user)return Response.json({message:'Нэвтэрч орно уу.'},{status:403});\n   if(!film.free && !session.admin && !(session.user && entitled))return Response.json({message:'Үзэх эрх байхгүй.'},{status:403});`,
'mock playback guest guard');

test=replaceOnce(test,
`test('leaving during a full movie request prevents its late result from opening a player',async()=>{\n await render('/?film=34');playbackGate=defer();await click('.film-continue');await click('.film-back');`,
`test('leaving during a full movie request prevents its late result from opening a player',async()=>{\n session={user:{id:12,phone:'99112233'}};await render('/?film=34');playbackGate=defer();await click('.film-continue');await click('.film-back');`,
'leaving pending playback test');

test=replaceOnce(test,
`test('full player Back returns to the main page and stops playback',async()=>{\n await render('/?film=34');await click('.film-continue');assert.equal(movie(),films[1].url);`,
`test('full player Back returns to the main page and stops playback',async()=>{\n session={user:{id:12,phone:'99112233'}};await render('/?film=34');await click('.film-continue');assert.equal(movie(),films[1].url);`,
'full player back test');

test=replaceOnce(test,
`test('Facebook link shows the selected movie details even when catalog loading fails',async()=>{\n failCatalog=true;await render('/?utm_source=facebook&film=34&fbclid=tracking');\n assert.equal(title(),'Алсын зам');assert.equal(movie(),undefined);await click('.film-continue');assert.equal(movie(),films[1].url);assert.equal(orders.length,0);assert.equal(document.querySelector('.login-dialog'),null);\n assert.equal(new URL(window.location.href).searchParams.get('film'),'34');\n});`,
`test('Facebook link shows details but requires login before even a free full movie',async()=>{\n failCatalog=true;await render('/?utm_source=facebook&film=34&fbclid=tracking');\n assert.equal(title(),'Алсын зам');assert.equal(movie(),undefined);\n const before=requests.filter(r=>r.path==='/api/playback').length;\n await click('.film-continue');assert.ok(document.querySelector('.login-dialog'));assert.equal(movie(),undefined);assert.equal(requests.filter(r=>r.path==='/api/playback').length,before);\n await login();assert.equal(movie(),films[1].url);assert.equal(orders.length,0);\n assert.equal(new URL(window.location.href).searchParams.get('film'),'34');\n});`,
'Facebook guest free movie test');

test=replaceOnce(test,
`test('playback connection failure can be retried on the same direct link',async()=>{\n failPlayback=true;await render('/?film=34');await click('.film-continue');assert.ok(document.querySelector('.detail-watch-error'));`,
`test('playback connection failure can be retried on the same direct link',async()=>{\n session={user:{id:12,phone:'99112233'}};failPlayback=true;await render('/?film=34');await click('.film-continue');assert.ok(document.querySelector('.detail-watch-error'));`,
'playback retry test');

test=replaceOnce(test,
`test('an admin movie link shows details first and waits for explicit full playback',async()=>{\n session={admin:true};await render('/?film=7');assert.equal(title(),'Гэрэл');assert.equal(movie(),undefined);await click('.film-continue');assert.equal(movie(),films[0].url);assert.equal(document.querySelector('.admin-surface'),null);\n});`,
`test('an admin session cannot bypass the public user login gate for full playback',async()=>{\n session={admin:true};await render('/?film=34');assert.equal(title(),'Алсын зам');assert.equal(movie(),undefined);\n const before=requests.filter(r=>r.path==='/api/playback').length;\n await click('.film-continue');assert.ok(document.querySelector('.login-dialog'));assert.equal(movie(),undefined);assert.equal(requests.filter(r=>r.path==='/api/playback').length,before);\n assert.equal(document.querySelector('.admin-surface'),null);\n});`,
'admin session public watch test');

test=replaceOnce(test,
`test('native Back from full playback goes home; Forward requires another explicit play',async()=>{\n await render('/?film=34');await click('.film-continue');assert.equal(movie(),films[1].url);`,
`test('native Back from full playback goes home; Forward requires another explicit play',async()=>{\n session={user:{id:12,phone:'99112233'}};await render('/?film=34');await click('.film-continue');assert.equal(movie(),films[1].url);`,
'native back playback test');
fs.writeFileSync(testPath,test);
console.log('Applied public user-login gate and UI regression coverage.');
