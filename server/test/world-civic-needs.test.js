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

test('damaged or offline heat plant increases cold stress, while warm days need no fuel',()=>{
 const managed={...profile,enabled_mode:'managed',grace_cycles:0};
 const healthy=[{status:'operational',coverage_pct:95,condition_pct:100}];
 const offline=[{status:'offline',coverage_pct:95,condition_pct:100}];
 const warm=civicSimulationPreview(settlement,managed,[food,fuel],[],85,2,healthy);
 const heated=civicSimulationPreview(settlement,managed,[food,fuel],[],0,2,healthy);
 const broken=civicSimulationPreview(settlement,managed,[food,fuel],[],0,2,offline);
 assert.equal(warm.heat_need,0);
 assert.equal(broken.heating_coverage_effective,0);
 assert.ok(broken.pressure>heated.pressure);
});
test('water and medicine shortages generate dedicated alerts',()=>{
 const p=civicSimulationPreview(settlement,profile,[food,fuel],[],38);
 assert.ok(p.warnings.includes('water_shortfall'));
 assert.ok(p.warnings.includes('medicine_shortfall'));
});

test('uninhabited settlements have no provisions demand, unrest pressure or food warnings',()=>{
 const abandoned={...settlement,population:0,unrest:50};
 const p=civicSimulationPreview(abandoned,{...profile,enabled_mode:'managed',grace_cycles:0},[],[],0,5);
 assert.equal(p.food_need,0);
 assert.equal(p.heat_need,0);
 assert.equal(p.water_need,0);
 assert.equal(p.medicine_need,0);
 assert.equal(p.food_days,null);
 assert.deepEqual(p.warnings,[]);
 assert.equal(p.pressure,0);
 assert.equal(p.risk,0);
 assert.equal(p.after_unrest,50);
 assert.equal(p.food_used,0);
 assert.equal(p.fuel_used,0);
 assert.equal(p.water_used,0);
 assert.equal(p.medicine_used,0);
});

test('completed clinic and defenses improve service and security readings',()=>{
 const managed={...profile,enabled_mode:'managed',grace_cycles:0};
 const healthy=[
  {category:'clinic',status:'operational',condition_pct:100,service_bonus:30,defense_bonus:0,housing_bonus:0},
  {category:'defense',status:'operational',condition_pct:100,service_bonus:0,defense_bonus:30,housing_bonus:0}
 ];
 const base=civicSimulationPreview({...settlement,security_score:30},managed,[],[],32,2);
 const upgraded=civicSimulationPreview({...settlement,security_score:30},managed,[],[],32,2,[],healthy);
 assert.equal(upgraded.effective_security,60);
 assert.equal(upgraded.effective_medical_access,90);
 assert.ok(upgraded.pressure<base.pressure);
});
