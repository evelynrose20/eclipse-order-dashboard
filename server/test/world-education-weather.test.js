import test from 'node:test';
import assert from 'node:assert/strict';
import {educationPreview,schoolCapacity} from '../src/world-education.js';
import {industryProductionPreview,validateIndustryRules} from '../src/world-industry-rules.js';

test('schools have no capacity until completed and maintained',()=>{
 const school={category:'school',level:2,condition_pct:80,status:'building'};
 assert.equal(schoolCapacity([school]),0);
 assert.equal(schoolCapacity([{...school,status:'operational'}]),40);
});
test('education enrollment is limited by pupils and completed school places',()=>{
 const site={population:1000,workforce:500};
 const schools=[{category:'school',level:4,condition_pct:100,status:'operational'}];
 const e=educationPreview(site,schools,{attainment:20});
 assert.equal(e.school_seats,100);
 assert.equal(e.enrolled,100);
 assert.equal(e.school_age_residents,230);
 assert.equal(e.unplaced,130);
 assert.ok(e.trained_workers<=500);
 assert.ok(e.attainment>=20);
});
test('industrial fieldwork reacts to severe weather without adding workers',()=>{
 const recipe={inputs:[],outputs:[{item_id:'ore',qty:1}],byproducts:[],labor:1,heat:0,power:0,capacity:100,upgrade_level:1};
 const facility={status:'operational',level:1,capacity_pct:100,workforce:100,heat_available:0,power_available:0};
 const clear=industryProductionPreview(facility,recipe,[],{},{weather:'clear',industry_category:'extraction'});
 const blizzard=industryProductionPreview(facility,recipe,[],{},{weather:'blizzard',industry_category:'extraction'});
 assert.equal(clear.operations,100);
 assert.equal(blizzard.operations,25);
 assert.equal(industryProductionPreview(facility,recipe,[],{},{weather:'blizzard',industry_category:'manufacturing'}).operations,100);
});
test('staff may write declarative weather and temperature rules',()=>{
 assert.equal(validateIndustryRules([{when:[{field:'weather',op:'eq',value:'blizzard'}],action:{type:'block'}}]),null);
 assert.equal(validateIndustryRules([{when:[{field:'temperature_f',op:'lte',value:0}],action:{type:'multiplier',value:.5}}]),null);
 assert.equal(validateIndustryRules([{when:[{field:'weather',op:'eq',value:'volcanic'}],action:{type:'block'}}]),'invalid_weather_predicate');
});
