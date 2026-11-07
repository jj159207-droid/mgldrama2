import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TAZA_2_PLAN,TAZA_5_10000_PLAN,TAZA_40_PLAN,TAZA_5_PLAN,TAZA_10_PLAN,TAZA_ALL_PLAN,TAZA_SINGLE_PRICE,TAZA_40_PRICE,plans,planLabel,tazaPackQuota,paymentExpiry,accessFromPayments} from '../lib/domain';
const now=Date.parse('2026-11-06T12:00:00.000Z');
const paid=(plan:string,film_id:number|null=null)=>({plan,film_id,status:'confirmed',confirmed_at:new Date(now).toISOString()});

test('TAZA offers only 2, 5 and 40 films with new prices',()=>{
 assert.equal(TAZA_SINGLE_PRICE,2500);
 assert.equal(TAZA_40_PRICE,12000);
 assert.deepEqual([plans[TAZA_2_PLAN],plans[TAZA_5_10000_PLAN],plans[TAZA_40_PLAN]],[5000,10000,12000]);
 assert.equal(12000/40,300);
 assert.equal(planLabel(TAZA_2_PLAN),'2 кино · 30 хоног · 5,000₮');
 assert.equal(planLabel(TAZA_5_10000_PLAN),'5 кино · 30 хоног · 10,000₮');
 assert.equal(planLabel(TAZA_40_PLAN),'40 кино · 30 хоног · 12,000₮');
 assert.deepEqual([plans[TAZA_5_PLAN],plans[TAZA_10_PLAN],plans[TAZA_ALL_PLAN]],[6000,9000,15000]);
});
test('40-film quota is exactly 40, not unlimited; older purchases keep their rights',()=>{
 assert.deepEqual([tazaPackQuota(TAZA_2_PLAN),tazaPackQuota(TAZA_5_10000_PLAN),tazaPackQuota(TAZA_40_PLAN)],[2,5,40]);
 for(const plan of [TAZA_2_PLAN,TAZA_5_10000_PLAN,TAZA_40_PLAN,TAZA_5_PLAN,TAZA_10_PLAN,'pick_3_30d_5000','pick_6_30d_9500']){
   assert.equal(paymentExpiry(paid(plan))-now,30*86400000);
   assert.deepEqual(accessFromPayments([paid(plan)],now),{});
 }
 assert.equal(paymentExpiry(paid('single',1))-now,72*3600000);
 assert.equal(accessFromPayments([paid('single',17)],now).film_17,now+72*3600000);
 assert.equal(accessFromPayments([paid(TAZA_ALL_PLAN)],now).monthly,now+30*86400000);
});
test('public site and API expose only three new purchasable products',()=>{
 const chooser=readFileSync(new URL('../app/components/TazaPlanPicker.tsx',import.meta.url),'utf8');
 const api=readFileSync(new URL('../app/api/db/route.ts',import.meta.url),'utf8');
 const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
 assert.equal((chooser.match(/\{id:TAZA_/g)||[]).length,3);
 for(const plan of ['TAZA_2_PLAN','TAZA_5_10000_PLAN','TAZA_40_PLAN'])assert.ok(chooser.includes('id:'+plan));
 for(const price of ['2,500₮','5,000₮','10,000₮','12,000₮'])assert.ok(chooser.includes(price),price);
 assert.ok(chooser.includes('1 кино ердөө 300₮'));
 for(const old of ['TAZA_5_PLAN','TAZA_10_PLAN','TAZA_ALL_PLAN','6,000₮','9,000₮','15,000₮'])assert.ok(!chooser.includes(old));
 assert.ok(api.includes('![TAZA_2_PLAN,TAZA_5_10000_PLAN,TAZA_40_PLAN].includes(plan)'));
 assert.ok(page.includes('[TAZA_2_PLAN,TAZA_5_10000_PLAN,TAZA_40_PLAN].includes(plan)'));
 assert.ok(page.includes('40 кино 12,000₮ (1 кино 300₮)'));
});
test('hero uses only new prices and leaves other site copy alone',()=>{
 const hero=readFileSync(new URL('../app/components/CinematicHeroMount.tsx',import.meta.url),'utf8');
 assert.ok(hero.includes('2 кино <strong>5,000₮</strong> · 40 кино <strong>12,000₮</strong>'));
 assert.ok(hero.includes('TAZA SITE — 2 кино 5,000₮, 5 кино 10,000₮, 40 кино 12,000₮'));
 assert.ok(hero.includes('Сайтын бүх <strong>{packageFilmCount}</strong> кино <strong>12,000₮</strong>'));
});