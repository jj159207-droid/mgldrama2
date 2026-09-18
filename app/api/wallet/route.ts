import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { ApiError,bodyJson,db,fail,json,originCheck,session } from '@/lib/server';

export const runtime='nodejs';

async function currentBalance(userId:number) {
  const [row]=await db('rpc/kino_wallet_balance','POST',{p_user:userId});
  const balance=Number(row?.balance || 0);
  if(!Number.isSafeInteger(balance)||balance<0)throw new ApiError(502,'Үлдэгдлийн мэдээлэл буруу байна.');
  return balance;
}

export async function GET(req:NextRequest) {
  try {
    const s=await session(req);
    if(!s?.userId)return json({balance:0});
    return json({balance:await currentBalance(s.userId)});
  } catch(error) {return fail(error);}
}

export async function POST(req:NextRequest) {
  try {
    originCheck(req);
    const s=await session(req);
    if(!s?.userId||s.admin)throw new ApiError(403,'Хэрэглэгчийн эрх шаардлагатай.');
    const b=await bodyJson(req,4096);
    if(b.action!=='purchase')throw new ApiError(400,'Wallet үйлдэл буруу.');
    const filmId=Number(b.film_id);
    if(!Number.isSafeInteger(filmId)||filmId<=0)throw new ApiError(400,'Киноны ID буруу.');
    const [result]=await db('rpc/kino_wallet_purchase','POST',{
      p_user:s.userId,
      p_film:filmId,
      p_request:randomUUID(),
    });
    if(!result)throw new ApiError(502,'Wallet худалдан авалт баталгаажаагүй.');
    const balance=Number(result.balance || 0),price=Number(result.price || 0);
    if(!Number.isSafeInteger(balance)||balance<0||!Number.isSafeInteger(price)||price<0)throw new ApiError(502,'Wallet хариу буруу байна.');
    return json({result:String(result.result||''),balance,price,paymentId:result.payment_id || null});
  } catch(error) {return fail(error);}
}
