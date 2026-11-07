import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  accessFromPayments, canWatch, paymentExpiry, plans, planLabel, tazaPackQuota,
  TAZA_3_PLAN, TAZA_6_PLAN, TAZA_5_PLAN, TAZA_10_PLAN, TAZA_ALL_PLAN, TAZA_LEGACY_ALL_PLAN, TAZA_PREVIOUS_ALL_PLAN, TAZA_ALL_PRICE, TAZA_SINGLE_PRICE,
} from '../lib/domain';

test('Taza sells one, five, ten, and all-film access at the correct new prices',()=>{
  assert.equal(plans.single,2000);
  assert.equal(TAZA_SINGLE_PRICE,2000);
  assert.equal(plans[TAZA_5_PLAN],6000);
  assert.equal(plans[TAZA_10_PLAN],9000);
  assert.equal(plans[TAZA_ALL_PLAN],15000);
  assert.equal(TAZA_ALL_PRICE,15000);
  assert.equal(tazaPackQuota(TAZA_5_PLAN),5);
  assert.equal(tazaPackQuota(TAZA_10_PLAN),10);
  assert.equal(tazaPackQuota(TAZA_ALL_PLAN),0);
  assert.match(planLabel(TAZA_5_PLAN),/6,000₮/);
  assert.match(planLabel(TAZA_10_PLAN),/9,000₮/);
  assert.match(planLabel(TAZA_ALL_PLAN),/15,000₮/);
});

test('new five/ten and legacy three/six bundles last 30 days without unlimited access',()=>{
  const time=Date.parse('2026-11-06T00:00:00Z');
  const base={status:'confirmed',confirmed_at:new Date(time).toISOString()};
  for(const plan of [TAZA_5_PLAN,TAZA_10_PLAN,TAZA_3_PLAN,TAZA_6_PLAN]){
    const payment={...base,plan};
    assert.equal(paymentExpiry(payment),time+30*86400000);
    assert.deepEqual(accessFromPayments([payment],time),{});
    assert.equal(canWatch({id:42,free:false,locked:true},[payment],time),false);
  }
});

test('15,000₮ all-film pass unlocks the catalog for 30 days',()=>{
  const time=Date.parse('2026-11-06T00:00:00Z');
  const payment={status:'confirmed',plan:TAZA_ALL_PLAN,confirmed_at:new Date(time).toISOString()};
  assert.equal(paymentExpiry(payment),time+30*86400000);
  assert.equal(canWatch({id:42,free:false,locked:true},[payment],time),true);
  assert.equal(canWatch({id:99,free:false,locked:true},[payment],time),true);
  assert.equal(canWatch({id:99,free:false,locked:true},[payment],time+30*86400000),false);
});

test('older single-film and 9,500₮ / 12,000₮ all-film receipts keep their original rights',()=>{
  const time=Date.parse('2026-11-06T00:00:00Z');
  const single={status:'confirmed',plan:'single',film_id:42,confirmed_at:new Date(time).toISOString()};
  assert.equal(canWatch({id:42,free:false,locked:true},[single],time),true);
  assert.equal(canWatch({id:5,free:false,locked:true},[single],time),false);
  assert.equal(paymentExpiry(single),time+72*3600000);
  for(const plan of [TAZA_LEGACY_ALL_PLAN,TAZA_PREVIOUS_ALL_PLAN,'all_30d_12000']){
    const purchase={status:'confirmed',plan,confirmed_at:new Date(time).toISOString()};
    assert.equal(paymentExpiry(purchase),time+30*86400000);
    assert.equal(canWatch({id:5,free:false,locked:true},[purchase],time),true);
  }
});

test('four new watch options are shared between film and home sections',()=>{
  const picker=readFileSync(new URL('../app/components/TazaPlanPicker.tsx',import.meta.url),'utf8');
  assert.match(picker,/id:'single'/);
  assert.match(picker,/TAZA_5_PLAN/);
  assert.match(picker,/TAZA_10_PLAN/);
  assert.match(picker,/TAZA_ALL_PLAN/);
  for(const amount of ['2,000₮','6,000₮','9,000₮','15,000₮'])assert.ok(picker.includes(amount),amount);
  const landing=readFileSync(new URL('../app/components/FilmLanding.tsx',import.meta.url),'utf8');
  assert.match(landing,/TazaPlanPicker/);
  const home=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
  assert.match(home,/tazaOffersOpen && <TazaPlanPicker/);
});
