import { NextRequest } from 'next/server';
import { ApiError,bodyJson,canAdminSite,db,fail,json,originCheck,requestSite,session } from '@/lib/server';
import { safeUrl } from '@/lib/domain';
export const runtime='nodejs';

function normalizeIban(value:unknown) {
  const compact=typeof value==='string'?value.toUpperCase().replace(/\s+/g,''):'';
  return /^MN\d{1,8}$/.test(compact)?compact:'';
}
const clean=(value:unknown,max:number)=>typeof value==='string'?value.trim().replace(/\s+/g,' ').slice(0,max):'';
const validAccount=(value:string)=>/^[A-Za-z0-9 -]{6,40}$/.test(value);

function normalizeRow(row:Record<string,unknown>|undefined) {
  const messengerUrl=safeUrl(row?.messenger_url)||'';
  const bankName=clean(row?.bank_name,80)||'Хаан банк';
  const rawAccount=clean(row?.bank_account,40);
  const bankAccount=validAccount(rawAccount)?rawAccount:'5251258979';
  const accountName=clean(row?.account_name,100)||'Т.Жаргалбаяр';
  const bankIban=normalizeIban(row?.bank_iban)||'MN03000500';
  return {messengerUrl,bankName,bankAccount,accountName,bankIban,ibanSetupRequired:!bankIban};
}

export async function GET(req?:NextRequest) {
  try {
    const site=req?requestSite(req):'taza';
    const [row]=await db(`site_settings?site_id=eq.${site}&select=messenger_url,bank_name,bank_account,account_name,bank_iban&limit=1`);
    return json({...normalizeRow(row),site});
  } catch(error) {return fail(error);}
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
    const bankIban=has('bankIban')?normalizeIban(b.bankIban):current.bankIban;

    if(bankName.length<2)throw new ApiError(400,'Банкны нэрийг зөв оруулна уу.');
    if(!validAccount(bankAccount))throw new ApiError(400,'Дансны дугаар 6–40 тэмдэгт, зөвхөн үсэг/тоо байх ёстой.');
    if(accountName.length<2)throw new ApiError(400,'Данс эзэмшигчийн нэрийг зөв оруулна уу.');
    if(has('bankIban')&&!bankIban)throw new ApiError(400,'IBAN нь MN-ээр эхэлсэн, нийт 10 хүртэл тэмдэгт байна.');

    const payload={
      messenger_url:messengerUrl,bank_name:bankName,bank_account:bankAccount,
      account_name:accountName,bank_iban:bankIban,updated_at:new Date().toISOString()
    };
    const rows=await db(`site_settings?site_id=eq.${site}`,'PATCH',payload);
    if(!rows.length)await db('site_settings','POST',{site_id:site,...payload});
    return json({messengerUrl,bankName,bankAccount,accountName,bankIban,ibanSetupRequired:!bankIban,site});
  } catch(error) {return fail(error);}
}
