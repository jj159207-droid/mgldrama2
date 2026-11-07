import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = (path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');

test('payment proof uploader works for TAZA two-film checkout and legacy single orders',()=>{
 const page=file('../app/page.tsx');
 assert.ok(page.includes('film.plan===TAZA_2_PLAN && tazaTransfer && <PaymentProofUploader'));
 assert.ok(page.includes('film.plan==="single" && tazaTransfer && <PaymentProofUploader'));
 assert.ok(page.includes('ready={orderReady&&transferReady}'));
});

test('screenshot upload requires verified 5,000₮ bundle or legacy 2,000₮ order and cannot self-confirm a payment',()=>{
 const route=file('../app/api/payment-proof/route.ts');
 const uploader=file('../app/components/PaymentProofUploader.tsx');
 assert.ok(route.includes("order.plan === 'single' && Number(order.amount) === 2000"));
 assert.ok(route.includes("order.plan === 'pick_2_30d_5000' && Number(order.amount) === 5000"));
 assert.ok(route.includes('user_id=eq.${s.userId}'));
 assert.ok(route.includes('kino_chat_send_site'));
 assert.doesNotMatch(route,/status:\s*['"]confirmed['"]/);
 assert.ok(uploader.includes('Гүйлгээ амжилттай'));
 assert.ok(uploader.includes('Баримтаа илгээх'));
 assert.ok(uploader.includes('Банкны орлогыг шалгаж'));
 assert.ok(uploader.includes('/api/payment-proof'));
});
