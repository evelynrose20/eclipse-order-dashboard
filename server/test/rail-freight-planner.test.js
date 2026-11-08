import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {freightReady,planRailFreight,handleRailInfrastructure} from '../src/world-rail-infrastructure.js';
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
