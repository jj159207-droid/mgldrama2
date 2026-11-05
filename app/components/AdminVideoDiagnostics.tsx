'use client';
import {useState} from 'react';

type FilmRow={id:number;title:string;state:string;kind:string};
type Probe=FilmRow & {probe:string;httpStatus?:number;headStatus?:number;method?:'GET'|'HEAD';hint?:string};
type LibrarySummary={stateCounts:Record<string,number>;hostCounts:Record<string,number>;libraries:{libraryId:string;count:number}[]};

export default function AdminVideoDiagnostics(){
  const [films,setFilms]=useState<FilmRow[]>([]);
  const [summary,setSummary]=useState<LibrarySummary|null>(null);
  const [selected,setSelected]=useState(0);
  const [loading,setLoading]=useState(false);
  const [checking,setChecking]=useState(false);
  const [error,setError]=useState('');
  const [result,setResult]=useState<Probe|null>(null);
  const load=async()=>{
    setLoading(true);setError('');setResult(null);
    try {
      const r=await fetch('/api/admin/video-diagnostics',{cache:'no-store',credentials:'same-origin'});
      const data=await r.json();
      if(!r.ok)throw new Error(data.message||'Киноны эх сурвалжийн мэдээлэл олдсонгүй.');
      setFilms(data.films||[]);
      setSummary(data.summary||null);
      setSelected(Number(data.films?.[0]?.id||0));
    }catch(e){setError(e instanceof Error?e.message:'Киноны жагсаалтыг шалгаж чадсангүй.');}
    finally{setLoading(false);}
  };
  const check=async()=>{
    if(!selected)return;
    setChecking(true);setError('');setResult(null);
    try{
      const r=await fetch(`/api/admin/video-diagnostics?id=${selected}`,{credentials:'same-origin',cache:'no-store'});
      const data=await r.json();
      if(!r.ok)throw new Error(data.message||'Видео холбоосыг шалгаж чадсангүй.');
      setResult(data);
    }catch(e){setError(e instanceof Error?e.message:'Bunny холбоосын шалгалт амжилтгүй.');}
    finally{setChecking(false);}
  };
  return <section style={{padding:14,borderRadius:12,marginBottom:12,border:'1px solid #334155',background:'#101820',color:'#f8fafc'}}>
    <strong style={{fontSize:14}}>🎬 Киноны 404 алдааг шалгах</strong>
    <p style={{fontSize:12,color:'#cbd5e1',lineHeight:1.6,margin:'8px 0'}}>Бүтэн кино нээхэд 404 алдаа гарвал киногоо сонгоод Bunny холбоосыг шалгана. Энэ шалгалт таны төлбөрийг өөрчлөхгүй.</p>
    <button type="button" disabled={loading} onClick={()=>void load()} style={{border:0,borderRadius:8,padding:'10px 12px',background:'#fbbf24',color:'#111827',fontWeight:800,cursor:'pointer',width:'100%'}}>
      {loading?'Киноны жагсаалтыг шалгаж байна…':'Киноны жагсаалт ачаалах'}
    </button>
    {summary&&<div role="status" style={{fontSize:12,marginTop:12,padding:10,borderRadius:8,background:'#1e293b',lineHeight:1.7}}>
      <strong>Бүх киноны эх сурвалж ({films.length})</strong>
      <div>Видео URL дутуу: <strong>{summary.stateCounts?.missing||0}</strong> · Bunny URL бүтэц буруу: <strong>{summary.stateCounts?.invalid_bunny_url||0}</strong></div>
      <div>Bunny холбоостой: <strong>{summary.hostCounts?.bunny||0}</strong> · Bunny CDN: <strong>{summary.hostCounts?.bunny_cdn||0}</strong> · Бусад: <strong>{summary.hostCounts?.other||0}</strong></div>
      <div style={{marginTop:5}}>Bunny Stream сангийн ID:</div>
      {summary.libraries?.length?summary.libraries.map(item=><div key={item.libraryId}><strong>{item.libraryId}</strong> — {item.count} кино</div>):<div style={{color:'#94a3b8'}}>Bunny player-ийн сангийн ID танигдсангүй.</div>}
      <p style={{color:'#fbbf24',marginTop:7}}>Эдгээр сангийн ID-г Bunny.net → Stream → Video Library-ийн Library ID-тай харьцуулна. Олон киноны 404 ижил буруу сангийн ID-гаас үүдсэн байж болно.</p>
    </div>}
    {!!films.length && <div style={{marginTop:12,display:'grid',gap:8}}>
      <label htmlFor="admin-video-id" style={{fontSize:12}}>Алдаа гарсан кино</label>
      <select id="admin-video-id" value={selected} onChange={e=>{setSelected(Number(e.target.value));setResult(null);}} style={{padding:12,borderRadius:8,width:'100%',color:'#f8fafc',background:'#1e293b',border:'1px solid #64748b'}}>
        {films.map(f=><option key={f.id} value={f.id}>#{f.id} {f.title}{f.state==='missing'?' — Видео URL байхгүй':''}{f.state==='invalid_bunny_url'?' — Bunny URL буруу':''}</option>)}
      </select>
      <button type="button" disabled={checking} onClick={()=>void check()} style={{borderRadius:8,border:'1px solid #64748b',padding:'10px 12px',background:'#334155',color:'#f8fafc',fontWeight:800,cursor:'pointer'}}>
        {checking?'Bunny шалгаж байна…':'Bunny киноны холбоос шалгах'}
      </button>
    </div>}
    {error&&<p role="alert" style={{color:'#fca5a5',fontSize:12,marginTop:10}}>{error}</p>}
    {result&&<div role="status" style={{marginTop:12,fontSize:12,lineHeight:1.7,overflowWrap:'anywhere'}}>
      <strong>#{result.id} {result.title}</strong>
      <p style={{color:result.httpStatus===404||result.state!=='configured'?'#fca5a5':'#fbbf24'}}>
        {result.httpStatus? `Bunny HTTP: ${result.httpStatus}`:result.state==='missing'?'Видео холбоос байхгүй':result.state==='invalid_bunny_url'?'Bunny холбоосын бүтэц буруу':'Алсын шалгалт боломжгүй'}
      </p>
      {result.headStatus!==undefined&&<p style={{color:'#cbd5e1',fontSize:11}}>HEAD шалгалт: {result.headStatus} · {result.method==='GET'?'GET давтан шалгалт: '+result.httpStatus:'GET шаардлагагүй'}</p>}
      <p style={{color:'#cbd5e1'}}>{result.hint}</p>
      <p style={{fontSize:11,color:'#94a3b8'}}>GET/HEAD нь тоглуулагчийн хариуг шалгана; жинхэнэ видео тоглох эсэхийг зөвхөн Bunny Player дээр батална. Төлбөрийн эрх өөрчлөгдөхгүй.</p>
    </div>}
  </section>;
}
