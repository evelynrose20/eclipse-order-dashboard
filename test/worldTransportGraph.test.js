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
 assert.match(map,/networkSegments\.map/);
 assert.match(map,/junctionPointerMove/);
 assert.match(map,/savePlannedRoute/);
 assert.match(map,/wtm-pin-state/);
 assert.match(map,/wtm-mountains/);
 assert.match(css,/\.wtm-junction-tools/);
 assert.match(css,/\.wtm-stage button\.wtm-junction/);
});
