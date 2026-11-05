import { NextRequest } from 'next/server';
import { ApiError,db,fail,json,requestSite,session } from '@/lib/server';
import { safeUrl,type Row } from '@/lib/domain';
import { getVideoEmbed } from '@/lib/film-details';

export const runtime='nodejs';
export const dynamic='force-dynamic';

function sourceType(value:unknown){
  const safe=safeUrl(typeof value==='string'?value.split('|||')[0]:'');
  if(!safe)return {state:'missing',kind:'none',url:''};
  const u=new URL(safe);
  if(['player.mediadelivery.net','iframe.mediadelivery.net'].includes(u.hostname)){
    if(!/^\/(?:embed|play)\/\d+\/[a-zA-Z0-9-]{16,64}\/?$/.test(u.pathname))
      return {state:'invalid_bunny_url',kind:'bunny',url:''};
    return {state:'configured',kind:'bunny',url:getVideoEmbed(safe).src};
  }
  if(/^vz-\d+\.b-cdn\.net$/.test(u.hostname)){
    return {state:'configured',kind:'bunny_cdn',url:getVideoEmbed(safe).src};
  }
  // Custom domains/other providers cannot be remotely probed safely here.
  return {state:'configured',kind:'other',url:''};
}
function summarize(row:Row){
  const source=sourceType(row.url);
  return {id:Number(row.id),title:String(row.title||'').slice(0,100),state:source.state,kind:source.kind};
}

export async function GET(req:NextRequest){
 try {
   if(requestSite(req)!=='taza')throw new ApiError(404,'TAZA-д зориулсан оношлогоо.');
   const s=await session(req);
   if(!s?.admin||!s.masterAdmin)throw new ApiError(403,'Зөвхөн үндсэн админ шалгана.');
   const idParam=new URL(req.url).searchParams.get('id');
   if(idParam===null){
     const rows=await db('films?site_id=eq.taza&select=id,title,url&order=id.asc&limit=200');
     return json({films:rows.map(summarize),limited:rows.length===200});
   }
   if(!/^\d{1,9}$/.test(idParam)||Number(idParam)<1)throw new ApiError(400,'Киноны ID буруу.');
   const [row]=await db(`films?site_id=eq.taza&id=eq.${idParam}&select=id,title,url&limit=1`);
   if(!row)throw new ApiError(404,'Кино олдсонгүй.');
   const details=summarize(row),source=sourceType(row.url);
   if(source.state!=='configured'||source.kind==='other')
     return json({...details,probe:'not_tested',hint:source.state==='missing'?'Бүтэн киноны URL байхгүй. Кино засвараас оруулна уу.':'Бүтэн киноны Bunny эх сурвалжийг шалгана уу.'});
   let endpoint:URL;
   try{endpoint=new URL(source.url);}catch{return json({...details,probe:'invalid_url'});}
   // Strict allowlist prevents admin input from turning this endpoint into an
   // open proxy or an SSRF probe of arbitrary internal or external services.
   const allowed=endpoint.hostname==='player.mediadelivery.net'
     || endpoint.hostname==='iframe.mediadelivery.net'
     || /^vz-\d+\.b-cdn\.net$/.test(endpoint.hostname);
   if(endpoint.protocol!=='https:'||!allowed||endpoint.port||endpoint.username||endpoint.password)
     return json({...details,probe:'not_tested',hint:'Видео эх сурвалжийн домэйныг шалгана уу.'});
   try {
     const response=await fetch(endpoint,{method:'HEAD',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(6500)});
     return json({...details,probe:'http',httpStatus:response.status,
       hint:response.status===404?'Bunny дээр видео/сангийн ID эсвэл холбоос олдсонгүй. Bunny dashboard-аас тухайн киноны Embed URL-ийг дахин хуулна уу.':
       response.status===403?'Bunny-ийн домэйн, токен болон нэвтрэх хамгаалалтыг шалгана уу.':
       response.status===405?'Сервер HEAD шалгалтыг дэмждэггүй; тоглуулагчаар бодитоор шалгана.':
       response.ok?'Холбоос HTTP түвшинд хариулж байна. Видео файлын тоглолт болон эрхийг мөн шалгах хэрэгтэй.':'Bunny эх сурвалжийн HTTP хариуг шалгана уу.'});
   }catch{
     return json({...details,probe:'network_error',hint:'Bunny серверийн хариуг авч чадсангүй. Домэйн, интернет болон Bunny талын төлөвийг шалгана уу.'});
   }
 }catch(e){return fail(e);}
}
