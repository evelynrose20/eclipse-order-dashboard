import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../sql/072_garlean_equipment_and_train_consists.sql',import.meta.url),'utf8');

test('Garlean migration uses MariaDB-compatible additive capacity constraints',()=>{
 assert.doesNotMatch(sql,/\bDROP\s+CHECK\b/i,'MariaDB rejects ALTER TABLE ... DROP CHECK');
 assert.match(sql,/ADD\s+CONSTRAINT\s+chk_magitek_wagons\s+CHECK\s*\(\s*max_wagons\s*<=\s*100\s*\)/i);
 assert.match(sql,/information_schema\.table_constraints/i,'Check existence before adding a rerunnable constraint');
 assert.match(sql,/constraint_name='chk_magitek_wagons'/i);
 assert.doesNotMatch(sql,/DROP\s+CONSTRAINT\s+chk_magitek_capacity/i,'Original capacity protection must remain');
});

test('Garlean migration continues to record completion after seeding',()=>{
 assert.match(sql,/INSERT\s+INTO\s+schema_migrations\s*\(version\)\s*VALUES\s*\('072_garlean_equipment_and_train_consists'\)/i);
 assert.match(sql,/ON\s+DUPLICATE\s+KEY\s+UPDATE/i);
});
