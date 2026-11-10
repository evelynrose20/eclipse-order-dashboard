import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {airFreightEconomics} from '../src/world-logistics-advanced.js';
import {planRailStops,railCargoWindow,trainLocation} from '../src/world-rail-stops.js';
import {priceNpcFood} from '../src/world-npc-bargaining.js';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');

test('airship travel is faster and requires materially more fuel',()=>{
 const quote=airFreightEconomics({fuelPerLeg:12,legs:2,durationMinutes:180});
 assert.equal(quote.fuel,60);
 assert.equal(quote.minutes,117);
 assert.equal(airFreightEconomics({fuelPerLeg:0,legs:1,durationMinutes:20}).fuel,5);
});

test('rail stops have a viable ordering and reject impossible timetables',()=>{
 const times=planRailStops(120,[4,9]);
 assert.equal(times.length,2);
 assert.ok(times[0].arrival_seconds<times[0].departure_seconds);
 assert.ok(times[0].departure_seconds<times[1].arrival_seconds);
 assert.equal(planRailStops(4,[4,9]),null);
 assert.equal(planRailStops(120,[4,4]),null);
});

test('train cargo can load at a scheduled station only during dwell period',()=>{
 const now=Date.parse('2026-11-10T12:00:00Z');
 const train={id:22,status:'running',from_id:1,to_id:3,departed_at:new Date(now).toISOString(),expected_arrival_at:new Date(now+2*60*60*1000).toISOString()};
 const stops=[{stop_number:1,settlement_id:2,arrival_at:new Date(now+60*60*1000).toISOString(),departure_at:new Date(now+70*60*1000).toISOString()}];
 assert.ok(railCargoWindow(train,stops,1,2,new Date(now+10*60000)));
 assert.equal(railCargoWindow(train,stops,2,3,new Date(now+30*60000)),null);
 assert.ok(railCargoWindow(train,stops,2,3,new Date(now+65*60000)));
 assert.equal(railCargoWindow(train,stops,3,2,new Date(now+65*60000)),null);
 assert.equal(trainLocation(train,stops,new Date(now+65*60000)).status,'loading');
 assert.equal(trainLocation(train,stops,new Date(now+75*60000)).next_settlement_id,3);
});

test('NPC price responds to buyer need, seller availability and relations',()=>{
 const base={sellerStock:1000,sellerPopulation:100,buyerStock:500,buyerPopulation:100,trust:50,tension:50};
 assert.ok(priceNpcFood({...base,buyerStock:0})>priceNpcFood(base));
 assert.ok(priceNpcFood({...base,sellerStock:500})>priceNpcFood(base));
 assert.ok(priceNpcFood({...base,trust:10,tension:90})>priceNpcFood(base));
});

test('full logistics patch is registered for Windows setup and routes are exposed',()=>{
 const setup=read('server/src/setup-local.js');
 for(const version of ['101_multimodal_itineraries','102_front_freight_and_unified_audit','103_airship_ports_escort_readiness','104_internal_rail_journey_stops','105_npc_trade_bargaining'])assert.ok(setup.includes(version),version);
 const freight=read('server/src/world-logistics.js');
 for(const handler of ['itineraryRoute','npcBargainRoute','advancedLogisticsRoute','stageItineraryArrival','airfieldReady','railCargoWindow'])assert.ok(freight.includes(handler),handler);
 assert.match(read('src/FreightLogistics.jsx'),/LogisticsNpcBargaining/);
 assert.match(read('src/InternalRail.jsx'),/intermediate_station_ids/);
 assert.doesNotMatch(read('src/LogisticsItineraries.jsx'),/<option value="sea">|<option value="pack">/);
});
