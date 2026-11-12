import test from 'node:test';
import assert from 'node:assert/strict';
import {broodStage,breedingPitRoute,eligibleThrallHost} from '../src/breeding-pit.js';

test('incubation progress follows the clock and never exceeds 100 percent',()=>{
 const start='2026-11-12T00:00:00.000Z',end='2026-11-14T00:00:00.000Z';
 assert.deepEqual(broodStage(start,end,'2026-11-11T23:00:00.000Z'),{ready:false,progress:0});
 assert.deepEqual(broodStage(start,end,'2026-11-13T00:00:00.000Z'),{ready:false,progress:50});
 assert.deepEqual(broodStage(start,end,'2026-11-14T00:00:00.000Z'),{ready:true,progress:100});
});
test('Breeding Pit rejects unauthenticated requests before touching the database',async()=>{
 const pool={execute:async()=>{throw new Error('Unexpected database read')}};
 const result=await breedingPitRoute(pool,{headers:{}},'/thralls/breeding-pit');
 assert.equal(result.status,401);
});

test('only bound or servitude-rank characters qualify as brood hosts',()=>{
 assert.equal(eligibleThrallHost({collar_bound:1}),true);
 assert.equal(eligibleThrallHost({collar_bound:0,servitude_rank:1}),true);
 assert.equal(eligibleThrallHost({collar_bound:0,servitude_rank:0}),false);
 assert.equal(eligibleThrallHost(null),false);
});
