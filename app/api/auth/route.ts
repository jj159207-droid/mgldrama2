import { NextRequest } from 'next/server';
import { ApiError,bodyJson,db,equalSecret,fail,issueSession,json,originCheck,pinHash,pinMatches,publicUser,rateLimit,revokeSession,session,setSessionCookie } from '@/lib/server';
export const runtime='nodejs';
export async function GET(req:NextRequest) {
  try {const s=await session(req);if(!s)return json({user:null,admin:false});
    const [u]=s.userId?await db(`users?id=eq.${s.userId}&select=id,phone,user_id,is_guest`):[];
    return json({user:u?publicUser(u):null,admin:s.admin});
  }catch(e){return fail(e);}
}
export async function POST(req:NextRequest) {
 try {
  originCheck(req);const b=await bodyJson(req,16000);
  if(b.action==='logout'){await revokeSession(req);return setSessionCookie(json({ok:true}),'',0);}
  if(b.action==='admin') {
    const key=process.env.ADMIN_PASSWORD;
    if(!key || key.length<16)throw new ApiError(503,'ADMIN_PASSWORD тохиргоонд 16-аас урт шинэ нууц үг тохируулна уу.');
    await rateLimit('admin-login');
    if(typeof b.password!=='string'||!equalSecret(b.password,key))throw new ApiError(401,'Нууц үг буруу байна.');
    const s=await issueSession(req,null,true);return setSessionCookie(json({admin:true}),s.token,s.age);
  }
  const previous=await session(req);
  const phone=String(b.phone || ''),pin=String(b.pin || '');
  if(!/^\d{8}$/.test(phone)||!/^\d{4}$/.test(pin))throw new ApiError(400,'8 оронтой утас, 4 оронтой PIN оруулна уу.');
  if(!['login','register'].includes(String(b.action)))throw new ApiError(400,'Үйлдэл буруу.');
  await rateLimit(`phone:${phone}`);
  const [existing]=await db(`users?phone=eq.${phone}&select=*&limit=1`);
  let user=existing;
  if(b.action==='register') {
    if(existing)throw new ApiError(409,'Энэ дугаар бүртгэлтэй. Нэвтрэх хэсгийг сонгоно уу.');
    // One insert; no shared "tmp" identifier or second non-atomic update.
    [user]=await db('users','POST',{phone,pin:pinHash(pin),user_id:`U${phone}`,failed_attempts:0});
  }else {
    if(!existing || !pinMatches(pin,existing.pin))throw new ApiError(401,'Дугаар эсвэл PIN буруу байна.');
    if(!String(existing.pin).startsWith('scrypt:'))await db(`users?id=eq.${existing.id}`,'PATCH',{pin:pinHash(pin),failed_attempts:0,locked_until:null});
  }
  if(!user || typeof user.id!=='number')throw new ApiError(502,'Бүртгэлийг баталгаажуулж чадсангүй.');
  if(previous?.userId && previous.userId!==user.id){
    const [guest]=await db(`users?id=eq.${previous.userId}&select=id,is_guest&limit=1`);
    if(guest?.is_guest===true){
      await db('rpc/kino_merge_guest_account','POST',{p_guest:previous.userId,p_user:user.id});
    }
  }
  const s=await issueSession(req,user.id,false);return setSessionCookie(json({user:publicUser(user)}),s.token,s.age);
 }catch(e){return fail(e);}
}
