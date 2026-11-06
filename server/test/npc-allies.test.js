import test from 'node:test';
import assert from 'node:assert/strict';
import {encounterRoute} from '../src/encounters.js';

const dmId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const sceneId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const templateId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const token='T'.repeat(48);
const req=(body)=>({
 method:'POST',headers:{authorization:'Bearer '+token},
 [Symbol.asyncIterator]:async function*(){yield Buffer.from(JSON.stringify(body))}
});
function mock(role='domina'){
 const statements=[],event={id:sceneId,created_by:dmId,status:'draft',archived_at:null};
 const pool={execute:async(sql,args)=>{
  statements.push({sql,args});
  if(sql.startsWith('SELECT a.id'))return [[{id:dmId,account_role:role}]];
  if(sql.startsWith('SELECT * FROM order_encounters WHERE'))return [[event]];
  if(sql.startsWith('SELECT * FROM order_monster_templates WHERE'))return [[{
   id:templateId,name:'Wandering Guardian',initiative_bonus:4,hit_points:25,armor_class:14,actions:'Protect ally',notes:'Friendly NPC'
  }]];
  if(sql.startsWith('INSERT INTO order_combatants'))return [{affectedRows:1}];
  throw Error('Unexpected SQL: '+sql);
 }};
 return {pool,statements,event};
}
test('GM can add an NPC ally with no player account or character record',async()=>{
 const {pool,statements}=mock();
 const result=await encounterRoute(pool,req({encounter_id:sceneId,name:'Rescue Guard',kind:'ally',hp:30,ac:13,initiative:7}),'/combatants');
 assert.equal(result.status,201);
 const inserted=statements.find(row=>row.sql.startsWith('INSERT INTO order_combatants'));
 assert.equal(inserted.args[3],'ally');
 assert.equal(inserted.args[4],null);
 assert.equal(inserted.args[6],30);
});
test('saved NPC stat block can be deployed as ally or hostile enemy',async()=>{
 for(const kind of ['ally','npc']){
  const {pool,statements}=mock();
  const result=await encounterRoute(pool,req({kind}),'/encounters/'+sceneId+'/monsters/'+templateId);
  assert.equal(result.status,201);
  const inserted=statements.find(row=>row.sql.startsWith('INSERT INTO order_combatants'));
  assert.equal(inserted.args[3],kind);
  assert.equal(inserted.args[5],25);
 }
});
test('server rejects unsupported sides and does not accept a friendly player impersonation',async()=>{
 const {pool,statements}=mock();
 const result=await encounterRoute(pool,req({encounter_id:sceneId,name:'Guard',kind:'random',hp:12,ac:12,initiative:2}),'/combatants');
 assert.equal(result.status,400);
 assert.equal(statements.some(row=>row.sql.startsWith('INSERT INTO order_combatants')),false);
});
test('ordinary members cannot spawn friendly NPCs or reuse saved stat blocks',async()=>{
 const {pool}=mock('member');
 const result=await encounterRoute(pool,req({encounter_id:sceneId,name:'Guard',kind:'ally',hp:12,ac:12,initiative:2}),'/combatants');
 assert.equal(result.status,403);
});
