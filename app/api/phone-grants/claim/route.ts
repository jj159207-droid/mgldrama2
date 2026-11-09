import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { ApiError, bodyJson, db, fail, json, originCheck, rateLimit, requestSite } from '@/lib/server';
import { safeUrl } from '@/lib/domain';
import { PHONE_GRANT_COOKIE, PHONE_GRANT_SESSION_SECONDS, hashPhoneToken, phoneIsValid } from '@/lib/taza-phone-access';

export const runtime='nodejs';

export async function POST(req:NextRequest) {
  try {
    originCheck(req);
    if(requestSite(req)!=='taza')throw new ApiError(404,'Энэ эрх зөвхөн TAZA сайтад үйлчилнэ.');
    const body=await bodyJson(req,2048);
    const phone=body.phone;
    const filmId=Number(body.film_id);
    if(!phoneIsValid(phone)||!Number.isSafeInteger(filmId)||filmId<=0)
      throw new ApiError(400,'Утасны дугаар эсвэл киноны мэдээлэл буруу.');
    // Limit attempts per phone in the database, across all serverless instances.
    await rateLimit('taza-phone-entitlement:'+phone);
    const [film]=await db('films?id=eq.'+filmId+'&site_id=eq.taza&select=id,url&limit=1');
    if(!film)throw new ApiError(404,'Кино олдсонгүй.');
    if(!safeUrl(String(film.url||'').split('|||')[0]))
      throw new ApiError(404,'Энэ киноны бүтэн видео одоогоор байхгүй. Админд мэдэгдэнэ үү.','VIDEO_SOURCE_MISSING');

    let [grant]=await db('taza_phone_grants?site_id=eq.taza&phone=eq.'+phone+'&active=eq.true&select=id,access_type,film_id&limit=1');
    if(!grant)throw new ApiError(403,'Энэ дугаарт үзэх эрх нээгдээгүй байна. Админтай холбогдоно уу.','PHONE_GRANT_MISSING');
    if(grant.access_type==='single'&&grant.film_id===null){
      // Atomic compare-and-set: two simultaneous film claims cannot both win.
      await db('taza_phone_grants?id=eq.'+grant.id+'&site_id=eq.taza&active=eq.true&access_type=eq.single&film_id=is.null',
        'PATCH',{film_id:filmId,updated_at:new Date().toISOString()});
      [grant]=await db('taza_phone_grants?id=eq.'+grant.id+'&active=eq.true&select=id,access_type,film_id&limit=1');
    }
    if(!grant || (grant.access_type!=='all'&&!(grant.access_type==='single'&&Number(grant.film_id)===filmId)))
      throw new ApiError(403,'Энэ дугаарын 1 киноны эрх өмнө нь өөр кинонд ашиглагдсан байна. Админтай холбогдоно уу.','PHONE_GRANT_DIFFERENT_FILM');

    const token=randomBytes(32).toString('hex');
    await db('taza_phone_sessions','POST',{
      token_hash:hashPhoneToken(token),grant_id:grant.id,
      expires_at:new Date(Date.now()+PHONE_GRANT_SESSION_SECONDS*1000).toISOString()
    });
    const response=json({ok:true,access_type:grant.access_type});
    response.cookies.set(PHONE_GRANT_COOKIE,token,{
      httpOnly:true,secure:process.env.NODE_ENV==='production',
      sameSite:'lax',path:'/',maxAge:PHONE_GRANT_SESSION_SECONDS
    });
    return response;
  }catch(error){return fail(error);}
}
