import test from 'node:test';
import assert from 'node:assert/strict';
import {matchingRegionEdge,regionConnectionAllowsBorder,handleRegionConnections} from '../src/world-region-connections.js';
test('regional border accepts matching east-west edges, including return direction',()=>{
 const c={from_region_id:1,from_zone_id:10,to_region_id:2,to_zone_id:20,connection_kind:'ground',direction:'east'};
 assert.equal(matchingRegionEdge({x:97,y:50},{x:3,y:50},'east'),true);
 assert.equal(matchingRegionEdge({x:3,y:50},{x:97,y:50},'east'),false);
 assert.equal(regionConnectionAllowsBorder([c],1,2,10,20,{x:97,y:50},{x:3,y:50}),true);
 assert.equal(regionConnectionAllowsBorder([c],2,1,20,10,{x:3,y:50},{x:97,y:50}),true);
 assert.equal(regionConnectionAllowsBorder([c],1,2,10,20,{x:50,y:3},{x:50,y:97}),false);
 assert.equal(regionConnectionAllowsBorder([{...c,connection_kind:'airship'}],1,2,10,20,{x:97,y:50},{x:3,y:50}),false);
});
test('region-connection payload rejects invalid geography before database access',async()=>{
 const req={method:'POST',async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify({name:'Wrong',from_region_id:1,from_zone_id:10,to_region_id:1,to_zone_id:20,connection_kind:'ground',direction:'east'}))}};
 const result=await handleRegionConnections(null,req,'/world-admin/region-connections',{id:'test'});
 assert.equal(result.status,400);
});
