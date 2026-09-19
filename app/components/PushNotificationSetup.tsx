'use client';
import { useCallback, useEffect, useState } from 'react';
import { requestJson } from '@/lib/client';

function applicationKey(value:string) {
  const pad='='.repeat((4-value.length%4)%4);
  const base64=(value+pad).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64);
  const bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return bytes;
}

export default function PushNotificationSetup({enabled}:{enabled:boolean}) {
  const [visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');

  const subscribe=useCallback(async()=>{
    if(!enabled || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))return false;
    const cfg=await requestJson('/api/push',{},true);
    if(!cfg?.supported||typeof cfg.publicKey!=='string')return false;
    const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
    await navigator.serviceWorker.ready;
    let sub=await registration.pushManager.getSubscription();
    if(!sub)sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:applicationKey(cfg.publicKey)});
    const data=sub.toJSON();
    await requestJson('/api/push',{method:'POST',body:JSON.stringify(data)},true);
    return true;
  },[enabled]);

  useEffect(()=>{
    if(!enabled){setVisible(false);return;}
    if(!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window)){setVisible(false);return;}
    if(Notification.permission==='granted'){
      setVisible(false);void subscribe().catch(()=>{});
    }else if(Notification.permission==='default')setVisible(true);
    else setVisible(false);
  },[enabled,subscribe]);

  const enablePush=async()=>{
    if(busy)return;
    setBusy(true);setError('');
    try {
      const permission=await Notification.requestPermission();
      if(permission!=='granted'){setVisible(false);return;}
      const ok=await subscribe();
      if(!ok)throw new Error('Мэдэгдлийг идэвхжүүлж чадсангүй.');
      setVisible(false);
    } catch(e){setError(e instanceof Error?e.message:'Мэдэгдлийг идэвхжүүлж чадсангүй.');}
    finally{setBusy(false);}
  };

  if(!visible&&!error)return null;
  return <div className="push-opt-in" role="status">
    <button type="button" onClick={()=>void enablePush()} disabled={busy}>{busy?'Идэвхжүүлж байна…':'🔔 Админы мессежийн мэдэгдэл авах'}</button>
    {error&&<span>{error}</span>}
  </div>;
}
