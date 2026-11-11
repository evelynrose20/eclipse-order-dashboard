// Warehouse inventory is physically distinct from industrial and player-reserved stock.
// All cargo debits and receipts use the same industry ledger and a warehouse receipt ledger.
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const id=x=>Number.isSafeInteger(Number(x))&&Number(x)>0;
const qty=x=>typeof x==='number'&&Number.isFinite(x)&&x>0&&x<=100000&&Math.round(x*1000)===x*1000;
const round=x=>Math.round(Number(x)*1000)/1000;
export const WAREHOUSE_TIERS=Object.freeze({depot:{capacity:500,cost:30},storehouse:{capacity:2000,cost:100},grand:{capacity:6000,cost:300}});
async function parse(req){let n=0,parts=[];for await(const chunk of req){n+=chunk.length;if(n>18000)return null;parts.push(chunk)}try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{return null}}
async function transaction(pool,fn){const db=await pool.getConnection();try{await db.beginTransaction();const output=await fn(db);if(output.status===200)await db.commit();else await db.rollback();return output}catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}}
async function occupied(db,warehouseId){const [[stock]]=await db.execute('SELECT COALESCE(SUM(quantity),0) AS qty FROM world_logistics_warehouse_stock WHERE warehouse_id=?',[warehouseId]);const [[pending]]=await db.execute("SELECT COALESCE(SUM(quantity),0) AS qty FROM world_logistics_warehouse_shipments WHERE destination_warehouse_id=? AND status IN ('in_transit','disrupted')",[warehouseId]);return round(Number(stock.qty)+Number(pending.qty))}
async function receipt(db,shipment,actor,ledger){
 const [[warehouse]]=await db.execute('SELECT w.*,s.strategic_state,s.controlling_faction_id FROM world_logistics_warehouses w JOIN world_settlements s ON s.id=w.settlement_id WHERE w.id=? FOR UPDATE',[shipment.destination_warehouse_id]);
 if(!warehouse||warehouse.state!=='operational'||warehouse.controlling_faction_id!=='eclipse-order'||['destroyed','abandoned'].includes(warehouse.strategic_state)){
  await db.execute("UPDATE world_logistics_warehouse_shipments SET status='disrupted',incident_notes='Receiving warehouse unavailable' WHERE id=?",[shipment.id]);
  return ok({disrupted:true,reason:'warehouse_unavailable'});
 }
 // Already-reserved incoming quantities count towards capacity. No overfill, even with concurrent dispatch.
 if(await occupied(db,warehouse.id)>Number(warehouse.capacity_units)+0.00001){
  await db.execute("UPDATE world_logistics_warehouse_shipments SET status='disrupted',incident_notes='Warehouse capacity changed; awaiting command' WHERE id=?",[shipment.id]);
  return ok({disrupted:true,reason:'warehouse_capacity'});
 }
 await db.execute('INSERT IGNORE INTO world_logistics_warehouse_stock(warehouse_id,item_id,quantity) VALUES(?,?,0)',[warehouse.id,shipment.item_id]);
 const [[stack]]=await db.execute('SELECT quantity FROM world_logistics_warehouse_stock WHERE warehouse_id=? AND item_id=? FOR UPDATE',[warehouse.id,shipment.item_id]);
 const after=round(Number(stack.quantity)+Number(shipment.quantity));
 await db.execute('UPDATE world_logistics_warehouse_stock SET quantity=? WHERE warehouse_id=? AND item_id=?',[after,warehouse.id,shipment.item_id]);
 await db.execute("INSERT INTO world_logistics_warehouse_ledger(warehouse_id,shipment_id,item_id,delta,balance_after,action) VALUES(?,?,?,?,?,'arrival')",[warehouse.id,shipment.id,shipment.item_id,shipment.quantity,after]);
 await db.execute("UPDATE world_logistics_warehouse_shipments SET status='arrived',arrived_at=UTC_TIMESTAMP(),incident_notes='' WHERE id=? AND status='in_transit'",[shipment.id]);
 if(shipment.vehicle_lot_id)await db.execute("UPDATE world_magitek_equipment_inventory SET stationed_settlement_id=? WHERE id=? AND status='assigned'",[warehouse.settlement_id,shipment.vehicle_lot_id]);
 return ok({arrived:true,warehouse_id:warehouse.id,item_id:shipment.item_id,quantity:Number(shipment.quantity)});
}
export async function warehousesRoute(pool,req,path,actor,{route,facilities,ledger,availableVehicle,operationalAirDocks}){
 if(!['domina','high_command'].includes(actor?.account_role))return fail(403,'command_required');
 if(path==='/world-admin/logistics/warehouses'&&req.method==='POST'){
  const b=await parse(req),tier=WAREHOUSE_TIERS[b?.tier];
  if(!tier||!id(b.settlement_id)||typeof b.name!=='string'||!b.name.trim()||b.name.length>130||typeof b.construction_item_id!=='string'||b.construction_item_id.length>48)return fail(400,'invalid_warehouse_plan');
  return transaction(pool,async db=>{
   const [[settlement]]=await db.execute('SELECT id,controlling_faction_id,strategic_state FROM world_settlements WHERE id=? FOR UPDATE',[b.settlement_id]);
   if(!settlement||settlement.controlling_faction_id!=='eclipse-order'||['destroyed','abandoned'].includes(settlement.strategic_state))return fail(409,'warehouse_requires_order_settlement');
   const [[item]]=await db.execute("SELECT id FROM world_industry_items WHERE id=? AND category IN ('refined','supply')",[b.construction_item_id]);
   if(!item)return fail(409,'warehouse_construction_material_required');
   const [made]=await db.execute('INSERT INTO world_logistics_warehouses(settlement_id,name,tier,capacity_units,construction_item_id,construction_quantity,created_by) VALUES(?,?,?,?,?,?,?)',[settlement.id,b.name.trim(),b.tier,tier.capacity,b.construction_item_id,tier.cost,actor.id]);
   return ok({id:made.insertId,state:'planned',capacity_units:tier.capacity,construction_quantity:tier.cost});
  });
 }
 let match=/^\/world-admin\/logistics\/warehouses\/(\d+)\/state$/.exec(path);
 if(match&&req.method==='POST'){
  const b=await parse(req);
  if(!['operational','damaged','closed'].includes(b?.state))return fail(400,'invalid_warehouse_state');
  return transaction(pool,async db=>{
   const [[wh]]=await db.execute('SELECT * FROM world_logistics_warehouses WHERE id=? FOR UPDATE',[Number(match[1])]);
   if(!wh)return fail(404,'warehouse_not_found');
   if(b.state==='operational'&&wh.state!=='operational'){
    if(!id(b.facility_id))return fail(400,'warehouse_construction_depot_required');
    const [[facility]]=await db.execute('SELECT f.id,f.owner_faction_id,f.status,COALESCE(site.zone_id,home.zone_id) AS zone_id,COALESCE(site.controlling_faction_id,home.controlling_faction_id) AS controlling_faction_id,home.strategic_state FROM world_industry_facilities f LEFT JOIN world_industry_sites site ON site.id=f.site_id LEFT JOIN world_settlements home ON home.id=f.settlement_id WHERE f.id=? FOR UPDATE',[b.facility_id]);
    const [[destination]]=await db.execute('SELECT zone_id,controlling_faction_id,strategic_state FROM world_settlements WHERE id=? FOR UPDATE',[wh.settlement_id]);
    if(!facility||!destination||Number(facility.zone_id)!==Number(destination.zone_id)||facility.owner_faction_id!=='eclipse-order'||facility.controlling_faction_id!=='eclipse-order'||destination.controlling_faction_id!=='eclipse-order'||['destroyed','abandoned'].includes(destination.strategic_state)||['ruined','captured'].includes(facility.status))return fail(409,'warehouse_construction_requires_local_stock');
    if(!await ledger(db,facility.id,wh.construction_item_id,-Number(wh.construction_quantity),'corridor_build',wh.id,actor,'warehouse'))return fail(409,'warehouse_building_materials_insufficient');
   }
   await db.execute('UPDATE world_logistics_warehouses SET state=?,commissioned_at=IF(?="operational",UTC_TIMESTAMP(),commissioned_at) WHERE id=?',[b.state,b.state,wh.id]);
   return ok({state:b.state});
  });
 }
 if(path==='/world-admin/logistics/warehouses/preview'&&req.method==='POST'){
  const b=await parse(req);
  if(!b||!id(b.source_facility_id)||!id(b.destination_warehouse_id)||!id(b.transport_template_id)||!qty(b.quantity))return fail(400,'invalid_warehouse_preview');
  const [[warehouse]]=await pool.execute('SELECT w.*,s.controlling_faction_id FROM world_logistics_warehouses w JOIN world_settlements s ON s.id=w.settlement_id WHERE w.id=?',[b.destination_warehouse_id]);
  const source=(await facilities(pool)).find(f=>Number(f.id)===Number(b.source_facility_id));
  const [[service]]=await pool.execute('SELECT * FROM world_logistics_transport_templates WHERE id=? AND active=1',[b.transport_template_id]);
  if(!warehouse||!source||!service)return fail(404,'route_endpoint_unavailable');
  if(!['road','rail','air'].includes(service.mode))return fail(409,'transport_mode_unavailable');
  const connected=!!(source.settlement_id&&source.owner_faction_id==='eclipse-order'&&source.controlling_faction_id==='eclipse-order'&&(!source.site_id||source.site_faction_id===source.controlling_faction_id)&&!['ruined','captured'].includes(source.status)&&!['destroyed','abandoned'].includes(source.strategic_state)&&warehouse.controlling_faction_id==='eclipse-order'&&warehouse.state==='operational');
  const flight=service.mode!=='air'||(connected&&await operationalAirDocks(pool,source.settlement_id,warehouse.settlement_id));
  const result=connected&&flight?await route(pool,source.settlement_id,warehouse.settlement_id,service.mode):null;
  let pickup=null,vehicleReady=true;
  if(service.mode==='rail'){vehicleReady=id(b.train_journey_id)}
  else if(result){
   vehicleReady=false;
   if(id(b.vehicle_lot_id)){
    const [[lot]]=await pool.execute('SELECT status,stationed_settlement_id FROM world_magitek_equipment_inventory WHERE id=?',[b.vehicle_lot_id]);
    if(lot?.status==='assigned'){
     const atFarm=Number(lot.stationed_settlement_id)===Number(source.settlement_id);
     const atCapital=Number(lot.stationed_settlement_id)===Number(warehouse.settlement_id);
     if(atFarm)vehicleReady=true;
     else if(atCapital){pickup=await route(pool,warehouse.settlement_id,source.settlement_id,service.mode);vehicleReady=!!pickup}
    }
   }
  }
  const stored=await occupied(pool,warehouse.id);
  const [[stock]]=await pool.execute('SELECT quantity FROM world_industry_stock WHERE facility_id=? AND item_id=?',[source.id,b.item_id||'']);
  const legs=(result?.legs||0)+(pickup?.legs||0)+(source.site_id?(pickup?2:1):0);
  return ok({connected:!!result,landing_ready:!!flight,warehouse_ready:connected,mode:service.mode,
   duration_minutes:result?(result.duration_minutes??result.legs*Number(service.minutes_per_leg))+Number(source.access_minutes||0)+(pickup?(pickup.duration_minutes??pickup.legs*Number(service.minutes_per_leg))+Number(source.access_minutes||0):0):null,
   fuel_required:result?round(Number(service.fuel_per_leg)*legs*(service.mode==='air'?3:1)):null,
   warehouse_free:Math.max(0,round(Number(warehouse.capacity_units)-stored)),pickup_required:!!pickup,vehicle_ready:vehicleReady,
   stock_available:Number(stock?.quantity||0),route:result,
   can_send:!!result&&flight&&vehicleReady&&b.quantity<=Number(service.capacity)&&b.quantity<=Number(stock?.quantity||0)&&stored+b.quantity<=Number(warehouse.capacity_units)});
 }
 if(path==='/world-admin/logistics/warehouses/dispatch'&&req.method==='POST'){
  const b=await parse(req);
  if(!b||!id(b.source_facility_id)||!id(b.destination_warehouse_id)||!id(b.transport_template_id)||typeof b.item_id!=='string'||!qty(b.quantity)||typeof b.request_key!=='string'||!/^[a-zA-Z0-9_-]{12,64}$/.test(b.request_key))return fail(400,'invalid_warehouse_manifest');
  return transaction(pool,async db=>{
   const [[duplicate]]=await db.execute('SELECT id,status FROM world_logistics_warehouse_shipments WHERE request_key=?',[b.request_key]);
   if(duplicate)return ok({shipment_id:duplicate.id,status:duplicate.status,already_submitted:true});
   const [[warehouse]]=await db.execute('SELECT w.*,s.controlling_faction_id,s.strategic_state FROM world_logistics_warehouses w JOIN world_settlements s ON s.id=w.settlement_id WHERE w.id=? FOR UPDATE',[b.destination_warehouse_id]);
   if(!warehouse||warehouse.state!=='operational'||warehouse.controlling_faction_id!=='eclipse-order'||['destroyed','abandoned'].includes(warehouse.strategic_state))return fail(409,'destination_warehouse_unavailable');
   if(round(await occupied(db,warehouse.id)+b.quantity)>Number(warehouse.capacity_units))return fail(409,'warehouse_capacity_exceeded');
   const source=(await facilities(db)).find(f=>Number(f.id)===Number(b.source_facility_id));
   if(!source||!source.settlement_id||!source.controlling_faction_id||source.owner_faction_id!==source.controlling_faction_id||['ruined','captured'].includes(source.status)||['destroyed','abandoned'].includes(source.strategic_state)||source.site_id&&source.site_faction_id!==source.controlling_faction_id)return fail(409,'source_farm_or_depot_unavailable');
   if(source.controlling_faction_id!==warehouse.controlling_faction_id)return fail(409,'warehouse_trade_treaty_required');
   const [[service]]=await db.execute('SELECT * FROM world_logistics_transport_templates WHERE id=? AND active=1',[b.transport_template_id]);
   if(!service||!['road','rail','air'].includes(service.mode)||Number(service.capacity)<b.quantity)return fail(409,'warehouse_transport_unavailable');
   if(service.mode==='air'&&!await operationalAirDocks(db,source.settlement_id,warehouse.settlement_id))return fail(409,'airship_landing_facilities_required');
   let journey=await route(db,source.settlement_id,warehouse.settlement_id,service.mode);
   if(!journey)return fail(409,'warehouse_route_not_connected');
   let vehicle=null,train=null,pickupPath=null;
   if(service.mode==='rail'){
    if(!id(b.train_journey_id))return fail(409,'running_train_required');
    const [[running]]=await db.execute(`SELECT j.id,j.status,j.cargo_capacity_snapshot,j.departed_at,j.expected_arrival_at,r.from_type,r.from_id,r.to_type,r.to_id,r.duration_minutes,c.status AS consist_status,c.owner_faction_id
     FROM order_internal_rail_journeys j JOIN order_internal_rail_routes r ON r.id=j.route_id JOIN world_magitek_train_consists c ON c.id=j.train_consist_id WHERE j.id=? FOR UPDATE`,[b.train_journey_id]);
    if(!running||running.status!=='running'||running.consist_status!=='assembled'||running.owner_faction_id!=='eclipse-order'||running.from_type!=='settlement'||running.to_type!=='settlement'||Number(running.from_id)!==Number(source.settlement_id)||Number(running.to_id)!==Number(warehouse.settlement_id))return fail(409,'train_not_at_warehouse_route');
    const [[time]]=await db.execute('SELECT TIMESTAMPDIFF(MINUTE,?,UTC_TIMESTAMP()) AS elapsed,? > UTC_TIMESTAMP() AS running',[running.departed_at,running.expected_arrival_at]);
    if(!time.running||Number(time.elapsed)>30)return fail(409,'rail_loading_window_closed');
    const [[other]]=await db.execute("SELECT COALESCE(SUM(quantity),0) AS qty FROM world_logistics_shipments WHERE train_journey_id=? AND status<>'cancelled'",[running.id]);
    const [[more]]=await db.execute("SELECT COALESCE(SUM(quantity),0) AS qty FROM world_logistics_warehouse_shipments WHERE train_journey_id=? AND status<>'cancelled'",[running.id]);
    if(Number(other.qty)+Number(more.qty)+b.quantity>Number(running.cargo_capacity_snapshot))return fail(409,'train_cargo_capacity_exceeded');
    train=running;
    journey={segment_ids:['internal-rail:'+running.id],legs:1,duration_minutes:Number(running.duration_minutes)};
   }else{
    vehicle=await availableVehicle(db,b.vehicle_lot_id,service.mode,source.settlement_id);
    if(!vehicle&&Number(source.settlement_id)!==Number(warehouse.settlement_id)){
     vehicle=await availableVehicle(db,b.vehicle_lot_id,service.mode,warehouse.settlement_id);
     if(vehicle){pickupPath=await route(db,warehouse.settlement_id,source.settlement_id,service.mode);if(!pickupPath)return fail(409,'pickup_route_not_connected')}
    }
    if(!vehicle||vehicle.owner_faction_id!=='eclipse-order')return fail(409,'stationed_vehicle_unavailable');
    const specs=typeof vehicle.specifications==='string'?JSON.parse(vehicle.specifications):vehicle.specifications;
    if(Number(specs?.cargo_capacity||0)*Number(vehicle.quantity||1)<b.quantity)return fail(409,'vehicle_cargo_capacity_exceeded');
   }
   const legs=journey.legs+(pickupPath?.legs||0)+(source.site_id?(pickupPath?2:1):0);
   const fuel=round(legs*Number(service.fuel_per_leg)*(service.mode==='air'?3:1));
   const [[stock]]=await db.execute('SELECT quantity FROM world_industry_stock WHERE facility_id=? AND item_id=? FOR UPDATE',[source.id,b.item_id]);
   if(!stock||Number(stock.quantity)<b.quantity)return fail(409,'farm_stock_insufficient');
   if(fuel>0){
    const [[fuelStock]]=await db.execute('SELECT quantity FROM world_industry_stock WHERE facility_id=? AND item_id=? FOR UPDATE',[source.id,service.fuel_item_id]);
    if(!fuelStock||Number(fuelStock.quantity)<fuel+(service.fuel_item_id===b.item_id?b.quantity:0))return fail(409,'transport_fuel_insufficient');
   }
   const minutes=(journey.duration_minutes??journey.legs*Number(service.minutes_per_leg))+Number(source.access_minutes||0)+(pickupPath?(pickupPath.duration_minutes??pickupPath.legs*Number(service.minutes_per_leg))+Number(source.access_minutes||0):0);
   const [[clock]]=train?await db.execute('SELECT DATE_ADD(?,INTERVAL ? MINUTE) AS due_at',[train.expected_arrival_at,Number(source.access_minutes||0)]):await db.execute('SELECT DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE) AS due_at',[minutes]);
   const [created]=await db.execute('INSERT INTO world_logistics_warehouse_shipments(request_key,source_facility_id,destination_warehouse_id,transport_template_id,vehicle_lot_id,train_journey_id,item_id,quantity,fuel_used,route_segments,due_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',[b.request_key,source.id,warehouse.id,service.id,vehicle?.id||null,train?.id||null,b.item_id,b.quantity,fuel,JSON.stringify([...(pickupPath?.segment_ids||[]),...journey.segment_ids]),clock.due_at,actor.id]);
   if(!await ledger(db,source.id,b.item_id,-b.quantity,'freight_dispatch',created.insertId,actor,'warehouse'))return fail(409,'farm_stock_insufficient');
   if(fuel>0&&!await ledger(db,source.id,service.fuel_item_id,-fuel,'freight_fuel',created.insertId,actor,'warehouse'))return fail(409,'transport_fuel_insufficient');
   return ok({shipment_id:created.insertId,due_at:clock.due_at,status:'in_transit',warehouse_id:warehouse.id});
  });
 }
 match=/^\/world-admin\/logistics\/warehouses\/shipments\/(\d+)\/(receive|cancel|resume)$/.exec(path);
 if(match&&req.method==='POST')return transaction(pool,async db=>{
  const [[shipment]]=await db.execute('SELECT * FROM world_logistics_warehouse_shipments WHERE id=? FOR UPDATE',[Number(match[1])]);
  if(!shipment)return fail(404,'warehouse_shipment_not_found');
  if(match[2]==='cancel'){
   if(!['in_transit','disrupted'].includes(shipment.status))return fail(409,'warehouse_shipment_already_settled');
   if(!await ledger(db,shipment.source_facility_id,shipment.item_id,Number(shipment.quantity),'freight_refund',shipment.id,actor,'warehouse'))return fail(409,'farm_stock_refund_failed');
   await db.execute("UPDATE world_logistics_warehouse_shipments SET status='cancelled' WHERE id=?",[shipment.id]);
   return ok({status:'cancelled'});
  }
  if(match[2]==='resume'){
   if(shipment.status!=='disrupted')return fail(409,'shipment_not_disrupted');
   await db.execute("UPDATE world_logistics_warehouse_shipments SET status='in_transit',due_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 60 MINUTE),incident_notes='' WHERE id=?",[shipment.id]);return ok({status:'in_transit'});
  }
  if(shipment.status!=='in_transit')return fail(409,'shipment_not_in_transit');
  const [[clock]]=await db.execute('SELECT due_at<=UTC_TIMESTAMP() AS due FROM world_logistics_warehouse_shipments WHERE id=?',[shipment.id]);
  if(!clock.due)return fail(409,'transport_not_arrived_yet');
  if(shipment.train_journey_id){
   const [[train]]=await db.execute('SELECT status FROM order_internal_rail_journeys WHERE id=?',[shipment.train_journey_id]);
   if(!train||train.status==='cancelled')return fail(409,'train_journey_cancelled');
  }
  return receipt(db,shipment,actor,ledger);
 });
 match=/^\/world-admin\/logistics\/warehouses\/(\d+)\/withdraw$/.exec(path);
 if(match&&req.method==='POST'){
  const b=await parse(req);
  if(!b||!id(b.facility_id)||typeof b.item_id!=='string'||!qty(b.quantity))return fail(400,'invalid_warehouse_withdrawal');
  return transaction(pool,async db=>{
   const [[warehouse]]=await db.execute('SELECT * FROM world_logistics_warehouses WHERE id=? FOR UPDATE',[Number(match[1])]);
   if(!warehouse||warehouse.state!=='operational')return fail(409,'warehouse_not_operational');
   const [[facility]]=await db.execute('SELECT f.id,f.settlement_id,f.owner_faction_id,s.controlling_faction_id FROM world_industry_facilities f JOIN world_settlements s ON s.id=f.settlement_id WHERE f.id=?',[b.facility_id]);
   if(!facility||Number(facility.settlement_id)!==Number(warehouse.settlement_id)||facility.owner_faction_id!=='eclipse-order'||facility.controlling_faction_id!=='eclipse-order')return fail(409,'withdrawal_requires_local_order_depot');
   const [[stock]]=await db.execute('SELECT quantity FROM world_logistics_warehouse_stock WHERE warehouse_id=? AND item_id=? FOR UPDATE',[warehouse.id,b.item_id]);
   if(!stock||Number(stock.quantity)<b.quantity)return fail(409,'warehouse_stock_insufficient');
   const after=round(Number(stock.quantity)-b.quantity);
   await db.execute('UPDATE world_logistics_warehouse_stock SET quantity=? WHERE warehouse_id=? AND item_id=?',[after,warehouse.id,b.item_id]);
   if(!await ledger(db,facility.id,b.item_id,b.quantity,'transfer_in',warehouse.id,actor,'warehouse'))return fail(409,'warehouse_depot_transfer_failed');
   await db.execute("INSERT INTO world_logistics_warehouse_ledger(warehouse_id,item_id,delta,balance_after,action) VALUES(?,?,?,?,'withdrawal')",[warehouse.id,b.item_id,-b.quantity,after]);
   return ok({moved:b.quantity,warehouse_remaining:after});
  });
 }
 return fail(404,'warehouse_route_not_found');
}
export async function runWarehouseAutomation(pool){
 if(!pool)return {arrived:0,disrupted:0};
 const [due]=await pool.execute("SELECT id FROM world_logistics_warehouse_shipments WHERE status='in_transit' AND due_at<=UTC_TIMESTAMP() ORDER BY due_at,id LIMIT 30");
 let arrived=0,disrupted=0;
 for(const row of due){
  const result=await transaction(pool,async db=>{
   const [[shipment]]=await db.execute('SELECT * FROM world_logistics_warehouse_shipments WHERE id=? FOR UPDATE',[row.id]);
   if(!shipment||shipment.status!=='in_transit')return ok({skipped:true});
   if(shipment.train_journey_id){
    const [[train]]=await db.execute('SELECT status FROM order_internal_rail_journeys WHERE id=?',[shipment.train_journey_id]);
    if(!train||train.status==='cancelled'){
     await db.execute("UPDATE world_logistics_warehouse_shipments SET status='disrupted',incident_notes='Train service stopped' WHERE id=?",[shipment.id]);
     return ok({disrupted:true});
    }
   }
   return receipt(db,shipment,{id:null});
  });
  if(result.body.arrived)arrived++;
  if(result.body.disrupted)disrupted++;
 }
 return {arrived,disrupted};
}
