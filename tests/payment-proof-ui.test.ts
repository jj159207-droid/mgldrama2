import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
test('screenshot fallback appears for all three new packs',()=>{
 const page=file('../app/page.tsx');
 assert.ok(page.includes('[TAZA_2_PLAN,TAZA_5_10000_PLAN,TAZA_40_PLAN].includes(String(film.plan)) && tazaTransfer && <PaymentProofUploader'));
 assert.ok(page.includes('ready={orderReady&&transferReady}'));
});
test('receipt screenshot cannot confirm bank transfer',()=>{
 const route=file('../app/api/payment-proof/route.ts'),uploader=file('../app/components/PaymentProofUploader.tsx');
 for(const t of ["order.plan === 'single' && Number(order.amount) === 2000","order.plan === 'pick_2_30d_5000' && Number(order.amount) === 5000","order.plan === 'pick_5_30d_10000' && Number(order.amount) === 10000","order.plan === 'pick_40_30d_12000' && Number(order.amount) === 12000"])assert.ok(route.includes(t),t);
 assert.ok(route.includes('user_id=eq.'));assert.ok(route.includes('kino_chat_send_site'));
 assert.doesNotMatch(route,/status:\s*['"]confirmed['"]/);
 assert.ok(uploader.includes('/api/payment-proof'));
 assert.ok(uploader.includes('Баримтаа илгээх'));
});