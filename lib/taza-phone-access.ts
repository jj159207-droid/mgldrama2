import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { db } from '@/lib/server';

export const PHONE_GRANT_COOKIE = 'taza_phone_access_v1';
export const PHONE_GRANT_SESSION_SECONDS = 30 * 24 * 60 * 60;
export const phoneIsValid = (phone:unknown):phone is string =>
  typeof phone === 'string' && /^[0-9]{8}$/.test(phone);

export const hashPhoneToken = (token:string):string =>
  createHash('sha256').update(token).digest('hex');

export async function phoneGrantAllowsPlayback(req:NextRequest,filmId:number):Promise<boolean> {
  if(!Number.isSafeInteger(filmId)||filmId<=0)return false;
  const token=req.cookies.get(PHONE_GRANT_COOKIE)?.value;
  if(!token||!/^[a-f0-9]{64}$/.test(token))return false;
  const now=encodeURIComponent(new Date().toISOString());
  const [issued]=await db('taza_phone_sessions?token_hash=eq.'+hashPhoneToken(token)+'&expires_at=gt.'+now+'&select=grant_id&limit=1');
  const grantId=Number(issued?.grant_id);
  if(!Number.isSafeInteger(grantId)||grantId<=0)return false;
  const [grant]=await db('taza_phone_grants?id=eq.'+grantId+'&site_id=eq.taza&active=eq.true&select=access_type,film_id&limit=1');
  return grant?.access_type==='all' || (grant?.access_type==='single' && Number(grant.film_id)===filmId);
}
