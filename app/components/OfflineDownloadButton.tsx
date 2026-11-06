'use client';

import {useEffect,useState} from 'react';
import {OFFLINE_MOVIE_CACHE,offlineExpiry,offlineMetaKey,offlineMovieKey,offlineMp4Candidates,type OfflineMovieMeta} from '@/lib/offline-video';
import {directMovieFileName,isDirectMp4Response} from '@/lib/direct-video-file';

type Film = {id:number;title:string;url?:string;badge?:string};
type State = 'idle'|'saving'|'saved'|'error';

const MAX_SIZE=1_500_000_000; // avoid unexpectedly filling a mobile device
const MAX_DIRECT_FILE_SIZE=4_000_000_000;

type FileSaveWindow = Window & {
  showSaveFilePicker?: (options:{
    suggestedName:string;
    types:Array<{description:string;accept:Record<string,string[]>}>;
  })=>Promise<{createWritable:()=>Promise<WritableStream<Uint8Array>>}>;
};

export default function OfflineDownloadButton({film}:{film:Film}) {
  const [state,setState]=useState<State>('idle');
  const [message,setMessage]=useState('');
  const [supported,setSupported]=useState(true);
  const [fileBusy,setFileBusy]=useState(false);
  useEffect(()=>{
    const available=typeof window!=='undefined'&&'caches' in window&&'serviceWorker' in navigator;
    setSupported(available);
    if(!available)return;
    let alive=true;
    void caches.open(OFFLINE_MOVIE_CACHE).then(async cache=>{
      const meta=await cache.match(offlineMetaKey(film.id));
      const saved=await meta?.json().catch(()=>null) as OfflineMovieMeta | null | undefined;
      if(!alive)return;
      if(saved?.expiresAt && saved.expiresAt>Date.now() && await cache.match(offlineMovieKey(film.id)))setState('saved');
    }).catch(()=>{});
    return ()=>{alive=false;};
  },[film.id]);

  const download=async()=>{
    if(state==='saving')return;
    setMessage('');
    if(!supported){setState('error');setMessage('Энэ хөтөч кино офлайн хадгалах боломжгүй байна. Chrome эсвэл Safari-ийн шинэ хувилбар ашиглана уу.');return;}
    if(!navigator.onLine){setState('error');setMessage('Киног хадгалахын тулд эхлээд интернэтэд холбогдоно уу.');return;}
    const candidates=offlineMp4Candidates(film.url||'');
    if(!candidates.length){setState('error');setMessage('Энэ видеоны формат офлайн хадгалах боломжгүй байна. MP4 файлын холбоос шаардлагатай.');return;}
    setState('saving');setMessage('Киног төхөөрөмж дээр татаж хадгалж байна. Хуудсаа хаахгүй байгаарай.');
    try {
      // Always check the user's current payment rights before storing content.
      // Do not rely on client-provided movie/plan/expiry values.
      const auth=await fetch('/api/access',{cache:'no-store',credentials:'same-origin'});
      if(!auth.ok)throw new Error('Үзэх эрхээ шалгаж чадсангүй. Интернэтээ шалгана уу.');
      const data=await auth.json() as {access?:Record<string,number>};
      const expiresAt=offlineExpiry(data.access||{},film.id,film.badge);
      if(!expiresAt)throw new Error('Энэ киног татах хүчинтэй үзэх эрх олдсонгүй.');
      const cache=await caches.open(OFFLINE_MOVIE_CACHE);
      let saved=false;
      let bytes=0;
      for(const url of candidates){
        let response:Response;
        try {
          response=await fetch(url,{mode:'cors',credentials:'omit',redirect:'error',cache:'no-store'});
        } catch {continue;}
        if(!response.ok||response.type==='opaque'||!response.body)continue;
        const mediaType=response.headers.get('content-type')||'';
        if(!(/video\/(mp4|x-m4v)/i.test(mediaType)||/application\/octet-stream/i.test(mediaType)))continue;
        const size=Number(response.headers.get('content-length')||0);
        if(!Number.isFinite(size)||size<0||size>MAX_SIZE)continue;
        try {
          const estimate=await navigator.storage?.estimate?.();
          if(size>0 && estimate?.quota && estimate?.usage!==undefined &&
             estimate.quota-estimate.usage < size*1.05)throw new Error('Утасны санах ой хүрэлцэхгүй байна. Сул зай гаргаад дахин оролдоно уу.');
          await cache.put(offlineMovieKey(film.id),response);
          saved=true;bytes=size;break;
        }catch(err){
          if(err instanceof Error && /санах ой/.test(err.message))throw err;
          // QuotaExceededError and interrupted downloads should not leave a
          // usable metadata record or an apparently completed offline movie.
          await cache.delete(offlineMovieKey(film.id)).catch(()=>{});
          if(err instanceof DOMException && err.name==='QuotaExceededError')
            throw new Error('Утасны хадгалах зай хүрэлцэхгүй байна. Сул зай гаргаад дахин оролдоно уу.');
        }
      }
      if(!saved)throw new Error('Bunny.net-д энэ киноны MP4 хувилбар бэлэн биш эсвэл татах эрх хаалттай байна. Админ MP4 Fallback-ийг шалгах шаардлагатай.');
      const meta:OfflineMovieMeta={
        filmId:film.id,title:film.title.slice(0,160),expiresAt,storedAt:Date.now(),size:bytes
      };
      try {
        await cache.put(offlineMetaKey(film.id),new Response(JSON.stringify(meta),{headers:{'content-type':'application/json; charset=utf-8'}}));
      }catch(err){
        await cache.delete(offlineMovieKey(film.id)).catch(()=>{});
        throw err;
      }
      void navigator.storage?.persist?.().catch(()=>{});
      setState('saved');setMessage('Амжилттай хадгаллаа! Интернэтгүй үед «Татсан кино» хэсгээс үзнэ.');
    }catch(err){
      setState('error');
      setMessage(err instanceof Error?err.message:'Татаж хадгалж чадсангүй. Дахин оролдоно уу.');
    }
  };


  // Save a REAL .mp4 in the person's chosen Downloads/files folder.
  // Unlike the in-app offline copy, this file can be shared and is NOT DRM protected.
  const saveDirectFile=async()=>{
    if(fileBusy||state==='saving')return;
    setMessage('');
    if(!navigator.onLine){
      setState('error');setMessage('MP4 файл татахын тулд интернэтэд холбогдоно уу.');return;
    }
    const filename=directMovieFileName(film.title);
    const authorizedCandidates=offlineMp4Candidates(film.url||'');
    if(!authorizedCandidates.length){
      setState('error');setMessage('Энэ киноны MP4 файл татах холбоос олдсонгүй.');return;
    }
    const picker=(window as FileSaveWindow).showSaveFilePicker;
    if(!picker){
      // Safari / Firefox do not offer the native file picker. Use a
      // same-origin authorized redirect rather than leaking a raw MP4 URL in
      // a direct anchor. The native media player may require Save to Files.
      const link=document.createElement('a');
      link.href=`/api/direct-download?id=${film.id}`;link.target='_blank';link.rel='noopener noreferrer';
      document.body.appendChild(link);link.click();link.remove();
      setState('idle');
      setMessage('Таны хөтөч файл сонгож хадгалах цонх дэмжихгүй. Видео шинэ цонхонд нээгдсэн бол цэснээс «Татах» эсвэл «Save to Files»-ийг сонгоно уу. Хэрэв 403 гарвал Bunny-ийн MP4 хандалтыг шалгах хэрэгтэй.');
      return;
    }

    // Must be called before the first await: file picker requires a direct
    // user gesture (the browser rejects a picker opened after a network call).
    let handlePromise:ReturnType<NonNullable<FileSaveWindow['showSaveFilePicker']>>;
    try {
      handlePromise=picker.call(window,{suggestedName:filename,types:[{description:'MP4 кино',accept:{'video/mp4':['.mp4']}}]});
    }catch(error){
      setState('error');setMessage('Файл хадгалах цонх нээгдсэнгүй. Chrome эсвэл Edge-д татаж үзнэ үү.');return;
    }
    setFileBusy(true);setState('idle');setMessage('MP4 файл татаж байна. Бүрэн дуустал энэ цонхыг хаахгүй байгаарай.');
    try{
      const handle=await handlePromise;
      // Re-check the viewer's current session and entitlement on the server.
      // We never fetch an arbitrary URL from untrusted client input here.
      const result=await fetch(`/api/playback?id=${film.id}`,{cache:'no-store',credentials:'same-origin'});
      if(!result.ok)throw new Error('Киноны төлбөртэй үзэх эрхийг дахин баталгаажуулж чадсангүй.');
      const current=await result.json() as {url?:string};
      const candidates=offlineMp4Candidates(String(current.url||''));
      if(!candidates.length)throw new Error('Энэ кинонд татаж болох MP4 холбоос байхгүй байна.');
      let completed=false;
      for(const url of candidates){
        let response:Response;
        try{response=await fetch(url,{mode:'cors',credentials:'omit',redirect:'error',cache:'no-store'});}
        catch{continue;}
        if(!isDirectMp4Response(response)){await response.body?.cancel().catch(()=>{});continue;}
        const length=Number(response.headers.get('content-length')||0);
        if(!Number.isFinite(length)||length<0||length>MAX_DIRECT_FILE_SIZE){await response.body?.cancel().catch(()=>{});continue;}
        const writable=await handle.createWritable();
        let bytes=0;
        try{
          const limiter=new TransformStream<Uint8Array,Uint8Array>({
            transform(chunk,controller){
              bytes+=chunk.byteLength;
              if(bytes>MAX_DIRECT_FILE_SIZE)throw new Error('Киноны хэмжээ 4 GB-ээс их байна. Админд мэдэгдэнэ үү.');
              controller.enqueue(chunk);
            }
          });
          await response.body!.pipeThrough(limiter).pipeTo(writable);
          completed=true;
          break;
        }catch(error){
          try{await writable.abort();}catch{}
          throw error;
        }
      }
      if(!completed)throw new Error('Bunny.net дээр энэ киноны MP4 файлыг татаж чадсангүй. Файлын холбоос, CORS, Security тохиргоог шалгах шаардлагатай.');
      setMessage(`«${filename}» файлыг хадгаллаа. Одоо Downloads/Files дотроос интернэтгүй үзэж болно. Файл үзэх эрх дууссанаар автоматаар устахгүй, бусдад хуваалцах боломжтой.`);
    }catch(error){
      if(error instanceof DOMException && error.name==='AbortError'){
        setMessage('Файл татах үйлдлийг цуцаллаа.');
      }else{
        setState('error');
        setMessage(error instanceof Error?error.message:'Файл татахад алдаа гарлаа.');
      }
    }finally{setFileBusy(false);}
  };

  return <div className="taza-offline-controls">
    <div className="taza-offline-buttons">
      <button type="button" disabled={state==='saving'||fileBusy} onClick={()=>void download()} aria-busy={state==='saving'} className="taza-offline-button">
        {state==='saving'?'⏳ Татаж байна…':state==='saved'?'✓ Дахин хадгалах':'⬇ Татаж хадгалах'}
      </button>
      <button type="button" disabled={state==='saving'||fileBusy} onClick={()=>void saveDirectFile()} aria-busy={fileBusy} className="taza-offline-button taza-direct-download">
        {fileBusy?'⏳ MP4 татаж байна…':'⬇ MP4 файл татах'}
      </button>
      <a className="taza-offline-button taza-offline-library" href="/offline.html">📁 Татсан кино</a>
    </div>
    {message&&<p className={state==='error'?'taza-offline-warning':'taza-offline-message'} role="status">{message}</p>}
  </div>;
}
