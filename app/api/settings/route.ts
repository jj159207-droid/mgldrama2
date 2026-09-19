import { NextRequest } from 'next/server';
import { ApiError,bodyJson,db,fail,json,originCheck,session } from '@/lib/server';
import { isRow,safeUrl } from '@/lib/domain';
export const runtime='nodejs';

function normalizeIban(value:unknown) {
 const compact=typeof value==='string'?value.toUpperCase().replace(/\s+/g,''):'';
 return /^MN\d{18}$/.test(compact)?compact:'';
}

const FIXED_BANK_NAME='Хаан банк';
const FIXED_ACCOUNT_NAME='Т.Жаргалбаяр';
const DEFAULTS={
 messengerUrl:safeUrl(process.env.MESSENGER_URL),
 bankIban:normalizeIban(process.env.BANK_IBAN||process.env.BANK_IBN),
};

const clean=(value:unknown,max:number)=>typeof value==='string'?value.trim().replace(/\s+/g,' ').slice(0,max):'';

async function storedSettings(){
 const [row]=await db('sms_logs?key=eq.site_settings&select=value&order=id.desc&limit=1');
 let settings:unknown={};try{settings=JSON.parse(String(row?.value||'{}'));}catch{}
 return {found:!!row,settings:isRow(settings)?settings:{}};
}

function normalize(settings:Record<string,unknown>){
 const messengerUrl=safeUrl(settings.messengerUrl)||DEFAULTS.messengerUrl;
 const bankIban=normalizeIban(settings.bankIban??settings.bankIbn)||DEFAULTS.bankIban;
 return {
  messengerUrl,
  bankName:FIXED_BANK_NAME,
  accountName:FIXED_ACCOUNT_NAME,
  bankIban,
  ibanSetupRequired:!bankIban,
 };
}

export async function GET() {
 try { const {settings}=await storedSettings(); return json(normalize(settings)); }
 catch(e){
  if(e instanceof ApiError && ['42703','42P01','PGRST204','PGRST205'].includes(e.code))
   return json({messengerUrl:DEFAULTS.messengerUrl,bankName:FIXED_BANK_NAME,accountName:FIXED_ACCOUNT_NAME,bankIban:DEFAULTS.bankIban,ibanSetupRequired:!DEFAULTS.bankIban,setupRequired:true});
  return fail(e);
 }
}

export async function PUT(req:NextRequest) {
 try {
  originCheck(req);
  if(!(await session(req))?.admin)throw new ApiError(403,'Админы эрх шаардлагатай.');
  const b=await bodyJson(req,4096);
  const allowed=new Set(['messengerUrl','bankIban','bankIbn']);
  if(Object.keys(b).some(key=>!allowed.has(key)))throw new ApiError(400,'Банкны тохиргоонд зөвхөн IBAN дугаар өөрчилнө.');
  const has=(key:string)=>Object.prototype.hasOwnProperty.call(b,key);
  const hasIban=has('bankIban')||has('bankIbn');
  const {settings:stored}=await storedSettings();
  const current=normalize(stored);
  const messengerRaw=has('messengerUrl')?clean(b.messengerUrl,2000):current.messengerUrl;
  const messengerUrl=messengerRaw?safeUrl(messengerRaw):'';
  if(messengerRaw&&!messengerUrl)throw new ApiError(400,'Зөв HTTPS Messenger холбоос оруулна уу.');
  const ibanInput=has('bankIban')?b.bankIban:has('bankIbn')?b.bankIbn:current.bankIban;
  const bankIban=normalizeIban(ibanInput);
  if(hasIban&&!bankIban)throw new ApiError(400,'Монгол IBAN нь MN + 18 цифр, нийт 20 тэмдэгт байна.');
  await db('rpc/kino_save_settings','POST',{settings_value:JSON.stringify({messengerUrl,bankIban})});
  return json({
   messengerUrl,
   bankName:FIXED_BANK_NAME,
   accountName:FIXED_ACCOUNT_NAME,
   bankIban,
   ibanSetupRequired:!bankIban,
  });
 }catch(e){return fail(e);}
}
