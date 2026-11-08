import test from 'node:test';
import assert from 'node:assert/strict';
import {allocateLabor,derivedFacilityResources,industryNeed} from '../src/world-industry-resources.js';
import {industryProductionPreview} from '../src/world-industry-rules.js';

test('workforce is allocated once across all factories in a zone and does not multiply',()=>{
 const sites=[{id:8,labor:4,capacity:2},{id:3,labor:3,capacity:2},{id:14,labor:6,capacity:3}];
 const allocations=allocateLabor(12,sites);
 assert.equal(allocations.get(3),6);
 assert.equal(allocations.get(8),6);
 assert.equal(allocations.get(14),0);
 assert.equal([...allocations.values()].reduce((n,x)=>n+x,0),12);
});
test('production uses the earned workforce and utilities, never stored staff capacity overrides',()=>{
 const c={inputs:[],outputs:[{item_id:'ci-grain',qty:2}],byproducts:[],labor:2,power:2,heat:1,capacity:3,upgrade_level:1};
 const old={status:'operational',level:1,capacity_pct:100,workforce:99999999,power_available:99999999,heat_available:99999999};
 const needs=industryNeed(c);
 assert.deepEqual(needs,{workforce:2,power:2,heat:1});
 const inactive=derivedFacilityResources(old,c,0,0,0);
 assert.equal(industryProductionPreview(inactive,c,[],{}).operations,0);
 const active=derivedFacilityResources(old,c,6,10,10);
 assert.equal(industryProductionPreview(active,c,[],{}).operations,3);
 assert.equal(active.workforce,6);
 assert.equal(active.power_available,10);
 assert.equal(active.heat_available,10);
});
