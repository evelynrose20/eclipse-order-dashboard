import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('World map visibly labels occupied and other site states without selecting a marker',async()=>{
 const jsx=await read('src/WorldTerritoryMap.jsx'),css=await read('src/world-territory-map.css');
 for(const state of ['peaceful','contested','occupied','liberated','rebuilding']) {
  assert.ok(jsx.includes("'"+state+"'"),state);
  assert.ok(css.includes('wtm-pin[data-state="'+state+'"] .wtm-pin-icon'),state);
 }
 assert.match(jsx,/<span className="wtm-pin-state">/);
 assert.match(jsx,/\/state',\{method:'POST'/);
});
test('World map authoring supports saved, named mountain ranges without replacing road tools',async()=>{
 const jsx=await read('src/WorldTerritoryMap.jsx');
 for(const tool of ["['move','Move places']","['link','Draw roads']","['bend','Edit roads']","['mountains','Mountains']"])assert.ok(jsx.includes(tool),tool);
 assert.match(jsx,/\/world-admin\/mountains/);
 assert.match(jsx,/Save range/);
 assert.match(jsx,/Delete range/);
 assert.match(jsx,/wtm-mountains/);
});
test('Existing faction selection can include database seeded Order authority and labels say residents',async()=>{
 const sql=await read('server/sql/043_world_mountain_ranges_order_faction.sql');
 const ui=await read('src/WorldAdministration.jsx');
 assert.match(sql,/INSERT IGNORE INTO order_factions/);
 assert.match(sql,/'eclipse-order','The Eclipse Order'/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS world_map_mountain_ranges/);
 assert.match(ui,/<span>Residents<\/span>/);
 assert.match(ui,/\['population','Residents',10000000\]/);
 assert.doesNotMatch(ui,/NPC residents|NPC population|NPCs<\/small>/);
 assert.match(ui,/mountains=\{mountains\.filter/);
});
