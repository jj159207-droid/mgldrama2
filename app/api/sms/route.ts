import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { ApiError,bodyBytes,bodyJson,db,equalSecret,fail,json } from '@/lib/server';
import { parseBankSms } from '@/lib/domain';

export const runtime='nodejs';

function normalizeSender(value:unknown) {
  return String(value||'').normalize('NFKC').toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N}]+/gu,'');
}

function senderMatches(configured:string,actual:unknown) {
  const key=normalizeSender(actual);
  if(!key)return false;
  return configured.split(/[;,]/).map(normalizeSender).filter(Boolean).some(item=>item===key);
}

async function logSmsEvent(input:{
  sender?:unknown;
  ref?:string|null;
  amount?:number|null;
  outcome:string;
  detail?:string;
  rawText?:string;
}) {
  try {
    const raw=String(input.rawText||'');
    await db('sms_webhook_events','POST',{
      sender:String(input.sender||'').slice(0,120)||null,
      ref_code:input.ref||null,
      amount:Number.isSafeInteger(input.amount)?input.amount:null,
      outcome:input.outcome.slice(0,80),
      detail:String(input.detail||'').slice(0,300)||null,
      message_hash:raw?createHash('sha256').update(raw).digest('hex'):null,
    });
  } catch {
    // Diagnostics must never block payment confirmation.
  }
}

export async function POST(req:NextRequest) {
 let trusted=false;
 let sender:unknown='';
 let rawText='';
 let parsed:{ref:string;amount:number}|null=null;
 let outcome='received';
 try {
  const secret=process.env.SMS_WEBHOOK_SECRET;
  if(!secret||secret.length<32)throw new ApiError(503,'SMS хүлээн авах тохиргоо хийгдээгүй.');
  if(!equalSecret(req.headers.get('authorization')||'',`Bearer ${secret}`))throw new ApiError(401,'SMS илгээгч баталгаажаагүй.');
  trusted=true;

  // Plain text avoids broken JSON when a bank SMS contains quotes or newlines.
  const plain=(req.headers.get('content-type')||'').split(';')[0].trim()==='text/plain';
  const b=plain
    ? {text:(await bodyBytes(req,12000)).toString('utf8'),sender:req.headers.get('x-sms-sender')}
    : await bodyJson(req,16000);
  sender=b.sender;
  rawText=typeof b.text==='string'?b.text:'';

  const allowed=process.env.SMS_ALLOWED_SENDER?.trim();
  if(allowed && !senderMatches(allowed,sender)){
    outcome='sender_rejected';
    throw new ApiError(403,'Банкны SMS илгээгч таарахгүй байна.');
  }

  parsed=rawText.length<=2000?parseBankSms(rawText):null;
  if(!parsed){
    outcome='parse_failed';
    throw new ApiError(400,'Орлогын дүн болон 6 оронтой гүйлгээний утгыг SMS-ээс таньж чадсангүй.');
  }

  const lookup=()=>db(`pending_payments?ref_code=eq.${parsed!.ref}&select=id,user_id,amount,status,plan,created_at,confirmed_at`);
  const [payment]=await lookup();
  if(!payment){
    outcome='payment_not_found';
    throw new ApiError(404,'Гүйлгээний утгатай тохирох захиалга олдсонгүй.');
  }

  if(payment.plan==='wallet_topup'){
    if(!Number.isSafeInteger(parsed.amount)||parsed.amount<5000||parsed.amount>200000){
      outcome='amount_rejected';
      throw new ApiError(400,'Цэнэглэх дүн 5,000₮-өөс 200,000₮ хүртэл байна.');
    }
    const [wallet]=await db('rpc/kino_wallet_confirm_topup','POST',{
      p_payment:Number(payment.id),
      p_ref:parsed.ref,
      p_amount:parsed.amount,
      p_allow_expired:false,
    });
    const balance=Number(wallet?.balance || 0);
    if(!Number.isSafeInteger(balance)||balance<0){
      outcome='wallet_error';
      throw new ApiError(502,'Wallet үлдэгдэл баталгаажаагүй.');
    }
    outcome=wallet?.result==='already_confirmed'?'already_confirmed':'wallet_confirmed';
    await logSmsEvent({sender,ref:parsed.ref,amount:parsed.amount,outcome,rawText});
    return json({
      ok:true,
      ref:parsed.ref,
      wallet:true,
      walletBalance:balance,
      creditedAmount:parsed.amount,
      alreadyConfirmed:wallet?.result==='already_confirmed'
    });
  }

  if(!Number.isFinite(Number(payment.amount))||Number(payment.amount)<=0||parsed.amount!==Number(payment.amount)){
    outcome='amount_mismatch';
    throw new ApiError(400,'Шилжүүлсэн дүн захиалгын дүнтэй таарахгүй байна.');
  }

  // Retries acknowledge the original result without moving its expiry forward.
  if(payment.status==='confirmed'){
    outcome='already_confirmed';
    await logSmsEvent({sender,ref:parsed.ref,amount:parsed.amount,outcome,rawText});
    return json({ok:true,alreadyConfirmed:true,ref:parsed.ref});
  }
  if(payment.status!=='pending'){
    outcome='payment_not_pending';
    throw new ApiError(409,'Захиалга хүчингүй болсон. Админ шалгана уу.');
  }

  const age=Date.now()-Date.parse(String(payment.created_at));
  if(!Number.isFinite(age)||age<0||age>24*3600000){
    outcome='payment_expired';
    throw new ApiError(409,'Захиалга хугацаа хэтэрсэн. Админ шалгана уу.');
  }

  const rows=await db(`pending_payments?id=eq.${payment.id}&status=eq.pending`,'PATCH',{
    status:'confirmed',
    confirmed_at:new Date().toISOString()
  });
  if(rows.length!==1){
    const [current]=await lookup();
    if(current?.status!=='confirmed'){
      outcome='state_changed';
      throw new ApiError(409,'Захиалгын төлөв өөрчлөгдсөн.');
    }
  }

  outcome='confirmed';
  await logSmsEvent({sender,ref:parsed.ref,amount:parsed.amount,outcome,rawText});
  return json({ok:true,ref:parsed.ref});
 } catch(e) {
  if(trusted){
    await logSmsEvent({
      sender,
      ref:parsed?.ref||null,
      amount:parsed?.amount||null,
      outcome:outcome==='received'?'server_error':outcome,
      detail:e instanceof Error?e.message:'Unknown SMS webhook error',
      rawText
    });
  }
  return fail(e);
 }
}
