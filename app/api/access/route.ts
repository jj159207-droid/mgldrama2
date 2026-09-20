import { NextRequest } from 'next/server';
import { accessFromPayments } from '@/lib/domain';
import { entitlementPayments } from '@/lib/payments';
import { fail, json, requestSite, session } from '@/lib/server';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  try {
    const site=requestSite(req),s = await session(req);
    return json({ site, access: s?.userId ? accessFromPayments(await entitlementPayments(s.userId,site)) : {} });
  } catch (e) { return fail(e); }
}
