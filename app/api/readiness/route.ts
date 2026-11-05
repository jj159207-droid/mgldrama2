import {NextRequest} from 'next/server';
import {ApiError,db,fail,json,requestSite,session} from '@/lib/server';
import {APP_VERSION,configurationChecks} from '@/lib/readiness';
import {auditCatalogMedia,type CatalogReadiness} from '@/lib/media-audit';
import {normalizeMongolianIban} from '@/lib/iban';
import type {Row} from '@/lib/domain';
export const runtime='nodejs';

async function catalogReadiness(site:string):Promise<CatalogReadiness>{
  const films:Row[]=[];
  let lastId=0,truncated=false;
  for(;;){
    if(films.length>=2000){truncated=true;break;}
    const limit=Math.min(200,2000-films.length);
    const rows=await db(`films?site_id=eq.${site}&id=gt.${lastId}&select=id,title,url,preview_url,img,description&order=id.asc&limit=${limit}`);
    if(!rows.length)break;
    const next=Number(rows[rows.length-1].id);
    if(!Number.isSafeInteger(next)||next<=lastId)throw new Error('Invalid catalog audit cursor');
    films.push(...rows);
    lastId=next;
  }
  return auditCatalogMedia(films,truncated);
}

export async function GET(req:NextRequest){
  try{
    const s=await session(req);
    if(!s?.admin||!s.masterAdmin)throw new ApiError(403,'Үндсэн админы эрх шаардлагатай.');
    const site=requestSite(req);
    const labels:Record<string,string>={tables_private:'Өгөгдлийн сангийн шууд хандалт хаалттай',poster_bucket:'Зургийн сан бэлэн',poster_policies:'Зургийг нийтэд өөрчлөх эрх хаалттай',payment_refs_unique:'Гүйлгээний код давхцахгүй',inline_posters:'Хуучин том зургууд шилжсэн',private_functions:'Серверийн функцүүд нийтэд хаалттай'};
    const checks=configurationChecks();
    try{
      const rows=await db('rpc/kino_readiness','POST',{});
      for(const row of rows)checks.push({name:String(row.check_name),ok:row.ok===true,label:labels[String(row.check_name)]||String(row.check_name)});
    }catch{checks.push({name:'database_check',ok:false,label:'Өгөгдлийн сангийн шалгалт амжилтгүй. HTTPS-UPGRADE.sql суулгалт болон холболтыг шалгана уу.'});}

    try{
      const [bank]=await db(`site_settings?site_id=eq.${site}&select=bank_iban&limit=1`);
      checks.push({name:'payment_iban',ok:!!normalizeMongolianIban(bank?.bank_iban),label:'Банкны 20 тэмдэгттэй хүчинтэй IBAN тохируулсан'});
    }catch{checks.push({name:'payment_iban',ok:false,label:'Банкны IBAN тохиргоог шалгаж чадсангүй'});}
    let catalog:CatalogReadiness|null=null;
    try{
      catalog=await catalogReadiness(site);
      checks.push({name:'catalog_sources',ok:catalog.total>0&&!catalog.truncated&&catalog.missingFull.count===0,label:`Бүтэн видео холбоостой: ${catalog.playableSourceCount}/${catalog.total} кино`});
      if(catalog.truncated)checks.push({name:'catalog_audit_limit',ok:false,label:'Киноны тоо 2,000-аас их тул аудит бүрэн биш'});
    }catch{
      checks.push({name:'catalog_audit',ok:false,label:'Кино бүрийн бүтэн видео холбоосыг шалгаж чадсангүй'});
    }
    return json({
      version:APP_VERSION,ok:checks.every(c=>c.ok),checks,catalog,
      note:'Киноны аудит нь холбоос байгаа эсэхийг шалгана. Bunny дээр видео бодитоор тоглох, банкны SMS хүрэх, сертификатыг тусад нь турших шаардлагатай.'
    });
  }catch(error){return fail(error);}
}
