import { NextRequest } from 'next/server';
import { ApiError, bodyJson, canAdminSite, db, fail, json, originCheck, requestSite } from '@/lib/server';
import { chatOwner, chatRequestId, chatSession } from '@/lib/chat';
import { sendPushToUser } from '@/lib/push';
export const runtime='nodejs';

export async function GET(req:NextRequest) {
  try {
    const site=requestSite(req),s=await chatSession(req);
    if(!canAdminSite(s,site))throw new ApiError(403,'Энэ сайтын админы эрх шаардлагатай.');
    const owner=chatOwner(s,req.nextUrl.searchParams.get('user'));
    const [[row],subscriptions]=await Promise.all([
      db('rpc/kino_wallet_balance_site','POST',{p_user:owner,p_site:site}),
      db(`push_subscriptions?site_id=eq.${site}&user_id=eq.${owner}&select=id&limit=1`)
    ]);
    return json({balance:Number(row?.balance||0),pushEnabled:subscriptions.length>0,site});
  } catch(error){return fail(error);}
}

export async function POST(req:NextRequest) {
  try {
    originCheck(req);
    const site=requestSite(req),s=await chatSession(req);
    if(!canAdminSite(s,site))throw new ApiError(403,'Энэ сайтын админы эрх шаардлагатай.');
    const b=await bodyJson(req,2000),owner=chatOwner(s,b.user),amount=Number(b.amount);
    if(Object.keys(b).some(k=>!['user','amount','request_id'].includes(k))||!Number.isSafeInteger(amount)||amount<1000||amount>500000)
      throw new ApiError(400,'1,000₮-өөс 500,000₮ хүртэл бүхэл дүн оруулна уу.');
    const [credit]=await db('rpc/kino_chat_wallet_credit_site','POST',{
      p_site:site,p_user:owner,p_amount:amount,p_request:chatRequestId(b.request_id)
    });
    await sendPushToUser(owner,site);
    return json({credit,site});
  } catch(error) {
    if(error instanceof ApiError&&error.code==='P0404')return json({message:'Энэ сайтын хэрэглэгч олдсонгүй.'},404);
    if(error instanceof ApiError&&error.code==='P0409')return json({message:'Энэ мөнгө нэмэх хүсэлт өөрчлөгдсөн байна.'},409);
    return fail(error);
  }
}
