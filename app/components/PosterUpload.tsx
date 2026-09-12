'use client';
import {useEffect,useRef,useState} from 'react';
import {requestJson} from '@/lib/client';

export default function PosterUpload({value,onChange,onBusyChange,disabled=false}:{
  value:string;onChange:(url:string)=>void;onBusyChange:(busy:boolean)=>void;disabled?:boolean;
}){
  const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const active=useRef(true),pending=useRef(false),controller=useRef<AbortController|null>(null);
  useEffect(()=>{active.current=true;return()=>{active.current=false;controller.current?.abort();onBusyChange(false);};},[onBusyChange]);
  const upload=async(selected:File)=>{
    if(pending.current)return;
    if(selected.size>4000000||!['image/jpeg','image/png','image/webp','image/gif'].includes(selected.type)){
      setError('4 MB хүртэл PNG, JPEG, WebP эсвэл GIF зураг сонгоно уу.');return;
    }
    pending.current=true;setBusy(true);onBusyChange(true);setError('');setNotice('');setFile(selected);
    controller.current=new AbortController();
    try{
      const result=await requestJson('/api/posters',{method:'POST',headers:{'Content-Type':selected.type},body:selected,signal:controller.current.signal},true);
      if(!result?.url||typeof result.url!=='string')throw new Error('Зураг хадгалагдсан эсэхийг баталгаажуулж чадсангүй.');
      if(active.current){onChange(result.url);setNotice(`Зураг бэлэн · ${Math.ceil(result.bytes/1000)} KB. Киноны өөрчлөлтөө хадгална уу.`);setFile(null);}
    }catch(err){if(active.current)setError(err instanceof Error?err.message:'Зураг байршуулж чадсангүй.');}
    finally{pending.current=false;if(active.current){setBusy(false);onBusyChange(false);}}
  };
  return <div className="poster-upload">
    <label>Киноны нүүр зураг
      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy||disabled}
        onChange={event=>{const selected=event.target.files?.[0];if(selected)void upload(selected);event.target.value='';}} />
    </label>
    <p>4 MB хүртэл зураг. Бүтнээр нь багтааж, хэмжээг автоматаар багасгана.</p>
    {value&&<img src={value} alt="Сонгосон киноны нүүр зураг" width={120} height={180} />}
    {busy&&<p role="status">Зураг байршуулж байна…</p>}
    {notice&&<p role="status">{notice}</p>}
    {error&&<div role="alert"><p>{error}</p><p>Өмнөх зураг хэвээр үлдсэн.</p>{file&&<button type="button" className="secondary-button" disabled={busy||disabled} onClick={()=>void upload(file)}>Дахин оролдох</button>}</div>}
    <details><summary>Зургийн HTTPS холбоос ашиглах</summary>
      <input aria-label="Зургийн HTTPS холбоос" type="url" value={value.startsWith('data:')?'':value} disabled={busy||disabled}
        onChange={event=>{onChange(event.target.value);setNotice('');}} placeholder="https://..." />
    </details>
  </div>;
}
