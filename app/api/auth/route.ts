import { NextRequest } from 'next/server';
import { ApiError,bodyJson,canAdminSite,clearDeviceCookie,db,equalSecret,fail,issueSession,json,originCheck,passwordMatches,pinHash,pinMatches,publicUser,rateLimit,requestSite,revokeSession,session,setSessionCookie } from '@/lib/server';
export const runtime='nodejs';
export async function GET(req:NextRequest) {
  try {
    const site=requestSite(req),s=await session(req);
    if(!s)return json({user:null,admin:false,site});
    const [u]=s.userId?await db(`users?id=eq.${s.userId}&select=id,phone,user_id,is_guest,browser_no`):[];
    return json({user:u?publicUser(u):null,admin:canAdminSite(s,site),masterAdmin:s.masterAdmin,site});
  }catch(e){return fail(e);}
}
export async function POST(req:NextRequest) {
 try {
  originCheck(req);const site=requestSite(req),b=await bodyJson(req,16000);
  if(b.action==='logout'){
    const current=await session(req);
    await revokeSession(req);
    const res=setSessionCookie(json({ok:true}),'',0);
    // Explicit user/guest logout should forget this device. Admin logout keeps the
    // recovery token so returning to the public site restores the previous user.
    return current?.userId ? clearDeviceCookie(res) : res;
  }
  if(b.action==='admin') {
    const password=typeof b.password==='string'?b.password:'';
    if(password.length<8||password.length>128)throw new ApiError(400,'Админы нууц үг буруу байна.');
    await rateLimit(`admin-login:${site}`);

    const masterKey=process.env.ADMIN_PASSWORD;
    const master=!!masterKey && masterKey.length>=16 && equalSecret(password,masterKey);
    let siteAdmin=false;
    if(!master){
      const [row]=await db(`site_admins?site_id=eq.${site}&active=eq.true&select=password_hash&limit=1`);
      siteAdmin=!!row && passwordMatches(password,row.password_hash);
    }
    if(!master&&!siteAdmin)throw new ApiError(401,'Нууц үг буруу байна.');

    const s=await issueSession(req,null,true,3600,site,master);
    return setSessionCookie(json({admin:true,masterAdmin:master,site}),s.token,s.age);
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
  await db('rpc/kino_touch_site_user','POST',{p_site:site,p_user:user.id});
  const s=await issueSession(req,user.id,false);return setSessionCookie(json({user:publicUser(user),site}),s.token,s.age);
 }catch(e){return fail(e);}
}
