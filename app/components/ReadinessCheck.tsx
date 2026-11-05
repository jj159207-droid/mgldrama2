'use client';
import {useState} from 'react';
import {requestJson} from '@/lib/client';

type IssueGroup={count:number;sample:{id:number;title:string}[]};
type CatalogReadiness={
  total:number;playableSourceCount:number;bunnySourceCount:number;
  missingFull:IssueGroup;missingTrailer:IssueGroup;missingPoster:IssueGroup;
  missingDescription:IssueGroup;truncated:boolean;
};
type Report={
  version:string;ok:boolean;checks:{name:string;ok:boolean;label:string}[];
  catalog?:CatalogReadiness|null;note:string;
};
export default function ReadinessCheck(){
  const [busy,setBusy]=useState(false),[result,setResult]=useState<Report|null>(null),[error,setError]=useState('');
  const run=async()=>{
    setBusy(true);setError('');
    try{setResult(await requestJson('/api/readiness',{},true));}
    catch(e){setError(e instanceof Error?e.message:'Шалгаж чадсангүй.');}
    finally{setBusy(false);}
  };
  const issues=result?.catalog ? [
    {label:'Бүтэн видео холбоосгүй',group:result.catalog.missingFull},
    {label:'Трейлергүй',group:result.catalog.missingTrailer},
    {label:'Постергүй',group:result.catalog.missingPoster},
    {label:'Тайлбаргүй',group:result.catalog.missingDescription},
  ] : [];
  return <div className="poster-upload">
    <button className="secondary-button" disabled={busy} onClick={()=>void run()}>{busy?'Шалгаж байна…':'Сайт ба киноны бүрэн бүтэн байдлыг шалгах'}</button>
    {error&&<p role="alert">{error}</p>}
    {result&&<div role="status">
      <p>Хувилбар: {result.version} · {result.ok?'Үндсэн шалгалтууд амжилттай':'Засах шаардлагатай зүйл байна'}</p>
      <ul>{result.checks.map(c=><li key={c.name} style={{color:c.ok?'#86efac':'#fcd34d',marginTop:8}}>{c.ok?'✓':'!'} {c.label}</li>)}</ul>
      {result.catalog&&<section aria-label="Киноны сангийн бүрэн бүтэн байдал">
        <h3>Киноны сан: {result.catalog.total} кино</h3>
        <p>Бүтэн киноны HTTPS холбоос: {result.catalog.playableSourceCount} · Bunny эх сурвалж: {result.catalog.bunnySourceCount}</p>
        {issues.map(({label,group})=><details key={label} style={{marginTop:10}}>
          <summary>{group.count>0?'!':'✓'} {label}: {group.count}</summary>
          {group.count>0
            ? <p>{group.sample.map(item=>`#${item.id} ${item.title}`).join(', ')}{group.count>group.sample.length?' …':''}</p>
            : <p>Энэ төрлийн дутуу мэдээлэл илрээгүй.</p>}
        </details>)}
        {result.catalog.truncated&&<p>Оношлогоо 2,000 кинонд хязгаарлагдсан.</p>}
      </section>}
      <p>{result.note}</p>
    </div>}
  </div>;
}
