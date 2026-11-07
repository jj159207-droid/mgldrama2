import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {accessFromPayments,canWatch,paymentExpiry,plans,planLabel,tazaPackQuota,TAZA_2_PLAN,TAZA_5_10000_PLAN,TAZA_40_PLAN,TAZA_5_PLAN,TAZA_10_PLAN,TAZA_ALL_PLAN,TAZA_LEGACY_ALL_PLAN,TAZA_PREVIOUS_ALL_PLAN,TAZA_SINGLE_PRICE} from '../lib/domain';
test('only three new TAZA packages: 2/5/40 movies',()=>{
 assert.equal(plans.single,2500);assert.equal(TAZA_SINGLE_PRICE,2500);
 assert.deepEqual([plans[TAZA_2_PLAN],plans[TAZA_5_10000_PLAN],plans[TAZA_40_PLAN]],[5000,10000,12000]);
 assert.deepEqual([tazaPackQuota(TAZA_2_PLAN),tazaPackQuota(TAZA_5_10000_PLAN),tazaPackQuota(TAZA_40_PLAN)],[2,5,40]);
 assert.match(planLabel(TAZA_40_PLAN),/40 кино · 30 хоног · 12,000₮/);assert.equal(12000/40,300);
});
test('quota packages last 30 days without free catalog access',()=>{
 const time=Date.parse('2026-11-06T00:00:00Z');const base={status:'confirmed',confirmed_at:new Date(time).toISOString()};
 for(const plan of [TAZA_2_PLAN,TAZA_5_10000_PLAN,TAZA_40_PLAN,TAZA_5_PLAN,TAZA_10_PLAN,'pick_3_30d_5000','pick_6_30d_9500']){
   const payment={...base,plan};
   assert.equal(paymentExpiry(payment),time+30*86400000);
   assert.deepEqual(accessFromPayments([payment],time),{});
   assert.equal(canWatch({id:42,free:false,locked:true},[payment],time),false);
 }
});
test('old unlimited and single receipts retain previous rights',()=>{
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
test('film and home show only new three offers',()=>{
 const chooser=readFileSync(new URL('../app/components/TazaPlanPicker.tsx',import.meta.url),'utf8');
 assert.equal((chooser.match(/\{id:TAZA_/g)||[]).length,3);
 for(const p of ['TAZA_2_PLAN','TAZA_5_10000_PLAN','TAZA_40_PLAN'])assert.match(chooser,new RegExp('id:'+p));
 const landing=readFileSync(new URL('../app/components/FilmLanding.tsx',import.meta.url),'utf8');
 assert.match(landing,/TazaPlanPicker/);
 const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
 assert.match(page,/tazaOffersOpen && <TazaPlanPicker/);
});