import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
test('optional screenshot fallback supports three current six-digit bank packs',()=>{
 const page=file('../app/page.tsx');
 assert.ok(page.includes('TAZA_PUBLIC_PACKS.includes(String(film.plan)'));
 assert.ok(page.includes('tazaTransfer && <PaymentProofUploader'));
 assert.ok(page.includes('ready={orderReady&&transferReady}'));
});
test('screenshot is never accepted as bank settlement',()=>{
 const route=file('../app/api/payment-proof/route.ts'),uploader=file('../app/components/PaymentProofUploader.tsx');
 for(const p of ["order.plan === 'pick_2_30d_5000' && Number(order.amount) === 5000","order.plan === 'pick_10_30d_10000' && Number(order.amount) === 10000","order.plan === 'all_30d_13000' && Number(order.amount) === 13000"])assert.ok(route.includes(p),p);
 assert.ok(route.includes('user_id=eq.'));assert.ok(route.includes('kino_chat_send_site'));
 assert.doesNotMatch(route,/status:\s*['"]confirmed['"]/);
 assert.ok(uploader.includes('/api/payment-proof'));
});