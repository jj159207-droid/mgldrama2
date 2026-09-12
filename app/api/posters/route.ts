import { NextRequest } from 'next/server';
import { ApiError,bodyBytes,fail,json,originCheck,session } from '@/lib/server';
import { MAX_POSTER_INPUT,storePoster } from '@/lib/posters';
export const runtime='nodejs';
export async function POST(req:NextRequest){
  try{
    originCheck(req);
    if(!(await session(req))?.admin)throw new ApiError(403,'Зураг оруулахад админаар нэвтэрнэ үү.');
    const type=req.headers.get('content-type')?.split(';')[0].trim();
    if(!['image/jpeg','image/png','image/webp','image/gif'].includes(type||''))throw new ApiError(415,'PNG, JPEG, WebP эсвэл GIF зураг сонгоно уу.');
    return json(await storePoster(await bodyBytes(req,MAX_POSTER_INPUT)));
  }catch(error){return fail(error);}
}
