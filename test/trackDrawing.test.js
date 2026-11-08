import test from 'node:test';
import assert from 'node:assert/strict';
import {simplifyTrackStroke,insertRouteBend} from '../src/track-drawing.js';

test('freehand rail trace keeps endpoints and stays inside 16 editable handles',()=>{
 const points=Array.from({length:120},(_,i)=>({x:i/1.19,y:35+Math.sin(i/11)*16}));
 const result=simplifyTrackStroke(points);
 assert.ok(result.length<=16);
 assert.deepEqual(result[0],points[0]);
 assert.deepEqual(result.at(-1),{x:100,y:Math.round(points.at(-1).y*100)/100});
});
test('freehand simplification rejects non-finite points and clamps map positions',()=>{
 const result=simplifyTrackStroke([{x:-20,y:300},{x:NaN,y:2},{x:20.678,y:21.324}],16);
 assert.deepEqual(result,[{x:0,y:100},{x:20.68,y:21.32}]);
});
test('new track bends insert at nearest local segment instead of always appending',()=>{
 const a={x:0,y:0},b={x:100,y:0},points=[{x:30,y:18},{x:70,y:18}];
 const result=insertRouteBend(points,a,b,{x:50,y:20});
 assert.deepEqual(result,[points[0],{x:50,y:20},points[1]]);
 assert.equal(insertRouteBend(points,a,b,{x:30.1,y:18.1}),points,'near duplicate is ignored');
 assert.equal(insertRouteBend(Array.from({length:16},(_,i)=>({x:i,y:0})),a,b,{x:45,y:12}).length,16);
});
test('track mode preserves original map while exposing click and drag to draw options',async()=>{
 const {readFile}=await import('node:fs/promises');
 const s=await readFile(new URL('../src/WorldTerritoryMap.jsx',import.meta.url),'utf8');
 for(const token of ['Lay track','traceTrack','trackTraceDown','trackTraceMove','trackTraceUp','draftWaypointMove','simplifyTrackStroke','insertRouteBend','Straighten','Reverse','Save railway'])assert.ok(s.includes(token),token);
 assert.ok(s.includes("route_type:mode==='track'?'rail':routeType"));
 assert.ok(!s.includes("junctionAction!=='split'&&((mode==='bend'"));
});
