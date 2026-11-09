import { NextRequest } from 'next/server';
import { ApiError, fail, originCheck, requestSite, session } from '@/lib/server';
import macroTemplate from '@/lib/macrodroid-template.json';

export const runtime='nodejs';
export const dynamic='force-dynamic';

// The user requested this as a temporary download. In Ulaanbaatar time the
// link stops working at the end of 12 November 2026.
const DOWNLOAD_EXPIRES_AT=Date.parse('2026-11-12T15:59:59Z');

export async function GET(req:NextRequest) {
  try {
    // Downloaded macros contain an authorization secret that can approve
    // payment webhooks. Never serve the macro as a public static asset.
    if (requestSite(req)!=='taza') throw new ApiError(404,'TAZA-д зориулсан файл олдсонгүй.');
    originCheck(req);
    const active=await session(req);
    if(!active?.admin || !active.masterAdmin)throw new ApiError(403,'TAZA үндсэн админы нэвтрэлт шаардлагатай.');
    if(Date.now()>DOWNLOAD_EXPIRES_AT)throw new ApiError(410,'Түр MacroDroid татах хугацаа дууссан.');

    const secret=process.env.SMS_WEBHOOK_SECRET;
    if(!secret || secret.length<32)throw new ApiError(503,'SMS нууц түлхүүр серверт тохируулагдаагүй.','SMS_CONFIG_REQUIRED');

    // The template checked into the repository has no real credentials.
    // Inject the current production secret only in this authenticated,
    // non-cacheable download response.
    const macro=structuredClone(macroTemplate);
    const request=macro.macro.m_actionList[0].requestConfig;
    const auth=request.headerParams.find(h=>h.paramName==='Authorization');
    if(!auth || auth.paramValue!=='Bearer __TAZA_SMS_SECRET_SERVER_ONLY__'){
      throw new ApiError(503,'MacroDroid загварын тохиргоо буруу.','MACRO_TEMPLATE_ERROR');
    }
    auth.paramValue=`Bearer ${secret}`;

    return new Response(JSON.stringify(macro,null,2)+'\n',{
      status:200,
      headers:{
        'Content-Type':'application/octet-stream',
        'Content-Disposition':'attachment; filename="TAZA_MacroDroid_SMS_2000_12000.macro"',
        'Cache-Control':'private, no-store, max-age=0',
        'Pragma':'no-cache',
        'Surrogate-Control':'no-store',
        'X-Content-Type-Options':'nosniff',
        'X-Robots-Tag':'noindex, nofollow',
      }
    });
  } catch(error) {return fail(error);}
}
