import test from 'node:test';
import assert from 'node:assert/strict';
import {senateResult} from '../src/senate.js';
test('Senate counts abstentions toward quorum but not approval',()=>{
 assert.deepEqual(senateResult(['yes','abstain','no'],5,3),{yes:1,no:1,abstain:1,participated:3,electorate:5,quorum_required:3,quorum_met:true,passed:false});
});
test('Senate requires quorum and a strict affirmative majority',()=>{
 assert.equal(senateResult(['yes','yes'],7,4).passed,false);
 assert.equal(senateResult(['yes','yes','no','abstain'],7,4).passed,true);
 assert.equal(senateResult(['yes','yes','no','no'],7,4).passed,false);
});
test('Senate disabled by default in additive SQL',async()=>{
 const {readFile}=await import('node:fs/promises');
 const sql=await readFile(new URL('../sql/033_optional_senate.sql',import.meta.url),'utf8');
 assert.match(sql,/INSERT IGNORE INTO order_senate_settings\(id,enabled,quorum_percent\) VALUES\(1,0,50\)/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS order_senate_electorate/);
});
