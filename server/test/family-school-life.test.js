import test from 'node:test';
import assert from 'node:assert/strict';
import {LIFE_STAGES,SCHOOL_ACTIVITIES,skillProgress,apparentAge,suggestedStage,DEVELOPMENT_MILESTONES} from '../../src/familyLifeStages.js';
import {careNeeds} from '../../src/familyCareNeeds.js';
import {familyRoute} from '../src/family-care.js';

const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const helper='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const request=(method,body)=>({method,headers:{authorization:'Bearer '+'z'.repeat(48)},async *[Symbol.asyncIterator](){if(body)yield Buffer.from(JSON.stringify(body))}});
function mock(actor=id,options={}){
 const calls=[];
 const dependent={id:10,guardian_account_id:id,stage:'child',assigned:actor===helper,school_name:'Cassia Academy',school_days:'1,2,3,4,5',...options};
 const execute=async(sql,args=[])=>{
  calls.push({sql,args});
  if(sql.startsWith('SELECT a.id'))return [[{id:actor,account_role:'member'}]];
  if(sql.includes('FROM order_dependents d WHERE d.id=?'))return [[dependent]];
  if(sql.includes('FROM account_order_ranks'))return [[{member:1}]];
  if(sql.startsWith('SELECT milestone_id'))return [[{milestone_id:'school_started'}]];
  if(sql.startsWith('SELECT milk_stock'))return [[{milk_stock:2,food_stock:2}]];
  if(sql.startsWith('SELECT id,guardian_account_id,stage'))return [[dependent]];
  if(sql.includes('FROM world_settlement_upgrades u'))return [[{id:3,name:'Cassia Academy',category:'school',status:'operational',condition_pct:100,level:2,teacher_count:2,enrolled:0}]];
  if(sql.includes('SELECT COUNT(*) AS n'))return [[{n:0}]];
  return [[]];
 };
 return {calls,pool:{execute,getConnection:async()=>({execute,beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{}})}};
}
test('five stages include school age and teen without auto advancing',()=>{
 assert.deepEqual(LIFE_STAGES.map(s=>s.id),['newborn','infant','toddler','child','teen']);
 assert.equal(apparentAge('2015-06-01',new Date('2026-11-13T00:00:00Z')),11);
 assert.equal(suggestedStage(11),'child');
 assert.equal(suggestedStage(15),'teen');
 assert.equal(suggestedStage(null),null);
});
test('school activities develop skills, only relevant needs show for teen',()=>{
 const events=[{action:'school'},{action:'reading'},{action:'mathematics'},{action:'friends'},{action:'athletics'},{action:'independence'}];
 const skills=skillProgress(events);
 assert.equal(skills.knowledge,20);
 assert.equal(skills.literacy,10);
 assert.equal(skills.social,10);
 assert.equal(skills.independence,10);
 const needs=careNeeds({stage:'teen',created_at:'2026-11-13T11:00:00Z'},[],new Date('2026-11-13T12:00:00Z'));
 assert.ok(needs.some(n=>n.id==='learning'));
 assert.ok(needs.some(n=>n.id==='independence'));
 assert.ok(!careNeeds({stage:'newborn'},[]).some(n=>n.id==='learning'));
});
test('school schedule requires guardian and only school/teen stage',async()=>{
 const visitor=mock(helper);
 const forbidden=await familyRoute(visitor.pool,request('PUT',{school_upgrade_id:3,school_days:'1,2,3'}),'/family/10/school');
 assert.equal(forbidden.status,403);
 const infant=mock(id,{stage:'infant'});
 const wrongAge=await familyRoute(infant.pool,request('PUT',{school_upgrade_id:3,school_days:'1,2,3'}),'/family/10/school');
 assert.equal(wrongAge.status,409);
 const guardian=mock();
 const valid=await familyRoute(guardian.pool,request('PUT',{school_upgrade_id:3,school_days:'1,3,5'}),'/family/10/school');
 assert.equal(valid.status,200);
 const dup=await familyRoute(guardian.pool,request('PUT',{school_upgrade_id:3,school_days:'1,1'}),'/family/10/school');
 assert.equal(dup.status,400);
});
test('school attendance requires enrollment and appropriate age',async()=>{
 const young=mock(id,{stage:'toddler'});
 const result=await familyRoute(young.pool,request('POST',{action:'school',detail:''}),'/family/10/care');
 assert.equal(result.status,409);
 const noSchool=mock(id,{school_name:''});
 const outcome=await familyRoute(noSchool.pool,request('POST',{action:'homework',detail:''}),'/family/10/care');
 assert.equal(outcome.status,409);
});
test('guardian approves milestones while Household caregiver cannot',async()=>{
 assert.ok(DEVELOPMENT_MILESTONES.some(m=>m.id==='school_started'));
 const visitor=mock(helper);
 const blocked=await familyRoute(visitor.pool,request('POST',{milestone_id:'school_started',complete:true}),'/family/10/milestones');
 assert.equal(blocked.status,403);
 const guardian=mock();
 const added=await familyRoute(guardian.pool,request('POST',{milestone_id:'school_started',complete:true}),'/family/10/milestones');
 assert.equal(added.status,200);
 assert.ok(guardian.calls.some(q=>q.sql.includes('INSERT IGNORE INTO order_dependent_milestones')));
});
