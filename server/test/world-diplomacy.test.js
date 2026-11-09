import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {readFileSync} from 'node:fs';
import {canGenerateNpcProposal,protectedOutcomeAllowed,worldDiplomacyRoute} from '../src/world-diplomacy.js';
const actor={id:'00000000-0000-0000-0000-000000000001',account_role:'domina'};
const request=(method,body)=>Object.assign(Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]),{method});
test('only NPC factions with high tension, low trust, and valid preset defender locations qualify',()=>{
 const attacker={id:'a-faction',faction_scope:'world'},defender={id:'b-faction',faction_scope:'settlement'};
 const target={id:17,controlling_faction_id:defender.id};
 const base={attacker,defender,target,tension:82,trust:19};
 assert.equal(canGenerateNpcProposal(base),true);
 assert.equal(canGenerateNpcProposal({...base,tension:59}),false);
 assert.equal(canGenerateNpcProposal({...base,trust:55}),false);
 assert.equal(canGenerateNpcProposal({...base,protection:'all_conflict'}),false);
 assert.equal(canGenerateNpcProposal({...base,attacker:{id:'eclipse-order',faction_scope:'world'}}),false);
 assert.equal(canGenerateNpcProposal({...base,target:{...target,controlling_faction_id:'other'}}),false);
});
test('plot-protected ownership requires a distinct explicit override',()=>{
 assert.equal(protectedOutcomeAllowed(null,false),true);
 assert.equal(protectedOutcomeAllowed('major_changes',false),false);
 assert.equal(protectedOutcomeAllowed('all_conflict',false),false);
 assert.equal(protectedOutcomeAllowed('all_conflict',true),true);
});
test('non-command user cannot access or approve war actions',async()=>{
 const db={execute:async()=>{throw Error('unexpected database access')}};
 assert.deepEqual(await worldDiplomacyRoute(db,request('GET'),'/world-admin/diplomacy',{account_role:'member'}),{status:403,body:{error:'command_required'}});
 assert.deepEqual(await worldDiplomacyRoute(db,request('POST',{decision:'approve'}),'/world-admin/diplomacy/proposals/1/review',{account_role:'member'}),{status:403,body:{error:'command_required'}});
});
test('rejecting an incident records a command decision without creating a conflict or changing ownership',async()=>{
 const queries=[];
 const db={
  beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{},
  execute:async(sql,params)=>{
   queries.push({sql,params});
   if(sql.startsWith('SELECT * FROM world_conflict_proposals'))return [[{id:12,attacker_id:'a-faction',defender_id:'b-faction',status:'pending',conflict_kind:'war',target_settlement_id:17}]];
   return [{affectedRows:1}];
  }
 };
 const result=await worldDiplomacyRoute({getConnection:async()=>db},request('POST',{decision:'reject',note:'Reserved for the winter plot'}),'/world-admin/diplomacy/proposals/12/review',actor);
 assert.equal(result.status,200);
 assert.equal(result.body.ownership_changed,false);
 assert.equal(queries.some(q=>q.sql.includes('INSERT INTO world_authorized_conflicts')),false);
 assert.equal(queries.some(q=>q.sql.includes('UPDATE world_settlements')),false);
 assert.equal(queries.some(q=>q.sql.includes('world_conflict_decision_log')),true);
});
test('approving a war only creates authorized conflict and does not alter a settlement',async()=>{
 const queries=[];
 const db={
  beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{},
  execute:async(sql,params)=>{
   queries.push(sql);
   if(sql.startsWith('SELECT * FROM world_conflict_proposals'))return [[{id:42,attacker_id:'a-faction',defender_id:'b-faction',status:'pending',conflict_kind:'war',target_settlement_id:null}]];
   if(sql.includes('INSERT INTO world_authorized_conflicts'))return [{insertId:8}];
   return [{affectedRows:1}];
  }
 };
 const res=await worldDiplomacyRoute({getConnection:async()=>db},request('POST',{decision:'approve',note:'Allow the campaign to start'}),'/world-admin/diplomacy/proposals/42/review',actor);
 assert.equal(res.body.authorized_conflict_id,8);
 assert.equal(res.body.ownership_changed,false);
 assert.equal(queries.some(q=>q.includes('UPDATE world_settlements')),false);
 assert.equal(queries.some(q=>q.includes('INSERT INTO world_authorized_conflicts')),true);
});
test('separate conquest approval requires settlement still held by defending faction',async()=>{
 const queries=[];
 const db={
  beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{},
  execute:async(sql,params)=>{
   queries.push(sql);
   if(sql.startsWith('SELECT * FROM world_conflict_proposals'))return [[{id:15,status:'pending',source_kind:'war_outcome',related_conflict_id:8,conflict_kind:'territory_transfer',target_settlement_id:17}]];
   if(sql.startsWith('SELECT * FROM world_authorized_conflicts'))return [[{id:8,status:'authorized',attacker_id:'a-faction',defender_id:'b-faction'}]];
   if(sql.startsWith('SELECT id,controlling_faction_id FROM world_settlements'))return [[{id:17,controlling_faction_id:'b-faction'}]];
   if(sql.startsWith('SELECT protection FROM world_plot_protection'))return [[{protection:'major_changes'}]];
   return [{affectedRows:1}];
  }
 };
 const res=await worldDiplomacyRoute({getConnection:async()=>db},request('POST',{decision:'approve',note:'',override_plot_protection:false}),'/world-admin/diplomacy/outcomes/15/review',actor);
 assert.equal(res.status,409);
 assert.equal(res.body.error,'plot_protection_requires_explicit_override');
 assert.equal(queries.some(q=>q.includes('UPDATE world_settlements')),false);
});
test('migration adds no world settlements, economy rewrites or automatic war triggers',()=>{
 const sql=readFileSync(new URL('../sql/081_world_diplomacy_approvals.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS world_conflict_proposals/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS world_authorized_conflicts/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS world_plot_protection/);
 assert.doesNotMatch(sql,/DROP TABLE|TRIGGER|UPDATE world_settlements|INSERT INTO world_settlements/i);
});
