import { NextRequest } from 'next/server';
import { ApiError,bodyJson,db,fail,json,originCheck,passwordHash,session } from '@/lib/server';
import { isSiteId } from '@/lib/site';

export const runtime='nodejs';

async function master(req:NextRequest) {
  const s=await session(req);
  if(!s?.admin||!s.masterAdmin)throw new ApiError(403,'Үндсэн админы эрх шаардлагатай.');
  return s;
}

export async function GET(req:NextRequest) {
  try {
    await master(req);
    const rows=await db('site_admins?active=eq.true&select=id,site_id,label,created_at,updated_at&order=site_id.asc');
    return json({admins:rows});
  } catch(error){return fail(error);}
}

export async function PUT(req:NextRequest) {
  try {
    originCheck(req);await master(req);
    const b=await bodyJson(req,4096);
    const site=String(b.site||''),label=String(b.label||'').trim(),password=String(b.password||'');
    if(!isSiteId(site)||site==='taza')throw new ApiError(400,'Шинэ 3 сайтын аль нэгийг сонгоно уу.');
    if(label.length<1||label.length>80)throw new ApiError(400,'Админы нэр 1–80 тэмдэгт байна.');
    if(password.length<8||password.length>128)throw new ApiError(400,'Нууц үг 8–128 тэмдэгт байна.');

    const hash=passwordHash(password);
    const [existing]=await db(`site_admins?site_id=eq.${site}&active=eq.true&select=id&limit=1`);
    if(existing){
      await db(`site_admins?id=eq.${existing.id}`,'PATCH',{label,password_hash:hash,updated_at:new Date().toISOString()});
    }else{
      await db('site_admins','POST',{site_id:site,label,password_hash:hash,active:true});
    }
    return json({ok:true,site,label});
  } catch(error){return fail(error);}
}
