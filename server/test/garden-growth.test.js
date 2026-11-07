import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {advanceGardenGrowth} from '../src/crafting.js';
test('garden growth is a single durable atomic update with six-hour intervals',async()=>{
 const statements=[];
 await advanceGardenGrowth({execute:async(sql,args)=>{statements.push([sql,args]);return [[]]}},2);
 assert.equal(statements.length,1);
 assert.match(statements[0][0],/UPDATE fc_garden_plots SET growth=LEAST\(100/);
 assert.match(statements[0][0],/TIMESTAMPDIFF\(MINUTE,last_growth_at,UTC_TIMESTAMP\(\)\) DIV 360/);
 assert.deepEqual(statements[0][1],[2]);
});
test('garden growth migration keeps existing crop state and runs again safely',async()=>{
 const sql=await readFile(new URL('../sql/035_garden_growth_clock.sql',import.meta.url),'utf8');
 assert.match(sql,/information_schema.COLUMNS/);
 assert.match(sql,/UPDATE fc_garden_plots SET last_growth_at=UTC_TIMESTAMP\(\) WHERE last_growth_at IS NULL/);
 assert.doesNotMatch(sql,/TRUNCATE|DROP TABLE|DELETE FROM fc_garden_plots/i);
});
