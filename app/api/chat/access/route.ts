import { NextRequest } from 'next/server';
import { ApiError, bodyJson, db, fail, json, originCheck } from '@/lib/server';
import { chatOwner, chatRequestId, chatSession } from '@/lib/chat';
import { accessFromPayments, plans } from '@/lib/domain';
import { entitlementPayments } from '@/lib/payments';
import { sendPushToUser } from '@/lib/push';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const s = await chatSession(req);
    if (!s.admin) throw new ApiError(403,'Админы эрх шаардлагатай.');
    const owner = chatOwner(s,req.nextUrl.searchParams.get('user'));
    const [films, payments] = await Promise.all([db('films?select=id,title,badge&order=title.asc&limit=2000'),entitlementPayments(owner)]);
    return json({films, access:accessFromPayments(payments)});
  } catch (error) {return fail(error);}
}

export async function POST(req: NextRequest) {
  try {
    originCheck(req);
    const s = await chatSession(req);
    if (!s.admin) throw new ApiError(403,'Админы эрх шаардлагатай.');
    const b = await bodyJson(req, 1000), owner = chatOwner(s,b.user);
    if (Object.keys(b).some(k => !['user','plan','film_id','request_id'].includes(k)) || typeof b.plan !== 'string' || !(b.plan === 'single' || b.plan === '3day' || Object.hasOwn(plans,b.plan))) throw new ApiError(400,'Багцаа сонгоно уу.');
    const film = b.plan === 'single' ? Number(b.film_id) : null;
    if (film !== null ? !Number.isSafeInteger(film) || film < 1 : b.film_id !== null && b.film_id !== undefined) throw new ApiError(400,'Кино сонгоно уу.');
    const [grant] = await db('rpc/kino_chat_grant','POST',{p_user:owner,p_plan:b.plan,p_film:film,p_request:chatRequestId(b.request_id)});
    await sendPushToUser(owner);
    return json({grant});
  } catch (error) {
    if (error instanceof ApiError && error.code === 'P0404') return json({message:'Хэрэглэгч эсвэл кино олдсонгүй.'},404);
    if (error instanceof ApiError && error.code === 'P0409') return json({message:'Энэ эрхийн хүсэлт өөрчлөгдсөн байна. Дахин шалгана уу.'},409);
    if (error instanceof ApiError && error.code === 'P0429') return json({message:'Олон мессеж илгээсэн байна. Түр хүлээгээд дахин оролдоорой.'},429);
    return fail(error);
  }
}
