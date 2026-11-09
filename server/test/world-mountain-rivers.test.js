import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Readable} from 'node:stream';
import {MOUNTAIN_EXCLUSION_RADIUS,distanceToRidge,mountainAt,rangesCoverSettlements,validTerrainPoints,mountainPlacementConflict} from '../src/world-terrain-placement.js';
import {worldAdministrationRoute} from '../src/world-administration.js';

const ridge=[{x:20,y:30},{x:60,y:30},{x:72,y:50}];
test('mountain terrain excludes positions along ridge edges, not just at vertices',()=>{
 assert.equal(distanceToRidge({x:39,y:31},ridge),1);
 assert.equal(mountainAt({x:39,y:31},[{name:'Northern Highlands',points:ridge}])?.name,'Northern Highlands');
 assert.equal(mountainAt({x:39,y:30+MOUNTAIN_EXCLUSION_RADIUS+2},[{points:ridge}]),null);
 assert.equal(rangesCoverSettlements(ridge,[{map_x:40,map_y:30}]),true);
 assert.equal(rangesCoverSettlements(ridge,[{map_x:40,map_y:60}]),false);
});
test('geographic features allow 32 vertices but reject malformed map coordinates',()=>{
 const thirtyTwo=Array.from({length:32},(_,i)=>({x:i*2,y:20}));
 assert.equal(validTerrainPoints(thirtyTwo),true);
 assert.equal(validTerrainPoints([...thirtyTwo,{x:70,y:20}]),false);
 assert.equal(validTerrainPoints([{x:50,y:10}]),false);
 assert.equal(validTerrainPoints([{x:50,y:10},{x:-1,y:20}]),false);
});
test('mountain placement reads only named ranges in the specified region and zone',async()=>{
 const db={execute:async(sql,params)=>{
  assert.match(sql,/world_map_mountain_ranges/);
  assert.deepEqual(params,[3,9]);
  return [[{id:5,name:'Rocky Ridge',points:JSON.stringify(ridge)}]];
 }};
 assert.equal((await mountainPlacementConflict(db,3,9,{x:39,y:31}))?.id,5);
 assert.equal(await mountainPlacementConflict(db,3,9,{x:90,y:90}),null);
});
test('map has separate rivers and excludes air and waterway from road/rail interface',()=>{
 const ui=readFileSync(new URL('../../src/WorldTerritoryMap.jsx',import.meta.url),'utf8');
 assert.match(ui,/visibleTransport=route/);
 assert.match(ui,/networkSegments\.filter\(visibleTransport\)/);
 assert.match(ui,/world-admin\/rivers/);
 assert.match(ui,/NO SETTLEMENTS ON MOUNTAINS/);
 assert.match(ui,/wtm-rivers/);
 assert.doesNotMatch(ui,/\['skyway','Air route'\]/);
 assert.doesNotMatch(ui,/\['waterway','Water route'\]/);
});
test('river migration is non-destructive and geographic, without transport endpoints',()=>{
 const sql=readFileSync(new URL('../sql/079_map_rivers.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS world_map_rivers/);
 assert.match(sql,/points JSON/);
 assert.doesNotMatch(sql,/from_node_id|to_node_id|from_settlement_id|to_settlement_id|DROP TABLE/i);
});
