import { db } from './server';
import { paymentExpiry, tazaPackQuota, type Row } from './domain';

// TAZA has two quota passes. Each different film occupies one slot; once claimed,
// the same title can be replayed freely until its purchase expires.
// The claim is written by the database RPC in one transaction, never here.
export async function tazaBundleAccess(
  userId: number, payments: Row[], now = Date.now()
): Promise<{ access:Record<string,number>; remaining:number }> {
  const active = payments.filter(p => tazaPackQuota(String(p.plan||''))>0 && paymentExpiry(p)>now);
  if(!active.length)return {access:{},remaining:0};
  const ids = active.map(p => Number(p.id)).filter(id => Number.isSafeInteger(id) && id>0);
  if(!ids.length)return {access:{},remaining:0};
  const activeById=new Map(active.map(p=>[Number(p.id),p]));
  const used=new Map<number,Set<number>>();
  let lastId=0;
  for (;;) {
    const claims=await db(
      `taza_pack_claims?site_id=eq.taza&user_id=eq.${userId}&payment_id=in.(${ids.join(',')})&id=gt.${lastId}&select=id,payment_id,film_id&order=id.asc&limit=200`
    );
    for(const claim of claims) {
      const paymentId=Number(claim.payment_id),filmId=Number(claim.film_id);
      if(!activeById.has(paymentId)||!Number.isSafeInteger(filmId)||filmId<1)continue;
      const set=used.get(paymentId)||new Set<number>();set.add(filmId);used.set(paymentId,set);
    }
    if(!claims.length)break;
    const next=Number(claims[claims.length-1].id);
    if(!Number.isSafeInteger(next)||next<=lastId)throw new Error('Invalid credit claim cursor');
    lastId=next;
  }
  const access:Record<string,number>={};
  let remaining=0;
  for(const payment of active) {
    const quota=tazaPackQuota(String(payment.plan||''));
    const claimSet=used.get(Number(payment.id))||new Set<number>();
    remaining+=Math.max(0,quota-claimSet.size);
    const expiry=paymentExpiry(payment);
    for(const filmId of claimSet) {
      const key=`film_${filmId}`;
      access[key]=Math.max(access[key]||0,expiry);
    }
  }
  return {access,remaining};
}

export async function claimTazaFilm(userId:number,filmId:number):Promise<boolean> {
  const [result]=await db('rpc/kino_taza_claim_film','POST',{p_user:userId,p_film:filmId});
  return result?.result==='claimed'||result?.result==='already_claimed';
}
