import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const schema=readFileSync(new URL('../server/sql/104_warehouse_blueprints_levels.sql',import.meta.url),'utf8');
const repair=readFileSync(new URL('../server/sql/130_fix_warehouse_food_blueprints.sql',import.meta.url),'utf8');
const setup=readFileSync(new URL('../server/src/setup-local.js',import.meta.url),'utf8');

test('warehouse default recipes select structural iron, not arbitrary supply products',()=>{
 assert.match(schema,/WHERE id='iron-ingot'/);
 assert.doesNotMatch(schema,/category IN \('refined','supply'\) ORDER BY id LIMIT 1/);
});
test('existing mistaken fish-only default construction recipes are repaired narrowly',()=>{
 assert.match(repair,/i\.name='Preserved Fish'/);
 assert.match(repair,/b\.id IN \(1,2,3\)/);
 assert.match(repair,/JSON_LENGTH\(l\.requirements\)=1/);
 assert.match(repair,/w\.state='planned'/);
 assert.match(repair,/SET w\.construction_item_id='iron-ingot'/);
 assert.match(repair,/130_fix_warehouse_food_blueprints/);
 assert.match(setup,/130_fix_warehouse_food_blueprints\.sql/);
});
