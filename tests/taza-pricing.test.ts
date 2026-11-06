import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { accessFromPayments, canWatch, paymentExpiry, plans, planLabel, TAZA_ALL_PLAN, TAZA_ALL_PRICE, TAZA_SINGLE_PRICE } from '../lib/domain';

test('TAZA sells one film for 2000 or all films for 9500 with clear labels', () => {
  assert.equal(TAZA_SINGLE_PRICE, 2000);
  assert.equal(TAZA_ALL_PRICE, 9500);
  assert.equal(plans.single, 2000);
  assert.equal(plans[TAZA_ALL_PLAN], 9500);
  assert.match(planLabel(TAZA_ALL_PLAN), /9,500₮/);
});

test('one-film purchases last 72 hours and unlock only the paid film', () => {
  const time = Date.parse('2026-11-06T00:00:00.000Z');
  const payment = { status:'confirmed', plan:'single', film_id:4, confirmed_at:new Date(time).toISOString() };
  assert.equal(paymentExpiry(payment), time + 72*3600000);
  assert.equal(canWatch({id:4,free:false,locked:true},[payment],time),true);
  assert.equal(canWatch({id:5,free:false,locked:true},[payment],time),false);
  assert.equal(canWatch({id:4,free:false,locked:true},[payment],time+72*3600000),false);
});

test('the new 9500 all-film pass lasts 30 days and preserves old 12000 receipts', () => {
  const time = Date.parse('2026-11-06T00:00:00.000Z');
  const payment = { status:'confirmed', plan:TAZA_ALL_PLAN, confirmed_at:new Date(time).toISOString() };
  const expiry = time + 30*86400000;
  assert.equal(paymentExpiry(payment),expiry);
  assert.equal(accessFromPayments([payment],time).monthly,expiry);
  assert.equal(canWatch({id:4,free:false,locked:true},[payment],time),true);
  assert.equal(canWatch({id:999,free:false,locked:true},[payment],time),true);
  assert.equal(canWatch({id:4,free:false,locked:true},[payment],expiry),false);
  assert.equal(paymentExpiry({...payment,plan:'all_30d_12000'}),expiry);
});

test('full-watch action offers exactly the one-film and monthly plans', () => {
  const landing = readFileSync(new URL('../app/components/FilmLanding.tsx',import.meta.url),'utf8');
  assert.match(landing,/onClick=\{\(\) => choosePlan\("single"\)\}/);
  assert.match(landing,/onClick=\{\(\) => choosePlan\("all_30d_9500"\)\}/);
  assert.match(landing,/2,000₮/);
  assert.match(landing,/9,500₮/);
});
