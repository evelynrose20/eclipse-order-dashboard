import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const api=readFileSync(new URL('../src/construction.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('../../src/ConstructionProjects.jsx',import.meta.url),'utf8');
const migration=readFileSync(new URL('../sql/085_construction_industry_materials.sql',import.meta.url),'utf8');

test('new construction plans select industry items rather than workshop materials',()=>{
 assert.match(api,/SELECT id FROM world_industry_items WHERE id IN/);
 assert.match(api,/INSERT INTO order_construction_requirements\(stage_id,industry_item_id,required_quantity\)/);
 assert.match(ui,/request\('\/construction\/materials'\)/);
 assert.match(ui,/setMaterials\(industry\.materials/);
 assert.doesNotMatch(ui,/Turn crafting into a living storyline/);
});
test('industrial construction deliveries debit a locked facility stock row and log transaction',()=>{
 assert.match(api,/world_industry_stock WHERE facility_id=\? AND item_id=\? FOR UPDATE/);
 assert.match(api,/world_industry_ledger/);
 assert.match(api,/facility_supply_requires_staff/);
 assert.match(api,/if\(!r\.industry_item_id&&b\.source==='facility'\)/);
});
test('migration retains old contribution records and is re-runnable',()=>{
 assert.match(migration,/industry_item_id/);
 assert.match(migration,/information_schema\.COLUMNS/);
 assert.match(migration,/campaign_commit/);
 assert.doesNotMatch(migration,/DROP TABLE|DELETE FROM order_construction/i);
});

test('construction selection is initialized before supply calculations',()=>{
 const stage=ui.indexOf('const selectedStage=');
 const requirement=ui.indexOf('const selectedReq=');
 const available=ui.indexOf('const available=');
 const facilities=ui.indexOf('const sourceFacilities=');
 assert.ok(stage>=0&&requirement>stage&&available>requirement&&facilities>requirement,
  'stage and requirement must initialize before inventory-dependent calculations');
});
