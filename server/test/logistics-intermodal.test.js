import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateItinerary} from '../src/world-logistics-itineraries.js';
import {logMovement} from '../src/world-front-cargo.js';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const good={name:'New Cassia supply corridor',item_id:'ceruleum-fuel',quantity:10,legs:[
 {mode:'rail',source_facility_id:1,destination_facility_id:2,transport_template_id:11},
 {mode:'air',source_facility_id:2,destination_facility_id:3,transport_template_id:12}
]};
test('road rail air itineraries require real contiguous facilities and fleet profiles',()=>{
 assert.equal(validateItinerary(good),true);
 assert.equal(validateItinerary({...good,legs:[{...good.legs[0],mode:'sea'},good.legs[1]]}),false);
 assert.equal(validateItinerary({...good,legs:[{...good.legs[0],mode:'pack'},good.legs[1]]}),false);
 assert.equal(validateItinerary({...good,legs:[good.legs[0],{...good.legs[1],source_facility_id:4}]}),false);
 assert.equal(validateItinerary({...good,legs:[good.legs[0]]}),false);
 assert.equal(validateItinerary({...good,quantity:0}),false);
});
test('freight arrivals reserve intermediate cargo in a single transaction',()=>{
 const freight=read('server/src/world-logistics.js'),itinerary=read('server/src/world-logistics-itineraries.js');
 assert.match(freight,/stageItineraryArrival\(db,s,ledger,actor\)/);
 assert.match(freight,/stageItineraryArrival\(db,shipment,ledger,\{id:null\}\)/);
 assert.match(itinerary,/freight_stage/);
 assert.match(itinerary,/freight_unstage/);
 assert.match(itinerary,/world_logistics_itinerary_reservations/);
 assert.match(itinerary,/dispatch\(db,manifest,actor\)/);
 assert.match(itinerary,/await db.rollback\(\)/);
});
test('unified movement receipts are idempotent',async()=>{
 const rows=[];
 const db={execute:async(sql,args)=>{rows.push({sql,args});return [{}]}};
 await logMovement(db,{system:'front',reference:17,action:'arrival',item:'cloth',quantity:5,source:'transit:17',destination:'front:3'});
 assert.match(rows[0].sql,/INSERT IGNORE INTO world_logistics_movement_audit/);
 assert.equal(rows[0].args[0],'front:17:arrival');
});
test('owner authorization protects personal front goods, with no implicit guild warehouse conversion',()=>{
 const source=read('server/src/world-front-cargo.js');
 assert.match(source,/source_front_owner_required/);
 assert.match(source,/authorized_by/);
 assert.match(source,/SELECT quantity FROM order_front_stock/);
 assert.match(source,/UPDATE order_front_stock SET quantity=quantity-\?/);
 assert.match(source,/INSERT INTO order_front_stock\(front_id,material_id,quantity\)/);
 assert.doesNotMatch(source,/UPDATE character_reserved_materials/);
 assert.match(source,/fuel_per_leg/);
});
test('UI offers private front cargo and connected deliveries without sea transport',()=>{
 const freight=read('src/FreightLogistics.jsx'),fronts=read('src/Fronts.jsx'),ui=read('src/LogisticsItineraries.jsx'),front=read('src/FrontCargoPanel.jsx');
 assert.match(freight,/Connected deliveries/);
 assert.match(freight,/FrontCargoPanel/);
 assert.match(fronts,/FrontCargoPanel/);
 assert.match(ui,/Cargo secured at/);
 assert.doesNotMatch(ui,/<option value="sea">/);
 assert.doesNotMatch(front,/<option value="pack">|<option value="sea">/);
 const migrations=read('server/src/setup-local.js');
 for(const name of ['101_multimodal_itineraries','102_front_freight_and_unified_audit'])assert.ok(migrations.includes(name));
});
