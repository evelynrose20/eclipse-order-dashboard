import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {calculateCouncilOutcome} from '../src/governance-live.js';
test('ordinary Council motion needs quorum and a yes majority',()=>{
 assert.equal(calculateCouncilOutcome('ordinary',['yes','yes'],3,4).passed,false);
 assert.equal(calculateCouncilOutcome('ordinary',['yes','yes','no'],3,4).passed,true);
 assert.equal(calculateCouncilOutcome('ordinary',['yes','no','abstain'],3,4).passed,false);
});
test('major and reserved motions keep the founding-seat threshold',()=>{
 assert.equal(calculateCouncilOutcome('major',['yes','yes','yes','abstain'],3,4).passed,false);
 assert.equal(calculateCouncilOutcome('major',['yes','yes','yes','yes'],3,4).passed,true);
 assert.equal(calculateCouncilOutcome('reserved',['yes','yes','yes','yes'],3,4).passed,true);
});
test('live governance migration is additive and charter can be revised',async()=>{
 const sql=await readFile(new URL('../sql/034_live_governance.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS order_governance_charter/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS order_council_motions/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS order_governance_charter_history/);
 assert.match(sql,/INSERT IGNORE INTO order_governance_charter/);
 assert.doesNotMatch(sql,/DROP TABLE|TRUNCATE TABLE/i);
});
