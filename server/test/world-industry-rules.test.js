import test from 'node:test';
import assert from 'node:assert/strict';
import {validateIndustryConfiguration,validateIndustryRules,industryDependenciesHaveCycle,evaluateIndustryRules,industryProductionPreview} from '../src/world-industry-rules.js';
const mine={inputs:[],outputs:[{item_id:'iron-ore',qty:3}],byproducts:[{item_id:'mine-tailings',qty:.5}],labor:2,heat:0,power:1,capacity:8,upgrade_level:1};
const refinery={inputs:[{item_id:'ceruleum-crude',qty:3}],outputs:[{item_id:'ceruleum-fuel',qty:2}],byproducts:[{item_id:'refinery-residue',qty:1}],labor:3,heat:2,power:1,capacity:4,upgrade_level:1};
test('industry templates validate required materials and performance limits',()=>{
 assert.equal(validateIndustryConfiguration(mine),null);
 assert.equal(validateIndustryConfiguration({...mine,outputs:[]}), 'invalid_recipe_items');
 assert.equal(validateIndustryConfiguration({...mine,capacity:1001}),'invalid_capacity_or_requirements');
 assert.equal(validateIndustryConfiguration({...mine,inputs:[{item_id:'iron-ore',qty:1}]}),'self_consuming_recipe');
});
test('declarative rule builder permits safe comparisons and rejects scripting',()=>{
 const safe=[{when:[{field:'security',op:'gte',value:40}],action:{type:'multiplier',value:1.5},message:'Secure route'}];
 assert.equal(validateIndustryRules(safe),null);
 assert.deepEqual(evaluateIndustryRules(safe,{security:60}),{allowed:true,multiplier:1.5,messages:['Secure route']});
 assert.equal(validateIndustryRules([{when:[{field:'__proto__',op:'eq',value:1}],action:{type:'allow'}}]),'invalid_predicate');
 assert.equal(validateIndustryRules([{when:[{field:'security',op:'gte',value:10}],action:{type:'eval',value:8}}]),'invalid_rule_shape');
});
test('dependencies reject circular extraction and refinery chains',()=>{
 assert.equal(industryDependenciesHaveCycle([mine,refinery]),false);
 const a={inputs:[{item_id:'raw-a',qty:1}],outputs:[{item_id:'refined-b',qty:1}],byproducts:[]};
 const b={inputs:[{item_id:'refined-b',qty:1}],outputs:[{item_id:'raw-a',qty:1}],byproducts:[]};
 assert.equal(industryDependenciesHaveCycle([a,b]),true);
});
test('production requires operational site, inputs, workers, heat and power, and caps output',()=>{
 const site={status:'operational',level:1,capacity_pct:100,workforce:18,heat_available:30,power_available:5};
 const preview=industryProductionPreview(site,refinery,[],{'ceruleum-crude':24});
 assert.equal(preview.operations,4);
 assert.deepEqual(preview.inputs,{'ceruleum-crude':12});
 assert.deepEqual(preview.outputs,{'ceruleum-fuel':8});
 assert.deepEqual(preview.byproducts,{'refinery-residue':4});
 assert.equal(industryProductionPreview({...site,status:'captured'},refinery,[],{'ceruleum-crude':24}).operations,0);
 assert.equal(industryProductionPreview({...site,heat_available:0},refinery,[],{'ceruleum-crude':24}).operations,0);
});
