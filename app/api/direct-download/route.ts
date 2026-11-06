import {NextRequest} from 'next/server';
import {GET as grantedPlayback} from '@/app/api/playback/route';
import {offlineMp4Candidates} from '@/lib/offline-video';
import {ApiError,fail,requestSite} from '@/lib/server';

export const runtime='nodejs';
export const dynamic='force-dynamic';

/**
 * Native browser fallback for Safari / Firefox which cannot use
 * showSaveFilePicker. Redirect only after the regular playback permission
 * check; this does not proxy the large movie through the Vercel function.
 *
 * The final Bunny MP4 may open in a browser media player rather than directly
 * download. Users can then use the browser Share / Save to Files action.
 */
export async function GET(req:NextRequest) {
  try {
    if(requestSite(req)!=='taza')throw new ApiError(404,'Энэ үйлчилгээ зөвхөн TAZA-д байна.');
    const playback=await grantedPlayback(req);
    if(!playback.ok)return playback;
    const item=await playback.json() as {url?:string};
    const urls=offlineMp4Candidates(String(item.url||''));
    if(!urls.length)throw new ApiError(404,'Энэ киноны MP4 холбоос байхгүй.','MP4_NOT_FOUND');
    return new Response(null,{status:302,headers:{
      Location:urls[0],
      'Cache-Control':'private, no-store, max-age=0',
      'Referrer-Policy':'strict-origin-when-cross-origin',
      'X-Robots-Tag':'noindex, nofollow'
    }});
  }catch(error){return fail(error);}
}
