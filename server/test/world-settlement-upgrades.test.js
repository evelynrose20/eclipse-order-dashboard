import test from 'node:test';
import assert from 'node:assert/strict';
import {upgradeEffects,housingCapacity} from '../src/world-settlement-upgrades.js';
const housing={category:'housing',status:'operational',housing_bonus:25,service_bonus:0,defense_bonus:0,condition_pct:100};
const wall={category:'defense',status:'operational',housing_bonus:0,service_bonus:0,defense_bonus:30,condition_pct:100};
test('only effective completed structures add housing and defenses',()=>{
 const u=[housing,wall,{...housing,status:'planned'}, {...wall,status:'destroyed'}];
 const effects=upgradeEffects(u);
 assert.equal(effects.housing_bonus,25);
 assert.equal(effects.defense_bonus,30);
 assert.equal(housingCapacity({housing_capacity:10},u),35);
});
test('damaged facilities have reduced benefits and unfinished homes do not house people',()=>{
 const u=[{...housing,status:'damaged',condition_pct:50},{...wall,status:'building'}];
 assert.equal(housingCapacity({housing_capacity:0},u),6);
 assert.equal(upgradeEffects(u).defense_bonus,0);
});
