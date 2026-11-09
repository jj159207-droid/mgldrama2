import {NextRequest} from 'next/server';
import {ApiError,bodyJson,canAdminSite,db,fail,json,originCheck,rateLimit,requestSite,session} from '@/lib/server';

export const runtime='nodejs';
const PLAN='secret_chat_10000';
const AMOUNT=10000;
const phonePattern=/^[0-9]{8}$/;
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertTaza(req:NextRequest){
 if(requestSite(req)!=='taza')throw new ApiError(404,'Нууц чат зөвхөн TAZA сайтад байна.');
}
function safeMessage(row:Record<string,unknown>,ownerId:number|null){
 return {id:Number(row.id),memberId:Number(row.member_id),text:String(row.body||''),at:String(row.created_at||''),mine:Number(row.user_id)===ownerId};
}
async function memberFor(userId:number){
 const [m]=await db('taza_secret_chat_members?user_id=eq.'+userId+'&select=id,user_id,payment_id,phone,blocked,created_at&limit=1');
 return m||null;
}
async function confirmedPayment(userId:number){
 const [p]=await db('pending_payments?site_id=eq.taza&user_id=eq.'+userId+'&plan=eq.'+PLAN+'&amount=eq.'+AMOUNT+'&status=eq.confirmed&select=id,amount,confirmed_at&order=id.desc&limit=1');
 return p||null;
}
async function requireMember(userId:number){
 const m=await memberFor(userId);
 if(!m)throw new ApiError(403,'Эхлээд 10,000₮-ийн төлбөрөө баталгаажуулж, дугаараа бүртгүүлнэ үү.','SECRET_CHAT_MEMBERSHIP_REQUIRED');
 if(m.blocked===true)throw new ApiError(403,'Энэ чатны эрхийг админ түр хаасан байна.','SECRET_CHAT_BLOCKED');
 return m;
}

export async function GET(req:NextRequest){
 try{
  assertTaza(req);
  const s=await session(req),q=req.nextUrl.searchParams;
  if(q.get('admin')==='1'){
    if(!canAdminSite(s,'taza'))throw new ApiError(403,'Зөвхөн админ үзнэ.');
    const members=await db('taza_secret_chat_members?select=id,user_id,phone,payment_id,blocked,created_at&order=id.desc&limit=200');
    if(q.get('messages')==='1'){
      const msgs=await db('taza_secret_chat_messages?select=id,member_id,user_id,body,created_at&order=id.desc&limit=80');
      return json({members,messages:msgs.map(m=>safeMessage(m,null)).reverse()});
    }
    return json({members});
  }
  if(!s?.userId||s.admin)throw new ApiError(401,'Төхөөрөмжийн нэвтрэлт шаардлагатай.');
  const userId=s.userId;
  const m=await memberFor(userId);
  if(q.get('messages')==='1'){
    if(q.has('admin'))throw new ApiError(403,'Зөвшөөрөлгүй хүсэлт.');
    const joined=await requireMember(userId);
    const rows=await db('taza_secret_chat_messages?select=id,member_id,user_id,body,created_at&order=id.desc&limit=80');
    return json({messages:rows.map(row=>safeMessage(row,userId)).reverse(),myMemberId:Number(joined.id)});
  }
  if(m) return json({status:m.blocked===true?'blocked':'joined',phone:m.phone,joinedAt:m.created_at});
  if(await confirmedPayment(userId))return json({status:'paid'});
  const rows=await db('pending_payments?site_id=eq.taza&user_id=eq.'+userId+'&plan=eq.'+PLAN+'&status=eq.pending&select=id,ref_code,amount,created_at&order=id.desc&limit=5');
  const pending=rows.find(row=>Number(row.amount)===AMOUNT&&/^\d{6}$/.test(String(row.ref_code))&&Date.now()-Date.parse(String(row.created_at))>=0&&Date.now()-Date.parse(String(row.created_at))<24*3600000);
  return json(pending?{status:'pending',ref:pending.ref_code,amount:AMOUNT,createdAt:pending.created_at}:{status:'unpaid'});
 }catch(e){return fail(e);}
}

export async function POST(req:NextRequest){
 try{
  assertTaza(req);originCheck(req);
  const s=await session(req);
  if(!s?.userId||s.admin)throw new ApiError(401,'Хэрэглэгчийн төхөөрөмжийн нэвтрэлт шаардлагатай.');
  const userId=s.userId,b=await bodyJson(req,2200);
  const action=String(b.action||'');
  if(action==='join'){
    if(Object.keys(b).some(k=>!['action','phone'].includes(k)))throw new ApiError(400,'Хүсэлтийн формат буруу.');
    const phone=String(b.phone||'').trim();
    if(!phonePattern.test(phone))throw new ApiError(400,'8 оронтой утасны дугаар оруулна уу.');
    const previous=await memberFor(userId);
    if(previous){
      if(previous.blocked===true)throw new ApiError(403,'Бүртгэлийг түр хаасан байна.');
      return json({ok:true,status:'joined',phone:previous.phone,alreadyRegistered:true});
    }
    await rateLimit('taza-secret-chat-join:'+userId);
    const payment=await confirmedPayment(userId);
    if(!payment)throw new ApiError(403,'ХААН Банкны 10,000₮ төлбөр баталгаажаагүй байна.','SECRET_CHAT_PAYMENT_REQUIRED');
    try{
      const [member]=await db('taza_secret_chat_members','POST',{user_id:userId,payment_id:payment.id,phone});
      if(!member)throw new ApiError(502,'Бүртгэл хадгалагдсангүй.');
      return json({ok:true,status:'joined',phone:member.phone});
    }catch(error){
      if(error instanceof ApiError&&error.code==='23505'){
        const saved=await memberFor(userId);
        if(saved&&saved.blocked!==true)return json({ok:true,status:'joined',phone:saved.phone,alreadyRegistered:true});
      }
      throw error;
    }
  }
  if(action==='send'){
    if(Object.keys(b).some(k=>!['action','text','clientId'].includes(k)))throw new ApiError(400,'Хүсэлтийн формат буруу.');
    const text=typeof b.text==='string'?b.text.trim():'';
    if(!text||text.length>600||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(text))throw new ApiError(400,'1–600 тэмдэгттэй зурвас бичнэ үү.');
    const clientId=String(b.clientId||'');
    if(!uuidPattern.test(clientId))throw new ApiError(400,'Зурвасын код буруу.');
    const m=await requireMember(userId);
    const last=await db('taza_secret_chat_messages?user_id=eq.'+userId+'&select=id,created_at&order=id.desc&limit=1');
    if(last[0]&&Date.now()-Date.parse(String(last[0].created_at))<1800)
      throw new ApiError(429,'Зурвас хооронд 2 секунд зай авна уу.');
    const recent=await db('taza_secret_chat_messages?user_id=eq.'+userId+'&created_at=gte.'+encodeURIComponent(new Date(Date.now()-15*60000).toISOString())+'&select=id&limit=36');
    if(recent.length>=35)throw new ApiError(429,'15 минутад илгээх зурвасын тоо хэтэрсэн байна.');
    try{
      const [message]=await db('taza_secret_chat_messages','POST',{member_id:Number(m.id),user_id:userId,body:text,client_id:clientId});
      if(!message)throw new ApiError(502,'Зурвас хадгалагдсангүй.');
      return json({ok:true,message:safeMessage(message,userId)});
    }catch(error){
      if(error instanceof ApiError&&error.code==='23505'){
        const [saved]=await db('taza_secret_chat_messages?client_id=eq.'+clientId+'&user_id=eq.'+userId+'&select=id,member_id,user_id,body,created_at&limit=1');
        if(saved)return json({ok:true,message:safeMessage(saved,userId),duplicate:true});
      }
      throw error;
    }
  }
  throw new ApiError(400,'Үйлдэл буруу.');
 }catch(e){return fail(e);}
}

export async function PATCH(req:NextRequest){
 try{
  assertTaza(req);originCheck(req);
  if(!canAdminSite(await session(req),'taza'))throw new ApiError(403,'Энэ үйлдэл зөвхөн админд байна.');
  const b=await bodyJson(req,300);
  if(Object.keys(b).some(k=>!['memberId','blocked'].includes(k)))throw new ApiError(400,'Хүсэлт буруу.');
  const id=Number(b.memberId);
  if(!Number.isSafeInteger(id)||id<=0||typeof b.blocked!=='boolean')throw new ApiError(400,'Гишүүний мэдээлэл буруу.');
  const rows=await db('taza_secret_chat_members?id=eq.'+id,'PATCH',{blocked:b.blocked});
  if(!rows.length)throw new ApiError(404,'Гишүүн олдсонгүй.');
  return json({ok:true});
 }catch(e){return fail(e);}
}

export async function DELETE(req:NextRequest){
 try{
  assertTaza(req);originCheck(req);
  if(!canAdminSite(await session(req),'taza'))throw new ApiError(403,'Энэ үйлдэл зөвхөн админд байна.');
  const id=Number(req.nextUrl.searchParams.get('messageId'));
  if(!Number.isSafeInteger(id)||id<=0)throw new ApiError(400,'Зурвасын ID буруу.');
  const rows=await db('taza_secret_chat_messages?id=eq.'+id,'DELETE');
  return json({ok:true,deleted:rows.length});
 }catch(e){return fail(e);}
}
