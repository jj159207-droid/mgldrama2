import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TAZA_2_PLAN,TAZA_5_PLAN,TAZA_10_PLAN,TAZA_ALL_PLAN,TAZA_SINGLE_PRICE,TAZA_ALL_PRICE,plans,planLabel,tazaPackQuota,paymentExpiry,accessFromPayments} from '../lib/domain';

const now=Date.parse('2026-11-06T12:00:00.000Z');
const paid=(plan:string,film_id:number|null=null)=>({plan,film_id,status:'confirmed',confirmed_at:new Date(now).toISOString()});

test('TAZA film unit price is 2500 and the minimum sale is two films for 5000',()=>{
 assert.equal(TAZA_SINGLE_PRICE,2500);
 assert.equal(TAZA_ALL_PRICE,15000);
 assert.equal(plans.single,2500);
 assert.deepEqual([plans[TAZA_2_PLAN],plans[TAZA_5_PLAN],plans[TAZA_10_PLAN],plans[TAZA_ALL_PLAN]],[5000,6000,9000,15000]);
 assert.equal(planLabel(TAZA_2_PLAN),'2 кино · 30 хоног · 5,000₮');
 assert.equal(planLabel(TAZA_5_PLAN),'5 кино · 30 хоног · 6,000₮');
 assert.equal(planLabel(TAZA_10_PLAN),'10 кино · 30 хоног · 9,000₮');
 assert.equal(planLabel(TAZA_ALL_PLAN),'Бүх кино · 30 хоног · 15,000₮');
});
test('new pack quota and expiry work; old paid films and packages keep rights',()=>{
 assert.equal(tazaPackQuota(TAZA_2_PLAN),2);
 assert.equal(tazaPackQuota(TAZA_5_PLAN),5);
 assert.equal(tazaPackQuota(TAZA_10_PLAN),10);
 assert.equal(tazaPackQuota('pick_3_30d_5000'),3);
 assert.equal(tazaPackQuota('pick_6_30d_9500'),6);
 assert.equal(paymentExpiry(paid('single',1))-now,72*3600000);
 for(const plan of [TAZA_2_PLAN,TAZA_5_PLAN,TAZA_10_PLAN,TAZA_ALL_PLAN,'pick_3_30d_5000','pick_6_30d_9500','all_30d_12500']){
   assert.equal(paymentExpiry(paid(plan))-now,30*86400000,plan);
 }
 assert.equal(accessFromPayments([paid('single',17)],now).film_17,now+72*3600000);
 assert.equal(accessFromPayments([paid('all_30d_12500')],now).monthly,now+30*86400000);
 assert.equal(accessFromPayments([paid(TAZA_ALL_PLAN)],now).monthly,now+30*86400000);
});
test('checkout and bank subscription picker start from 2 films at 5,000₮',()=>{
 const chooser=readFileSync(new URL('../app/components/TazaPlanPicker.tsx',import.meta.url),'utf8');
 const api=readFileSync(new URL('../app/api/db/route.ts',import.meta.url),'utf8');
 const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
 for(const v of ['2,500₮','5,000₮','6,000₮','9,000₮','15,000₮'])assert.ok(chooser.includes(v),v);
 assert.ok(chooser.includes('TAZA_2_PLAN'));
 assert.ok(!chooser.includes("id:'single'"));
 assert.ok(api.includes("![TAZA_2_PLAN,TAZA_5_PLAN,TAZA_10_PLAN,TAZA_ALL_PLAN].includes(plan)"));
 assert.ok(page.includes("film_id:film.plan===\"single\" || film.plan===TAZA_2_PLAN ? Number(film.returnFilm?.id || film.id)"));
 assert.ok(!page.includes("3 кино 5,000₮"));
 assert.ok(!page.includes("6 кино 9,500₮"));
});

test('TAZA homepage package CTA displays 2,500₮ per film and 5,000₮ minimum',()=>{
 const hero=readFileSync(new URL('../app/components/CinematicHeroMount.tsx',import.meta.url),'utf8');
 assert.ok(hero.includes('1 кино <strong>2,500₮</strong> · 2 киноны багц <strong>5,000₮</strong>'));
 assert.ok(hero.includes('TAZA SITE — 1 кино 2,500₮, хамгийн багадаа 2 кино 5,000₮'));
 assert.ok(hero.includes('Сайтын бүх <strong>{packageFilmCount}</strong> кино <strong>12,000₮</strong>'));
});
