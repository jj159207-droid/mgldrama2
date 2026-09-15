import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterCatalog, INITIAL_CATALOG, normalizeSearch} from '../lib/catalog';

const films = [
  {id:1, title:'Өглөөний хот — 2', badge:'Хадмал|Гадаад', views:20, free:false, locked:true},
  {id:2, title:'Хотын гэрэл', badge:'Хэлтэй|Хятад', views:60, free:true, locked:true},
  {id:3, title:'Өглөөний хот 10', badge:'Хадмал|Гадаад', views:60, free:false, locked:false},
  {id:4, title:'Үдшийн түүх', badge:'Хэлтэй', views:0, free:false, locked:true},
];
test('Mongolian search combines words and filters, tolerates punctuation, preserves distinct letters', () => {
  assert.equal(normalizeSearch('  ӨГЛӨӨНИЙ—ХОТ  '),'өглөөний хот');
  assert.deepEqual(filterCatalog(films,{...INITIAL_CATALOG,query:'хот   өглөөний',category:'Гадаад'}).map(f=>f.id),[3,1]);
  assert.equal(filterCatalog(films,{...INITIAL_CATALOG,query:'Оглооний'}).length,0);
  assert.equal(filterCatalog(films,{...INITIAL_CATALOG,query:'   '}).length,4);
});
test('available filter includes free films and current access without unlocking locked films', () => {
  assert.deepEqual(filterCatalog(films,{...INITIAL_CATALOG,access:'available'}).map(f=>f.id),[3,2]);
  assert.deepEqual(filterCatalog(films,{...INITIAL_CATALOG,access:'free'}).map(f=>f.id),[2]);
  assert.deepEqual(filterCatalog(films,{...INITIAL_CATALOG,access:'available',category:'Гадаад'}).map(f=>f.id),[3]);
  assert.deepEqual(filterCatalog(films.map(f=>({...f,locked:true})),{...INITIAL_CATALOG,access:'available'}).map(f=>f.id),[2]);
});
test('sorting is deterministic, natural for sequels, and never mutates the source', () => {
  assert.deepEqual(filterCatalog(films,{...INITIAL_CATALOG,sort:'popular'}).map(f=>f.id),[3,2,1,4]);
  assert.deepEqual(filterCatalog(films,{...INITIAL_CATALOG,query:'өглөөний',sort:'title'}).map(f=>f.id),[1,3]);
  assert.deepEqual(films.map(f=>f.id),[1,2,3,4]);
  const dated = [{id:10,created_at:'invalid'}, {id:2,created_at:'2026-09-15'}, {id:3,created_at:'2026-09-01'}];
  assert.deepEqual(filterCatalog(dated,INITIAL_CATALOG).map(f=>f.id),[2,3,10]);
});
