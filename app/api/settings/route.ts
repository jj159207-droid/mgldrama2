import { NextRequest } from 'next/server';
import { ApiError,bodyJson,db,fail,json,originCheck,session } from '@/lib/server';
import { isRow,safeUrl } from '@/lib/domain';
export const runtime='nodejs';

const DEFAULTS={
 messengerUrl:safeUrl(process.env.MESSENGER_URL),
 bankName:String(process.env.BANK_NAME||'Хаан банк').trim(),
 bankAccount:String(process.env.BANK_ACCOUNT||'5403972086').trim(),
 accountName:String(process.env.BANK_ACCOUNT_NAME||'Т.Жаргалбаяр').trim(),
};
const clean=(value:unknown,max:number)=>typeof value==='string'?value.trim().replace(/\s+/g,' ').slice(0,max):'';
const validAccount=(value:string)=>/^[A-Za-z0-9 -]{6,40}$/.test(value);
function normalize(settings:unknown){
 const row=isRow(settings)?settings:{};
 const messengerUrl=safeUrl(row.messengerUrl)||DEFAULTS.messengerUrl;
 const bankName=clean(row.bankName,80)||DEFAULTS.bankName;
 const rawAccount=clean(row.bankAccount,40);
 const bankAccount=validAccount(rawAccount)?rawAccount:DEFAULTS.bankAccount;
 const accountName=clean(row.accountName,100)||DEFAULTS.accountName;
 return {messengerUrl,bankName,bankAccount,accountName};
}
async function readSettings(){
 const [row]=await db('sms_logs?key=eq.site_settings&select=value&order=id.desc&limit=1');
 let settings:unknown={};try{settings=JSON.parse(String(row?.value||'{}'));}catch{}
 return normalize(settings);
}
export async function GET() {
 try { return json(await readSettings()); }
 catch(e){
  if(e instanceof ApiError && ['42703','42P01','PGRST204','PGRST205'].includes(e.code))
   return json({...DEFAULTS,setupRequired:true});
  return fail(e);
 }
}
export async function PUT(req:NextRequest) {
 try {
  originCheck(req);
  if(!(await session(req))?.admin)throw new ApiError(403,'Админы эрх шаардлагатай.');
  const b=await bodyJson(req,4096);
  const messengerRaw=clean(b.messengerUrl,2000);
  const messengerUrl=messengerRaw?safeUrl(messengerRaw):'';
  if(messengerRaw&&!messengerUrl)throw new ApiError(400,'Зөв HTTPS Messenger холбоос оруулна уу.');
  const bankName=clean(b.bankName,80),bankAccount=clean(b.bankAccount,40),accountName=clean(b.accountName,100);
  if(bankName.length<2)throw new ApiError(400,'Банкны нэрийг зөв оруулна уу.');
  if(!validAccount(bankAccount))throw new ApiError(400,'Дансны дугаар 6–40 тэмдэгт, зөвхөн үсэг/тоо байх ёстой.');
  if(accountName.length<2)throw new ApiError(400,'Данс эзэмшигчийн нэрийг зөв оруулна уу.');
  const settings={messengerUrl,bankName,bankAccount,accountName};
  await db('rpc/kino_save_settings','POST',{settings_value:JSON.stringify(settings)});
  return json(settings);
 }catch(e){return fail(e);}
}
