import test from 'node:test';
import assert from 'node:assert/strict';
import {economyRoute} from '../src/economy.js';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const stranger='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const char='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
function req(method,body){
 return {method,headers:{authorization:'Bearer '+('T'.repeat(48))},
  [Symbol.asyncIterator]:async function*(){if(body)yield Buffer.from(JSON.stringify(body))}};
}
function mock(actor,{bound=false,rank=null}={}){
 const executed=[];
 const pool={execute:async(sql,args)=>{
  executed.push({sql,args});
  if(sql.startsWith('SELECT a.id'))return [[{id:actor,account_role:'member'}]];
  if(sql.startsWith('SELECT id,player_account_id'))return [[{
   id:char,player_account_id:owner,handler_account_id:null,collar_bound:bound?1:0,bound_rank:rank,character_name:'Test'
  }]];
  if(sql.startsWith('SELECT balance'))return [[{balance:2500}]];
  if(sql.startsWith('SELECT i.item_id')||sql.startsWith('SELECT id,event_type')||sql.startsWith('SELECT week_start'))return [[]];
  return [[]];
 }};
 return {pool,executed};
}
test('unrelated members cannot view or purchase on a character wallet',async()=>{
 const {pool,executed}=mock(stranger);
 const result=await economyRoute(pool,req('GET'),'/economy/characters/'+char);
 assert.equal(result.status,404);
 assert.equal(executed.some(x=>x.sql.startsWith('SELECT balance')),false);
});
test('bound owner receives only ration allowance, never wallet details',async()=>{
 const {pool,executed}=mock(owner,{bound:true,rank:'rank_i'});
 const result=await economyRoute(pool,req('GET'),'/economy/characters/'+char);
 assert.equal(result.status,200);
 assert.equal(result.body.restricted,true);
 assert.equal(result.body.balance,undefined);
 assert.equal(result.body.rank,1);
 assert.equal(executed.some(x=>x.sql.startsWith('SELECT balance')),false);
});
test('bound owner cannot buy from private wallet',async()=>{
 const {pool}=mock(owner,{bound:true,rank:'rank_i'});
 const result=await economyRoute(pool,req('POST',{item_id:'iron_collar',quantity:1}),'/economy/characters/'+char+'/buy');
 assert.equal(result.status,403);
});
test('free owner cannot claim bound-only daily rations',async()=>{
 const {pool}=mock(owner);
 const result=await economyRoute(pool,req('POST',{}),'/economy/characters/'+char+'/ration');
 assert.equal(result.status,403);
});
