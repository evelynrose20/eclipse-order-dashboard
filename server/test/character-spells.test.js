import test from 'node:test';
import assert from 'node:assert/strict';
import {characterRoute} from '../src/characters.js';
import {builtinClassCatalog} from '../src/class-catalog.js';

const ALICE='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BOB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CHAR='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const makeRequest=(body)=>({
 method:'POST',headers:{authorization:'Bearer '+('T'.repeat(48))},
 [Symbol.asyncIterator]:async function*(){yield Buffer.from(JSON.stringify(body))}
});
function mock({player=ALICE,bound=0,level=1,points=4,actor=ALICE,activeEncounter=false}={}){
 let sheet={progression_version:1,class_id:'mage',level,spell_points:points,max_spell_points:4};
 const sql=[],audit=[];
 const conn={
  beginTransaction:async()=>{},
  rollback:async()=>{},
  commit:async()=>{},
  release:()=>{},
  query:async()=>[[]],
  execute:async(query,params)=>{
   if(query.includes('FROM characters WHERE id=? FOR UPDATE'))return [[{player_account_id:player,collar_bound:bound,sheet_json:sheet}]];
   if(query.includes('FROM order_combatants c JOIN order_encounters e'))return [activeEncounter?[{id:'active'}]:[]];
   if(query.startsWith('UPDATE characters')){sheet=JSON.parse(params[0]);return [{affectedRows:1}]}
   if(query.startsWith('INSERT INTO audit_log')){audit.push(params);return [{affectedRows:1}]}
   throw Error('Unexpected query: '+query);
  }
 };
 const pool={execute:async(query)=>{
  if(query.startsWith('SELECT a.id'))return [[{id:actor,account_role:'member'}]];
  throw Error('Unexpected session query: '+query)
 },getConnection:async()=>conn};
 return {pool,sql,audit,getSheet:()=>sheet};
}
test('caster can use an unlocked spell and spends points once',async()=>{
 const m=mock();
 const r=await characterRoute(m.pool,makeRequest({spell_id:'arcane-bolt'}),'/characters/'+CHAR+'/cast');
 assert.equal(r.status,200,JSON.stringify(r.body));
 assert.equal(r.body.remaining,3);
 assert.equal(m.getSheet().spell_points,3);
 assert.equal(m.audit.length,1);
});
test('spells above character level cannot be cast',async()=>{
 const m=mock();
 const r=await characterRoute(m.pool,makeRequest({spell_id:'starfall'}),'/characters/'+CHAR+'/cast');
 assert.equal(r.status,403);
 assert.equal(m.getSheet().spell_points,4);
});
test('unlinked staff or unrelated player cannot cast through this endpoint',async()=>{
 const m=mock({actor:BOB});
 const r=await characterRoute(m.pool,makeRequest({spell_id:'arcane-bolt'}),'/characters/'+CHAR+'/cast');
 assert.equal(r.status,403);
 assert.equal(m.audit.length,0);
});
test('bound characters are sealed from player spell controls',async()=>{
 const m=mock({bound:1});
 const r=await characterRoute(m.pool,makeRequest({spell_id:'arcane-bolt'}),'/characters/'+CHAR+'/cast');
 assert.equal(r.status,403);
});
test('long rest requires confirmation and restores spell resources',async()=>{
 const m=mock({points:0});
 const invalid=await characterRoute(m.pool,makeRequest({confirm:false}),'/characters/'+CHAR+'/rest');
 assert.equal(invalid.status,400);
 const valid=await characterRoute(m.pool,makeRequest({confirm:true}),'/characters/'+CHAR+'/rest');
 assert.equal(valid.status,200);
 assert.equal(m.getSheet().spell_points,4);
});
test('builtin definitions include editable class features',()=>{
 const mage=builtinClassCatalog().mage;
 assert.ok(mage.features.some(f=>f.level===3&&f.name==='Arcane Ward'));
});

test('long rest cannot replenish spell points mid-encounter',async()=>{
 const m=mock({points:0,activeEncounter:true});
 const r=await characterRoute(m.pool,makeRequest({confirm:true}),'/characters/'+CHAR+'/rest');
 assert.equal(r.status,409);
 assert.equal(m.getSheet().spell_points,0);
});
