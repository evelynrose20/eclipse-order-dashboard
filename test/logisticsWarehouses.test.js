import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WAREHOUSE_TIERS,warehousesRoute,runWarehouseAutomation} from '../server/src/world-warehouses.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const db=read('server/sql/103_settlement_warehouses.sql');
const backend=read('server/src/world-logistics.js');
const warehouse=read('server/src/world-warehouses.js');
const frontend=read('src/LogisticsWarehouses.jsx');
const corridor=read('src/LogisticsCorridorsPanel.jsx');
const itineraries=read('src/LogisticsItineraries.jsx');
const panels=read('src/FreightLogistics.jsx');
const setup=read('server/src/setup-local.js');

test('warehouse building tiers have fixed capacities and industrial costs',()=>{
 assert.deepEqual(WAREHOUSE_TIERS,{depot:{capacity:500,cost:30},storehouse:{capacity:2000,cost:100},grand:{capacity:6000,cost:300}});
 assert.match(db,/CREATE TABLE IF NOT EXISTS world_logistics_warehouses/);
 assert.match(db,/CREATE TABLE IF NOT EXISTS world_logistics_warehouse_stock/);
 assert.match(db,/CREATE TABLE IF NOT EXISTS world_logistics_warehouse_shipments/);
 assert.match(db,/UNIQUE KEY uq_warehouse_shipment_arrival/);
 assert.match(setup,/103_settlement_warehouses\.sql/);
});

test('all warehouse writes remain server-authorized and validate inputs before queries',async()=>{
 const actor={account_role:'member',id:'example'};
 const result=await warehousesRoute({}, {method:'POST'},'/world-admin/logistics/warehouses',actor,{});
 assert.equal(result.status,403);
 async function *invalid(){yield Buffer.from(JSON.stringify({settlement_id:1,name:'Test',tier:'unknown',construction_item_id:'iron'}))}
 const out=await warehousesRoute({},{method:'POST',[Symbol.asyncIterator]:invalid},'/world-admin/logistics/warehouses',{account_role:'domina',id:'person'},{});
 assert.equal(out.status,400);
 assert.deepEqual(await runWarehouseAutomation(null),{arrived:0,disrupted:0});
});

test('warehouse freight reserves physical capacity and never fabricates source goods',()=>{
 assert.match(warehouse,/warehouse_capacity_exceeded/);
 assert.match(warehouse,/world_logistics_warehouse_shipments WHERE destination_warehouse_id/);
 assert.match(warehouse,/source_farm_or_depot_unavailable/);
 assert.match(warehouse,/farm_stock_insufficient/);
 assert.match(warehouse,/await ledger\(db,source.id,b.item_id,-b.quantity,'freight_dispatch'/);
 assert.match(warehouse,/await ledger\(db,shipment.source_facility_id,shipment.item_id,Number\(shipment.quantity\),'freight_refund'/);
 assert.match(warehouse,/world_logistics_warehouse_stock SET quantity=/);
 assert.match(warehouse,/world_logistics_warehouse_ledger/);
 assert.match(warehouse,/SELECT due_at<=UTC_TIMESTAMP\(\) AS due/);
 assert.match(warehouse,/shipment.status!=='in_transit'/);
});

test('mapped farms with damaged access can send already-held stock via controlled same-zone hub',()=>{
 assert.match(backend,/l.state IN \('operational','damaged'\)/);
 assert.match(backend,/sx.zone_id=site.zone_id/);
 assert.match(backend,/sx.controlling_faction_id=f.owner_faction_id/);
 assert.match(backend,/l.state='damaged' THEN l.travel_minutes\*2/);
 assert.match(warehouse,/\['ruined','captured'\].includes\(source.status\)/);
});

test('game-like corridors and connected freight plans use interactive route cards and real previews',()=>{
 assert.match(corridor,/ModeCards/);
 assert.match(corridor,/RouteChain/);
 assert.match(corridor,/PlanningModal/);
 assert.match(corridor,/Authorize construction/);
 assert.match(itineraries,/ModeCards/);
 assert.match(itineraries,/Survey connected routes/);
 assert.match(itineraries,/routes\/preview/);
 assert.match(itineraries,/checks\?\.every\(c=>c.connected\)/);
 assert.match(frontend,/Launch supply convoy/);
 assert.match(frontend,/warehouses\/preview/);
 assert.match(frontend,/warehouse_stocks/);
 assert.match(frontend,/Source|Farm or origin facility/);
 assert.match(panels,/LogisticsWarehouses/);
 assert.match(panels,/Warehouses/);
});

test('capital-stationed road vehicles can collect farm goods with an accounted pickup trip',()=>{
 assert.match(warehouse,/pickup_route_not_connected/);
 assert.match(warehouse,/pickupPath=await route\(db,warehouse.settlement_id,source.settlement_id,service.mode\)/);
 assert.match(warehouse,/pickupPath\?\.legs/);
 assert.match(warehouse,/pickup_required:!!pickup/);
 assert.match(warehouse,/vehicle_ready:vehicleReady/);
 assert.match(frontend,/Pickup from capital/);
 assert.match(frontend,/pickup_required/);
});

test('warehouse shipments do not introduce sea fleets or pack-animal production',()=>{
 assert.doesNotMatch(warehouse,/mode==='sea'|mode==='pack'/);
 assert.match(warehouse,/\['road','rail','air'\]/);
 assert.match(warehouse,/airship_landing_facilities_required/);
});
