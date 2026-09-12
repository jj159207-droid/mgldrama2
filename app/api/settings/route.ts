import { NextRequest } from 'next/server';
import { ApiError,bodyJson,db,fail,json,originCheck,session } from '@/lib/server';
import { isRow,safeUrl } from '@/lib/domain';
export const runtime='nodejs';
export async function GET() {
 try {
  const [row]=await db('sms_logs?key=eq.site_settings&select=value&order=id.desc&limit=1');
  let settings:unknown={};try{settings=JSON.parse(String(row?.value || '{}'));}catch{}
  return json({messengerUrl:isRow(settings)?safeUrl(settings.messengerUrl):''});
 }catch(e){
  if(e instanceof ApiError && ['42703','42P01','PGRST204','PGRST205'].includes(e.code))
   return json({messengerUrl:safeUrl(process.env.MESSENGER_URL),setupRequired:true});
  return fail(e);
 }
}
export async function PUT(req:NextRequest) {
 try {
  originCheck(req);
  if(!(await session(req))?.admin)throw new ApiError(403,'Админы эрх шаардлагатай.');
  const b=await bodyJson(req),url=safeUrl(b.messengerUrl);
  if(!url || url.length>2000)throw new ApiError(400,'Зөв HTTPS Messenger холбоос оруулна уу.');
  await db('rpc/kino_save_settings','POST',{settings_value:JSON.stringify({messengerUrl:url})});
  return json({messengerUrl:url});
 }catch(e){return fail(e);}
}
