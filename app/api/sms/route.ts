import { NextRequest } from 'next/server';
import { ApiError,bodyBytes,bodyJson,db,equalSecret,fail,json } from '@/lib/server';
import { parseBankSms } from '@/lib/domain';
export const runtime='nodejs';
export async function POST(req:NextRequest) {
 try {
  const secret=process.env.SMS_WEBHOOK_SECRET;
  if(!secret||secret.length<32)throw new ApiError(503,'SMS хүлээн авах тохиргоо хийгдээгүй.');
  if(!equalSecret(req.headers.get('authorization')||'',`Bearer ${secret}`))throw new ApiError(401,'SMS илгээгч баталгаажаагүй.');
  // Plain text avoids broken JSON when a bank SMS contains quotes or newlines.
  const plain=(req.headers.get('content-type')||'').split(';')[0].trim()==='text/plain';
  const b=plain?{text:(await bodyBytes(req,12000)).toString('utf8'),sender:req.headers.get('x-sms-sender')}:await bodyJson(req,16000);
  const allowed=process.env.SMS_ALLOWED_SENDER?.trim();
  if(allowed && String(b.sender||'').trim()!==allowed)throw new ApiError(403,'Банкны SMS илгээгч таарахгүй байна.');
  const parsed=typeof b.text==='string'&&b.text.length<=2000?parseBankSms(b.text):null;
  if(!parsed)throw new ApiError(400,'Орлогын дүн болон 6 оронтой Utga код шаардлагатай.');
  const lookup=()=>db(`pending_payments?ref_code=eq.${parsed.ref}&select=id,user_id,amount,status,created_at,confirmed_at`);
  const [payment]=await lookup();
  if(!payment)throw new ApiError(404,'Захиалга олдсонгүй.');
  if(!Number.isFinite(Number(payment.amount))||Number(payment.amount)<=0||parsed.amount!==Number(payment.amount))throw new ApiError(400,'Шилжүүлсэн дүн захиалгын дүнтэй таарахгүй байна.');
  // Retries acknowledge the original result without moving its expiry forward.
  if(payment.status==='confirmed')return json({ok:true,alreadyConfirmed:true,ref:parsed.ref});
  if(payment.status!=='pending')throw new ApiError(409,'Захиалга хүчингүй болсон. Админ шалгана уу.');
  const age=Date.now()-Date.parse(String(payment.created_at));
  if(!Number.isFinite(age)||age<0||age>24*3600000)throw new ApiError(409,'Захиалга хугацаа хэтэрсэн. Админ шалгана уу.');
  const rows=await db(`pending_payments?id=eq.${payment.id}&status=eq.pending`,'PATCH',{status:'confirmed',confirmed_at:new Date().toISOString()});
  if(rows.length!==1){
   const [current]=await lookup();
   if(current?.status!=='confirmed')throw new ApiError(409,'Захиалгын төлөв өөрчлөгдсөн.');
  }
  return json({ok:true,ref:parsed.ref});
 }catch(e){return fail(e);}
}
