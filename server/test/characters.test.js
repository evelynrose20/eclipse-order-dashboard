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

test('normal sheet updates cannot alter job, HP or Armor Class',async()=>{
 const managed={...bound,collar_bound:0,sheet_json:{name:'Hidden Wisp',progression_version:1,class_id:'paladin',class_name:'Paladin',hp:12,max_hp:12,armor_class:12,notes:'old'}};
 const m=mock('domina',Bob,[managed]);
 const result=await characterRoute(m.pool,req('PUT',{name:'Hidden Wisp',hp:999,max_hp:999,armor_class:99,class_id:'zephyr',class_name:'Zephyr',notes:'updated'}),'/characters/'+Char);
 assert.equal(result.status,200);
 const saved=JSON.parse(m.writes[0].values[1]);
 assert.equal(saved.hp,12);assert.equal(saved.max_hp,12);assert.equal(saved.armor_class,12);
 assert.equal(saved.class_id,'paladin');assert.equal(saved.notes,'updated');
});
test('new characters must have first and last names',async()=>{
 const m=mock('domina',Bob,[]);
 const result=await characterRoute(m.pool,req('POST',{name:'Single',class_id:'warrior'}),'/characters');
 assert.equal(result.status,400);
 assert.equal(result.body.error,'first_and_last_name_required');
 assert.equal(m.writes.length,0);
});

test('a character cannot save four trained skills by bypassing the editor',async()=>{
 const m=mock('domina',Bob,[bound]);
 const skills={Acrobatics:true,Arcana:true,Perception:true,Stealth:true};
 const response=await characterRoute(m.pool,req('PUT',{name:'Hidden Wisp',skills}),'/characters/'+Char);
 assert.equal(response.status,400);
 assert.equal(response.body.error,'max_three_skill_proficiencies');
 assert.equal(m.writes.length,0);
 const valid=await characterRoute(m.pool,req('PUT',{name:'Hidden Wisp',skills:{Acrobatics:true,Arcana:true,Perception:true}}),'/characters/'+Char);
 assert.equal(valid.status,200);
 assert.equal(JSON.parse(m.writes[0].values[1]).skills.Stealth,undefined);
});

test('new character is automatically owned by its creator even when another owner is submitted',async()=>{
 const m=mock('domina',Bob,[]);
 const data={name:'New Wisp',class_id:'warrior',str:10,dex:10,con:10,int:10,wis:10,cha:10,player_user_id:Alice,collar_bound:false};
 const response=await characterRoute(m.pool,req('POST',data),'/characters');
 assert.equal(response.status,201,JSON.stringify(response.body));
 const insertion=m.writes.find(w=>w.sql.startsWith('INSERT INTO characters'));
 assert.ok(insertion);
 assert.equal(insertion.values[2],Bob,'the authenticated creator must be the owner');
 assert.equal(insertion.values[4],0,'new characters must begin RP-unbound');
 const sheet=JSON.parse(insertion.values[6]);
 assert.equal(sheet.player_user_id,undefined,'submitted owner IDs cannot persist in the character sheet');
});
test('new character cannot bypass RP binding consent during creation',async()=>{
 const m=mock('domina',Bob,[]);
 const response=await characterRoute(m.pool,req('POST',{
  name:'Bound Wisp',class_id:'warrior',str:10,dex:10,con:10,int:10,wis:10,cha:10,collar_bound:true
 }),'/characters');
 assert.equal(response.status,403);
 assert.equal(response.body.error,'player_approval_required');
 assert.equal(m.writes.length,0);
});
