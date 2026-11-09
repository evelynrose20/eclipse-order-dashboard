import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const industry=readFileSync(new URL('../../src/IndustrySitesPanel.jsx',import.meta.url),'utf8');
const panel=readFileSync(new URL('../../src/MilitaryInstallationsPanel.jsx',import.meta.url),'utf8');
const route=readFileSync(new URL('../src/world-military-installations.js',import.meta.url),'utf8');
const setup=readFileSync(new URL('../src/setup-local.js',import.meta.url),'utf8');
const migration=readFileSync(new URL('../sql/086_military_installations.sql',import.meta.url),'utf8');
const previous=readFileSync(new URL('../sql/085_construction_industry_materials.sql',import.meta.url),'utf8');

test('military installations replace campaign construction tab without deleting old records',()=>{
 assert.match(industry,/MilitaryInstallationsPanel/);
 assert.match(industry,/\['military','Military installations'/);
 assert.doesNotMatch(industry,/tab==='campaigns'|<ConstructionProjects/);
 assert.doesNotMatch(migration,/DROP TABLE|DELETE FROM order_construction/i);
});
test('military installation has location-linked garrison, ammo, condition, and magitek',()=>{
 for(const table of ['world_military_installations','world_military_garrisons','world_military_ammunition','world_military_activity'])assert.match(migration,new RegExp(table));
 assert.match(route,/stationed_settlement_id/);
 assert.match(route,/SELECT quantity FROM world_industry_stock WHERE facility_id=\? AND item_id=\? FOR UPDATE/);
 assert.match(route,/insufficient_ammunition/);
 assert.match(route,/command_required/);
 assert.match(panel,/Structural integrity/);
 assert.match(panel,/Garrison/);
 assert.match(panel,/Magitek stationed at/);
});
test('migration is in setup and preserves military ledger enum on repeat setup',()=>{
 assert.match(setup,/086_military_installations\.sql/);
 assert.match(previous,/military_supply/);
 assert.match(migration,/military_supply/);
});
