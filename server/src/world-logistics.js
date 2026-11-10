import {civilianStorageCapacity} from './world-civic-building-templates.js';
import {installationReadiness} from './world-military-readiness.js';
import {trainSummary} from './world-magitek-trains.js';
import {climateForRegions} from './world-region-climate.js';
import {itineraryRoute,stageItineraryArrival,handleItineraryRecall} from './world-logistics-itineraries.js';
import {logMovement,movementHistory} from './world-front-cargo.js';
import {airfieldReady,vehicleReady,airFreightEconomics,advancedLogisticsRoute} from './world-logistics-advanced.js';
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const modes=['road','rail','air'],purposes=['trade','relief','military','industry'];
const goodId=x=>Number.isSafeInteger(Number(x))&&Number(x)>0;
const qty=x=>typeof x==='number'&&Number.isFinite(x)&&x>0&&x<=1000000&&Math.round(x*1000)===x*1000;
const round=x=>Math.round(Number(x)*1000)/1000;
const name=(x,max)=>typeof x==='string'&&x.trim().length>0&&x.length<=max;
const allowed={road:['road','trail'],pack:['road','trail'],rail:['rail'],air:['skyway'],sea:['waterway']};
async function body(req){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>18000)return null;chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}}
async function tx(pool,run){const db=await pool.getConnection();try{await db.beginTransaction();const output=await run(db);if(output.status===200)await db.commit();else await db.rollback();return output}catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}}
async function ledger(db,id,item,delta,action,shipment,actor){
 await db.execute('INSERT IGNORE INTO world_industry_stock(facility_id,item_id,quantity) VALUES(?,?,0)',[id,item]);
 const [[row]]=await db.execute('SELECT quantity FROM world_industry_stock WHERE facility_id=? AND item_id=? FOR UPDATE',[id,item]);
 const next=round(Number(row.quantity)+delta);
 if(next<0)return false;
 await db.execute('UPDATE world_industry_stock SET quantity=? WHERE facility_id=? AND item_id=?',[next,id,item]);
 await db.execute('INSERT INTO world_industry_ledger(facility_id,item_id,delta,balance_after,action,reference_key,actor_id) VALUES(?,?,?,?,?,?,?)',[id,item,delta,next,action,'freight:'+shipment,actor.id]);
 return true;
}
async function facilities(db){
 const [rows]=await db.execute("SELECT f.id,f.name,COALESCE(f.settlement_id,CASE WHEN l.state='operational' THEN l.hub_settlement_id END) AS settlement_id,f.site_id,f.status,f.owner_faction_id,s.name AS settlement_name,s.controlling_faction_id,s.region_id,s.zone_id,s.strategic_state,site.name AS site_name,site.zone_id AS site_zone_id,site.controlling_faction_id AS site_faction_id,l.state AS access_state FROM world_industry_facilities f LEFT JOIN world_logistics_depot_links l ON l.facility_id=f.id LEFT JOIN world_industry_sites site ON site.id=f.site_id LEFT JOIN world_zones z ON z.id=site.zone_id LEFT JOIN world_settlements s ON s.id=COALESCE(f.settlement_id,CASE WHEN l.state='operational' THEN l.hub_settlement_id END) ORDER BY f.name");
 return rows;
}
export function freightPath(nodes,segments,originId,destinationId,mode){
 if(!allowed[mode])return null;
 const origin=nodes.find(n=>Number(n.settlement_id)===Number(originId));
 const destination=nodes.find(n=>Number(n.settlement_id)===Number(destinationId));
 if(!origin||!destination||Number(origin.id)===Number(destination.id))return null;
 const graph=new Map();
 for(const e of segments.filter(x=>allowed[mode].includes(x.route_type))){
  for(const [a,b] of [[Number(e.from_node_id),Number(e.to_node_id)],[Number(e.to_node_id),Number(e.from_node_id)]]){
   if(!graph.has(a))graph.set(a,[]);
   graph.get(a).push({to:b,id:e.id});
  }
 }
 const queue=[Number(origin.id)],seen=new Set(queue),prev=new Map();
 while(queue.length){
  const id=queue.shift();
  if(id===Number(destination.id))break;
  for(const edge of graph.get(id)||[])if(!seen.has(edge.to)){seen.add(edge.to);prev.set(edge.to,{from:id,segment:edge.id});queue.push(edge.to)}
 }
 if(!seen.has(Number(destination.id)))return null;
 const pathNodes=[Number(destination.id)],pathSegments=[];
 while(pathNodes[0]!==Number(origin.id)){
  const step=prev.get(pathNodes[0]);if(!step)return null;
  pathSegments.unshift(step.segment);pathNodes.unshift(step.from);
 }
 return {node_ids:pathNodes,segment_ids:pathSegments,legs:pathSegments.length};
}
export function corridorPath(corridors,from,to){
 const edges=new Map();
 for(const link of corridors)for(const [a,b] of [[Number(link.origin_settlement_id),Number(link.destination_settlement_id)],[Number(link.destination_settlement_id),Number(link.origin_settlement_id)]]){
  if(!edges.has(a))edges.set(a,[]);edges.get(a).push({to:b,id:link.id,minutes:Number(link.travel_minutes)});
 }
 const queue=[Number(from)],seen=new Set(queue),steps=new Map();
 while(queue.length){const current=queue.shift();if(current===Number(to))break;
  for(const next of edges.get(current)||[])if(!seen.has(next.to)){seen.add(next.to);steps.set(next.to,{from:current,...next});queue.push(next.to)}
 }
 if(!seen.has(Number(to)))return null;
 const settlements=[Number(to)],segments=[];let minutes=0;
 while(settlements[0]!==Number(from)){const step=steps.get(settlements[0]);if(!step)return null;segments.unshift('corridor:'+step.id);minutes+=step.minutes;settlements.unshift(step.from)}
 return {node_ids:settlements.map(n=>'settlement:'+n),segment_ids:segments,legs:segments.length,duration_minutes:minutes};
}
async function route(db,from,to,mode){
 if(Number(from)===Number(to))return {node_ids:['settlement:'+from],segment_ids:['local'],legs:1,duration_minutes:10};
 if(mode==='rail'){
  const [services]=await db.execute("SELECT r.id,r.duration_minutes FROM order_internal_rail_routes r JOIN order_internal_rail_stations a ON a.id=r.from_station_id JOIN order_internal_rail_stations z ON z.id=r.to_station_id WHERE r.status='active' AND a.status='operational' AND z.status='operational' AND r.from_type='settlement' AND r.to_type='settlement' AND r.from_id=? AND r.to_id=? ORDER BY r.id LIMIT 1",[from,to]);
  if(services.length)return {node_ids:['settlement:'+from,'settlement:'+to],segment_ids:['internal-rail:'+services[0].id],legs:1,duration_minutes:Number(services[0].duration_minutes)};
 }

 const [[a],[b]]=await Promise.all([
  db.execute('SELECT region_id,zone_id FROM world_settlements WHERE id=?',[from]),
  db.execute('SELECT region_id,zone_id FROM world_settlements WHERE id=?',[to])
 ]);
 if(!a.length||!b.length)return null;
 // Current route graph is region-scoped: a cross-region itinerary needs explicit future network links.
 if(Number(a[0].region_id)!==Number(b[0].region_id)){
  const [corridors]=await db.execute("SELECT id,origin_settlement_id,destination_settlement_id,travel_minutes FROM world_logistics_corridors WHERE mode=? AND state='operational'",[mode]);
  return corridorPath(corridors,from,to);
 }
 const [nodes]=await db.execute('SELECT id,settlement_id FROM world_route_nodes WHERE region_id=?',[a[0].region_id]);
 const [segments]=await db.execute('SELECT id,from_node_id,to_node_id,route_type FROM world_route_segments WHERE region_id=?',[a[0].region_id]);
 const graph=freightPath(nodes,segments,from,to,mode);
 if(graph)return graph;
 // Older map routes remain valid as complete individual legs, not imagined map links.
 const [legacy]=await db.execute('SELECT id,from_settlement_id,to_settlement_id,route_type FROM world_map_routes WHERE region_id=?',[a[0].region_id]);
 const links=legacy.filter(r=>allowed[mode].includes(r.route_type));
 const oldNodes=[...new Set(links.flatMap(r=>[r.from_settlement_id,r.to_settlement_id]))].map(id=>({id:Number(id),settlement_id:Number(id)}));
 const oldEdges=links.map(e=>({id:'legacy:'+e.id,from_node_id:Number(e.from_settlement_id),to_node_id:Number(e.to_settlement_id),route_type:e.route_type}));
 const old=freightPath(oldNodes,oldEdges,from,to,mode);
 if(old)return old;
 const [corridors]=await db.execute("SELECT id,origin_settlement_id,destination_settlement_id,travel_minutes FROM world_logistics_corridors WHERE mode=? AND state='operational'",[mode]);
 return corridorPath(corridors,from,to);
}
export function shouldInterruptForWeather(weather,shipmentId){
 const type=String(weather||'').toLowerCase();
 if(type==='blizzard')return 'blizzard';
 if(type==='snow'&&Number(shipmentId)%4===0)return 'snowstorm';
 return null;
}
async function weatherForShipment(db,shipment){
 const [[region]]=await db.execute("SELECT r.* FROM world_regions r JOIN world_settlements s ON s.region_id=r.id JOIN world_industry_facilities f ON f.settlement_id=s.id WHERE f.id=?",[shipment.destination_facility_id]);
 if(!region)return null;
 const [weather]=await climateForRegions(db,[region]);
 return weather?.effective_weather?.weather||region.weather;
}
async function railJourneyHold(db,shipment,actor){
 if(!shipment.train_journey_id)return false;
 const [[journey]]=await db.execute('SELECT status FROM order_internal_rail_journeys WHERE id=?',[shipment.train_journey_id]);
 if(journey&&journey.status!=='cancelled')return false;
 await db.execute("UPDATE world_logistics_shipments SET status='disrupted',incident_notes='Rail journey stopped; cargo awaiting command review' WHERE id=? AND status='in_transit'",[shipment.id]);
 await record(db,shipment.id,'disrupt','Train journey unavailable; cargo held without loss',actor);
 return true;
}
async function record(db,shipment,action,note,actor){
 await db.execute('INSERT INTO world_logistics_events(shipment_id,action,note,actor_id) VALUES(?,?,?,?)',[shipment,action,String(note||'').slice(0,500),actor.id]);
 if(['dispatch','arrival','cancel'].includes(action)){
  const [[cargo]]=await db.execute('SELECT item_id,quantity,source_facility_id,destination_facility_id FROM world_logistics_shipments WHERE id=?',[shipment]);
  if(cargo)await logMovement(db,{system:'industry',reference:shipment,action,item:cargo.item_id,quantity:cargo.quantity,source:'facility:'+cargo.source_facility_id,destination:'facility:'+cargo.destination_facility_id});
 }
}
async function availableVehicle(db,id,mode,sourceSettlement){
 if(!goodId(id))return null;
 const [[lot]]=await db.execute("SELECT v.*,t.equipment_kind FROM world_magitek_equipment_inventory v JOIN world_magitek_equipment_templates t ON t.id=v.equipment_template_id WHERE v.id=? FOR UPDATE",[id]);
 const classes={road:['transport','armored_vehicle'],rail:['locomotive'],air:['airship','capital_airship'],sea:['other'],pack:[]};
 if(!lot||lot.status!=='assigned'||Number(lot.stationed_settlement_id)!==Number(sourceSettlement)||!classes[mode].includes(lot.equipment_kind))return null;
 const [running]=await db.execute("SELECT id FROM world_logistics_shipments WHERE vehicle_lot_id=? AND status IN ('in_transit','disrupted') LIMIT 1",[id]);
 const [frontBusy]=await db.execute("SELECT id FROM world_logistics_front_cargo WHERE vehicle_lot_id=? AND status IN ('in_transit','held') LIMIT 1",[id]);
 if(!(await vehicleReady(db,id)))return null;
 return running.length||frontBusy.length?null:lot;
}
async function dispatch(db,b,actor,contract=null){
 if(!b||!name(b.request_key,64)||!/^[a-zA-Z0-9_-]{12,64}$/.test(b.request_key))return fail(400,'invalid_dispatch_key');
 const [[exists]]=await db.execute('SELECT id,status FROM world_logistics_shipments WHERE request_key=?',[b.request_key]);
 if(exists)return ok({shipment_id:exists.id,status:exists.status,already_submitted:true});
 const sourceId=Number(contract?.source_facility_id??b.source_facility_id),destId=Number(contract?.destination_facility_id??b.destination_facility_id);
 const templateId=Number(contract?.transport_template_id??b.transport_template_id);
 const itemId=contract?.item_id??b.item_id,amount=Number(contract?.quantity??b.quantity);
 if(!goodId(sourceId)||!goodId(destId)||sourceId===destId||!goodId(templateId)||typeof itemId!=='string'||!qty(amount)||amount<0.001)return fail(400,'invalid_freight_manifest');
 const [[transport]]=await db.execute('SELECT * FROM world_logistics_transport_templates WHERE id=? AND active=1',[templateId]);
 if(!transport)return fail(404,'transport_template_not_found');
 if(amount>Number(transport.capacity))return fail(409,'cargo_capacity_exceeded');
 const [points]=await db.execute("SELECT f.id,COALESCE(f.settlement_id,CASE WHEN l.state='operational' THEN l.hub_settlement_id END) AS settlement_id,f.site_id,f.owner_faction_id,f.status,s.controlling_faction_id,s.strategic_state,COALESCE(site.controlling_faction_id,z.controlling_faction_id) AS site_faction_id,CASE WHEN f.site_id IS NOT NULL THEN l.travel_minutes ELSE 0 END AS access_minutes FROM world_industry_facilities f LEFT JOIN world_logistics_depot_links l ON l.facility_id=f.id LEFT JOIN world_industry_sites site ON site.id=f.site_id LEFT JOIN world_zones z ON z.id=site.zone_id LEFT JOIN world_settlements s ON s.id=COALESCE(f.settlement_id,CASE WHEN l.state='operational' THEN l.hub_settlement_id END) WHERE f.id IN (?,?) ORDER BY f.id FOR UPDATE",[sourceId,destId]);
 const source=points.find(p=>Number(p.id)===sourceId),dest=points.find(p=>Number(p.id)===destId);
 if(!source||!dest)return fail(404,'facility_not_found');
 if(!source.settlement_id||!dest.settlement_id)return fail(409,'freight_requires_connected_depots');
 if((source.site_id&&source.site_faction_id!==source.controlling_faction_id)||(dest.site_id&&dest.site_faction_id!==dest.controlling_faction_id))return fail(409,'depot_access_control_mismatch');
 if(!source.controlling_faction_id||!dest.controlling_faction_id||source.owner_faction_id!==source.controlling_faction_id||dest.owner_faction_id!==dest.controlling_faction_id)return fail(409,'freight_requires_valid_territorial_control');
 if(['ruined','captured'].includes(source.status)||['ruined','captured'].includes(dest.status)||['destroyed','abandoned'].includes(source.strategic_state)||['destroyed','abandoned'].includes(dest.strategic_state))return fail(409,'freight_location_unavailable');
 if(source.controlling_faction_id!==dest.controlling_faction_id){
  const a=[source.controlling_faction_id,dest.controlling_faction_id].sort();
  const [access]=await db.execute("SELECT id FROM world_logistics_trade_treaties WHERE faction_a=? AND faction_b=? AND status='active' LIMIT 1",a);
  if(!access.length)return fail(409,'cross_faction_trade_treaty_required');
 }
 if(transport.mode==='air'&&!await airfieldReady(db,source.settlement_id,dest.settlement_id))return fail(409,'airfields_required_at_both_ends');
 let path=await route(db,source.settlement_id,dest.settlement_id,transport.mode);
 if(!path)return fail(409,'no_connected_transport_route');
 let vehicle=null,trainJourney=null;
 if(transport.mode==='rail'){
  if(!goodId(b.train_journey_id))return fail(409,'rail_train_journey_required');
  const [[train]]=await db.execute(`SELECT j.id,j.status,j.train_consist_id,j.cargo_capacity_snapshot,j.departed_at,j.expected_arrival_at,
   r.id AS service_id,r.from_type,r.from_id,r.to_type,r.to_id,r.duration_minutes,
   c.status AS consist_status,c.owner_faction_id
   FROM order_internal_rail_journeys j JOIN order_internal_rail_routes r ON r.id=j.route_id
   JOIN world_magitek_train_consists c ON c.id=j.train_consist_id WHERE j.id=? FOR UPDATE`,[Number(b.train_journey_id)]);
  if(!train||train.status!=='running'||train.consist_status!=='assembled'||train.owner_faction_id!=='eclipse-order'
    ||train.from_type!=='settlement'||train.to_type!=='settlement'
    ||Number(train.from_id)!==Number(source.settlement_id)||Number(train.to_id)!==Number(dest.settlement_id))
   return fail(409,'rail_journey_not_at_route');
  const [[window]]=await db.execute('SELECT TIMESTAMPDIFF(MINUTE,?,UTC_TIMESTAMP()) AS elapsed,? > UTC_TIMESTAMP() AS still_running',[train.departed_at,train.expected_arrival_at]);
  if(!window.still_running||Number(window.elapsed)>30)return fail(409,'rail_loading_window_closed');
  const [[loaded]]=await db.execute("SELECT COALESCE(SUM(quantity),0) AS used FROM world_logistics_shipments WHERE train_journey_id=? AND status<>'cancelled'",[train.id]);
  if(Number(loaded.used)+amount>Number(train.cargo_capacity_snapshot))return fail(409,'train_cargo_capacity_exceeded');
  trainJourney=train;
  path={node_ids:['settlement:'+source.settlement_id,'settlement:'+dest.settlement_id],
   segment_ids:['internal-rail:'+train.service_id],legs:1,duration_minutes:Number(train.duration_minutes)};
 }else{
  vehicle=await availableVehicle(db,b.vehicle_lot_id,transport.mode,source.settlement_id);
  if(!vehicle)return fail(409,'assigned_transport_vehicle_required');
  if(vehicle.owner_faction_id!==source.controlling_faction_id)return fail(409,'vehicle_faction_mismatch');
  const vehicleSpecs=typeof vehicle.specifications==='string'?JSON.parse(vehicle.specifications):vehicle.specifications;
  const physicalCapacity=Number(vehicleSpecs?.cargo_capacity||0)*Number(vehicle.quantity||1);
  if(physicalCapacity<=0||amount>physicalCapacity)return fail(409,'vehicle_cargo_capacity_exceeded');
 }
 const totalLegs=path.legs+(source.site_id?1:0)+(dest.site_id?1:0);
 const originalMinutes=(path.duration_minutes??Number(transport.minutes_per_leg)*path.legs)+Number(source.access_minutes||0)+Number(dest.access_minutes||0);
 const airCosts=transport.mode==='air'?airFreightEconomics({fuelPerLeg:transport.fuel_per_leg,legs:totalLegs,durationMinutes:originalMinutes}):null;
 const totalMinutes=airCosts?.minutes??originalMinutes;
 const fuel=airCosts?.fuel??round(Number(transport.fuel_per_leg)*totalLegs);
 const [[stock]]=await db.execute('SELECT quantity FROM world_industry_stock WHERE facility_id=? AND item_id=? FOR UPDATE',[sourceId,itemId]);
 if(!stock||Number(stock.quantity)<amount)return fail(409,'freight_stock_insufficient');
 if(fuel>0){
  const [[fuelStock]]=await db.execute('SELECT quantity FROM world_industry_stock WHERE facility_id=? AND item_id=? FOR UPDATE',[sourceId,transport.fuel_item_id]);
  if(!fuelStock||Number(fuelStock.quantity)<fuel+(transport.fuel_item_id===itemId?amount:0))return fail(409,'freight_fuel_insufficient');
 }
 const minutes=totalMinutes;
 const [[time]]=trainJourney?await db.execute('SELECT DATE_ADD(?,INTERVAL ? MINUTE) AS due_at',[trainJourney.expected_arrival_at,Number(dest.access_minutes||0)]):await db.execute('SELECT DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE) AS due_at',[minutes]);
 const due=time.due_at;
 if(!due)return fail(409,'invalid_travel_time');
 const [created]=await db.execute('INSERT INTO world_logistics_shipments(request_key,contract_id,source_facility_id,destination_facility_id,transport_template_id,vehicle_lot_id,train_journey_id,item_id,quantity,fuel_item_id,fuel_used,route_segments,route_nodes,mode,due_at,escort_notes,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
 [b.request_key,contract?.id??null,sourceId,destId,templateId,vehicle?.id||null,trainJourney?.id||null,itemId,amount,transport.fuel_item_id||null,fuel,JSON.stringify([...(source.site_id?['depot:'+sourceId]:[]),...path.segment_ids,...(dest.site_id?['depot:'+destId]:[])]),JSON.stringify(path.node_ids),transport.mode,due,b.escort_notes||'',contract?.created_by||actor.id]);
 if(!await ledger(db,sourceId,itemId,-amount,'freight_dispatch',created.insertId,actor))return fail(409,'freight_stock_insufficient');
 if(fuel>0&&!await ledger(db,sourceId,transport.fuel_item_id,-fuel,'freight_fuel',created.insertId,actor))return fail(409,'freight_fuel_insufficient');
 await record(db,created.insertId,'dispatch','Cargo loaded; '+totalLegs+' transport legs',actor);
 if(contract)await db.execute('UPDATE world_logistics_contracts SET last_dispatched_at=UTC_TIMESTAMP() WHERE id=?',[contract.id]);
 return ok({shipment_id:created.insertId,status:'in_transit',due_at:new Date(due).toISOString(),legs:totalLegs});
}
export async function logisticsRoute(pool,req,path,actor){
 if(!['domina','high_command'].includes(actor?.account_role))return fail(403,'command_required');
 if(path.startsWith('/world-admin/logistics/itineraries'))return itineraryRoute(pool,req,path,actor,dispatch,ledger);
 if(path.startsWith('/world-admin/logistics/advanced')||path.startsWith('/world-admin/logistics/airfields')||path.startsWith('/world-admin/logistics/fleet/')||path.startsWith('/world-admin/logistics/risks')||/^\/world-admin\/logistics\/shipments\/\d+\/escort$/.test(path))return advancedLogisticsRoute(pool,req,path,actor);
 if(path==='/world-admin/logistics/movements'&&req.method==='GET')return ok({movements:await movementHistory(pool)});
 if(path==='/world-admin/logistics'&&req.method==='GET'){
  const [templates]=await pool.execute('SELECT * FROM world_logistics_transport_templates ORDER BY name');
  const [contracts]=await pool.execute("SELECT c.*,f.name AS source_name,d.name AS destination_name,t.name AS transport_name,i.name AS item_name FROM world_logistics_contracts c JOIN world_industry_facilities f ON f.id=c.source_facility_id JOIN world_industry_facilities d ON d.id=c.destination_facility_id JOIN world_logistics_transport_templates t ON t.id=c.transport_template_id JOIN world_industry_items i ON i.id=c.item_id ORDER BY c.id DESC LIMIT 200");
  const [shipments]=await pool.execute("SELECT s.*,f.name AS source_name,d.name AS destination_name,t.name AS transport_name,i.name AS item_name FROM world_logistics_shipments s JOIN world_industry_facilities f ON f.id=s.source_facility_id JOIN world_industry_facilities d ON d.id=s.destination_facility_id JOIN world_logistics_transport_templates t ON t.id=s.transport_template_id JOIN world_industry_items i ON i.id=s.item_id ORDER BY s.id DESC LIMIT 200");
  const [stocks]=await pool.execute('SELECT facility_id,item_id,quantity FROM world_industry_stock WHERE quantity>0');
  const [items]=await pool.execute('SELECT id,name,category FROM world_industry_items ORDER BY name');
  const [vehicles]=await pool.execute("SELECT v.id,v.quantity,v.status,v.stationed_settlement_id,v.owner_faction_id,v.specifications,t.name,t.equipment_kind FROM world_magitek_equipment_inventory v JOIN world_magitek_equipment_templates t ON t.id=v.equipment_template_id WHERE v.status IN ('assigned','reserve','damaged') AND v.owner_faction_id='eclipse-order' ORDER BY t.name");
  const assembledTrains=(await trainSummary(pool)).filter(t=>t.status==='assembled'&&t.owner_faction_id==='eclipse-order');
  const [railJourneys]=await pool.execute("SELECT j.id,j.route_id,j.train_consist_id,j.status,j.cargo_capacity_snapshot,j.departed_at,j.expected_arrival_at,c.name AS train_name,r.name AS route_name,r.from_type,r.from_id,r.to_type,r.to_id,r.duration_minutes FROM order_internal_rail_journeys j JOIN order_internal_rail_routes r ON r.id=j.route_id JOIN world_magitek_train_consists c ON c.id=j.train_consist_id WHERE j.status='running' AND j.expected_arrival_at>UTC_TIMESTAMP() ORDER BY j.expected_arrival_at LIMIT 80");
 const [history]=await pool.execute('SELECT shipment_id,action,note,created_at FROM world_logistics_events ORDER BY id DESC LIMIT 120');
  const [civicTypes]=await pool.execute('SELECT * FROM world_logistics_civic_item_types ORDER BY item_id');
  const [civicReceipts]=await pool.execute('SELECT shipment_id,settlement_id,item_id,quantity FROM world_logistics_civic_receipts');
  const [npcRoutes]=await pool.execute("SELECT r.id,r.settlement_id,r.facility_id,r.site_id,r.map_settlement_id,r.travel_hours,r.cargo_capacity,r.enabled,settlement.name AS destination_name,COALESCE(site.name,marker.name) AS source_name FROM world_npc_cargo_routes r JOIN world_settlements settlement ON settlement.id=r.settlement_id LEFT JOIN world_industry_sites site ON site.id=r.site_id LEFT JOIN world_settlements marker ON marker.id=r.map_settlement_id ORDER BY r.id");
  const [npcShipments]=await pool.execute("SELECT s.id,s.route_id,s.settlement_id,s.item_id,s.quantity,s.status,s.dispatched_at,s.arrival_at,s.delivered_at,i.name AS item_name FROM world_npc_cargo_shipments s JOIN world_industry_items i ON i.id=s.item_id ORDER BY s.id DESC LIMIT 120");
  const [npcWarehouse]=await pool.execute("SELECT settlement_id,item_id,quantity FROM world_npc_cargo_warehouse WHERE quantity>0");
  const [depotLinks]=await pool.execute("SELECT l.*,f.name AS facility_name,s.name AS hub_name FROM world_logistics_depot_links l JOIN world_industry_facilities f ON f.id=l.facility_id JOIN world_settlements s ON s.id=l.hub_settlement_id ORDER BY l.facility_id");
  const [insulationNeeds]=await pool.execute("SELECT n.*,p.settlement_id,p.status AS project_status,u.name AS project_name,s.name AS settlement_name FROM world_logistics_insulation_needs n JOIN world_civic_building_projects p ON p.id=n.project_id JOIN world_settlement_upgrades u ON u.id=p.upgrade_id JOIN world_settlements s ON s.id=p.settlement_id WHERE p.status='active' ORDER BY n.project_id DESC");
  const [npcTrades]=await pool.execute('SELECT t.*,a.name AS origin_name,b.name AS destination_name,original.name AS original_destination_name FROM world_npc_trade_shipments t JOIN world_settlements a ON a.id=t.source_settlement_id JOIN world_settlements b ON b.id=t.destination_settlement_id LEFT JOIN world_settlements original ON original.id=t.original_destination_settlement_id ORDER BY t.id DESC LIMIT 120');
  const [npcTradeEvents]=await pool.execute('SELECT shipment_id,action,notes,created_at FROM world_npc_trade_events ORDER BY id DESC LIMIT 120');
  const [allSettlements]=await pool.execute('SELECT id,name,region_id,zone_id,controlling_faction_id FROM world_settlements ORDER BY name');
  const [corridors]=await pool.execute("SELECT c.*,a.name AS origin_name,b.name AS destination_name FROM world_logistics_corridors c JOIN world_settlements a ON a.id=c.origin_settlement_id JOIN world_settlements b ON b.id=c.destination_settlement_id ORDER BY c.id DESC LIMIT 200");
  const [incidents]=await pool.execute("SELECT i.*,s.item_id FROM world_logistics_incidents i JOIN world_logistics_shipments s ON s.id=i.shipment_id ORDER BY i.id DESC LIMIT 120");
  const [treaties]=await pool.execute("SELECT t.*,a.name AS faction_a_name,b.name AS faction_b_name FROM world_logistics_trade_treaties t JOIN order_factions a ON a.id=t.faction_a JOIN order_factions b ON b.id=t.faction_b ORDER BY t.id DESC");
  const [factions]=await pool.execute('SELECT id,name FROM order_factions ORDER BY name');
  const [relations]=await pool.execute('SELECT faction_a,faction_b,trust,tension FROM world_faction_relations ORDER BY faction_a,faction_b');
  const [militaryReceipts]=await pool.execute('SELECT shipment_id,installation_id,item_id,quantity FROM world_logistics_military_receipts');
  const [installationsRaw]=await pool.execute("SELECT i.id,i.name,i.settlement_id,i.state,i.condition_pct,s.strategic_state FROM world_military_installations i JOIN world_settlements s ON s.id=i.settlement_id ORDER BY i.name");
  const installations=installationsRaw.map(i=>({...i,...installationReadiness(i)}));

  return ok({templates,contracts,shipments:shipments.map(s=>({...s,route_segments:typeof s.route_segments==='string'?JSON.parse(s.route_segments):s.route_segments,route_nodes:typeof s.route_nodes==='string'?JSON.parse(s.route_nodes):s.route_nodes,events:history.filter(e=>e.shipment_id===s.id)})),facilities:await facilities(pool),stocks,items,vehicles,assembled_trains:assembledTrains,rail_journeys:railJourneys,civic_types:civicTypes,civic_receipts:civicReceipts,military_receipts:militaryReceipts,installations,npc_routes:npcRoutes,npc_shipments:npcShipments,npc_warehouse:npcWarehouse,corridors,incidents,treaties,factions,relations,depot_links:depotLinks,settlements:allSettlements,insulation_needs:insulationNeeds,npc_trades:npcTrades.map(t=>({...t,events:npcTradeEvents.filter(e=>Number(e.shipment_id)===Number(t.id))}))});
 }
 const insulationMatch=/^\/world-admin\/logistics\/insulation\/(\d+)\/commit$/.exec(path);
 if(insulationMatch&&req.method==='POST')return tx(pool,async db=>{
  const b=await body(req);
  if(!goodId(b?.facility_id)||!qty(b.quantity))return fail(400,'invalid_insulation_delivery');
  const [[need]]=await db.execute("SELECT n.*,p.status,p.settlement_id,p.owner_kind FROM world_logistics_insulation_needs n JOIN world_civic_building_projects p ON p.id=n.project_id WHERE n.project_id=? FOR UPDATE",[Number(insulationMatch[1])]);
  if(!need||need.status!=='active'||need.owner_kind!=='order')return fail(409,'insulation_project_not_active');
  if(Number(need.committed_qty)+Number(b.quantity)>Number(need.required_qty)+0.00001)return fail(409,'insulation_requirement_exceeded');
  const [[depot]]=await db.execute("SELECT f.settlement_id,f.owner_faction_id,s.controlling_faction_id FROM world_industry_facilities f JOIN world_settlements s ON s.id=f.settlement_id WHERE f.id=?",[b.facility_id]);
  if(!depot||Number(depot.settlement_id)!==Number(need.settlement_id)||depot.owner_faction_id!=='eclipse-order'||depot.controlling_faction_id!=='eclipse-order')return fail(409,'insulation_must_arrive_at_order_settlement');
  if(!await ledger(db,b.facility_id,need.item_id,-Number(b.quantity),'project_commit',need.project_id,actor))return fail(409,'insulation_stock_insufficient');
  await db.execute('UPDATE world_logistics_insulation_needs SET committed_qty=committed_qty+? WHERE project_id=?',[b.quantity,need.project_id]);
  return ok({saved:true,remaining:round(Number(need.required_qty)-Number(need.committed_qty)-b.quantity)});
 });
 if(path==='/world-admin/logistics/depots'&&req.method==='POST')return tx(pool,async db=>{
  const b=await body(req);
  if(!goodId(b?.facility_id)||!goodId(b.hub_settlement_id)||!modes.includes(b.mode)||!Number.isInteger(b.travel_minutes)||b.travel_minutes<1||b.travel_minutes>10080||typeof b.construction_item_id!=='string'||!qty(b.construction_quantity))return fail(400,'invalid_depot_access');
  const [[site]]=await db.execute('SELECT f.id,f.owner_faction_id,f.settlement_id,i.zone_id,z.controlling_faction_id FROM world_industry_facilities f JOIN world_industry_sites i ON i.id=f.site_id JOIN world_zones z ON z.id=i.zone_id WHERE f.id=? FOR UPDATE',[b.facility_id]);
  const [[hub]]=await db.execute('SELECT id,zone_id,controlling_faction_id FROM world_settlements WHERE id=?',[b.hub_settlement_id]);
  if(!site||!hub||site.settlement_id||site.zone_id!==hub.zone_id||site.owner_faction_id!==site.controlling_faction_id||site.owner_faction_id!==hub.controlling_faction_id)return fail(409,'depot_requires_same_zone_faction_hub');
  const [[item]]=await db.execute('SELECT id FROM world_industry_items WHERE id=?',[b.construction_item_id]);if(!item)return fail(404,'construction_material_not_found');
  const [result]=await db.execute("INSERT INTO world_logistics_depot_links(facility_id,hub_settlement_id,mode,state,travel_minutes,construction_item_id,construction_quantity,created_by) VALUES(?,?,?,'planned',?,?,?,?)",[b.facility_id,b.hub_settlement_id,b.mode,b.travel_minutes,b.construction_item_id,b.construction_quantity,actor.id]);
  return ok({facility_id:b.facility_id,state:'planned'});
 });
 const depotMatch=/^\/world-admin\/logistics\/depots\/(\d+)\/state$/.exec(path);
 if(depotMatch&&req.method==='POST')return tx(pool,async db=>{
  const b=await body(req);
  if(!['operational','damaged','closed'].includes(b?.state))return fail(400,'invalid_depot_state');
  const [[link]]=await db.execute('SELECT * FROM world_logistics_depot_links WHERE facility_id=? FOR UPDATE',[Number(depotMatch[1])]);
  if(!link)return fail(404,'depot_access_not_found');
  if(b.state==='operational'&&link.state!=='operational'){
   const [[site]]=await db.execute('SELECT f.owner_faction_id,z.controlling_faction_id AS site_faction,s.controlling_faction_id AS hub_faction,z.id AS zone_id,s.zone_id AS hub_zone FROM world_industry_facilities f JOIN world_industry_sites i ON i.id=f.site_id JOIN world_zones z ON z.id=i.zone_id JOIN world_settlements s ON s.id=? WHERE f.id=?',[link.hub_settlement_id,link.facility_id]);
   if(!site||site.owner_faction_id!==site.site_faction||site.owner_faction_id!==site.hub_faction||site.zone_id!==site.hub_zone)return fail(409,'depot_access_ownership_changed');
   if(!await ledger(db,link.facility_id,link.construction_item_id,-Number(link.construction_quantity),'corridor_build',link.facility_id,actor))return fail(409,'depot_construction_materials_insufficient');
  }
  await db.execute('UPDATE world_logistics_depot_links SET state=? WHERE facility_id=?',[b.state,link.facility_id]);
  return ok({state:b.state});
 });
 if(path==='/world-admin/logistics/treaties'&&req.method==='POST'){
  const b=await body(req);
  if(!b||typeof b.faction_a!=='string'||typeof b.faction_b!=='string'||b.faction_a===b.faction_b||!purposes.includes(b.purpose)||typeof b.notes!=='string'||b.notes.length>600)return fail(400,'invalid_trade_treaty');
  return tx(pool,async db=>{
   const [factions]=await db.execute('SELECT id FROM order_factions WHERE id IN (?,?)',[b.faction_a,b.faction_b]);
   if(factions.length!==2)return fail(404,'faction_not_found');
   const [a,z]=[b.faction_a,b.faction_b].sort();
   const [saved]=await db.execute("INSERT INTO world_logistics_trade_treaties(faction_a,faction_b,purpose,notes,created_by) VALUES(?,?,?,?,?)",[a,z,b.purpose,b.notes,actor.id]);
   return ok({id:saved.insertId,status:'proposed'});
  });
 }
 const treatyMatch=/^\/world-admin\/logistics\/treaties\/(\d+)\/status$/.exec(path);
 if(treatyMatch&&req.method==='POST')return tx(pool,async db=>{
  const b=await body(req);
  if(!['active','suspended','retired'].includes(b?.status))return fail(400,'invalid_treaty_status');
  const [[t]]=await db.execute('SELECT * FROM world_logistics_trade_treaties WHERE id=? FOR UPDATE',[Number(treatyMatch[1])]);
  if(!t)return fail(404,'treaty_not_found');
  if(t.status==='retired')return fail(409,'treaty_retired');
  if(b.status==='active'){
   const [[relation]]=await db.execute('SELECT trust,tension FROM world_faction_relations WHERE faction_a=? AND faction_b=?',[t.faction_a,t.faction_b]);
   if(!relation||Number(relation.trust)<40||Number(relation.tension)>65)return fail(409,'faction_relations_do_not_support_trade');
  }
  await db.execute("UPDATE world_logistics_trade_treaties SET status=?,approved_by=IF(?='active',?,approved_by),approved_at=IF(?='active',UTC_TIMESTAMP(),approved_at) WHERE id=?",[b.status,b.status,actor.id,b.status,t.id]);
  return ok({status:b.status});
 });
 if(path==='/world-admin/logistics/corridors'&&req.method==='POST'){
  const b=await body(req);
  if(!b||!name(b.name,140)||!modes.includes(b.mode)||!goodId(b.origin_settlement_id)||!goodId(b.destination_settlement_id)||Number(b.origin_settlement_id)===Number(b.destination_settlement_id)||!Number.isInteger(b.travel_minutes)||b.travel_minutes<1||b.travel_minutes>10080||typeof b.construction_item_id!=='string'||!qty(b.construction_quantity))return fail(400,'invalid_corridor');
  return tx(pool,async db=>{
   const [locations]=await db.execute('SELECT id FROM world_settlements WHERE id IN (?,?)',[b.origin_settlement_id,b.destination_settlement_id]);
   if(locations.length!==2)return fail(404,'location_not_found');
   const [[item]]=await db.execute('SELECT id FROM world_industry_items WHERE id=?',[b.construction_item_id]);if(!item)return fail(404,'construction_material_not_found');
   const [saved]=await db.execute("INSERT INTO world_logistics_corridors(name,origin_settlement_id,destination_settlement_id,mode,state,travel_minutes,construction_item_id,construction_quantity,created_by) VALUES(?,?,?,?,?,?,?,?,?)",[b.name.trim(),b.origin_settlement_id,b.destination_settlement_id,b.mode,'planned',b.travel_minutes,b.construction_item_id,b.construction_quantity,actor.id]);
   return ok({id:saved.insertId,state:'planned'});
  });
 }
 const corridorMatch=/^\/world-admin\/logistics\/corridors\/(\d+)\/state$/.exec(path);
 if(corridorMatch&&req.method==='POST')return tx(pool,async db=>{
  const b=await body(req);
  if(!['planned','operational','damaged','closed'].includes(b?.state))return fail(400,'invalid_corridor_state');
  const [[corridor]]=await db.execute('SELECT * FROM world_logistics_corridors WHERE id=? FOR UPDATE',[Number(corridorMatch[1])]);
  if(!corridor)return fail(404,'corridor_not_found');
  if(b.state==='operational'&&corridor.state!=='operational'){
   if(!goodId(b.facility_id))return fail(400,'construction_supply_facility_required');
   const [[facility]]=await db.execute('SELECT f.id,f.owner_faction_id,f.settlement_id,s.controlling_faction_id FROM world_industry_facilities f JOIN world_settlements s ON s.id=f.settlement_id WHERE f.id=?',[b.facility_id]);
   if(!facility||facility.owner_faction_id!==facility.controlling_faction_id||![Number(corridor.origin_settlement_id),Number(corridor.destination_settlement_id)].includes(Number(facility.settlement_id)))return fail(409,'construction_supplies_must_be_at_corridor_endpoint');
   if(!await ledger(db,facility.id,corridor.construction_item_id,-Number(corridor.construction_quantity),'corridor_build',corridor.id,actor))return fail(409,'corridor_construction_materials_insufficient');
  }
  await db.execute('UPDATE world_logistics_corridors SET state=? WHERE id=?',[b.state,corridor.id]);
  return ok({state:b.state});
 });
 if(path==='/world-admin/logistics/templates'&&req.method==='POST'){
  const b=await body(req);
  if(!b||!['lot','train'].includes(b.fleet_kind)||!goodId(b.fleet_id))return fail(400,'select_manufactured_transport');
  return tx(pool,async db=>{
   let name,mode,capacity,fuelId=null,fuelPer=0;
   const fleetId=Number(b.fleet_id);
   if(b.fleet_kind==='lot'){
    const [[lot]]=await db.execute("SELECT v.id,v.quantity,v.status,v.owner_faction_id,v.specifications,t.name,t.equipment_kind FROM world_magitek_equipment_inventory v JOIN world_magitek_equipment_templates t ON t.id=v.equipment_template_id WHERE v.id=? FOR UPDATE",[fleetId]);
    if(!lot||lot.owner_faction_id!=='eclipse-order'||!['assigned','reserve'].includes(lot.status))return fail(409,'transport_not_in_order_stock');
    const specs=typeof lot.specifications==='string'?JSON.parse(lot.specifications):lot.specifications;
    mode=['transport','armored_vehicle'].includes(lot.equipment_kind)?'road':['airship','capital_airship'].includes(lot.equipment_kind)?'air':null;
    if(!mode)return fail(409,'equipment_not_a_transport');
    capacity=Number(specs?.cargo_capacity||0)*Number(lot.quantity);
    fuelId=specs?.fuel_item_id||null;
    fuelPer=Number(specs?.fuel_per_operation||0);
    name=lot.name;
   }else{
    const train=(await trainSummary(db)).find(t=>Number(t.id)===fleetId);
    if(!train||train.status!=='assembled'||train.owner_faction_id!=='eclipse-order')return fail(409,'assembled_train_not_found');
    mode='rail';capacity=Number(train.cargo_capacity);fuelId=train.fuel_item_id||null;fuelPer=Number(train.fuel_per_operation||0);name=train.name;
   }
   if(!Number.isFinite(capacity)||capacity<=0||capacity>1000000||!Number.isFinite(fuelPer)||fuelPer<0||fuelPer>100000)return fail(409,'transport_has_no_usable_cargo_capacity');
   if(fuelPer&&!fuelId)return fail(409,'fleet_fuel_type_unavailable');
   const column=b.fleet_kind==='lot'?'source_equipment_lot_id':'source_train_consist_id';
   const [[existing]]=await db.execute('SELECT id FROM world_logistics_transport_templates WHERE '+column+'=?',[fleetId]);
   if(existing)return ok({id:existing.id,already_registered:true});
   const [saved]=await db.execute('INSERT INTO world_logistics_transport_templates(name,mode,capacity,minutes_per_leg,fuel_item_id,fuel_per_leg,source_equipment_lot_id,source_train_consist_id,created_by) VALUES(?,?,?,?,?,?,?,?,?)',
    [name,mode,capacity,60,fuelId,fuelPer,b.fleet_kind==='lot'?fleetId:null,b.fleet_kind==='train'?fleetId:null,actor.id]);
   return ok({id:saved.insertId,name,mode,capacity});
  });
 }
 if(path==='/world-admin/logistics/civic/items'&&req.method==='POST'){
  const b=await body(req);
  if(!b||typeof b.item_id!=='string'||!['food','fuel','water','medicine'].includes(b.resource_kind)||(b.resource_kind==='food'&&!name(b.food_group,75)))return fail(400,'invalid_civic_item_classification');
  return tx(pool,async db=>{
   const [[item]]=await db.execute('SELECT id FROM world_industry_items WHERE id=?',[b.item_id]);
   if(!item)return fail(404,'item_not_found');
   const [used]=await db.execute('SELECT shipment_id FROM world_logistics_civic_receipts WHERE item_id=? LIMIT 1',[b.item_id]);
   if(used.length)return fail(409,'civic_item_classification_in_use');
   await db.execute('INSERT INTO world_logistics_civic_item_types(item_id,resource_kind,food_group) VALUES(?,?,?) ON DUPLICATE KEY UPDATE resource_kind=VALUES(resource_kind),food_group=VALUES(food_group)',[b.item_id,b.resource_kind,b.resource_kind==='food'?b.food_group:null]);
   return ok({saved:true});
  });
 }
 if(path==='/world-admin/logistics/contracts'&&req.method==='POST'){
  const b=await body(req);
  if(!name(b?.name,140)||!purposes.includes(b.purpose)||!goodId(b.source_facility_id)||!goodId(b.destination_facility_id)||Number(b.source_facility_id)===Number(b.destination_facility_id)||!goodId(b.transport_template_id)||typeof b.item_id!=='string'||!qty(b.quantity)||!Number.isInteger(b.cadence_days)||b.cadence_days<1||b.cadence_days>365)return fail(400,'invalid_trade_contract');
  return tx(pool,async db=>{
   const [where]=await db.execute('SELECT id FROM world_industry_facilities WHERE id IN (?,?)',[b.source_facility_id,b.destination_facility_id]);if(where.length!==2)return fail(404,'facility_not_found');
   const [[vehicle]]=await db.execute('SELECT id FROM world_logistics_transport_templates WHERE id=? AND active=1',[b.transport_template_id]);if(!vehicle)return fail(404,'transport_template_not_found');
   const [[item]]=await db.execute('SELECT id FROM world_industry_items WHERE id=?',[b.item_id]);if(!item)return fail(404,'item_not_found');
   const [saved]=await db.execute('INSERT INTO world_logistics_contracts(name,purpose,source_facility_id,destination_facility_id,transport_template_id,item_id,quantity,cadence_days,created_by) VALUES(?,?,?,?,?,?,?,?,?)',[b.name.trim(),b.purpose,b.source_facility_id,b.destination_facility_id,b.transport_template_id,b.item_id,b.quantity,b.cadence_days,actor.id]);
   return ok({id:saved.insertId});
  });
 }
 if(path==='/world-admin/logistics/routes/preview'&&req.method==='POST'){
  const b=await body(req);
  if(!goodId(b?.source_facility_id)||!goodId(b.destination_facility_id)||!goodId(b.transport_template_id))return fail(400,'invalid_route_preview');
  const [rows]=await pool.execute('SELECT id,settlement_id FROM world_industry_facilities WHERE id IN (?,?)',[b.source_facility_id,b.destination_facility_id]);
  const [[t]]=await pool.execute('SELECT * FROM world_logistics_transport_templates WHERE id=?',[b.transport_template_id]);
  const a=rows.find(r=>Number(r.id)===Number(b.source_facility_id)),z=rows.find(r=>Number(r.id)===Number(b.destination_facility_id));
  const pathResult=a?.settlement_id&&z?.settlement_id&&t?await route(pool,a.settlement_id,z.settlement_id,t.mode):null;
  const baseDuration=pathResult?(pathResult.duration_minutes??pathResult.legs*Number(t.minutes_per_leg)):null;
  const airQuote=pathResult&&t.mode==='air'?airFreightEconomics({fuelPerLeg:t.fuel_per_leg,legs:pathResult.legs,durationMinutes:baseDuration}):null;
  const airEnabled=t?.mode==='air'&&a?.settlement_id&&z?.settlement_id?await airfieldReady(pool,a.settlement_id,z.settlement_id):true;
  return ok({connected:!!pathResult&&!!airEnabled,route:pathResult,duration_minutes:airQuote?.minutes??baseDuration,fuel_required:airQuote?.fuel??(pathResult?round(pathResult.legs*Number(t.fuel_per_leg)):null)});
 }
 if(path==='/world-admin/logistics/dispatch'&&req.method==='POST')return tx(pool,async db=>dispatch(db,await body(req),actor));
 let match=/^\/world-admin\/logistics\/contracts\/(\d+)\/(dispatch|pause|resume|retire|automation)$/.exec(path);
 if(match&&req.method==='POST')return tx(pool,async db=>{
  const [[contract]]=await db.execute('SELECT * FROM world_logistics_contracts WHERE id=? FOR UPDATE',[Number(match[1])]);
  if(!contract)return fail(404,'contract_not_found');
  const action=match[2];
  if(action==='automation'){
   const b=await body(req);
   if(typeof b?.enabled!=='boolean'||(b.enabled&&!goodId(b.vehicle_lot_id)))return fail(400,'invalid_freight_automation');
   if(b.enabled){
    const [[t]]=await db.execute('SELECT mode FROM world_logistics_transport_templates WHERE id=?',[contract.transport_template_id]);
    const [[place]]=await db.execute('SELECT settlement_id,controlling_faction_id FROM world_industry_facilities f JOIN world_settlements s ON s.id=f.settlement_id WHERE f.id=?',[contract.source_facility_id]);
    if(!t||!place)return fail(409,'auto_dispatch_source_unavailable');
    const vehicle=await availableVehicle(db,b.vehicle_lot_id,t.mode,place.settlement_id);
    if(!vehicle||vehicle.owner_faction_id!==place.controlling_faction_id)return fail(409,'auto_dispatch_vehicle_unavailable');
   }
   await db.execute('UPDATE world_logistics_contracts SET auto_dispatch=?,preferred_vehicle_lot_id=? WHERE id=?',[b.enabled?1:0,b.enabled?Number(b.vehicle_lot_id):null,contract.id]);
   return ok({auto_dispatch:b.enabled});
  }
  if(action==='dispatch'){
   if(contract.status!=='active')return fail(409,'contract_inactive');
   const [[clock]]=await db.execute('SELECT UTC_TIMESTAMP() AS now');
   if(contract.last_dispatched_at&&new Date(clock.now)-new Date(contract.last_dispatched_at)<Number(contract.cadence_days)*86400000)return fail(409,'contract_not_due');
   return dispatch(db,await body(req),actor,contract);
  }
  await db.execute('UPDATE world_logistics_contracts SET status=? WHERE id=?',[action==='pause'?'paused':action==='resume'?'active':'retired',contract.id]);
  return ok({status:action==='pause'?'paused':action==='resume'?'active':'retired'});
 });
 match=/^\/world-admin\/logistics\/shipments\/(\d+)\/military$/.exec(path);
 if(match&&req.method==='POST')return tx(pool,async db=>{
  const id=Number(match[1]),b=await body(req);
  if(!goodId(b?.installation_id))return fail(400,'installation_required');
  const [[shipment]]=await db.execute('SELECT * FROM world_logistics_shipments WHERE id=? FOR UPDATE',[id]);
  if(!shipment)return fail(404,'shipment_not_found');
  if(shipment.status!=='arrived')return fail(409,'shipment_not_received');
  const [[already]]=await db.execute('SELECT installation_id FROM world_logistics_military_receipts WHERE shipment_id=?',[id]);
  if(already)return ok({already_received:true,installation_id:already.installation_id});
  const [[installation]]=await db.execute("SELECT i.id,i.settlement_id,i.state,s.controlling_faction_id FROM world_military_installations i JOIN world_settlements s ON s.id=i.settlement_id WHERE i.id=? FOR UPDATE",[b.installation_id]);
  const [[facility]]=await db.execute('SELECT settlement_id,owner_faction_id FROM world_industry_facilities WHERE id=?',[shipment.destination_facility_id]);
  if(!installation||!facility||Number(installation.settlement_id)!==Number(facility.settlement_id)||facility.owner_faction_id!==installation.controlling_faction_id)return fail(409,'military_destination_mismatch');
  if(['destroyed','abandoned'].includes(installation.state))return fail(409,'installation_cannot_receive_supplies');
  const [[item]]=await db.execute("SELECT id FROM world_industry_items WHERE id=? AND category IN ('supply','equipment','refined')",[shipment.item_id]);
  if(!item)return fail(409,'cargo_not_eligible_for_war_stores');
  if(!await ledger(db,shipment.destination_facility_id,shipment.item_id,-Number(shipment.quantity),'military_delivery',id,actor))return fail(409,'destination_stock_insufficient');
  await db.execute('INSERT INTO world_military_ammunition(installation_id,item_id,quantity) VALUES(?,?,?) ON DUPLICATE KEY UPDATE quantity=quantity+VALUES(quantity)',[installation.id,shipment.item_id,shipment.quantity]);
  await db.execute('INSERT INTO world_logistics_military_receipts(shipment_id,installation_id,item_id,quantity,actor_id) VALUES(?,?,?,?,?)',[id,installation.id,shipment.item_id,shipment.quantity,actor.id]);
  return ok({saved:true,installation_id:installation.id,quantity:shipment.quantity});
 });
 match=/^\/world-admin\/logistics\/shipments\/(\d+)\/civic$/.exec(path);
 if(match&&req.method==='POST')return tx(pool,async db=>{
  const id=Number(match[1]);
  const [[shipment]]=await db.execute('SELECT * FROM world_logistics_shipments WHERE id=? FOR UPDATE',[id]);
  if(!shipment)return fail(404,'shipment_not_found');
  if(shipment.status!=='arrived')return fail(409,'shipment_not_received');
  const [[previous]]=await db.execute('SELECT shipment_id FROM world_logistics_civic_receipts WHERE shipment_id=?',[id]);
  if(previous)return ok({saved:true,already_received:true});
  const [[kind]]=await db.execute('SELECT resource_kind,food_group FROM world_logistics_civic_item_types WHERE item_id=?',[shipment.item_id]);
  if(!kind)return fail(409,'cargo_not_approved_for_civilian_use');
  const [[facility]]=await db.execute('SELECT settlement_id FROM world_industry_facilities WHERE id=?',[shipment.destination_facility_id]);
  if(!facility?.settlement_id)return fail(409,'destination_not_linked_to_settlement');
  const [[settlement]]=await db.execute('SELECT id,population FROM world_settlements WHERE id=? FOR UPDATE',[facility.settlement_id]);
  if(!settlement)return fail(404,'settlement_not_found');
  const [upgrades]=await db.execute('SELECT * FROM world_settlement_upgrades WHERE settlement_id=?',[settlement.id]);
  if(['food','water'].includes(kind.resource_kind)){
   const capacity=civilianStorageCapacity(settlement,upgrades)[kind.resource_kind];
   const [[stockTotal]]=await db.execute('SELECT COALESCE(SUM(quantity),0) AS total FROM world_civic_stock WHERE settlement_id=? AND resource_kind=?',[settlement.id,kind.resource_kind]);
   if(Number(stockTotal.total)+Number(shipment.quantity)>capacity)return fail(409,'civilian_storage_capacity_exceeded');
  }
  const [[existing]]=await db.execute('SELECT resource_kind,food_group FROM world_civic_stock WHERE settlement_id=? AND item_code=? FOR UPDATE',[settlement.id,shipment.item_id]);
  if(existing&&(existing.resource_kind!==kind.resource_kind||String(existing.food_group||'')!==String(kind.food_group||'')))return fail(409,'civilian_goods_classification_conflict');
  if(!await ledger(db,shipment.destination_facility_id,shipment.item_id,-Number(shipment.quantity),'civic_delivery',id,actor))return fail(409,'destination_stock_insufficient');
  const [[item]]=await db.execute('SELECT name FROM world_industry_items WHERE id=?',[shipment.item_id]);
  await db.execute('INSERT INTO world_civic_stock(settlement_id,item_code,item_label,resource_kind,food_group,quantity) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE quantity=quantity+VALUES(quantity)',[settlement.id,shipment.item_id,item.name,kind.resource_kind,kind.food_group,shipment.quantity]);
  await db.execute('INSERT INTO world_civic_movements(settlement_id,item_code,resource_kind,food_group,quantity_delta,reason,actor_id) VALUES(?,?,?,?,?,?,?)',[settlement.id,shipment.item_id,kind.resource_kind,kind.food_group,shipment.quantity,'Freight delivery #'+id,actor.id]);
  await db.execute('INSERT INTO world_logistics_civic_receipts(shipment_id,settlement_id,item_id,quantity,actor_id) VALUES(?,?,?,?,?)',[id,settlement.id,shipment.item_id,shipment.quantity,actor.id]);
  return ok({saved:true,settlement_id:settlement.id,resource_kind:kind.resource_kind});
 });
 match=/^\/world-admin\/logistics\/incidents\/(\d+)\/resolve$/.exec(path);
 if(match&&req.method==='POST')return tx(pool,async db=>{
  const b=await body(req);
  if(!['wait','escort'].includes(b?.decision))return fail(400,'invalid_convoy_decision');
  const [[incident]]=await db.execute('SELECT * FROM world_logistics_incidents WHERE id=? FOR UPDATE',[Number(match[1])]);
  if(!incident)return fail(404,'convoy_incident_not_found');
  if(incident.disposition!=='pending')return fail(409,'incident_already_resolved');
  const [[shipment]]=await db.execute('SELECT * FROM world_logistics_shipments WHERE id=? FOR UPDATE',[incident.shipment_id]);
  if(!shipment||shipment.status!=='disrupted')return fail(409,'convoy_not_waiting');
  let delay=180;
  if(b.decision==='escort'){
   const [[guard]]=await db.execute("SELECT COALESCE(SUM(g.quantity),0) AS troops FROM world_military_installations i JOIN world_military_garrisons g ON g.installation_id=i.id JOIN world_industry_facilities f ON f.settlement_id=i.settlement_id WHERE f.id IN (?,?) AND i.state IN ('operational','damaged') AND i.condition_pct>=25",[shipment.source_facility_id,shipment.destination_facility_id]);
   if(!guard||Number(guard.troops)<1)return fail(409,'escort_garrison_unavailable');
   delay=30;
  }
  await db.execute("UPDATE world_logistics_incidents SET disposition=?,resolved_at=UTC_TIMESTAMP(),resolved_by=? WHERE id=?",[b.decision,actor.id,incident.id]);
  await db.execute("UPDATE world_logistics_shipments SET status='in_transit',due_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? MINUTE),incident_notes='' WHERE id=?",[delay,shipment.id]);
  await record(db,shipment.id,'resume',b.decision==='escort'?'Military escorts assigned; cautious transit':'Convoy sheltering until weather improves',actor);
  return ok({status:'in_transit',delay_minutes:delay});
 });
 match=/^\/world-admin\/logistics\/shipments\/(\d+)\/(arrive|cancel|disrupt|resume)$/.exec(path);
 if(match&&req.method==='POST')return tx(pool,async db=>{
  const id=Number(match[1]),action=match[2],[[s]]=await db.execute('SELECT * FROM world_logistics_shipments WHERE id=? FOR UPDATE',[id]);
  if(!s)return fail(404,'shipment_not_found');
  if(!['in_transit','disrupted'].includes(s.status))return fail(409,'shipment_already_settled');
  const b=await body(req);
  if(action==='disrupt'){
   if(s.status!=='in_transit')return fail(409,'shipment_already_disrupted');
   await db.execute("UPDATE world_logistics_shipments SET status='disrupted',incident_notes=? WHERE id=?",[String(b?.note||'').slice(0,500),id]);
   await record(db,id,'disrupt',b?.note||'Transport interrupted',actor);return ok({status:'disrupted'});
  }
  if(action==='resume'){
   if(s.status!=='disrupted')return fail(409,'shipment_not_disrupted');
   if(s.train_journey_id){const [[train]]=await db.execute('SELECT status FROM order_internal_rail_journeys WHERE id=?',[s.train_journey_id]);if(!train||train.status==='cancelled')return fail(409,'cancelled_train_requires_cargo_recall')}
   const [[incident]]=await db.execute("SELECT id FROM world_logistics_incidents WHERE shipment_id=? AND disposition='pending'",[id]);
   if(incident)return fail(409,'convoy_requires_command_decision');
   await db.execute("UPDATE world_logistics_shipments SET status='in_transit' WHERE id=?",[id]);
   await record(db,id,'resume',b?.note||'Journey resumed',actor);return ok({status:'in_transit'});
  }
  if(action==='arrive'){
   if(s.status!=='in_transit')return fail(409,'shipment_disrupted');
   const [[clock]]=await db.execute('SELECT UTC_TIMESTAMP() AS now');
   if(new Date(clock.now)<new Date(s.due_at))return fail(409,'transport_not_arrived_yet');
   if(await railJourneyHold(db,s,actor))return ok({status:'disrupted',reason:'rail_journey_stopped'});
   const [[weatherChecked]]=await db.execute('SELECT id FROM world_logistics_incidents WHERE shipment_id=?',[id]);
   if(!weatherChecked){
    const currentWeather=await weatherForShipment(db,s);
    const event=shouldInterruptForWeather(currentWeather,id);
    if(event){
     await db.execute('INSERT INTO world_logistics_incidents(shipment_id,incident_type,severity,weather_snapshot) VALUES(?,?,?,?)',[id,event,event==='blizzard'?3:1,String(currentWeather)]);
     await db.execute("UPDATE world_logistics_shipments SET status='disrupted',incident_notes=? WHERE id=?",[event==='blizzard'?'Blizzard blocks the convoy':'Snowstorm delays delivery',id]);
     await record(db,id,'disrupt','Weather interruption requires convoy orders',actor);
     return ok({status:'disrupted',incident:event});
    }
   }
   const [destination]=await db.execute("SELECT f.status,s.strategic_state FROM world_industry_facilities f JOIN world_settlements s ON s.id=f.settlement_id WHERE f.id=?",[s.destination_facility_id]);
   if(!destination.length||['destroyed','abandoned'].includes(destination[0].strategic_state))return fail(409,'destination_unavailable');
   if(!await ledger(db,s.destination_facility_id,s.item_id,Number(s.quantity),'freight_arrival',id,actor))return fail(409,'delivery_failed');
    await stageItineraryArrival(db,s,ledger,actor);
   await db.execute("UPDATE world_logistics_shipments SET status='arrived',arrived_at=UTC_TIMESTAMP() WHERE id=?",[id]);
   await record(db,id,'arrival','Cargo received at destination',actor);return ok({status:'arrived'});
  }
  if(!await ledger(db,s.source_facility_id,s.item_id,Number(s.quantity),'freight_refund',id,actor))return fail(409,'refund_failed');
   await handleItineraryRecall(db,s,ledger,actor);
  await db.execute("UPDATE world_logistics_shipments SET status='cancelled' WHERE id=?",[id]);
  await record(db,id,'cancel',b?.note||'Shipment returned to origin; fuel not refunded',actor);
  return ok({status:'cancelled'});
 });
 return fail(404,'logistics_route_not_found');
}

/** Clock-driven delivery. Every manifest is locked and credited at most once.
 * Disrupted journeys wait for staff review; no automated loss, harm, or territory change. */
export async function runLogisticsAutomation(pool){
 if(!pool)return {arrived:0,disrupted:0};
 const [due]=await pool.execute("SELECT id FROM world_logistics_shipments WHERE status='in_transit' AND due_at<=UTC_TIMESTAMP() ORDER BY due_at,id LIMIT 30");
 let arrived=0,disrupted=0,dispatched=0;
 for(const row of due){
  const result=await tx(pool,async db=>{
   const [[shipment]]=await db.execute('SELECT * FROM world_logistics_shipments WHERE id=? FOR UPDATE',[row.id]);
   if(!shipment||shipment.status!=='in_transit')return ok({skipped:true});
   if(await railJourneyHold(db,shipment,{id:null}))return ok({disrupted:true});
   const [[priorIncident]]=await db.execute('SELECT id FROM world_logistics_incidents WHERE shipment_id=?',[shipment.id]);
   if(!priorIncident){
    const currentWeather=await weatherForShipment(db,shipment);
    const incidentType=shouldInterruptForWeather(currentWeather,shipment.id);
    if(incidentType){
     await db.execute("INSERT INTO world_logistics_incidents(shipment_id,incident_type,severity,weather_snapshot) VALUES(?,?,?,?)",[shipment.id,incidentType,incidentType==='blizzard'?3:1,String(currentWeather)]);
     await db.execute("UPDATE world_logistics_shipments SET status='disrupted',incident_notes=? WHERE id=?",[incidentType==='blizzard'?'Blizzard has blocked the convoy':'Heavy snowfall has slowed the convoy',shipment.id]);
     await record(db,shipment.id,'disrupt','Weather interruption requiring a convoy order',{id:null});
     return ok({disrupted:true});
    }
   }
   const [[place]]=await db.execute("SELECT f.status,f.owner_faction_id,s.controlling_faction_id,s.strategic_state FROM world_industry_facilities f JOIN world_settlements s ON s.id=f.settlement_id WHERE f.id=?",[shipment.destination_facility_id]);
   if(!place||!place.controlling_faction_id||place.controlling_faction_id!==place.owner_faction_id||['destroyed','abandoned'].includes(place.strategic_state)||['ruined','captured'].includes(place.status)){
    await db.execute("UPDATE world_logistics_shipments SET status='disrupted',incident_notes='Destination inaccessible; awaiting command review' WHERE id=?",[shipment.id]);
    await record(db,shipment.id,'disrupt','Destination inaccessible; no cargo lost', {id:null});
    return ok({disrupted:true});
   }
   if(!await ledger(db,shipment.destination_facility_id,shipment.item_id,Number(shipment.quantity),'freight_arrival',shipment.id,{id:null}))return fail(409,'destination_inventory_unavailable');
    await stageItineraryArrival(db,shipment,ledger,{id:null});
   await db.execute("UPDATE world_logistics_shipments SET status='arrived',arrived_at=UTC_TIMESTAMP() WHERE id=? AND status='in_transit'",[shipment.id]);
   await record(db,shipment.id,'arrival','Scheduled cargo arrival',{id:null});
   return ok({arrived:true});
  });
  if(result.body.arrived)arrived++;
  if(result.body.disrupted)disrupted++;
 }
 const [scheduled]=await pool.execute("SELECT id FROM world_logistics_contracts WHERE auto_dispatch=1 AND status='active' AND preferred_vehicle_lot_id IS NOT NULL AND (last_dispatched_at IS NULL OR last_dispatched_at<=DATE_SUB(UTC_TIMESTAMP(),INTERVAL cadence_days DAY)) ORDER BY id LIMIT 15");
 for(const scheduledContract of scheduled){
  const output=await tx(pool,async db=>{
   const [[contract]]=await db.execute('SELECT * FROM world_logistics_contracts WHERE id=? FOR UPDATE',[scheduledContract.id]);
   if(!contract||!contract.auto_dispatch||contract.status!=='active'||!contract.preferred_vehicle_lot_id)return ok({skipped:true});
   const [[due]]=await db.execute('SELECT IF(? IS NULL OR ?<=DATE_SUB(UTC_TIMESTAMP(),INTERVAL ? DAY),1,0) AS due',[contract.last_dispatched_at,contract.last_dispatched_at,contract.cadence_days]);
   if(!due.due)return ok({skipped:true});
   const [[clock]]=await db.execute("SELECT DATE_FORMAT(UTC_TIMESTAMP(),'%Y%m%d') AS day");
   return dispatch(db,{request_key:'auto-'+contract.id+'-'+clock.day,vehicle_lot_id:contract.preferred_vehicle_lot_id,escort_notes:'Scheduled trade convoy'}, {id:null},contract);
  });
  if(output.status===200&&output.body.shipment_id&&!output.body.already_submitted)dispatched++;
 }
 return {arrived,disrupted,dispatched};
}

/** Independent NPC food relief is bounded by actual reserves, workers, mapped routes and diplomatic access.
 * Food is removed on departure and credited only after arrival, once per source/day.
 * A failed destination holds cargo, never creates replacement inventory.
 */
export async function runNpcTradeAutomation(pool){
 if(!pool)return {dispatched:0,delivered:0,held:0,redirected:0,returned:0};
 let delivered=0,held=0,dispatched=0,redirected=0,returned=0;
 const [due]=await pool.execute("SELECT id FROM world_npc_trade_shipments WHERE status='in_transit' AND due_at<=UTC_TIMESTAMP() ORDER BY due_at,id LIMIT 20");
 for(const row of due){
  const output=await tx(pool,async db=>{
   const [[t]]=await db.execute('SELECT * FROM world_npc_trade_shipments WHERE id=? FOR UPDATE',[row.id]);
   if(!t||t.status!=='in_transit')return ok({skipped:true});
   const [[target]]=await db.execute("SELECT s.id,s.population,s.controlling_faction_id,s.strategic_state,a.food_units FROM world_settlements s JOIN world_settlement_autosim a ON a.settlement_id=s.id WHERE s.id=? FOR UPDATE",[t.destination_settlement_id]);
   const [[origin]]=await db.execute('SELECT controlling_faction_id FROM world_settlements WHERE id=?',[t.source_settlement_id]);
   if(!target||!origin||origin.controlling_faction_id!==t.origin_faction_id||target.controlling_faction_id!==t.destination_faction_id||['destroyed','abandoned'].includes(target.strategic_state)){
    await db.execute("UPDATE world_npc_trade_shipments SET status='held',held_at=UTC_TIMESTAMP() WHERE id=?",[t.id]);
     await db.execute("INSERT INTO world_npc_trade_events(shipment_id,action,notes) VALUES(?,'hold',?)",[t.id,'Destination no longer accepts the caravan']);return ok({held:true});
   }
   const [buildings]=await db.execute('SELECT * FROM world_settlement_upgrades WHERE settlement_id=?',[target.id]);
   const cap=civilianStorageCapacity(target,buildings).food;
   if(Number(target.food_units)+Number(t.amount)>cap){
    await db.execute("UPDATE world_npc_trade_shipments SET status='held',held_at=UTC_TIMESTAMP() WHERE id=?",[t.id]);
     await db.execute("INSERT INTO world_npc_trade_events(shipment_id,action,notes) VALUES(?,'hold',?)",[t.id,'Destination food storage is full']);return ok({held:true});
   }
   await db.execute('UPDATE world_settlement_autosim SET food_units=food_units+? WHERE settlement_id=?',[t.amount,target.id]);
   await db.execute("UPDATE world_npc_trade_shipments SET status='delivered',delivered_at=UTC_TIMESTAMP() WHERE id=?",[t.id]);
   return ok({delivered:true});
  });
  if(output.body.delivered)delivered++;if(output.body.held)held++;
 }
 const [stalled]=await pool.execute("SELECT id FROM world_npc_trade_shipments WHERE status='held' ORDER BY held_at,id LIMIT 20");
 for(const row of stalled){
  const output=await tx(pool,async db=>{
   const [[caravan]]=await db.execute('SELECT * FROM world_npc_trade_shipments WHERE id=? FOR UPDATE',[row.id]);
   if(!caravan||caravan.status!=='held')return ok({skipped:true});
   const [[source]]=await db.execute("SELECT s.*,a.food_units FROM world_settlements s JOIN world_settlement_autosim a ON a.settlement_id=s.id WHERE s.id=? FOR UPDATE",[caravan.source_settlement_id]);
   if(!source||source.controlling_faction_id!==caravan.origin_faction_id)return ok({skipped:true});
   if(Number(caravan.reroute_count)<1){
    const [alternatives]=await db.execute("SELECT s.id,s.population,s.controlling_faction_id,a.food_units FROM world_settlements s JOIN world_settlement_autosim a ON a.settlement_id=s.id WHERE s.id NOT IN (?,?) AND s.controlling_faction_id IS NOT NULL AND s.controlling_faction_id<>'eclipse-order' AND s.population>0 AND s.strategic_state NOT IN ('destroyed','abandoned') AND a.mode='automatic' AND a.paused=0 AND a.food_units<s.population*2 ORDER BY a.food_units ASC LIMIT 12",[caravan.source_settlement_id,caravan.destination_settlement_id]);
    for(const target of alternatives){
     if(source.controlling_faction_id!==target.controlling_faction_id){
      const pair=[source.controlling_faction_id,target.controlling_faction_id].sort();
      const [access]=await db.execute("SELECT id FROM world_logistics_trade_treaties WHERE faction_a=? AND faction_b=? AND status='active' AND purpose IN ('trade','relief') LIMIT 1",pair);
      if(!access.length)continue;
     }
     const [duplicate]=await db.execute('SELECT id FROM world_npc_trade_shipments WHERE source_settlement_id=? AND destination_settlement_id=? AND departed_on=? LIMIT 1',[caravan.source_settlement_id,target.id,caravan.departed_on]);
     if(duplicate.length)continue;
     const [buildings]=await db.execute('SELECT * FROM world_settlement_upgrades WHERE settlement_id=?',[target.id]);
     if(Number(target.food_units)+Number(caravan.amount)>civilianStorageCapacity(target,buildings).food)continue;
     const path=await route(db,caravan.destination_settlement_id,target.id,'pack');
     if(!path)continue;
     const eta=path.duration_minutes??path.legs*120;
     await db.execute("UPDATE world_npc_trade_shipments SET original_destination_settlement_id=COALESCE(original_destination_settlement_id,destination_settlement_id),destination_settlement_id=?,destination_faction_id=?,route_json=?,due_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? MINUTE),status='in_transit',held_at=NULL,reroute_count=reroute_count+1 WHERE id=?",
      [target.id,target.controlling_faction_id,JSON.stringify(path.segment_ids),eta,caravan.id]);
     await db.execute("INSERT INTO world_npc_trade_events(shipment_id,action,notes) VALUES(?,'redirect',?)",[caravan.id,'Caravan redirected to settlement '+target.id+' using mapped roads']);
     return ok({redirected:true});
    }
   }
   const [[age]]=await db.execute('SELECT IF(held_at<=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 24 HOUR),1,0) AS ready FROM world_npc_trade_shipments WHERE id=?',[caravan.id]);
   if(!age.ready||['destroyed','abandoned'].includes(source.strategic_state))return ok({skipped:true});
   const [[stock]]=await db.execute('SELECT food_units FROM world_settlement_autosim WHERE settlement_id=? FOR UPDATE',[source.id]);
   const [upgrades]=await db.execute('SELECT * FROM world_settlement_upgrades WHERE settlement_id=?',[source.id]);
   if(Number(stock.food_units)+Number(caravan.amount)>civilianStorageCapacity(source,upgrades).food)return ok({skipped:true});
   const returnPath=await route(db,caravan.destination_settlement_id,source.id,'pack');
   if(!returnPath)return ok({skipped:true});
   await db.execute('UPDATE world_settlement_autosim SET food_units=food_units+? WHERE settlement_id=?',[caravan.amount,source.id]);
   await db.execute("UPDATE world_npc_trade_shipments SET status='returned' WHERE id=?",[caravan.id]);
   await db.execute("INSERT INTO world_npc_trade_events(shipment_id,action,notes) VALUES(?,'return',?)",[caravan.id,'Unreceived cargo returned to original settlement reserves']);
   return ok({returned:true});
  });
  if(output.body.redirected)redirected++;
  if(output.body.returned)returned++;
 }
 const [sources]=await pool.execute("SELECT s.id,s.region_id,s.controlling_faction_id,s.population,s.workforce,a.food_units FROM world_settlements s JOIN world_settlement_autosim a ON a.settlement_id=s.id WHERE s.controlling_faction_id IS NOT NULL AND s.controlling_faction_id<>'eclipse-order' AND s.workforce>0 AND a.mode='automatic' AND a.paused=0 AND a.food_units>GREATEST(20,s.population*4) ORDER BY a.food_units DESC LIMIT 25");
 const [targets]=await pool.execute("SELECT s.id,s.region_id,s.controlling_faction_id,s.population,a.food_units FROM world_settlements s JOIN world_settlement_autosim a ON a.settlement_id=s.id WHERE s.controlling_faction_id IS NOT NULL AND s.controlling_faction_id<>'eclipse-order' AND s.population>0 AND a.mode='automatic' AND a.paused=0 AND a.food_units<s.population*2 ORDER BY a.food_units ASC LIMIT 25");
 for(const source of sources){
  const destination=targets.find(t=>Number(t.id)!==Number(source.id));
  if(!destination)continue;
  const output=await tx(pool,async db=>{
   const [[origin]]=await db.execute("SELECT s.id,s.population,s.workforce,s.controlling_faction_id,s.strategic_state,a.food_units FROM world_settlements s JOIN world_settlement_autosim a ON a.settlement_id=s.id WHERE s.id=? FOR UPDATE",[source.id]);
   const [[dest]]=await db.execute("SELECT s.id,s.population,s.controlling_faction_id,s.strategic_state,a.food_units FROM world_settlements s JOIN world_settlement_autosim a ON a.settlement_id=s.id WHERE s.id=? FOR UPDATE",[destination.id]);
   if(!origin||!dest||!origin.controlling_faction_id||!dest.controlling_faction_id||['destroyed','abandoned'].includes(origin.strategic_state)||['destroyed','abandoned'].includes(dest.strategic_state))return ok({skipped:true});
   if(origin.controlling_faction_id!==dest.controlling_faction_id){
    const pair=[origin.controlling_faction_id,dest.controlling_faction_id].sort();
    const [treaty]=await db.execute("SELECT id FROM world_logistics_trade_treaties WHERE faction_a=? AND faction_b=? AND status='active' AND purpose IN ('trade','relief') LIMIT 1",pair);
    if(!treaty.length)return ok({skipped:true});
   }
   const [earlier]=await db.execute('SELECT id FROM world_npc_trade_shipments WHERE source_settlement_id=? AND departed_on=UTC_DATE() LIMIT 1',[origin.id]);
   if(earlier.length)return ok({skipped:true});
   const available=Math.max(0,Number(origin.food_units)-Math.max(20,Number(origin.population)*4));
   const needed=Math.max(0,Number(dest.population)*4-Number(dest.food_units));
   const carrying=Math.max(0,Math.min(80,Math.floor(Number(origin.workforce)*2)));
   const amount=Math.floor(Math.min(available,needed,carrying));
   if(amount<=0)return ok({skipped:true});
   const link=await route(db,origin.id,dest.id,'pack');
   if(!link)return ok({skipped:true});
   const eta=link.duration_minutes??link.legs*120;
   const [[clock]]=await db.execute("SELECT DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? MINUTE) AS due_at",[eta]);
   await db.execute('UPDATE world_settlement_autosim SET food_units=food_units-? WHERE settlement_id=? AND food_units>=?',[amount,origin.id,amount]);
   await db.execute('INSERT INTO world_npc_trade_shipments(source_settlement_id,destination_settlement_id,amount,origin_faction_id,destination_faction_id,route_json,departed_on,due_at) VALUES(?,?,?,?,?,?,UTC_DATE(),?)',[origin.id,dest.id,amount,origin.controlling_faction_id,dest.controlling_faction_id,JSON.stringify(link.segment_ids),clock.due_at]);
   return ok({dispatched:true});
  });
  if(output.body.dispatched)dispatched++;
 }
 return {dispatched,delivered,held,redirected,returned};
}
