"use client";

import {useState,type FormEvent} from 'react';
import {requestJson} from '@/lib/client';

type Film={id:number;title:string};
type Props={film:Film;onClose:()=>void;onUnlocked:()=>Promise<void>|void};

export default function PhoneUnlockModal({film,onClose,onUnlocked}:Props){
  const [phone,setPhone]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const submit=async(event:FormEvent)=>{
    event.preventDefault();
    if(busy||phone.length!==8)return;
    setBusy(true);setError('');
    try{
      await requestJson('/api/phone-grants/claim',{method:'POST',body:JSON.stringify({phone,film_id:film.id})},true);
      await onUnlocked();
    }catch(e){setError(e instanceof Error?e.message:'Киноны эрх шалгахад алдаа гарлаа.');}
    finally{setBusy(false);}
  };
  return <div role="presentation" style={{position:'fixed',inset:0,zIndex:1200,background:'rgba(0,0,0,.86)',display:'grid',placeItems:'center',padding:16,overflowY:'auto'}}>
    <section role="dialog" aria-modal="true" aria-labelledby="phone-unlock-heading" style={{width:'100%',maxWidth:420,boxSizing:'border-box',borderRadius:18,background:'var(--surface,#121821)',color:'var(--foreground,#fff)',padding:20,border:'1px solid var(--border,#333)',boxShadow:'0 16px 50px rgba(0,0,0,.4)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
        <h2 id="phone-unlock-heading" style={{fontSize:21,margin:0}}>📱 Кино үзэх эрх шалгах</h2>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Хаах" style={{border:0,background:'transparent',color:'inherit',fontSize:25,cursor:'pointer'}}>×</button>
      </div>
      <p style={{fontSize:14,opacity:.82,lineHeight:1.6}}>«{film.title}» киног бүтэн үзэхийн тулд админд бүртгүүлсэн утасны дугаараа оруулна уу.</p>
      <form onSubmit={submit}>
        <label htmlFor="phone-unlock-input" style={{display:'block',fontWeight:700,marginBottom:7}}>Утасны дугаар</label>
        <input id="phone-unlock-input" type="tel" autoComplete="tel-national" inputMode="numeric" maxLength={8} pattern="[0-9]{8}" required autoFocus placeholder="8 оронтой дугаар" value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,'').slice(0,8))}
          style={{boxSizing:'border-box',width:'100%',fontSize:18,padding:'14px',border:'1px solid var(--border,#445)',borderRadius:11,background:'var(--background,#07090d)',color:'inherit'}}/>
        {error&&<p role="alert" style={{color:'#f87171',fontSize:13,lineHeight:1.5}}>{error}</p>}
        <button type="submit" disabled={busy||phone.length!==8} style={{border:0,width:'100%',marginTop:16,background:'var(--accent,#e5b53b)',color:'#101010',padding:15,borderRadius:11,fontWeight:800,fontSize:16,cursor:'pointer',opacity:busy||phone.length!==8?.6:1}}>
          {busy?'Эрхийг шалгаж байна...':'Шалгах · Кино нээх'}
        </button>
      </form>
      <p style={{fontSize:12,opacity:.74,marginTop:15,lineHeight:1.5}}>Эрх нээгдээгүй бол пэйжийн админтай холбогдож дугаараа бүртгүүлнэ үү.</p>
    </section>
  </div>;
}
