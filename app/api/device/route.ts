import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { ApiError, db, fail, issueSession, json, originCheck, pinHash, publicUser, session, setSessionCookie } from '@/lib/server';
export const runtime='nodejs';
const DEVICE_SESSION_AGE=365*24*60*60;

export async function POST(req:NextRequest) {
  try {
    originCheck(req);
    const current=await session(req);
    if(current?.admin)return json({admin:true,user:null});
    if(current?.userId){
      const [existing]=await db(`users?id=eq.${current.userId}&select=id,phone,user_id,is_guest&limit=1`);
      if(existing)return json({user:publicUser(existing)});
    }
    for(let attempt=0;attempt<5;attempt++){
      const code=randomBytes(6).toString('hex').toUpperCase();
      try {
        const [user]=await db('users','POST',{
          phone:`guest-${code.toLowerCase()}`,
          pin:pinHash(randomBytes(18).toString('hex')),
          user_id:`G${code}`,
          is_guest:true,
          failed_attempts:0,
        });
        if(!user || typeof user.id!=='number')throw new ApiError(502,'Төхөөрөмжийг бүртгэж чадсангүй.');
        const issued=await issueSession(req,user.id,false,DEVICE_SESSION_AGE);
        return setSessionCookie(json({user:publicUser(user)}),issued.token,issued.age);
      } catch(error) {
        if(error instanceof ApiError && error.code==='23505')continue;
        throw error;
      }
    }
    throw new ApiError(503,'Төхөөрөмжийн дугаар үүсгэж чадсангүй. Дахин оролдоно уу.');
  } catch(error) {return fail(error);}
}
