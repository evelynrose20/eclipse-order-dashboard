import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('zone migration backfills current map geometry without resetting or deleting records',async()=>{
 const [schema,setup]=await Promise.all([read('server/sql/046_world_zones.sql'),read('server/src/setup-local.js')]);
 assert.match(schema,/CREATE TABLE IF NOT EXISTS world_zones/);
 assert.match(schema,/slug='overview'/);
 assert.match(schema,/map_background_url/);
 for(const table of ['world_settlements','world_map_routes','world_route_nodes','world_route_segments','world_map_mountain_ranges']){
  assert.ok(schema.includes("TABLE_NAME='"+table+"'"),table);
  assert.ok(schema.includes('UPDATE '+table+' t JOIN world_zones z'),table+' backfill');
 }
 assert.doesNotMatch(schema,/DROP TABLE|TRUNCATE|DELETE FROM world_(?:settlements|map_routes|route_nodes)/i);
 assert.match(setup,/046_world_zones\.sql/);
});

test('zone editor filters old map and route tools without rendering a duplicate second map',async()=>{
 const [admin,map,css]=await Promise.all([read('src/WorldAdministration.jsx'),read('src/WorldTerritoryMap.jsx'),read('src/world-administration.css')]);
 for(const token of ['activeZoneId','Territory zone','New zone','Edit zone','Delete zone','ZONE TERRITORY MAP','zone_id','map_background_url','governing_faction_id','controlling_faction_id','supporting_faction_id'])assert.ok(admin.includes(token),token);
 assert.match(admin,/routes=\{routes\.filter\(r=>String\(r\.region_id\)===region&&String\(r\.zone_id\)===activeZoneId\)\}/);
 assert.match(admin,/networkNodes=\{networkNodes\.filter\(n=>String\(n\.region_id\)===region&&String\(n\.zone_id\)===activeZoneId\)\}/);
 assert.match(admin,/mountains=\{mountains\.filter\(m=>String\(m\.region_id\)===region&&String\(m\.zone_id\)===activeZoneId\)\}/);
 assert.match(map,/zone_id:Number\(zoneId\)/);
 assert.match(map,/smoothRoadPath/);
 assert.doesNotMatch(map,/WorldNetworkEditor/);
 assert.match(css,/\.wa-zone-summary/);
});

test('transport API enforces same-zone nodes on route creation and isolates imports',async()=>{
 const [graph,world,zones]=await Promise.all([read('server/src/world-route-network.js'),read('server/src/world-administration.js'),read('server/src/world-zones.js')]);
 assert.match(graph,/nodes_must_share_zone/);
 assert.match(graph,/zoneId=await zoneFor/);
 assert.match(graph,/world_map_routes WHERE region_id=\? AND zone_id=\?/);
 assert.match(world,/zone_not_in_region/);
 assert.match(world,/ensureOverviewZone/);
 assert.match(world,/zone_id/);
 assert.match(zones,/overview_zone_cannot_be_deleted/);
 assert.match(zones,/zone_has_map_content/);
});
