import { NextRequest } from 'next/server';
import { accessFromPayments } from '@/lib/domain';
import { entitlementPayments } from '@/lib/payments';
import { tazaBundleAccess } from '@/lib/taza-bundles';
import { fail, json, requestSite, session } from '@/lib/server';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  try {
    const site=requestSite(req),s = await session(req);
    if(!s?.userId)return json({site,access:{},bundleRemaining:0});
    const payments=await entitlementPayments(s.userId,site);
    const access=accessFromPayments(payments);
    let bundleRemaining=0;
    if(site==='taza') {
      const credits=await tazaBundleAccess(s.userId,payments);
      Object.assign(access,credits.access);
      bundleRemaining=credits.remaining;
    }
    return json({site,access,bundleRemaining});
  } catch (e) { return fail(e); }
}
