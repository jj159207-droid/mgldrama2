import { NextRequest } from 'next/server';
import { ApiError,db,fail,json,requestSite,session } from '@/lib/server';
import { canWatch,safeUrl } from '@/lib/domain';
import { entitlementPayments } from '@/lib/payments';
export const runtime='nodejs';
export async function GET(req:NextRequest) {
 try {
  const site=requestSite(req),id=Number(new URL(req.url).searchParams.get('id'));
  if(!Number.isSafeInteger(id)||id<=0)throw new ApiError(400,'Киноны ID буруу.');
  const [film]=await db(`films?id=eq.${id}&site_id=eq.${site}&select=*`);if(!film)throw new ApiError(404,'Кино олдсонгүй.');
  const s=await session(req);
  if(!s?.userId)throw new ApiError(403,'Кино үзэхийн тулд хэрэглэгчийн горимоор нэвтэрнэ үү.');
  const payments=film.free!==true && film.locked!==false ? await entitlementPayments(s.userId,site) : [];
  if(!canWatch(film,payments))throw new ApiError(403,'Кино үзэх эрх байхгүй эсвэл хугацаа дууссан.');
  const url=safeUrl(String(film.url||'').split('|||')[0]);
  if(!url)throw new ApiError(404,'Видео холбоос байхгүй эсвэл буруу байна.');
  return json({...film,url,locked:false,site_id:site});
 }catch(e){return fail(e);}
}
