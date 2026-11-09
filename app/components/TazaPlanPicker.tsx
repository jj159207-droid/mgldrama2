'use client';

import {useEffect,useRef} from 'react';
import {TAZA_MANUAL_ALL_PLAN,TAZA_MANUAL_ALL_PRICE,TAZA_SINGLE_PRICE} from '@/lib/domain';

type Props={onSelect:(plan:string)=>void;onClose:()=>void;busy?:boolean;movieCount?:number;hasSelectedFilm?:boolean};
const products=[
  {id:'single',title:'1 кино',price:TAZA_SINGLE_PRICE,description:'Нэг кино сонгож, админаар эрх нээлгэнэ.',featured:false},
  {id:TAZA_MANUAL_ALL_PLAN,title:'Бүх кино',price:TAZA_MANUAL_ALL_PRICE,description:'Сайтын бүх кино үзэх эрх. Админ дугаараар бүртгэнэ.',featured:true},
] as const;

export default function TazaPlanPicker({onSelect,onClose,busy=false}:Props){
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
      <span className="taza-offer-eyebrow">TAZA SITE · КИНОНЫ ЭРХ</span>
      <h2 id="taza-offer-title">Киногоо хэрхэн үзэх вэ?</h2>
      <p className="taza-offer-intro">Утасны дугаараар эрхээ шалгана. Эрх байхгүй бол ХААН Банк руу шилжүүлж, Facebook пэйж рүү баримтын screenshot илгээнэ.</p>
      {products.map(product=><button type="button" key={product.id}
        className={'taza-offer-card'+(product.featured?' taza-offer-featured':'')}
        onClick={()=>onSelect(product.id)} disabled={busy}>
        {product.featured&&<span className="taza-offer-best">БҮХ КИНО</span>}
        <span className="taza-offer-card-copy"><strong>{product.featured?'🌟':'🎬'} {product.title} үзэх эрх</strong><small>{product.description}</small></span>
        <span className="taza-offer-amount">{product.price.toLocaleString('mn-MN')}₮</span>
        <span className="taza-offer-go">ДУГААРААР ЭРХ ШАЛГАХ →</span>
      </button>)}
      <p className="taza-offer-note">Гүйлгээний утга дээр утасны дугаараа бичнэ. Төлбөрийн зураг Facebook пэйж рүү ирсний дараа админ банкны орлогыг тулгаж баталгаажуулан эрх нээнэ.</p>
    </section>
  </div>;
}
