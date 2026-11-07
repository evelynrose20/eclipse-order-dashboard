import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {splitRoutePoints} from '../src/route-geometry.js';
import {validMapIcon} from '../src/garlean-climate.js';
const read=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');

test('click-to-split creates two connected segments while retaining all bends',()=>{
 const a={x:10,y:20},b={x:90,y:30},bends=[{x:25,y:20},{x:50,y:40},{x:70,y:25}];
 const s=splitRoutePoints(a,bends,b,{x:38,y:30});
 assert.ok(s);
 assert.equal(s.before.length,1);
 assert.equal(s.after.length,2);
 assert.deepEqual([...s.before,...s.after],bends);
 assert.ok(s.junction.x>=0&&s.junction.x<=100);
});
test('disallow splitting beyond route or at its endpoints',()=>{
 const a={x:10,y:20},b={x:90,y:20};
 assert.equal(splitRoutePoints(a,[],b,{x:50,y:90}),null);
 assert.equal(splitRoutePoints(a,[],b,{x:10,y:20}),null);
 assert.equal(splitRoutePoints(a,[],b,{x:90,y:20}),null);
});
test('world data keeps the legacy routes when importing a new transport graph',async()=>{
 const sql=await read('server/sql/046_import_legacy_world_routes.sql');
 assert.match(sql,/INSERT IGNORE INTO world_route_segments/);
 assert.match(sql,/legacy_route_id/);
 assert.match(sql,/WHERE @needs_graph_import=1/);
 assert.doesNotMatch(sql,/DELETE FROM world_map_routes|DROP TABLE world_map_routes/);
});
test('map and sidebar share Font Awesome and display expanded industries',async()=>{
 const map=await read('src/WorldTerritoryMap.jsx');
 const sidebar=await read('src/OrderNavigation.jsx');
 const icon=await read('src/SiteIcon.jsx');
 const picker=await read('src/SiteMarkerPicker.jsx');
 for(const marker of ['lumber_yard','logging_camp','sawmill','forest','ceruleum_plant','drilling_rig','rail_station']){
  assert.ok(icon.includes("'"+marker+"'"),marker);
  assert.ok(validMapIcon(marker),marker);
 }
 assert.ok(validMapIcon('fa-tree'));
 assert.ok(!validMapIcon('fa-tree something'));
 assert.match(map,/<SiteMarkerPicker/);
 assert.match(sidebar,/import SiteIcon/);
 assert.match(picker,/https:\/\/fontawesome\.com\/search/);
});
test('typed transport graph supports junctions in the map editor',async()=>{
 const map=await read('src/WorldTerritoryMap.jsx');
 const api=await read('server/src/transport-network.js');
 assert.match(map,/\['junction','Junctions'\]/);
 assert.match(map,/\/world-admin\/transport\/segments/);
 assert.match(map,/\/world-admin\/transport\/nodes/);
 assert.match(map,/splitAtRoute/);
 assert.match(api,/junction_has_connected_routes/);
 assert.match(api,/segment_endpoint_type_mismatch/);
 assert.match(api,/splitRoutePoints/);
});
