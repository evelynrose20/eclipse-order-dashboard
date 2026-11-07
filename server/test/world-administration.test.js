import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {civicOutlook} from '../src/world-administration.js';

const baseline={food_days:28,food_variety:90,heating_coverage:85,insulation:80,food_access:90,medical_access:90,unrest:0};
test('cold weather increases heating needs while insulation mitigates them',()=>{
 const warm=civicOutlook(baseline,{temperature_c:22});
 const cold=civicOutlook(baseline,{temperature_c:-14});
 const insulated=civicOutlook({...baseline,insulation:100},{temperature_c:-14});
 assert.equal(warm.heat_demand,0);
 assert.ok(cold.heat_demand>warm.heat_demand);
 assert.ok(insulated.heat_demand<=cold.heat_demand);
});
test('food monotony affects unrest risk independently of food quantity',()=>{
 const diverse=civicOutlook({...baseline,food_days:28,food_variety:95},{temperature_c:18});
 const repetitive=civicOutlook({...baseline,food_days:28,food_variety:5},{temperature_c:18});
 assert.equal(diverse.food_pressure,0);
 assert.equal(repetitive.food_pressure,0);
 assert.ok(repetitive.diet_monotony>diverse.diet_monotony);
 assert.ok(repetitive.unrest_risk>diverse.unrest_risk);
});
test('food shortage and cold both increase unmet needs',()=>{
 const supplied=civicOutlook(baseline,{temperature_c:18});
 const distressed=civicOutlook({...baseline,food_days:0,heating_coverage:5},{temperature_c:-20});
 assert.ok(distressed.unmet_needs>supplied.unmet_needs);
 assert.ok(distressed.unrest_risk>supplied.unrest_risk);
});
test('initial migration is additive, contains no simulated civilians, and uses existing faction IDs',async()=>{
 const sql=await readFile(new URL('../sql/041_world_administration_foundation.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS world_regions/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS world_settlements/);
 assert.match(sql,/REFERENCES order_factions\(id\)/);
 assert.match(sql,/DEFAULT 0/);
 assert.doesNotMatch(sql,/INSERT INTO world_settlements|INSERT INTO world_regions|DELETE FROM|DROP TABLE/i);
});
