import test from 'node:test';
import assert from 'node:assert/strict';
import {reputationLabel,factionRoute} from '../src/factions.js';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../sql/018_faction_reputation.sql',import.meta.url),'utf8');
const memberId='11111111-1111-4111-8111-111111111111';
const targetId='22222222-2222-4222-8222-222222222222';
const token='x'.repeat(48);
const req=body=>({method:'POST',headers:{authorization:'Bearer '+token},[Symbol.asyncIterator]:async function*(){yield Buffer.from(JSON.stringify(body))}});
const sample={target:'faction_view',delta:15,event_title:'Peace negotiations',event_details:'A treaty was offered.',account_id:null};
function mock(role='domina',initial=94){
 const record={score:initial},writes=[],ledger=[];
 const conn={
  beginTransaction:async()=>writes.push('begin'),
  commit:async()=>writes.push('commit'),
  rollback:async()=>writes.push('rollback'),
  release:()=>{},
  execute:async(q,args)=>{
   if(q.startsWith('SELECT id FROM order_factions'))return [[{id:'house-kurogane'}]];
   if(q.startsWith('SELECT id FROM accounts'))return [[{id:targetId}]];
   if(q.startsWith('SELECT id FROM order_encounters'))return [[{id:'33333333-3333-4333-8333-333333333333'}]];
   if(q.startsWith('INSERT IGNORE'))return [{affectedRows:0}];
   if(q.startsWith('SELECT ')&&q.includes(' AS score'))return [[{score:record.score}]];
   if(q.startsWith('UPDATE ')){record.score=args[0];return [{affectedRows:1}]}
   if(q.startsWith('INSERT INTO faction_reputation_changes')){ledger.push(args);return [{insertId:9}]}
   throw Error('Unexpected SQL '+q);
  }
 };
 return {pool:{execute:async q=>{
  if(q.startsWith('SELECT a.id,a.email'))return [[{id:memberId,account_role:role,auth_method:'discord',discord_user_id:'123456789012345678'}]];
  throw Error('Unexpected session query '+q);
 },getConnection:async()=>conn},record,writes,ledger};
}
test('reputation schema provides independent values and history with no drop',()=>{
 for(const table of ['order_faction_reputation','player_faction_reputation','faction_reputation_changes'])assert.match(sql,new RegExp('CREATE TABLE IF NOT EXISTS '+table));
 assert.match(sql,/CHECK \(order_view BETWEEN -100 AND 100\)/);
 assert.doesNotMatch(sql,/\bDROP TABLE\b|\bTRUNCATE\b/);
});
test('tier labels have predictable and inclusive boundaries',()=>{
 assert.equal(reputationLabel(-100),'Nemesis');
 assert.equal(reputationLabel(0),'Neutral');
 assert.equal(reputationLabel(100),'Exalted');
});
test('diplomatic event applies bounded delta and records actual difference',async()=>{
 const db=mock('domina',94);
 const result=await factionRoute(db.pool,req(sample),'/factions/house-kurogane/reputation');
 assert.equal(result.status,200);
 assert.equal(result.body.score,100);
 assert.equal(result.body.applied_delta,6);
 assert.equal(db.record.score,100);
 assert.equal(db.ledger.length,1);
 assert.equal(db.ledger[0][3],15);
 assert.equal(db.ledger[0][4],6);
 assert.deepEqual(db.writes,['begin','commit']);
});
test('member cannot award own standing; invalid deltas are rejected',async()=>{
 const member=mock('member');
 assert.equal((await factionRoute(member.pool,req(sample),'/factions/house-kurogane/reputation')).status,403);
 assert.equal((await factionRoute(mock().pool,req({...sample,delta:1000}),'/factions/house-kurogane/reputation')).status,400);
 assert.equal((await factionRoute(mock().pool,req({...sample,target:'player',account_id:null}),'/factions/house-kurogane/reputation')).status,400);
});
test('personal award targets one account, not all Order members',async()=>{
 const db=mock('high_command',0);
 const response=await factionRoute(db.pool,req({...sample,target:'player',account_id:targetId,delta:-30}),'/factions/house-kurogane/reputation');
 assert.equal(response.status,200);
 assert.equal(db.record.score,-30);
 assert.equal(db.ledger[0][2],targetId);
 assert.equal(db.ledger[0][1],'player');
});
