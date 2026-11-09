import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {readFileSync} from 'node:fs';
import {recoveryEligible,recoveryState,isNearbyHolding,recoveryClaimsRoute} from '../src/world-recovery-claims.js';
const actor={id:'00000000-0000-0000-0000-000000000001',account_role:'domina'};
const request=(method,body)=>Object.assign(Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]),{method});
test('unclaimed preset ruins are claimable, enemy holdings require conflict approval',()=>{
 assert.equal(recoveryEligible({controlling_faction_id:null}),true);
 assert.equal(recoveryEligible({controlling_faction_id:'enemy'}),false);
 assert.equal(recoveryState('destroyed'),'rebuilding');
 assert.equal(recoveryState('abandoned'),'rebuilding');
 assert.equal(recoveryState('peaceful'),'secure');
 assert.equal(isNearbyHolding({zone_id:2,map_x:20,map_y:20},{zone_id:2,map_x:35,map_y:33}),true);
 assert.equal(isNearbyHolding({zone_id:3,map_x:20,map_y:20},{zone_id:2,map_x:35,map_y:33}),false);
 assert.equal(isNearbyHolding({zone_id:2,map_x:20,map_y:20},{zone_id:2,map_x:90,map_y:90}),false);
});
test('non-command actor cannot claim or review a location',async()=>{
 const db={getConnection:async()=>{throw Error('unauthorized database access')}};
 const r=await recoveryClaimsRoute(db,request('POST',{decision:'approve'}),'/world-admin/recovery/claims/7/review',{account_role:'member'});
 assert.equal(r.status,403);
});
test('approving a claim changes only control and condition, preserving buildings and stock',async()=>{
 const queries=[];
 const db={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{},
 execute:async(sql,args)=>{
  queries.push({sql,args});
  if(sql.startsWith('SELECT * FROM world_recovery_claims'))return [[{id:7,status:'pending',claimant_id:'new-owner',settlement_id:14}]];
  if(sql.startsWith('SELECT id,controlling_faction_id,strategic_state FROM world_settlements'))return [[{id:14,controlling_faction_id:null,strategic_state:'destroyed'}]];
  if(sql.startsWith('SELECT protection FROM world_plot_protection'))return [[null]];
  return [{affectedRows:1}];
 }};
 const r=await recoveryClaimsRoute({getConnection:async()=>db},request('POST',{decision:'approve',note:'Rebuild the ruins'}),'/world-admin/recovery/claims/7/review',actor);
 assert.equal(r.status,200);
 assert.equal(r.body.ownership_changed,true);
 const update=queries.find(x=>x.sql.startsWith('UPDATE world_settlements'));
 assert.deepEqual(update.args,['new-owner','rebuilding',14]);
 assert.match(update.sql,/controlling_faction_id IS NULL/);
 assert.doesNotMatch(update.sql,/population|workforce|inventory|buildings|housing/);
});
test('approved protection cannot be ignored or overwritten automatically',async()=>{
 const queries=[];
 const db={beginTransaction:async()=>{},commit:async()=>{throw Error('must roll back')},rollback:async()=>{},release:()=>{},
 execute:async(sql)=>{
  queries.push(sql);
  if(sql.startsWith('SELECT * FROM world_recovery_claims'))return [[{id:7,status:'pending',claimant_id:'new-owner',settlement_id:14}]];
  if(sql.startsWith('SELECT id,controlling_faction_id,strategic_state FROM world_settlements'))return [[{id:14,controlling_faction_id:null,strategic_state:'destroyed'}]];
  if(sql.startsWith('SELECT protection FROM world_plot_protection'))return [[{protection:'major_changes'}]];
  throw Error('unexpected mutation: '+sql);
 }};
 const r=await recoveryClaimsRoute({getConnection:async()=>db},request('POST',{decision:'approve',note:''}),'/world-admin/recovery/claims/7/review',actor);
 assert.equal(r.status,409);
 assert.equal(queries.some(x=>x.startsWith('UPDATE world_settlements')),false);
});
test('recovery migration does not auto-create or change authored places',()=>{
 const sql=readFileSync(new URL('../sql/082_npc_recovery_claims.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS world_recovery_claims/);
 assert.doesNotMatch(sql,/DROP TABLE|INSERT INTO world_settlements|UPDATE world_settlements|CREATE TRIGGER/i);
});
