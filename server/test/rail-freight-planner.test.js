import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {freightReady,planRailFreight,planRailFreightNetwork,handleRailInfrastructure} from '../src/world-rail-infrastructure.js';
const zone=1,region=1;
const origin={id:10,region_id:region,zone_id:zone,node_id:1,name:'Mine',status:'operational',freight_enabled:true,freight_capacity:100};
const dest={...origin,id:11,node_id:4,name:'Depot'};
const platforms=[{station_id:10,status:'operational',kind:'freight',capacity:50},{station_id:11,status:'operational',kind:'mixed',capacity:70}];
const segments=[
 {id:100,region_id:region,zone_id:zone,route_type:'rail',from_node_id:1,to_node_id:2},
 {id:101,region_id:region,zone_id:zone,route_type:'rail',from_node_id:2,to_node_id:4},
 {id:102,region_id:region,zone_id:zone,route_type:'rail',from_node_id:2,to_node_id:3}
];
const junction={id:9,region_id:region,zone_id:zone,node_id:2,entry_segment_id:100,exit_segment_id:101,status:'open'};
const input={originId:10,destinationId:11,stations:[origin,dest],platforms,segments,nodes:[],switches:[],crossings:[]};
test('freight readiness requires operational station, freight allowance, station capacity and active freight platform',()=>{
 assert.equal(freightReady(origin,platforms),true);
 assert.equal(freightReady({...origin,freight_capacity:0},platforms),false);
 assert.equal(freightReady({...origin,status:'damaged'},platforms),false);
 assert.equal(freightReady(origin,platforms.filter(p=>p.station_id!==origin.id)),false);
 assert.equal(freightReady(origin,[{station_id:10,status:'planned',kind:'freight',capacity:10}]),false);
});
test('branch junctions require a configured open railway switch for freight route',()=>{
 assert.equal(planRailFreight(input).available,false);
 const allowed=planRailFreight({...input,switches:[junction]});
 assert.equal(allowed.available,true);
 assert.deepEqual(allowed.segment_ids,[100,101]);
 assert.equal(planRailFreight({...input,switches:[{...junction,status:'closed'}]}).available,false);
 assert.equal(planRailFreight({...input,switches:[{...junction,status:'damaged'}]}).available,false);
});
test('an unfinished or closed crossing blocks rail freight but operational crossing does not',()=>{
 const c={region_id:region,zone_id:zone,rail_segment_id:101,control_type:'gated',status:'closed'};
 assert.equal(planRailFreight({...input,switches:[junction],crossings:[c]}).available,false);
 assert.equal(planRailFreight({...input,switches:[junction],crossings:[{...c,status:'operational'}]}).available,true);
});
test('freight preview never claims cross-zone or under-equipped station availability',()=>{
 assert.equal(planRailFreight({...input,stations:[origin,{...dest,zone_id:2}]}).reason,'stations_in_different_zones');
 assert.equal(planRailFreight({...input,platforms:[platforms[0]]}).reason,'freight_platform_not_ready');
 assert.equal(planRailFreight({...input,destinationId:10}).reason,'choose_distinct_stations');
});
test('unknown railway API paths return 404 without touching the database',async()=>{
 const result=await handleRailInfrastructure(null,{method:'POST'},'/world-admin/rail/missing',null);
 assert.equal(result.status,404);
});
test('railway facility UI stays within original map and uses Font Awesome',async()=>{
 const load=path=>readFile(new URL('../../'+path,import.meta.url),'utf8');
 const [map,panel,schema,setup]=await Promise.all([load('src/WorldTerritoryMap.jsx'),load('src/RailInfrastructurePanel.jsx'),load('server/sql/047_rail_infrastructure.sql'),load('server/src/setup-local.js')]);
 assert.match(map,/RailInfrastructurePanel/);assert.match(map,/\['rail','Railway'\]/);
 assert.match(panel,/Enable rail infrastructure on selected route/);
 for(const label of ['Stations','Platforms','Switches','Crossings','FREIGHT ROUTE CHECK'])assert.ok(panel.includes(label),label);
 assert.match(panel,/fa-solid/);
 for(const name of ['world_rail_stations','world_rail_platforms','world_rail_switches','world_rail_crossings'])assert.ok(schema.includes(name),name);
 assert.match(setup,/047_rail_infrastructure\.sql/);
 assert.doesNotMatch(map,/WorldNetworkEditor/);
});

test('cross-zone freight requires an explicitly operational interzone station link',()=>{
 const remote={...dest,id:12,node_id:800,region_id:9,zone_id:40,name:'Distant Depot'};
 const remotePlatform={station_id:12,status:'operational',kind:'freight',capacity:30};
 const stations=[origin,dest,remote],ready=[...platforms,remotePlatform];
 const args={originId:10,destinationId:12,stations,platforms:ready,segments,nodes:[],switches:[junction],crossings:[],links:[]};
 assert.equal(planRailFreightNetwork(args).reason,'no_interzone_rail_path');
 const link={id:2,from_station_id:11,to_station_id:12,status:'operational',freight_enabled:true,bidirectional:true};
 const good=planRailFreightNetwork({...args,links:[link]});
 assert.equal(good.available,true);
 assert.deepEqual(good.link_ids,[2]);
 assert.deepEqual(good.segment_ids,[100,101]);
 assert.equal(planRailFreightNetwork({...args,links:[{...link,status:'closed'}]}).available,false);
 assert.equal(planRailFreightNetwork({...args,links:[{...link,freight_enabled:false}]}).available,false);
 assert.equal(planRailFreightNetwork({...args,links:[{...link,bidirectional:false}],originId:12,destinationId:10}).available,false);
});
test('cross-zone links can traverse several regions through operational stations',()=>{
 const intermediate={...origin,id:20,node_id:900,zone_id:7,region_id:7};
 const final={...dest,id:21,node_id:901,zone_id:8,region_id:8};
 const links=[{id:1,from_station_id:10,to_station_id:20,status:'operational',freight_enabled:true,bidirectional:true},{id:2,from_station_id:20,to_station_id:21,status:'operational',freight_enabled:true,bidirectional:true}];
 const stations=[origin,intermediate,final],platforms=[{station_id:10,status:'operational',kind:'freight',capacity:10},{station_id:20,status:'operational',kind:'freight',capacity:10},{station_id:21,status:'operational',kind:'freight',capacity:10}];
 assert.deepEqual(planRailFreightNetwork({originId:10,destinationId:21,stations,platforms,segments:[],nodes:[],switches:[],crossings:[],links}).link_ids,[1,2]);
});

test('platform endpoint explains missing station instead of a generic rail platform error',async()=>{
 const input={code:'F1',kind:'freight',track_length:1,capacity:10,status:'planned'};
 const req={method:'POST',[Symbol.asyncIterator]:async function*(){yield Buffer.from(JSON.stringify(input))}};
 const res=await handleRailInfrastructure(null,req,'/world-admin/rail/platforms',null);
 assert.equal(res.status,400);
 assert.equal(res.body.error,'rail_platform_station_required');
});
test('facility editor suggests platform codes, station-owned platform creation and cross-map network links',async()=>{
 const src=await readFile(new URL('../../src/RailInfrastructurePanel.jsx',import.meta.url),'utf8');
 assert.match(src,/code:'F'\+index/);
 assert.match(src,/Add platform here/);
 assert.match(src,/This station already has a platform with that code/);
 assert.match(src,/switchCandidates/);
 assert.match(src,/pairNear/);
 assert.match(src,/Network links/);
 assert.match(src,/Add network link/);
 assert.match(src,/allStations/);
 assert.match(src,/Save connection/);
});
