'use client';
import { useEffect, useRef, useState } from 'react';
import { RequestError, requestJson } from '@/lib/client';

interface Film {id:number;title:string;badge:string}
interface GrantRequest {user:number;plan:string;film_id:number|null;request_id:string;label:string}
interface WalletRequest {user:number;amount:number;request_id:string}
const categories = [
  {key:'all',label:'Бүх кино'},
  {key:'gadaad',label:'Гадаад'},
  {key:'hyatad',label:'Хятад'},
  {key:'oros',label:'Орос'},
  {key:'erotic',label:'Эротик'},
];
const date = (value:number|string) => new Date(value).toLocaleString('mn-MN',{timeZone:'Asia/Ulaanbaatar',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});

export function ChatAdminActions({userId,phone,lastId,onChanged}: {userId:number;phone:string;lastId:number;onChanged:()=>void}) {
  const [panel,setPanel] = useState<'grant'|'wallet'|'clear'|null>(null), [busy,setBusy] = useState(false), [error,setError] = useState(''), [success,setSuccess] = useState('');
  const [films,setFilms] = useState<Film[]>([]), [access,setAccess] = useState<Record<string,number>>({}), [loaded,setLoaded] = useState(false);
  const [kind,setKind] = useState('single'), [category,setCategory] = useState('all'), [filmId,setFilmId] = useState(''), [search,setSearch] = useState('');
  const [pending,setPending] = useState<GrantRequest|null>(null), [attempted,setAttempted] = useState(false), [through,setThrough] = useState(0);
  const [walletBalance,setWalletBalance] = useState(0), [walletAmount,setWalletAmount] = useState(''), [walletPending,setWalletPending] = useState<WalletRequest|null>(null), [pushEnabled,setPushEnabled] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    if (panel !== 'grant') return;
    const controller = new AbortController();
    setLoaded(false);
    void requestJson(`/api/chat/access?user=${userId}`,{signal:controller.signal},true).then(data => {
      if (!controller.signal.aborted) {setFilms(data.films);setAccess(data.access);setLoaded(true);}
    }).catch(e => {if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Эрх ачаалсангүй.');});
    return () => controller.abort();
  },[panel,userId]);

  useEffect(() => {
    if(panel!=='wallet')return;
    const controller=new AbortController();
    void requestJson(`/api/chat/wallet?user=${userId}`,{signal:controller.signal},true).then(data=>{
      if(!controller.signal.aborted){setWalletBalance(Number(data.balance||0));setPushEnabled(data.pushEnabled===true);}
    }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Үлдэгдэл ачаалсангүй.');});
    return()=>controller.abort();
  },[panel,userId]);

  const prepare = () => {
    const film = films.find(f=>f.id===Number(filmId));
    if(kind==='single' && !film) {setError('Кино сонгоно уу.');return;}
    const plan = kind==='single' ? 'single' : category==='all' && kind==='3day' ? '3day' : `${category}_${kind}`;
    const label = kind==='single' ? `${film!.title} · 3 хоног` : `${categories.find(c=>c.key===category)!.label} · ${kind==='3day'?'3 хоног':'1 сар (30 хоног)'}`;
    setPending({user:userId,plan,film_id:kind==='single'?film!.id:null,request_id:crypto.randomUUID(),label});setError('');
  };

  const grant = async () => {
    if (!pending || lock.current) return;
    lock.current=true;setBusy(true);setAttempted(true);setError('');
    try {
      const {label,...body}=pending;
      const result=await requestJson('/api/chat/access',{method:'POST',body:JSON.stringify(body)},true);
      setSuccess(`${label} эрх нээгдлээ. Дуусах: ${date(result.grant.expires_at)}.`);
      setPanel(null);setPending(null);setAttempted(false);onChanged();
    } catch(e) {
      if (e instanceof RequestError && e.status>=400 && e.status<500) setAttempted(false);
      setError(e instanceof Error?e.message:'Эрх нээж чадсангүй.');
    }
    finally {lock.current=false;setBusy(false);}
  };

  const prepareWallet=()=>{
    const amount=Number(walletAmount.replace(/[^0-9]/g,''));
    if(!Number.isSafeInteger(amount)||amount<1000||amount>500000){setError('1,000₮-өөс 500,000₮ хүртэл дүн оруулна уу.');return;}
    setWalletPending({user:userId,amount,request_id:crypto.randomUUID()});setError('');
  };

  const creditWallet=async()=>{
    if(!walletPending||lock.current)return;
    lock.current=true;setBusy(true);setError('');
    try{
      const result=await requestJson('/api/chat/wallet',{method:'POST',body:JSON.stringify(walletPending)},true);
      const balance=Number(result?.credit?.balance||0);
      setWalletBalance(balance);
      setSuccess(`${walletPending.amount.toLocaleString()}₮ кино дансанд нэмэгдлээ. Шинэ үлдэгдэл: ${balance.toLocaleString()}₮.`);
      setWalletPending(null);setWalletAmount('');setPanel(null);onChanged();
    }catch(e){setError(e instanceof Error?e.message:'Мөнгө нэмж чадсангүй. Дахин шалгана уу.');}
    finally{lock.current=false;setBusy(false);}
  };

  const clear = async () => {
    if (lock.current) return;
    lock.current=true;setBusy(true);setError('');
    try {
      await requestJson('/api/chat',{method:'DELETE',body:JSON.stringify({user:userId,through})},true);
      setSuccess('Чатны мессеж, зургууд устлаа. Хэрэглэгчийн үзэх эрх хэвээр байна.');setPanel(null);onChanged();
    } catch(e) {setError(e instanceof Error?e.message:'Чат устгасангүй.');}
    finally {lock.current=false;setBusy(false);}
  };

  return <div className="chat-admin-actions">
    <div className="chat-action-bar">
      <button type="button" onClick={()=>{setPanel('grant');setError('');setSuccess('');}} disabled={busy || !!pending || !!walletPending}>＋ Эрх нээх</button>
      <button type="button" onClick={()=>{setPanel('wallet');setError('');setSuccess('');setWalletPending(null);}} disabled={busy || !!pending || !!walletPending}>💰 Мөнгө нэмэх</button>
      <button type="button" className="chat-delete" aria-label="Энэ чатыг устгах" disabled={!lastId || busy || !!pending || !!walletPending} onClick={()=>{setThrough(lastId);setPanel('clear');setError('');setSuccess('');}}>Чат устгах</button>
    </div>
    {success && <p className="chat-action-success" role="status">{success}</p>}

    {panel==='wallet' && <div className="chat-action-panel" aria-label="Хэрэглэгчийн кино дансанд мөнгө нэмэх">
      <strong>{phone} · кино данс цэнэглэх</strong>
      <p>Одоогийн үлдэгдэл: <b>{walletBalance.toLocaleString()}₮</b> · Push: <b>{pushEnabled?'асаалттай':'асаагаагүй'}</b></p>
      {walletPending ? <div className="chat-grant-confirm">
        <p><b>{walletPending.amount.toLocaleString()}₮</b> нэмэх үү?</p>
        <p>Нэмсний дараах үлдэгдэл ойролцоогоор <b>{(walletBalance+walletPending.amount).toLocaleString()}₮</b>. Чат мессеж заавал очно{pushEnabled?', push мэдэгдэл мөн очно.':', push мэдэгдэл авахыг хэрэглэгч асаагаагүй байна.'}</p>
        <button type="button" className="chat-primary" disabled={busy} onClick={()=>void creditWallet()}>{busy?'Нэмж байна…':'Баталгаажуулж мөнгө нэмэх'}</button>
        <button type="button" disabled={busy} onClick={()=>setWalletPending(null)}>Буцах</button>
      </div> : <>
        <label>Нэмэх мөнгөн дүн
          <input inputMode="numeric" value={walletAmount} onChange={e=>setWalletAmount(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="Жишээ: 13000" />
        </label>
        <small>1,000₮–500,000₮. Энэ нь борлуулалтын орлогод нэмэгдэхгүй, админы цэнэглэлт гэж тусдаа бүртгэгдэнэ.</small>
        <button type="button" className="chat-primary" onClick={prepareWallet}>Үргэлжлүүлэх</button>
        <button type="button" onClick={()=>setPanel(null)}>Хаах</button>
      </>}
    </div>}

    {panel==='grant' && <div className="chat-action-panel" aria-label="Хэрэглэгчийн эрх нээх">
      <strong>{phone} хэрэглэгчид эрх нээх</strong>
      {pending ? <div className="chat-grant-confirm"><p><b>{pending.label}</b></p><p>Эрх одооноос эхэлнэ. Чат мессеж заавал очно. Push мэдэгдэл нь хэрэглэгч мэдэгдлээ асаасан үед очно.</p>
        <button type="button" className="chat-primary" disabled={busy} onClick={()=>void grant()}>{busy?'Эрх нээж байна…':attempted?'Дахин шалгаж нээх':'Баталгаажуулж эрх нээх'}</button>
        {!attempted && <button type="button" disabled={busy} onClick={()=>setPending(null)}>Буцах</button>}
      </div> : <>
        {!loaded ? <p role="status">Эрх, кинонуудыг ачаалж байна…</p> : <>
          {Object.keys(access).length>0 && <details className="chat-current-access"><summary>Одоо байгаа үзэх эрх</summary><ul>{Object.entries(access).map(([key,expires])=><li key={key}>{key.startsWith('film_')?(films.find(f=>f.id===Number(key.slice(5)))?.title||'Кино'):key==='monthly'?'Бүх кино':categories.find(c=>key===`cat_${c.key}`)?.label||key} — {date(expires)} хүртэл</li>)}</ul></details>}
          <div className="chat-grant-kinds" role="group" aria-label="Эрхийн төрөл">{[{key:'single',label:'Нэг кино'},{key:'3day',label:'3 хоног'},{key:'1month',label:'1 сар'}].map(k=><button type="button" key={k.key} aria-pressed={kind===k.key} onClick={()=>{setKind(k.key);setError('');}}>{k.label}</button>)}</div>
          {kind==='single'?<><label>Кино хайх<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Киноны нэр…" /></label><label>Кино сонгох<select value={filmId} onChange={e=>setFilmId(e.target.value)}><option value="">Кино сонгоно уу</option>{films.filter(f=>f.id===Number(filmId)||f.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(f=><option key={f.id} value={f.id}>{f.title}</option>)}</select></label><small>Сонгосон нэг киног 3 хоног үзэх эрх.</small></>:<label>Багцын ангилал<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c.key} value={c.key}>{c.label}</option>)}</select></label>}
          <p>Баримт болон кино / багцыг шалгаад эрх нээнэ үү.</p>
          <button type="button" className="chat-primary" onClick={prepare}>Үргэлжлүүлэх</button>
        </>}
        <button type="button" onClick={()=>setPanel(null)}>Хаах</button>
      </>}
    </div>}

    {panel==='clear' && <div className="chat-action-panel" role="alertdialog" aria-label="Чат устгахыг баталгаажуулах"><strong>{phone} хэрэглэгчийн чатыг устгах уу?</strong><p>Одоо харагдаж буй мессеж, зургууд хоёр талд устна. Үзэх эрх, захиалга хэвээр үлдэнэ. Шинээр ирэх мессеж устахгүй.</p><button type="button" className="chat-delete" disabled={busy} onClick={()=>void clear()}>{busy?'Устгаж байна…':'Тийм, чат устгах'}</button><button type="button" disabled={busy} onClick={()=>setPanel(null)}>Болих</button></div>}
    {error && <p className="chat-error" role="alert">{error}</p>}
  </div>;
}
