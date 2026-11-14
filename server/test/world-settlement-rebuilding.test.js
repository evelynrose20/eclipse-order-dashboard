import test from 'node:test';
import assert from 'node:assert/strict';
import {rebuildingAssessment,worldRebuildingRoute} from '../src/world-settlement-rebuilding.js';

const base=()=>({
 settlement:{id:7,name:'Castrum Moonlight',strategic_state:'rebuilding',controlling_faction_id:'eclipse-order',population:120,workforce:60},
 housingCapacity:150,buildings:[],industry:[],power:[],warehouses:[],
 civicProjects:[],industryProjects:[],powerProjects:[]
});
test('restoration readiness is composed from actual assets, not just territorial state',()=>{
 const r=base();
 assert.equal(rebuildingAssessment(r).operationallyReady,true);
 r.buildings=[{name:'Clinic',status:'destroyed',condition_pct:0}];
 r.industry=[{name:'Factory',status:'ruined',equipment_condition:10}];
 r.power=[{name:'Generator',status:'damaged',condition_pct:32,fuel_units:0}];
 r.warehouses=[{name:'Store',state:'planned'}];
 r.civicProjects=[{id:1,status:'active',progress:10,labor_required:100}];
 const a=rebuildingAssessment(r);
 assert.equal(a.operationallyReady,false);
 assert.equal(a.damagedCivic,1);
 assert.equal(a.damagedIndustry,1);
 assert.equal(a.damagedPower,1);
 assert.equal(a.blockedPower,1);
 assert.equal(a.unfinishedWarehouses,1);
 assert.equal(a.projectProgress,10);
 assert.ok(a.risks.length>=5);
});
test('healthy industrial plant still needs housing and sufficient workforce',()=>{
 const r=base();r.housingCapacity=90;
 assert.equal(rebuildingAssessment(r).operationallyReady,false);
 assert.ok(rebuildingAssessment(r).risks.some(s=>s.includes('housing')));
});
test('a new uncompleted civic building counts as a blocker',()=>{
 const r=base();r.buildings=[{status:'building',condition_pct:100}];
 assert.equal(rebuildingAssessment(r).damagedCivic,1);
});
function fakePool(state){
 const calls=[];
 const conn={
  async beginTransaction(){calls.push('begin')},
  async rollback(){calls.push('rollback')},
  async commit(){calls.push('commit')},
  release(){calls.push('release')},
  async execute(sql,args){
   calls.push(sql);
   if(sql.includes('FROM world_settlements WHERE id=? FOR UPDATE'))return [[{id:7,...state}]];
   return [{affectedRows:1}];
  }
 };
 return {calls,getConnection:async()=>conn};
}
test('starting settlement rebuilding changes only territorial state and writes an audit record',async()=>{
 const pool=fakePool({strategic_state:'destroyed',controlling_faction_id:'eclipse-order'});
 const result=await worldRebuildingRoute(pool,{method:'POST'},'/world-admin/settlements/7/rebuilding/start',{account_role:'domina',id:'staff'});
 assert.equal(result.status,200);
 assert.ok(pool.calls.some(c=>String(c).includes("SET strategic_state='rebuilding'")));
 assert.ok(pool.calls.some(c=>String(c).includes("world_administration_audit")));
 assert.ok(!pool.calls.some(c=>String(c).includes('UPDATE world_settlement_upgrades')));
 assert.ok(pool.calls.includes('commit'));
});
test('cannot start restoration on NPC land or a site not in ruins',async()=>{
 for(const state of [
 {strategic_state:'destroyed',controlling_faction_id:'other'},
 {strategic_state:'secure',controlling_faction_id:'eclipse-order'}
 ]){
  const pool=fakePool(state);
  const result=await worldRebuildingRoute(pool,{method:'POST'},'/world-admin/settlements/7/rebuilding/start',{account_role:'domina',id:'staff'});
  assert.equal(result.status,409);
  assert.ok(pool.calls.includes('rollback'));
  assert.ok(!pool.calls.some(c=>String(c).includes('UPDATE world_settlements')));
 }
});
test('unauthorized members cannot access rebuilding commands',async()=>{
 const result=await worldRebuildingRoute({}, {method:'POST'},'/world-admin/settlements/7/rebuilding/start',{account_role:'member',id:'m'});
 assert.equal(result.status,403);
});
