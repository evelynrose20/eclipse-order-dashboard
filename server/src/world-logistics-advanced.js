// Staff-reviewed cargo risks. Weather can propose incidents, never silently destroy stock.
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const valid=x=>Number.isSafeInteger(Number(x))&&Number(x)>0;
async function input(req){let size=0,parts=[];for await(const part of req){size+=part.length;if(size>12000)return null;parts.push(part)}try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{return null}}
async function tx(pool,fn){const db=await pool.getConnection();try{await db.beginTransaction();const result=await fn(db);if(result.status===200)await db.commit();else await db.rollback();return result}catch(error){await db.rollback().catch(()=>{});throw error}finally{db.release()}}
async function debit(db,facility,item,quantity,action,reference,actor){
 const [[stock]]=await db.execute('SELECT quantity FROM world_industry_stock WHERE facility_id=? AND item_id=? FOR UPDATE',[facility,item]);
 if(!stock||Number(stock.quantity)<quantity)return false;
 const balance=Math.round((Number(stock.quantity)-quantity)*1000)/1000;
 await db.execute('UPDATE world_industry_stock SET quantity=? WHERE facility_id=? AND item_id=?',[balance,facility,item]);
 await db.execute('INSERT INTO world_industry_ledger(facility_id,item_id,delta,balance_after,action,reference_key,actor_id) VALUES(?,?,?,?,?,?,?)',[facility,item,-quantity,balance,action,reference,actor.id]);
 return true;
}
export async function airfieldReady(db,source,dest){
 const [rows]=await db.execute("SELECT settlement_id FROM world_logistics_airfields WHERE status='operational' AND settlement_id IN (?,?)",[source,dest]);
 return new Set(rows.map(r=>Number(r.settlement_id))).size===(Number(source)===Number(dest)?1:2);
}
export async function vehicleReady(db,lotId){
 const [[row]]=await db.execute('SELECT condition_pct FROM world_logistics_vehicle_condition WHERE vehicle_lot_id=?',[lotId]);
 return !row||Number(row.condition_pct)>=25;
}
export function airFreightEconomics({fuelPerLeg,legs,durationMinutes}){
 const fuel=Math.round(Math.max(5,Number(fuelPerLeg)*2.5)*Math.max(1,Number(legs))*1000)/1000;
 const minutes=Math.max(10,Math.ceil(Number(durationMinutes)*.65));
 return {fuel,minutes};
}
export async function advancedLogisticsRoute(pool,req,path,actor){
 if(!['domina','high_command'].includes(actor?.account_role))return fail(403,'command_required');
 if(path==='/world-admin/logistics/advanced'&&req.method==='GET'){
  const [airfields]=await pool.execute('SELECT a.*,s.name AS settlement_name,f.name AS construction_facility_name FROM world_logistics_airfields a JOIN world_settlements s ON s.id=a.settlement_id JOIN world_industry_facilities f ON f.id=a.built_from_facility_id ORDER BY s.name');
  const [condition]=await pool.execute("SELECT c.*,v.stationed_settlement_id,v.status,v.owner_faction_id,t.name AS equipment_name,t.equipment_kind FROM world_logistics_vehicle_condition c JOIN world_magitek_equipment_inventory v ON v.id=c.vehicle_lot_id JOIN world_magitek_equipment_templates t ON t.id=v.equipment_template_id ORDER BY c.condition_pct,c.vehicle_lot_id");
  const [escorts]=await pool.execute('SELECT e.*,i.name AS installation_name FROM world_logistics_convoy_escorts e JOIN world_military_installations i ON i.id=e.installation_id ORDER BY e.assigned_at DESC LIMIT 100');
  const [risks]=await pool.execute('SELECT * FROM world_logistics_risk_reviews ORDER BY created_at DESC,id DESC LIMIT 100');
  return ok({airfields,condition,escorts,risks});
 }
 if(path==='/world-admin/logistics/airfields'&&req.method==='POST'){
  const b=await input(req);
  if(!valid(b?.settlement_id)||!valid(b?.facility_id)||typeof b?.item_id!=='string'||!Number.isFinite(b?.quantity)||b.quantity<=0||b.quantity>50000)return fail(400,'airfield_construction_invalid');
  return tx(pool,async db=>{
   const [[place]]=await db.execute('SELECT controlling_faction_id FROM world_settlements WHERE id=?',[b.settlement_id]);
   const [[facility]]=await db.execute('SELECT settlement_id,owner_faction_id FROM world_industry_facilities WHERE id=?',[b.facility_id]);
   const [[item]]=await db.execute('SELECT id FROM world_industry_items WHERE id=?',[b.item_id]);
   if(place?.controlling_faction_id!=='eclipse-order'||Number(facility?.settlement_id)!==Number(b.settlement_id)||facility.owner_faction_id!=='eclipse-order'||!item)return fail(409,'airfield_requires_order_industry');
   const [[exists]]=await db.execute('SELECT settlement_id FROM world_logistics_airfields WHERE settlement_id=? FOR UPDATE',[b.settlement_id]);
   if(exists)return fail(409,'airfield_already_registered');
   if(!await debit(db,b.facility_id,b.item_id,b.quantity,'corridor_build','airfield:'+b.settlement_id,actor))return fail(409,'airfield_construction_stock_insufficient');
   await db.execute('INSERT INTO world_logistics_airfields(settlement_id,built_from_facility_id,construction_item_id,construction_quantity,created_by) VALUES(?,?,?,?,?)',[b.settlement_id,b.facility_id,b.item_id,b.quantity,actor.id]);
   return ok({settlement_id:b.settlement_id,status:'operational'});
  });
 }
 const air=/^\/world-admin\/logistics\/airfields\/(\d+)\/(close|damage|reopen|repair)$/.exec(path);
 if(air&&req.method==='POST'){
  const b=await input(req);
  return tx(pool,async db=>{
   const [[field]]=await db.execute('SELECT * FROM world_logistics_airfields WHERE settlement_id=? FOR UPDATE',[Number(air[1])]);
   if(!field)return fail(404,'airfield_not_found');
   if(air[2]==='repair'){
    if(field.status!=='damaged')return fail(409,'airfield_not_damaged');
    const quantity=Number(b?.quantity);
    if(!Number.isFinite(quantity)||quantity<field.construction_quantity/4)return fail(409,'airfield_repair_materials_insufficient');
    if(!await debit(db,field.built_from_facility_id,field.construction_item_id,quantity,'corridor_build','airfield_repair:'+air[1],actor))return fail(409,'airfield_repair_stock_insufficient');
    await db.execute("UPDATE world_logistics_airfields SET status='operational' WHERE settlement_id=?",[Number(air[1])]);
    return ok({status:'operational'});
   }
   if(air[2]==='reopen'&&field.status!=='closed')return fail(409,'airfield_requires_repair_or_closure');
   if(air[2]==='damage'&&field.status==='damaged')return fail(409,'airfield_already_damaged');
   const status=air[2]==='close'?'closed':air[2]==='damage'?'damaged':'operational';
   await db.execute('UPDATE world_logistics_airfields SET status=? WHERE settlement_id=?',[status,Number(air[1])]);
   return ok({status});
  });
 }
 const repair=/^\/world-admin\/logistics\/fleet\/(\d+)\/repair$/.exec(path);
 if(repair&&req.method==='POST'){
  const b=await input(req);
  if(!valid(b?.facility_id)||typeof b?.item_id!=='string'||!Number.isInteger(b?.quantity)||b.quantity<1||b.quantity>100)return fail(400,'repair_materials_invalid');
  return tx(pool,async db=>{
   const [[lot]]=await db.execute('SELECT * FROM world_magitek_equipment_inventory WHERE id=? FOR UPDATE',[Number(repair[1])]);
   const [[depot]]=await db.execute('SELECT settlement_id,owner_faction_id FROM world_industry_facilities WHERE id=?',[b.facility_id]);
   if(!lot||lot.owner_faction_id!=='eclipse-order'||!['assigned','damaged'].includes(lot.status)||Number(depot?.settlement_id)!==Number(lot.stationed_settlement_id)||depot.owner_faction_id!=='eclipse-order')return fail(409,'fleet_repair_requires_stationed_depot');
   await db.execute('INSERT IGNORE INTO world_logistics_vehicle_condition(vehicle_lot_id) VALUES(?)',[lot.id]);
   const [[condition]]=await db.execute('SELECT condition_pct FROM world_logistics_vehicle_condition WHERE vehicle_lot_id=? FOR UPDATE',[lot.id]);
   if(Number(condition.condition_pct)>=100)return fail(409,'vehicle_already_ready');
   const repairAmount=Math.min(50,b.quantity*5),next=Math.min(100,Number(condition.condition_pct)+repairAmount);
   if(!await debit(db,b.facility_id,b.item_id,b.quantity,'military_supply','fleet_repair:'+lot.id,actor))return fail(409,'fleet_repair_stock_insufficient');
   await db.execute('UPDATE world_logistics_vehicle_condition SET condition_pct=?,last_repaired_at=UTC_TIMESTAMP() WHERE vehicle_lot_id=?',[next,lot.id]);
   if(next>=25&&lot.status==='damaged')await db.execute("UPDATE world_magitek_equipment_inventory SET status='assigned' WHERE id=?",[lot.id]);
   return ok({condition_pct:next});
  });
 }
 const escort=/^\/world-admin\/logistics\/shipments\/(\d+)\/escort$/.exec(path);
 if(escort&&req.method==='POST'){
  const b=await input(req);
  if(!valid(b?.installation_id)||!Number.isInteger(b?.troops)||b.troops<1||b.troops>10000)return fail(400,'escort_assignment_invalid');
  return tx(pool,async db=>{
   const [[shipment]]=await db.execute('SELECT id,status FROM world_logistics_shipments WHERE id=? FOR UPDATE',[Number(escort[1])]);
   if(!shipment||!['in_transit','disrupted'].includes(shipment.status))return fail(409,'escort_shipment_not_running');
   const [[installation]]=await db.execute('SELECT id,state,condition_pct FROM world_military_installations WHERE id=?',[b.installation_id]);
   if(!installation||installation.state!=='operational'||Number(installation.condition_pct)<25)return fail(409,'escort_installation_not_ready');
   const [[garrison]]=await db.execute('SELECT COALESCE(SUM(quantity),0) AS troops FROM world_military_garrisons WHERE installation_id=?',[b.installation_id]);
   const [[assigned]]=await db.execute("SELECT COALESCE(SUM(troops_committed),0) AS troops FROM world_logistics_convoy_escorts WHERE installation_id=? AND status='assigned'",[b.installation_id]);
   if(Number(garrison.troops)-Number(assigned.troops)<b.troops)return fail(409,'escort_force_insufficient');
   const [[existing]]=await db.execute('SELECT shipment_id FROM world_logistics_convoy_escorts WHERE shipment_id=?',[shipment.id]);
   if(existing)return fail(409,'escort_already_assigned');
   await db.execute('INSERT INTO world_logistics_convoy_escorts(shipment_id,installation_id,troops_committed,assigned_by) VALUES(?,?,?,?)',[shipment.id,b.installation_id,b.troops,actor.id]);
   return ok({assigned:true,shipment_id:shipment.id});
  });
 }
 const risks=/^\/world-admin\/logistics\/risks(?:\/(\d+)\/review)?$/.exec(path);
 if(risks&&req.method==='POST'){
  const b=await input(req);
  if(!risks[1]){
   if(!valid(b?.shipment_id)||!['weather','ambush','mechanical'].includes(b.risk_type)||!Number.isInteger(b.proposed_wear)||b.proposed_wear<0||b.proposed_wear>40||typeof b.narrative!=='string'||b.narrative.length>500)return fail(400,'convoy_risk_invalid');
   return tx(pool,async db=>{
    const [[shipment]]=await db.execute('SELECT id,status FROM world_logistics_shipments WHERE id=? FOR UPDATE',[b.shipment_id]);
    if(!shipment||!['in_transit','disrupted'].includes(shipment.status))return fail(409,'risk_shipment_inactive');
    const [created]=await db.execute("INSERT INTO world_logistics_risk_reviews(shipment_id,risk_type,proposed_wear,narrative,created_by) VALUES(?,?,?,?,?)",[shipment.id,b.risk_type,b.proposed_wear,b.narrative,actor.id]);
    return ok({id:created.insertId,status:'pending'});
   });
  }
  if(!['approve','reject'].includes(b?.decision))return fail(400,'risk_decision_invalid');
  return tx(pool,async db=>{
   const [[review]]=await db.execute('SELECT * FROM world_logistics_risk_reviews WHERE id=? FOR UPDATE',[Number(risks[1])]);
   if(!review)return fail(404,'risk_review_not_found');
   if(review.status!=='pending')return fail(409,'risk_already_reviewed');
   const [[shipment]]=await db.execute('SELECT id,status,vehicle_lot_id FROM world_logistics_shipments WHERE id=? FOR UPDATE',[review.shipment_id]);
   if(!shipment)return fail(404,'shipment_not_found');
   if(b.decision==='approve'&&Number(review.proposed_wear)>0){
    if(!['in_transit','disrupted'].includes(shipment.status)||!shipment.vehicle_lot_id)return fail(409,'risk_vehicle_no_longer_active');
    await db.execute('INSERT IGNORE INTO world_logistics_vehicle_condition(vehicle_lot_id) VALUES(?)',[shipment.vehicle_lot_id]);
    const [[condition]]=await db.execute('SELECT condition_pct FROM world_logistics_vehicle_condition WHERE vehicle_lot_id=? FOR UPDATE',[shipment.vehicle_lot_id]);
    const next=Math.max(0,Number(condition.condition_pct)-Number(review.proposed_wear));
    await db.execute('UPDATE world_logistics_vehicle_condition SET condition_pct=? WHERE vehicle_lot_id=?',[next,shipment.vehicle_lot_id]);
    if(next<25){
     await db.execute("UPDATE world_magitek_equipment_inventory SET status='damaged' WHERE id=?",[shipment.vehicle_lot_id]);
     await db.execute("UPDATE world_logistics_shipments SET status='disrupted',incident_notes='Vehicle requires repair after approved event' WHERE id=?",[shipment.id]);
    }
   }
   await db.execute('UPDATE world_logistics_risk_reviews SET status=?,reviewed_by=?,reviewed_at=UTC_TIMESTAMP() WHERE id=?',[b.decision==='approve'?'approved':'rejected',actor.id,review.id]);
   return ok({status:b.decision==='approve'?'approved':'rejected'});
  });
 }
 return fail(404,'advanced_logistics_not_found');
}
