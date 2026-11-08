import test from 'node:test';
import assert from 'node:assert/strict';
import {settlementOwnership,simulationCycleKey,npcSupplyCycle,npcProjectChoice,npcEverydayStory} from '../src/world-settlement-simulation.js';

test('ownership never treats unclaimed or Order settlements as NPC sites',()=>{
 assert.equal(settlementOwnership({controlling_faction_id:'eclipse-order'}),'order');
 assert.equal(settlementOwnership({controlling_faction_id:'house-kurogane'}),'npc');
 assert.equal(settlementOwnership({controlling_faction_id:null}),'unclaimed');
});
test('cycle keys are stable within frequency buckets and roll over correctly',()=>{
 assert.equal(simulationCycleKey('2026-11-08T09:01:00Z'),simulationCycleKey('2026-11-08T23:59:00Z'));
 assert.notEqual(simulationCycleKey('2026-11-08T01:00:00Z','fast'),simulationCycleKey('2026-11-08T06:00:00Z','fast'));
 assert.equal(simulationCycleKey('2026-11-08T06:00:00Z','fast'),simulationCycleKey('2026-11-08T11:59:00Z','fast'));
});
test('NPCs with no residents do not consume supplies or generate resources',()=>{
 const cycle=npcSupplyCycle({population:0,workforce:0,food_units:10,water_units:5,fuel_units:2,medicine_units:1,temperature_f:-30});
 assert.deepEqual(cycle.consumption,{food:0,water:0,fuel:0,medicine:0});
 assert.deepEqual(cycle.production,{food:0,water:0,fuel:0,medicine:0});
 assert.deepEqual(cycle.shortages,[]);
 assert.equal(cycle.next.food,10);
});
test('NPC village requires housing expansion before its population can grow further',()=>{
 assert.equal(npcProjectChoice({population:20,housing_capacity:20,security_score:90,medical_access:90,food_access:90,housing:90},null),'housing');
 assert.equal(npcProjectChoice({population:20,housing_capacity:50,security_score:20,medical_access:90,food_access:90,housing:90},null),'defenses');
});

test('NPC community stories are deterministic and never invent violent political outcomes',()=>{
 const site={id:12,population:75};
 const a=npcEverydayStory(site,'2026-11-08',16);
 const b=npcEverydayStory(site,'2026-11-08',16);
 assert.deepEqual(a,b);
 assert.ok(['routine','community'].includes(a.event));
 assert.deepEqual(npcEverydayStory({...site,population:0},'2026-11-08',-20).event,'idle');
});
