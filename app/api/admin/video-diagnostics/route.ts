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

function summarizeLibraries(rows:Row[]){
  const stateCounts:Record<string,number>={};
  const libraries:Record<string,number>={};
  const hostCounts:Record<string,number>={};
  for(const row of rows){
    const source=sourceType(row.url);
    stateCounts[source.state]=(stateCounts[source.state]||0)+1;
    hostCounts[source.kind]=(hostCounts[source.kind]||0)+1;
    if(source.kind!=='bunny'||source.state!=='configured')continue;
    try {
      const sourceUrl=new URL(source.url);
      const libraryId=/^\/embed\/(\d+)\//.exec(sourceUrl.pathname)?.[1];
      if(libraryId)libraries[libraryId]=(libraries[libraryId]||0)+1;
    }catch{}
  }
  return {stateCounts,hostCounts,libraries:Object.entries(libraries).map(([libraryId,count])=>({libraryId,count})).sort((a,b)=>b.count-a.count)};
}

export async function GET(req:NextRequest){
 try {
   if(requestSite(req)!=='taza')throw new ApiError(404,'TAZA-д зориулсан оношлогоо.');
   const s=await session(req);
   if(!s?.admin||!s.masterAdmin)throw new ApiError(403,'Зөвхөн үндсэн админ шалгана.');
   const idParam=new URL(req.url).searchParams.get('id');
   if(idParam===null){
     const rows=await db('films?site_id=eq.taza&select=id,title,url&order=id.asc&limit=200');
     return json({films:rows.map(summarize),summary:summarizeLibraries(rows),limited:rows.length===200});
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
     // A HEAD probe is not equivalent to the HTML player request. Several
     // providers respond to HEAD differently (404/405), and domain-referrer
     // controls can block server-side requests even when browser playback works.
     // Approximate the actual iframe request with an origin-only Referer.
     // Never forward the viewer's cookie or a private URL to the client.
     const init={
       redirect:'manual' as const,
       cache:'no-store' as const,
       headers:{'Referer':'https://taza.site/','Accept':'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8'},
     };
     const head=await fetch(endpoint,{...init,method:'HEAD',signal:AbortSignal.timeout(6500)});
     const headStatus=head.status;
     let verified=head;
     let method:'HEAD'|'GET'='HEAD';
     if([400,403,404,405].includes(headStatus) || headStatus>=500){
       // Re-check using GET before calling a video missing; abort after headers
       // to avoid downloading the body or paid video data into the function.
       try {
         verified=await fetch(endpoint,{...init,method:'GET',signal:AbortSignal.timeout(6500)});
         method='GET';
         await verified.body?.cancel();
       }catch{
         return json({...details,probe:'head_only',headStatus,httpStatus:headStatus,
           hint:'HEAD шалгалт татгалзсан бөгөөд бодит GET шалгалт амжилтгүй. Энэ нь заавал видео 404 гэсэн үг биш. Bunny дээр өөрөө тоглуулж шалгана уу.'});
       }
     }
     const status=verified.status;
     const hint=status===404?'HEAD болон бодит GET шалгалтаар Bunny 404 буцаалаа. Видео сангийн ID, видео ID, дансны төлөв, холбоосыг Bunny Stream дээр шалгана уу.':
       status===403?'Bunny домэйн зөвшөөрөл, токен болон хязгаарлалтаар хандах эрх олгоогүй байна. Bunny Security тохиргоо, allowed domains, токеныг шалгана уу.':
       status===401?'Bunny токен эсвэл баталгаажуулалтын тохиргоог шалгана уу.':
       status===405?'Bunny энэ төрлийн хүсэлтийг дэмжихгүй байна; хэрэглэгчийн браузер дээр бодитоор тоглуулж шалгана.':
       status>=300&&status<400?'Bunny өөр хаяг руу чиглүүлж байна; дамжуулалтыг дагаж нууц токен алдахаас сэргийлэн хязгаарлав.':
       verified.ok?'Bunny холбоос HTTP түвшинд ажиллаж байна. Кино бодитоор тоглох эсэхийг браузер дээр тусад нь шалгах шаардлагатай.':
       'Bunny эх сурвалжийн HTTP хариуг шалгана уу.';
     return json({...details,probe:'http',headStatus,httpStatus:status,method,hint});
   }catch{
     return json({...details,probe:'network_error',hint:'Bunny серверийн хариуг авч чадсангүй. Bunny Stream домэйн, интернет болон дансны төлөвийг шалгана уу.'});
   }
 }catch(e){return fail(e);}
}
