import { NextRequest } from 'next/server';
import { ApiError, bodyJson, db, fail, json, originCheck, requestSite, session } from '@/lib/server';
import { validPushEndpoint } from '@/lib/push';

export const runtime='nodejs';

function text(value:unknown,max:number) {
  return typeof value==='string' && value.length<=max ? value : '';
}

export async function GET(req:NextRequest) {
  try {
    const site=requestSite(req),s=await session(req);
    if(!s?.userId || s.admin)throw new ApiError(401,'Хэрэглэгчийн нэвтрэлт шаардлагатай.');
    const [cfg]=await db('push_vapid_config?id=eq.1&select=public_key&limit=1');
    if(!cfg?.public_key)return json({supported:false});
    return json({supported:true,publicKey:cfg.public_key,site});
  } catch(error){return fail(error);}
}

export async function POST(req:NextRequest) {
  try {
    originCheck(req);
    const site=requestSite(req),s=await session(req);
    if(!s?.userId || s.admin)throw new ApiError(401,'Хэрэглэгчийн нэвтрэлт шаардлагатай.');
    const b=await bodyJson(req,10000);
    const endpoint=text(b.endpoint,2200);
    const keys=b.keys && typeof b.keys==='object' ? b.keys as Record<string,unknown> : {};
    const p256dh=text(keys.p256dh,500),auth=text(keys.auth,300);
    if(!validPushEndpoint(endpoint)||!p256dh||!auth)throw new ApiError(400,'Push subscription буруу байна.');

    const [old]=await db(`push_subscriptions?site_id=eq.${site}&endpoint=eq.${encodeURIComponent(endpoint)}&select=id&limit=1`);
    const payload={user_id:s.userId,site_id:site,endpoint,p256dh,auth,updated_at:new Date().toISOString()};
    if(old?.id)await db(`push_subscriptions?id=eq.${old.id}`,'PATCH',payload);
    else {
      try {await db('push_subscriptions','POST',payload);}
      catch(error) {
        if(!(error instanceof ApiError)||error.code!=='23505')throw error;
        const [saved]=await db(`push_subscriptions?site_id=eq.${site}&endpoint=eq.${encodeURIComponent(endpoint)}&select=id&limit=1`);
        if(!saved?.id)throw error;
        await db(`push_subscriptions?id=eq.${saved.id}`,'PATCH',payload);
      }
    }
    return json({ok:true});
  } catch(error){return fail(error);}
}

export async function DELETE(req:NextRequest) {
  try {
    originCheck(req);
    const site=requestSite(req),s=await session(req);
    if(!s?.userId || s.admin)throw new ApiError(401,'Хэрэглэгчийн нэвтрэлт шаардлагатай.');
    const b=await bodyJson(req,5000),endpoint=text(b.endpoint,2200);
    if(!validPushEndpoint(endpoint))throw new ApiError(400,'Push subscription буруу байна.');
    await db(`push_subscriptions?site_id=eq.${site}&user_id=eq.${s.userId}&endpoint=eq.${encodeURIComponent(endpoint)}`,'DELETE');
    return json({ok:true});
  } catch(error){return fail(error);}
}
