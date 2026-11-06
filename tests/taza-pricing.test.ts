import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  accessFromPayments, canWatch, paymentExpiry, plans, planLabel, tazaPackQuota,
  TAZA_3_PLAN, TAZA_6_PLAN, TAZA_ALL_PLAN, TAZA_LEGACY_ALL_PLAN, TAZA_ALL_PRICE,
} from '../lib/domain';

test('Taza sells only 3, 6 or all-film packages, at exact prices',()=>{
  assert.equal(plans[TAZA_3_PLAN],5000);
  assert.equal(plans[TAZA_6_PLAN],9500);
  assert.equal(plans[TAZA_ALL_PLAN],12500);
  assert.equal(TAZA_ALL_PRICE,12500);
  assert.equal(tazaPackQuota(TAZA_3_PLAN),3);
  assert.equal(tazaPackQuota(TAZA_6_PLAN),6);
  assert.equal(tazaPackQuota(TAZA_ALL_PLAN),0);
  assert.match(planLabel(TAZA_3_PLAN),/5,000₮/);
  assert.match(planLabel(TAZA_6_PLAN),/9,500₮/);
  assert.match(planLabel(TAZA_ALL_PLAN),/12,500₮/);
});

test('three- and six-film bundles last 30 days without granting unlimited access',()=>{
  const time=Date.parse('2026-11-06T00:00:00Z');
  const base={status:'confirmed',confirmed_at:new Date(time).toISOString()};
  for(const plan of [TAZA_3_PLAN,TAZA_6_PLAN]){
    const payment={...base,plan};
    assert.equal(paymentExpiry(payment),time+30*86400000);
    assert.deepEqual(accessFromPayments([payment],time),{});
    assert.equal(canWatch({id:42,free:false,locked:true},[payment],time),false);
  }
});

test('12,500₮ all-film pass unlocks the catalog for 30 days',()=>{
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
  for(const plan of [TAZA_LEGACY_ALL_PLAN,'all_30d_12000']){
    const purchase={status:'confirmed',plan,confirmed_at:new Date(time).toISOString()};
    assert.equal(paymentExpiry(purchase),time+30*86400000);
    assert.equal(canWatch({id:5,free:false,locked:true},[purchase],time),true);
  }
});

test('three clear watch options are shared between movie and home sections',()=>{
  const picker=readFileSync(new URL('../app/components/TazaPlanPicker.tsx',import.meta.url),'utf8');
  assert.match(picker,/TAZA_3_PLAN/);
  assert.match(picker,/TAZA_6_PLAN/);
  assert.match(picker,/TAZA_ALL_PLAN/);
  assert.match(picker,/5,000₮/);
  assert.match(picker,/9,500₮/);
  assert.match(picker,/12,500₮/);
  const landing=readFileSync(new URL('../app/components/FilmLanding.tsx',import.meta.url),'utf8');
  assert.match(landing,/TazaPlanPicker/);
  const home=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
  assert.match(home,/tazaOffersOpen && <TazaPlanPicker/);
});
