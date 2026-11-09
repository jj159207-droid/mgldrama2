import {randomInt} from 'node:crypto';
import {NextRequest} from 'next/server';
import {ApiError,db,fail,json,originCheck,rateLimit,requestSite,session} from '@/lib/server';

export const runtime='nodejs';
const PLAN='secret_chat_10000';
const PRICE=10000;
const TIME_LIMIT=24*3600000;

export async function POST(req:NextRequest){
 try{
  originCheck(req);
  if(requestSite(req)!=='taza')throw new ApiError(404,'Нууц чат зөвхөн TAZA сайтад байна.');
  const s=await session(req);
  if(!s?.userId||s.admin)throw new ApiError(401,'Хэрэглэгчийн төхөөрөмжийн нэвтрэлт шаардлагатай.');
  const userId=Number(s.userId);
  const [joined]=await db('taza_secret_chat_members?user_id=eq.'+userId+'&select=id,blocked&limit=1');
  if(joined) return json({status:joined.blocked===true?'blocked':'joined'});
  const [confirmed]=await db('pending_payments?site_id=eq.taza&user_id=eq.'+userId+'&plan=eq.'+PLAN+'&status=eq.confirmed&amount=eq.10000&select=id&limit=1');
  if(confirmed)return json({status:'paid'});
  const active=await db('pending_payments?site_id=eq.taza&user_id=eq.'+userId+'&plan=eq.'+PLAN+'&status=eq.pending&select=id,ref_code,amount,created_at&order=id.desc&limit=5');
  for(const row of active){
   const age=Date.now()-Date.parse(String(row.created_at));
   if(age>=0&&age<TIME_LIMIT&&row.amount===PRICE&&/^\d{6}$/.test(String(row.ref_code)))return json({status:'pending',ref:String(row.ref_code),amount:PRICE,createdAt:row.created_at});
  }
  await rateLimit('taza-secret-chat-order:'+userId);
  const [user]=await db('users?id=eq.'+userId+'&select=id,phone&limit=1');
  if(!user)throw new ApiError(404,'Төхөөрөмжийн бүртгэл олдсонгүй.');
  // Server generates the payment reference; client cannot pick an already used ref.
  for(let attempt=0;attempt<8;attempt++){
    const ref=String(randomInt(100000,1000000));
    try {
      const [p]=await db('pending_payments','POST',{ref_code:ref,film_id:null,user_id:userId,site_id:'taza',plan:PLAN,amount:PRICE,status:'pending',phone:user.phone});
      if(!p)throw new ApiError(502,'Төлбөрийн код үүсгэсэнгүй.');
      return json({status:'pending',ref,amount:PRICE,createdAt:p.created_at});
    }catch(error){
      if(error instanceof ApiError&&error.code==='23505')continue;
      throw error;
    }
  }
  throw new ApiError(503,'6 оронтой код давхардлаа. Дахин оролдоно уу.');
 }catch(error){return fail(error);}
}
