import fs from 'node:fs';

function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 anchor, found ${count}`);
  return text.replace(oldText, newText);
}

// Server session: allow a long-lived device session and expose only a safe guest marker.
{
  const path='lib/server.ts';
  let text=fs.readFileSync(path,'utf8');
  text=replaceOnce(text,
`export async function issueSession(req:NextRequest,userId:number|null,admin:boolean) {
  await revokeSession(req);
  const token=randomBytes(32).toString('hex'),age=admin?3600:604800;`,
`export async function issueSession(req:NextRequest,userId:number|null,admin:boolean,ageOverride?:number) {
  await revokeSession(req);
  const token=randomBytes(32).toString('hex'),age=ageOverride ?? (admin?3600:604800);`,
'optional session age');
  text=replaceOnce(text,
`export function publicUser(user:Row) {
  return {id:user.id,phone:user.phone,user_id:user.user_id || \`#\${String(user.id).padStart(6,'0')}\`};
}`,
`export function publicUser(user:Row) {
  const guest=user.is_guest===true;
  return {id:user.id,phone:guest?'':user.phone,user_id:user.user_id || \`#\${String(user.id).padStart(6,'0')}\`,guest};
}`,
'guest public user');
  fs.writeFileSync(path,text);
}

// Existing sessions restore guest identity as well as registered identity.
{
  const path='app/api/auth/route.ts';
  let text=fs.readFileSync(path,'utf8');
  text=replaceOnce(text,'select=id,phone,user_id`','select=id,phone,user_id,is_guest`','auth guest select');
  fs.writeFileSync(path,text);
}

// Public guest/device session endpoint. The secret token stays HttpOnly; the browser never receives it in JS.
fs.mkdirSync('app/api/device',{recursive:true});
fs.writeFileSync('app/api/device/route.ts',`import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { ApiError, db, fail, issueSession, json, originCheck, pinHash, publicUser, session, setSessionCookie } from '@/lib/server';
export const runtime='nodejs';
const DEVICE_SESSION_AGE=365*24*60*60;

export async function POST(req:NextRequest) {
  try {
    originCheck(req);
    const current=await session(req);
    if(current?.admin)return json({admin:true,user:null});
    if(current?.userId){
      const [existing]=await db(\`users?id=eq.\${current.userId}&select=id,phone,user_id,is_guest&limit=1\`);
      if(existing)return json({user:publicUser(existing)});
    }
    for(let attempt=0;attempt<5;attempt++){
      const code=randomBytes(6).toString('hex').toUpperCase();
      try {
        const [user]=await db('users','POST',{
          phone:\`guest-\${code.toLowerCase()}\`,
          pin:pinHash(randomBytes(18).toString('hex')),
          user_id:\`G\${code}\`,
          is_guest:true,
          failed_attempts:0,
        });
        if(!user || typeof user.id!=='number')throw new ApiError(502,'Төхөөрөмжийг бүртгэж чадсангүй.');
        const issued=await issueSession(req,user.id,false,DEVICE_SESSION_AGE);
        return setSessionCookie(json({user:publicUser(user)}),issued.token,issued.age);
      } catch(error) {
        if(error instanceof ApiError && error.code==='23505')continue;
        throw error;
      }
    }
    throw new ApiError(503,'Төхөөрөмжийн дугаар үүсгэж чадсангүй. Дахин оролдоно уу.');
  } catch(error) {return fail(error);}
}
`);

// Chat search accepts guest codes such as G12AB... in addition to phone numbers.
{
  const path='app/api/chat/route.ts';
  let text=fs.readFileSync(path,'utf8');
  text=replaceOnce(text,"!/^[\\d #]*$/.test(search)","!/^[A-Za-z0-9 #_-]*$/.test(search)",'chat guest search validation');
  fs.writeFileSync(path,text);
}
{
  const path='app/components/SupportChat.tsx';
  let text=fs.readFileSync(path,'utf8');
  text=replaceOnce(text,
`<label className="chat-search"><span>Утас / хэрэглэгчийн дугаар</span><input type="search" inputMode="numeric" placeholder="Дугаараар хайх…" value={search} onChange={e => setSearch(e.target.value.replace(/[^\\d #]/g, '').slice(0,30))} /></label>`,
`<label className="chat-search"><span>Утас / төхөөрөмжийн код</span><input type="search" placeholder="Утас эсвэл G кодоор хайх…" value={search} onChange={e => setSearch(e.target.value.replace(/[^A-Za-z0-9 #_-]/g, '').slice(0,30))} /></label>`,
'admin guest search UI');
  fs.writeFileSync(path,text);
}

// DB API may return the guest marker to admin screens, while public user lists remain blocked.
{
  const path='app/api/db/route.ts';
  let text=fs.readFileSync(path,'utf8');
  text=replaceOnce(text,"query.set('select','id,phone,user_id,created_at');","query.set('select','id,phone,user_id,is_guest,created_at');",'users guest select');
  fs.writeFileSync(path,text);
}

// Main public flow: payment/contact create a guest device identity automatically instead of forcing registration.
{
  const path='app/page.tsx';
  let text=fs.readFileSync(path,'utf8');
  text=replaceOnce(text,
`<button type="button" className="primary-button package-continue" disabled={countsReady && selectedCount === 0} onClick={select}>{user ? "Төлбөр төлөх" : "Нэвтрээд үргэлжлүүлэх"}</button>`,
`<button type="button" className="primary-button package-continue" disabled={countsReady && selectedCount === 0} onClick={select}>Төлбөр төлөх</button>`,
'package direct payment copy');
  text=replaceOnce(text,
`{user ? <><span className="account-label"><UiIcon name="user" size={16} />{user.phone}</span><button className="quiet-button" onClick={onLogout}>Гарах</button></> : <button className="primary-button login-button" onClick={openLogin}><UiIcon name="user" size={17} />Нэвтрэх</button>}`,
`{user && !user.guest ? <><span className="account-label"><UiIcon name="user" size={16} />{user.phone}</span><button className="quiet-button" onClick={onLogout}>Гарах</button></> : !user ? <button className="primary-button login-button" onClick={openLogin}><UiIcon name="user" size={17} />Нэвтрэх</button> : null}`,
'hide synthetic guest account');
  text=replaceOnce(text,
`  const [accessMap, setAccessMap] = useState<Record<string, number>>({});
  const accessOwner = useRef<number | null>(null);`,
`  const [accessMap, setAccessMap] = useState<Record<string, number>>({});
  const accessOwner = useRef<number | null>(null);
  const deviceRequest = useRef<Promise<any> | null>(null);`,
'device request lock');
  text=replaceOnce(text,
`  const syncAccessFromDB = async (userId: number) => {
    const data=await requestJson("/api/access",{},true);
    if(accessOwner.current===userId)setAccessMap(data.access || {});
  };

  useEffect(() => {`,
`  const syncAccessFromDB = async (userId: number) => {
    const data=await requestJson("/api/access",{},true);
    if(accessOwner.current===userId)setAccessMap(data.access || {});
  };

  const ensureDeviceUser = async () => {
    if(user?.id)return user;
    if(adminAuth)return null;
    if(deviceRequest.current)return deviceRequest.current;
    const pending=requestJson("/api/device",{method:"POST",body:"{}"},true).then(async data=>{
      if(!data?.user?.id)throw new Error("Төхөөрөмжийг таньж чадсангүй. Дахин оролдоно уу.");
      accessOwner.current=data.user.id;setUser(data.user);
      try{await syncAccessFromDB(data.user.id);}catch{}
      return data.user;
    });
    deviceRequest.current=pending;
    try{return await pending;}finally{if(deviceRequest.current===pending)deviceRequest.current=null;}
  };

  useEffect(() => {`,
'ensure guest device');

  const oldWatch=`  const watchFilm = async (film: FilmDetails, viewerId: number | null) => {
    // Public full playback always requires a normal user login. An existing
    // hidden admin session must not bypass the public Login/Register gate.
    if(!viewerId){
      pendingActionRef.current={kind:"watch",film};
      setWatching(false);setWatchError("");setShowLoginModal(true);
      return;
    }
    const intent=playRequest.current+1;
    const current=()=>intent===playRequest.current && accessOwner.current===viewerId;
    setWatching(true);setWatchError("");
    try {
      if(await playFilm(film,()=>accessOwner.current===viewerId))setPayFilm(null);
    } catch(error) {
      if(!current())return;
      if(error instanceof RequestError && error.status===403){
        if(!viewerId){pendingActionRef.current={kind:"watch",film};setShowLoginModal(true);return;}
        setPayFilm({...film,returnFilm:film});setPage("film");
      } else setWatchError(error instanceof Error?error.message:"Кино нээж чадсангүй. Дахин оролдоно уу.");
    } finally {if(current())setWatching(false);}
  };
  const continueFilm = () => {
    if(!selectedFilm || filmOpening || watching || !authReady)return;
    void watchFilm(selectedFilm,user?.id || null);
  };`;
  const newWatch=`  const watchFilm = async (film: FilmDetails) => {
    const startedAt=playRequest.current;
    setWatching(true);setWatchError("");
    if(adminAuth && !user){
      try {if(await playFilm(film))setPayFilm(null);}
      catch(error){setWatchError(error instanceof Error?error.message:"Кино нээж чадсангүй. Дахин оролдоно уу.");}
      finally{setWatching(false);}
      return;
    }
    let viewer=user;
    try {
      if(!viewer)viewer=await ensureDeviceUser();
      if(!viewer)throw new Error("Төхөөрөмжийг таньж чадсангүй.");
      if(startedAt!==playRequest.current)return;
      const viewerId=Number(viewer.id),intent=playRequest.current+1;
      const current=()=>intent===playRequest.current && accessOwner.current===viewerId;
      try {
        if(await playFilm(film,()=>accessOwner.current===viewerId))setPayFilm(null);
      } catch(error) {
        if(!current())return;
        if(error instanceof RequestError && error.status===403){setPayFilm({...film,returnFilm:film});setPage("film");}
        else setWatchError(error instanceof Error?error.message:"Кино нээж чадсангүй. Дахин оролдоно уу.");
      }
    } catch(error) {setWatchError(error instanceof Error?error.message:"Төхөөрөмжийг таньж чадсангүй. Дахин оролдоно уу.");}
    finally{setWatching(false);}
  };
  const continueFilm = () => {
    if(!selectedFilm || filmOpening || watching || !authReady)return;
    void watchFilm(selectedFilm);
  };`;
  text=replaceOnce(text,oldWatch,newWatch,'guest watch flow');

  text=replaceOnce(text,
`  const handlePlanSelect = (plan: string, sourceFilm: FilmDetails | null = null) => {
    if (!user) {pendingActionRef.current={kind:"plan",plan,film:sourceFilm};setShowLoginModal(true);return;}
    openPlanCheckout(plan,sourceFilm);
  };`,
`  const handlePlanSelect = async (plan: string, sourceFilm: FilmDetails | null = null) => {
    try {
      if(!user && !adminAuth)await ensureDeviceUser();
      if(adminAuth && !user){setAppError("Багц авахын тулд админ горимоос гарна уу.");return;}
      openPlanCheckout(plan,sourceFilm);
    } catch(error) {setAppError(error instanceof Error?error.message:"Төхөөрөмжийг таньж чадсангүй.");}
  };
  const openContact = async () => {
    try {
      if(!adminAuth && !user)await ensureDeviceUser();
      window.history.pushState({page:"contact"},"");setShowContact(true);
    } catch(error) {setAppError(error instanceof Error?error.message:"Холбогдох хэсгийг нээж чадсангүй.");}
  };`,
'guest plan and contact flow');
  text=replaceOnce(text,
`onMonthly={handlePlanSelect} onContact={() => { window.history.pushState({ page: "contact" }, ""); setShowContact(true); }} accessMap={accessMap}`,
`onMonthly={handlePlanSelect} onContact={openContact} accessMap={accessMap}`,
'guest contact handler');

  // Keep hidden guest identities out of the normal registered-member list.
  text=replaceOnce(text,
`      setUsers(Array.isArray(us) ? us : []);
      setFilms(Array.isArray(fl) ? fl : []);
      setAllPayments(Array.isArray(pay) ? pay : []);`,
`      setUsers(Array.isArray(us) ? us.filter((u:any)=>u.is_guest!==true) : []);
      setFilms(Array.isArray(fl) ? fl : []);
      setAllPayments(Array.isArray(pay) ? pay.filter((p:any)=>!us.find((u:any)=>u.id===p.user_id)?.is_guest) : []);`,
'registered members only');
  fs.writeFileSync(path,text);
}

// Base install schema and additive production migration.
{
  const path='supabase/setup.sql';
  let text=fs.readFileSync(path,'utf8');
  text=replaceOnce(text,
` id bigint generated by default as identity primary key, phone text unique not null,
 pin text not null, user_id text unique not null, failed_attempts integer default 0,`,
` id bigint generated by default as identity primary key, phone text unique not null,
 pin text not null, user_id text unique not null, is_guest boolean not null default false, failed_attempts integer default 0,`,
'setup guest column create');
  text=replaceOnce(text,
`alter table public.users add column if not exists failed_attempts integer default 0;`,
`alter table public.users add column if not exists is_guest boolean not null default false;
alter table public.users add column if not exists failed_attempts integer default 0;`,
'setup guest column alter');
  fs.writeFileSync(path,text);
}
fs.mkdirSync('supabase/migrations',{recursive:true});
fs.writeFileSync('supabase/migrations/20260917071000_guest_device_access.sql',`set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.users add column if not exists is_guest boolean not null default false;
create index if not exists kino_users_guest_created on public.users(created_at) where is_guest;

-- Keep the existing inbox contract, but give anonymous devices a safe, readable label.
create or replace function public.kino_chat_inbox(p_search text default '',p_offset integer default 0)
returns table(user_id bigint,phone text,label text,message text,has_image boolean,sender text,updated_at timestamptz,unread bigint)
language sql stable security invoker set search_path = '' as $$
 select t.user_id,
   case when u.is_guest then 'Төхөөрөмж '||coalesce(u.user_id,'#'||u.id::text) else u.phone end,
   u.user_id,m.message,m.has_image,m.sender,t.updated_at,
   (select count(*) from public.support_messages n where n.user_id=t.user_id and n.sender='user' and n.read_at is null)
 from public.support_threads t join public.users u on u.id=t.user_id
 join lateral (select s.message,s.has_image,s.sender from public.support_messages s where s.user_id=t.user_id order by s.id desc limit 1) m on true
 where p_search='' or position(lower(p_search) in lower(coalesce(u.phone,'')))>0 or position(lower(p_search) in lower(coalesce(u.user_id,'')))>0
 order by t.updated_at desc,t.user_id desc limit 51 offset greatest(0,least(p_offset,1000000));
$$;
revoke all on function public.kino_chat_inbox(text,integer) from public,anon,authenticated;
grant execute on function public.kino_chat_inbox(text,integer) to service_role;
notify pgrst,'reload schema';
`);

// UI regression: anonymous device goes directly to payment/playback without Login/Register.
{
  const path='tests/ui/movie-details.test.cjs';
  let text=fs.readFileSync(path,'utf8');
  text=replaceOnce(text,
`  if(url.pathname==='/api/access')return Response.json({access:entitled?{film_7:Date.now()+86400000}:{}});`,
`  if(url.pathname==='/api/device'){
   if(session.admin)return Response.json({admin:true,user:null});
   if(!session.user)session={user:{id:12,phone:'',user_id:'GTESTDEVICE',guest:true}};
   return Response.json(session);
  }
  if(url.pathname==='/api/access')return Response.json({access:entitled?{film_7:Date.now()+86400000}:{}});`,
'device fixture');
  text=replaceOnce(text,
` await click('.film-continue');assert.equal(document.querySelector('video[data-trailer]'),null);assert.ok(document.querySelector('.login-dialog'));assert.equal(movie(),undefined);`,
` await click('.film-continue');assert.equal(document.querySelector('video[data-trailer]'),null);assert.equal(document.querySelector('.login-dialog'),null);assert.ok(document.querySelector('#film-payment .checkout-inline'));assert.equal(orders.length,1);assert.equal(movie(),undefined);`,
'paid guest direct checkout assertion');
  text=replaceOnce(text,
` await render('/?film=7');await click('[aria-label="Гадаад 30 хоногийн багц авах"]');assert.equal(orders.length,0);assert.ok(document.querySelector('.login-dialog'));
 await login();assert.equal(title(),'Гэрэл');assert.ok(document.querySelector('#film-payment .checkout-inline'));assert.equal(document.querySelector('.checkout-dialog'),null);`,
` await render('/?film=7');await click('[aria-label="Гадаад 30 хоногийн багц авах"]');assert.equal(document.querySelector('.login-dialog'),null);
 assert.equal(title(),'Гэрэл');assert.ok(document.querySelector('#film-payment .checkout-inline'));assert.equal(document.querySelector('.checkout-dialog'),null);`,
'package guest direct checkout');
  text=replaceOnce(text,
`test('Facebook link shows details but requires login before even a free full movie',async()=>{
 failCatalog=true;await render('/?utm_source=facebook&film=34&fbclid=tracking');
 assert.equal(title(),'Алсын зам');assert.equal(movie(),undefined);
 const before=requests.filter(r=>r.path==='/api/playback').length;
 await click('.film-continue');assert.ok(document.querySelector('.login-dialog'));assert.equal(movie(),undefined);assert.equal(requests.filter(r=>r.path==='/api/playback').length,before);
 await login();assert.equal(movie(),films[1].url);assert.equal(orders.length,0);
 assert.equal(new URL(window.location.href).searchParams.get('film'),'34');
});`,
`test('Facebook link creates a device session and opens a free full movie without registration',async()=>{
 failCatalog=true;await render('/?utm_source=facebook&film=34&fbclid=tracking');
 assert.equal(title(),'Алсын зам');assert.equal(movie(),undefined);
 await click('.film-continue');assert.equal(document.querySelector('.login-dialog'),null);assert.equal(movie(),films[1].url);assert.equal(orders.length,0);
 assert.ok(requests.some(r=>r.path==='/api/device'));
 assert.equal(new URL(window.location.href).searchParams.get('film'),'34');
});`,
'free guest playback test');
  text=replaceOnce(text,
`test('guest sees selected title, logs in, pays for that film and watches it',async()=>{
 await render('/?film=7&fbclid=tracking');assert.equal(title(),'Гэрэл');assert.equal(orders.length,0);assert.equal(movie(),undefined);
 await click('.film-continue');assert.match(document.querySelector('.login-dialog').textContent,/Үргэлжлүүлэх кино: Гэрэл/);
 await login();assert.ok(document.querySelector('#film-payment .checkout-inline'));assert.equal(orders.length,1);assert.equal(orders[0].film_id,7);assert.equal(orders[0].plan,'single');
 orders[0].status='confirmed';entitled=true;
 await act(async()=>[...document.querySelectorAll('.checkout-back')].find(b=>b.textContent==='Төлбөрөө шалгах').click());
 assert.equal(movie(),films[0].url);assert.equal(orders.length,1);assert.equal(new URL(window.location.href).searchParams.get('film'),'7');
});`,
`test('guest device pays for the selected film without registration and keeps the same entitlement owner',async()=>{
 await render('/?film=7&fbclid=tracking');assert.equal(title(),'Гэрэл');assert.equal(orders.length,0);assert.equal(movie(),undefined);
 await click('.film-continue');assert.equal(document.querySelector('.login-dialog'),null);assert.ok(document.querySelector('#film-payment .checkout-inline'));assert.equal(orders.length,1);assert.equal(orders[0].film_id,7);assert.equal(orders[0].plan,'single');
 orders[0].status='confirmed';entitled=true;
 await act(async()=>[...document.querySelectorAll('.checkout-back')].find(b=>b.textContent==='Төлбөрөө шалгах').click());
 assert.equal(movie(),films[0].url);assert.equal(orders.length,1);assert.equal(new URL(window.location.href).searchParams.get('film'),'7');
});`,
'guest paid flow test');
  fs.writeFileSync(path,text);
}

// API security regression for persistent anonymous device identity.
{
  const path='tests/security.test.ts';
  let text=fs.readFileSync(path,'utf8');
  text=replaceOnce(text,
`import * as auth from '../app/api/auth/route';`,
`import * as auth from '../app/api/auth/route';
import * as device from '../app/api/device/route';`,
'device api import');
  text=replaceOnce(text,
`test('logout revokes server token and forged cookie has no session',async()=>{
 const c=await register();await auth.POST(req('/api/auth','POST',{action:'logout'},c));assert.equal((await (await auth.GET(req('/api/auth','GET',undefined,c))).json()).user,null);
 assert.equal((await (await auth.GET(req('/api/auth','GET',undefined,'kino_session_v2='+'a'.repeat(64)))).json()).user,null);
});`,
`test('logout revokes server token and forged cookie has no session',async()=>{
 const c=await register();await auth.POST(req('/api/auth','POST',{action:'logout'},c));assert.equal((await (await auth.GET(req('/api/auth','GET',undefined,c))).json()).user,null);
 assert.equal((await (await auth.GET(req('/api/auth','GET',undefined,'kino_session_v2='+'a'.repeat(64)))).json()).user,null);
});
test('anonymous device gets one persistent guest identity and can own its payment',async()=>{
 const first=await device.POST(req('/api/device','POST',{}));assert.equal(first.status,200);
 const firstBody=await first.json();assert.equal(firstBody.user.guest,true);assert.equal(firstBody.user.phone,'');assert.match(firstBody.user.user_id,/^G[A-F0-9]{12}$/);
 const cookie=first.headers.get('set-cookie')!.split(';')[0];assert.equal(tables.users.length,1);assert.equal(tables.users[0].is_guest,true);
 const second=await device.POST(req('/api/device','POST',{},cookie));assert.equal(second.status,200);assert.equal((await second.json()).user.id,firstBody.user.id);assert.equal(tables.users.length,1);
 const order=await api.POST(dbReq('pending_payments','POST',{ref_code:'654321',film_id:1,plan:'single'},cookie));assert.equal(order.status,200);
 const saved=(await order.json())[0];assert.equal(saved.user_id,firstBody.user.id);assert.equal(saved.status,'pending');assert.equal(saved.amount,5000);
});`,
'device security regression');
  fs.writeFileSync(path,text);
}

console.log('Guest device payment, chat, and admin-grant flow patched.');
