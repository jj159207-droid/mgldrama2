import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=(name:string)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('public TAZA copy shows only 2 movies 5000 or all 45 movies 9000 at 200 each',()=>{
 const home=src('app/page.tsx'),tuning=src('app/components/CatalogCardTuning.tsx'),hero=src('app/components/CinematicHeroMount.tsx');
 assert.ok(home.includes('2 кино 5,000₮ · 45 кино бүгд 9,000₮ (1 кино 200₮)'));
 assert.ok(tuning.includes('45 кино бүгд · 9,000₮'));
 assert.ok(hero.includes('TAZA SITE — 2 кино 5,000₮, 45 кино 9,000₮, нэг кино 200₮'));
 assert.ok(tuning.includes('6 оронтой кодоор төлбөр төлнө'));
});
