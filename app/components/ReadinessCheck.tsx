'use client';
import {useState} from 'react';
import {requestJson} from '@/lib/client';
type Report={version:string;ok:boolean;checks:{name:string;ok:boolean;label:string}[];note:string};
export default function ReadinessCheck(){
  const [busy,setBusy]=useState(false),[result,setResult]=useState<Report|null>(null),[error,setError]=useState('');
  const run=async()=>{setBusy(true);setError('');try{setResult(await requestJson('/api/readiness',{},true));}catch(e){setError(e instanceof Error?e.message:'Шалгаж чадсангүй.');}finally{setBusy(false);}};
  return <div className="poster-upload"><button className="secondary-button" disabled={busy} onClick={()=>void run()}>{busy?'Шалгаж байна…':'HTTPS бэлтгэл шалгах'}</button>
    {error&&<p role="alert">{error}</p>}{result&&<div role="status"><p>Хувилбар: {result.version}</p><ul>{result.checks.map(c=><li key={c.name} style={{color:c.ok?'#86efac':'#fcd34d',marginTop:8}}>{c.ok?'✓':'!'} {c.label}</li>)}</ul><p>{result.note}</p></div>}
  </div>;
}
