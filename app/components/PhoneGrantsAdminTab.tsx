"use client";

import {useEffect,useState} from 'react';
import {requestJson} from '@/lib/client';

type Grant={id:number;phone:string;access_type:'single'|'all';film_id:number|null;active:boolean;created_at:string};

export default function PhoneGrantsAdminTab(){
  const [items,setItems]=useState<Grant[]>([]);
  const [phone,setPhone]=useState('');
  const [kind,setKind]=useState<'single'|'all'>('single');
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');

  const load=async()=>{
    const data=await requestJson('/api/phone-grants',{},true);
    setItems(Array.isArray(data.items)?data.items:[]);
  };
  useEffect(()=>{
    let mounted=true;
    requestJson('/api/phone-grants',{},true).then(data=>{
      if(mounted)setItems(Array.isArray(data.items)?data.items:[]);
    }).catch(e=>{if(mounted)setError(e instanceof Error?e.message:'Жагсаалт ачаалсангүй.');})
    .finally(()=>{if(mounted)setLoading(false);});
    return()=>{mounted=false;};
  },[]);
  const save=async()=>{
    if(busy)return;
    if(!/^[0-9]{8}$/.test(phone)){setError('8 оронтой дугаар оруулна уу.');return;}
    setBusy(true);setError('');setMessage('');
    try{
      await requestJson('/api/phone-grants',{method:'POST',body:JSON.stringify({action:'save',phone,access_type:kind})},true);
      await load();setMessage('Эрх амжилттай хадгалагдлаа.');setPhone('');
    }catch(e){setError(e instanceof Error?e.message:'Эрх хадгалсангүй.');}
    finally{setBusy(false);}
  };
  const revoke=async(item:Grant)=>{
    if(busy||!window.confirm(item.phone+' дугаарын эрхийг цуцлах уу?'))return;
    setBusy(true);setError('');setMessage('');
    try{
      await requestJson('/api/phone-grants',{method:'POST',body:JSON.stringify({action:'revoke',phone:item.phone})},true);
      await load();setMessage('Эрх цуцлагдлаа.');
    }catch(e){setError(e instanceof Error?e.message:'Эрх цуцалсангүй.');}
    finally{setBusy(false);}
  };
  const pick=(item:Grant)=>{setPhone(item.phone);setKind(item.access_type);setError('');setMessage('');window.scrollTo({top:0,behavior:'smooth'});};
  const inputStyle:React.CSSProperties={width:'100%',padding:'13px 14px',border:'1px solid var(--border)',borderRadius:10,background:'var(--background)',color:'var(--foreground)',fontSize:17,boxSizing:'border-box'};
  const btnStyle:React.CSSProperties={border:0,borderRadius:9,padding:'12px 14px',cursor:'pointer',fontWeight:700};
  return <section style={{padding:'0 14px 28px',maxWidth:650,margin:'auto'}}>
    <div style={{background:'var(--surface)',padding:18,borderRadius:14,border:'1px solid var(--border)',marginBottom:16}}>
      <h2 style={{fontSize:19,margin:'0 0 10px'}}>📱 Утасны дугаараар киноны эрх</h2>
      <p style={{fontSize:13,opacity:.8,lineHeight:1.6}}>Админ дугаарыг хадгалахад хэрэглэгч «Киног бүтэн үзэх» дээр дугаараа оруулж эрхээ нээнэ. 1 киноны эрх анх нээсэн кинонд тогтоно.</p>
      <label htmlFor="grant-phone" style={{fontSize:13,fontWeight:700,display:'block',margin:'12px 0 6px'}}>Утасны дугаар</label>
      <input id="grant-phone" type="tel" inputMode="numeric" autoComplete="off" value={phone} maxLength={8} placeholder="99112233" onChange={e=>setPhone(e.target.value.replace(/\D/g,'').slice(0,8))} style={inputStyle}/>
      <div role="group" aria-label="Эрхийн төрөл" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginTop:13}}>
        <button type="button" aria-pressed={kind==='single'} onClick={()=>setKind('single')} style={{...btnStyle,background:kind==='single'?'var(--accent)':'var(--surface-raised)',color:kind==='single'?'#000':'var(--foreground)'}}>🎬 1 кино</button>
        <button type="button" aria-pressed={kind==='all'} onClick={()=>setKind('all')} style={{...btnStyle,background:kind==='all'?'var(--accent)':'var(--surface-raised)',color:kind==='all'?'#000':'var(--foreground)'}}>🍿 Бүх кино</button>
      </div>
      <button type="button" onClick={()=>void save()} disabled={busy||phone.length!==8} style={{...btnStyle,width:'100%',marginTop:14,background:'var(--accent)',color:'#000',opacity:busy||phone.length!==8?.6:1}}>{busy?'Түр хүлээнэ үү...':'Эрх хадгалах'}</button>
      {error&&<p role="alert" style={{color:'#f87171',fontSize:13}}>{error}</p>}
      {message&&<p role="status" style={{color:'#22c55e',fontSize:13}}>{message}</p>}
    </div>
    <h3 style={{fontSize:16,margin:'12px 0'}}>Хадгалсан дугаарууд ({items.length})</h3>
    {loading?<p>Ачаалж байна...</p>:items.length===0?<p style={{opacity:.7}}>Одоогоор дугаар бүртгээгүй.</p>:
      <div style={{display:'grid',gap:9}}>
        {items.map(item=><div key={item.id} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:12,display:'flex',gap:10,justifyContent:'space-between',alignItems:'center',flexWrap:'wrap'}}>
          <div style={{minWidth:140}}>
            <strong style={{fontVariantNumeric:'tabular-nums'}}>{item.phone}</strong>
            <div style={{fontSize:12,opacity:.8,marginTop:4}}>{!item.active?'Цуцлагдсан':item.access_type==='all'?'Бүх кино':item.film_id?'1 кино · ID '+item.film_id:'1 кино · Сонгоогүй'}</div>
          </div>
          <div style={{display:'flex',gap:6}}>
            <button type="button" disabled={busy} onClick={()=>pick(item)} style={{...btnStyle,background:'var(--surface-raised)',color:'var(--foreground)',padding:'9px 11px',fontSize:12}}>Засах</button>
            {item.active&&<button type="button" disabled={busy} onClick={()=>void revoke(item)} style={{...btnStyle,background:'#562026',color:'#fff',padding:'9px 11px',fontSize:12}}>Цуцлах</button>}
          </div>
        </div>)}
      </div>}
    <p style={{fontSize:12,opacity:.7,lineHeight:1.6,marginTop:14}}>Анхаар: зөвхөн дугаар оруулах нь утасны жинхэнэ эзнийг баталгаажуулахгүй. OTP баталгаажуулалт нэмэх хүртэл энэ эрхийг өндөр нууцлалтай гэж үзэхгүй.</p>
  </section>;
}
