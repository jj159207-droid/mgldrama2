import { NextRequest } from 'next/server';
import { ApiError, bodyJson, canAdminSite, db, fail, json, originCheck, requestSite } from '@/lib/server';
import { CHAT_INPUT_LIMIT, chatId, chatImage, chatMessage, chatOwner, chatSession } from '@/lib/chat';
import type { Row } from '@/lib/domain';
import { sendPushToUser } from '@/lib/push';
export const runtime = 'nodejs';

function assertSiteAdmin(s:any,site:any) {
  if(s.admin&&!canAdminSite(s,site))throw new ApiError(403,'Энэ сайтын админы эрх шаардлагатай.');
}

export async function GET(req: NextRequest) {
  try {
    const site=requestSite(req),s=await chatSession(req),q=req.nextUrl.searchParams;
    assertSiteAdmin(s,site);
    if(q.get('summary')==='1'){
      const [counts]=await db('rpc/kino_chat_unread_site','POST',{p_site:site,p_user:s.admin?null:s.userId,p_admin:s.admin});
      return json({unread:Number(counts?.unread||0),site});
    }
    if(q.get('inbox')==='1'){
      if(!canAdminSite(s,site))throw new ApiError(403,'Энэ сайтын админы эрх шаардлагатай.');
      const search=(q.get('q')||'').trim(),offset=Number(q.get('offset')||0);
      if(search.length>30||!/^[A-Za-z0-9 #_-]*$/.test(search)||!Number.isSafeInteger(offset)||offset<0||offset>1000000)
        throw new ApiError(400,'Хайлтын утга буруу.');
      const rows=await db('rpc/kino_chat_inbox_site','POST',{p_site:site,p_search:search,p_offset:offset});
      return json({threads:rows.slice(0,50),more:rows.length>50,site});
    }
    const owner=chatOwner(s,q.get('user'));
    const [view]=await db('rpc/kino_chat_view_site','POST',{p_site:site,p_user:owner,p_admin:s.admin});
    return json({messages:(view.messages as Row[]).map(chatMessage),peer_online:view.peer_online,peer_typing:view.peer_typing,site});
  } catch(error){return fail(error);}
}

export async function DELETE(req:NextRequest) {
  try {
    originCheck(req);
    const site=requestSite(req),s=await chatSession(req);
    if(!canAdminSite(s,site))throw new ApiError(403,'Энэ сайтын админы эрх шаардлагатай.');
    const b=await bodyJson(req,1000);
    if(Object.keys(b).some(k=>!['user','through'].includes(k)))throw new ApiError(400,'Устгах хүсэлтийн талбар буруу.');
    const [result]=await db('rpc/kino_chat_clear_site','POST',{p_site:site,p_user:chatOwner(s,b.user),p_through:chatId(b.through)});
    return json({ok:true,deleted:Number(result.deleted),site});
  } catch(error){return fail(error);}
}

export async function POST(req:NextRequest) {
  try {
    originCheck(req);
    const site=requestSite(req),s=await chatSession(req),b=await bodyJson(req,CHAT_INPUT_LIMIT);
    assertSiteAdmin(s,site);
    if(Object.keys(b).some(k=>!['user','message','image','client_id'].includes(k)))throw new ApiError(400,'Мессежийн талбар буруу.');
    const owner=chatOwner(s,b.user);
    if(typeof b.message!=='string'||b.message.trim().length>2000||/\u0000/.test(b.message))throw new ApiError(400,'2000 хүртэл тэмдэгт бичнэ үү.');
    if(typeof b.client_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.client_id))
      throw new ApiError(400,'Мессежийн дугаар буруу.');
    const image=await chatImage(b.image);
    if(!b.message.trim()&&!image)throw new ApiError(400,'Мессеж бичих эсвэл зураг сонгоно уу.');
    const rows=await db('rpc/kino_chat_send_site','POST',{
      p_site:site,p_user:owner,p_sender:s.admin?'admin':'user',p_message:b.message.trim(),p_image:image,p_client:b.client_id
    });
    if(s.admin)await sendPushToUser(owner,site);
    return json({message:chatMessage(rows[0]),site});
  } catch(error) {
    if(error instanceof ApiError&&error.code==='P0429')return json({message:'Хэт олон мессеж илгээсэн байна. Нэг минут хүлээгээрэй.'},429);
    return fail(error);
  }
}

export async function PATCH(req:NextRequest) {
  try {
    originCheck(req);
    const site=requestSite(req),s=await chatSession(req),b=await bodyJson(req,1000);
    assertSiteAdmin(s,site);
    if(Object.keys(b).some(k=>!['user','through'].includes(k)))throw new ApiError(400,'Уншсан төлөвийн талбар буруу.');
    const owner=chatOwner(s,b.user),through=chatId(b.through);
    await db(`support_messages?site_id=eq.${site}&user_id=eq.${owner}&sender=eq.${s.admin?'user':'admin'}&id=lte.${through}&read_at=is.null`,'PATCH',{read_at:new Date().toISOString()});
    return json({ok:true,site});
  } catch(error){return fail(error);}
}
