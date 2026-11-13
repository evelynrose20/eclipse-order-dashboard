import test from 'node:test';
import assert from 'node:assert/strict';
import {adultFamilyRoute} from '../src/family-adults.js';

const guardian='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const request=(method,body)=>({method,async *[Symbol.asyncIterator](){if(body)yield Buffer.from(JSON.stringify(body))}});
function fake(actor=guardian,{stage='teen',existing=false,settlement=true,owner=guardian,staff=false}={}){
 const calls=[];
 const execute=async(sql,args=[])=>{
  calls.push({sql,args});
  if(sql.includes('FROM order_dependents WHERE id=? FOR UPDATE'))return [[{id:10,stage,guardian_account_id:owner}]];
  if(sql.includes('FROM world_named_civilians WHERE dependent_id=?'))return [existing?[{id:88}]:[]];
  if(sql.includes('FROM world_settlements WHERE id=?'))return [settlement?[{id:3}]:[]];
  if(sql.startsWith('INSERT INTO world_named_civilians'))return [{insertId:88}];
  if(sql.includes('FROM world_named_civilians nc JOIN order_dependents'))return [[{id:88,guardian_account_id:owner,name:'Adult',settlement_id:3,employment_state:'seeking'}]];
  return [[]];
 };
 const pool={execute,getConnection:async()=>({execute,beginTransaction:async()=>{},rollback:async()=>{},commit:async()=>{},release:()=>{}})};
 return {pool,calls,actor:{id:actor,account_role:staff?'high_command':'member'}};
}
test('guardian graduates a teenager into an existing settlement and preserves dependent record',async()=>{
 const {pool,actor,calls}=fake();
 const r=await adultFamilyRoute(pool,request('POST',{settlement_id:3}),'/family/10/adulthood',actor);
 assert.equal(r.status,200);
 assert.equal(r.body.civilian_id,88);
 assert.ok(calls.some(x=>x.sql.startsWith('INSERT INTO world_named_civilians')));
 assert.ok(!calls.some(x=>/UPDATE world_settlements|DELETE FROM order_dependents|UPDATE order_dependents/.test(x.sql)));
});
test('adulthood transition rejects non-guardian, non-teen, duplicate and unknown settlement',async()=>{
 const stranger=fake(other);
 assert.equal((await adultFamilyRoute(stranger.pool,request('POST',{settlement_id:3}),'/family/10/adulthood',stranger.actor)).status,403);
 const child=fake(guardian,{stage:'child'});
 assert.equal((await adultFamilyRoute(child.pool,request('POST',{settlement_id:3}),'/family/10/adulthood',child.actor)).status,409);
 const duplicate=fake(guardian,{existing:true});
 assert.equal((await adultFamilyRoute(duplicate.pool,request('POST',{settlement_id:3}),'/family/10/adulthood',duplicate.actor)).status,409);
 const unknown=fake(guardian,{settlement:false});
 assert.equal((await adultFamilyRoute(unknown.pool,request('POST',{settlement_id:3}),'/family/10/adulthood',unknown.actor)).status,404);
});
test('adult records are private to the guardian; staff may update official civilian status',async()=>{
 const notFamily=fake(other);
 assert.equal((await adultFamilyRoute(notFamily.pool,request('GET'),'/family/adults/88',notFamily.actor)).status,403);
 const noJob=fake();
 assert.equal((await adultFamilyRoute(noJob.pool,request('PUT',{settlement_id:3,employment_state:'seeking',wellbeing:'settled',workplace_facility_id:null,public_update:'Doing fine'}),'/family/adults/88',noJob.actor)).status,403);
 const admin=fake(other,{staff:true});
 const result=await adultFamilyRoute(admin.pool,request('PUT',{settlement_id:3,employment_state:'seeking',wellbeing:'settled',workplace_facility_id:null,public_update:'Doing fine'}),'/family/adults/88',admin.actor);
 assert.equal(result.status,200);
 assert.ok(admin.calls.some(x=>x.sql.startsWith('UPDATE world_named_civilians')));
});
test('registry and workplaces require staff authorization',async()=>{
 const family=fake();
 const registry=await adultFamilyRoute(family.pool,request('GET'),'/family/adults/registry',family.actor);
 assert.equal(registry.status,403);
 const jobs=await adultFamilyRoute(family.pool,request('GET'),'/family/workplaces',family.actor);
 assert.equal(jobs.status,403);
});
test('employed state cannot be asserted without an operational workplace',async()=>{
 const staff=fake(other,{staff:true});
 const result=await adultFamilyRoute(staff.pool,request('PUT',{settlement_id:3,employment_state:'employed',wellbeing:'settled',workplace_facility_id:null,public_update:''}),'/family/adults/88',staff.actor);
 assert.equal(result.status,400);
});
