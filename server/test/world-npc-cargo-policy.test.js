import test from 'node:test';
import assert from 'node:assert/strict';
import {rankNpcFarmCandidates,npcCargoParameters} from '../src/world-npc-cargo.js';

const settlement={id:18,zone_id:5,workforce:6};
const candidates=[
 {source_type:'industry_site',id:3,zone_id:7,name:'Outer Farm'},
 {source_type:'settlement_marker',id:12,zone_id:5,name:'Village Farm'},
 {source_type:'industry_site',id:9,zone_id:5,name:'Near Farm'},
 {source_type:'industry_site',id:10,zone_id:5,name:'Another Near Farm'}
];
test('NPC prioritizes faction farms inside its own zone and avoids claimed sources',()=>{
 assert.equal(rankNpcFarmCandidates(settlement,candidates)[0].id,9);
 assert.equal(rankNpcFarmCandidates(settlement,candidates,[{source_type:'industry_site',source_id:9}])[0].id,10);
});
test('NPC excludes itself as an agricultural supplier and chooses deterministic ties',()=>{
 const choices=rankNpcFarmCandidates(settlement,[...candidates,{source_type:'settlement_marker',id:18,zone_id:5}]);
 assert.ok(choices.every(x=>x.id!==18||x.source_type!=='settlement_marker'));
 assert.equal(choices[0].id,9);
});
test('NPC computes logistics from actual workforce and geography, not unlimited staff input',()=>{
 assert.deepEqual(npcCargoParameters(settlement,candidates[2]),{travel_hours:12,cargo_capacity:24});
 assert.deepEqual(npcCargoParameters(settlement,candidates[0]),{travel_hours:36,cargo_capacity:24});
 assert.equal(npcCargoParameters({...settlement,workforce:10000},candidates[0]).cargo_capacity,80);
});
