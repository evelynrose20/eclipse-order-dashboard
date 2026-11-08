import test from 'node:test';
import assert from 'node:assert/strict';
import {industryProductionPreview} from '../src/world-industry-rules.js';

const recipe={inputs:[],outputs:[{item_id:'crops',qty:2}],byproducts:[],labor:1,heat:0,power:0,capacity:100,upgrade_level:1};
const facility={status:'operational',level:1,capacity_pct:100,workforce:100,heat_available:0,power_available:0};
const preview=(level,weather,temperature_f=12,available=100)=>industryProductionPreview(facility,recipe,[],{},{
 industry_category:'agriculture',weather,temperature_f,weather_protection_level:level,
 climate_fuel_per_operation:level>=2?(level===2?.15:.5):0,climate_fuel_capacity:available,climate_powered:available>0
});
test('expensive passive shelter improves blizzard production without granting immunity',()=>{
 assert.equal(preview(0,'blizzard').operations,25);
 assert.equal(preview(1,'blizzard').operations,62);
});
test('insulated and powered protection recover further throughput',()=>{
 assert.equal(preview(2,'blizzard').operations,88);
 assert.equal(preview(3,'blizzard').operations,100);
 assert.equal(preview(3,'blizzard',12,10).operations,10);
});
test('extreme cold disrupts outdoor work even on clear days',()=>{
 assert.equal(preview(0,'clear',-30).operations,40);
 assert.equal(preview(1,'clear',-30).operations,70);
 assert.equal(preview(3,'clear',-30).operations,100);
});
test('unpowered advanced protection loses active benefits and output',()=>{
 assert.equal(preview(3,'blizzard',12,0).operations,0);
});
