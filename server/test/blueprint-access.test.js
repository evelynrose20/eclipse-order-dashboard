import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateEquipmentTemplate} from '../src/world-magitek-equipment.js';
import {beginCivicTemplateProject} from '../src/world-civic-template-projects.js';

const sql=readFileSync(new URL('../sql/074_blueprint_access_scopes.sql',import.meta.url),'utf8');

test('blueprint scope migration is additive and rerunnable',()=>{
 for(const table of ['world_magitek_equipment_templates','world_industry_templates','world_civic_building_templates']){
  assert.match(sql,new RegExp('ALTER TABLE '+table+' ADD COLUMN access_scope'));
 }
 assert.match(sql,/information_schema\.columns/i);
 assert.match(sql,/order_only/);
 assert.doesNotMatch(sql,/\bDROP TABLE\b|\bTRUNCATE\b/i);
});
test('magitek access accepts shared or private designs but rejects invalid scopes',()=>{
 const valid={item_id:'order-escort',name:'Order Escort',description:'',equipment_kind:'transport',transport_capacity:4,cargo_capacity:10,crew_required:2,fuel_item_id:null,fuel_per_operation:0,max_wagons:0,enabled:true,lore_status:'original'};
 assert.equal(validateEquipmentTemplate({...valid,access_scope:'order_only'}),null);
 assert.equal(validateEquipmentTemplate({...valid,access_scope:'shared'}),null);
 assert.equal(validateEquipmentTemplate({...valid,access_scope:'enemy_override'}),'invalid_blueprint_access');
});
test('NPC construction of Order-only designs is rejected before spending development',async()=>{
 const db={execute(){throw new Error('An Order-only blueprint must never reach the database spending path')}};
 const response=await beginCivicTemplateProject(db,{settlement:{id:1},template:{id:'test',enabled:1,access_scope:'order_only'},owner_kind:'npc',npcDevelopment:10000});
 assert.equal(response.status,409);
 assert.equal(response.body.error,'order_only_blueprint');
});
