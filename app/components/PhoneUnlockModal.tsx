"use client";

import {useEffect,useState,type FormEvent} from 'react';
import {RequestError,requestJson} from '@/lib/client';
import {TAZA_SINGLE_PRICE,TAZA_MANUAL_ALL_PRICE} from '@/lib/domain';

type Film={id:number;title:string};
type Access='single'|'all';
type Settings={bankName:string;bankAccount:string;accountName:string;bankIban:string;messengerUrl:string};
type Props={film:Film|null;preferredPlan?:Access;onClose:()=>void;onUnlocked:()=>Promise<void>|void};
const fallbackMessenger='https://m.me/1453362271192628'; // Facebook page ID provided by the owner.

export default function PhoneUnlockModal({film,preferredPlan='single',onClose,onUnlocked}:Props){
  const [phone,setPhone]=useState('');
  const [access,setAccess]=useState<Access>(preferredPlan);
  const [stage,setStage]=useState<'phone'|'payment'>('phone');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [paymentReason,setPaymentReason]=useState('');
  const [settings,setSettings]=useState<Settings|null>(null);
  const [settingsError,setSettingsError]=useState('');
  const [copied,setCopied]=useState('');
  const price=access==='all'?TAZA_MANUAL_ALL_PRICE:TAZA_SINGLE_PRICE;
  useEffect(()=>{
    let active=true;
    requestJson('/api/settings',{},true).then(data=>{
      if(!active)return;
      if(!data||!data.bankAccount||!data.accountName)throw new Error('Банкны дансны мэдээлэл дутуу байна.');
      setSettings({
        bankName:String(data.bankName||'ХААН Банк'),
        bankAccount:String(data.bankAccount),
        accountName:String(data.accountName),
        bankIban:String(data.bankIban||''),
        messengerUrl:String(data.messengerUrl||''),
      });
      setSettingsError('');
    }).catch(e=>{if(active)setSettingsError(e instanceof Error?e.message:'Банкны тохиргоо ачаалсангүй.');});
    return()=>{active=false};
  },[]);
  useEffect(()=>{
    const close=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy)onClose();};
    document.addEventListener('keydown',close);
    return()=>document.removeEventListener('keydown',close);
  },[busy,onClose]);
  const chooseAccess=(next:Access)=>{
    setAccess(next);
    setError('');
    if(stage==='payment')setPaymentReason('');
  };
  const submit=async(event:FormEvent)=>{
    event.preventDefault();
    if(busy||phone.length!==8)return;
    setError('');
    if(!film&&access==='single'){
      setPaymentReason('1 киноны эрх авахын тулд доорх зааврын дагуу шилжүүлээд, дараа нь киногоо сонгоорой.');
      setStage('payment');
      return;
    }
    setBusy(true);
    try{
      await requestJson('/api/phone-grants/claim',{
        method:'POST',
        body:JSON.stringify({phone,film_id:film?.id??null,access_type:access}),
      },true);
      await onUnlocked();
    }catch(e){
      const err=e as RequestError;
      if(err instanceof RequestError&&['PHONE_GRANT_MISSING','PHONE_GRANT_DIFFERENT_FILM','PHONE_GRANT_NOT_ALL'].includes(err.code)){
        setPaymentReason(err.code==='PHONE_GRANT_MISSING'
          ?'Энэ дугаарт үзэх эрх бүртгэгдээгүй байна.'
          :err.code==='PHONE_GRANT_NOT_ALL'
            ?'Энэ дугаарт бүх киноны эрх байхгүй байна.'
            :'Энэ дугаарын 1 киноны эрх өмнө нь өөр кинонд ашиглагдсан байна.');
        setStage('payment');
      }else setError(e instanceof Error?e.message:'Эрхийг шалгаж чадсангүй. Дахин оролдоно уу.');
    }finally{setBusy(false);}
  };
  const copy=async(value:string,what:string)=>{
    try{await navigator.clipboard.writeText(value);setCopied(what);}
    catch{setError('Хуулж чадсангүй. Текстийг удаан дарж хуулна уу.');}
  };
  const inputStyle:React.CSSProperties={boxSizing:'border-box',width:'100%',fontSize:18,padding:'14px',border:'1px solid var(--border,#445)',borderRadius:11,background:'var(--background,#07090d)',color:'inherit'};
  const buttonStyle:React.CSSProperties={border:0,borderRadius:10,padding:'11px 12px',fontWeight:750,cursor:'pointer'};
  return <div role="presentation" style={{position:'fixed',inset:0,zIndex:1200,background:'rgba(0,0,0,.86)',display:'grid',placeItems:'center',padding:16,overflowY:'auto',overscrollBehavior:'contain'}}>
    <section role="dialog" aria-modal="true" aria-labelledby="phone-unlock-heading" style={{width:'100%',maxWidth:420,boxSizing:'border-box',borderRadius:18,background:'var(--surface,#121821)',color:'var(--foreground,#fff)',padding:20,border:'1px solid var(--border,#333)',boxShadow:'0 16px 50px rgba(0,0,0,.4)',maxHeight:'calc(100dvh - 32px)',overflowY:'auto',overflowX:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
        <h2 id="phone-unlock-heading" style={{fontSize:20,margin:0}}>🎬 Кино үзэх эрх</h2>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Хаах" style={{border:0,background:'transparent',color:'inherit',fontSize:25,cursor:'pointer'}}>×</button>
      </div>
      {film&&<p style={{fontSize:14,margin:'12px 0 6px'}}>Сонгосон кино: <strong>{film.title}</strong></p>}
      <p style={{fontSize:13,opacity:.85,lineHeight:1.55,margin:'8px 0 14px'}}>Утасны дугаараа оруулж эрхээ шалгана уу. Эрх байхгүй бол төлбөрийн заавар гарна.</p>
      <div role="group" aria-label="Үзэх эрхийн төрөл" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:15}}>
        <button type="button" aria-pressed={access==='single'} onClick={()=>chooseAccess('single')} style={{...buttonStyle,background:access==='single'?'var(--accent,#e4b54a)':'var(--surface-raised,#27303c)',color:access==='single'?'#000':'inherit',border:access==='single'?'2px solid #e4b54a':'2px solid transparent'}}>1 кино · 2,000₮</button>
        <button type="button" aria-pressed={access==='all'} onClick={()=>chooseAccess('all')} style={{...buttonStyle,background:access==='all'?'var(--accent,#e4b54a)':'var(--surface-raised,#27303c)',color:access==='all'?'#000':'inherit',border:access==='all'?'2px solid #e4b54a':'2px solid transparent'}}>45 кино бүгд · 12,000₮</button>
      </div>
      <form onSubmit={submit}>
        <label htmlFor="phone-unlock-input" style={{display:'block',fontWeight:700,marginBottom:7}}>Утасны дугаар</label>
        <input id="phone-unlock-input" type="tel" autoComplete="tel-national" inputMode="numeric" maxLength={8} pattern="[0-9]{8}" required autoFocus placeholder="8 оронтой дугаар" value={phone} onChange={e=>{setPhone(e.target.value.replace(/\D/g,'').slice(0,8));setError('');}} style={inputStyle}/>
        {stage==='phone'&&<button type="submit" disabled={busy||phone.length!==8} style={{...buttonStyle,width:'100%',marginTop:14,background:'var(--accent,#e5b53b)',color:'#101010',padding:15,fontSize:16,opacity:busy||phone.length!==8?.6:1}}>
          {busy?'Эрхийг шалгаж байна...':'Эрх шалгах'}
        </button>}
      </form>
      {error&&<p role="alert" style={{color:'#f87171',fontSize:13,lineHeight:1.5}}>{error}</p>}
      {stage==='payment'&&<div style={{marginTop:16,borderTop:'1px solid var(--border,#445)',paddingTop:14}}>
        {paymentReason&&<p role="status" style={{color:'#fbbf24',fontSize:13,lineHeight:1.6}}>{paymentReason}</p>}
        <p style={{fontSize:14,lineHeight:1.7,margin:'8px 0 12px',fontWeight:700}}>1 кино — 2,000₮, 45 кино бүгд — 12,000₮. Сонголтоо хийгээд шилжүүлнэ үү.</p>
        <h3 style={{fontSize:17,margin:'8px 0 10px'}}>💳 ХААН Банкны данс</h3>
        {settingsError&&<p role="alert" style={{color:'#f87171',fontSize:13}}>{settingsError}</p>}
        {!settings&&!settingsError&&<p style={{fontSize:13}}>Дансны мэдээлэл ачаалж байна...</p>}
        {settings&&<div style={{background:'var(--background,#090d13)',borderRadius:12,padding:14,display:'grid',gap:9,border:'1px solid var(--border,#445)',fontSize:14}}>
          <div><span style={{opacity:.65}}>Банк</span><strong style={{display:'block',fontSize:16}}>{settings.bankName}</strong></div>
          <div><span style={{opacity:.65}}>Данс эзэмшигч</span><strong style={{display:'block',fontSize:16}}>{settings.accountName}</strong></div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
            <div><span style={{opacity:.65}}>Дансны дугаар</span><strong style={{display:'block',fontSize:18,wordBreak:'break-all'}}>{settings.bankAccount}</strong></div>
            <button type="button" onClick={()=>void copy(settings.bankAccount,'bank')} style={{...buttonStyle,background:'var(--surface-raised,#253040)',color:'inherit',flexShrink:0}}>{copied==='bank'?'Хуулсан ✓':'Хуулах'}</button>
          </div>
          {settings.bankIban&&<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
            <div><span style={{opacity:.65}}>IBAN</span><strong style={{display:'block',fontSize:12,wordBreak:'break-all'}}>{settings.bankIban}</strong></div>
            <button type="button" onClick={()=>void copy(settings.bankIban,'iban')} style={{...buttonStyle,background:'var(--surface-raised,#253040)',color:'inherit',flexShrink:0}}>{copied==='iban'?'Хуулсан ✓':'Хуулах'}</button>
          </div>}
          <div><span style={{opacity:.65}}>Шилжүүлэх дүн</span><strong style={{display:'block',fontSize:23,color:'#fbbf24'}}>{price.toLocaleString('mn-MN')}₮</strong></div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
            <div><span style={{opacity:.65}}>Гүйлгээний утга</span><strong style={{display:'block',fontSize:20}}>{phone}</strong></div>
            <button type="button" onClick={()=>void copy(phone,'phone')} style={{...buttonStyle,background:'var(--surface-raised,#253040)',color:'inherit',flexShrink:0}}>{copied==='phone'?'Хуулсан ✓':'Хуулах'}</button>
          </div>
        </div>}
        <p style={{fontSize:14,lineHeight:1.75,marginTop:13}}>Та <strong>гүйлгээний утга дээр утасны дугаараа бичиж</strong>, сонгосон дүнгээ шилжүүлнэ үү. ХААН Банкны орлогын SMS MacroDroid-оор баталгаажмагц эрх <strong>автоматаар нээгдэнэ</strong>. Хэрэв нээгдэхгүй бол манай <strong>Facebook пэйж рүү гүйлгээний screenshot</strong> явуулна уу.</p>
        {settings&&<a href={settings.messengerUrl||fallbackMessenger} target="_blank" rel="noopener noreferrer" style={{...buttonStyle,display:'block',textAlign:'center',textDecoration:'none',background:'#1677f2',color:'#fff',fontSize:15,padding:14,marginTop:12}}>
          📩 Facebook пэйж рүү screenshot илгээх
        </a>}
        {!film&&access==='single'&&<p style={{fontSize:12,opacity:.8}}>1 киноны эрх идэвхжсэний дараа киноны жагсаалтаас үзэх киногоо сонгоно.</p>}
      </div>}
    </section>
  </div>;
}
