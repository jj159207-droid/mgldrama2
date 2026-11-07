'use client';

import { useEffect, useRef } from 'react';
import { TAZA_2_PLAN, TAZA_5_10000_PLAN, TAZA_40_PLAN } from '@/lib/domain';

type Props = {
  onSelect: (plan:string)=>void;
  onClose: ()=>void;
  busy?:boolean;
  movieCount?:number;
  hasSelectedFilm?:boolean;
};

const packages=[
  {id:TAZA_2_PLAN,count:'2 кино',price:'5,000₮',description:'1 кино 2,500₮. Хамгийн багадаа 2 өөр киног 30 хоног үзэх эрх',featured:false},
  {id:TAZA_5_10000_PLAN,count:'5 кино',price:'10,000₮',description:'Сонгосон 5 өөр киногоо 30 хоногийн дотор үзнэ',featured:false},
  {id:TAZA_40_PLAN,count:'40 кино',price:'12,000₮',description:'1 кино ердөө 300₮ — 40 кино 12,000₮. Сонгосон 40 өөр киног 30 хоног үзнэ',featured:true},
] as const;

export default function TazaPlanPicker({onSelect,onClose,busy=false,hasSelectedFilm=false}:Props) {
  const closeRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    closeRef.current?.focus();
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};
    document.addEventListener('keydown',onKey);
    return()=>document.removeEventListener('keydown',onKey);
  },[onClose]);
  return <div className="taza-offer-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section className="taza-offer-dialog" role="dialog" aria-modal="true" aria-labelledby="taza-offer-title">
      <button ref={closeRef} type="button" className="taza-offer-close" onClick={onClose} aria-label="Сонголт хаах">×</button>
      <span className="taza-offer-eyebrow">TAZA SITE · ҮЗЭХ БАГЦ</span>
      <h2 id="taza-offer-title">Киногоо хэрхэн үзэх вэ?</h2>
      <p className="taza-offer-intro">1 кино 2,500₮. Хамгийн багадаа 2 киноны эрх буюу 5,000₮-ийн багц авна.</p>
      {packages.map(item=><button type="button" key={item.id}
        className={`taza-offer-card${item.featured?' taza-offer-featured':''}`}
        onClick={()=>onSelect(item.id)} disabled={busy}>
        {item.featured&&<span className="taza-offer-best">ХАМГИЙН ХЭМНЭЛТТЭЙ</span>}
        <span className="taza-offer-card-copy">
          <strong>{item.featured?'🌟':'🎬'} {item.count} үзэх эрх</strong>
          <small>{item.description}</small>
        </span>
        <span className="taza-offer-amount">{item.price}</span>
        <span className="taza-offer-go">{hasSelectedFilm&&item.id===TAZA_2_PLAN?'ЭНЭ КИНОГ НЭЭХ →':'ЭНЭ БАГЦЫГ СОНГОХ →'}</span>
      </button>)}
      <p className="taza-offer-note">2/5/40 киноны багцад нэг киног анх нээхэд 1 эрх ашиглагдана. Тэр киногоо багцын хугацаанд дахин үзэж болно. Төлбөр баталгаажмагц эрх нээгдэнэ.</p>
    </section>
  </div>;
}
