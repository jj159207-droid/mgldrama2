'use client';
import {useEffect,useRef} from 'react';
import {TAZA_2_PLAN,TAZA_10_10000_PLAN,TAZA_45_ALL_13000_PLAN} from '@/lib/domain';
type Props={onSelect:(plan:string)=>void;onClose:()=>void;busy?:boolean;movieCount?:number;hasSelectedFilm?:boolean};
const products=[
  {id:TAZA_2_PLAN,title:'2 кино',price:5000,description:'2 өөр кино сонгож 30 хоног үзнэ.',featured:false},
  {id:TAZA_10_10000_PLAN,title:'10 кино',price:10000,description:'10 өөр кино сонгож 30 хоног үзнэ.',featured:false},
  {id:TAZA_45_ALL_13000_PLAN,title:'45 кино бүгд',price:13000,description:'Сайтын бүх киног 30 хоног үзнэ.',featured:true},
] as const;
export default function TazaPlanPicker({onSelect,onClose,busy=false}:Props){
  const closeRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{closeRef.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[onClose]);
  return <div className="taza-offer-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section className="taza-offer-dialog" role="dialog" aria-modal="true" aria-labelledby="taza-offer-title">
      <button ref={closeRef} type="button" className="taza-offer-close" onClick={onClose} aria-label="Сонголт хаах">×</button>
      <span className="taza-offer-eyebrow">TAZA SITE · КИНОНЫ ЭРХ</span>
      <h2 id="taza-offer-title">3 төрлийн багц сонголт</h2>
      {products.map(product=><button type="button" key={product.id}
        className={'taza-offer-card'+(product.featured?' taza-offer-featured':'')}
        onClick={()=>onSelect(product.id)} disabled={busy}>
        {product.featured&&<span className="taza-offer-best">БҮХ КИНО</span>}
        <span className="taza-offer-card-copy"><strong>{product.featured?'🌟':'🎬'} {product.title} үзэх эрх</strong><small>{product.description}</small></span>
        <span className="taza-offer-amount">{product.price.toLocaleString('mn-MN')}₮</span>
      </button>)}
    </section>
  </div>;
}