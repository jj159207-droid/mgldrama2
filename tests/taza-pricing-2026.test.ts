import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TAZA_2_PLAN,TAZA_10_10000_PLAN,TAZA_45_ALL_13000_PLAN,TAZA_45_ALL_9000_PLAN,TAZA_PUBLIC_PACKS,plans,planLabel,tazaPackQuota,paymentExpiry,accessFromPayments,canWatch} from '../lib/domain';
const now=Date.parse('2026-11-06T12:00:00Z');
const paid=(plan:string)=>({plan,status:'confirmed',confirmed_at:new Date(now).toISOString()});
const read=(name:string)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('TAZA offers exactly two movies 5k or all 45 for 9k (200 per movie)',()=>{
 assert.deepEqual(TAZA_PUBLIC_PACKS,[TAZA_2_PLAN,TAZA_45_ALL_9000_PLAN]);
 assert.deepEqual(TAZA_PUBLIC_PACKS.map(plan=>plans[plan]),[5000,9000]);
 assert.equal(tazaPackQuota(TAZA_2_PLAN),2);
 assert.equal(45*200,plans[TAZA_45_ALL_9000_PLAN]);
 assert.match(planLabel(TAZA_45_ALL_9000_PLAN),/45 кино бүгд.*9,000₮.*200₮/);
 const picker=read('app/components/TazaPlanPicker.tsx');
 assert.ok(picker.includes('2 төрлийн багц сонголт')&&picker.includes('1 кино 200₮'));
 assert.ok(picker.includes('TAZA_2_PLAN')&&picker.includes('TAZA_45_ALL_9000_PLAN'));
 assert.doesNotMatch(picker,/TAZA_10_10000_PLAN|TAZA_45_ALL_13000_PLAN|10 кино 10,000₮|13,000₮/);
});
test('new 9k pass grants all 45 movie access for 30 days',()=>{
 assert.equal(paymentExpiry(paid(TAZA_45_ALL_9000_PLAN))-now,30*86400000);
 assert.equal(accessFromPayments([paid(TAZA_45_ALL_9000_PLAN)],now).monthly,now+30*86400000);
 assert.equal(canWatch({id:99,locked:true,free:false},[paid(TAZA_45_ALL_9000_PLAN)],now),true);
});
test('historic 10-film 10k and 45-film 13k rights remain valid',()=>{
 assert.equal(plans[TAZA_10_10000_PLAN],10000);
 assert.equal(tazaPackQuota(TAZA_10_10000_PLAN),10);
 assert.equal(plans[TAZA_45_ALL_13000_PLAN],13000);
 assert.equal(accessFromPayments([paid(TAZA_45_ALL_13000_PLAN)],now).monthly,now+30*86400000);
});
test('server accepts only two packages and a six-digit bank reference',()=>{
 const api=read('app/api/db/route.ts'),page=read('app/page.tsx');
 assert.ok(api.includes('[TAZA_2_PLAN,TAZA_45_ALL_9000_PLAN].includes(plan)'));
 assert.ok(api.includes('PACKAGE_RETIRED'));
 assert.ok(api.includes('!/^\\d{6}$/.test(ref)'));
 assert.ok(page.includes('genRef()')&&page.includes('pending_payments'));
});
