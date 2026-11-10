import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const command=readFileSync(new URL('../../src/LogisticsCommandOverview.jsx',import.meta.url),'utf8');
const freight=readFileSync(new URL('../../src/FreightLogistics.jsx',import.meta.url),'utf8');
const backend=readFileSync(new URL('../src/world-logistics.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../../src/logistics-command-overview.css',import.meta.url),'utf8');

test('gameplay supply command is the default with existing specialist freight tabs retained',()=>{
 assert.match(freight,/useState\('command'\)/);
 assert.match(freight,/\['command','Supply command'/);
 assert.match(freight,/tab==='shipments'/);
 assert.match(freight,/tab==='contracts'/);
 assert.match(freight,/tab==='transport'/);
 assert.match(freight,/tab==='history'/);
});
test('existing world and player economic systems remain accessible instead of being replaced',()=>{
 for(const route of ['/world-admin','/internal-rail','/commerce','/world-admin/military','/fronts'])assert.ok(command.includes(route),route);
 for(const target of ['world','internal-rail','trade','fronts'])assert.match(command,new RegExp("go\\('"+target+"'\\)"));
});
test('network shows original roads, menu rail services, industrial freight and NPC mapped-farm cargo',()=>{
 for(const data of ['network_segments','world?.routes','railServices','freightLines','npcRoutes','npcShipments'])assert.ok(command.includes(data),data);
 assert.match(backend,/world_npc_cargo_routes/);
 assert.match(backend,/world_npc_cargo_shipments/);
 assert.match(backend,/world_npc_cargo_warehouse/);
});
test('selecting a settlement opens a targeted freight manifest without directly changing stock',()=>{
 assert.match(freight,/const planSupply=destinationId/);
 assert.match(command,/onPlanSupply\?\.\(focusFacilities\[0\]\.id\)/);
 assert.match(command,/disabled=\{!focusFacilities.length\}/);
});
test('integrated screen matches imperial palette without oversized duplicated hero cards',()=>{
 assert.match(css,/#182733/);
 assert.match(css,/#405462/);
 assert.doesNotMatch(css,/#69527e|#9984ae|#26202d|#211d28/i);
 assert.match(command,/Supply priorities/);
});

test('supply view keeps mapped road geometry and background images',()=>{
 assert.match(command,/region\.map_background_url/);
 assert.match(command,/linePoints\(l\.from,l\.to,l\.waypoints\)/);
 assert.match(command,/mode-rail-service/);
 assert.match(command,/cargo-npc/);
});
