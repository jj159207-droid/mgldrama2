import { NextRequest } from 'next/server';
import { ApiError,bodyBytes,canAdminSite,fail,json,originCheck,requestSite,session } from '@/lib/server';
import { MAX_POSTER_INPUT,storePoster } from '@/lib/posters';
export const runtime='nodejs';
export async function POST(req:NextRequest){
  try{
    originCheck(req);
    const site=requestSite(req),s=await session(req);
    if(!canAdminSite(s,site))throw new ApiError(403,'Энэ сайтын админы эрх шаардлагатай.');
    const type=req.headers.get('content-type')?.split(';')[0].trim();
    if(!['image/jpeg','image/png','image/webp','image/gif'].includes(type||''))throw new ApiError(415,'PNG, JPEG, WebP эсвэл GIF зураг сонгоно уу.');
    return json(await storePoster(await bodyBytes(req,MAX_POSTER_INPUT)));
  }catch(error){return fail(error);}
}
