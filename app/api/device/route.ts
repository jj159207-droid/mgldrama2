import { createHash, randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import {
  ApiError, DEVICE_COOKIE, bindDeviceRecoveryCookie, canAdminSite, db, fail, issueSession, json, originCheck,
  pinHash, publicUser, requestSite, session, setSessionCookie
} from '@/lib/server';

export const runtime='nodejs';
const DEVICE_SESSION_AGE=365*24*60*60;
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');

async function readUser(userId:number) {
  const [user]=await db(`users?id=eq.${userId}&select=id,phone,user_id,is_guest,browser_no&limit=1`);
  return user || null;
}

export async function POST(req:NextRequest) {
  try {
    originCheck(req);
    const site=requestSite(req),current=await session(req);
    // A silent startup recovery must not create a new guest for every public visitor.
    const recoverOnly=req.nextUrl.searchParams.get('recover')==='1';
    if(current?.admin){
      if(canAdminSite(current,site))return json({admin:true,user:null,site});
      throw new ApiError(403,'Өөр сайтын админ session байна. Админаас гараад энэ сайтыг хэрэглэгчээр нээнэ үү.');
    }

    if(current?.userId){
      const existing=await readUser(current.userId);
      if(existing){
        await db('rpc/kino_touch_site_user','POST',{p_site:site,p_user:Number(existing.id)});
        const res=json({user:publicUser(existing),site});
        return bindDeviceRecoveryCookie(req,res,Number(existing.id));
      }
    }

    const recovery=req.cookies.get(DEVICE_COOKIE)?.value || '';
    if(/^[a-f0-9]{64}$/.test(recovery)){
      const [saved]=await db(
        `guest_device_tokens?token_hash=eq.${digest(recovery)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=user_id&limit=1`
      );
      if(saved?.user_id){
        const recovered=await readUser(Number(saved.user_id));
        if(recovered){
          const age=recovered.is_guest===true?DEVICE_SESSION_AGE:7*24*60*60;
          const issued=await issueSession(req,Number(recovered.id),false,age);
          await db('rpc/kino_touch_site_user','POST',{p_site:site,p_user:Number(recovered.id)});
          const res=setSessionCookie(json({user:publicUser(recovered),recovered:true,site}),issued.token,issued.age);
          return bindDeviceRecoveryCookie(req,res,Number(recovered.id));
        }
      }
    }

    if(recoverOnly)return json({user:null,recovered:false,site});

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
        await db('rpc/kino_touch_site_user','POST',{p_site:site,p_user:user.id});
        const issued=await issueSession(req,user.id,false,DEVICE_SESSION_AGE);
        const res=setSessionCookie(json({user:publicUser(user),created:true,site}),issued.token,issued.age);
        return bindDeviceRecoveryCookie(req,res,user.id);
      } catch(error) {
        if(error instanceof ApiError && error.code==='23505')continue;
        throw error;
      }
    }
    throw new ApiError(503,'Төхөөрөмжийн дугаар үүсгэж чадсангүй. Дахин оролдоно уу.');
  } catch(error) {return fail(error);}
}
