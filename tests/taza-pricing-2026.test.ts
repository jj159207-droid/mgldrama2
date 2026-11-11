import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TAZA_2_PLAN,TAZA_10_10000_PLAN,TAZA_45_ALL_13000_PLAN,TAZA_45_ALL_9000_PLAN,TAZA_ALL_PLAN,TAZA_PUBLIC_PACKS,plans,planLabel,tazaPackQuota,paymentExpiry,accessFromPayments,canWatch} from '../lib/domain';
const now=Date.parse('2026-11-06T12:00:00Z');
const paid=(plan:string)=>({plan,status:'confirmed',confirmed_at:new Date(now).toISOString()});
const read=(name:string)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('TAZA offers exactly two movies 5k or all 45 for 9k (200 per movie)',()=>{
 assert.deepEqual(TAZA_PUBLIC_PACKS,[TAZA_2_PLAN,TAZA_45_ALL_9000_PLAN]);
 assert.deepEqual(TAZA_PUBLIC_PACKS.map(plan=>plans[plan]),[5000,9000]);
 assert.equal(tazaPackQuota(TAZA_2_PLAN),2);
 assert.equal(45*200,plans[TAZA_45_ALL_9000_PLAN]);
 assert.match(planLabel(TAZA_45_ALL_9000_PLAN),/45 кино бүгд.*9,000₮.*200₮/);
 const picker=read('app/components/TazaPlanPicker.tsx');
 assert.ok(picker.includes('2 төрлийн багц сонголт')&&picker.includes('1 кино 200₮'));
 assert.ok(picker.includes('TAZA_2_PLAN')&&picker.includes('TAZA_45_ALL_9000_PLAN'));
 assert.doesNotMatch(picker,/TAZA_10_10000_PLAN|TAZA_45_ALL_13000_PLAN|10 кино 10,000₮|13,000₮/);
});
test('new 9k pass grants all 45 movie access for 30 days',()=>{
 assert.equal(paymentExpiry(paid(TAZA_45_ALL_9000_PLAN))-now,30*86400000);
 assert.equal(accessFromPayments([paid(TAZA_45_ALL_9000_PLAN)],now).monthly,now+30*86400000);
 assert.equal(canWatch({id:99,locked:true,free:false},[paid(TAZA_45_ALL_9000_PLAN)],now),true);
});
test('historic 10-film 10k and 45-film 13k rights remain valid',()=>{
 assert.equal(plans[TAZA_10_10000_PLAN],10000);
 assert.equal(tazaPackQuota(TAZA_10_10000_PLAN),10);
 assert.equal(plans[TAZA_45_ALL_13000_PLAN],13000);
 assert.equal(accessFromPayments([paid(TAZA_45_ALL_13000_PLAN)],now).monthly,now+30*86400000);
});
test('server accepts two standard packages and the featured 15k checkout with six-digit reference',()=>{
 const api=read('app/api/db/route.ts'),page=read('app/page.tsx');
 assert.ok(api.includes('[TAZA_2_PLAN,TAZA_45_ALL_9000_PLAN,TAZA_ALL_PLAN].includes(plan)'));
 assert.ok(api.includes('PACKAGE_RETIRED'));
 assert.ok(api.includes('!/^\\d{6}$/.test(ref)'));
 assert.ok(page.includes('genRef()')&&page.includes('pending_payments'));
 assert.equal(plans[TAZA_ALL_PLAN],15000);
 assert.equal(paymentExpiry(paid(TAZA_ALL_PLAN))-now,30*86400000);
 assert.equal(accessFromPayments([paid(TAZA_ALL_PLAN)],now).monthly,now+30*86400000);
 const hero=read('app/components/CinematicHeroMount.tsx');
 assert.ok(hero.includes('tazaFeatured21Checkout'));
 assert.ok(page.includes('taza-banner-stack')&&page.includes('cinematic-adult-cta')&&page.includes('15,000₮'));
 assert.ok(page.includes('tazaFeatured21Checkout')&&page.includes('plan===TAZA_ALL_PLAN'));
 assert.ok(!hero.includes('cinematic-adult-cta'),'The +21 CTA is below secret chat, not duplicated inside the hero carousel');
});

test('Reopening the same TAZA checkout restores the earliest valid payment reference',()=>{
 const api=read('app/api/db/route.ts');
 const page=read('app/page.tsx');
 assert.ok(api.includes("if(site==='taza'){"));
 assert.ok(api.includes("const filmFilter=filmId===null?'is.null':`eq.${filmId}`"));
 assert.ok(api.includes("site_id=eq.taza&user_id=eq.${s.userId}&plan=eq.${encodeURIComponent(plan)}&film_id=${filmFilter}&amount=eq.${amount}&status=eq.pending&created_at=gte.${since}&order=created_at.asc,id.asc&limit=1&select=*"));
 assert.ok(api.includes('if(pending.length)return json(pending);'));
 assert.ok(api.includes('new Date(Date.now()-24*3600000).toISOString()'));
 assert.ok(page.includes('if(savedRef && savedRef!==refCode){if(!cancelled)setRefCode(savedRef);return;}'));
});
