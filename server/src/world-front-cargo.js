import {resolveSession} from './auth.js';
import {randomUUID} from 'node:crypto';
import {airfieldReady,vehicleReady} from './world-logistics-advanced.js';
import {journeyStops,railCargoWindow} from './world-rail-stops.js';
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const key=x=>Number.isSafeInteger(Number(x))&&Number(x)>0;
const command=actor=>['domina','high_command'].includes(actor?.account_role);
const modes=new Set(['road','rail','air']);
async function read(req){let total=0,parts=[];for await(const part of req){total+=part.length;if(total>16000)return null;parts.push(part)}try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{return null}}
async function transaction(pool,fn){
 const db=await pool.getConnection();try{await db.beginTransaction();const result=await fn(db);if(result.status===200)await db.commit();else await db.rollback();return result}catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}
}
export async function logMovement(db,{system,reference,action,item,quantity,source,destination}){
 const receipt=system+':'+reference+':'+action;
 await db.execute('INSERT IGNORE INTO world_logistics_movement_audit(receipt_key,movement_system,reference_id,action,item_id,quantity,source_id,destination_id) VALUES(?,?,?,?,?,?,?,?)',[receipt,system,String(reference),action,String(item),Number(quantity),String(source),String(destination)]);
}
export async function movementHistory(pool){
 const [rows]=await pool.execute('SELECT * FROM world_logistics_movement_audit ORDER BY id DESC LIMIT 200');
 return rows;
}
async function owner(db,front,actor){
 if(!front||front.status!=='active')return false;
 if(front.ownership==='order')return command(actor);
 const [[row]]=await db.execute('SELECT player_account_id FROM characters WHERE id=?',[front.owner_character_id]);
 return row?.player_account_id===actor.id;
}
async function frontAuth(db,front,actor){
 if(await owner(db,front,actor))return true;
 const [staff]=await db.execute('SELECT fs.character_id FROM order_front_staff fs JOIN characters c ON c.id=fs.character_id WHERE fs.front_id=? AND c.player_account_id=? AND fs.staff_role="manager" LIMIT 1',[front.id,actor.id]);
 return staff.length>0;
}
async function routeMinutes(db,from,to,mode){
 if(Number(from)===Number(to))return 10;
 if(mode==='rail')return null;
 const [corridors]=await db.execute("SELECT travel_minutes FROM world_logistics_corridors WHERE state='operational' AND mode=? AND ((origin_settlement_id=? AND destination_settlement_id=?) OR (destination_settlement_id=? AND origin_settlement_id=?)) ORDER BY id LIMIT 1",[mode,from,to,from,to]);
 if(corridors.length)return Number(corridors[0].travel_minutes);
 const [map]=await db.execute("SELECT id FROM world_map_routes WHERE ((from_settlement_id=? AND to_settlement_id=?) OR (to_settlement_id=? AND from_settlement_id=?)) AND route_type IN ("+(mode==='road'?"'road','trail'":"'skyway'")+") LIMIT 1",[from,to,from,to]);
 return map.length?(mode==='air'?35:120):null;
}
async function frontLocation(db,id){
 const [[row]]=await db.execute('SELECT f.*,h.settlement_id FROM order_fronts f LEFT JOIN world_logistics_front_hubs h ON h.front_id=f.id WHERE f.id=?',[id]);
 return row||null;
}
export async function frontCargoRoute(pool,req,path){
 if(!pool)return fail(503,'database_unavailable');
 const actor=await resolveSession(pool,req);if(!actor)return fail(401,'not_authenticated');
 if(path==='/fronts/cargo'&&req.method==='GET'){
  const [hubs]=await pool.execute('SELECT h.*,f.name AS front_name,s.name AS settlement_name FROM world_logistics_front_hubs h JOIN order_fronts f ON f.id=h.front_id JOIN world_settlements s ON s.id=h.settlement_id ORDER BY f.name');
  const [shipments]=command(actor)?await pool.execute('SELECT * FROM world_logistics_front_cargo ORDER BY id DESC LIMIT 200'):await pool.execute('SELECT c.* FROM world_logistics_front_cargo c JOIN order_fronts f ON f.id=c.source_front_id LEFT JOIN characters ch ON ch.id=f.owner_character_id WHERE c.created_by=? OR ch.player_account_id=? ORDER BY c.id DESC LIMIT 100',[actor.id,actor.id]);
  return ok({hubs,shipments,can_dispatch:command(actor)});
 }
 if(path==='/fronts/cargo/hub'&&req.method==='POST'){
  if(!command(actor))return fail(403,'command_required');
  const b=await read(req);if(!key(b?.front_id)||!key(b?.settlement_id))return fail(400,'invalid_front_hub');
  return transaction(pool,async db=>{
   const [[front]]=await db.execute('SELECT id,status FROM order_fronts WHERE id=? FOR UPDATE',[b.front_id]);
   const [[settlement]]=await db.execute('SELECT id,controlling_faction_id FROM world_settlements WHERE id=?',[b.settlement_id]);
   if(!front||front.status!=='active'||settlement?.controlling_faction_id!=='eclipse-order')return fail(409,'front_hub_requires_order_settlement');
   await db.execute('INSERT INTO world_logistics_front_hubs(front_id,settlement_id,assigned_by) VALUES(?,?,?) ON DUPLICATE KEY UPDATE settlement_id=VALUES(settlement_id),assigned_by=VALUES(assigned_by)',[front.id,settlement.id,actor.id]);
   return ok({saved:true});
  });
 }
 if(path==='/fronts/cargo'&&req.method==='POST'){
  const b=await read(req);
  if(!key(b?.source_front_id)||!key(b?.destination_front_id)||Number(b.source_front_id)===Number(b.destination_front_id)||!modes.has(b.mode)||typeof b.material_id!=='string'||!(/^[a-z0-9-]{1,48}$/).test(b.material_id)||!Number.isInteger(b.quantity)||b.quantity<1||b.quantity>100000)return fail(400,'invalid_front_cargo');
  return transaction(pool,async db=>{
   const source=await frontLocation(db,Number(b.source_front_id)),dest=await frontLocation(db,Number(b.destination_front_id));
   if(!source||!dest||source.status!=='active'||dest.status!=='active'||!source.settlement_id||!dest.settlement_id)return fail(409,'front_location_unavailable');
   if(!await frontAuth(db,source,actor))return fail(403,'front_not_authorized');
   const [[item]]=await db.execute('SELECT id FROM fc_materials WHERE id=?',[b.material_id]);
   if(!item)return fail(404,'front_material_not_found');
   const [result]=await db.execute('INSERT INTO world_logistics_front_cargo(request_key,source_front_id,destination_front_id,material_id,quantity,mode,created_by) VALUES(?,?,?,?,?,?,?)',[randomUUID(),source.id,dest.id,b.material_id,b.quantity,b.mode,actor.id]);
   return ok({id:result.insertId,status:'requested'});
  });
 }
 const match=/^\/fronts\/cargo\/(\d+)\/(approve|dispatch|cancel|arrive|hold|resume)$/.exec(path);
 if(!match||req.method!=='POST')return fail(404,'front_cargo_route_not_found');
 const ident=Number(match[1]),action=match[2],b=await read(req);
 return transaction(pool,async db=>{
  const [[shipment]]=await db.execute('SELECT * FROM world_logistics_front_cargo WHERE id=? FOR UPDATE',[ident]);
  if(!shipment)return fail(404,'front_cargo_not_found');
  const source=await frontLocation(db,shipment.source_front_id),dest=await frontLocation(db,shipment.destination_front_id);
  if(!source||!dest)return fail(409,'front_not_found');
  if(action==='approve'){
   if(shipment.status!=='requested')return fail(409,'front_cargo_not_pending');
   // Staff cannot override authorization of a member-owned front.
   if(!await owner(db,source,actor))return fail(403,'source_front_owner_required');
   await db.execute("UPDATE world_logistics_front_cargo SET status='approved',authorized_by=? WHERE id=?",[actor.id,ident]);
   return ok({status:'approved'});
  }
  if(action==='dispatch'){
   if(!command(actor))return fail(403,'command_required');
   if(shipment.status!=='approved'||!shipment.authorized_by)return fail(409,'owner_approval_required');
   if(source.status!=='active'||dest.status!=='active'||!source.settlement_id||!dest.settlement_id)return fail(409,'front_location_unavailable');
   if(!key(b?.transport_template_id))return fail(400,'transport_required');
   const [[profile]]=await db.execute('SELECT * FROM world_logistics_transport_templates WHERE id=? AND active=1',[Number(b.transport_template_id)]);
   if(!profile||profile.mode!==shipment.mode||Number(profile.capacity)<Number(shipment.quantity))return fail(409,'front_transport_capacity_or_mode');
   if(shipment.mode==='air'&&!await airfieldReady(db,source.settlement_id,dest.settlement_id))return fail(409,'airfields_required_at_both_ends');
   const [[held]]=await db.execute('SELECT quantity FROM order_front_stock WHERE front_id=? AND material_id=? FOR UPDATE',[source.id,shipment.material_id]);
   if(!held||Number(held.quantity)<Number(shipment.quantity))return fail(409,'front_cargo_stock_insufficient');
   let vehicleId=null,trainId=null,unloadingAt=null,travel=await routeMinutes(db,source.settlement_id,dest.settlement_id,shipment.mode);
   if(shipment.mode==='rail'){
    if(!key(b?.train_journey_id))return fail(409,'running_train_required');
    const [[train]]=await db.execute("SELECT j.*,r.from_type,r.to_type,r.from_id,r.to_id,c.owner_faction_id,c.status AS consist_status FROM order_internal_rail_journeys j JOIN order_internal_rail_routes r ON r.id=j.route_id JOIN world_magitek_train_consists c ON c.id=j.train_consist_id WHERE j.id=? FOR UPDATE",[Number(b.train_journey_id)]);
    if(!train||train.status!=='running'||train.consist_status!=='assembled'||train.owner_faction_id!=='eclipse-order'||train.from_type!=='settlement'||train.to_type!=='settlement')return fail(409,'train_does_not_serve_front_hubs');
    const stops=await journeyStops(db,[train.id]);
    const loading=railCargoWindow(train,stops,source.settlement_id,dest.settlement_id,new Date());
    if(!loading)return fail(409,'rail_loading_window_closed_or_stop_not_served');
    const [[used]]=await db.execute("SELECT (SELECT COALESCE(SUM(quantity),0) FROM world_logistics_shipments WHERE train_journey_id=? AND status IN ('in_transit','disrupted'))+(SELECT COALESCE(SUM(quantity),0) FROM world_logistics_front_cargo WHERE train_journey_id=? AND status IN ('in_transit','held')) AS loaded",[train.id,train.id]);
    if(Number(used.loaded)+Number(shipment.quantity)>Number(train.cargo_capacity_snapshot))return fail(409,'train_cargo_capacity_exceeded');
    trainId=train.id;unloadingAt=loading.arrival_at;travel=null;
   }else{
    if(travel==null)return fail(409,'no_connected_transport_route');
    if(!key(b?.vehicle_lot_id))return fail(409,'commissioned_vehicle_required');
    const [[vehicle]]=await db.execute("SELECT v.*,t.equipment_kind FROM world_magitek_equipment_inventory v JOIN world_magitek_equipment_templates t ON t.id=v.equipment_template_id WHERE v.id=? FOR UPDATE",[Number(b.vehicle_lot_id)]);
    if(!vehicle||vehicle.status!=='assigned'||vehicle.owner_faction_id!=='eclipse-order'||Number(vehicle.stationed_settlement_id)!==Number(source.settlement_id)||!(shipment.mode==='air'?['airship','capital_airship']:['transport','armored_vehicle']).includes(vehicle.equipment_kind)||!await vehicleReady(db,vehicle.id))return fail(409,'front_vehicle_not_available');
    const specs=typeof vehicle.specifications==='string'?JSON.parse(vehicle.specifications):vehicle.specifications;
    if(Number(specs?.cargo_capacity||0)*Number(vehicle.quantity||1)<Number(shipment.quantity))return fail(409,'front_vehicle_capacity_exceeded');
    const [busy]=await db.execute("SELECT id FROM world_logistics_shipments WHERE vehicle_lot_id=? AND status IN ('in_transit','disrupted') LIMIT 1",[vehicle.id]);
    const [busyFront]=await db.execute("SELECT id FROM world_logistics_front_cargo WHERE vehicle_lot_id=? AND status IN ('in_transit','held') LIMIT 1",[vehicle.id]);
    if(busy.length||busyFront.length)return fail(409,'front_vehicle_already_dispatched');
    vehicleId=vehicle.id;
   }
   const fuel=shipment.mode==='air'?Math.max(5,Math.round(Number(profile.fuel_per_leg)*2.5*1000)/1000):Number(profile.fuel_per_leg);
   if(fuel>0){
    if(!profile.fuel_item_id||!key(b?.fuel_facility_id))return fail(409,'fuel_depot_required');
    const [[depot]]=await db.execute('SELECT settlement_id,owner_faction_id FROM world_industry_facilities WHERE id=?',[Number(b.fuel_facility_id)]);
    if(!depot||Number(depot.settlement_id)!==Number(source.settlement_id)||depot.owner_faction_id!=='eclipse-order')return fail(409,'fuel_depot_wrong_location');
    const [[supply]]=await db.execute('SELECT quantity FROM world_industry_stock WHERE facility_id=? AND item_id=? FOR UPDATE',[Number(b.fuel_facility_id),profile.fuel_item_id]);
    if(!supply||Number(supply.quantity)<fuel)return fail(409,'front_fuel_insufficient');
    const after=Number(supply.quantity)-fuel;
    await db.execute('UPDATE world_industry_stock SET quantity=? WHERE facility_id=? AND item_id=?',[after,Number(b.fuel_facility_id),profile.fuel_item_id]);
    await db.execute('INSERT INTO world_industry_ledger(facility_id,item_id,delta,balance_after,action,reference_key,actor_id) VALUES(?,?,?,?,?,?,?)',[Number(b.fuel_facility_id),profile.fuel_item_id,-fuel,after,'freight_fuel','frontcargo:'+ident,actor.id]);
   }
   await db.execute('UPDATE order_front_stock SET quantity=quantity-? WHERE front_id=? AND material_id=?',[shipment.quantity,source.id,shipment.material_id]);
   if(shipment.mode==='air')travel=Math.max(10,Math.ceil(Number(travel)*.65));
   const due=trainId?await db.execute('SELECT ? AS due_at',[unloadingAt]):await db.execute('SELECT DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? MINUTE) AS due_at',[travel]);
   await db.execute("UPDATE world_logistics_front_cargo SET status='in_transit',source_settlement_id=?,destination_settlement_id=?,transport_template_id=?,vehicle_lot_id=?,train_journey_id=?,fuel_item_id=?,fuel_used=?,due_at=?,dispatched_by=? WHERE id=?",
    [source.settlement_id,dest.settlement_id,profile.id,vehicleId,trainId,profile.fuel_item_id||null,fuel,due[0][0].due_at,actor.id,ident]);
   await logMovement(db,{system:'front',reference:ident,action:'dispatch',item:shipment.material_id,quantity:shipment.quantity,source:'front:'+source.id,destination:'front:'+dest.id});
   return ok({status:'in_transit',due_at:due[0][0].due_at});
  }
  if(action==='cancel'){
   if(!command(actor)&&!await owner(db,source,actor))return fail(403,'front_cargo_not_authorized');
   if(['arrived','cancelled'].includes(shipment.status))return fail(409,'front_cargo_already_settled');
   if(shipment.status==='in_transit'||shipment.status==='held'){
    await db.execute('INSERT INTO order_front_stock(front_id,material_id,quantity) VALUES(?,?,?) ON DUPLICATE KEY UPDATE quantity=quantity+VALUES(quantity)',[source.id,shipment.material_id,shipment.quantity]);
    await logMovement(db,{system:'front',reference:ident,action:'cancel',item:shipment.material_id,quantity:shipment.quantity,source:'transit:'+ident,destination:'front:'+source.id});
   }
   await db.execute("UPDATE world_logistics_front_cargo SET status='cancelled',completed_at=UTC_TIMESTAMP() WHERE id=?",[ident]);
   return ok({status:'cancelled'});
  }
  if(!command(actor))return fail(403,'command_required');
  if(action==='hold'&&shipment.status==='in_transit'){await db.execute("UPDATE world_logistics_front_cargo SET status='held' WHERE id=?",[ident]);return ok({status:'held'})}
  if(action==='resume'&&shipment.status==='held'){await db.execute("UPDATE world_logistics_front_cargo SET status='in_transit' WHERE id=?",[ident]);return ok({status:'in_transit'})}
  if(action==='arrive'&&shipment.status==='in_transit')return arrive(db,shipment,actor);
  return fail(409,'front_cargo_invalid_transition');
 });
}
async function arrive(db,shipment,actor){
 const [[due]]=await db.execute('SELECT IF(?<=UTC_TIMESTAMP(),1,0) AS ready',[shipment.due_at]);
 if(!due.ready)return fail(409,'front_cargo_not_due');
 const [[target]]=await db.execute('SELECT f.status,h.settlement_id FROM order_fronts f JOIN world_logistics_front_hubs h ON h.front_id=f.id WHERE f.id=?',[shipment.destination_front_id]);
 if(!target||target.status!=='active'||Number(target.settlement_id)!==Number(shipment.destination_settlement_id)){
  await db.execute("UPDATE world_logistics_front_cargo SET status='held' WHERE id=?",[shipment.id]);return ok({status:'held'});
 }
 if(shipment.train_journey_id){
  const [[train]]=await db.execute('SELECT status FROM order_internal_rail_journeys WHERE id=?',[shipment.train_journey_id]);
  if(!train||train.status==='cancelled'){await db.execute("UPDATE world_logistics_front_cargo SET status='held' WHERE id=?",[shipment.id]);return ok({status:'held'})}
 }
 await db.execute('INSERT INTO order_front_stock(front_id,material_id,quantity) VALUES(?,?,?) ON DUPLICATE KEY UPDATE quantity=quantity+VALUES(quantity)',[shipment.destination_front_id,shipment.material_id,shipment.quantity]);
 await db.execute("UPDATE world_logistics_front_cargo SET status='arrived',completed_at=UTC_TIMESTAMP() WHERE id=? AND status='in_transit'",[shipment.id]);
 await logMovement(db,{system:'front',reference:shipment.id,action:'arrival',item:shipment.material_id,quantity:shipment.quantity,source:'transit:'+shipment.id,destination:'front:'+shipment.destination_front_id});
 return ok({status:'arrived'});
}
export async function runFrontCargoAutomation(pool){
 if(!pool)return {arrived:0,held:0};
 const [due]=await pool.execute("SELECT id FROM world_logistics_front_cargo WHERE status='in_transit' AND due_at<=UTC_TIMESTAMP() ORDER BY id LIMIT 20");
 let arrived=0,held=0;
 for(const row of due){
  const result=await transaction(pool,async db=>{
   const [[shipment]]=await db.execute('SELECT * FROM world_logistics_front_cargo WHERE id=? FOR UPDATE',[row.id]);
   if(!shipment||shipment.status!=='in_transit')return ok({skipped:true});
   return arrive(db,shipment,{id:null});
  });
  if(result.body?.status==='arrived')arrived++;
  if(result.body?.status==='held')held++;
 }
 return {arrived,held};
}
