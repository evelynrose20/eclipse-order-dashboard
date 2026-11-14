import test from 'node:test';
import assert from 'node:assert/strict';
import {civicRepairEligible} from '../src/world-civic-template-projects.js';

test('damaged and destroyed template-backed civic structures can enter real repair projects',()=>{
 assert.equal(civicRepairEligible('damaged'),true);
 assert.equal(civicRepairEligible('destroyed'),true);
 for(const status of ['operational','building','planned','paused',''])assert.equal(civicRepairEligible(status),false);
});
