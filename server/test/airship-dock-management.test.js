import test from 'node:test';
import assert from 'node:assert/strict';
import {logisticsRoute} from '../src/world-logistics.js';
const actor={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',account_role:'domina'};
const request=b=>({method:'POST',async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(b))}});
const mock=(dock,place={controlling_faction_id:'eclipse-order',strategic_state:'secure'})=>{
 const queries=[];
 const db={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{},
  execute:async(sql,args=[])=>{
   queries.push({sql,args});
   if(sql.startsWith('SELECT * FROM world_logistics_air_docks WHERE id='))return [[dock]];
   if(sql.startsWith('SELECT controlling_faction_id,strategic_state FROM world_settlements'))return [[place]];
   if(sql.startsWith('SELECT id FROM world_industry_items'))return [[{id:'ceruleum'}]];
   if(sql.startsWith('SELECT f.id,f.owner_faction_id'))return [[{id:3,owner_faction_id:'eclipse-order',settlement_id:4,controlling_faction_id:'eclipse-order',strategic_state:'secure'}]];
   return [{affectedRows:1}];
  }};
 return {pool:{getConnection:async()=>db},queries};
};
test('closed commissioned dock reopens without a depot or consuming supplies',async()=>{
 const {pool,queries}=mock({id:7,settlement_id:4,status:'closed',commissioned_at:new Date('2026-11-01T00:00:00Z'),repair_required:0});
 const r=await logisticsRoute(pool,request({status:'operational'}),'/world-admin/logistics/air-docks/7/status',actor);
 assert.equal(r.status,200);
 assert.equal(r.body.status,'operational');
 assert.equal(queries.filter(q=>q.sql.startsWith('UPDATE world_logistics_air_docks')).length,1);
 assert.ok(!queries.some(q=>/world_industry_stock|world_industry_ledger|air_dock_supply_must_be_local/.test(q.sql)));
});
test('a damaged or never commissioned dock still requires construction supplies',async()=>{
 for(const dock of [
  {id:7,settlement_id:4,status:'damaged',commissioned_at:new Date('2026-11-01T00:00:00Z'),repair_required:1},
  {id:7,settlement_id:4,status:'closed',commissioned_at:null,repair_required:0},
  {id:7,settlement_id:4,status:'closed',commissioned_at:new Date('2026-11-01T00:00:00Z'),repair_required:1}
 ]){
  const {pool,queries}=mock(dock);
  const r=await logisticsRoute(pool,request({status:'operational'}),'/world-admin/logistics/air-docks/7/status',actor);
  assert.equal(r.status,400);
  assert.equal(r.body.error,'air_dock_supply_depot_required');
  assert.ok(!queries.some(q=>q.sql.startsWith('UPDATE world_logistics_air_docks')));
 }
});
test('closing a dock preserves physical repair state while damage marks it',async()=>{
 const {pool,queries}=mock({id:7,settlement_id:4,status:'operational',commissioned_at:new Date(),repair_required:0});
 const r=await logisticsRoute(pool,request({status:'damaged'}),'/world-admin/logistics/air-docks/7/status',actor);
 assert.equal(r.status,200);
 const update=queries.find(q=>q.sql.startsWith('UPDATE world_logistics_air_docks'));
 assert.match(update.sql,/repair_required=CASE WHEN/);
 assert.deepEqual(update.args.slice(0,4),['damaged','damaged','damaged','damaged']);
});
test('docks can be renamed without changing their original settlement or build bill',async()=>{
 const {pool,queries}=mock({id:7,settlement_id:4,status:'closed',commissioned_at:new Date(),material_item_id:'ceruleum',material_quantity:20});
 const r=await logisticsRoute(pool,request({name:'Cassia Imperial Aerodrome',material_item_id:'ceruleum',material_quantity:20}),'/world-admin/logistics/air-docks/7/edit',actor);
 assert.equal(r.status,200);
 assert.ok(queries.some(q=>q.sql.includes('SET name=?,material_item_id=?,material_quantity=?')));
 assert.ok(!queries.some(q=>q.sql.includes('UPDATE world_settlements')));
});
test('commissioned dock may not change material requirements and members cannot manage docks',async()=>{
 const {pool}=mock({id:7,settlement_id:4,status:'closed',commissioned_at:new Date(),material_item_id:'ceruleum',material_quantity:20});
 const r=await logisticsRoute(pool,request({name:'Cassia Aerodrome',material_item_id:'ceruleum',material_quantity:1}),'/world-admin/logistics/air-docks/7/edit',actor);
 assert.equal(r.status,409);
 assert.equal((await logisticsRoute(pool,request({status:'operational'}),'/world-admin/logistics/air-docks/7/status',{id:'member',account_role:'member'})).status,403);
});
