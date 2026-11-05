import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const schema=readFileSync(new URL('../sql/001_core.sql',import.meta.url),'utf8');
test('core schema creates all foundational tables without deleting existing data',()=>{
 for(const name of ['schema_migrations','accounts','characters','character_status_requests','audit_log']){
  assert.match(schema,new RegExp('CREATE TABLE IF NOT EXISTS '+name+'\\s*\\(','i'));
 }
 assert.doesNotMatch(schema,/\bDROP\s+(TABLE|DATABASE)\b/i);
 assert.doesNotMatch(schema,/\bTRUNCATE\b/i);
});
test('bound character status is separate from account permissions and standing',()=>{
 assert.match(schema,/account_role ENUM\('domina','high_command','handler','member'\)/);
 assert.match(schema,/standing ENUM\('initiate','associate','established','veteran'\)/);
 assert.match(schema,/collar_bound TINYINT\(1\)/);
 assert.match(schema,/bound_rank ENUM\('rank_i','rank_ii','rank_iii','rank_iv'\)/);
 assert.match(schema,/CHECK \(\s*\(collar_bound = 0 AND bound_rank IS NULL\)/);
});
test('schema records approval and audit foundations without plaintext demo passwords',()=>{
 assert.match(schema,/password_hash VARCHAR\(255\) NOT NULL/);
 assert.match(schema,/target_bound TINYINT\(1\) NOT NULL/);
 assert.match(schema,/state ENUM\('pending','approved','declined','cancelled','applied'\)/);
 assert.match(schema,/INSERT INTO schema_migrations/);
 assert.doesNotMatch(schema,/INSERT INTO accounts/i);
});
