import {trainSummary} from './world-magitek-trains.js';

const pathQuery='SELECT r.*,a.status AS from_status,z.status AS to_status FROM order_internal_rail_routes r JOIN order_internal_rail_stations a ON a.id=r.from_station_id JOIN order_internal_rail_stations z ON z.id=r.to_station_id WHERE r.from_type=\'settlement\' AND r.to_type=\'settlement\' AND r.from_id=? AND r.to_id=? AND r.status=\'active\' AND a.status=\'operational\' AND z.status=\'operational\' ORDER BY r.id';
export async function mappedRailTrack(db,from,to){
 if(Number(from)===Number(to))return null;
 const [places]=await db.execute('SELECT id,region_id FROM world_settlements WHERE id IN (?,?)',[from,to]);
 if(places.length!==2)return null;
 const sameRegion=Number(places[0].region_id)===Number(places[1].region_id);
 if(!sameRegion){
  const [bridges]=await db.execute("SELECT id,origin_settlement_id,destination_settlement_id FROM world_logistics_corridors WHERE mode='rail' AND state='operational'");
  const graph=new Map();
  for(const edge of bridges)for(const [a,b] of [[edge.origin_settlement_id,edge.destination_settlement_id],[edge.destination_settlement_id,edge.origin_settlement_id]]){if(!graph.has(Number(a)))graph.set(Number(a),[]);graph.get(Number(a)).push({to:Number(b),id:'corridor:'+edge.id})}
  const queue=[Number(from)],seen=new Set(queue),prev=new Map();
  while(queue.length){const current=queue.shift();if(current===Number(to))break;for(const next of graph.get(current)||[])if(!seen.has(next.to)){seen.add(next.to);prev.set(next.to,{from:current,id:next.id});queue.push(next.to)}}
  if(!seen.has(Number(to)))return null;
  const segments=[];let cursor=Number(to);while(cursor!==Number(from)){const e=prev.get(cursor);if(!e)return null;segments.unshift(e.id);cursor=e.from}return segments;
 }
 const region=places[0].region_id;
 const [nodes]=await db.execute('SELECT id,settlement_id FROM world_route_nodes WHERE region_id=?',[region]);
 const [edges]=await db.execute("SELECT id,from_node_id,to_node_id FROM world_route_segments WHERE region_id=? AND route_type='rail'",[region]);
 const graph=new Map();
 const connect=(a,b,id)=>{a=Number(a);b=Number(b);if(!graph.has(a))graph.set(a,[]);graph.get(a).push({to:b,id})};
 for(const edge of edges){connect(edge.from_node_id,edge.to_node_id,'track:'+edge.id);connect(edge.to_node_id,edge.from_node_id,'track:'+edge.id)}
 // Legacy railway lines are mapped tracks too, not merely service names.
 const [legacy]=await db.execute("SELECT id,from_settlement_id,to_settlement_id FROM world_map_routes WHERE region_id=? AND route_type='rail'",[region]);
 for(const edge of legacy){const a=nodes.find(n=>Number(n.settlement_id)===Number(edge.from_settlement_id)),b=nodes.find(n=>Number(n.settlement_id)===Number(edge.to_settlement_id));if(a&&b){connect(a.id,b.id,'legacy-track:'+edge.id);connect(b.id,a.id,'legacy-track:'+edge.id)}}
 const a=nodes.find(n=>Number(n.settlement_id)===Number(from)),b=nodes.find(n=>Number(n.settlement_id)===Number(to));
 if(!a||!b)return null;
 const queue=[Number(a.id)],seen=new Set(queue),prev=new Map();
 while(queue.length){const current=queue.shift();if(current===Number(b.id))break;for(const next of graph.get(current)||[])if(!seen.has(next.to)){seen.add(next.to);prev.set(next.to,{from:current,id:next.id});queue.push(next.to)}}
 if(!seen.has(Number(b.id)))return null;
 const path=[];let cursor=Number(b.id);while(cursor!==Number(a.id)){const edge=prev.get(cursor);if(!edge)return null;path.unshift(edge.id);cursor=edge.from}
 return path.length?path:null;
}
export async function railService(db,from,to,preferredId=null){
 const tracks=await mappedRailTrack(db,from,to);
 if(!tracks)return {available:false,reason:'Rail tracks do not connect the two station settlements'};
 const [outbound]=await db.execute(pathQuery,[from,to]);
 const selected=preferredId?outbound.find(x=>Number(x.id)===Number(preferredId)):outbound[0];
 if(!selected)return {available:false,reason:'Operational rail stations and an active outbound service are required'};
 const [returnRoutes]=await db.execute(pathQuery,[to,from]);
 const reverse=returnRoutes[0];
 if(!reverse)return {available:false,reason:'An operational return service is required for repeating trains'};
 return {available:true,forward:selected,reverse,tracks};
}
export async function availableConsist(db,id,sourceStation){
 const list=await trainSummary(db);
 const train=list.find(t=>Number(t.id)===Number(id)&&t.status==='assembled'&&t.owner_faction_id==='eclipse-order'&&t.wagon_count>0&&t.cargo_capacity>0);
 if(!train)return null;
 const [[latest]]=await db.execute("SELECT r.to_station_id,r.from_station_id,j.status FROM order_internal_rail_journeys j JOIN order_internal_rail_routes r ON r.id=j.route_id WHERE j.train_consist_id=? ORDER BY j.id DESC LIMIT 1",[id]);
 const atStation=latest?.status==='cancelled'?latest.from_station_id:latest?.to_station_id;
 if(atStation&&Number(atStation)!==Number(sourceStation))return null;
 const [journeys]=await db.execute("SELECT id FROM order_internal_rail_journeys WHERE train_consist_id=? AND status='running' AND expected_arrival_at>UTC_TIMESTAMP(3) LIMIT 1",[id]);
 const [shipments]=await db.execute("SELECT id FROM world_logistics_supply_line_shipments WHERE train_consist_id=? AND (status IN ('in_transit','disrupted') OR return_due_at>UTC_TIMESTAMP()) LIMIT 1",[id]);
 return journeys.length||shipments.length?null:train;
}
export async function startRailJourney(db,route,train,actorId){
 const [created]=await db.execute('INSERT INTO order_internal_rail_journeys(route_id,train_consist_id,cargo_capacity_snapshot,passenger_capacity_snapshot,crew_required_snapshot,departed_at,expected_arrival_at,dispatched_by) VALUES(?,?,?,?,?,UTC_TIMESTAMP(3),DATE_ADD(UTC_TIMESTAMP(3),INTERVAL ? MINUTE),?)',[route.id,train.id,train.cargo_capacity,train.transport_capacity,train.crew_required,Number(route.duration_minutes),actorId]);
 return created.insertId;
}
