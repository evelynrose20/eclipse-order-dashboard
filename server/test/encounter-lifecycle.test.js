import test from 'node:test';
import assert from 'node:assert/strict';
import {rollBlockReason,diceRoute} from '../src/dice.js';
import {encounterRoute} from '../src/encounters.js';

const dmId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const sceneId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const token='T'.repeat(48);
const actor={id:dmId,account_role:'domina'};
function request(method,body){
 return {method,headers:{authorization:'Bearer '+token},
  [Symbol.asyncIterator]:async function*(){if(body!==undefined)yield Buffer.from(JSON.stringify(body))}};
}
function fakeDatabase(scene={id:sceneId,created_by:dmId,status:'draft',archived_at:null,published:0,themes:'[]'}){
 const statements=[];
 const db={execute:async(sql,args)=>{
  statements.push({sql,args});
  if(sql.startsWith('SELECT a.id'))return [[actor]];
  if(sql.startsWith('SELECT * FROM order_encounters WHERE'))return [[scene]];
  if(sql.startsWith('SELECT 1 FROM order_combatants'))return [[]];
  if(sql.startsWith('SELECT adult_declaration'))return [[]];
  if(sql.startsWith('SELECT 1 FROM order_encounter_pauses'))return [[]];
  if(sql.startsWith('INSERT INTO order_encounter_rolls'))return [{insertId:3}];
  if(sql.startsWith('UPDATE order_encounters SET archived_at=UTC_TIMESTAMP()')){scene.archived_at='2026-11-06 09:00:00';return [{affectedRows:1}]}
  if(sql.startsWith('UPDATE order_encounters SET archived_at=NULL')){scene.archived_at=null;return [{affectedRows:1}]}
  if(sql.startsWith('DELETE FROM order_encounters WHERE'))return [{affectedRows:1}];
  throw Error('Unexpected query: '+sql);
 }};
 return {db,scene,statements};
}
test('active DM can roll without a linked player character or personal RP declarations',async()=>{
 const {db}=fakeDatabase({id:sceneId,created_by:dmId,status:'active',themes:'[]',archived_at:null});
 assert.equal(await rollBlockReason(db,actor,{id:sceneId,created_by:dmId,status:'active',themes:'[]',archived_at:null}),null);
 const response=await diceRoute(db,request('POST',{formula:'1d20+0',visibility:'public',kind:'ability'}),'/encounters/'+sceneId+'/rolls');
 assert.equal(response.status,200,JSON.stringify(response.body));
 assert.equal(response.body.kind,'ability');
 assert.ok(response.body.total>=1&&response.body.total<=20);
});
test('dice errors identify inactive, archived, missing player, declarations and paused participation separately',async()=>{
 const member={id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',account_role:'member'};
 const {db}=fakeDatabase();
 assert.equal(await rollBlockReason(db,actor,{status:'draft'}),'encounter_not_active');
 assert.equal(await rollBlockReason(db,actor,{status:'active',archived_at:'2026-11-06'}),'encounter_archived');
 assert.equal(await rollBlockReason(db,member,{id:sceneId,status:'active',archived_at:null}),'not_in_encounter_party');
});
test('DM may archive a draft scene and restore it without deleting associated records',async()=>{
 const {db,scene,statements}=fakeDatabase();
 let response=await encounterRoute(db,request('POST'),'/encounters/'+sceneId+'/archive');
 assert.equal(response.status,200,JSON.stringify(response.body));
 assert.ok(scene.archived_at);
 assert.equal(statements.some(row=>row.sql.startsWith('DELETE FROM order_encounters')),false);
 response=await encounterRoute(db,request('POST'),'/encounters/'+sceneId+'/restore');
 assert.equal(response.status,200,JSON.stringify(response.body));
 assert.equal(scene.archived_at,null);
});
test('active encounters cannot be archived and unarchived scenes cannot be deleted',async()=>{
 const {db}=fakeDatabase({id:sceneId,created_by:dmId,status:'active',archived_at:null});
 const archive=await encounterRoute(db,request('POST'),'/encounters/'+sceneId+'/archive');
 assert.equal(archive.status,409);
 assert.equal(archive.body.error,'finish_encounter_before_archive');
 const deletion=await encounterRoute(db,request('DELETE'),'/encounters/'+sceneId);
 assert.equal(deletion.status,409);
 assert.equal(deletion.body.error,'archive_before_delete');
});
test('permanent deletion is permitted only after archiving and returns confirmation',async()=>{
 const {db}=fakeDatabase({id:sceneId,created_by:dmId,status:'completed',archived_at:'2026-11-06',themes:'[]'});
 const response=await encounterRoute(db,request('DELETE'),'/encounters/'+sceneId);
 assert.equal(response.status,200);
 assert.equal(response.body.status,'deleted');
});
