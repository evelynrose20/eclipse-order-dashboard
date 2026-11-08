import test from 'node:test';
import assert from 'node:assert/strict';
import {simulatedPopulationGroups,previewPopulationChange} from '../src/world-population-simulation.js';

test('population groups are generated, never separately counted',()=>{
 const groups=simulatedPopulationGroups({population:53,workforce:20});
 assert.equal(groups.reduce((total,c)=>total+c.residents,0),53);
 assert.equal(groups.find(c=>c.key==='employed').residents,20);
 assert.equal(groups.find(c=>c.key==='other').residents,33);
});
test('vacant land without houses cannot generate residents',()=>{
 const projection=previewPopulationChange({population:0,workforce:0,housing_capacity:0},[],0,true);
 assert.equal(projection.arrivals,0);
 assert.equal(projection.population_after,0);
});
test('operational housing permits measured growth but paused simulation cannot',()=>{
 const house={category:'housing',status:'operational',housing_bonus:20,condition_pct:100,service_bonus:0,defense_bonus:0};
 const site={population:0,workforce:0,housing_capacity:0};
 assert.equal(previewPopulationChange(site,[house],0,true).population_after,1);
 assert.equal(previewPopulationChange(site,[house],0,false).population_after,0);
 assert.equal(previewPopulationChange(site,[{...house,status:'building'}],0,true).population_after,0);
});
test('population growth respects housing vacancy and civic stress',()=>{
 const site={population:50,workforce:20,housing_capacity:51};
 assert.equal(previewPopulationChange(site,[],0,true).population_after,51);
 assert.equal(previewPopulationChange(site,[],90,true).population_after,50);
 assert.equal(previewPopulationChange({...site,housing_capacity:50},[],0,true).population_after,50);
});
