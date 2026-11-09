import {evaluateEquipmentManufacture} from '../src/world-industry.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEquipmentTemplate,equipmentSnapshot} from '../src/world-magitek-equipment.js';
import {validateIndustryConfiguration,industryProductionPreview} from '../src/world-industry-rules.js';
const vehicle={item_id:'magitek-freight-wagon',name:'Magitek Freight Wagon',description:'Industrial rail cargo carriage',equipment_kind:'railcar',transport_capacity:0,cargo_capacity:60,crew_required:2,fuel_item_id:null,fuel_per_operation:0,enabled:true};
test('equipment designs reject invalid and capacity-free rail stock',()=>{
 assert.equal(validateEquipmentTemplate(vehicle),null);
 assert.equal(validateEquipmentTemplate({...vehicle,cargo_capacity:0}),'equipment_requires_capacity');
 assert.equal(validateEquipmentTemplate({...vehicle,equipment_kind:'nonsense'}),'invalid_equipment_template');
 assert.equal(validateEquipmentTemplate({...vehicle,fuel_per_operation:5}),'equipment_fuel_item_required');
});
test('commissioned lots use immutable specification snapshots',()=>{
 const a=equipmentSnapshot({...vehicle,revision:3});
 assert.equal(a.cargo_capacity,60);
 assert.equal(a.revision,3);
 assert.equal(a.equipment_kind,'railcar');
});
test('magitek production uses real multi-material stock and can only output whole units',()=>{
 const recipe={inputs:[{item_id:'iron-ingot',qty:5},{item_id:'ceruleum-fuel',qty:1}],outputs:[{item_id:vehicle.item_id,qty:1}],byproducts:[],labor:5,heat:0,power:2,capacity:2,upgrade_level:1};
 assert.equal(validateIndustryConfiguration(recipe),null);
 const site={status:'operational',level:1,capacity_pct:100,workforce:10,heat_available:10,power_available:10};
 const blocked=industryProductionPreview(site,recipe,[],{'iron-ingot':4,'ceruleum-fuel':2},{temperature_f:50});
 assert.equal(blocked.operations,0);
 const powered=industryProductionPreview(site,recipe,[],{'iron-ingot':10,'ceruleum-fuel':2},{temperature_f:50});
 assert.equal(powered.operations,2);
 assert.equal(powered.outputs[vehicle.item_id],2);
 assert.equal(powered.inputs['iron-ingot'],10);
});

test('tanks and railcars reject fake output byproducts and insufficient inputs',()=>{
 const tank={id:'magitek-tank',enabled:1,equipment_kind:'armored_vehicle'};
 const carriage={id:'magitek-carriage',enabled:1,equipment_kind:'railcar'};
 const factory={inputs:[{item_id:'iron-ingot',qty:12},{item_id:'ceruleum-fuel',qty:2}],outputs:[{item_id:'magitek-tank',qty:1}],labor:10,power:5};
 assert.equal(evaluateEquipmentManufacture(factory,'manufacturing',[tank]),null);
 assert.equal(evaluateEquipmentManufacture({...factory,inputs:[{item_id:'iron-ingot',qty:1},{item_id:'ceruleum-fuel',qty:1}]},'manufacturing',[tank]),'equipment_assembly_requirements_too_low');
 assert.equal(evaluateEquipmentManufacture(factory,'agriculture',[tank]),'equipment_requires_manufacturing_facility');
 assert.equal(evaluateEquipmentManufacture({...factory,outputs:[{item_id:'magitek-carriage',qty:.5}]},'manufacturing',[carriage]),'equipment_requires_whole_units');
 assert.equal(evaluateEquipmentManufacture({...factory,outputs:[]},'manufacturing',[],[tank]),'equipment_cannot_be_byproduct');
});
