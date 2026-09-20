import { NextRequest } from 'next/server';
import { ApiError, bodyJson, canAdminSite, db, fail, json, originCheck, requestSite } from '@/lib/server';
import { chatOwner, chatSession } from '@/lib/chat';
export const runtime='nodejs';

export async function POST(req:NextRequest) {
  try {
    originCheck(req);
    const site=requestSite(req),s=await chatSession(req),b=await bodyJson(req,1000);
    if(s.admin&&!canAdminSite(s,site))throw new ApiError(403,'Энэ сайтын админы эрх шаардлагатай.');
    if(Object.keys(b).some(k=>!['user','active','typing'].includes(k))||typeof b.active!=='boolean'||typeof b.typing!=='boolean')
      throw new ApiError(400,'Чатны төлөв буруу.');
    await db('rpc/kino_chat_activity_site','POST',{p_site:site,p_user:chatOwner(s,b.user),p_admin:s.admin,p_active:b.active,p_typing:b.typing});
    return json({ok:true,site});
  } catch(error){return fail(error);}
}
