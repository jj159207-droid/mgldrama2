import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { ApiError, supabaseConfig } from './server';

export const POSTER_BUCKET='kino-posters';
export const MAX_POSTER_INPUT=4000000;
export const MAX_POSTER_OUTPUT=200000;

export async function optimizePoster(input:Buffer):Promise<Buffer>{
  if(!input.length||input.length>MAX_POSTER_INPUT)throw new ApiError(413,'4 MB хүртэл зураг сонгоно уу.');
  try{
    const options={limitInputPixels:24000000,animated:false,failOn:'warning' as const};
    const metadata=await sharp(input,options).metadata();
    if(!['jpeg','png','webp','gif'].includes(metadata.format||''))throw new Error('Unsupported image');
    // Contain keeps the entire poster, including its title, without stretching.
    for(const quality of [78,64,48]){
      const output=await sharp(input,options).rotate().resize(600,900,{fit:'contain',background:'#111822'})
        .flatten({background:'#111822'}).webp({quality,effort:4}).toBuffer();
      if(output.length<=MAX_POSTER_OUTPUT)return output;
    }
    throw new ApiError(413,'Энэ зургийг хангалттай багасгаж чадсангүй. Өөр зураг сонгоно уу.');
  }catch(error){
    if(error instanceof ApiError)throw error;
    throw new ApiError(400,'PNG, JPEG, WebP эсвэл GIF зураг сонгоно уу. Эвдэрсэн эсвэл хэт өндөр нягтралтай зураг байна.');
  }
}

export async function storePoster(input:Buffer){
  const output=await optimizePoster(input);
  // Content addressing makes lost-response retries safe and avoids stale CDN
  // images. Replacing a poster never overwrites or deletes the previous file.
  const path=`v1/${createHash('sha256').update(output).digest('hex')}.webp`;
  const {url,headers}=supabaseConfig();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(`${url}/storage/v1/object/${POSTER_BUCKET}/${path}`,{
      method:'POST',headers:{...headers,'Content-Type':'image/webp','Cache-Control':'max-age=31536000','x-upsert':'false'},
      body:new Uint8Array(output),signal:controller.signal,redirect:'error',cache:'no-store',
    });
    const data=await response.json().catch(()=>null);
    // Storage versions use either error or code for the duplicate response.
    const duplicate=[data?.error,data?.code].some(v=>['Duplicate','ResourceAlreadyExists','KeyAlreadyExists'].includes(v));
    if(!response.ok&&!duplicate){
      if(response.status===404||data?.error==='Bucket not found'||data?.code==='NoSuchBucket')
        throw new ApiError(503,'Зургийн сан бэлэн биш байна. POSTER-SETUP-MN.md зааврын SQL-ийг ажиллуулна уу.','STORAGE_SETUP_REQUIRED');
      throw new ApiError(502,'Зураг хадгалагдсангүй. Supabase Storage-ийн багтаамж, тохиргоог шалгаад дахин оролдоно уу.','STORAGE_UPLOAD_FAILED');
    }
    const publicUrl=`${url}/storage/v1/object/public/${POSTER_BUCKET}/${path}`;
    const visible=await fetch(publicUrl,{method:'HEAD',signal:controller.signal,redirect:'error',cache:'no-store'});
    if(!visible.ok)throw new ApiError(502,'Зураг байршуулсан боловч нийтэд харагдахгүй байна. Зургийн сангийн Public тохиргоог шалгана уу.','STORAGE_NOT_PUBLIC');
    return {url:publicUrl,path,bytes:output.length,width:600,height:900};
  }catch(error){
    if(error instanceof ApiError)throw error;
    throw new ApiError(502,'Зураг байршуулах холболт тасарлаа. Дахин оролдоно уу.','STORAGE_UPLOAD_FAILED');
  }finally{clearTimeout(timer);}
}

export async function migrateInlinePoster(value:string){
  const match=/^data:image\/(?:png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if(!match)throw new ApiError(400,'Хуучин зургийн формат буруу байна.');
  return storePoster(Buffer.from(match[1],'base64'));
}
