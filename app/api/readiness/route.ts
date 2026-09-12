import {NextRequest} from 'next/server';
import {ApiError,db,fail,json,session} from '@/lib/server';
import {APP_VERSION,configurationChecks} from '@/lib/readiness';
export const runtime='nodejs';
export async function GET(req:NextRequest){
  try{
    if(!(await session(req))?.admin)throw new ApiError(403,'Админы эрх шаардлагатай.');
    const labels:Record<string,string>={tables_private:'Өгөгдлийн сангийн шууд хандалт хаалттай',poster_bucket:'Зургийн сан бэлэн',poster_policies:'Зургийг нийтэд өөрчлөх эрх хаалттай',payment_refs_unique:'Гүйлгээний код давхцахгүй',inline_posters:'Хуучин том зургууд шилжсэн',private_functions:'Серверийн функцүүд нийтэд хаалттай'};
    const checks=configurationChecks();
    try{
      const rows=await db('rpc/kino_readiness','POST',{});
      for(const row of rows)checks.push({name:String(row.check_name),ok:row.ok===true,label:labels[String(row.check_name)]||String(row.check_name)});
    }catch{checks.push({name:'database_check',ok:false,label:'Өгөгдлийн сангийн шалгалт амжилтгүй. HTTPS-UPGRADE.sql суулгалт болон холболтыг шалгана уу.'});}
    return json({version:APP_VERSION,ok:checks.every(c=>c.ok),checks,note:'Энэ шалгалт сертификат, бодит SMS дамжуулалт, Bunny-ийн хамгаалалтыг батлахгүй.'});
  }catch(error){return fail(error);}
}
