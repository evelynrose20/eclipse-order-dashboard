const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const modes=['road','rail','air','sea','pack'],purposes=['trade','relief','military','industry'];
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
 const [rows]=await db.execute("SELECT f.id,f.name,f.settlement_id,f.site_id,f.status,f.owner_faction_id,s.name AS settlement_name,s.controlling_faction_id,s.region_id,s.zone_id,s.strategic_state FROM world_industry_facilities f LEFT JOIN world_settlements s ON s.id=f.settlement_id ORDER BY f.name");
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
async function route(db,from,to,mode){
 const [[a],[b]]=await Promise.all([
  db.execute('SELECT region_id,zone_id FROM world_settlements WHERE id=?',[from]),
  db.execute('SELECT region_id,zone_id FROM world_settlements WHERE id=?',[to])
 ]);
 if(!a.length||!b.length)return null;
 // Current route graph is region-scoped: a cross-region itinerary needs explicit future network links.
 if(Number(a[0].region_id)!==Number(b[0].region_id))return null;
 const [nodes]=await db.execute('SELECT id,settlement_id FROM world_route_nodes WHERE region_id=?',[a[0].region_id]);
 const [segments]=await db.execute('SELECT id,from_node_id,to_node_id,route_type FROM world_route_segments WHERE region_id=?',[a[0].region_id]);
 const graph=freightPath(nodes,segments,from,to,mode);
 if(graph)return graph;
 // Older map routes remain valid as complete individual legs, not imagined map links.
 const [legacy]=await db.execute('SELECT id,from_settlement_id,to_settlement_id,route_type FROM world_map_routes WHERE region_id=?',[a[0].region_id]);
 const links=legacy.filter(r=>allowed[mode].includes(r.route_type));
 const oldNodes=[...new Set(links.flatMap(r=>[r.from_settlement_id,r.to_settlement_id]))].map(id=>({id:Number(id),settlement_id:Number(id)}));
 const oldEdges=links.map(e=>({id:'legacy:'+e.id,from_node_id:Number(e.from_settlement_id),to_node_id:Number(e.to_settlement_id),route_type:e.route_type}));
 return freightPath(oldNodes,oldEdges,from,to,mode);
}
async function record(db,shipment,action,note,actor){
 await db.execute('INSERT INTO world_logistics_events(shipment_id,action,note,actor_id) VALUES(?,?,?,?)',[shipment,action,String(note||'').slice(0,500),actor.id]);
}
async function availableVehicle(db,id,mode,sourceSettlement){
 if(!goodId(id))return null;
 const [[lot]]=await db.execute("SELECT v.*,t.equipment_kind FROM world_magitek_equipment_inventory v JOIN world_magitek_equipment_templates t ON t.id=v.equipment_template_id WHERE v.id=? FOR UPDATE",[id]);
 const classes={road:['transport','armored_vehicle'],rail:['locomotive'],air:['airship','capital_airship'],sea:['other'],pack:[]};
 if(!lot||lot.status!=='assigned'||Number(lot.stationed_settlement_id)!==Number(sourceSettlement)||!classes[mode].includes(lot.equipment_kind))return null;
 const [running]=await db.execute("SELECT id FROM world_logistics_shipments WHERE vehicle_lot_id=? AND status IN ('in_transit','disrupted') LIMIT 1",[id]);
 return running.length?null:lot;
}
async function dispatch(db,b,actor,contract=null){
 if(!name(b.request_key,64)||!/^[a-zA-Z0-9_-]{12,64}$/.test(b.request_key))return fail(400,'invalid_dispatch_key');
 const [[exists]]=await db.execute('SELECT id,status FROM world_logistics_shipments WHERE request_key=?',[b.request_key]);
 if(exists)return ok({shipment_id:exists.id,status:exists.status,already_submitted:true});
 const sourceId=Number(contract?.source_facility_id??b.source_facility_id),destId=Number(contract?.destination_facility_id??b.destination_facility_id);
 const templateId=Number(contract?.transport_template_id??b.transport_template_id);
 const itemId=contract?.item_id??b.item_id,amount=Number(contract?.quantity??b.quantity);
 if(!goodId(sourceId)||!goodId(destId)||sourceId===destId||!goodId(templateId)||typeof itemId!=='string'||!qty(amount)||amount<0.001)return fail(400,'invalid_freight_manifest');
 const [[transport]]=await db.execute('SELECT * FROM world_logistics_transport_templates WHERE id=? AND active=1',[templateId]);
 if(!transport)return fail(404,'transport_template_not_found');
 if(amount>Number(transport.capacity))return fail(409,'cargo_capacity_exceeded');
 const [points]=await db.execute("SELECT f.id,f.settlement_id,f.owner_faction_id,f.status,s.controlling_faction_id,s.strategic_state FROM world_industry_facilities f LEFT JOIN world_settlements s ON s.id=f.settlement_id WHERE f.id IN (?,?) ORDER BY f.id FOR UPDATE",[sourceId,destId]);
 const source=points.find(p=>Number(p.id)===sourceId),dest=points.find(p=>Number(p.id)===destId);
 if(!source||!dest)return fail(404,'facility_not_found');
 if(!source.settlement_id||!dest.settlement_id)return fail(409,'freight_requires_settlement_linked_facilities');
 if(!source.controlling_faction_id||!dest.controlling_faction_id||source.owner_faction_id!==source.controlling_faction_id||dest.owner_faction_id!==dest.controlling_faction_id)return fail(409,'freight_requires_valid_territorial_control');
 if(['ruined','captured'].includes(source.status)||['ruined','captured'].includes(dest.status)||['destroyed','abandoned'].includes(source.strategic_state)||['destroyed','abandoned'].includes(dest.strategic_state))return fail(409,'freight_location_unavailable');
 const path=await route(db,source.settlement_id,dest.settlement_id,transport.mode);
 if(!path)return fail(409,'no_connected_transport_route');
 const vehicle=await availableVehicle(db,b.vehicle_lot_id,transport.mode,source.settlement_id);
 if(!vehicle)return fail(409,'assigned_transport_vehicle_required');
 if(vehicle.owner_faction_id!==source.controlling_faction_id)return fail(409,'vehicle_faction_mismatch');
 const fuel=round(Number(transport.fuel_per_leg)*path.legs);
 const [[stock]]=await db.execute('SELECT quantity FROM world_industry_stock WHERE facility_id=? AND item_id=? FOR UPDATE',[sourceId,itemId]);
 if(!stock||Number(stock.quantity)<amount)return fail(409,'freight_stock_insufficient');
 if(fuel>0){
  const [[fuelStock]]=await db.execute('SELECT quantity FROM world_industry_stock WHERE facility_id=? AND item_id=? FOR UPDATE',[sourceId,transport.fuel_item_id]);
  if(!fuelStock||Number(fuelStock.quantity)<fuel+(transport.fuel_item_id===itemId?amount:0))return fail(409,'freight_fuel_insufficient');
 }
 const minutes=Number(transport.minutes_per_leg)*path.legs;
 const [[now]]=await db.execute('SELECT UTC_TIMESTAMP() AS now');
 const due=new Date(new Date(now.now+'Z').getTime()+minutes*60000);
 if(!Number.isFinite(due.getTime()))return fail(409,'invalid_travel_time');
 const [created]=await db.execute('INSERT INTO world_logistics_shipments(request_key,contract_id,source_facility_id,destination_facility_id,transport_template_id,vehicle_lot_id,item_id,quantity,fuel_item_id,fuel_used,route_segments,route_nodes,mode,due_at,escort_notes,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
 [b.request_key,contract?.id??null,sourceId,destId,templateId,vehicle.id,itemId,amount,transport.fuel_item_id||null,fuel,JSON.stringify(path.segment_ids),JSON.stringify(path.node_ids),transport.mode,due,b.escort_notes||'',actor.id]);
 if(!await ledger(db,sourceId,itemId,-amount,'freight_dispatch',created.insertId,actor))return fail(409,'freight_stock_insufficient');
 if(fuel>0&&!await ledger(db,sourceId,transport.fuel_item_id,-fuel,'freight_fuel',created.insertId,actor))return fail(409,'freight_fuel_insufficient');
 await record(db,created.insertId,'dispatch','Cargo loaded; '+path.legs+' route legs',actor);
 if(contract)await db.execute('UPDATE world_logistics_contracts SET last_dispatched_at=UTC_TIMESTAMP() WHERE id=?',[contract.id]);
 return ok({shipment_id:created.insertId,status:'in_transit',due_at:due.toISOString(),legs:path.legs});
}
export async function logisticsRoute(pool,req,path,actor){
 if(!['domina','high_command'].includes(actor?.account_role))return fail(403,'command_required');
 if(path==='/world-admin/logistics'&&req.method==='GET'){
  const [templates]=await pool.execute('SELECT * FROM world_logistics_transport_templates ORDER BY name');
  const [contracts]=await pool.execute("SELECT c.*,f.name AS source_name,d.name AS destination_name,t.name AS transport_name,i.name AS item_name FROM world_logistics_contracts c JOIN world_industry_facilities f ON f.id=c.source_facility_id JOIN world_industry_facilities d ON d.id=c.destination_facility_id JOIN world_logistics_transport_templates t ON t.id=c.transport_template_id JOIN world_industry_items i ON i.id=c.item_id ORDER BY c.id DESC LIMIT 200");
  const [shipments]=await pool.execute("SELECT s.*,f.name AS source_name,d.name AS destination_name,t.name AS transport_name,i.name AS item_name FROM world_logistics_shipments s JOIN world_industry_facilities f ON f.id=s.source_facility_id JOIN world_industry_facilities d ON d.id=s.destination_facility_id JOIN world_logistics_transport_templates t ON t.id=s.transport_template_id JOIN world_industry_items i ON i.id=s.item_id ORDER BY s.id DESC LIMIT 200");
  const [stocks]=await pool.execute('SELECT facility_id,item_id,quantity FROM world_industry_stock WHERE quantity>0');
  const [items]=await pool.execute('SELECT id,name,category FROM world_industry_items ORDER BY name');
  const [vehicles]=await pool.execute("SELECT v.id,v.quantity,v.status,v.stationed_settlement_id,v.owner_faction_id,t.name,t.equipment_kind FROM world_magitek_equipment_inventory v JOIN world_magitek_equipment_templates t ON t.id=v.equipment_template_id WHERE v.status='assigned' ORDER BY t.name");
  const [history]=await pool.execute('SELECT shipment_id,action,note,created_at FROM world_logistics_events ORDER BY id DESC LIMIT 120');
  return ok({templates,contracts,shipments:shipments.map(s=>({...s,route_segments:typeof s.route_segments==='string'?JSON.parse(s.route_segments):s.route_segments,route_nodes:typeof s.route_nodes==='string'?JSON.parse(s.route_nodes):s.route_nodes,events:history.filter(e=>e.shipment_id===s.id)})),facilities:await facilities(pool),stocks,items,vehicles});
 }
 if(path==='/world-admin/logistics/templates'&&req.method==='POST'){
  const b=await body(req);
  if(!name(b?.name,120)||!modes.includes(b.mode)||!qty(b.capacity)||!Number.isInteger(b.minutes_per_leg)||b.minutes_per_leg<1||b.minutes_per_leg>10080||typeof b.fuel_per_leg!=='number'||b.fuel_per_leg<0||b.fuel_per_leg>100000||Math.round(b.fuel_per_leg*1000)!==b.fuel_per_leg||b.fuel_per_leg>0&&!b.fuel_item_id)return fail(400,'invalid_transport_template');
  return tx(pool,async db=>{
   if(b.fuel_item_id){const [[item]]=await db.execute('SELECT id FROM world_industry_items WHERE id=?',[b.fuel_item_id]);if(!item)return fail(400,'unknown_fuel_item')}
   const [saved]=await db.execute('INSERT INTO world_logistics_transport_templates(name,mode,capacity,minutes_per_leg,fuel_item_id,fuel_per_leg,created_by) VALUES(?,?,?,?,?,?,?)',[b.name.trim(),b.mode,b.capacity,b.minutes_per_leg,b.fuel_item_id||null,b.fuel_per_leg,actor.id]);
   return ok({id:saved.insertId});
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
  return ok({connected:!!pathResult,route:pathResult,duration_minutes:pathResult?pathResult.legs*Number(t.minutes_per_leg):null,fuel_required:pathResult?round(pathResult.legs*Number(t.fuel_per_leg)):null});
 }
 if(path==='/world-admin/logistics/dispatch'&&req.method==='POST')return tx(pool,async db=>dispatch(db,await body(req),actor));
 let match=/^\/world-admin\/logistics\/contracts\/(\d+)\/(dispatch|pause|resume|retire)$/.exec(path);
 if(match&&req.method==='POST')return tx(pool,async db=>{
  const [[contract]]=await db.execute('SELECT * FROM world_logistics_contracts WHERE id=? FOR UPDATE',[Number(match[1])]);
  if(!contract)return fail(404,'contract_not_found');
  const action=match[2];
  if(action==='dispatch'){
   if(contract.status!=='active')return fail(409,'contract_inactive');
   const [[clock]]=await db.execute('SELECT UTC_TIMESTAMP() AS now');
   if(contract.last_dispatched_at&&new Date(clock.now)-new Date(contract.last_dispatched_at)<Number(contract.cadence_days)*86400000)return fail(409,'contract_not_due');
   return dispatch(db,await body(req),actor,contract);
  }
  await db.execute('UPDATE world_logistics_contracts SET status=? WHERE id=?',[action==='pause'?'paused':action==='resume'?'active':'retired',contract.id]);
  return ok({status:action==='pause'?'paused':action==='resume'?'active':'retired'});
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
   await db.execute("UPDATE world_logistics_shipments SET status='in_transit' WHERE id=?",[id]);
   await record(db,id,'resume',b?.note||'Journey resumed',actor);return ok({status:'in_transit'});
  }
  if(action==='arrive'){
   if(s.status!=='in_transit')return fail(409,'shipment_disrupted');
   const [[clock]]=await db.execute('SELECT UTC_TIMESTAMP() AS now');
   if(new Date(clock.now)<new Date(s.due_at))return fail(409,'transport_not_arrived_yet');
   const [destination]=await db.execute("SELECT f.status,s.strategic_state FROM world_industry_facilities f JOIN world_settlements s ON s.id=f.settlement_id WHERE f.id=?",[s.destination_facility_id]);
   if(!destination.length||['destroyed','abandoned'].includes(destination[0].strategic_state))return fail(409,'destination_unavailable');
   if(!await ledger(db,s.destination_facility_id,s.item_id,Number(s.quantity),'freight_arrival',id,actor))return fail(409,'delivery_failed');
   await db.execute("UPDATE world_logistics_shipments SET status='arrived',arrived_at=UTC_TIMESTAMP() WHERE id=?",[id]);
   await record(db,id,'arrival','Cargo received at destination',actor);return ok({status:'arrived'});
  }
  if(!await ledger(db,s.source_facility_id,s.item_id,Number(s.quantity),'freight_refund',id,actor))return fail(409,'refund_failed');
  await db.execute("UPDATE world_logistics_shipments SET status='cancelled' WHERE id=?",[id]);
  await record(db,id,'cancel',b?.note||'Shipment returned to origin; fuel not refunded',actor);
  return ok({status:'cancelled'});
 });
 return fail(404,'logistics_route_not_found');
}
