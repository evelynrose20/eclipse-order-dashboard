import test from 'node:test';
import assert from 'node:assert/strict';
import {infrastructureAlerts,supplyAlerts,supplyRisk} from '../src/logisticsInfrastructureAlerts.js';
const location=(c={},owner='eclipse-order')=>({controlling_faction_id:owner,strategic_state:'secure',population:0,simulation_enabled:false,civic_summary:{warnings:[],heating_coverage:0,water_stock:0,waterworks_generated:0,...c}});
test('Order holdings with no simulated NPCs still report failed heating and water',()=>{
 const s=location();
 assert.deepEqual(infrastructureAlerts(s),['Heating infrastructure below 75%','No clean water in storage or production']);
 assert.equal(supplyRisk(s),'alert');
 assert.equal(s.population,0);
 assert.equal(s.simulation_enabled,false);
});
test('healthy facilities clear infrastructure alerts independently of simulated population',()=>{
 const s=location({heating_coverage:90,water_stock:20,waterworks_generated:0});
 assert.deepEqual(supplyAlerts(s),[]);
 assert.equal(supplyRisk(s),'stable');
 assert.deepEqual(infrastructureAlerts(location({heating_coverage:100,water_stock:0,waterworks_generated:12})),[]);
});
test('NPC holdings and unclaimed sites are not included in Order infrastructure warnings',()=>{
 for(const owner of ['iron-remnant',null])assert.deepEqual(infrastructureAlerts(location({},owner)),[]);
});
test('missing civic readings must not be misrepresented as shortages',()=>{
 assert.deepEqual(infrastructureAlerts({controlling_faction_id:'eclipse-order'}),[]);
 assert.deepEqual(infrastructureAlerts(location({heating_coverage:null,water_stock:null,waterworks_generated:null})),[]);
});
test('real civic warning codes remain visible alongside independent infrastructure problems',()=>{
 assert.ok(supplyAlerts(location({warnings:['food_reserve_low']})).includes('food reserve low'));
});
