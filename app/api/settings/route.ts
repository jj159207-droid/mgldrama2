import { NextRequest } from 'next/server';
import { ApiError,bodyJson,db,fail,json,originCheck,session } from '@/lib/server';
import { isRow,safeUrl } from '@/lib/domain';
export const runtime='nodejs';

function normalizeIban(value:unknown) {
 const compact=typeof value==='string'?value.toUpperCase().replace(/\s+/g,''):'';
 return /^MN\d{18}$/.test(compact)?compact:'';
}

const DEFAULTS={
 messengerUrl:safeUrl(process.env.MESSENGER_URL),
 bankName:String(process.env.BANK_NAME||'Хаан банк').trim(),
 bankAccount:String(process.env.BANK_ACCOUNT||'5403972086').trim(),
 accountName:String(process.env.BANK_ACCOUNT_NAME||'Т.Жаргалбаяр').trim(),
 bankIban:normalizeIban(process.env.BANK_IBAN||process.env.BANK_IBN),
};
const clean=(value:unknown,max:number)=>typeof value==='string'?value.trim().replace(/\s+/g,' ').slice(0,max):'';
const validAccount=(value:string)=>/^[A-Za-z0-9 -]{6,40}$/.test(value);
async function storedSettings(){
 const [row]=await db('sms_logs?key=eq.site_settings&select=value&order=id.desc&limit=1');
 let settings:unknown={};try{settings=JSON.parse(String(row?.value||'{}'));}catch{}
 return {found:!!row,settings:isRow(settings)?settings:{}};
}
function normalize(settings:Record<string,unknown>){
 const messengerUrl=safeUrl(settings.messengerUrl)||DEFAULTS.messengerUrl;
 const bankName=clean(settings.bankName,80)||DEFAULTS.bankName;
 const rawAccount=clean(settings.bankAccount,40);
 const bankAccount=validAccount(rawAccount)?rawAccount:DEFAULTS.bankAccount;
 const accountName=clean(settings.accountName,100)||DEFAULTS.accountName;
 // bankIbn is accepted only as a legacy source; all new writes use bankIban.
 const bankIban=normalizeIban(settings.bankIban??settings.bankIbn)||DEFAULTS.bankIban;
 return {messengerUrl,bankName,bankAccount,accountName,bankIban,ibanSetupRequired:!bankIban};
}
export async function GET() {
 try { const {settings}=await storedSettings(); return json(normalize(settings)); }
 catch(e){
  if(e instanceof ApiError && ['42703','42P01','PGRST204','PGRST205'].includes(e.code))
   return json({...DEFAULTS,ibanSetupRequired:!DEFAULTS.bankIban,setupRequired:true});
  return fail(e);
 }
}
export async function PUT(req:NextRequest) {
 try {
  originCheck(req);
  if(!(await session(req))?.admin)throw new ApiError(403,'Админы эрх шаардлагатай.');
  const b=await bodyJson(req,4096);
  const has=(key:string)=>Object.prototype.hasOwnProperty.call(b,key);
  const hasIban=has('bankIban')||has('bankIbn');
  const legacyMessengerOnly=has('messengerUrl')&&!has('bankName')&&!has('bankAccount')&&!has('accountName')&&!hasIban;
  const {found,settings:stored}=await storedSettings();
  const current=normalize(stored);
  const messengerRaw=has('messengerUrl')?clean(b.messengerUrl,2000):current.messengerUrl;
  const messengerUrl=messengerRaw?safeUrl(messengerRaw):'';
  if(messengerRaw&&!messengerUrl)throw new ApiError(400,'Зөв HTTPS Messenger холбоос оруулна уу.');
  const bankName=has('bankName')?clean(b.bankName,80):current.bankName;
  const bankAccount=has('bankAccount')?clean(b.bankAccount,40):current.bankAccount;
  const accountName=has('accountName')?clean(b.accountName,100):current.accountName;
  const ibanInput=has('bankIban')?b.bankIban:has('bankIbn')?b.bankIbn:current.bankIban;
  const bankIban=normalizeIban(ibanInput);
  if(bankName.length<2)throw new ApiError(400,'Банкны нэрийг зөв оруулна уу.');
  if(!validAccount(bankAccount))throw new ApiError(400,'Дансны дугаар 6–40 тэмдэгт, зөвхөн үсэг/тоо байх ёстой.');
  if(accountName.length<2)throw new ApiError(400,'Данс эзэмшигчийн нэрийг зөв оруулна уу.');
  if(hasIban&&!bankIban)throw new ApiError(400,'Монгол IBAN нь MN + 18 цифр, нийт 20 тэмдэгт байна.');
  // Preserve the historical messenger-only payload on a brand-new install, while
  // merging it with stored payment details once richer settings exist.
  const saved=legacyMessengerOnly&&!found?{messengerUrl}:{messengerUrl,bankName,bankAccount,accountName,bankIban};
  await db('rpc/kino_save_settings','POST',{settings_value:JSON.stringify(saved)});
  return json({messengerUrl,bankName,bankAccount,accountName,bankIban,ibanSetupRequired:!bankIban});
 }catch(e){return fail(e);}
}
