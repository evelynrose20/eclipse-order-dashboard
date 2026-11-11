import test from 'node:test';
import assert from 'node:assert/strict';
import {crossingEdges,handleWorldCrossings} from '../src/world-crossings.js';
import {freightPath,freightDuration} from '../src/world-logistics.js';

test('crossing graph links are directional-neutral and only operational links are routable',()=>{
 const crossings=[
  {id:1,from_node_id:17,to_node_id:31,route_type:'road',status:'operational'},
  {id:2,from_node_id:22,to_node_id:44,route_type:'rail',status:'operational'},
  {id:3,from_node_id:25,to_node_id:46,route_type:'road',status:'closed'},
  {id:4,from_node_id:27,to_node_id:47,route_type:'trail',status:'operational'}
 ];
 assert.deepEqual(crossingEdges(crossings,'road').map(x=>x.id),['crossing:1','crossing:4']);
 assert.deepEqual(crossingEdges(crossings,'rail').map(x=>x.id),['crossing:2']);
 assert.deepEqual(crossingEdges(crossings,'air'),[]);
});

test('invalid crossings reject identical zones and inland map points before a write',async()=>{
 const body=JSON.stringify({name:'Border',route_type:'road',from_region_id:1,from_zone_id:1,to_region_id:1,to_zone_id:1,from:{x:3,y:50},to:{x:97,y:50},travel_minutes:20});
 const req={method:'POST',async *[Symbol.asyncIterator](){yield Buffer.from(body)}};
 const result=await handleWorldCrossings(null,req,'/world-admin/crossings',{id:'test'});
 assert.equal(result.status,400);
 assert.equal(result.body.error,'invalid_crossing');
});

test('paired map crossings preserve existing local route nodes after removal',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../src/world-crossings.js',import.meta.url),'utf8');
 assert.match(source,/SELECT id FROM world_route_segments WHERE from_node_id=\? OR to_node_id=\?/);
 assert.match(source,/if\(!used\)await db\.execute\('DELETE FROM world_route_nodes/);
});

test('paired crossings carry freight across zone boundaries only when connected',()=>{
 const nodes=[{id:1,settlement_id:101},{id:2,settlement_id:null},{id:3,settlement_id:null},{id:4,settlement_id:202}];
 const segments=[{id:10,from_node_id:1,to_node_id:2,route_type:'road'},{id:11,from_node_id:3,to_node_id:4,route_type:'road'}];
 const crossing={id:20,from_node_id:2,to_node_id:3,route_type:'road',status:'operational',travel_minutes:30};
 const path=freightPath(nodes,[...segments,...crossingEdges([crossing],'road')],101,202,'road');
 assert.deepEqual(path.segment_ids,[10,'crossing:20',11]);
 assert.equal(path.crossing_minutes,30);
 assert.equal(freightDuration(path,25),80);
 assert.equal(freightPath(nodes,[...segments,...crossingEdges([{...crossing,status:'closed'}],'road')],101,202,'road'),null);
});
