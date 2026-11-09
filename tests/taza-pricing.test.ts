import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {accessFromPayments,canWatch,paymentExpiry,plans,tazaPackQuota,TAZA_2_PLAN,TAZA_5_10000_PLAN,TAZA_40_PLAN,TAZA_5_PLAN,TAZA_10_PLAN,TAZA_ALL_PLAN,TAZA_LEGACY_ALL_PLAN,TAZA_PREVIOUS_ALL_PLAN,TAZA_SINGLE_PRICE,TAZA_MANUAL_ALL_PRICE} from '../lib/domain';

test('new TAZA prices are 2,000₮ per movie and 12,000₮ for all movies',()=>{
 assert.equal(plans.single,2000);assert.equal(TAZA_SINGLE_PRICE,2000);
 assert.equal(TAZA_MANUAL_ALL_PRICE,12000);
});
test('older confirmed quota purchases keep 30-day rights without changing historical prices',()=>{
 const time=Date.parse('2026-11-06T00:00:00Z');const base={status:'confirmed',confirmed_at:new Date(time).toISOString()};
 for(const plan of [TAZA_2_PLAN,TAZA_5_10000_PLAN,TAZA_40_PLAN,TAZA_5_PLAN,TAZA_10_PLAN,'pick_3_30d_5000','pick_6_30d_9500']){
   const payment={...base,plan};
   assert.equal(paymentExpiry(payment),time+30*86400000);
   assert.deepEqual(accessFromPayments([payment],time),{});
   assert.equal(canWatch({id:42,free:false,locked:true},[payment],time),false);
 }
 assert.deepEqual([tazaPackQuota(TAZA_2_PLAN),tazaPackQuota(TAZA_5_10000_PLAN),tazaPackQuota(TAZA_40_PLAN)],[2,5,40]);
});
test('older unlimited and single receipts retain their exact rights',()=>{
 const time=Date.parse('2026-11-06T00:00:00Z');
 for(const plan of [TAZA_ALL_PLAN,TAZA_LEGACY_ALL_PLAN,TAZA_PREVIOUS_ALL_PLAN,'all_30d_12000']){
   const p={status:'confirmed',plan,confirmed_at:new Date(time).toISOString()};
   assert.equal(canWatch({id:42,free:false,locked:true},[p],time),true);
 }
 const p={status:'confirmed',plan:'single',film_id:42,confirmed_at:new Date(time).toISOString()};
 assert.equal(canWatch({id:42,free:false,locked:true},[p],time),true);
 assert.equal(canWatch({id:43,free:false,locked:true},[p],time),false);
 assert.equal(paymentExpiry(p),time+72*3600000);
});
test('front-end exposes only the new two choices',()=>{
 const chooser=readFileSync(new URL('../app/components/TazaPlanPicker.tsx',import.meta.url),'utf8');
 assert.ok(chooser.includes("id:'single'"));
 assert.ok(chooser.includes('id:TAZA_MANUAL_ALL_PLAN'));
 assert.ok(!chooser.includes('TAZA_2_PLAN')&&!chooser.includes('TAZA_5_10000_PLAN')&&!chooser.includes('TAZA_40_PLAN'));
 const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
 assert.ok(page.includes('PhoneUnlockModal'));
});
