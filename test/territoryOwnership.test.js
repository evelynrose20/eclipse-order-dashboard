import test from 'node:test';
import assert from 'node:assert/strict';
import {factionColor,ownershipOf,mapOwnershipLegend} from '../src/territory-ownership.js';

test('map distinguishes local government holdings, foreign control, the Order, and unclaimed places',()=>{
 const gov='veyrholm-compact';
 assert.equal(ownershipOf({controlling_faction_id:gov},gov).kind,'local');
 assert.equal(ownershipOf({controlling_faction_id:'ashen-veil'},gov).kind,'foreign');
 assert.equal(ownershipOf({controlling_faction_id:'eclipse-order'},gov).kind,'order');
 assert.equal(ownershipOf({controlling_faction_id:null},gov).kind,'unclaimed');
 assert.equal(ownershipOf({controlling_faction_id:'ashen-veil'},null).kind,'independent');
});
test('destroyed condition never erases the faction controlling a location',()=>{
 const site={name:'Old Castrum',strategic_state:'destroyed',controlling_faction_id:'ashen-veil'};
 const owner=ownershipOf(site,'veyrholm-compact');
 assert.equal(owner.owner,'ashen-veil');
 assert.equal(owner.kind,'foreign');
 assert.equal(owner.color,factionColor('ashen-veil'));
});
test('ownership legend preserves actual faction names and counts',()=>{
 const settlements=[{controlling_faction_id:'veyrholm-compact'},{controlling_faction_id:'veyrholm-compact'},{controlling_faction_id:'ashen-veil',strategic_state:'destroyed'},{controlling_faction_id:null}];
 const factions=[{id:'veyrholm-compact',name:'The Veyrholm Compact'},{id:'ashen-veil',name:'Ashen Veil'}];
 const legend=mapOwnershipLegend(settlements,'veyrholm-compact',factions);
 assert.equal(legend.find(x=>x.id==='veyrholm-compact').count,2);
 assert.equal(legend.find(x=>x.id==='veyrholm-compact').name,'The Veyrholm Compact');
 assert.equal(legend.find(x=>x.id==='ashen-veil').name,'Ashen Veil');
 assert.equal(legend.find(x=>x.id==='unclaimed').count,1);
});
