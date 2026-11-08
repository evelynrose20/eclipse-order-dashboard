import test from 'node:test';
import assert from 'node:assert/strict';
import {npcIndustryDevelopment} from '../src/world-npc-economy.js';
test('NPC development cannot appear from population or idle factories',()=>{
 assert.equal(npcIndustryDevelopment([]),0);
 assert.equal(npcIndustryDevelopment([{operations:0}]),0);
});
test('actual completed production funds limited NPC development',()=>{
 assert.equal(npcIndustryDevelopment([{operations:4}]),1);
 assert.equal(npcIndustryDevelopment([{operations:40}]),10);
 assert.equal(npcIndustryDevelopment([{operations:10000},{operations:8}]),12);
});
test('negative or invalid production never adds points',()=>{
 assert.equal(npcIndustryDevelopment([{operations:-1},{operations:'unknown'}]),0);
});
