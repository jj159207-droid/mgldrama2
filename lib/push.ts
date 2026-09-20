import { createPrivateKey, sign as cryptoSign } from 'node:crypto';
import { db } from '@/lib/server';
import type { SiteId } from '@/lib/site';

type PushConfig = {public_key:string; private_jwk:Record<string,string>; subject:string};
type PushSubscriptionRow = {id:number; endpoint:string};

function encodeJson(value:unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function validPushEndpoint(value:string) {
  try {
    const url=new URL(value);
    if(url.protocol!=='https:' || url.username || url.password || value.length>2200)return false;
    const host=url.hostname.toLowerCase();
    return host==='fcm.googleapis.com'
      || host==='updates.push.services.mozilla.com'
      || host.endsWith('.push.services.mozilla.com')
      || host==='web.push.apple.com'
      || host.endsWith('.notify.windows.com');
  } catch {return false;}
}

async function config():Promise<PushConfig|null> {
  const [row]=await db('push_vapid_config?id=eq.1&select=public_key,private_jwk,subject&limit=1');
  if(!row || typeof row.public_key!=='string' || typeof row.subject!=='string' || !row.private_jwk || typeof row.private_jwk!=='object')return null;
  return {public_key:row.public_key,private_jwk:row.private_jwk as Record<string,string>,subject:row.subject};
}

function vapidToken(endpoint:string,cfg:PushConfig) {
  const now=Math.floor(Date.now()/1000);
  const header=encodeJson({typ:'JWT',alg:'ES256'});
  const payload=encodeJson({aud:new URL(endpoint).origin,exp:now+6*3600,sub:cfg.subject});
  const unsigned=`${header}.${payload}`;
  const key=createPrivateKey({key:cfg.private_jwk as any,format:'jwk'});
  const signature=cryptoSign('sha256',Buffer.from(unsigned),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
  return `${unsigned}.${signature}`;
}

export async function sendPushToUser(userId:number,site:SiteId='taza') {
  if(!Number.isSafeInteger(userId)||userId<=0)return;
  const [cfg,rows]=await Promise.all([
    config(),
    db(`push_subscriptions?site_id=eq.${site}&user_id=eq.${userId}&select=id,endpoint&limit=20`)
  ]);
  if(!cfg || !rows.length)return;
  await Promise.allSettled(rows.map(async raw=>{
    const sub=raw as unknown as PushSubscriptionRow;
    if(!validPushEndpoint(String(sub.endpoint||''))){
      if(Number.isSafeInteger(Number(sub.id)))await db(`push_subscriptions?id=eq.${sub.id}`,'DELETE');
      return;
    }
    try {
      const response=await fetch(sub.endpoint,{
        method:'POST',
        headers:{
          TTL:'120',
          Urgency:'high',
          Authorization:`vapid t=${vapidToken(sub.endpoint,cfg)}, k=${cfg.public_key}`,
        },
        cache:'no-store',
        redirect:'error',
      });
      if(response.status===404||response.status===410)await db(`push_subscriptions?id=eq.${sub.id}`,'DELETE');
    } catch {
      // Push is best-effort. Chat delivery itself must never fail because a
      // browser push service is temporarily unavailable.
    }
  }));
}
