import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizedPosition,validateWaymarks,WAYMARK_IDS} from '../src/map-state.js';
test('fractional map positions are bounded and preserve free movement',()=>{
 assert.deepEqual(normalizedPosition(.25123456,.9),{x:.25123,y:.9});
 assert.deepEqual(normalizedPosition(null,null),{x:null,y:null});
 for(const x of [-.01,1.01,Infinity,NaN,'0.4',undefined])assert.equal(normalizedPosition(x,.4),null);
 assert.equal(normalizedPosition(0,null),null);
});
test('waymarks contain only the FFXIV A-D and 1-4 markers and valid positions',()=>{
 assert.deepEqual(WAYMARK_IDS,['A','B','C','D','1','2','3','4']);
 assert.deepEqual(validateWaymarks({A:{x:.25,y:.8},'2':{x:1,y:0},B:null}),{A:{x:.25,y:.8},'2':{x:1,y:0}});
 assert.equal(validateWaymarks({E:{x:0,y:0}}),null);
 assert.equal(validateWaymarks({'1':{x:1.1,y:0}}),null);
 assert.equal(validateWaymarks({A:{x:null,y:null}}),null);
 assert.equal(validateWaymarks([]),null);
});
