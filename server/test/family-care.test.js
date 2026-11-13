import test from 'node:test';
import assert from 'node:assert/strict';
import {familyRoute} from '../src/family-care.js';

const guardian='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const request=(method,body)=>({method,headers:{authorization:'Bearer '+'z'.repeat(48)},async *[Symbol.asyncIterator](){if(body)yield Buffer.from(JSON.stringify(body))}});
function mock(actor=guardian,{isGuardian=true,assigned=false,household=false,nursing=false,stock=0}={}){
 const queries=[];
 const dependent={id:1,name:'Dependent',stage:'newborn',guardian_account_id:isGuardian?actor:guardian,assigned,milk_stock:stock,food_stock:0};
 const run=async(sql,args=[])=>{
  queries.push({sql,args});
  if(sql.startsWith('SELECT a.id'))return [[{id:actor,account_role:'member'}]];
  if(sql.includes('FROM order_dependents d WHERE d.id=?'))return [[dependent]];
  if(sql.includes("FROM account_order_ranks WHERE account_id"))return [household?[{present:1}]:[]];
  if(sql.startsWith('SELECT nursing_available'))return [[{nursing_available:Number(nursing)}]];
  if(sql.startsWith('SELECT milk_stock,food_stock'))return [[{milk_stock:stock,food_stock:0}]];
  if(sql.startsWith('INSERT INTO order_dependent_care_events'))return [{affectedRows:1}];
  if(sql.startsWith('UPDATE order_dependents'))return [{affectedRows:1}];
  if(sql.startsWith('INSERT IGNORE INTO order_dependent_caregivers'))return [{affectedRows:1}];
  if(sql.startsWith('INSERT INTO order_dependents'))return [{insertId:1}];
  return [[]];
 };
 return {queries,pool:{execute:run,getConnection:async()=>({execute:run,beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{}})}};
}
test('guardian can register an unlinked dependent but adult systems are not written',async()=>{
 const {pool,queries}=mock();
 const r=await familyRoute(pool,request('POST',{name:'Child One',birth_date:'',stage:'newborn',notes:''}),'/family');
 assert.equal(r.status,200);
 assert.equal(r.body.id,1);
 assert.ok(queries.some(q=>q.sql.startsWith('INSERT INTO order_dependents')));
 assert.ok(!queries.some(q=>/INSERT INTO characters|order_lineage_cases/.test(q.sql)));
});
test('unassigned member is forbidden from viewing a dependent record',async()=>{
 const {pool}=mock(other,{assigned:false,isGuardian:false});
 const r=await familyRoute(pool,request('GET'),'/family/1');
 assert.equal(r.status,403);
});
test('assigned household caregiver can record ordinary care',async()=>{
 const {pool,queries}=mock(other,{assigned:true,isGuardian:false,household:true});
 const r=await familyRoute(pool,request('POST',{action:'comfort',detail:''}),'/family/1/care');
 assert.equal(r.status,200);
 assert.ok(queries.some(x=>x.sql.startsWith('INSERT INTO order_dependent_care_events')));
});
test('assigned non-household accounts are not granted care access',async()=>{
 const {pool}=mock(other,{assigned:true,isGuardian:false,household:false});
 const r=await familyRoute(pool,request('POST',{action:'comfort',detail:''}),'/family/1/care');
 assert.equal(r.status,403);
});
test('nursing is strictly self-enabled by caregiver, not inferred from household rank',async()=>{
 const {pool}=mock(other,{assigned:true,household:true,nursing:false,isGuardian:false});
 const r=await familyRoute(pool,request('POST',{action:'nursing',detail:''}),'/family/1/care');
 assert.equal(r.status,403);
 assert.equal(r.body.error,'caregiver_nursing_not_enabled');
});
test('newborn bottle feeding requires recorded supplies',async()=>{
 const {pool}=mock(guardian,{stock:0});
 const r=await familyRoute(pool,request('POST',{action:'bottle',detail:''}),'/family/1/care');
 assert.equal(r.status,409);
 assert.equal(r.body.error,'milk_supplies_needed');
});
test('supply acquisition requires a stated source and guardian-only assignment',async()=>{
 const {pool}=mock(guardian);
 const r=await familyRoute(pool,request('POST',{action:'restock_milk',quantity:5,detail:''}),'/family/1/supplies');
 assert.equal(r.status,400);
 const {pool:visitor}=mock(other,{isGuardian:false,assigned:true,household:true});
 const assigned=await familyRoute(visitor,request('PUT',{account_id:guardian,enabled:true}),'/family/1/assign');
 assert.equal(assigned.status,403);
});
