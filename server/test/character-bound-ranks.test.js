import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {characterRoute} from '../src/characters.js';
import {SERVITUDE_RANKS} from '../../src/servitudeRanks.js';

const hierarchy=readFileSync(new URL('../sql/016_order_hierarchy.sql',import.meta.url),'utf8');
const actor='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const character='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const req=(method,body)=>({method,headers:{authorization:'Bearer '+ 'z'.repeat(48)},[Symbol.asyncIterator]:async function*(){if(body)yield Buffer.from(JSON.stringify(body))}});
const codes=['unmarked','marked_thrall','bound_serpent','eclipse_attendant','silken_thrall','violet_keeper','serpents_chosen','eclipsed_consort'];

test('public eight ranks agree with seeded servitude catalog',()=>{
 assert.equal(SERVITUDE_RANKS.length,8);
 for(let i=0;i<codes.length;i++)assert.match(hierarchy,new RegExp("\\('"+codes[i]+"','servitude','"+SERVITUDE_RANKS[i].replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')+"',"+(i+1)+"\\)"));
});
test('only command may assign any official bound rank, preserving old enum rank',async()=>{
 const writes=[];
 const sheet={name:'Test Bound',rank:'Rank IV: Elite / Favor of the Domina',notes:'unchanged'};
 const make=role=>{
  const conn={
   beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{},
   execute:async(sql,args)=>{
    if(sql.startsWith('SELECT code,title FROM order_rank_catalog'))return [[{code:args[0],title:'Eclipsed Consort'}]];
    if(sql.startsWith('SELECT collar_bound,sheet_json'))return [[{collar_bound:1,sheet_json:sheet}]];
    if(sql.startsWith('INSERT INTO character_order_ranks')||sql.startsWith('UPDATE characters SET sheet_json')||sql.startsWith('INSERT INTO audit_log')){writes.push({sql,args});return [{affectedRows:1}]}
    throw Error('Unexpected query '+sql)
   }
  };
  return {execute:async(sql)=>sql.startsWith('SELECT a.id')?[[{id:actor,account_role:role}]]:[[]],getConnection:async()=>conn};
 };
 const blocked=await characterRoute(make('member'),req('POST',{rank:'eclipsed_consort'}),'/characters/'+character+'/rank');
 assert.equal(blocked.status,403);
 const result=await characterRoute(make('domina'),req('POST',{rank:'eclipsed_consort'}),'/characters/'+character+'/rank');
 assert.equal(result.status,200);
 assert.equal(result.body.rank,'Eclipsed Consort');
 assert.ok(writes.some(x=>x.sql.startsWith('INSERT INTO character_order_ranks')));
 const saved=JSON.parse(writes.find(x=>x.sql.startsWith('UPDATE characters SET sheet_json')).args[0]);
 assert.equal(saved.notes,'unchanged');
 assert.equal(saved.rank,'Eclipsed Consort');
 assert.ok(!writes.some(x=>x.sql.includes('bound_rank=?')),'do not mutate legacy four-value enum');
});
test('bound transitions start at Unmarked and clear the canonical assignment on release',()=>{
 const transitions=readFileSync(new URL('../src/transitions.js',import.meta.url),'utf8');
 assert.match(transitions,/data.rank=r.target_bound\?'Unmarked'/);
 assert.match(transitions,/INSERT INTO character_order_ranks/);
 assert.match(transitions,/DELETE FROM character_order_ranks/);
});
