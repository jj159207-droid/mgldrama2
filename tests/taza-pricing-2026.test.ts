import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TAZA_2_PLAN,TAZA_10_10000_PLAN,TAZA_45_ALL_13000_PLAN,TAZA_PUBLIC_PACKS,TAZA_5_10000_PLAN,TAZA_40_PLAN,plans,planLabel,tazaPackQuota,paymentExpiry,accessFromPayments,canWatch} from '../lib/domain';
const now=Date.parse('2026-11-06T12:00:00.000Z');
const paid=(plan:string)=>({plan,status:'confirmed',confirmed_at:new Date(now).toISOString()});
const read=(name:string)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('TAZA sells three six-digit 30-day checkout plans',()=>{
 assert.deepEqual(TAZA_PUBLIC_PACKS,[TAZA_2_PLAN,TAZA_10_10000_PLAN,TAZA_45_ALL_13000_PLAN]);
 assert.deepEqual(TAZA_PUBLIC_PACKS.map(plan=>plans[plan]),[5000,10000,13000]);
 assert.deepEqual([tazaPackQuota(TAZA_2_PLAN),tazaPackQuota(TAZA_10_10000_PLAN)],[2,10]);
 assert.match(planLabel(TAZA_45_ALL_13000_PLAN),/45 кино бүгд/);
 const picker=read('app/components/TazaPlanPicker.tsx');
 for(const text of ['TAZA_2_PLAN','TAZA_10_10000_PLAN','TAZA_45_ALL_13000_PLAN','6 ОРОНТОЙ КОД'])assert.ok(picker.includes(text),text);
 assert.doesNotMatch(picker,/Facebook пэйж рүү|утасны дугаараа бичиж/);
});
test('all 45 film purchase grants 30-day movie access',()=>{
 assert.equal(paymentExpiry(paid(TAZA_45_ALL_13000_PLAN))-now,30*86400000);
 assert.equal(accessFromPayments([paid(TAZA_45_ALL_13000_PLAN)],now).monthly,now+30*86400000);
 assert.equal(canWatch({id:999,locked:true,free:false},[paid(TAZA_45_ALL_13000_PLAN)],now),true);
});
test('previous confirmed 5/40 purchases retain original prices and quotas',()=>{
 assert.deepEqual([plans[TAZA_5_10000_PLAN],plans[TAZA_40_PLAN]],[10000,12000]);
 assert.deepEqual([tazaPackQuota(TAZA_5_10000_PLAN),tazaPackQuota(TAZA_40_PLAN)],[5,40]);
 assert.equal(paymentExpiry(paid(TAZA_40_PLAN))-now,30*86400000);
});
test('new orders are limited to current packs and six digit references',()=>{
 const api=read('app/api/db/route.ts'),page=read('app/page.tsx');
 assert.ok(api.includes('PACKAGE_RETIRED'));
 assert.ok(api.includes('TAZA_10_10000_PLAN')&&api.includes('TAZA_45_ALL_13000_PLAN'));
 assert.ok(api.includes(String.raw`/^\d{6}$/`));
 assert.ok(page.includes('genRef()')&&page.includes('pending_payments'));
 assert.doesNotMatch(page,/setPhoneUnlockOpen\(true\)/);
});