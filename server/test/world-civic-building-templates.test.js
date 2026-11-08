import test from 'node:test';
import assert from 'node:assert/strict';
import {civicInfrastructureEffects,civilianStorageCapacity,npcConstructionPreference,civicProjectCost,validateCivicTemplate,waterworksProduction} from '../src/world-civic-building-templates.js';
import {upgradeEffects,housingCapacity} from '../src/world-settlement-upgrades.js';
import {schoolCapacity} from '../src/world-education.js';
import {npcSupplyCycle} from '../src/world-settlement-simulation.js';

const installed=(category,key,per_level,level=1,status='operational',condition_pct=100)=>({
 template_id:'example-'+category,category,effect_snapshot:JSON.stringify({key,per_level}),level,status,condition_pct,
 housing_bonus:0,defense_bonus:0,service_bonus:0
});
test('granaries provide tangible food storage, not generic service points',()=>{
 const granary=installed('food_storage','food_capacity',250,2);
 const base=civilianStorageCapacity({population:1000},[]);
 const upgraded=civilianStorageCapacity({population:1000},[granary]);
 assert.equal(upgraded.food-base.food,500);
 assert.equal(upgraded.water,base.water);
 assert.equal(upgradeEffects([granary]).service_bonus,0);
 assert.equal(civicInfrastructureEffects([{...granary,status:'building'}]).food_capacity,0);
});
test('waterworks increase daily supply and water storage with actual labor',()=>{
 const works=installed('water','water_daily',35,2);
 assert.equal(waterworksProduction([works],20),40);
 assert.equal(waterworksProduction([works],100),70);
 assert.equal(civilianStorageCapacity({population:10},[works]).water,710);
 const start=npcSupplyCycle({population:100,workforce:50,food_units:300,water_units:100,fuel_units:300,medicine_units:20,temperature_f:55,upgrades:[]});
 const withWorks=npcSupplyCycle({population:100,workforce:50,food_units:300,water_units:100,fuel_units:300,medicine_units:20,temperature_f:55,upgrades:[works]});
 assert.ok(withWorks.production.water>start.production.water);
});
test('completed school templates change actual classroom places',()=>{
 assert.equal(schoolCapacity([installed('school','school_places',45,2)]),90);
 assert.equal(schoolCapacity([installed('school','school_places',45,2,'damaged')]),0);
});
test('housing projects do not grant residents until building completion',()=>{
 const home=installed('housing','housing_capacity',30,1,'building');
 assert.equal(housingCapacity({housing_capacity:0},[home]),0);
 assert.equal(housingCapacity({housing_capacity:0},[{...home,status:'operational'}]),30);
});
test('template recipe imposes bounded effort and prevents fake effect category',()=>{
 const t={name:'Granary',description:'Food store',category:'food_storage',effect_key:'food_capacity',effect_per_level:250,material_id:'iron-ingot',material_per_level:30,npc_development_cost:15,construction_labor:135,max_level:8,enabled:true};
 assert.equal(validateCivicTemplate(t),null);
 assert.equal(validateCivicTemplate({...t,effect_key:'housing_capacity'}),'invalid_civic_template');
 assert.deepEqual(civicProjectCost(t,2),{material_id:'iron-ingot',material_required:60,labor_required:270,npc_development_cost:30});
});
test('NPC decisions choose building categories based on real shortages',()=>{
 assert.equal(npcConstructionPreference({population:0,housing_capacity:0},[],{}),'housing');
 const structures=[installed('housing','housing_capacity',30)];
 assert.equal(npcConstructionPreference({population:10,housing_capacity:0,medical_access:80,water_access:70,security_score:80,insulation:80},structures,{food_units:500,water_units:200}),'food_storage');
});
