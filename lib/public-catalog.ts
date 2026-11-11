import {requestJson,RequestError} from './client';

// When the home catalog and the featured carousel mount together, both ask
// for the same public list. Share only the in-flight request, not a stale
// cross-login/user cache. A later revisit still revalidates through the CDN.
let inFlight:Promise<Record<string,unknown>[]>|null=null;
export function loadTazaPublicCatalog():Promise<Record<string,unknown>[]> {
  if(inFlight)return inFlight;
  const pending=requestJson('/api/public-catalog',{},true).then(rows=>{
    if(!Array.isArray(rows)||!rows.every(row=>row && typeof row==='object' && Number.isSafeInteger(Number(row.id))))
      throw new RequestError('Киноны жагсаалтын формат буруу байна.',502,'INVALID_CATALOG');
    return rows as Record<string,unknown>[];
  });
  inFlight=pending.finally(()=>{inFlight=null;});
  return inFlight;
}
