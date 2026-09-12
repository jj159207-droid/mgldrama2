import nextEnv from '@next/env';
import {mkdir,writeFile} from 'node:fs/promises';
import {db} from '../lib/server';
import {migrateInlinePoster} from '../lib/posters';
nextEnv.loadEnvConfig(process.cwd(),true);

async function main(){
  const apply=process.argv.includes('--apply');
  const backup=`poster-backups/${new Date().toISOString().replaceAll(':','-')}`;
  let last=0,found=0,saved=0,skipped=0,failed=0;
  if(apply)await mkdir(backup,{recursive:true});
  for(;;){
    const rows=await db(`films?select=id,img&id=gt.${last}&order=id.asc&limit=100`);
    if(!rows.length)break;
    for(const row of rows){
      if(typeof row.img!=='string'||!row.img.startsWith('data:image/'))continue;
      found++;
      if(!apply)continue;
      try{
        await writeFile(`${backup}/${row.id}.json`,JSON.stringify({id:row.id,img:row.img}),{flag:'wx',mode:0o600});
        const poster=await migrateInlinePoster(row.img);
        const changed=await db('rpc/kino_replace_inline_poster','POST',{target_id:row.id,old_image:row.img,new_image:poster.url});
        if(changed.length){saved++;console.log(`SAVED film ${row.id}`);}else{skipped++;console.log(`SKIPPED film ${row.id}: image was changed by another editor`);}
      }catch(error){failed++;console.error(`FAILED film ${row.id}: ${error instanceof Error?error.message:'Upload failed'}`);}
    }
    const next=Number(rows[rows.length-1].id);if(!Number.isSafeInteger(next)||next<=last)throw new Error('Invalid catalog cursor');last=next;
  }
  console.log(JSON.stringify({mode:apply?'apply':'read-only',inlineImages:found,saved,skipped,failed,...(apply?{backup}: {})},null,2));
  if(!apply)console.log('No changes made. Use npm run posters:migrate -- --apply to migrate with local backups.');
  if(failed)process.exitCode=1;
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Migration failed');process.exitCode=1;});
