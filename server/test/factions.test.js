import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {factionRoute} from '../src/factions.js';

const schema=readFileSync(new URL('../sql/017_factions.sql',import.meta.url),'utf8');
const request=(method='GET',body)=>({method,headers:{authorization:'Bearer '+('x'.repeat(48))},[Symbol.asyncIterator]:async function*(){if(body!==undefined)yield Buffer.from(JSON.stringify(body))}});
function setup(role='member'){
 const updates=[],queries=[];
 const pool={
  execute:async(sql,args=[])=>{
   queries.push(sql);
   if(sql.startsWith('SELECT a.id,a.email'))return [[{id:'11111111-1111-4111-8111-111111111111',account_role:role,auth_method:'discord',discord_user_id:'123456789012345678'}]];
   if(sql.startsWith('SELECT public_visible FROM order_factions'))return [[{public_visible:1}]];
   if(sql.startsWith('SELECT id,title,details'))return [[{id:1,title:'A renewed pact',details:'Terms discussed.',occurred_on:null,created_at:'2026-11-06'}]];
   if(sql.startsWith('SELECT id FROM order_factions'))return [[{id:'house-kurogane'}]];
   if(sql.startsWith('UPDATE order_factions')){updates.push({sql,args});return [{affectedRows:1}]}
   if(sql.startsWith('INSERT INTO order_faction_events')){updates.push({sql,args});return [{insertId:4}]}
   throw Error('Unexpected SQL: '+sql);
  },
  query:async(sql)=>{
   queries.push(sql);
   if(sql.startsWith('SELECT f.id,f.name'))return [[{id:'house-kurogane',name:'House of Kurogane',leader:'Lady Reika Kurogane',relationship:'friendly',description:'Trade allies',notes:'Private negotiations',public_visible:1,sort_order:10,faction_scope:'order_story',trade_enabled:1,map_color:'#688398',order_view:45,faction_view:40,personal_reputation:0}]];
   throw Error('Unexpected query: '+sql);
  }
 };
 return {pool,updates,queries};
}
test('faction migration defines persistent seed lore, relation types and no destructive changes',()=>{
 for(const name of ['order_factions','order_faction_events'])assert.match(schema,new RegExp('CREATE TABLE IF NOT EXISTS '+name));
 for(const name of ['House of Kurogane','Crimson Lotus Society','The Iron Remnant','Blackthorn Consortium','The Ashen Veil'])assert.ok(schema.includes(name));
 assert.doesNotMatch(schema,/\b(DROP TABLE|TRUNCATE)\b/i);
});
test('public member directory omits private command notes',async()=>{
 const {pool}=setup();
 const response=await factionRoute(pool,request(),'/factions');
 assert.equal(response.status,200);
 assert.equal(response.body.factions[0].leader,'Lady Reika Kurogane');
 assert.equal(response.body.factions[0].notes,'');
});
test('ordinary members cannot edit faction diplomacy or post history',async()=>{
 const {pool}=setup();
 const body={name:'House of Kurogane',leader:'Lady Reika Kurogane',relationship:'friendly',description:'Trade allies',notes:'',image_reference_url:'',public_visible:true,sort_order:10,faction_scope:'order_story',trade_enabled:true,map_color:'#688398'};
 assert.equal((await factionRoute(pool,request('PUT',body),'/factions/house-kurogane')).status,403);
 assert.equal((await factionRoute(pool,request('POST',{title:'Test',details:'Test',occurred_on:null}),'/factions/house-kurogane/events')).status,403);
});
test('command can update relationships and append recorded history',async()=>{
 const {pool,updates}=setup('domina');
 const body={name:'House of Kurogane',leader:'Lady Reika Kurogane',relationship:'rival',description:'Agreements under strain',notes:'Private',image_reference_url:'',public_visible:true,sort_order:10,faction_scope:'order_story'};
 assert.equal((await factionRoute(pool,request('PUT',body),'/factions/house-kurogane')).status,200);
 assert.equal((await factionRoute(pool,request('POST',{title:'Negotiations',details:'New trade terms',occurred_on:'2026-11-06'}),'/factions/house-kurogane/events')).status,201);
 assert.equal(updates.length,2);
 assert.equal(updates[0].args[2],'rival');
});
test('invalid faction relationships and unsafe portrait URLs are rejected',async()=>{
 const {pool}=setup('domina');
 const body={name:'Test',leader:'Leader',relationship:'friendly',description:'Description',notes:'',image_reference_url:'javascript:alert(1)',public_visible:true,sort_order:10,trade_enabled:true,map_color:'#688398'};
 assert.equal((await factionRoute(pool,request('PUT',body),'/factions/house-kurogane')).status,400);
 body.image_reference_url='';
 body.relationship='all-powerful';
 assert.equal((await factionRoute(pool,request('PUT',body),'/factions/house-kurogane')).status,400);
});
