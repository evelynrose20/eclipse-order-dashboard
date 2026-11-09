import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const load=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('connected transport graph is installed and routed through command authorization',async()=>{
 const [setup,sql,server,graph]=await Promise.all([load('server/src/setup-local.js'),load('server/sql/045_world_transport_graph.sql'),load('server/src/world-administration.js'),load('server/src/world-route-network.js')]);
 assert.match(setup,/045_world_transport_graph\.sql/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS world_route_nodes/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS world_route_segments/);
 assert.match(server,/if\(!command\)return fail\(403,'command_required'\)/);
 assert.match(server,/handleTransportGraph\(pool,req,path,actor\)/);
 assert.match(graph,/junction_has_connections/);
 assert.match(graph,/junction_must_snap_to_route/);
 assert.match(graph,/network_import/);
 assert.match(graph,/FOR UPDATE/);
});
test('one original cartographic editor handles shared junctions, smooth curves and state labels',async()=>{
 const [map,css]=await Promise.all([load('src/WorldTerritoryMap.jsx'),load('src/world-territory-map.css')]);
 assert.doesNotMatch(map,/Network & junctions|<WorldNetworkEditor/);
 for(const tool of ['Plan a route','Edit routes','Mountains'])assert.ok(map.includes(tool),tool);
 for(const action of ['Place junction','Branch from route','Move places','Connect','Save new route','Save route changes'])assert.ok(map.includes(action),action);
 assert.match(map,/smoothRoadPath\(points\)/);
 assert.match(map,/networkSegments\.filter\(visibleTransport\)\.map/);
 assert.match(map,/junctionPointerMove/);
 assert.match(map,/savePlannedRoute/);
 assert.match(map,/wtm-pin-state/);
 assert.match(map,/wtm-mountains/);
 assert.match(css,/\.wtm-junction-tools/);
 assert.match(css,/\.wtm-stage button\.wtm-junction/);
});

test('junctions are selectable, draggable and removable from the original map',async()=>{
 const [map,css,api]=await Promise.all([load('src/WorldTerritoryMap.jsx'),load('src/world-territory-map.css'),load('server/src/world-route-network.js')]);
 for(const fn of ['selectJunction','junctionPointerDown','junctionPointerMove','junctionPointerUp','saveJunction','deleteJunction'])assert.ok(map.includes(fn),fn);
 for(const item of ['Save junction','Delete junction','CONNECTED SEGMENTS','Map X','Map Y','Rail switch'])assert.ok(map.includes(item),item);
 assert.match(map,/mode==='view'\|\|drawing/);
 assert.match(map,/window\.confirm\(warning\)/);
 assert.match(map,/delete_connected_segments:true/);
 assert.match(api,/explicit_segment_removal_required/);
 assert.match(api,/network_node_remove_with_segments/);
 assert.match(css,/\.wtm-stage \.wtm-pin-icon > i\.fa-solid/);
 assert.match(css,/transform:none!important/);
 assert.match(css,/\.wtm-junction-editor/);
});

test('original map lets users connect settlements and saved junctions, including older-road branches',async()=>{
 const [map,css,graph]=await Promise.all([load('src/WorldTerritoryMap.jsx'),load('src/world-territory-map.css'),load('server/src/world-route-network.js')]);
 assert.match(map,/Route starting endpoint/);
 assert.match(map,/Route destination endpoint/);
 assert.match(map,/endpointOptions/);
 assert.match(map,/chooseRouteEndpoint/);
 assert.match(map,/from_node_id:from,to_node_id:to/);
 assert.match(map,/network\/legacy/);
 assert.match(map,/networkSegments\.length\|\|routes\.length/);
 assert.match(graph,/network_branch_legacy/);
 assert.match(graph,/branchLegacyRoute/);
 assert.match(css,/\.wtm-network \.wtm-road-road \.wtm-road-top/);
 assert.match(css,/stroke-dasharray:none/);
 assert.match(map,/wtm-mountains/);
});

test('cartographic map keeps roads but no longer shows train stations or rail construction',async()=>{
 const [map,admin,local]=await Promise.all([load('src/WorldTerritoryMap.jsx'),load('src/WorldAdministration.jsx'),load('src/LocalWorkspace.jsx')]);
 assert.doesNotMatch(map,/RailInfrastructurePanel|wtm-rail-symbol|\['track','Lay track'\]|\['rail','Railway'\]/);
 assert.match(map,/Plan a route/);
 assert.match(map,/Edit routes/);
 assert.match(map,/Mountains/);
 assert.match(admin,/networkSegments=\{networkSegments\.filter\(e=>String\(e\.region_id\)===region/);
 assert.match(map,/wtm-rail-center/);
 assert.match(map,/\['rail','Railway \(map only\)'\]/);
 assert.match(local,/InternalRail/);
});

