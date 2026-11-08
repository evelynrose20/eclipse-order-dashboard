// Railway infrastructure is operational metadata on the original shared map graph.
// Stations, switches and crossings do NOT duplicate or replace saved road geometry.
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const id=n=>Number.isSafeInteger(Number(n))&&Number(n)>0;
const bounded=(n,max)=>Number.isInteger(Number(n))&&Number(n)>=0&&Number(n)<=max;
const named=(s,max,required=false)=>typeof s==='string'&&s.length<=max&&(!required||s.trim().length>0);
const statuses=['planned','operational','closed','damaged'],platformKinds=['freight','passenger','mixed','siding'],switchStates=['open','closed','damaged'],controls=['gated','ungated','signal','grade_separated'];
async function body(req){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>16000)return null;chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}}
async function tx(pool,fn){const db=await pool.getConnection();try{await db.beginTransaction();const result=await fn(db);if(result.status===200)await db.commit();else await db.rollback();return result}catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}}
async function audit(db,actor,action,target){await db.execute("INSERT INTO world_administration_audit(actor_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)",[actor.id,action,'rail',target,'Railway infrastructure edited'])}
const same=(r,region,zone)=>Number(r?.region_id)===Number(region)&&Number(r?.zone_id)===Number(zone);
async function nodeIn(db,node,region,zone){const [[n]]=await db.execute('SELECT * FROM world_route_nodes WHERE id=?',[node]);return same(n,region,zone)?n:null}
async function edgeIn(db,edge,region,zone,type){const [[e]]=await db.execute('SELECT * FROM world_route_segments WHERE id=?',[edge]);return same(e,region,zone)&&(!type||e.route_type===type)?e:null}
async function railAtNode(db,nodeId,region,zone){const [e]=await db.execute("SELECT id FROM world_route_segments WHERE region_id=? AND zone_id=? AND route_type='rail' AND (from_node_id=? OR to_node_id=?) LIMIT 1",[region,zone,nodeId,nodeId]);return e.length>0}
async function stationIn(db,id){const [[row]]=await db.execute('SELECT * FROM world_rail_stations WHERE id=?',[id]);return row}
const stationFields=b=>b&&id(b.region_id)&&id(b.zone_id)&&id(b.node_id)&&named(b.name,140,true)&&statuses.includes(b.status)&&typeof b.freight_enabled==='boolean'&&typeof b.passenger_enabled==='boolean'&&bounded(b.freight_capacity,1000000)&&named(b.notes,1200);
const stationValues=b=>[b.name.trim(),b.status,b.freight_enabled?1:0,b.passenger_enabled?1:0,Number(b.freight_capacity),b.notes];
const platformFields=b=>b&&id(b.station_id)&&named(b.code,30,true)&&platformKinds.includes(b.kind)&&bounded(b.track_length,1000000)&&Number(b.track_length)>0&&bounded(b.capacity,1000000)&&statuses.includes(b.status);
const platformValues=b=>[b.code.trim(),b.kind,Number(b.track_length),Number(b.capacity),b.status];
const switchFields=b=>b&&id(b.node_id)&&id(b.entry_segment_id)&&id(b.exit_segment_id)&&Number(b.entry_segment_id)!==Number(b.exit_segment_id)&&switchStates.includes(b.status)&&named(b.notes,500);
const crossingFields=b=>b&&id(b.rail_segment_id)&&id(b.road_segment_id)&&named(b.name,140)&&typeof b.map_x==='number'&&typeof b.map_y==='number'&&[b.map_x,b.map_y].every(v=>Number.isFinite(v)&&v>=0&&v<=100)&&controls.includes(b.control_type)&&statuses.includes(b.status)&&named(b.notes,500);
const crossingValues=b=>[b.name.trim(),b.map_x,b.map_y,b.control_type,b.status,b.notes];
async function routePoints(db,e){const [nodes]=await db.execute('SELECT id,settlement_id,map_x,map_y FROM world_route_nodes WHERE id IN (?,?)',[e.from_node_id,e.to_node_id]);
 if(nodes.length!==2)return [];
 const [places]=await db.execute('SELECT id,map_x,map_y FROM world_settlements WHERE id IN (?,?)',[nodes[0].settlement_id||0,nodes[1].settlement_id||0]);
 const at=nodeId=>{const n=nodes.find(n=>Number(n.id)===Number(nodeId)),s=places.find(s=>Number(s.id)===Number(n?.settlement_id));return {x:Number(s?.map_x??n?.map_x),y:Number(s?.map_y??n?.map_y)}};
 const bends=typeof e.waypoints==='string'?JSON.parse(e.waypoints):e.waypoints;
 return [at(e.from_node_id),...(Array.isArray(bends)?bends:[]),at(e.to_node_id)];
}
function polyDistance(p,points){let best=Infinity;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));best=Math.min(best,Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t))}return best}
async function checkCrossing(db,b,region,zone){
 const rail=await edgeIn(db,b.rail_segment_id,region,zone,'rail'),road=await edgeIn(db,b.road_segment_id,region,zone);
 if(!rail||!road||!['road','trail'].includes(road.route_type))return fail(400,'crossing_requires_rail_and_road_in_zone');
 const p={x:b.map_x,y:b.map_y};
 if(polyDistance(p,await routePoints(db,rail))>3||polyDistance(p,await routePoints(db,road))>3)return fail(400,'crossing_location_not_on_both_routes');
 return null;
}
// A freight-ready station requires operational status, freight enabled and an
// operational freight/mixed platform. This is metadata, not a cargo movement.
export function freightReady(station,platforms){return station.status==='operational'&&Boolean(station.freight_enabled)&&Number(station.freight_capacity)>0&&platforms.some(p=>Number(p.station_id)===Number(station.id)&&p.status==='operational'&&['freight','mixed'].includes(p.kind)&&Number(p.capacity)>0)}
export async function railRecords(pool){
 const [stations]=await pool.execute('SELECT * FROM world_rail_stations ORDER BY region_id,zone_id,name,id');
 const [platforms]=await pool.execute('SELECT * FROM world_rail_platforms ORDER BY station_id,code,id');
 const [switches]=await pool.execute('SELECT * FROM world_rail_switches ORDER BY node_id,id');
 const [crossings]=await pool.execute('SELECT * FROM world_rail_crossings ORDER BY region_id,zone_id,id');
 const [links]=await pool.execute('SELECT * FROM world_rail_interzone_links ORDER BY id');
 return {rail_stations:stations.map(s=>({...s,freight_enabled:!!s.freight_enabled,passenger_enabled:!!s.passenger_enabled,freight_ready:freightReady(s,platforms)})),rail_platforms:platforms,rail_switches:switches,rail_crossings:crossings,rail_links:links.map(l=>({...l,bidirectional:!!l.bidirectional,freight_enabled:!!l.freight_enabled}))};
}
// Read-only operational reachability preview for future Trade dispatch. No inventory is moved.
export function planRailFreight({originId,destinationId,stations,platforms,segments,nodes,switches,crossings}){
 const start=stations.find(s=>Number(s.id)===Number(originId));
 const finish=stations.find(s=>Number(s.id)===Number(destinationId));
 if(!start||!finish)return {available:false,reason:'station_not_found'};
 if(!same(start,finish.region_id,finish.zone_id))return {available:false,reason:'stations_in_different_zones'};
 if(!freightReady(start,platforms)||!freightReady(finish,platforms))return {available:false,reason:'freight_platform_not_ready'};
 if(Number(start.id)===Number(finish.id))return {available:false,reason:'choose_distinct_stations'};
 const blocked=new Set(crossings.filter(c=>same(c,start.region_id,start.zone_id)&&c.status!=='operational').map(c=>Number(c.rail_segment_id)));
 const tracks=segments.filter(e=>same(e,start.region_id,start.zone_id)&&e.route_type==='rail'&&!blocked.has(Number(e.id)));
 const adjacent=new Map();
 for(const e of tracks){for(const n of [e.from_node_id,e.to_node_id]){const key=Number(n);if(!adjacent.has(key))adjacent.set(key,[]);adjacent.get(key).push(e)}}
 const limits=switches.filter(sw=>same(sw,start.region_id,start.zone_id));
 const queue=[{node:Number(start.node_id),previous:null,segments:[],usedSwitches:[]}],visited=new Set();
 for(let i=0;i<queue.length;i++){
  const current=queue[i];
  if(current.node===Number(finish.node_id))return {available:true,segment_ids:current.segments,switch_ids:current.usedSwitches,reason:null,origin_station_id:Number(originId),destination_station_id:Number(destinationId)};
  const key=current.node+'|'+(current.previous??'origin');
  if(visited.has(key))continue;visited.add(key);
  for(const edge of adjacent.get(current.node)||[]){
   const edgeId=Number(edge.id);
   if(edgeId===current.previous)continue;
   let switchUsed=null;
   if(current.previous!=null){
    const options=limits.filter(sw=>Number(sw.node_id)===current.node);
    const found=options.find(sw=>(Number(sw.entry_segment_id)===current.previous&&Number(sw.exit_segment_id)===edgeId)||(Number(sw.exit_segment_id)===current.previous&&Number(sw.entry_segment_id)===edgeId));
    if(found?.status!=='open'&&(found||options.length>0||(adjacent.get(current.node)||[]).length>2))continue;
    switchUsed=found?.id||null;
   }
   const nextNode=Number(edge.from_node_id)===current.node?Number(edge.to_node_id):Number(edge.from_node_id);
   queue.push({node:nextNode,previous:edgeId,segments:[...current.segments,edgeId],usedSwitches:switchUsed?[...current.usedSwitches,Number(switchUsed)]:current.usedSwitches});
  }
 }
 return {available:false,reason:'no_operational_rail_path',segment_ids:[],switch_ids:[]};
}
// Compose local railway checks and explicit station-to-station transfers.
// No coordinate-based links are inferred between different zone maps.
export function planRailFreightNetwork({originId,destinationId,stations,platforms,segments,nodes,switches,crossings,links=[]}){
 const from=stations.find(x=>Number(x.id)===Number(originId));
 const to=stations.find(x=>Number(x.id)===Number(destinationId));
 if(!from||!to)return {available:false,reason:'station_not_found'};
 if(same(from,to.region_id,to.zone_id))return {...planRailFreight({originId,destinationId,stations,platforms,segments,nodes,switches,crossings}),link_ids:[]};
 const ready=stations.filter(st=>freightReady(st,platforms));
 if(!ready.some(st=>Number(st.id)===Number(originId))||!ready.some(st=>Number(st.id)===Number(destinationId)))return {available:false,reason:'freight_platform_not_ready'};
 const adjacent=new Map(ready.map(st=>[Number(st.id),[]]));
 for(let i=0;i<ready.length;i++)for(let j=i+1;j<ready.length;j++){
  const a=ready[i],b=ready[j];if(!same(a,b.region_id,b.zone_id))continue;
  const path=planRailFreight({originId:a.id,destinationId:b.id,stations,platforms,segments,nodes,switches,crossings});
  if(path.available){adjacent.get(Number(a.id)).push({to:Number(b.id),segments:path.segment_ids,links:[]});adjacent.get(Number(b.id)).push({to:Number(a.id),segments:[...path.segment_ids].reverse(),links:[]})}
 }
 for(const link of links){
  if(link.status!=='operational'||!link.freight_enabled)continue;
  const a=Number(link.from_station_id),b=Number(link.to_station_id);
  if(!adjacent.has(a)||!adjacent.has(b))continue;
  adjacent.get(a).push({to:b,segments:[],links:[Number(link.id)]});
  if(link.bidirectional)adjacent.get(b).push({to:a,segments:[],links:[Number(link.id)]});
 }
 const queue=[{station:Number(originId),segments:[],links:[]}],visited=new Set();
 for(let i=0;i<queue.length;i++){
  const p=queue[i];if(visited.has(p.station))continue;visited.add(p.station);
  if(p.station===Number(destinationId))return {available:true,reason:null,segment_ids:p.segments,link_ids:p.links,origin_station_id:Number(originId),destination_station_id:Number(destinationId)};
  for(const edge of adjacent.get(p.station)||[])if(!visited.has(edge.to))queue.push({station:edge.to,segments:[...p.segments,...edge.segments],links:[...p.links,...edge.links]});
 }
 return {available:false,reason:'no_interzone_rail_path',segment_ids:[],link_ids:[]};
}
export async function handleRailInfrastructure(pool,req,path,actor){
 if(path==='/world-admin/rail/links'&&(req.method==='POST'||req.method==='PUT')||/^\/world-admin\/rail\/links\/\d+$/.test(path)&&['PUT','DELETE'].includes(req.method)){
  const match=/^\/world-admin\/rail\/links(?:\/(\d+))?$/.exec(path),linkId=match?.[1]?Number(match[1]):null;
  if(!match||req.method==='POST'&&linkId||req.method!=='POST'&&!linkId)return fail(400,'invalid_rail_link');
  const b=req.method==='DELETE'?null:await body(req);
  if(req.method!=='DELETE'&&(!b||!id(b.from_station_id)||!id(b.to_station_id)||Number(b.from_station_id)===Number(b.to_station_id)||!named(b.name,140)||!named(b.notes,1200)||!statuses.includes(b.status)||typeof b.freight_enabled!=='boolean'||typeof b.bidirectional!=='boolean'))return fail(400,'invalid_rail_link');
  return tx(pool,async db=>{
   if(req.method==='DELETE'){
    const [removed]=await db.execute('DELETE FROM world_rail_interzone_links WHERE id=?',[linkId]);
    if(!removed.affectedRows)return fail(404,'rail_link_not_found');
    await audit(db,actor,'rail_link_delete',linkId);return ok({saved:true});
   }
   const [stations]=await db.execute('SELECT id,region_id,zone_id FROM world_rail_stations WHERE id IN (?,?)',[b.from_station_id,b.to_station_id]);
   if(stations.length!==2)return fail(400,'rail_link_station_missing');
   if(same(stations[0],stations[1].region_id,stations[1].zone_id))return fail(400,'rail_link_requires_distinct_zones');
   const [previous]=await db.execute('SELECT id FROM world_rail_interzone_links WHERE ((from_station_id=? AND to_station_id=?) OR (from_station_id=? AND to_station_id=?)) AND id<>? LIMIT 1',[b.from_station_id,b.to_station_id,b.to_station_id,b.from_station_id,linkId||0]);
   if(previous.length)return fail(409,'rail_link_already_exists');
   const from=Number(b.from_station_id),to=Number(b.to_station_id);
   const values=[from,to,b.name.trim(),b.status,b.bidirectional?1:0,b.freight_enabled?1:0,b.notes];
   if(req.method==='PUT'){
    const [existing]=await db.execute('SELECT id FROM world_rail_interzone_links WHERE id=?',[linkId]);if(!existing.length)return fail(404,'rail_link_not_found');
    await db.execute('UPDATE world_rail_interzone_links SET from_station_id=?,to_station_id=?,name=?,status=?,bidirectional=?,freight_enabled=?,notes=? WHERE id=?',[...values,linkId]);
    await audit(db,actor,'rail_link_update',linkId);return ok({saved:true});
   }
   const [r]=await db.execute('INSERT INTO world_rail_interzone_links(from_station_id,to_station_id,name,status,bidirectional,freight_enabled,notes,created_by) VALUES(?,?,?,?,?,?,?,?)',[...values,actor.id]);
   await audit(db,actor,'rail_link_create',r.insertId);return ok({id:r.insertId});
  });
 }
 if(path==='/world-admin/rail/preview'&&req.method==='POST'){
  const b=await body(req);
  if(!id(b?.origin_station_id)||!id(b?.destination_station_id))return fail(400,'invalid_freight_preview');
  const records=await railRecords(pool);
  const [nodes]=await pool.execute('SELECT id,region_id,zone_id FROM world_route_nodes');
  const [segments]=await pool.execute("SELECT id,region_id,zone_id,from_node_id,to_node_id,route_type FROM world_route_segments WHERE route_type='rail'");
  return ok(planRailFreightNetwork({originId:b.origin_station_id,destinationId:b.destination_station_id,stations:records.rail_stations,platforms:records.rail_platforms,segments,nodes,switches:records.rail_switches,crossings:records.rail_crossings,links:records.rail_links}));
 }
 const route=/^\/world-admin\/rail\/(stations|platforms|switches|crossings)(?:\/(\d+))?$/.exec(path);
 if(!route)return fail(404,'rail_route_not_found');
 const [,table,rawId]=route,rowId=rawId?Number(rawId):null;
 if(!['POST','PUT','DELETE'].includes(req.method))return fail(405,'method_not_allowed');
 if((req.method==='POST'&&rowId)||(req.method!=='POST'&&!rowId))return fail(400,'invalid_rail_request');
 const b=req.method==='DELETE'?null:await body(req);
 if(table==='stations'){
  if(b&&!stationFields(b))return fail(400,'invalid_rail_station');
  return tx(pool,async db=>{
   if(req.method==='DELETE'){
    const station=await stationIn(db,rowId);if(!station)return fail(404,'station_not_found');
    const [platforms]=await db.execute('SELECT id FROM world_rail_platforms WHERE station_id=? LIMIT 1',[rowId]);
    if(platforms.length)return fail(409,'station_has_platforms');
    await db.execute('DELETE FROM world_rail_stations WHERE id=?',[rowId]);await audit(db,actor,'rail_station_delete',rowId);return ok({saved:true});
   }
   const n=await nodeIn(db,b.node_id,b.region_id,b.zone_id);
   if(!n||!await railAtNode(db,b.node_id,b.region_id,b.zone_id))return fail(400,'station_requires_connected_rail_node');
   if(req.method==='PUT'){
    const previous=await stationIn(db,rowId);if(!previous)return fail(404,'station_not_found');
    if(!same(previous,b.region_id,b.zone_id)||Number(previous.node_id)!==Number(b.node_id))return fail(409,'station_node_change_not_allowed');
    await db.execute('UPDATE world_rail_stations SET name=?,status=?,freight_enabled=?,passenger_enabled=?,freight_capacity=?,notes=? WHERE id=?',[...stationValues(b),rowId]);
    await audit(db,actor,'rail_station_update',rowId);return ok({saved:true});
   }
   const [r]=await db.execute('INSERT INTO world_rail_stations(region_id,zone_id,node_id,name,status,freight_enabled,passenger_enabled,freight_capacity,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)',[b.region_id,b.zone_id,b.node_id,...stationValues(b),actor.id]);
   await audit(db,actor,'rail_station_create',r.insertId);return ok({id:r.insertId});
  });
 }
 if(table==='platforms'){
  if(req.method!=='DELETE'&&!platformFields(b))return fail(400,'invalid_rail_platform');
  return tx(pool,async db=>{
   if(req.method==='DELETE'){
    const [r]=await db.execute('DELETE FROM world_rail_platforms WHERE id=?',[rowId]);
    if(!r.affectedRows)return fail(404,'platform_not_found');
    await audit(db,actor,'rail_platform_delete',rowId);return ok({saved:true});
   }
   const station=await stationIn(db,b.station_id);if(!station)return fail(404,'station_not_found');
   const [duplicate]=await db.execute('SELECT id FROM world_rail_platforms WHERE station_id=? AND LOWER(code)=LOWER(?) AND id<>? LIMIT 1',[b.station_id,b.code.trim(),rowId||0]);
   if(duplicate.length)return fail(409,'platform_code_already_exists');
   if(req.method==='PUT'){
    const [[old]]=await db.execute('SELECT station_id FROM world_rail_platforms WHERE id=?',[rowId]);
    if(!old)return fail(404,'platform_not_found');
    if(Number(old.station_id)!==Number(b.station_id))return fail(409,'platform_station_change_not_allowed');
    await db.execute('UPDATE world_rail_platforms SET code=?,kind=?,track_length=?,capacity=?,status=? WHERE id=?',[...platformValues(b),rowId]);
    await audit(db,actor,'rail_platform_update',rowId);return ok({saved:true});
   }
   const [r]=await db.execute('INSERT INTO world_rail_platforms(station_id,code,kind,track_length,capacity,status) VALUES(?,?,?,?,?,?)',[b.station_id,...platformValues(b)]);
   await audit(db,actor,'rail_platform_create',r.insertId);return ok({id:r.insertId});
  });
 }
 if(table==='switches'){
  if(b&&!switchFields(b))return fail(400,'invalid_rail_switch');
  return tx(pool,async db=>{
   if(req.method==='DELETE'){
    const [r]=await db.execute('DELETE FROM world_rail_switches WHERE id=?',[rowId]);if(!r.affectedRows)return fail(404,'switch_not_found');
    await audit(db,actor,'rail_switch_delete',rowId);return ok({saved:true});
   }
   const [[node]]=await db.execute('SELECT * FROM world_route_nodes WHERE id=?',[b.node_id]);
   if(!node||!['rail_switch','junction'].includes(node.node_kind))return fail(400,'switch_requires_rail_junction');
   const a=await edgeIn(db,b.entry_segment_id,node.region_id,node.zone_id,'rail'),c=await edgeIn(db,b.exit_segment_id,node.region_id,node.zone_id,'rail');
   if(!a||!c||![Number(a.from_node_id),Number(a.to_node_id)].includes(Number(node.id))||![Number(c.from_node_id),Number(c.to_node_id)].includes(Number(node.id)))return fail(400,'switch_tracks_must_meet_at_node');
   const [first,second]=[Number(a.id),Number(c.id)].sort((x,y)=>x-y);
   if(req.method==='PUT'){
    const [[old]]=await db.execute('SELECT node_id FROM world_rail_switches WHERE id=?',[rowId]);
    if(!old)return fail(404,'switch_not_found');
    if(Number(old.node_id)!==Number(b.node_id))return fail(409,'switch_node_change_not_allowed');
    await db.execute('UPDATE world_rail_switches SET entry_segment_id=?,exit_segment_id=?,status=?,notes=? WHERE id=?',[first,second,b.status,b.notes,rowId]);
    await audit(db,actor,'rail_switch_update',rowId);return ok({saved:true});
   }
   const [r]=await db.execute('INSERT INTO world_rail_switches(region_id,zone_id,node_id,entry_segment_id,exit_segment_id,status,notes) VALUES(?,?,?,?,?,?,?)',[node.region_id,node.zone_id,node.id,first,second,b.status,b.notes]);
   await audit(db,actor,'rail_switch_create',r.insertId);return ok({id:r.insertId});
  });
 }
 if(table==='crossings'){
  if(b&&!crossingFields(b))return fail(400,'invalid_rail_crossing');
  return tx(pool,async db=>{
   if(req.method==='DELETE'){
    const [r]=await db.execute('DELETE FROM world_rail_crossings WHERE id=?',[rowId]);if(!r.affectedRows)return fail(404,'crossing_not_found');
    await audit(db,actor,'rail_crossing_delete',rowId);return ok({saved:true});
   }
   const region=Number(b.region_id),zone=Number(b.zone_id);
   if(!id(region)||!id(zone))return fail(400,'invalid_crossing_zone');
   const invalid=await checkCrossing(db,b,region,zone);if(invalid)return invalid;
   if(req.method==='PUT'){
    const [[old]]=await db.execute('SELECT region_id,zone_id FROM world_rail_crossings WHERE id=?',[rowId]);
    if(!old)return fail(404,'crossing_not_found');
    if(!same(old,region,zone))return fail(409,'crossing_zone_change_not_allowed');
    await db.execute('UPDATE world_rail_crossings SET rail_segment_id=?,road_segment_id=?,name=?,map_x=?,map_y=?,control_type=?,status=?,notes=? WHERE id=?',[b.rail_segment_id,b.road_segment_id,...crossingValues(b),rowId]);
    await audit(db,actor,'rail_crossing_update',rowId);return ok({saved:true});
   }
   const [r]=await db.execute('INSERT INTO world_rail_crossings(region_id,zone_id,rail_segment_id,road_segment_id,name,map_x,map_y,control_type,status,notes) VALUES(?,?,?,?,?,?,?,?,?,?)',[region,zone,b.rail_segment_id,b.road_segment_id,...crossingValues(b)]);
   await audit(db,actor,'rail_crossing_create',r.insertId);return ok({id:r.insertId});
  });
 }
 return fail(404,'rail_route_not_found');
}
