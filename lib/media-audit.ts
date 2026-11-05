import {safeUrl, type Row} from './domain';

export type FilmIssue = {id:number; title:string};
export type IssueGroup = {count:number; sample:FilmIssue[]};
export type CatalogReadiness = {
  total:number;
  playableSourceCount:number;
  bunnySourceCount:number;
  missingFull:IssueGroup;
  missingTrailer:IssueGroup;
  missingPoster:IssueGroup;
  missingDescription:IssueGroup;
  truncated:boolean;
};

// An inventory audit, not a remote video availability probe. Never return the
// private full-movie URLs to the browser (even in diagnostics).
export function auditCatalogMedia(films:Row[],truncated=false):CatalogReadiness {
  const missingFull:IssueGroup={count:0,sample:[]};
  const missingTrailer:IssueGroup={count:0,sample:[]};
  const missingPoster:IssueGroup={count:0,sample:[]};
  const missingDescription:IssueGroup={count:0,sample:[]};
  let playableSourceCount=0,bunnySourceCount=0;
  const add=(group:IssueGroup,issue:FilmIssue)=>{
    group.count++;
    if(group.sample.length<20)group.sample.push(issue);
  };
  for(const row of films){
    const id=Number(row.id);
    const title=typeof row.title==='string'?row.title:'';
    const issue={id:Number.isSafeInteger(id)?id:0,title:title.slice(0,100)};
    const [rawFull='',inlineTrailer='']=String(row.url||'').split('|||');
    const full=safeUrl(rawFull);
    const preview=safeUrl(typeof row.preview_url==='string'&&row.preview_url.trim()?row.preview_url:inlineTrailer);
    const poster=safeUrl(row.img,true);
    if(!full)add(missingFull,issue);
    else {
      playableSourceCount++;
      try {
        const hostname=new URL(full).hostname.toLowerCase();
        if(hostname==='player.mediadelivery.net'||hostname.endsWith('.b-cdn.net')||hostname.endsWith('.bunnycdn.com'))bunnySourceCount++;
      }catch{}
    }
    if(!preview)add(missingTrailer,issue);
    if(!poster)add(missingPoster,issue);
    if(typeof row.description!=='string'||!row.description.trim())add(missingDescription,issue);
  }
  return {total:films.length,playableSourceCount,bunnySourceCount,missingFull,missingTrailer,missingPoster,missingDescription,truncated};
}
