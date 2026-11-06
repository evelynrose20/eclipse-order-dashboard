import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {wildernessEligible,craftingRoute} from '../src/crafting.js';

const schema=readFileSync(new URL('../sql/020_fc_crafting_garden.sql',import.meta.url),'utf8');
const account='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const char='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const req=(method='GET',body)=>({method,headers:{authorization:'Bearer '+ 'x'.repeat(48)},[Symbol.asyncIterator]:async function*(){if(body)yield Buffer.from(JSON.stringify(body))}});
test('shared workshop schema has transaction ledger, recipes, crops and unique daily care',()=>{
 for(const table of ['fc_materials','fc_material_stock','fc_material_ledger','fc_recipes','fc_recipe_inputs','fc_garden','fc_garden_plots','fc_garden_care'])assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS '+table));
 assert.match(schema,/PRIMARY KEY\(plot_id,account_id,care_date\)/);
 assert.doesNotMatch(schema,/\bDROP TABLE\b|\bTRUNCATE\b/);
});
test('wilderness eligibility is enforced for bound characters at Eclipse Attendant',()=>{
 assert.equal(wildernessEligible({collar_bound:0}),true);
 assert.equal(wildernessEligible({collar_bound:1,servitude_rank:'bound_serpent'}),false);
 assert.equal(wildernessEligible({collar_bound:1,servitude_rank:'eclipse_attendant'}),true);
 assert.equal(wildernessEligible({collar_bound:1,servitude_rank:'silken_thrall'}),true);
 assert.equal(wildernessEligible({collar_bound:1,servitude_rank:null}),false);
});
const member=role=>({
 execute:async sql=>{
  if(sql.startsWith('SELECT a.id,a.email'))return [[{id:account,account_role:role,auth_method:'discord',discord_user_id:'123456789012345678'}]];
  throw Error('Unexpected SQL '+sql);
 }
});
test('unauthenticated and invalid gathering are rejected before materials change',async()=>{
 assert.equal((await craftingRoute({execute:async()=>[[]]},req('POST',{material_id:'iron-ore',quantity:1,character_id:char}),'/workshop/gather')).status,401);
 assert.equal((await craftingRoute(member('member'),req('POST',{material_id:'bad id',character_id:char}),'/workshop/gather')).status,400);
});
test('only command can upgrade the FC garden',async()=>{
 assert.equal((await craftingRoute(member('member'),req('POST',{}),'/workshop/garden/upgrade')).status,403);
});
