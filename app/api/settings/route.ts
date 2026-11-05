import { NextRequest } from 'next/server';
import { ApiError,bodyJson,canAdminSite,db,fail,json,originCheck,requestSite,session } from '@/lib/server';
import { safeUrl } from '@/lib/domain';
import { normalizeMongolianIban } from '@/lib/iban';
export const runtime='nodejs';

const clean=(value:unknown,max:number)=>typeof value==='string'?value.trim().replace(/\s+/g,' ').slice(0,max):'';
const validAccount=(value:string)=>/^[A-Za-z0-9 -]{6,40}$/.test(value);

function normalizeRow(row:Record<string,unknown>|undefined) {
  const messengerUrl=safeUrl(row?.messenger_url)||'';
  const bankName=clean(row?.bank_name,80)||'Хаан банк';
  const rawAccount=clean(row?.bank_account,40);
  const bankAccount=validAccount(rawAccount)?rawAccount:'5251258979';
  const accountName=clean(row?.account_name,100)||'Т.Жаргалбаяр';
  const bankIban=normalizeMongolianIban(row?.bank_iban);
  return {messengerUrl,bankName,bankAccount,accountName,bankIban,ibanSetupRequired:!bankIban};
}

export async function GET(req?:NextRequest) {
  try {
    const site=req?requestSite(req):'taza';
    const [row]=await db(`site_settings?site_id=eq.${site}&select=messenger_url,bank_name,bank_account,account_name,bank_iban&limit=1`);
    return json({...normalizeRow(row),site});
  } catch(error) {
    if(error instanceof ApiError && ['42703','42P01','PGRST204','PGRST205'].includes(error.code))
      return json({...normalizeRow(undefined),site:'taza',setupRequired:true});
    return fail(error);
  }
}

export async function PUT(req:NextRequest) {
  try {
    originCheck(req);
    const site=requestSite(req),s=await session(req);
    if(!canAdminSite(s,site))throw new ApiError(403,'Энэ сайтын админы эрх шаардлагатай.');

    const b=await bodyJson(req,4096);
    const [stored]=await db(`site_settings?site_id=eq.${site}&select=messenger_url,bank_name,bank_account,account_name,bank_iban&limit=1`);
    const current=normalizeRow(stored);
    const has=(key:string)=>Object.prototype.hasOwnProperty.call(b,key);

    const messengerRaw=has('messengerUrl')?clean(b.messengerUrl,2000):current.messengerUrl;
    const messengerUrl=messengerRaw?safeUrl(messengerRaw):'';
    if(messengerRaw&&!messengerUrl)throw new ApiError(400,'Зөв HTTPS Messenger холбоос оруулна уу.');

    const bankName=has('bankName')?clean(b.bankName,80):current.bankName;
    const bankAccount=has('bankAccount')?clean(b.bankAccount,40):current.bankAccount;
    const accountName=has('accountName')?clean(b.accountName,100):current.accountName;
    const ibanRaw=has('bankIban')?clean(b.bankIban,50).replace(/\s+/g,''):'';
    const bankIban=has('bankIban')?normalizeMongolianIban(ibanRaw):current.bankIban;

    if(bankName.length<2)throw new ApiError(400,'Банкны нэрийг зөв оруулна уу.');
    if(!validAccount(bankAccount))throw new ApiError(400,'Дансны дугаар 6–40 тэмдэгт, зөвхөн үсэг/тоо байх ёстой.');
    if(accountName.length<2)throw new ApiError(400,'Данс эзэмшигчийн нэрийг зөв оруулна уу.');
    if(has('bankIban')&&ibanRaw&&!bankIban)throw new ApiError(400,'Монгол IBAN нь MN-ээр эхэлсэн 20 тэмдэгт, зөв хяналтын оронтой байх ёстой. Банкнаасаа бүтэн IBAN авна уу.');

    const payload={
      messenger_url:messengerUrl,bank_name:bankName,bank_account:bankAccount,
      account_name:accountName,bank_iban:bankIban,updated_at:new Date().toISOString()
    };
    const rows=await db(`site_settings?site_id=eq.${site}`,'PATCH',payload);
    if(!rows.length)await db('site_settings','POST',{site_id:site,...payload});
    return json({messengerUrl,bankName,bankAccount,accountName,bankIban,ibanSetupRequired:!bankIban,site});
  } catch(error) {return fail(error);}
}
