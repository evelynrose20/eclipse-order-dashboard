import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const logistics=read('server/src/world-logistics.js');
const setup=read('server/src/setup-local.js');
const freight=read('src/FreightLogistics.jsx');
const routes=read('src/LogisticsCorridorsPanel.jsx');
const workflows=read('src/LogisticsItineraries.jsx');
const sql=read('server/sql/101_multimodal_freight_itineraries.sql');

test('only road rail and airship modes may be created for new player freight',()=>{
 assert.match(logistics,/const modes=\['road','rail','air'\]/);
 assert.match(logistics,/transport_mode_unavailable/);
 assert.doesNotMatch(routes,/\['road','rail','air','sea','pack'\]/);
 assert.match(routes,/\['road','rail','air'\]/);
 assert.match(logistics,/mode==='air'&&\(!fuelId\|\|fuelPer<3\)/);
 assert.match(logistics,/mode==='air'\?15:mode==='road'\?60:90/);
});

test('multi-leg shipments conserve cargo by using the existing dispatch ledger',()=>{
 assert.match(logistics,/itinerary_legs_must_connect/);
 assert.match(logistics,/previous_cargo_not_received/);
 assert.match(logistics,/const outcome=await dispatch\(db/);
 assert.match(logistics,/if\(outcome.status!==200\)return outcome/);
 assert.match(logistics,/UPDATE world_logistics_itinerary_legs SET shipment_id/);
 assert.match(sql,/UNIQUE KEY uq_itinerary_shipment/);
 assert.match(sql,/FOREIGN KEY \(shipment_id\) REFERENCES world_logistics_shipments/);
 assert.match(setup,/101_multimodal_freight_itineraries\.sql/);
});

test('command shows connected road rail and air legs for operators',()=>{
 assert.match(freight,/LogisticsItineraries/);
 assert.match(freight,/Linked journeys/);
 assert.match(workflows,/onRefresh/);
 assert.match(workflows,/Dispatch leg/);
 assert.match(workflows,/Select .*running train/);
 assert.match(workflows,/previous.shipment_status==='arrived'/);
});
