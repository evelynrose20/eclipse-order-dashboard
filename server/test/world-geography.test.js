import test from 'node:test';
import assert from 'node:assert/strict';
import {zoneDirection,validCardinalCrossing,worldGeographyRoute} from '../src/world-geography.js';

test('zone layout recognizes only immediate cardinal neighbors',()=>{
 const center={grid_x:0,grid_y:0};
 assert.equal(zoneDirection(center,{grid_x:0,grid_y:-1}),'north');
 assert.equal(zoneDirection(center,{grid_x:0,grid_y:1}),'south');
 assert.equal(zoneDirection(center,{grid_x:-1,grid_y:0}),'west');
 assert.equal(zoneDirection(center,{grid_x:1,grid_y:0}),'east');
 assert.equal(zoneDirection(center,{grid_x:1,grid_y:1}),null);
 assert.equal(zoneDirection(center,{grid_x:0,grid_y:2}),null);
 assert.equal(zoneDirection(center,{grid_x:null,grid_y:1}),null);
});
test('matching map-edge exits respect the direction of neighboring zones',()=>{
 const a={grid_x:0,grid_y:0},b={grid_x:1,grid_y:0};
 assert.equal(validCardinalCrossing({x:97,y:50},{x:3,y:50},a,b),true);
 assert.equal(validCardinalCrossing({x:3,y:50},{x:97,y:50},a,b),false);
 assert.equal(validCardinalCrossing({x:97,y:50},{x:97,y:50},a,b),false);
 assert.equal(validCardinalCrossing({x:97,y:50},{x:3,y:50},a,{grid_x:4,grid_y:0}),false);
});
test('invalid zone placement and region access are rejected before any database writes',async()=>{
 const input=content=>({method:'POST',async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(content))}});
 const zone=await worldGeographyRoute(null,input({anchor_zone_id:2,direction:'diagonal'}),'/world-admin/geography/zones/3/place',{id:'a'});
 assert.equal(zone.status,400);
 const region=await worldGeographyRoute(null,input({access_policy:'teleport'}),'/world-admin/geography/regions/1/access',{id:'a'});
 assert.equal(region.status,400);
});
