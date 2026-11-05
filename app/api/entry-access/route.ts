import { NextRequest } from 'next/server';
import { fail, json, requestSite } from '@/lib/server';

export const runtime = 'nodejs';

/**
 * Legacy entry endpoint retained for existing clients. The catalog is now
 * free to browse. Film playback still checks per-film or valid bundle access.
 */
export async function GET(req: NextRequest) {
  try {
    return json({ allowed: true, reason: 'catalog_public', site: requestSite(req) });
  } catch (error) { return fail(error); }
}
