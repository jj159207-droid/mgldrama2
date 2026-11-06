'use client';

import { useEffect, useRef } from 'react';
import { TAZA_5_PLAN, TAZA_10_PLAN, TAZA_ALL_PLAN } from '@/lib/domain';

type Props = {
  onSelect: (plan:string)=>void;
  onClose: ()=>void;
  busy?:boolean;
  movieCount?:number;
  hasSelectedFilm?:boolean;
};

const packages=[
  {id:'single',count:'1 кино',price:'3,000₮',description:'Сонгосон нэг киногоо 72 цагийн турш дахин үзнэ',featured:false},
  {id:TAZA_5_PLAN,count:'5 кино',price:'6,000₮',description:'Сонгосон 5 өөр киногоо 30 хоногийн дотор үзнэ',featured:false},
  {id:TAZA_10_PLAN,count:'10 кино',price:'9,000₮',description:'Сонгосон 10 өөр киногоо 30 хоногийн дотор үзнэ',featured:false},
  {id:TAZA_ALL_PLAN,count:'Бүх кино',price:'15,000₮',description:'Сайтын бүх киног 30 хоног хязгааргүй үзнэ',featured:true},
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
      <p className="taza-offer-intro">Өөрт тохирох багцаа сонгоно уу.</p>
      {packages.map(item=><button type="button" key={item.id}
        className={`taza-offer-card${item.featured?' taza-offer-featured':''}`}
        onClick={()=>onSelect(item.id)} disabled={busy}>
        {item.featured&&<span className="taza-offer-best">БҮХ КИНО</span>}
        <span className="taza-offer-card-copy">
          <strong>{item.featured?'🌟':'🎬'} {item.count} үзэх эрх</strong>
          <small>{item.description}</small>
        </span>
        <span className="taza-offer-amount">{item.price}</span>
        <span className="taza-offer-go">{item.id==='single' && !hasSelectedFilm ? 'КИНОГОО СОНГОХ →' : 'ЭНЭ БАГЦЫГ СОНГОХ →'}</span>
      </button>)}
      <p className="taza-offer-note">5/10 киноны багцад нэг киног анх нээхэд 1 эрх ашиглагдана. Тэр киногоо багцын хугацаанд дахин үзэж болно. Төлбөр баталгаажмагц эрх нээгдэнэ.</p>
    </section>
  </div>;
}
