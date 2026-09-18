import { NextRequest } from 'next/server';
import { ApiError,bodyJson,db,fail,json,originCheck,session } from '@/lib/server';
import { plans,safeUrl,type Row } from '@/lib/domain';
import { migrateInlinePoster } from '@/lib/posters';
export const runtime='nodejs';
const tables=['films','users','pending_payments','contact_messages','sms_logs'];
function validateFilm(b:Row) {
  const fields=['title','description','views','op','price','badge','free','locked','url','img','bg','preview_url'];
  if(Object.keys(b).some(k=>!fields.includes(k)))throw new ApiError(400,'Киноны талбар буруу.');
  if('title'in b && (typeof b.title!=='string'||!b.title.trim()))throw new ApiError(400,'Гарчиг оруулна уу.');
  if('description' in b && (typeof b.description!=='string'||b.description.length>4000))throw new ApiError(400,'Киноны тайлбар 4000 хүртэл тэмдэгт байна.');
  if('badge' in b && (typeof b.badge!=='string' || !['Эротик','Гадаад','Хятад'].includes(b.badge.split('|')[1] || 'Эротик')))throw new ApiError(400,'Киноны ангиллыг сонгоно уу. Бүгд нь киноны ангилал биш.');
  for(const k of ['views','op','price'])if(k in b && (typeof b[k]!=='number'||!Number.isSafeInteger(b[k])||Number(b[k])<0))throw new ApiError(400,'Үнэ болон үзсэн тоо 0 эсвэл эерэг бүхэл тоо байна.');
  for(const k of ['free','locked'])if(k in b && typeof b[k]!=='boolean')throw new ApiError(400,'Киноны төлөв буруу.');
  for(const k of ['url','preview_url'])if(b[k] && (typeof b[k]!=='string'||String(b[k]).split('|||').some(u=>u && !safeUrl(u))))throw new ApiError(400,'Зөв HTTPS видео холбоос оруулна уу.');
  if(b.img && !safeUrl(b.img,true))throw new ApiError(400,'Зөв зургийн холбоос эсвэл 2 MB хүртэл PNG/JPEG/WebP/GIF зураг оруулна уу.');
}
async function handler(req:NextRequest) {
 try {
  if(req.method!=='GET')originCheck(req);
  const path=new URL(req.url).searchParams.get('path') || '';
  const [table,rawQuery='']=path.split('?');
  if(!tables.includes(table)||path.split('?').length>2)throw new ApiError(400,'Хүсэлтийн зам буруу.');
  const query=new URLSearchParams(rawQuery);
  for(const [k,v]of query)if(!/^[a-z_]+$/.test(k)||v.length>500)throw new ApiError(400,'Шүүлтийн формат буруу.');
  const select=query.get('select');
  if(select&&!/^[a-z_*,]+$/.test(select))throw new ApiError(400,'Баганын сонголт буруу.'); // no relationship joins or credential aliases
  const s=await session(req),admin=s?.admin===true;
  if(!admin){
    const fields=table==='films'?['id','title','badge','free','locked','price','views','op','created_at']:
      table==='pending_payments'?['id','ref_code','user_id','film_id','plan','status','created_at','confirmed_at']:
      ['id','is_announcement','created_at'];
    // Filtering by a hidden video URL can otherwise reveal it one character at
    // a time even when it is excluded from SELECT.
    for(const [key,value] of query){
      if(!['select','order','limit','offset',...fields].includes(key))throw new ApiError(400,'Энэ шүүлт зөвшөөрөгдөөгүй.');
      if(key==='order'&&!value.split(',').every(part=>{const [column,...rest]=part.split('.');return fields.includes(column)&&rest.every(v=>['asc','desc','nullsfirst','nullslast'].includes(v));}))throw new ApiError(400,'Эрэмбэлэх талбар буруу.');
    }
  }
  for(const key of ['limit','offset'])if(query.has(key)&&(!/^\d+$/.test(query.get(key)!)||Number(query.get(key))>(key==='limit'?2000:1000000)))throw new ApiError(400,'Жагсаалтын хэмжээ буруу.');
  let b:Row|undefined=req.method==='GET'||req.method==='DELETE'?undefined:await bodyJson(req);
  if(!admin) {
    if(table==='films'&&req.method==='GET') {
      query.set('select','id,title,description,views,op,price,badge,free,locked,img,bg,preview_url,created_at');
    }else if(table==='pending_payments'&&s?.userId) {
      if(req.method==='GET') {
        query.set('user_id',`eq.${s.userId}`);query.set('select','id,ref_code,user_id,film_id,plan,amount,status,created_at,confirmed_at');
      }else if(req.method==='POST'&&b) {
        const plan=String(b.plan||'single'),ref=String(b.ref_code||'');
        if(!/^\d{6}$/.test(ref))throw new ApiError(400,'Гүйлгээний код буруу.');
        let amount=plans[plan],filmId:number|null=null;
        if(plan==='wallet_topup') {
          amount=Number(b.amount);
          if(!Number.isSafeInteger(amount)||amount<5000||amount>200000||amount%1000!==0)throw new ApiError(400,'Цэнэглэх дүн 5,000₮-өөс багагүй, 1,000₮-ийн алхамтай байна.');
        }else if(plan==='single') {
          filmId=Number(b.film_id);if(!Number.isSafeInteger(filmId)||filmId<=0)throw new ApiError(400,'Киноны ID буруу.');
          const [film]=await db(`films?id=eq.${filmId}&select=id,price,free,locked`);
          if(!film || film.free===true || film.locked===false)throw new ApiError(400,'Төлбөр шаардах кино олдсонгүй.');
          amount=Number(film.price);
        }
        if(!Number.isSafeInteger(amount)||amount<=0)throw new ApiError(400,'Багц эсвэл үнэ буруу.');
        const [u]=await db(`users?id=eq.${s.userId}&select=phone`);
        b={ref_code:ref,film_id:filmId,amount,status:'pending',user_id:s.userId,phone:u?.phone,plan};
        // Recover a concurrent insert only for the same owner and purchase.
        const lookup=()=>db(`pending_payments?ref_code=eq.${ref}&select=*`);
        const samePurchase=(row:Row)=>String(row.user_id)===String(s.userId)
          && row.plan===plan && (filmId===null?row.film_id===null:String(row.film_id)===String(filmId))
          && Number(row.amount)===amount && ['pending','confirmed'].includes(String(row.status))
          && Date.now()-Date.parse(String(row.created_at))>=0
          && Date.now()-Date.parse(String(row.created_at))<24*3600000;
        const conflict=()=>new ApiError(409,'Гүйлгээний код давхардлаа. Шинэ код үүсгэнэ үү.','REF_CONFLICT');
        const [old]=await lookup();
        if(old) {
          if(samePurchase(old))return json([old]);
          throw conflict();
        }
        try {
          return json(await db('pending_payments','POST',b));
        }catch(error) {
          if(!(error instanceof ApiError)||error.code!=='23505')throw error;
          const [saved]=await lookup();
          if(saved && samePurchase(saved))return json([saved]);
          if(saved)throw conflict();
          throw error;
        }
      }else throw new ApiError(403,'Төлбөр баталгаажуулах эрхгүй.');
    }else if(table==='contact_messages'&&req.method==='GET') {
      query.set('is_announcement','eq.true');query.set('select','id,message,announcement_image,created_at');
    }else throw new ApiError(403,'Нэвтрэх эсвэл админы эрх шаардлагатай.');
  }
  if(table==='users') {
    if(req.method!=='GET')throw new ApiError(405,'Хэрэглэгчийн өөрчлөлтийг зөвхөн баталгаажуулсан нэвтрэлтийн үйлдлээр хийнэ.');
    query.set('select','id,phone,user_id,is_guest,created_at');
  }
  if(table==='films'&&b){
    validateFilm(b);
    if(typeof b.img==='string'&&b.img.startsWith('data:'))b.img=(await migrateInlinePoster(b.img)).url;
  }
  if(table==='pending_payments'&&admin&&req.method==='DELETE')throw new ApiError(405,'Гүйлгээний кодын түүхийг устгахгүй. Захиалгын эрхийг хасах үйлдлийг ашиглана уу.');
  if(table==='pending_payments'&&admin&&req.method==='PATCH'&&b){
    if(!['confirmed','revoked'].includes(String(b.status))||Object.keys(b).some(k=>!['status','confirmed_at'].includes(k)))throw new ApiError(400,'Захиалгыг зөвхөн баталгаажуулах эсвэл эрхийг хасах боломжтой.');
    const refFilter=query.get('ref_code'),idFilter=query.get('id');
    const targetFilter=refFilter?.startsWith('eq.')?`ref_code=${encodeURIComponent(refFilter.slice(3))}`:idFilter?.startsWith('eq.')?`id=${encodeURIComponent(idFilter.slice(3))}`:'';
    if(targetFilter){
      const [target]=await db(`pending_payments?${targetFilter}&select=id,ref_code,plan,amount,status&limit=1`);
      if(target?.plan==='wallet_topup'){
        if(b.status==='revoked')throw new ApiError(400,'Цэнэглэгдсэн үлдэгдлийг эрх хасах товчоор буцаахгүй. Wallet гүйлгээг шалгана уу.');
        if(target.status==='confirmed')return json(await db(`pending_payments?id=eq.${target.id}&select=*`));
        if(target.status!=='pending')throw new ApiError(409,'Цэнэглэлтийн төлөв өөрчлөгдсөн байна.');
        await db('rpc/kino_wallet_confirm_topup','POST',{
          p_payment:Number(target.id),
          p_ref:String(target.ref_code),
          p_amount:Number(target.amount),
          p_allow_expired:true,
        });
        return json(await db(`pending_payments?id=eq.${target.id}&select=*`));
      }
    }
    b={status:b.status};
  }
  if(table==='pending_payments'&&admin&&req.method==='POST'&&b) {
    const uid=Number(b.user_id),plan=String(b.plan||'single');
    if(!Number.isSafeInteger(uid)||uid<=0||!/^\d{6}$/.test(String(b.ref_code||'')))throw new ApiError(400,'Хэрэглэгч эсвэл гүйлгээний код буруу.');
    if(plan!=='single' && !Object.prototype.hasOwnProperty.call(plans,plan))throw new ApiError(400,'Багц буруу.');
    const [owner]=await db(`users?id=eq.${uid}&select=id,phone`);
    if(!owner)throw new ApiError(404,'Хэрэглэгч олдсонгүй.');
    let filmId:number|null=null;
    if(plan==='single'){
      filmId=Number(b.film_id);
      if(!Number.isSafeInteger(filmId)||filmId<=0)throw new ApiError(400,'Кино сонгоно уу.');
      const [film]=await db(`films?id=eq.${filmId}&select=id`);
      if(!film)throw new ApiError(404,'Кино олдсонгүй.');
    }
    if(b.status!=='confirmed')throw new ApiError(400,'Админы эрх олгох төлөв буруу.');
    b={ref_code:String(b.ref_code),user_id:uid,phone:owner.phone,film_id:filmId,plan,amount:0,status:'confirmed'};
  }
  if(table==='pending_payments'&&admin&&b?.status==='confirmed') {
    b.confirmed_at=new Date().toISOString();
    if(req.method==='PATCH')query.set('status','eq.pending'); // repeated confirmation cannot extend access
  }
  if(['PATCH','DELETE'].includes(req.method)&&!['id','ref_code','key'].some(k=>query.get(k)?.startsWith('eq.')))throw new ApiError(400,'Өөрчлөх мөрийг сонгоно уу.');
  if(req.method==='GET'&&!query.has('limit'))query.set('limit','2000');
  let rows:Row[];
  try {rows=await db(`${table}?${query}`,req.method,b);}
  catch(error){
    // Older installs remain readable until the additive description update runs.
    if(table==='films'&&!admin&&req.method==='GET'&&error instanceof ApiError&&['42703','PGRST204'].includes(error.code)){
      query.set('select',query.get('select')!.split(',').filter(field=>field!=='description').join(','));
      rows=await db(`${table}?${query}`,req.method,b);
    }else if(table==='films'&&admin&&b&&'description' in b&&error instanceof ApiError&&['42703','PGRST204'].includes(error.code)){
      throw new ApiError(409,'Киноны тайлбар хадгалах шинэчлэлийг эхлээд суулгана уу. Админы суулгах зааврыг шалгана уу.','FILM_DESCRIPTION_SETUP_REQUIRED');
    }else throw error;
  }
  if(req.method==='PATCH'&&rows.length===0)throw new ApiError(409,'Өөрчлөх мөр олдсонгүй эсвэл аль хэдийн өөрчлөгдсөн байна.');
  if(table==='films'&&!admin)return json(rows.map(row=>({...row,description:typeof row.description==='string'?row.description:'',img:safeUrl(row.img,true),url:row.preview_url?`|||${safeUrl(row.preview_url)}`:''})));
  return json(rows);
 }catch(e){return fail(e);}
}
export const GET=handler;export const POST=handler;export const PATCH=handler;export const DELETE=handler;
