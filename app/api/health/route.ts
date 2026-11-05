import {json} from '@/lib/server';
import {APP_VERSION} from '@/lib/readiness';
export const dynamic='force-dynamic';
// Liveness only. Full readiness requires an authenticated admin check.
// A short, non-secret deployment revision makes it easy to detect stale deploys.
export async function GET(){
  const revision=process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,12)||null;
  return json({ok:true,version:APP_VERSION,revision});
}
