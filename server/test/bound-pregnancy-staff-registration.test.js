import test from 'node:test';
import assert from 'node:assert/strict';
import {reproductionRoute} from '../src/character-reproduction.js';

const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const command='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const handler='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const characterId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const path='/characters/'+characterId+'/reproduction';
const pregnancy={anchor:'2026-11-11',start_day:7,total_days:90,notes:'Agreed IC pregnancy'};

function fixture({actorId=owner,role='member',bound=true,handlerId=handler}={}){
 const writes=[];
 const character={id:characterId,player_account_id:owner,handler_account_id:handlerId,collar_bound:bound?1:0,created_at:new Date('2026-10-01'),rank_code:bound?'unmarked':null};
 const profile={conception_opt_in:0,pregnancy_status:'none',shared_with_command:0,base_chance:20,cycle_days:30,cycle_type:'heat'};
 const db={
  beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{},
  execute:async(sql,args=[])=>{
   if(sql.includes('SELECT pregnancy_status FROM character_reproductive_profiles'))return [[{pregnancy_status:'none'}]];
   if(sql.startsWith('INSERT INTO character_reproductive_profiles')||sql.startsWith('INSERT INTO character_reproductive_events')){writes.push({sql,args});return [{affectedRows:1}]}
   throw Error('Unexpected transaction query '+sql);
  }
 };
 const pool={
  execute:async(sql,args=[])=>{
   if(sql.startsWith('SELECT a.id'))return [[{id:actorId,account_role:role}]];
   if(sql.includes('FROM characters c LEFT JOIN character_order_ranks'))return [[character]];
   if(sql.startsWith('SELECT * FROM character_reproductive_profiles'))return [[profile]];
   if(sql.startsWith('SELECT id,event_key')||sql.startsWith('SELECT action,summary'))return [[]];
   throw Error('Unexpected query '+sql);
  },
  getConnection:async()=>db
 };
 const req=(method,body)=>({method,headers:{authorization:'Bearer '+'z'.repeat(48)},async *[Symbol.asyncIterator](){if(body)yield Buffer.from(JSON.stringify(body))}});
 return {pool,req,writes};
}
test('bound character owner cannot register her own pregnancy',async()=>{
 const {pool,req,writes}=fixture();
 const read=await reproductionRoute(pool,req('GET'),path);
 assert.equal(read.status,200);
 assert.equal(read.body.can_edit,true);
 assert.equal(read.body.can_register_pregnancy,false);
 const result=await reproductionRoute(pool,req('POST',pregnancy),path+'/pregnancy');
 assert.equal(result.status,403);
 assert.equal(result.body.error,'bound_pregnancy_requires_staff');
 assert.equal(writes.length,0);
});
test('Domina and High Command can register an existing bound pregnancy',async()=>{
 for(const role of ['domina','high_command']){
  const {pool,req,writes}=fixture({actorId:command,role});
  const read=await reproductionRoute(pool,req('GET'),path);
  assert.equal(read.body.can_register_pregnancy,true);
  assert.equal(read.body.can_edit,false);
  const result=await reproductionRoute(pool,req('POST',pregnancy),path+'/pregnancy');
  assert.equal(result.status,200);
  assert.equal(result.body.registered,true);
  assert.equal(writes.length,2);
 }
});
test('assigned handlers can register, but unrelated handlers cannot',async()=>{
 const approved=fixture({actorId:handler,role:'handler'});
 assert.equal((await reproductionRoute(approved.pool,approved.req('POST',pregnancy),path+'/pregnancy')).status,200);
 const unrelated=fixture({actorId:command,role:'handler'});
 assert.equal((await reproductionRoute(unrelated.pool,unrelated.req('POST',pregnancy),path+'/pregnancy')).status,403);
 assert.equal(unrelated.writes.length,0);
});
test('unbound character owner retains pregnancy self-registration',async()=>{
 const {pool,req,writes}=fixture({bound:false});
 const read=await reproductionRoute(pool,req('GET'),path);
 assert.equal(read.body.can_register_pregnancy,true);
 const result=await reproductionRoute(pool,req('POST',pregnancy),path+'/pregnancy');
 assert.equal(result.status,200);
 assert.equal(writes.length,2);
});
test('staff pregnancy registration does not grant editing of owner-only pregnancy outcomes',async()=>{
 const {pool,req}=fixture({actorId:command,role:'high_command'});
 const result=await reproductionRoute(pool,req('POST',{status:'ended'}),path+'/complete');
 assert.equal(result.status,403);
});
