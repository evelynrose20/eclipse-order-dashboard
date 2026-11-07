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
test('connected map editor shows named terrain, state markers and Font Awesome facility icons',async()=>{
 const [map,ui,css]=await Promise.all([load('src/WorldTerritoryMap.jsx'),load('src/WorldNetworkEditor.jsx'),load('src/world-network-editor.css')]);
 assert.match(map,/Network & junctions/);
 assert.match(map,/networkNodes=\[\]/);
 assert.match(map,/NetworkPaths nodes=\{networkNodes\}/);
 for(const action of ['Connect','Place junction','Split / branch','Move junction','Edit route','Convert'])assert.ok(ui.includes(action),action);
 assert.match(ui,/markerIcon\(s\.map_icon\)/);
 assert.match(ui,/s\.strategic_state/);
 assert.match(ui,/mountains\.filter/);
 assert.match(css,/\.wn-site\[data-state="occupied"\]/);
 assert.match(css,/\.wn-site\[data-state="secure"\]/);
 assert.match(ui,/fa-solid/);
});
