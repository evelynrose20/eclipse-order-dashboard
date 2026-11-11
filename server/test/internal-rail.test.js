import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {journeyProgress} from '../src/internal-rail.js';

test('train journey progress is derived only from real departure and arrival timestamps',()=>{
 const run={id:1,status:'running',departed_at:'2026-11-08T10:00:00.000Z',expected_arrival_at:'2026-11-08T12:00:00.000Z'};
 assert.equal(journeyProgress(run,new Date('2026-11-08T09:00:00Z')).progress_percent,0);
 assert.equal(journeyProgress(run,new Date('2026-11-08T11:00:00Z')).progress_percent,50);
 assert.equal(journeyProgress(run,new Date('2026-11-08T13:00:00Z')).progress_percent,100);
 assert.equal(journeyProgress(run,new Date('2026-11-08T13:00:00Z')).display_status,'arrived');
 assert.equal(journeyProgress({...run,status:'cancelled'},new Date('2026-11-08T11:00:00Z')).display_status,'cancelled');
});
test('legacy rail journey storage is retained while map-first Supply Lines owns the UI',async()=>{
 const load=path=>readFile(new URL('../../'+path,import.meta.url),'utf8');
 const [page,map,workspace,nav,api,sql,setup]=await Promise.all([
  load('src/LogisticsSupplyLines.jsx'),load('src/WorldTerritoryMap.jsx'),load('src/LocalWorkspace.jsx'),
  load('src/OrderNavigation.jsx'),load('server/src/internal-rail.js'),
  load('server/sql/049_internal_rail_logistics.sql'),load('server/src/setup-local.js')
 ]);
 assert.match(page,/Internal Rail Logistics/);
 assert.match(page,/Stations/);
 assert.match(page,/ir-progress/);
 assert.match(page,/fa-solid fa-train/);
 assert.match(page,/expected_arrival_at/);
 assert.match(page,/Dispatch/);
 assert.match(page,/stationDraft/);
 assert.match(workspace,/\['internal-rail','Internal Rail Logistics'/);
 assert.match(nav,/'internal-rail':'train'/);
 assert.doesNotMatch(map,/RailInfrastructurePanel|wtm-rail-symbol|\['rail','Railway'\]|\['track','Lay track'\]/);
 assert.match(api,/rail_journey_already_running/);
 assert.match(api,/rail_stations_not_operational/);
 assert.doesNotMatch(api,/UPDATE order_front_stock|UPDATE fc_material_stock|INSERT INTO fc_material_ledger/);
 assert.match(sql,/order_internal_rail_stations/);
 assert.match(sql,/order_internal_rail_routes/);
 assert.match(sql,/order_internal_rail_journeys/);
 assert.match(setup,/049_internal_rail_logistics\.sql/);
 assert.doesNotMatch(sql,/DROP TABLE|DELETE FROM world_route|TRUNCATE TABLE/);
});
