import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ensureMappedRailService} from '../server/src/world-standing-rail.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('map-first rail registers terminals and round-trip services from connected track, once',async()=>{
 const terminals=[],routes=[];
 let nextStation=100,nextRoute=200;
 const db={execute:async(sql,params=[])=>{
  if(sql.includes('FROM world_settlements WHERE id IN')&&!sql.includes('FOR UPDATE'))return [[{id:1,region_id:4},{id:2,region_id:4}]];
  if(sql.includes('FROM world_settlements WHERE id IN')&&sql.includes('FOR UPDATE'))return [[{id:1,name:'Mine',controlling_faction_id:'eclipse-order',strategic_state:'secure'},{id:2,name:'Moonlight',controlling_faction_id:'eclipse-order',strategic_state:'secure'}]];
  if(sql.includes('FROM world_route_nodes'))return [[{id:10,settlement_id:1},{id:20,settlement_id:2}]];
  if(sql.includes('FROM world_route_segments'))return [[{id:15,from_node_id:10,to_node_id:20}]];
  if(sql.includes('FROM world_map_routes'))return [[]];
  if(sql.includes('FROM order_internal_rail_stations WHERE stop_type'))return [terminals.filter(x=>x.stop_id===params[0]).map(x=>({id:x.id,status:x.status}))];
  if(sql.startsWith('INSERT INTO order_internal_rail_stations')){const id=nextStation++;terminals.push({id,stop_id:params[1],status:'operational'});return [{insertId:id}]}
  if(sql.includes('FROM order_internal_rail_routes WHERE from_type')&&sql.includes('FOR UPDATE'))return [routes.filter(x=>x.from_id===params[0]&&x.to_id===params[1]).map(x=>({id:x.id,status:x.status}))];
  if(sql.startsWith('INSERT INTO order_internal_rail_routes')){const id=nextRoute++;routes.push({id,name:params[0],from_station_id:params[1],to_station_id:params[2],from_id:params[3],to_id:params[4],duration_minutes:params[5],status:'active'});return [{insertId:id}]}
  if(sql.includes('FROM order_internal_rail_routes')&&sql.includes('JOIN order_internal_rail_stations'))return [routes.filter(x=>x.from_id===params[0]&&x.to_id===params[1])];
  throw Error('Unexpected SQL '+sql);
 }};
 const first=await ensureMappedRailService(db,1,2,'actor');
 assert.equal(first.available,true);
 assert.equal(terminals.length,2);
 assert.equal(routes.length,2);
 assert.equal(first.tracks[0],'track:15');
 const second=await ensureMappedRailService(db,1,2,'actor');
 assert.equal(second.available,true);
 assert.equal(terminals.length,2);
 assert.equal(routes.length,2);
});

test('old separate rail tab is removed but historical server journeys remain intact',()=>{
 const workspace=read('src/LocalWorkspace.jsx');
 const sidebar=read('src/OrderNavigation.jsx');
 const supply=read('src/LogisticsSupplyLines.jsx');
 assert.doesNotMatch(workspace,/import InternalRail/);
 assert.doesNotMatch(workspace,/\['internal-rail','Internal Rail Logistics'/);
 assert.doesNotMatch(sidebar,/'internal-rail':/);
 assert.match(workspace,/if\(tab==='internal-rail'\)setTab\('freight'\)/);
 assert.match(supply,/RailAccessControls/);
 assert.match(supply,/Assembled freight train/);
 assert.doesNotMatch(supply,/Railway service between stations/);
 assert.match(read('server/src/world-standing-rail.js'),/ensureMappedRailService/);
 assert.match(read('server/src/internal-rail.js'),/order_internal_rail_journeys/);
 assert.match(read('server/src/world-standing-supply-lines.js'),/railJourneyId/);
});

test('preexisting damaged stations and paused services are not overridden by automatic dispatch',()=>{
 const source=read('server/src/world-standing-rail.js');
 assert.match(source,/status!=='operational'/);
 assert.match(source,/status==='paused'/);
 assert.match(source,/status==='retired'/);
 const controls=read('src/RailAccessControls.jsx');
 assert.match(controls,/Damaged terminal/);
 assert.match(controls,/Pause service/);
 assert.match(controls,/Resume service/);
});
