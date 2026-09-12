import { NextRequest } from 'next/server';
import { accessFromPayments } from '@/lib/domain';
import { entitlementPayments } from '@/lib/payments';
import { fail, json, session } from '@/lib/server';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  try {
    const s = await session(req);
    return json({ access: s?.userId ? accessFromPayments(await entitlementPayments(s.userId)) : {} });
  } catch (e) { return fail(e); }
}
