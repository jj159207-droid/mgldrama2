import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=(name:string)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('public TAZA shows standard 5k/9k packages plus featured 15k banner',()=>{
 const home=src('app/page.tsx'),tuning=src('app/components/CatalogCardTuning.tsx'),hero=src('app/components/CinematicHeroMount.tsx');
 assert.ok(home.includes('2 кино 5,000₮ · 45 кино бүгд 9,000₮ (1 кино 200₮)'));
 assert.ok(tuning.includes('45 кино бүгд · 9,000₮'));
 assert.ok(home.includes('taza-banner-stack')&&home.includes('монгол охидын нууц бичлэгүүд +21'));assert.ok(home.includes('15,000₮'));
 assert.ok(!hero.includes('cinematic-adult-cta'),'Featured +21 banner should appear only below the secret chat banner');
 assert.ok(tuning.includes('6 оронтой кодоор төлбөр төлнө'));
});
