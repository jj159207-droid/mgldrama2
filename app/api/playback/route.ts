import { NextRequest } from 'next/server';
import { ApiError,canAdminSite,db,fail,json,requestSite,session } from '@/lib/server';
import { canWatch,paymentExpiry,safeUrl,tazaPackQuota } from '@/lib/domain';
import { claimTazaFilm } from '@/lib/taza-bundles';
import { entitlementPayments } from '@/lib/payments';
export const runtime='nodejs';
export async function GET(req:NextRequest) {
 try {
  const site=requestSite(req),id=Number(new URL(req.url).searchParams.get('id'));
  if(!Number.isSafeInteger(id)||id<=0)throw new ApiError(400,'Киноны ID буруу.');
  const [film]=await db(`films?id=eq.${id}&site_id=eq.${site}&select=*`);if(!film)throw new ApiError(404,'Киноны бүртгэл олдсонгүй. Админ киноны ID-г шалгана уу.','FILM_NOT_FOUND');
  // Browsing is public, but *full movie URLs* are always protected.
  // Paid TAZA access is tied to the viewer's session/device; old valid grants
  // continue to work. Admin access remains authenticated and separate.
  const s=await session(req);
  const isAdmin=canAdminSite(s,site);
  const url=safeUrl(String(film.url||'').split('|||')[0]);
  if(!s?.userId && !isAdmin)throw new ApiError(403,'Кино үзэх багц сонгож төлбөрөө баталгаажуулна уу.','SUBSCRIPTION_REQUIRED');
  if(!isAdmin){
    const payments=await entitlementPayments(Number(s?.userId),site);
    const required=site==='taza'?{...film,free:false,locked:true}:film;
    if(!canWatch(required,payments)) {
      // Never consume a paid movie credit when the video link is missing.
      if(!url)throw new ApiError(404,'Энэ киноны видео холбоос байхгүй. Үзэх эрх хасагдаагүй. Админд мэдэгдэнэ үү.','VIDEO_SOURCE_MISSING');
      const hasCredits=site==='taza' && payments.some(p=>tazaPackQuota(String(p.plan||''))>0 && paymentExpiry(p)>Date.now());
      if(!hasCredits || !await claimTazaFilm(Number(s!.userId),id))
        throw new ApiError(403,site==='taza'?'3 кино, 6 кино эсвэл бүх киноны үзэх багц шаардлагатай.':'Кино үзэх эрх байхгүй эсвэл хугацаа дууссан.','SUBSCRIPTION_REQUIRED');
    }
  }
  if(!url)throw new ApiError(404,'Энэ киноны бүтэн видео холбоос байхгүй эсвэл буруу байна. Дахин төлбөр хийхгүй, админд киноны нэрийг мэдэгдэнэ үү.','VIDEO_SOURCE_MISSING');
  return json({...film,url,locked:false,site_id:site});
 }catch(e){return fail(e);}
}
