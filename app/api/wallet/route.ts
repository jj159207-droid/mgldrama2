import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { ApiError,bodyJson,db,fail,json,originCheck,requestSite,session } from '@/lib/server';

export const runtime='nodejs';

async function currentBalance(userId:number,site:string) {
  const [row]=await db('rpc/kino_wallet_balance_site','POST',{p_user:userId,p_site:site});
  const balance=Number(row?.balance || 0);
  if(!Number.isSafeInteger(balance)||balance<0)throw new ApiError(502,'Үлдэгдлийн мэдээлэл буруу байна.');
  return balance;
}

export async function GET(req:NextRequest) {
  try {
    const site=requestSite(req),s=await session(req);
    if(!s?.userId)return json({balance:0,site});
    return json({balance:await currentBalance(s.userId,site),site});
  } catch(error) {return fail(error);}
}

export async function POST(req:NextRequest) {
  try {
    originCheck(req);
    const site=requestSite(req),s=await session(req);
    if(!s?.userId||s.admin)throw new ApiError(403,'Хэрэглэгчийн эрх шаардлагатай.');
    const b=await bodyJson(req,4096);
    let result:any;
    if(b.action==='purchase'){
      const filmId=Number(b.film_id);
      if(!Number.isSafeInteger(filmId)||filmId<=0)throw new ApiError(400,'Киноны ID буруу.');
      [result]=await db('rpc/kino_wallet_purchase_site','POST',{
        p_user:s.userId,
        p_site:site,
        p_film:filmId,
        p_request:randomUUID(),
      });
    }else if(b.action==='purchase_plan'){
      const plan=String(b.plan||'');
      if(!/^(erotic|gadaad|hyatad|oros)_(3day|1month)$/.test(plan)&&plan!=='all_1month')throw new ApiError(400,'Багц буруу.');
      [result]=await db('rpc/kino_wallet_purchase_plan_site','POST',{
        p_user:s.userId,
        p_site:site,
        p_plan:plan,
        p_request:randomUUID(),
      });
    }else throw new ApiError(400,'Wallet үйлдэл буруу.');
    if(!result)throw new ApiError(502,'Wallet худалдан авалт баталгаажаагүй.');
    const balance=Number(result.balance || 0),price=Number(result.price || 0);
    if(!Number.isSafeInteger(balance)||balance<0||!Number.isSafeInteger(price)||price<0)throw new ApiError(502,'Wallet хариу буруу байна.');
    return json({result:String(result.result||''),balance,price,paymentId:result.payment_id || null,site});
  } catch(error) {return fail(error);}
}
