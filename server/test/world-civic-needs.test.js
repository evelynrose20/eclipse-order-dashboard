import test from 'node:test';
import assert from 'node:assert/strict';
import {civicSimulationPreview} from '../src/world-civic-needs.js';
const settlement={population:100,weather_exposure:70,insulation:25,housing:70,medical_access:60,food_access:80,civil_stability:70,unrest:10};
const profile={food_daily_per_resident:1,heat_daily_per_resident:1,food_min_days:14,minimum_variety:3,grace_cycles:2,enabled_mode:'off',paused:0};
const food={resource_kind:'food',quantity:200,food_group:'grain',item_code:'grain'};
const fuel={resource_kind:'fuel',quantity:50,item_code:'coal'};
test('off mode can warn but never simulates a mutation',()=>{
 const p=civicSimulationPreview(settlement,profile,[food,fuel],[],0,9);
 assert.equal(p.simulation_eligible,false);
 assert.equal(p.food_used,0);
 assert.equal(p.fuel_used,0);
 assert.equal(p.after_stability,settlement.civil_stability);
 assert.ok(p.warnings.includes('food_reserve_low'));
});
test('seasonal cold increases fuel demand without consuming player inventory',()=>{
 const warm=civicSimulationPreview(settlement,profile,[food,fuel],[],70);
 const cold=civicSimulationPreview(settlement,profile,[food,fuel],[],0);
 assert.ok(cold.heat_need>warm.heat_need);
 assert.equal(warm.heat_need,0);
});
test('grace period suppresses unrest changes in managed mode',()=>{
 const managed={...profile,enabled_mode:'managed'};
 const p=civicSimulationPreview(settlement,managed,[food,fuel],[],0,0);
 assert.equal(p.grace_active,true);
 assert.equal(p.after_unrest,settlement.unrest);
 assert.equal(p.simulation_eligible,true);
});
test('diverse deliveries over a rolling history remove monotony alert',()=>{
 const history=['grain','vegetable','protein'].map(food_group=>({resource_kind:'food',food_group,quantity_delta:10}));
 const p=civicSimulationPreview(settlement,profile,[food,fuel],history,70);
 assert.ok(!p.warnings.includes('limited_diet_variety'));
});
test('civic score changes remain bounded',()=>{
 const managed={...profile,enabled_mode:'managed',grace_cycles:0};
 const extreme={...settlement,civil_stability:0,unrest:100};
 const p=civicSimulationPreview(extreme,managed,[],[],0,2);
 assert.ok(p.after_stability>=0&&p.after_stability<=100);
 assert.ok(p.after_unrest>=0&&p.after_unrest<=100);
});
