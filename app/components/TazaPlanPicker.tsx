'use client';
import {useEffect,useRef} from 'react';
import {TAZA_2_PLAN,TAZA_45_ALL_9000_PLAN,TAZA_45_ALL_9000_PRICE} from '@/lib/domain';
type Props={onSelect:(plan:string)=>void;onClose:()=>void;onRestoreAccess?:()=>void;busy?:boolean;movieCount?:number;hasSelectedFilm?:boolean};
const products=[
  {id:TAZA_2_PLAN,title:'2 кино',price:5000,description:'2 өөр кино сонгож 30 хоног үзнэ.',featured:false},
  {id:TAZA_45_ALL_9000_PLAN,title:'45 кино бүгд',price:TAZA_45_ALL_9000_PRICE,description:'1 кино 200₮ · 45 кино бүгд 9,000₮ · 30 хоног',featured:true},
] as const;
export default function TazaPlanPicker({onSelect,onClose,onRestoreAccess,busy=false}:Props){
 const closeRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{closeRef.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[onClose]);
 return <div className="taza-offer-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
   <section className="taza-offer-dialog" role="dialog" aria-modal="true" aria-labelledby="taza-offer-title">
     <button ref={closeRef} type="button" className="taza-offer-close" onClick={onClose} aria-label="Сонголт хаах">×</button>
     <span className="taza-offer-eyebrow">TAZA SITE · КИНОНЫ ЭРХ</span>
     <h2 id="taza-offer-title">2 төрлийн багц сонголт</h2>
     {products.map(product=><button type="button" key={product.id}
       className={'taza-offer-card'+(product.featured?' taza-offer-featured':'')}
       onClick={()=>onSelect(product.id)} disabled={busy}>
       {product.featured&&<span className="taza-offer-best">БҮХ КИНО</span>}
       <span className="taza-offer-card-copy"><strong>{product.featured?'🌟':'🎬'} {product.title} үзэх эрх</strong><small>{product.description}</small></span>
       <span className="taza-offer-amount">{product.price.toLocaleString('mn-MN')}₮</span>
     </button>)}
     {onRestoreAccess && <button type="button" className="taza-offer-restore" disabled={busy}
       onClick={()=>{onClose();onRestoreAccess();}}
       style={{display:'block',width:'100%',marginTop:16,padding:'12px 14px',border:'1px solid #8f9cae',borderRadius:12,background:'#18202a',color:'#f3d9a5',fontWeight:750,fontSize:13,textAlign:'center',cursor:'pointer'}}>
       Өмнө төлсөн үү? Эрхээ хадгалах / сэргээх
     </button>}
   </section>
 </div>;
}