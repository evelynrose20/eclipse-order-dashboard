import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {commerceRoute} from '../src/commerce.js';

const schema=readFileSync(new URL('../sql/026_trade_and_equipment.sql',import.meta.url),'utf8');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const char='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const request=(method,body)=>({method,headers:{authorization:'Bearer '+ 'x'.repeat(48)},[Symbol.asyncIterator]:async function*(){if(body)yield Buffer.from(JSON.stringify(body))}});
const pool=role=>({execute:async(sql)=>{
 if(sql.startsWith('SELECT a.id,a.email'))return [[{id,account_role:role,auth_method:'discord',discord_user_id:'123456789012345678'}]];
 throw Error('Unexpected SQL: '+sql);
}});
test('commerce migration preserves shared inventory with unique equipment ownership and trade history',()=>{
 for(const table of ['fc_equipment_templates','fc_equipment_ingredients','character_equipment_items','fc_trade_contracts','fc_trade_deliveries'])assert.match(schema,new RegExp('CREATE TABLE IF NOT EXISTS '+table));
 assert.match(schema,/faction_id VARCHAR/);
 assert.match(schema,/fk_trade_faction/);
 assert.doesNotMatch(schema,/\bDROP TABLE\b|\bTRUNCATE\b/i);
});
test('members cannot create equipment templates or trade contracts',async()=>{
 const user=pool('member');
 const blueprint=await commerceRoute(user,request('POST',{id:'test',name:'Test',description:'',slot:'weapon'}),'/commerce/templates');
 assert.equal(blueprint.status,403);
 const trade=await commerceRoute(user,request('POST',{faction_id:'test',title:'Test'}),'/commerce/contracts');
 assert.equal(trade.status,403);
});
test('invalid trade and item changes reject before accessing mutable stock',async()=>{
 const user=pool('member');
 const craft=await commerceRoute(user,request('POST',{template_id:'invalid id',character_id:char}),'/commerce/craft');
 assert.equal(craft.status,400);
 const equip=await commerceRoute(user,request('POST',{equipped:'yes'}),'/commerce/characters/'+char+'/equipment/1/equip');
 assert.equal(equip.status,400);
 const delivery=await commerceRoute(user,request('POST',{character_id:'invalid',quantity:1}),'/commerce/contracts/1/deliver');
 assert.equal(delivery.status,400);
});
