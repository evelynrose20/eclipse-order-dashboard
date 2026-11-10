import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {orderCityForecast,runOrderCityResidents} from '../src/world-order-city.js';
import {installationReadiness} from '../src/world-military-readiness.js';

const housing={category:'housing',status:'operational',housing_bonus:20,condition_pct:100,service_bonus:0,defense_bonus:0};
const site={population:0,workforce:0,housing_capacity:0,controlling_faction_id:'eclipse-order',strategic_state:'secure'};
test('Order city residents start closed; housing alone does not grant unprovisioned residents',()=>{
 const empty=orderCityForecast(site,[housing],[],'off');
 assert.equal(empty.intake,'off');
 assert.equal(empty.expected_arrivals,0);
 assert.equal(empty.vacancies,20);
 const full=orderCityForecast(site,[housing],[{resource_kind:'food',quantity:20},{resource_kind:'water',quantity:20}],'off');
 assert.equal(full.expected_arrivals,1);
});
test('no residents arrive into unfinished housing or rebuilding territory',()=>{
 const stock=[{resource_kind:'food',quantity:100},{resource_kind:'water',quantity:100}];
 assert.equal(orderCityForecast(site,[{...housing,status:'building'}],stock).expected_arrivals,0);
 assert.equal(orderCityForecast({...site,strategic_state:'rebuilding'},[housing],stock).expected_arrivals,0);
});
test('Order city forecaster never creates buildings, industry, NPC policies or work assignments',()=>{
 const state=orderCityForecast({...site,population:10},[housing],[{resource_kind:'food',quantity:100},{resource_kind:'water',quantity:100}]);
 assert.equal(state.npc_construction,false);
 assert.equal(state.industry_autonomy,false);
 assert.equal(state.regional_simulation_required,false);
 assert.equal(state.demographics.employed,0);
});
test('Castrum readiness follows territory rebuilding while preserving recorded physical integrity',()=>{
 const ready=installationReadiness({state:'operational',condition_pct:100,strategic_state:'rebuilding'});
 assert.equal(ready.effective_state,'rebuilding');
 assert.equal(ready.readiness_pct,0);
 assert.equal(ready.structural_integrity_pct,100);
 assert.equal(ready.operational_ready,false);
 assert.equal(installationReadiness({state:'operational',condition_pct:100,strategic_state:'secure'}).operational_ready,true);
});
test('Order city automatic resident intake is default-off, atomic and cannot run without stored opt in',async()=>{
 assert.deepEqual(await runOrderCityResidents(null),{processed:0,arrivals:0});
 const src=readFileSync(new URL('../src/world-order-city.js',import.meta.url),'utf8');
 const sql=readFileSync(new URL('../sql/100_order_city_residents.sql',import.meta.url),'utf8');
 assert.match(src,/p\.residential_intake='automatic'/);
 assert.match(src,/s\.controlling_faction_id='eclipse-order'/);
 assert.match(src,/ON DUPLICATE KEY UPDATE residential_intake/);
 assert.match(sql,/DEFAULT 'off'/);
 assert.match(sql,/UNIQUE KEY uq_order_city_arrival_day/);
 assert.doesNotMatch(src,/beginCivicTemplateProject|autonomouslyAssignNpcFarm|advanceCivicTemplateProjects|npcProvinceDevelopment/);
});
