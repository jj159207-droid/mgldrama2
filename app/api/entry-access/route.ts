import { NextRequest } from 'next/server';
import { fail, json, requestSite } from '@/lib/server';
export const runtime='nodejs';
// Legacy endpoint: TAZA viewing no longer requires prior payment or registration.
export async function GET(req:NextRequest) {
  try {return json({allowed:true,reason:'free_catalog',site:requestSite(req)});}
  catch(error){return fail(error);}
}
