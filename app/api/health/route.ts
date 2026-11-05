import {json} from '@/lib/server';
import {APP_VERSION} from '@/lib/readiness';
export const dynamic='force-dynamic';
// Liveness only. Full readiness requires an authenticated admin check.
export async function GET(){return json({ok:true,version:APP_VERSION});}
