import test from 'node:test';
import assert from 'node:assert/strict';
import {selectNpcHome,namedNpcAge,namedNpcAlive,NAMED_NPC_MAX_AGE,findNpcHousing,findNpcEmployment} from '../src/family-npc-housing.js';

const building=(id,capacity,condition=100,status='operational')=>({
 id,category:'housing',status,condition_pct:condition,level:1,housing_bonus:capacity
});
test('independent NPC claims an actual vacant operational home, not free population',()=>{
 const site={population:30,housing_capacity:30};
 const houses=[building(7,5),building(8,2)];
 assert.equal(selectNpcHome(site,houses,new Map(),0),7);
 assert.equal(selectNpcHome({...site,population:37},houses,new Map(),0),null);
 assert.equal(selectNpcHome({...site,population:35},houses,new Map([[7,5]]),5),null);
 assert.equal(selectNpcHome(site,[building(7,10,100,'damaged')],new Map(),0),null);
});
test('one named occupant uses a single building slot and cannot overbook a full home',()=>{
 const site={population:0,housing_capacity:0};
 assert.equal(selectNpcHome(site,[building(3,1)],new Map([[3,1]]),1),null);
 assert.equal(selectNpcHome(site,[building(3,1),building(4,2)],new Map([[3,1]]),1),4);
});
test('named descendants live into their 300s but reach natural end by 350',()=>{
 const today=new Date('2026-11-13T00:00:00Z');
 assert.equal(NAMED_NPC_MAX_AGE,350);
 assert.equal(namedNpcAge('1700-11-14','2020-11-13T00:00:00Z',today),325);
 assert.equal(namedNpcAlive(349),true);
 assert.equal(namedNpcAlive(350),false);
 assert.equal(namedNpcAlive(80),true);
 assert.equal(namedNpcAge(null,'2020-11-13T00:00:00Z',today),24);
});
test('housing search updates named civilian housing only, never settlement population',async()=>{
 const calls=[];
 const db={execute:async(sql,args=[])=>{
  calls.push({sql,args});
  if(sql.includes('SELECT id,population,housing_capacity FROM world_settlements'))return [[{id:2,population:5,housing_capacity:5}]];
  if(sql.includes("FROM world_settlement_upgrades WHERE settlement_id"))return [[building(3,3)]];
  if(sql.includes('FROM world_named_civilians')&&sql.includes('GROUP BY'))return [[]];
  if(sql.startsWith('UPDATE world_named_civilians'))return [{affectedRows:1}];
  throw Error('unexpected query: '+sql);
 }};
 const result=await findNpcHousing(db,2,42);
 assert.equal(result.assigned,true);
 assert.equal(result.housing_upgrade_id,3);
 assert.ok(!calls.some(x=>/UPDATE world_settlements|INSERT INTO world_settlements/.test(x.sql)));
});

test('independent NPC applies for an existing operational job without inventing workers',async()=>{
 const calls=[];
 const db={execute:async(sql,args=[])=>{
  calls.push({sql,args});
  if(sql.startsWith('SELECT id,workforce FROM world_settlements'))return [[{id:2,workforce:3}]];
  if(sql.includes('FROM world_named_civilians nc JOIN order_dependents'))return [[]];
  if(sql.includes('FROM world_industry_facilities'))return [[{id:8,workforce:1}]];
  if(sql.startsWith('UPDATE world_named_civilians'))return [{affectedRows:1}];
  throw Error('unexpected '+sql);
 }};
 const result=await findNpcEmployment(db,2,19);
 assert.equal(result.employed,true);
 assert.equal(result.workplace_facility_id,8);
 assert.ok(!calls.some(x=>/UPDATE world_settlements|UPDATE world_industry_facilities/.test(x.sql)));
});
test('named NPC cannot fabricate a job when an existing city has no workforce',async()=>{
 const db={execute:async sql=>{
  if(sql.startsWith('SELECT id,workforce FROM world_settlements'))return [[{id:2,workforce:0}]];
  throw Error('should not assign job');
 }};
 const result=await findNpcEmployment(db,2,20);
 assert.equal(result.employed,false);
 assert.equal(result.reason,'no_local_workforce');
});
