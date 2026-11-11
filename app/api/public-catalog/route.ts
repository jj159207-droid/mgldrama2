import {NextRequest} from 'next/server';
import {ApiError,db,fail} from '@/lib/server';

// Public, user-independent TAZA metadata only. NEVER expose full movie URLs,
// signed playback links, payment records, or account/entitlement information.
// Serving the same sanitized catalog to all visitors makes brief CDN caching
// safe even if Facebook/Messenger includes cookies on an ad click.
export const runtime='nodejs';
const FIELDS='id,title,description,views,op,price,badge,free,locked,img,bg,preview_url,created_at';
const PAGE_SIZE=200;
const MAX_MOVIES=2000;
export async function GET(_req:NextRequest) {
  try {
    const films:Record<string,unknown>[]=[];
    let cursor=Number.MAX_SAFE_INTEGER;
    for (;;) {
      const batch=await db('films?site_id=eq.taza&id=lt.'+cursor+'&select='+FIELDS+'&order=id.desc&limit='+PAGE_SIZE);
      if (!batch.length) break;
      const last=Number(batch[batch.length-1]?.id);
      if(!Number.isSafeInteger(last)||last<=0||last>=cursor)
        throw new ApiError(502,'Киноны жагсаалтын эрэмбэ буруу байна.');
      films.push(...batch);
      if (films.length >= MAX_MOVIES) break;
      cursor=last;
    }
    return Response.json(films,{
      headers:{
        'Cache-Control':'public, s-maxage=60, stale-while-revalidate=300',
        'X-Content-Type-Options':'nosniff',
      },
    });
  } catch (error) {
    // Errors must not be cached and must not reveal database credentials.
    return fail(error);
  }
}
