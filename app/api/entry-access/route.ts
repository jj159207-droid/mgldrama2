import { NextRequest } from 'next/server';
import { canAdminSite, fail, json, requestSite, session, siteEntryAllowed } from '@/lib/server';

export const runtime='nodejs';

export async function GET(req:NextRequest) {
  try {
    const site=requestSite(req),s=await session(req);
    if(site!=='taza')return json({allowed:true,reason:'not_gated',site});
    if(canAdminSite(s,site))return json({allowed:true,reason:'admin',site});
    const allowed=await siteEntryAllowed(s?.userId,site);
    return json({allowed,reason:allowed?'paid':'payment_required',site});
  } catch(error){return fail(error);}
}
