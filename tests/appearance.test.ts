import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {appearanceStyle, validAppearance} from '../lib/appearance';

test('every slider position produces readable bounded colors with continuous transitions',()=>{
 let previous='';
 for(let tone=0;tone<=100;tone++){
  const values=appearanceStyle({layout:1,tone,revision:0});
  for(const color of Object.values(values))assert.match(color,/^#[0-9a-f]{6}([0-9a-f]{2})?$/i);
  assert.notEqual(values['--accent'],previous);previous=values['--accent'];
  const luminance=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i],0);
  for(const [foreground,background] of [['--muted','--surface'],['--foreground','--background'],['--accent','--background'],['--accent','--accent-ink']] as const){
   const a=luminance(values[foreground]),b=luminance(values[background]);
   assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`contrast at ${tone}: ${foreground}/${background}`);
  }
 }
 for(let layout=1;layout<=4;layout++)assert.ok(validAppearance({layout,tone:100,revision:10}));
});

test('appearance migration preserves saves, isolates browser roles and prevents stale updates',async()=>{
 const pg=new PGlite();
 try {
  await pg.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  const migration=await readFile(new URL('../supabase/migrations/20260916032117_site_appearance.sql',import.meta.url),'utf8');
  await pg.exec(migration);
  assert.deepEqual((await pg.query('select * from site_appearance')).rows,[{id:1,layout:1,tone:25,revision:0}]);
  for(const role of ['anon','authenticated']){
   await pg.exec(`set role ${role}`);
   await assert.rejects(pg.query('select * from site_appearance'),/permission denied/);
   await assert.rejects(pg.exec('update site_appearance set tone=80'),/permission denied/);
   await pg.exec('reset role');
  }
  await pg.exec('set role service_role');
  await assert.rejects(pg.exec('delete from site_appearance'),/permission denied/);
  await assert.rejects(pg.exec('update site_appearance set id=2'),/permission denied/);
  await assert.rejects(pg.exec('update site_appearance set layout=5'),/check constraint/);
  await assert.rejects(pg.exec('update site_appearance set tone=101'),/check constraint/);
  const results=await Promise.all([pg.query('update site_appearance set layout=2,tone=50,revision=1 where id=1 and revision=0 returning *'),pg.query('update site_appearance set layout=4,tone=100,revision=1 where id=1 and revision=0 returning *')]);
  assert.equal(results.filter(r=>r.rows.length===1).length,1);
  const before=(await pg.query('select * from site_appearance')).rows;
  await pg.exec('reset role');await pg.exec(migration);
  assert.deepEqual((await pg.query('select * from site_appearance')).rows,before);
  assert.equal((await pg.query<{relrowsecurity:boolean}>("select relrowsecurity from pg_class where oid='site_appearance'::regclass")).rows[0].relrowsecurity,true);
 } finally {await pg.close();}
});
