import test from 'node:test';
import assert from 'node:assert/strict';
import {powerGrade,powerRate} from '../src/world-power.js';

test('power quality gates production by output and generator health',()=>{
 assert.equal(powerGrade(0,100,100),'outage');
 assert.equal(powerGrade(40,100,32),'low');
 assert.equal(powerGrade(80,100,70),'good');
 assert.equal(powerGrade(150,100,95),'perfect');
 assert.equal(powerGrade(200,100,45),'low','damaged plants do not count as high-quality power');
});
test('power states drive the requested extraction output',()=>{
 assert.deepEqual(powerRate('low'),{amount:0,interval_ms:30000});
 assert.deepEqual(powerRate('outage'),{amount:0,interval_ms:30000});
 assert.deepEqual(powerRate('good'),{amount:.2,interval_ms:30000});
 assert.deepEqual(powerRate('perfect'),{amount:.5,interval_ms:25000});
 assert.deepEqual(powerRate('legacy'),{amount:.1,interval_ms:30000});
});
