import test from 'node:test';
import assert from 'node:assert/strict';
import {settlementDemographics,cappedEmployment} from '../src/world-demographics.js';
import {simulatedPopulationGroups,previewPopulationChange} from '../src/world-population-simulation.js';

test('demographic buckets reconcile exactly to resident population',()=>{
 for(const population of [0,1,2,5,10,100,1001,100000]){
  const d=settlementDemographics({population,workforce:population});
  assert.equal(d.children+d.youth+d.adults+d.elderly,population);
  assert.equal(d.employed+d.unemployed,d.eligible_workers);
  assert.equal(d.eligible_workers+d.dependents,population);
  assert.ok(d.employed<=d.eligible_workers);
 }
});
test('children, youth, elderly and unable adults do not become industrial labor',()=>{
 const d=settlementDemographics({population:1000,workforce:1000});
 assert.equal(d.children,180);
 assert.equal(d.youth,50);
 assert.equal(d.elderly,130);
 assert.equal(d.adults,640);
 assert.equal(d.unable_to_work,51);
 assert.equal(d.eligible_workers,589);
 assert.equal(d.employed,589);
 assert.equal(cappedEmployment({population:1000},999999),589);
});
test('legacy employment is capped without editing underlying residents',()=>{
 const s={population:100,workforce:100};
 const d=settlementDemographics(s);
 assert.equal(s.workforce,100);
 assert.equal(d.employed,59);
 assert.deepEqual(simulatedPopulationGroups(s).map(g=>g.residents),[59,41]);
});
