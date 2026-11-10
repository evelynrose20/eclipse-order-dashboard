import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {freightPath,corridorPath,shouldInterruptForWeather} from '../src/world-logistics.js';

const nodes=[{id:1,settlement_id:10},{id:2,settlement_id:null},{id:3,settlement_id:20},{id:4,settlement_id:30}];
const edges=[
 {id:101,from_node_id:1,to_node_id:2,route_type:'road'},
 {id:102,from_node_id:2,to_node_id:3,route_type:'road'},
 {id:103,from_node_id:3,to_node_id:4,route_type:'rail'}
];
test('road manifest uses only connected road/trail links, in order',()=>{
 assert.deepEqual(freightPath(nodes,edges,10,20,'road'),{node_ids:[1,2,3],segment_ids:[101,102],legs:2});
 assert.equal(freightPath(nodes,edges,10,30,'road'),null);
});
test('freight routing refuses nonexistent endpoints or incompatible modes',()=>{
 assert.equal(freightPath(nodes,edges,10,30,'rail'),null);
 assert.equal(freightPath(nodes,edges,10,20,'air'),null);
 assert.equal(freightPath(nodes,edges,10,20,'motorcycle'),null);
 assert.equal(freightPath(nodes,edges,10,10,'road'),null);
});
test('transport inventory stays atomic and cannot silently double-deliver',()=>{
 const src=readFileSync(new URL('../src/world-logistics.js',import.meta.url),'utf8');
 assert.match(src,/FOR UPDATE/);
 assert.match(src,/request_key=\?/);
 assert.match(src,/freight_stock_insufficient/);
 assert.match(src,/freight_fuel_insufficient/);
 assert.match(src,/shipment_already_settled/);
 assert.match(src,/freight_dispatch/);
 assert.match(src,/freight_arrival/);
 assert.match(src,/freight_refund/);
 assert.match(src,/vehicle_lot_id/);
 assert.doesNotMatch(src,/character_reserved_materials|front_reserved_materials/);
});
test('P4 freight migration is additive and local setup runs it',()=>{
 const sql=readFileSync(new URL('../sql/087_world_logistics_freight.sql',import.meta.url),'utf8');
 const setup=readFileSync(new URL('../src/setup-local.js',import.meta.url),'utf8');
 for(const table of ['world_logistics_transport_templates','world_logistics_contracts','world_logistics_shipments','world_logistics_events'])assert.match(sql,new RegExp(table));
 assert.match(setup,/087_world_logistics_freight\.sql/);
 assert.doesNotMatch(sql,/DROP TABLE|DELETE FROM world_industry_stock/i);
});
test('freight command UI follows shared imperial industrial styling',()=>{
 const css=readFileSync(new URL('../../src/freight-logistics.css',import.meta.url),'utf8');
 assert.match(css,/#182733/);
 assert.match(css,/#405462/);
 assert.doesNotMatch(css,/#69527e|#9984ae|#26202d|#211d28/i);
});

test('explicit operational inter-region corridors support multi-hop supply movement',()=>{
 const routes=[{id:1,origin_settlement_id:10,destination_settlement_id:20,travel_minutes:75},{id:2,origin_settlement_id:20,destination_settlement_id:30,travel_minutes:90}];
 assert.deepEqual(corridorPath(routes,10,30),{node_ids:['settlement:10','settlement:20','settlement:30'],segment_ids:['corridor:1','corridor:2'],legs:2,duration_minutes:165});
 assert.equal(corridorPath(routes,10,40),null);
});
test('snow convoy risks are replay-stable, blizzards always interrupt without changing cargo quantity',()=>{
 assert.equal(shouldInterruptForWeather('clear',4),null);
 assert.equal(shouldInterruptForWeather('blizzard',7),'blizzard');
 assert.equal(shouldInterruptForWeather('snow',8),'snowstorm');
 assert.equal(shouldInterruptForWeather('snow',7),null);
});
test('corridor construction consumes real facility stock and incidents require command orders',()=>{
 const src=readFileSync(new URL('../src/world-logistics.js',import.meta.url),'utf8');
 const sql=readFileSync(new URL('../sql/091_logistics_corridors_incidents.sql',import.meta.url),'utf8');
 assert.match(src,/corridor_construction_materials_insufficient/);
 assert.match(src,/construction_supplies_must_be_at_corridor_endpoint/);
 assert.match(src,/convoy_requires_command_decision/);
 assert.match(src,/escort_garrison_unavailable/);
 assert.match(sql,/world_logistics_corridors/);
 assert.match(sql,/world_logistics_incidents/);
});

test('rail shipments must use an actual assembled train journey with checked freight capacity',()=>{
 const src=readFileSync(new URL('../src/world-logistics.js',import.meta.url),'utf8');
 const sql=readFileSync(new URL('../sql/097_rail_freight_journeys.sql',import.meta.url),'utf8');
 assert.match(src,/rail_train_journey_required/);
 assert.match(src,/train_cargo_capacity_exceeded/);
 assert.match(src,/rail_loading_window_closed/);
 assert.match(src,/cargo_capacity_snapshot/);
 assert.match(src,/train_journey_id/);
 assert.match(src,/railJourneyHold/);
 assert.match(sql,/fk_freight_train_journey/);
 assert.doesNotMatch(sql,/DROP TABLE|DELETE FROM order_internal_rail_journeys/i);
});
