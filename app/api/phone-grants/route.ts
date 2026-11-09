import { NextRequest } from 'next/server';
import { ApiError, bodyJson, canAdminSite, db, fail, json, originCheck, requestSite, session } from '@/lib/server';
import { phoneIsValid } from '@/lib/taza-phone-access';

export const runtime = 'nodejs';

async function authorized(req:NextRequest) {
  const site=requestSite(req);
  if(site!=='taza'||!canAdminSite(await session(req),site))
    throw new ApiError(403,'TAZA админы эрх шаардлагатай.');
}

export async function GET(req:NextRequest) {
  try {
    await authorized(req);
    const items=await db('taza_phone_grants?site_id=eq.taza&select=id,phone,access_type,film_id,active,created_at,updated_at&order=id.desc&limit=300');
    return json({items});
  }catch(error){return fail(error);}
}

export async function POST(req:NextRequest) {
  try {
    originCheck(req);
    await authorized(req);
    const body=await bodyJson(req,2048);
    const phone=body.phone;
    if(!phoneIsValid(phone))throw new ApiError(400,'8 оронтой утасны дугаар оруулна уу.');
    const action=String(body.action||'save');
    if(!['save','revoke'].includes(action))throw new ApiError(400,'Үйлдэл буруу байна.');
    if(action==='save'&&!['single','all'].includes(String(body.access_type)))
      throw new ApiError(400,'1 кино эсвэл бүх киноны эрх сонгоно уу.');

    const [existing]=await db('taza_phone_grants?site_id=eq.taza&phone=eq.'+phone+'&select=id&limit=1');
    if(action==='revoke'){
      if(existing){
        await db('taza_phone_grants?id=eq.'+existing.id,'PATCH',{active:false,updated_at:new Date().toISOString()});
        await db('taza_phone_sessions?grant_id=eq.'+existing.id,'DELETE');
      }
      return json({ok:true});
    }
    const payload={access_type:String(body.access_type),film_id:null,active:true,updated_at:new Date().toISOString()};
    if(existing){
      await db('taza_phone_grants?id=eq.'+existing.id,'PATCH',payload);
      // Reissuing a grant also invalidates all prior browser cookies.
      await db('taza_phone_sessions?grant_id=eq.'+existing.id,'DELETE');
    }else{
      await db('taza_phone_grants','POST',{...payload,site_id:'taza',phone});
    }
    return json({ok:true});
  }catch(error){return fail(error);}
}
