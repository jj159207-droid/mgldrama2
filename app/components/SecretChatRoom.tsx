'use client';
import {useEffect,useRef,useState} from 'react';
import {requestJson} from '@/lib/client';
import {normalizeMongolianIban} from '@/lib/iban';

type Status={status:'loading'|'unpaid'|'pending'|'paid'|'joined'|'blocked';ref?:string;phone?:string;name?:string;age?:number;amount?:number};
type ChatMessage={id:number;memberId:number;text:string;at:string;mine:boolean};
type Bank={bankName:string;bankAccount:string;accountName:string;bankIban:string};
const PHONE=/^[0-9]{8}$/;
export default function SecretChatRoom({onClose}:{onClose:()=>void}){
 const [status,setStatus]=useState<Status>({status:'loading'});
 const [bank,setBank]=useState<Bank|null>(null);
 const [name,setName]=useState('');
 const [age,setAge]=useState('');
 const [phone,setPhone]=useState('');
 const [messages,setMessages]=useState<ChatMessage[]>([]);
 const [draft,setDraft]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [copied,setCopied]=useState('');
 const box=useRef<HTMLDivElement>(null);
 const end=useRef<HTMLDivElement>(null);
 const refresh=async():Promise<Status>=>{
   const data=await requestJson('/api/secret-chat',{},true);
   if(data.status==='unpaid'){
     const order=await requestJson('/api/secret-chat/order',{method:'POST',body:'{}'},true);
     return {status:order.status,ref:order.ref,amount:order.amount};
   }
   return data as Status;
 };
 useEffect(()=>{
   let closed=false;
   const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};
   document.addEventListener('keydown',onKey);box.current?.focus();
   Promise.all([refresh(),requestJson('/api/settings',{},true)]).then(([s,b])=>{if(!closed){setStatus(s);setBank(b);}}).catch(e=>{if(!closed)setError(e instanceof Error?e.message:'Төлбөрийн мэдээлэл ачаалсангүй.');});
   return()=>{closed=true;document.removeEventListener('keydown',onKey);};
 },[onClose]);
 useEffect(()=>{
   if(status.status!=='pending')return;
   let closed=false;
   const timer=setInterval(()=>{if(document.visibilityState==='hidden')return;
     void requestJson('/api/secret-chat',{},true).then((data:Status)=>{if(!closed&&data.status!==status.status)setStatus(data);}).catch(()=>{});
   },4000);
   return()=>{closed=true;clearInterval(timer);};
 },[status.status]);
 useEffect(()=>{
   if(status.status!=='joined')return;let closed=false;
   const load=async()=>{try{const data=await requestJson('/api/secret-chat?messages=1',{},true);if(!closed)setMessages(data.messages||[]);}catch(e){if(!closed)setError(e instanceof Error?e.message:'Чатыг ачаалсангүй.');}};
   void load();const timer=setInterval(()=>{if(document.visibilityState!=='hidden')void load();},4500);
   return()=>{closed=true;clearInterval(timer);};
 },[status.status]);
 useEffect(()=>{if(status.status==='joined')end.current?.scrollIntoView({behavior:'smooth',block:'end'});},[messages.length,status.status]);
 const copy=async(value:string,label:string)=>{try{await navigator.clipboard.writeText(value);setCopied(label);}catch{setError('Хуулах боломжгүй. Дугаараа гараар хуулна уу.');}};
 const retry=async()=>{setError('');setStatus({status:'loading'});try{setStatus(await refresh());}catch(e){setError(e instanceof Error?e.message:'Алдаа гарлаа.');}};
 const join=async()=>{
   const cleanName=name.trim().normalize('NFC'),years=Number(age);
   if(cleanName.length<2||cleanName.length>80){setError('Нэрээ 2–80 тэмдэгтээр оруулна уу.');return;}
   if(!/^\d{1,3}$/.test(age)||!Number.isInteger(years)||years<18||years>120){setError('Нас 18–120 хооронд байх шаардлагатай.');return;}
   if(!PHONE.test(phone)){setError('8 оронтой утасны дугаар оруулна уу.');return;}
   setBusy(true);setError('');
   try{const data=await requestJson('/api/secret-chat',{method:'POST',body:JSON.stringify({action:'join',name:cleanName,age:years,phone})},true);setStatus({status:data.status,phone:data.phone,name:data.name,age:data.age});}
   catch(e){setError(e instanceof Error?e.message:'Дугаар хадгалсангүй.');}finally{setBusy(false);}
 };
 const send=async()=>{
   const text=draft.trim();if(!text||busy)return;setBusy(true);setError('');
   try{const d=await requestJson('/api/secret-chat',{method:'POST',body:JSON.stringify({action:'send',text,clientId:crypto.randomUUID()})},true);setMessages(cur=>cur.some(m=>m.id===d.message.id)?cur:[...cur,d.message]);setDraft('');}
   catch(e){setError(e instanceof Error?e.message:'Зурвас илгээгдсэнгүй.');}finally{setBusy(false);}
 };
 const iban=normalizeMongolianIban(bank?.bankIban||'');
 const ready=!!(iban&&bank?.bankAccount&&iban.endsWith(bank.bankAccount.replace(/\s/g,'')));
 return <div className="secret-room-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
   <section ref={box} tabIndex={-1} className="secret-room-dialog" role="dialog" aria-modal="true" aria-labelledby="secret-room-title">
     <header className="secret-room-head"><div><small>TAZA · ГИШҮҮНЧЛЭЛ</small><h2 id="secret-room-title">🔥 Нууц чат өрөө</h2></div><button type="button" onClick={onClose} className="secret-room-close" aria-label="Нууц чат хаах">×</button></header>
     {status.status==='loading'&&<p role="status" className="secret-room-muted">Төлбөрийн мэдээлэл шалгаж байна…</p>}
     {['pending','unpaid'].includes(status.status)&&<>
       <div className="secret-room-price"><span>Халуун өрөөнд орох төлбөр</span><strong>10,000₮</strong></div>
       <p className="secret-room-muted">ХААН Банк руу шилжүүлэхдээ гүйлгээний утгад зөвхөн доорх 6 оронтой кодыг бичнэ үү.</p>
       {ready?<div className="secret-room-bank">
         <div><small>Банк</small><strong>{bank!.bankName}</strong></div>
         <div><small>Данс эзэмшигч</small><strong>{bank!.accountName}</strong></div>
         <button type="button" onClick={()=>void copy(bank!.bankAccount,'account')}><small>Дансны дугаар</small><strong>{bank!.bankAccount}</strong><span>{copied==='account'?'Хуулагдлаа':'Хуулах'}</span></button>
         <button type="button" onClick={()=>void copy(iban,'iban')}><small>IBAN</small><strong>{iban}</strong><span>{copied==='iban'?'Хуулагдлаа':'Хуулах'}</span></button>
       </div>:<p className="secret-room-error" role="alert">Банкны данс болон IBAN тохироогүй байна. Төлбөр хийхээс өмнө админтай холбогдоно уу.</p>}
       {status.ref?<button type="button" className="secret-room-code" onClick={()=>void copy(status.ref!,'ref')}><small>ГҮЙЛГЭЭНИЙ УТГА · 6 ОРОНТОЙ КОД</small><strong>{status.ref}</strong><span>{copied==='ref'?'Хуулагдлаа ✓':'Код хуулах'}</span></button>:<button type="button" onClick={()=>void retry()}>Код авах</button>}
       <button type="button" className="secret-room-secondary" onClick={()=>void retry()}>Төлбөрийн төлөв шалгах</button>
     </>}
     {status.status==='paid'&&<div className="secret-room-join">
       <p className="secret-room-paid">✓ Таны 10,000₮-ийн төлбөр баталгаажсан.</p>
       <h3>Нэр, нас, утасны дугаараа оруулна уу</h3>
       <p className="secret-room-muted">Энэ мэдээллийг зөвхөн бүртгэл болон админ хяналтад хадгална. Бусад чатлагчид харагдахгүй. 18-аас дээш насны хэрэглэгчид бүртгүүлнэ.</p>
       <label htmlFor="secret-room-name">Нэр</label>
       <input id="secret-room-name" type="text" autoComplete="name" value={name} maxLength={80} placeholder="Нэрээ бичнэ үү" onChange={e=>setName(e.target.value)}/>
       <label htmlFor="secret-room-age">Нас</label>
       <input id="secret-room-age" type="number" inputMode="numeric" min={18} max={120} value={age} placeholder="18" onChange={e=>setAge(e.target.value.slice(0,3))}/>
       <label htmlFor="secret-room-phone">Утасны дугаар</label>
       <input id="secret-room-phone" type="tel" inputMode="numeric" autoComplete="tel-national" value={phone} maxLength={8} placeholder="99112233" onChange={e=>setPhone(e.target.value.replace(/\D/g,'').slice(0,8))}/>
       <button type="button" className="secret-room-primary" onClick={()=>void join()} disabled={busy||name.trim().length<2||!/^\d{1,3}$/.test(age)||Number(age)<18||Number(age)>120||!PHONE.test(phone)}>{busy?'Хадгалж байна…':'Бүртгэлээ хадгалах'}</button>
     </div>}
     {status.status==='blocked'&&<p role="alert" className="secret-room-error">Чатны эрхийг админ түр хаасан байна.</p>}
     {status.status==='joined'&&<div className="secret-room-chat">
       <div className="secret-room-paid" role="status">
         <strong>✓ Бүртгэл амжилттай хадгалагдлаа.</strong>
         <p>Бид тань руу “7788” гэсэн мессеж илгээвэл завтай үедээ эргэж залгаарай.</p>
       </div>
       <p className="secret-room-muted">Төлбөртэй гишүүдийн чат. Бусад гишүүн таны нэр, нас, утасны дугаарыг харахгүй.</p>
       <div className="secret-room-messages" role="log" aria-live="polite" aria-relevant="additions text">
         {!messages.length&&<p className="secret-room-muted">Одоохондоо зурвас алга. Эхний мессежээ бичээрэй.</p>}
         {messages.map(m=><div key={m.id} className={'secret-room-message'+(m.mine?' mine':'')}><small>{m.mine?'Та':'Гишүүн #'+m.memberId} · {new Date(m.at).toLocaleTimeString('mn-MN',{hour:'2-digit',minute:'2-digit'})}</small><p>{m.text}</p></div>)}
         <div ref={end}/>
       </div>
       <form className="secret-room-send" onSubmit={e=>{e.preventDefault();void send();}}><input value={draft} onChange={e=>setDraft(e.target.value.slice(0,600))} maxLength={600} placeholder="Зурвасаа бичих…" aria-label="Зурвасаа бичих"/><button type="submit" disabled={!draft.trim()||busy}>Илгээх</button></form>
     </div>}
     {error&&<p role="alert" className="secret-room-error">{error}</p>}
     {error&&status.status==='loading'&&<button type="button" className="secret-room-secondary" onClick={()=>void retry()}>Дахин оролдох</button>}
   </section>
 </div>;
}
