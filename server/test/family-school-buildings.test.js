import test from 'node:test';
import assert from 'node:assert/strict';
import {schoolCapacity,educationPreview} from '../src/world-education.js';
import {schoolRoute,enrollDependentSchool} from '../src/family-school-buildings.js';
const guardian='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const request=body=>({method:'PUT',async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(body))}});
const school={id:3,settlement_id:1,category:'school',name:'Cassia Academy',status:'operational',condition_pct:100,level:2,template_id:null,teacher_count:2,support_staff:1,workforce:20,school_name:'Cassia Academy',enrolled:15};
test('operational school capacity is limited by teacher staffing and building condition',()=>{
 assert.equal(schoolCapacity([school]),40);
 assert.equal(schoolCapacity([{...school,teacher_count:0}]),0);
 assert.equal(schoolCapacity([{...school,condition_pct:50}]),25);
 assert.equal(schoolCapacity([{...school,status:'destroyed'}]),0);
 assert.equal(schoolCapacity([school],false),50);
});
test('existing civic education simulation uses staffed capacity',()=>{
 const preview=educationPreview({population:250,workforce:70},[school],{attainment:20});
 assert.equal(preview.school_seats,40);
});
test('only guardian can enroll and unstaffed buildings reject attendance',async()=>{
 let inserts=0;
 const pool={getConnection:async()=>({
  beginTransaction:async()=>{},rollback:async()=>{},commit:async()=>{},release:()=>{},
  execute:async(sql)=>{
   if(sql.startsWith('SELECT id,guardian_account_id,stage'))return [[{id:10,stage:'child',guardian_account_id:guardian}]];
   if(sql.includes('FROM world_settlement_upgrades u'))return [[school]];
   if(sql.includes('SELECT COUNT(*) AS n'))return [[{n:40}]];
   if(sql.startsWith('UPDATE order_dependents')){inserts++;return [{affectedRows:1}]}
   throw Error('unmocked '+sql);
  }
 })};
 const denied=await enrollDependentSchool(pool,request({school_upgrade_id:3,school_days:'1,2,3,4,5'}),{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'},10);
 assert.equal(denied.status,403);
 const full=await enrollDependentSchool(pool,request({school_upgrade_id:3,school_days:'1,2,3,4,5'}),{id:guardian},10);
 assert.equal(full.status,409);
 assert.equal(inserts,0);
});
test('only command staff can change school staffing',async()=>{
 const response=await schoolRoute({execute:async()=>{throw Error('unexpected SQL')}},request({teachers:2,support_staff:1}),'/family/schools/3',{id:guardian,account_role:'member'});
 assert.equal(response.status,403);
});
test('staffed seats cannot be assigned from more workers than settlement has',async()=>{
 let insert=false;
 const db={beginTransaction:async()=>{},rollback:async()=>{},commit:async()=>{},release:()=>{},
  execute:async sql=>{
   if(sql.includes('FROM world_settlement_upgrades u JOIN world_settlements'))return [[school]];
   if(sql.includes('FROM world_school_staffing t'))return [[{teachers:18,support_staff:0}]];
   if(sql.startsWith('INSERT INTO world_school_staffing'))insert=true;
   return [[]];
  }};
 const result=await schoolRoute({getConnection:async()=>db},request({teachers:4,support_staff:0}),'/family/schools/3',{id:guardian,account_role:'high_command'});
 assert.equal(result.status,409);
 assert.equal(insert,false);
});
