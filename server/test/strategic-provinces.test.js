import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {provinceUpgradeChoice,provinceUpgradeCost,npcProvinceDevelopment} from '../src/world-strategic-provinces.js';

test('province upgrades require increasing industrial development points',()=>{
 assert.equal(provinceUpgradeCost('roads',0),10);
 assert.equal(provinceUpgradeCost('roads',4),50);
 assert.equal(provinceUpgradeCost('rail',0),16);
 assert.equal(provinceUpgradeCost('power',0),12);
 assert.equal(provinceUpgradeCost('roads',5),null);
 assert.equal(provinceUpgradeCost('invented',0),null);
 assert.deepEqual(provinceUpgradeChoice({roads:2,rail:0,fortifications:1,power:3}),{type:'rail',level:0});
 assert.equal(provinceUpgradeChoice({roads:5,rail:5,fortifications:5,power:5}),null);
});
test('NPC province development does not mint resources and checks faction ownership',async()=>{
 let queries=0;
 const db={execute:async(sql,params)=>{
  queries++;
  if(sql.startsWith('SELECT development_points'))return [[{development_points:9}]];
  if(sql.includes('FROM world_strategic_provinces p'))return [[{id:22,roads:0,rail:0,fortifications:0,power:0}]];
  throw new Error('Unexpected write: '+sql);
 }};
 const site={id:11,zone_id:5,controlling_faction_id:'house-kurogane'};
 assert.equal(await npcProvinceDevelopment(db,site,'2026-11-09'),null);
 assert.equal(queries,2);
 queries=0;assert.equal(await npcProvinceDevelopment(db,{...site,controlling_faction_id:'eclipse-order'},'2026-11-09'),null);
 assert.equal(queries,0);
});
test('NPC upgrades debit actual development points and record their owner and cycle',async()=>{
 const statements=[];
 const db={execute:async(sql,params)=>{
  statements.push({sql,params});
  if(sql.startsWith('SELECT development_points'))return [[{development_points:30}]];
  if(sql.includes('FROM world_strategic_provinces p'))return [[{id:22,roads:0,rail:0,fortifications:0,power:0}]];
  if(sql.startsWith('UPDATE world_settlement_autosim'))return [{affectedRows:1}];
  return [{affectedRows:1}];
 }};
 const project=await npcProvinceDevelopment(db,{id:11,zone_id:5,controlling_faction_id:'house-kurogane'},'2026-11-09');
 assert.deepEqual(project,{province_id:22,project_type:'roads',level_after:1,cost:10});
 const debit=statements.find(s=>s.sql.startsWith('UPDATE world_settlement_autosim'));
 assert.deepEqual(debit.params,[10,11,10]);
 const receipt=statements.find(s=>s.sql.startsWith('INSERT INTO world_strategic_province_projects'));
 assert.deepEqual(receipt.params,[22,11,'house-kurogane','roads',1,10,'2026-11-09']);
});
test('province migration is additive to existing blueprints and city-builder systems',()=>{
 const sql=readFileSync(new URL('../sql/076_strategic_provinces.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS world_strategic_provinces/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS world_strategic_province_projects/);
 assert.doesNotMatch(sql,/DROP TABLE|DELETE FROM world_industry_templates|ALTER TABLE world_industry/i);
});
