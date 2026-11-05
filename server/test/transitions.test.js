import test from 'node:test';
import assert from 'node:assert/strict';
import {transitionRoute} from '../src/transitions.js';
const player='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const admin='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const handler='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const char='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const requestId='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
function req(body={}){
 return {method:'POST',headers:{authorization:'Bearer '+('T'.repeat(48))},
 [Symbol.asyncIterator]:async function*(){yield Buffer.from(JSON.stringify(body))}};
}
function mock(user,role,transitionState='pending'){
 const calls=[],r={id:requestId,character_id:char,player_account_id:player,requested_by:handler,target_bound:1,state:transitionState};
 const character={id:char,player_account_id:player,handler_account_id:handler,collar_bound:0,
  sheet_json:{name:'Wisp',notes:'keep the full sheet',str:19}};
 const connection={
  beginTransaction:async()=>{calls.push('BEGIN')},
  rollback:async()=>{calls.push('ROLLBACK')},
  commit:async()=>{calls.push('COMMIT')},
  release:()=>{},
  execute:async(sql,args)=>{
   if(sql.includes('FROM character_status_requests WHERE id='))return [[r]];
   if(sql.includes('FROM characters WHERE id='))return [[character]];
   calls.push({sql,args});return [{affectedRows:1}];
  }
 };
 const db={
  execute:async(sql,args)=>{
   if(sql.startsWith('SELECT a.id'))return [[{id:user,account_role:role}]];
   throw Error('Unexpected query '+sql);
  },
  getConnection:async()=>connection
 };
 return {db,calls};
}
test('only linked player may grant OOC approval',async()=>{
 const m=mock(admin,'domina');
 const r=await transitionRoute(m.db,req({approve:true}),'/transitions/'+requestId+'/decide');
 assert.equal(r.status,403);
 assert.ok(m.calls.includes('ROLLBACK'));
});
test('player approves, command may apply approved status without discarding sheet',async()=>{
 const approved=mock(player,'member');
 const decision=await transitionRoute(approved.db,req({approve:true}),'/transitions/'+requestId+'/decide');
 assert.equal(decision.status,200);
 assert.ok(approved.calls.includes('COMMIT'));
 const m=mock(admin,'domina','approved');
 const applied=await transitionRoute(m.db,req(),'/transitions/'+requestId+'/apply');
 assert.equal(applied.status,200);
 const update=m.calls.find(x=>x.sql?.startsWith('UPDATE characters'));
 assert.equal(update.args[0],1);
 assert.equal(update.args[1],'rank_i');
 const data=JSON.parse(update.args[2]);
 assert.equal(data.notes,'keep the full sheet');
 assert.equal(data.str,19);
});
test('command cannot apply pending transition',async()=>{
 const m=mock(admin,'domina','pending');
 const r=await transitionRoute(m.db,req(),'/transitions/'+requestId+'/apply');
 assert.equal(r.status,409);
 assert.equal(m.calls.some(x=>x.sql?.startsWith('UPDATE characters')),false);
});
