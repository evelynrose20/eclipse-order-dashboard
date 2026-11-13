import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceStimulation,validStimulationLabel} from '../src/chamber-stimulation.js';

test('stimulation meter charges only while powered assembly channels are active',()=>{
 const now='2026-11-13T12:02:00.000Z',last='2026-11-13 12:00:00.000';
 assert.equal(advanceStimulation(10,last,now,0).points,10);
 assert.equal(advanceStimulation(10,last,now,1).points,18);
 assert.equal(advanceStimulation(10,last,now,2).points,26);
});
test('stimulation meter caps at 100 without triggering an action',()=>{
 const result=advanceStimulation(98,'2026-11-13 12:00:00.000','2026-11-13T12:02:00Z',2);
 assert.equal(result.points,100);
 assert.equal(result.ticks,4);
});
test('stimulation meter first read rebases clock without backfilling',()=>{
 const result=advanceStimulation(25,null,'2026-11-13T12:00:00Z',2);
 assert.equal(result.points,25);
 assert.equal(result.ticks,0);
 assert.equal(result.lastAt,'2026-11-13 12:00:00.000');
});
test('stimulation interface labels are editable but validated',()=>{
 assert.equal(validStimulationLabel('Stimulation'),true);
 assert.equal(validStimulationLabel('Activate'),true);
 assert.equal(validStimulationLabel(''),false);
 assert.equal(validStimulationLabel(' '.repeat(4)),false);
 assert.equal(validStimulationLabel('x'.repeat(65)),false);
 assert.equal(validStimulationLabel('hello\nworld'),false);
});
