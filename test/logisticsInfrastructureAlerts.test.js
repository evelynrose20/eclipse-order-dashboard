import test from 'node:test';
import assert from 'node:assert/strict';
import {infrastructureAlerts,supplyAlerts,supplyRisk} from '../src/logisticsInfrastructureAlerts.js';

const healthy={food_stock:50,fuel_stock:80,water_stock:10,waterworks_generated:4,medicine_stock:12,heating_coverage:100,food_days:null,heat_days:null,warnings:[]};
const location=(c={},owner='eclipse-order')=>({controlling_faction_id:owner,strategic_state:'secure',population:0,simulation_enabled:false,civic_summary:{...healthy,...c}});

test('unsimulated Order holding reports each real infrastructure or reserve shortfall',()=>{
 const site=location({food_stock:0,fuel_stock:0,water_stock:0,waterworks_generated:0,medicine_stock:0,heating_coverage:0});
 assert.deepEqual(infrastructureAlerts(site),[
  'Food supplies shortfall',
  'Heating coverage shortfall',
  'Heating fuel shortfall',
  'Clean water shortfall',
  'Medical supplies shortfall'
 ]);
 assert.equal(supplyRisk(site),'alert');
 assert.equal(site.population,0);
 assert.equal(site.simulation_enabled,false);
});
test('healthy reserves and functional production clear all shortfall alerts',()=>{
 assert.deepEqual(supplyAlerts(location()),[]);
 assert.equal(supplyRisk(location()),'stable');
 assert.deepEqual(infrastructureAlerts(location({water_stock:0,waterworks_generated:12})),[]);
});
test('few days of reserve is a shortfall when a population-derived measurement is actually available',()=>{
 assert.deepEqual(infrastructureAlerts(location({food_days:4,heat_days:3})),['Food supplies shortfall','Heating fuel shortfall']);
 assert.deepEqual(infrastructureAlerts(location({food_days:null,heat_days:null})),[]);
});
test('Order resource readiness is not a warning imposed on NPC or unclaimed settlements',()=>{
 for(const owner of ['iron-remnant',null])assert.deepEqual(infrastructureAlerts(location({food_stock:0,medicine_stock:0},owner)),[]);
});
test('missing civic readings do not create invented shortages',()=>{
 assert.deepEqual(infrastructureAlerts({controlling_faction_id:'eclipse-order'}),[]);
 assert.deepEqual(infrastructureAlerts(location({food_stock:null,fuel_stock:null,water_stock:null,waterworks_generated:null,medicine_stock:null,heating_coverage:null})),[]);
});
test('existing civic warnings display readable shortfalls without duplicates',()=>{
 const s=location({food_stock:0,water_stock:0,waterworks_generated:0,warnings:['food_reserve_low','heating_shortfall','water_shortfall','civic_unrest_watch']});
 const alert=supplyAlerts(s);
 assert.equal(alert.filter(x=>x==='Food supplies shortfall').length,1);
 assert.equal(alert.filter(x=>x==='Clean water shortfall').length,1);
 assert.ok(alert.includes('Heating coverage shortfall'));
 assert.ok(alert.includes('civic unrest watch'));
});
