import test from 'node:test';
import assert from 'node:assert/strict';
import {characterRoute} from '../src/characters.js';

function mock(role,id,rows){
 const writes=[];
 const pool={query:async()=>[[]],execute:async(sql,values)=>{
  if(sql.startsWith('SELECT a.id'))return [[{id,account_role:role}]];
  if(sql.startsWith('SELECT * FROM characters WHERE id='))return [rows.filter(c=>c.id===values[0])];
  if(sql.startsWith('SELECT * FROM characters WHERE player_account_id=? OR handler_account_id=?'))return [rows.filter(c=>c.player_account_id===id||c.handler_account_id===id)];
  if(sql.startsWith('SELECT * FROM characters WHERE player_account_id='))return [rows.filter(c=>c.player_account_id===id)];
  if(sql.startsWith('SELECT * FROM characters ORDER BY'))return [rows];
  if(sql.startsWith('INSERT INTO characters')||sql.startsWith('UPDATE characters')){writes.push({sql,values});return [{affectedRows:1}]}
  throw Error('Unexpected SQL: '+sql);
 }};
 return {pool,writes};
}
function req(method,body){
 return {method,headers:{authorization:'Bearer '+('T'.repeat(48))},
  [Symbol.asyncIterator]:async function*(){yield Buffer.from(JSON.stringify(body))}};
}
const Alice='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const Bob='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const Char='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const bound={id:Char,character_name:'Hidden Wisp',player_account_id:Alice,handler_account_id:Bob,collar_bound:1,
 bound_rank:'rank_i',sheet_json:{name:'Hidden Wisp',notes:'secret info',str:19,hp:20,rank:'Rank I: Fresh Intake / Unbroken'}};
test('bound owner sees only limited fields; cannot read notes or stats',async()=>{
 const {pool}=mock('member',Alice,[bound]);
 const result=await characterRoute(pool,req('GET'),'/characters');
 assert.equal(result.status,200);
 assert.equal(result.body.length,1);
 assert.equal(result.body[0].view_mode,'bound');
 assert.equal(result.body[0].notes,undefined);
 assert.equal(result.body[0].str,undefined);
});
test('handler sees full assigned sheet; unrelated member sees none',async()=>{
 const assigned=await characterRoute(mock('handler',Bob,[bound]).pool,req('GET'),'/characters');
 assert.equal(assigned.body[0].notes,'secret info');
 const unrelated=await characterRoute(mock('member','dddddddd-dddd-4ddd-8ddd-dddddddddddd',[bound]).pool,req('GET'),'/characters');
 assert.deepEqual(unrelated.body,[]);
});
test('normal member cannot create a character or edit bound sheet',async()=>{
 const m=mock('member',Alice,[bound]);
 assert.equal((await characterRoute(m.pool,req('POST',{name:'Test'}),'/characters')).status,403);
 assert.equal((await characterRoute(m.pool,req('PUT',{name:'Change',notes:'leak'}),'/characters/'+Char)).status,403);
 assert.equal(m.writes.length,0);
});
test('command cannot directly bind a linked player without consent',async()=>{
 const m=mock('domina',Bob,[bound]);
 const r=await characterRoute(m.pool,req('POST',{name:'Linked',collar_bound:true,player_user_id:Alice}),'/characters');
 assert.equal(r.status,403);
 assert.equal(m.writes.length,0);
});
test('sheet save does not allow collar, player or handler mutation',async()=>{
 const m=mock('domina',Bob,[bound]);
 const r=await characterRoute(m.pool,req('PUT',{name:'Renamed',collar_bound:false,player_user_id:Bob,rank:'Unbound: Free',notes:'updated'}),'/characters/'+Char);
 assert.equal(r.status,200);
 const saved=JSON.parse(m.writes[0].values[1]);
 assert.equal(saved.notes,'updated');
 assert.equal(saved.name,'Renamed');
 assert.equal(saved.collar_bound,undefined);
 assert.equal(saved.player_user_id,undefined);
});
