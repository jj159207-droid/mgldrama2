import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { isRow, type Row } from './domain';
import { siteFromHeader, type SiteId } from './site';
export function requestSite(req:NextRequest):SiteId {
  return siteFromHeader(req.headers.get('x-taza-site'));
}
export class ApiError extends Error {
  constructor(public status:number, message:string, public code = 'REQUEST_FAILED') {super(message);}
}
export function json(value: unknown, status=200) {return NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});}
export function fail(error:unknown) {
  if(error instanceof ApiError) return json({message:error.message,code:error.code},error.status);
  return json({message:'Серверийн хүсэлт амжилтгүй. Тохиргоо болон холболтоо шалгана уу.',code:'SERVER_ERROR'},500);
}
export function originCheck(req:NextRequest) {
  // A reverse proxy may expose an internal HTTP URL to Node. Trust only the
  // configured public origin, never arbitrary forwarded-host headers.
  const configured=process.env.SITE_URL?.trim();
  let expected=new URL(req.url).origin;
  if(configured){
    try {
      const url=new URL(configured);
      if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error();
      if(process.env.NODE_ENV==='production'&&url.protocol!=='https:')throw new Error();
      expected=url.origin;
    }catch{throw new ApiError(503,'SITE_URL тохиргоонд сайтын зөв HTTPS хаягийг оруулна уу.','CONFIG_REQUIRED');}
  }else if(process.env.NODE_ENV==='production')throw new ApiError(503,'SITE_URL тохиргоо дутуу байна.','CONFIG_REQUIRED');
  const origin=req.headers.get('origin');
  if (origin && origin !== expected) throw new ApiError(403,'Хүсэлтийн эх сурвалж буруу.');
  if (req.headers.get('sec-fetch-site') === 'cross-site') throw new ApiError(403,'Хүсэлт зөвшөөрөгдөөгүй.');
}
export async function bodyBytes(req:NextRequest,limit=3000000):Promise<Buffer> {
  const size=Number(req.headers.get('content-length'));
  if(size>limit)throw new ApiError(413,'Илгээсэн файл эсвэл өгөгдөл хэт том байна.');
  if(!req.body)return Buffer.alloc(0);
  const reader=req.body.getReader();const chunks:Uint8Array[]=[];let total=0;
  try {
    for(;;){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;
      if(total>limit){await reader.cancel();throw new ApiError(413,'Илгээсэн файл эсвэл өгөгдөл хэт том байна.');}
      chunks.push(value);
    }
  }finally{reader.releaseLock();}
  return Buffer.concat(chunks,total);
}
export async function bodyJson(req:NextRequest,limit=3000000):Promise<Row> {
  const text=(await bodyBytes(req,limit)).toString('utf8');
  try{const v:unknown=JSON.parse(text);if(isRow(v))return v;}catch{}
  throw new ApiError(400,'JSON өгөгдлийн формат буруу.');
}
export function supabaseConfig(){
  const value=process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!value||!key)throw new ApiError(503,'Серверийн Supabase тохиргоо дутуу байна.','CONFIG_REQUIRED');
  let url:URL;try{url=new URL(value);}catch{throw new ApiError(503,'Supabase хаяг буруу байна.','CONFIG_REQUIRED');}
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new ApiError(503,'Supabase HTTPS хаяг буруу байна.','CONFIG_REQUIRED');
  const headers:Record<string,string>={apikey:key};
  if(key.split('.').length===3)headers.Authorization=`Bearer ${key}`;
  return {url:url.origin,headers};
}
export async function db(path:string, method='GET', body?:unknown):Promise<Row[]> {
  const {url,headers:authHeaders}=supabaseConfig();
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
  try {
    const headers:Record<string,string>={...authHeaders,'Content-Type':'application/json',Prefer:'return=representation'};
    const res=await fetch(`${url}/rest/v1/${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:controller.signal,redirect:'error'});
    const text=await res.text();let data:unknown=null;try{data=text?JSON.parse(text):null;}catch{throw new ApiError(502,'Өгөгдлийн сангаас буруу хариу ирлээ.');}
    if(!res.ok) {
      const code=isRow(data)?String(data.code || res.status):String(res.status);
      const reason=code==='23505'?'Дугаар эсвэл гүйлгээний код давхардсан байна.':code==='42501'?'Өгөгдлийн сангийн эрх хүрэлцэхгүй байна.':code==='23502'?'Шаардлагатай баганын мэдээлэл дутуу байна.':`Өгөгдлийн сангийн хүсэлт амжилтгүй (${code}). SETUP-MN.md болон SQL тохиргоог шалгана уу.`;
      throw new ApiError(res.status===409?409:502,reason,code);
    }
    if(data===null)return [];
    if(!Array.isArray(data) || !data.every(isRow))throw new ApiError(502,'Өгөгдлийн сангийн формат буруу байна.');
    return data;
  } finally {clearTimeout(timer);}
}
const digest=(v:string)=>createHash('sha256').update(v).digest('hex');
export const equalSecret=(a:string,b:string)=>timingSafeEqual(Buffer.from(digest(a)),Buffer.from(digest(b)));
export function pinHash(pin:string) {const salt=randomBytes(16).toString('hex');return `scrypt:${salt}:${scryptSync(pin,salt,32).toString('hex')}`;}
export function pinMatches(pin:string,stored:unknown) {
  if(typeof stored!=='string')return false;
  if(!stored.startsWith('scrypt:'))return equalSecret(pin,stored); // Upgraded on first successful legacy login.
  const [,salt,hash]=stored.split(':');
  if(!/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{64}$/.test(hash || ''))return false;
  return equalSecret(scryptSync(pin,salt,32).toString('hex'),hash);
}
export interface Session { userId:number|null; admin:boolean }
const COOKIE='kino_session_v2';
export const DEVICE_COOKIE='taza_device_v1';
export async function session(req:NextRequest):Promise<Session|null> {
  const token=req.cookies.get(COOKIE)?.value;if(!token || !/^[a-f0-9]{64}$/.test(token))return null;
  const [row]=await db(`app_sessions?token_hash=eq.${digest(token)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=user_id,is_admin&limit=1`);
  return row?{userId:typeof row.user_id==='number'?row.user_id:null,admin:row.is_admin===true}:null;
}
export async function issueSession(req:NextRequest,userId:number|null,admin:boolean,ageOverride?:number) {
  await revokeSession(req);
  const token=randomBytes(32).toString('hex'),age=ageOverride ?? (admin?3600:604800);
  await db('app_sessions','POST',{token_hash:digest(token),user_id:userId,is_admin:admin,expires_at:new Date(Date.now()+age*1000).toISOString()});
  return {token,age};
}
export function setSessionCookie(res:NextResponse,token:string,age:number) {
  res.cookies.set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:age});return res;
}
export function setDeviceCookie(res:NextResponse,token:string,age=365*24*60*60) {
  res.cookies.set(DEVICE_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:age});return res;
}
export function clearDeviceCookie(res:NextResponse) {
  res.cookies.set(DEVICE_COOKIE,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0});return res;
}
export async function revokeSession(req:NextRequest) {const token=req.cookies.get(COOKIE)?.value;if(token)await db(`app_sessions?token_hash=eq.${digest(token)}`,'DELETE');}
export async function rateLimit(key:string) {
  // Atomic DB counter works across serverless instances, unlike an in-memory Map.
  const [result]=await db('rpc/kino_claim_attempt','POST',{bucket_key:digest(key)});
  if(result?.allowed!==true)throw new ApiError(429,'Олон удаа оролдсон байна. 15 минут хүлээгээд дахин оролдоно уу.');
}
export function publicUser(user:Row) {
  const guest=user.is_guest===true;
  return {id:user.id,phone:guest?'':user.phone,user_id:user.user_id || `#${String(user.id).padStart(6,'0')}`,browser_no:Number(user.browser_no||user.id),guest};
}
