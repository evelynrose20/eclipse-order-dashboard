import test from 'node:test';
import assert from 'node:assert/strict';
import {simplifyFreehand,insertVertex} from '../../src/continent-trace.js';
import {validateTerritoryPolygon} from '../src/world-continent.js';
import {readFileSync} from 'node:fs';

test('freehand outline becomes a closed, editable bounded polygon',()=>{
 const ring=[];
 for(let i=0;i<60;i++){const t=i*Math.PI*2/60;ring.push({x:450+150*Math.cos(t),y:290+90*Math.sin(t)})}
 ring.push({...ring[0]});
 const out=simplifyFreehand(ring,2);
 assert.ok(out.length>=3&&out.length<ring.length);
 assert.ok(out.length<=100);
 assert.equal(validateTerritoryPolygon(out),null);
});
test('short freehand strokes do not create bogus territory',()=>{
 assert.deepEqual(simplifyFreehand([]),[]);
 assert.deepEqual(simplifyFreehand([{x:1,y:1},{x:2,y:2}]),[]);
});
test('map editor can insert a new corner on the closest edge',()=>{
 const square=[{x:0,y:0},{x:20,y:0},{x:20,y:20},{x:0,y:20}];
 assert.deepEqual(insertVertex(square,{x:10,y:1})[1],{x:10,y:1});
 assert.equal(insertVertex(square,{x:10,y:1}).length,5);
});
test('reference migration is separate from state and province records',()=>{
 const sql=readFileSync(new URL('../sql/077_continent_reference_layer.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS world_continent_reference/);
 assert.match(sql,/image_data MEDIUMTEXT/);
 assert.doesNotMatch(sql,/DROP TABLE|DELETE FROM world_zones|ALTER TABLE world_strategic_provinces/i);
});
