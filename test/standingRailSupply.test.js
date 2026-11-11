import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mappedRailTrack,railService,nearbyMappedRail} from '../server/src/world-standing-rail.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const rail=read('server/src/world-standing-rail.js');
const lines=read('server/src/world-standing-supply-lines.js');
const ui=read('src/LogisticsSupplyLines.jsx');
const sql=read('server/sql/107_rail_standing_supply.sql');

test('railway supply only loads from physically connected rail map segments',async()=>{
 const db={execute:async(sql,params)=>{
  if(sql.includes('FROM world_settlements WHERE id IN'))return [[{id:1,region_id:5},{id:2,region_id:5}]];
  if(sql.includes('FROM world_route_nodes'))return [[{id:10,settlement_id:1},{id:11,settlement_id:null},{id:12,settlement_id:2}]];
  if(sql.includes('FROM world_route_segments'))return [[{id:31,from_node_id:10,to_node_id:11},{id:32,from_node_id:11,to_node_id:12}]];
  if(sql.includes('FROM world_map_routes'))return [[]];
  if(sql.includes('FROM order_internal_rail_routes'))return [[{id:99,from_station_id:200,to_station_id:201,duration_minutes:40}]];
  throw Error('Unexpected query '+sql);
 }};
 assert.deepEqual(await mappedRailTrack(db,1,2),['track:31','track:32']);
 const access=await railService(db,1,2,99);
 assert.equal(access.available,true);
 assert.equal(access.forward.id,99);
});

test('nearness is advisory, not permission to load an unconnected train',async()=>{
 const db={execute:async sql=>{
  if(sql.includes('FROM world_industry_facilities'))return [[{x:40,y:43,region_id:2,zone_id:9}]];
  if(sql.includes('FROM world_route_nodes'))return [[{id:1,map_x:25,map_y:40},{id:2,map_x:60,map_y:40}]];
  if(sql.includes('FROM world_route_segments'))return [[{id:5,from_node_id:1,to_node_id:2,waypoints:'[]'}]];
  throw Error(sql);
 }};
 const result=await nearbyMappedRail(db,'facility',8);
 assert.equal(result.available,true);
 assert.equal(result.nearby,true);
 assert.equal(result.connected,false);
 assert.match(result.reason,/station connection/);
});

test('persistent railway freight requires actual train, service, and return journey',()=>{
 assert.match(lines,/mode.mode==='rail'/);
 assert.match(lines,/rail_train_required/);
 assert.match(lines,/ensureMappedRailService/);
 assert.match(lines,/availableConsist\(db,line.train_consist_id/);
 assert.match(lines,/Number\(train.cargo_capacity\)/);
 assert.match(lines,/startRailJourney\(db,rail.forward/);
 assert.match(lines,/startRailJourney\(db,service.reverse/);
 assert.match(lines,/return_due_at/);
 assert.match(lines,/Train journey cancelled/);
 assert.match(lines,/freight.*?fuel|fuelAvailable/s);
 assert.match(rail,/mappedRailTrack/);
 assert.match(rail,/world_route_segments WHERE region_id/);
 assert.match(rail,/world_logistics_corridors WHERE mode='rail'/);
 assert.match(sql,/train_consist_id/);
 assert.match(sql,/return_journey_id/);
 assert.match(sql,/destination_kind ENUM\('warehouse','installation','facility'\)/);
});

test('UI exposes assembled train, station service, track proximity and repair destinations',()=>{
 assert.match(ui,/Assembled freight train/);
 assert.doesNotMatch(ui,/Railway service between stations/);
 assert.match(ui,/Railway access/);
 assert.match(ui,/Inspect track near source/);
 assert.match(ui,/Repair \/ industry depot/);
 assert.match(ui,/draft.mode!=='rail'/);
 assert.match(read('server/src/world-logistics.js'),/rail_services:railServices/);
 assert.match(read('server/src/setup-local.js'),/107_rail_standing_supply.sql/);
});
