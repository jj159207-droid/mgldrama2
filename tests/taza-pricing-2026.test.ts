import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TAZA_2_PLAN,TAZA_5_10000_PLAN,TAZA_40_PLAN,TAZA_5_PLAN,TAZA_10_PLAN,TAZA_ALL_PLAN,TAZA_SINGLE_PRICE,TAZA_MANUAL_ALL_PRICE,TAZA_MANUAL_ALL_PLAN,plans,planLabel,tazaPackQuota,paymentExpiry,accessFromPayments} from '../lib/domain';
const now=Date.parse('2026-11-06T12:00:00.000Z');
const paid=(plan:string,film_id:number|null=null)=>({plan,film_id,status:'confirmed',confirmed_at:new Date(now).toISOString()});
const source=(name:string)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('TAZA new public prices are 1 movie 2,000₮ or all movies 12,000₮',()=>{
 assert.equal(TAZA_SINGLE_PRICE,2000);
 assert.equal(TAZA_MANUAL_ALL_PRICE,12000);
 assert.equal(TAZA_MANUAL_ALL_PLAN,'all_30d_12000');
 assert.equal(plans.single,2000);
 assert.equal(plans[TAZA_MANUAL_ALL_PLAN],12000);
 const picker=source('app/components/TazaPlanPicker.tsx');
 assert.equal((picker.match(/id:(?:'single'|TAZA_MANUAL_ALL_PLAN)/g)||[]).length,2);
 for(const text of ['TAZA_SINGLE_PRICE','TAZA_MANUAL_ALL_PRICE','Facebook пэйж рүү'])assert.ok(picker.includes(text),text);
 for(const old of ['TAZA_2_PLAN','TAZA_5_10000_PLAN','TAZA_40_PLAN','2 кино 5,000','5 кино 10,000','40 кино'])assert.ok(!picker.includes(old),old);
 const landing=source('app/components/FilmLanding.tsx');
 assert.match(landing,/1 кино · 2,000₮ \/ Бүх кино · 12,000₮/);
});

test('old confirmed 2/5/40 purchases retain their historical quota and expiry',()=>{
 assert.deepEqual([plans[TAZA_2_PLAN],plans[TAZA_5_10000_PLAN],plans[TAZA_40_PLAN]],[5000,10000,12000]);
 assert.deepEqual([tazaPackQuota(TAZA_2_PLAN),tazaPackQuota(TAZA_5_10000_PLAN),tazaPackQuota(TAZA_40_PLAN)],[2,5,40]);
 for(const plan of [TAZA_2_PLAN,TAZA_5_10000_PLAN,TAZA_40_PLAN,TAZA_5_PLAN,TAZA_10_PLAN,'pick_3_30d_5000','pick_6_30d_9500']){
   assert.equal(paymentExpiry(paid(plan))-now,30*86400000);
   assert.deepEqual(accessFromPayments([paid(plan)],now),{});
 }
 assert.equal(paymentExpiry(paid('single',1))-now,72*3600000);
 assert.equal(accessFromPayments([paid('single',17)],now).film_17,now+72*3600000);
 assert.equal(accessFromPayments([paid(TAZA_ALL_PLAN)],now).monthly,now+30*86400000);
 assert.match(planLabel(TAZA_40_PLAN),/40 кино/);
});

test('public TAZA no longer creates retired 2/5/40 checkouts',()=>{
 const api=source('app/api/db/route.ts');
 const page=source('app/page.tsx');
 assert.ok(api.includes("if(site==='taza')throw new ApiError(409"));
 assert.match(api,/PHONE_PAYMENT_REQUIRED/);
 assert.match(page,/if\(siteId==="taza"\)\{/);
 assert.match(page,/setPhoneUnlockPlan\(plan==='single'\?'single':'all'\)/);
 assert.match(page,/1 кино 2,000₮ · Бүх кино 12,000₮/);
 assert.ok(!page.includes('40 кино 12,000₮ (1 кино 300₮)'));
});

test('hero and badges use the new prices and other websites keep their existing copy',()=>{
 const hero=source('app/components/CinematicHeroMount.tsx');
 const tuning=source('app/components/CatalogCardTuning.tsx');
 assert.ok(hero.includes('1 кино <strong>2,000₮</strong> · Бүх кино <strong>12,000₮</strong>'));
 assert.ok(hero.includes('TAZA SITE — 1 кино 2,000₮, бүх кино 12,000₮'));
 assert.ok(hero.includes('Сайтын бүх <strong>{packageFilmCount}</strong> кино <strong>12,000₮</strong>'));
 assert.match(tuning,/1 кино 2,000₮ · Бүх кино 12,000₮/);
 assert.match(tuning,/Бүх кино · 12,000₮/);
});
