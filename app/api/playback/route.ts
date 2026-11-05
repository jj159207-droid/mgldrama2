import { NextRequest } from 'next/server';
import { ApiError,canAdminSite,db,fail,json,requestSite,session } from '@/lib/server';
import { canWatch,safeUrl } from '@/lib/domain';
import { entitlementPayments } from '@/lib/payments';
export const runtime='nodejs';
export async function GET(req:NextRequest) {
 try {
  const site=requestSite(req),id=Number(new URL(req.url).searchParams.get('id'));
  if(!Number.isSafeInteger(id)||id<=0)throw new ApiError(400,'Киноны ID буруу.');
  const [film]=await db(`films?id=eq.${id}&site_id=eq.${site}&select=*`);if(!film)throw new ApiError(404,'Кино олдсонгүй.');
  // Browsing is public, but *full movie URLs* are always protected.
  // Paid TAZA access is tied to the viewer's session/device; old valid grants
  // continue to work. Admin access remains authenticated and separate.
  const s=await session(req);
  const isAdmin=canAdminSite(s,site);
  if(!s?.userId && !isAdmin)throw new ApiError(403,'Бүх киног үзэх 12,000₮ / 30 хоногийн эрх шаардлагатай.','SUBSCRIPTION_REQUIRED');
  if(!isAdmin){
    const payments=await entitlementPayments(Number(s?.userId),site);
    const required=site==='taza'?{...film,free:false,locked:true}:film;
    if(!canWatch(required,payments))
      throw new ApiError(403,site==='taza'?'Бүх киног үзэх 12,000₮ / 30 хоногийн эрх шаардлагатай.':'Кино үзэх эрх байхгүй эсвэл хугацаа дууссан.','SUBSCRIPTION_REQUIRED');
  }
  const url=safeUrl(String(film.url||'').split('|||')[0]);
  if(!url)throw new ApiError(404,'Видео холбоос байхгүй эсвэл буруу байна.');
  return json({...film,url,locked:false,site_id:site});
 }catch(e){return fail(e);}
}
