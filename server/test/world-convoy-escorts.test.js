import test from 'node:test';
import assert from 'node:assert/strict';
import {warThreatAtArrival,escortCommandRoute} from '../src/world-convoy-escorts.js';
const actor={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',account_role:'domina'};
const request=(body)=>({method:'POST',async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(body))}});
function mock(rows){
 const queries=[],db={
  beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{},
  execute:async(sql,args=[])=>{queries.push({sql,args});return rows(sql,args)}
 };
 return {pool:{getConnection:async()=>db},queries};
}
test('war risk holds a contested freight arrival without consuming cargo or killing escorts',async()=>{
 const {pool,queries}=mock((sql)=>{
  if(sql.includes('FROM world_convoy_engagements WHERE'))return [[]];
  if(sql.includes('SELECT s.strategic_state'))return [[{strategic_state:'contested'}]];
  if(sql.includes('FROM world_convoy_escorts'))return [[{id:9}]];
  return [{affectedRows:1}];
 });
 const held=await warThreatAtArrival(await pool.getConnection(),'freight',{id:3,destination_facility_id:9});
 assert.equal(held,true);
 assert.ok(queries.some(x=>x.sql.includes('INSERT INTO world_convoy_engagements')));
 assert.ok(queries.some(x=>x.sql.includes("status='disrupted'")));
 assert.ok(!queries.some(x=>/DELETE FROM|UPDATE world_industry_stock|UPDATE world_military_garrisons/.test(x.sql)));
});
test('healthy territory never creates a surprise ambush',async()=>{
 const {pool,queries}=mock(sql=>sql.includes('FROM world_convoy_engagements')?[[]]:[[{strategic_state:'secure'}]]);
 assert.equal(await warThreatAtArrival(await pool.getConnection(),'freight',{id:22,destination_facility_id:12}),false);
 assert.equal(queries.filter(x=>x.sql.startsWith('INSERT')).length,0);
});
test('escorts reserve real garrison members only if stationed at the source',async()=>{
 const {pool,queries}=mock(sql=>{
  if(sql.startsWith('SELECT * FROM world_logistics_shipments'))return [[{id:3,status:'in_transit',source_facility_id:5}]];
  if(sql.includes('SELECT id FROM world_convoy_escorts'))return [[]];
  if(sql.includes('COALESCE(SUM(e.troops)'))return [[{total:12}]];
  if(sql.includes('FROM world_military_garrisons'))return [[{quantity:30,settlement_id:7,state:'operational',condition_pct:100,strategic_state:'secure',controlling_faction_id:'eclipse-order'}]];
  if(sql.includes('SELECT settlement_id FROM world_industry_facilities'))return [[{settlement_id:7}]];
  if(sql.includes('COALESCE(SUM(e.troops)'))return [[{total:12}]];
  return [{affectedRows:1}];
 });
 const outcome=await escortCommandRoute(pool,request({installation_id:2,troop_type:'Infantry',troops:12}),'/world-admin/logistics/escorts/freight/3/assign',actor);
 assert.equal(outcome.status,200);
 assert.ok(queries.some(q=>q.sql.includes('INSERT INTO world_convoy_escorts')));
});
test('overcommitting garrison is rejected without writing an escort',async()=>{
 const {pool,queries}=mock(sql=>{
  if(sql.startsWith('SELECT * FROM world_logistics_shipments'))return [[{id:3,status:'in_transit',source_facility_id:5}]];
  if(sql.includes('SELECT id FROM world_convoy_escorts'))return [[]];
  if(sql.includes('FROM world_military_garrisons'))return [[{quantity:20,settlement_id:7,state:'operational',condition_pct:100,strategic_state:'secure',controlling_faction_id:'eclipse-order'}]];
  if(sql.includes('SELECT settlement_id FROM world_industry_facilities'))return [[{settlement_id:7}]];
  if(sql.includes('COALESCE(SUM(e.troops)'))return [[{total:15}]];
  return [{affectedRows:1}];
 });
 const outcome=await escortCommandRoute(pool,request({installation_id:2,troop_type:'Infantry',troops:12}),'/world-admin/logistics/escorts/freight/3/assign',actor);
 assert.equal(outcome.status,409);
 assert.equal(outcome.body.error,'escort_troops_already_committed');
 assert.equal(queries.filter(q=>q.sql.includes('INSERT INTO world_convoy_escorts')).length,0);
});
test('unprivileged players cannot assign guards or decide war engagements',async()=>{
 const pool={};
 const outcome=await escortCommandRoute(pool,request({}),'/world-admin/logistics/escorts/freight/3/assign',{id:'member',account_role:'member'});
 assert.equal(outcome.status,403);
});
test('holding the convoy preserves a pending DM decision for later review',async()=>{
 const {pool,queries}=mock(sql=>{
  if(sql.includes('FROM world_convoy_engagements WHERE id='))return [[{id:4,shipment_kind:'freight',shipment_id:3,status:'pending'}]];
  if(sql.includes('FROM world_logistics_shipments WHERE id='))return [[{id:3,status:'disrupted'}]];
  return [{affectedRows:1}];
 });
 const outcome=await escortCommandRoute(pool,request({decision:'held',detail:'Escort taking defensive positions'}),'/world-admin/logistics/escorts/engagements/4/resolve',actor);
 assert.equal(outcome.status,200);assert.equal(outcome.body.status,'pending');
 assert.ok(!queries.some(x=>x.sql.includes("SET status='in_transit'")));
});
