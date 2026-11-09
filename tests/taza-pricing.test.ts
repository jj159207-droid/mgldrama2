import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accessFromPayments,canWatch,paymentExpiry,plans,tazaPackQuota,TAZA_2_PLAN,TAZA_10_10000_PLAN,TAZA_45_ALL_13000_PLAN,TAZA_5_10000_PLAN,TAZA_40_PLAN,TAZA_ALL_PLAN,TAZA_LEGACY_ALL_PLAN,TAZA_PREVIOUS_ALL_PLAN} from '../lib/domain';
test('new 2/10/45 movie package prices and quotas',()=>{
 assert.equal(plans[TAZA_2_PLAN],5000);
 assert.equal(plans[TAZA_10_10000_PLAN],10000);
 assert.equal(plans[TAZA_45_ALL_13000_PLAN],13000);
 assert.equal(tazaPackQuota(TAZA_2_PLAN),2);
 assert.equal(tazaPackQuota(TAZA_10_10000_PLAN),10);
});
test('legacy quotas and thirty day lifetime are preserved',()=>{
 const time=Date.parse('2026-11-06T00:00:00Z'),base={status:'confirmed',confirmed_at:new Date(time).toISOString()};
 for(const plan of [TAZA_2_PLAN,TAZA_10_10000_PLAN,TAZA_5_10000_PLAN,TAZA_40_PLAN,'pick_3_30d_5000','pick_6_30d_9500'])assert.equal(paymentExpiry({...base,plan}),time+30*86400000);
 assert.equal(plans[TAZA_40_PLAN],12000);
});
test('legacy unlimited passes and new 45 movie pass can open any title',()=>{
 const time=Date.parse('2026-11-06T00:00:00Z');
 for(const plan of [TAZA_45_ALL_13000_PLAN,TAZA_ALL_PLAN,TAZA_LEGACY_ALL_PLAN,TAZA_PREVIOUS_ALL_PLAN,'all_30d_12000']){
  const p={status:'confirmed',plan,confirmed_at:new Date(time).toISOString()};
  assert.equal(canWatch({id:42,free:false,locked:true},[p],time),true);
  assert.equal(accessFromPayments([p],time).monthly,time+30*86400000);
 }
});