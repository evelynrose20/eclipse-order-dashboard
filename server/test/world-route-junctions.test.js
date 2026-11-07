import test from 'node:test';
import assert from 'node:assert/strict';
import {splitRoutePoints,pointOnSegment} from '../src/route-geometry.js';
import {validMapIcon} from '../src/garlean-climate.js';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');

test('a junction splits a winding road into connected segments without losing waypoints',()=>{
 const start={x:10,y:20},bends=[{x:30,y:20},{x:50,y:40},{x:70,y:30}],end={x:90,y:30};
 const split=splitRoutePoints(start,bends,end,{x:41,y:31});
 assert.ok(split);
 assert.equal(split.before.length,1);
 assert.equal(split.after.length,2);
 assert.ok(split.distance<2);
 assert.deepEqual([...split.before,...split.after],bends);
});
test('existing route geometry is never split by remote clicks or endpoint clicks',()=>{
 const a={x:10,y:20},b={x:90,y:20};
 assert.equal(splitRoutePoints(a,[],b,{x:50,y:70}),null);
 assert.equal(splitRoutePoints(a,[],b,{x:10,y:20}),null);
 assert.equal(splitRoutePoints(a,[],b,{x:90,y:20}),null);
});
test('graph migration preserves old routes while permitting typed junction ends',async()=>{
 const sql=await read('server/sql/045_world_route_junction_graph.sql');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS world_map_junctions/);
 assert.match(sql,/MODIFY COLUMN from_settlement_id BIGINT UNSIGNED NULL/);
 assert.match(sql,/from_junction_id BIGINT UNSIGNED NULL/);
 assert.match(sql,/to_junction_id BIGINT UNSIGNED NULL/);
 assert.doesNotMatch(sql,/DROP TABLE|DELETE FROM world_map_routes|UPDATE world_map_routes/i);
});
test('shared SVG icon system covers new wood industry, production, rail and navigation',async()=>{
 const icons=await read('src/SiteIcon.jsx');
 const picker=await read('src/SiteMarkerPicker.jsx');
 const map=await read('src/WorldTerritoryMap.jsx');
 const nav=await read('src/OrderNavigation.jsx');
 for(const key of ['lumberyard','sawmill','logging-camp','forest','ceruleum-plant','drilling-rig','rail-station','warehouse']) {
  assert.ok(icons.includes("'"+key+"'"),key);
  assert.ok(validMapIcon(key),key);
 }
 assert.match(picker,/type="search"/);
 assert.match(map,/<SiteIcon name=\{iconFor\(s\.map_icon\)\}/);
 assert.match(nav,/import SiteIcon from/);
});
test('frontend route editor supports shared junction endpoints and exact line splitting',async()=>{
 const jsx=await read('src/WorldTerritoryMap.jsx');
 assert.match(jsx,/from_junction_id/);
 assert.match(jsx,/to_junction_id/);
 assert.match(jsx,/\/world-admin\/routes\/.*\/split/);
 assert.match(jsx,/mode==='junction'/);
 assert.match(jsx,/endpointName/);
 assert.match(jsx,/saveJunction/);
});
