import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=(name:string)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('TAZA public catalog advertises the new 2/10/45 packages',()=>{
 const home=src('app/page.tsx'),tuning=src('app/components/CatalogCardTuning.tsx'),hero=src('app/components/CinematicHeroMount.tsx');
 assert.ok(home.includes('2 кино 5,000₮ · 10 кино 10,000₮ · 45 кино 13,000₮'));
 assert.ok(tuning.includes('45 кино бүгд · 13,000₮'));
 assert.ok(hero.includes('TAZA SITE — 2 кино 5,000₮'));
 assert.ok(tuning.includes('6 оронтой кодоор төлбөр төлнө'));
 assert.doesNotMatch(home.split('function HomePage(')[1]?.split('function VideoPage(')[0]||'',/macrodroid|макродроид|макродриод/i);
});