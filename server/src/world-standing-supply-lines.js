// Persistent, opt-in supply network. No implicit freight, stock or vehicle generation.
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const positive=x=>Number.isSafeInteger(Number(x))&&Number(x)>0;
const amount=x=>typeof x==='number'&&Number.isFinite(x)&&x>0&&x<=100000&&Math.round(x*1000)===x*1000;
const round=x=>Math.round(Number(x)*1000)/1000;
const sourceKinds=new Set(['facility','warehouse']),targetKinds=new Set(['warehouse','installation']);
async function parse(req){let size=0,a=[];for await(const c of req){size+=c.length;if(size>18000)return null;a.push(c)}try{return JSON.parse(Buffer.concat(a).toString('utf8'))}catch{return null}}
async function tx(pool,fn){const db=await pool.getConnection();try{await db.beginTransaction();const result=await fn(db);if(result.status===200)await db.commit();else await db.rollback();return result}catch(err){await db.rollback().catch(()=>{});throw err}finally{db.release()}}
async function location(db,kind,id,facilities,lock=false){
 if(kind==='facility')return (await facilities(db)).find(f=>Number(f.id)===Number(id))||null;
 if(kind==='warehouse'){
  const [[w]]=await db.execute('SELECT w.*,s.controlling_faction_id,s.strategic_state FROM world_logistics_warehouses w JOIN world_settlements s ON s.id=w.settlement_id WHERE w.id=?'+(lock?' FOR UPDATE':''),[id]);
  return w||null;
 }
 const [[i]]=await db.execute('SELECT i.*,s.controlling_faction_id,s.strategic_state FROM world_military_installations i JOIN world_settlements s ON s.id=i.settlement_id WHERE i.id=?'+(lock?' FOR UPDATE':''),[id]);
 return i||null;
}
function safeLocation(kind,p){
 if(!p||p.controlling_faction_id!=='eclipse-order'||['destroyed','abandoned'].includes(p.strategic_state))return false;
 if(kind==='facility')return p.owner_faction_id==='eclipse-order'&&!['ruined','captured'].includes(p.status)&&(!p.site_id||p.site_faction_id==='eclipse-order')&&!!p.settlement_id;
 if(kind==='warehouse')return p.state==='operational';
 return ['operational','damaged'].includes(p.state);
}
async function stock(db,kind,id,item){
 if(kind==='facility'){
  const [[row]]=await db.execute('SELECT quantity FROM world_industry_stock WHERE facility_id=? AND item_id=? FOR UPDATE',[id,item]);
  return Number(row?.quantity||0);
 }
 if(kind==='warehouse'){
  await db.execute('INSERT IGNORE INTO world_logistics_warehouse_stock(warehouse_id,item_id,quantity) VALUES(?,?,0)',[id,item]);
  const [[row]]=await db.execute('SELECT quantity FROM world_logistics_warehouse_stock WHERE warehouse_id=? AND item_id=? FOR UPDATE',[id,item]);
  return Number(row?.quantity||0);
 }
 const [[row]]=await db.execute('SELECT quantity FROM world_military_ammunition WHERE installation_id=? AND item_id=?',[id,item]);
 return Number(row?.quantity||0);
}
async function shift(db,kind,id,item,delta,actor,ref,ledger){
 if(kind==='facility')return ledger(db,id,item,delta,delta<0?'freight_dispatch':'freight_arrival',ref,actor,'standing-supply');
 if(kind==='warehouse'){
  const previous=await stock(db,kind,id,item),next=round(previous+delta);
  if(next<0)return false;
  await db.execute('UPDATE world_logistics_warehouse_stock SET quantity=? WHERE warehouse_id=? AND item_id=?',[next,id,item]);
  await db.execute("INSERT INTO world_logistics_warehouse_ledger(warehouse_id,item_id,delta,balance_after,action) VALUES(?,?,?,?,?)",[id,item,delta,next,delta<0?'withdrawal':'arrival']);
  return true;
 }
 if(delta<0)return false;
 await db.execute('INSERT IGNORE INTO world_military_ammunition(installation_id,item_id,quantity) VALUES(?,?,0)',[id,item]);
 await db.execute('UPDATE world_military_ammunition SET quantity=quantity+? WHERE installation_id=? AND item_id=?',[delta,id,item]);
 await db.execute('INSERT INTO world_military_activity(installation_id,activity,detail,actor_id) VALUES(?,?,?,?)',[id,'ammo_in',item+' '+delta+' automatic supply arrival',actor.id]);
 return true;
}
async function destinationRoom(db,line,dest){
 if(line.destination_kind!=='warehouse')return Infinity;
 const [[stored]]=await db.execute('SELECT COALESCE(SUM(quantity),0) AS n FROM world_logistics_warehouse_stock WHERE warehouse_id=?',[line.destination_id]);
 const [[manual]]=await db.execute("SELECT COALESCE(SUM(quantity),0) AS n FROM world_logistics_warehouse_shipments WHERE destination_warehouse_id=? AND status IN ('in_transit','disrupted')",[line.destination_id]);
 const [[standing]]=await db.execute("SELECT COALESCE(SUM(quantity),0) AS n FROM world_logistics_supply_line_shipments WHERE destination_kind='warehouse' AND destination_id=? AND status IN ('in_transit','disrupted')",[line.destination_id]);
 return round(Number(dest.capacity_units)-Number(stored.n)-Number(manual.n)-Number(standing.n));
}
async function markWaiting(db,line,reason){
 await db.execute("UPDATE world_logistics_supply_lines SET status='waiting',wait_reason=?,next_due_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 15 MINUTE) WHERE id=?",[reason,line.id]);
 return ok({waiting:true,reason});
}
export async function supplyLineRoute(pool,req,path,actor,env){
 if(!['domina','high_command'].includes(actor?.account_role))return fail(403,'command_required');
 if(path==='/world-admin/logistics/supply-lines'&&req.method==='POST'){
  const b=await parse(req);
  if(!b||typeof b.name!=='string'||!b.name.trim()||b.name.length>140||!sourceKinds.has(b.source_kind)||!targetKinds.has(b.destination_kind)||!positive(b.source_id)||!positive(b.destination_id)||b.source_kind==='warehouse'&&b.destination_kind==='warehouse'&&Number(b.source_id)===Number(b.destination_id)||!positive(b.transport_template_id)||!positive(b.vehicle_lot_id)||typeof b.item_id!=='string'||b.item_id.length>48||!amount(b.quantity)||!Number.isInteger(b.interval_minutes)||b.interval_minutes<15||b.interval_minutes>525600||!Number.isFinite(Number(b.keep_at_least||0))||Number(b.keep_at_least||0)<0||b.destination_target!=null&&(!amount(b.destination_target)))return fail(400,'invalid_supply_line');
  return tx(pool,async db=>{
   const [src,dst]=await Promise.all([location(db,b.source_kind,b.source_id,env.facilities),location(db,b.destination_kind,b.destination_id,env.facilities)]);
   if(!safeLocation(b.source_kind,src)||!safeLocation(b.destination_kind,dst))return fail(409,'supply_line_endpoint_unavailable');
   const [[item]]=await db.execute('SELECT id FROM world_industry_items WHERE id=?',[b.item_id]);
   const [[mode]]=await db.execute("SELECT id,mode FROM world_logistics_transport_templates WHERE id=? AND active=1",[b.transport_template_id]);
   if(!item||!mode||!['road','air'].includes(mode.mode))return fail(409,'supply_line_transport_or_item_unavailable');
   if(mode.mode==='air'&&!await env.operationalAirDocks(db,src.settlement_id,dst.settlement_id))return fail(409,'supply_line_air_docks_required');
   if(!await env.route(db,src.settlement_id,dst.settlement_id,mode.mode))return fail(409,'supply_line_route_unavailable');
   const [saved]=await db.execute('INSERT INTO world_logistics_supply_lines(name,source_kind,source_id,destination_kind,destination_id,item_id,quantity,keep_at_least,destination_target,transport_template_id,vehicle_lot_id,interval_minutes,status,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[b.name.trim(),b.source_kind,b.source_id,b.destination_kind,b.destination_id,b.item_id,b.quantity,Number(b.keep_at_least||0),b.destination_target??null,b.transport_template_id,b.vehicle_lot_id,b.interval_minutes,b.activate?'active':'paused',actor.id]);
   return ok({id:saved.insertId,status:b.activate?'active':'paused'});
  });
 }
 const shipmentMatch=/^\/world-admin\/logistics\/supply-lines\/shipments\/(\d+)\/(resume|recall)$/.exec(path);
 if(shipmentMatch&&req.method==='POST')return tx(pool,async db=>{
  const [[cargo]]=await db.execute('SELECT * FROM world_logistics_supply_line_shipments WHERE id=? FOR UPDATE',[Number(shipmentMatch[1])]);
  if(!cargo||!['in_transit','disrupted'].includes(cargo.status))return fail(409,'supply_shipment_not_recoverable');
  if(shipmentMatch[2]==='resume'){
   if(cargo.status!=='disrupted')return fail(409,'supply_shipment_not_disrupted');
   const dest=await location(db,cargo.destination_kind,cargo.destination_id,env.facilities,true);
   if(!safeLocation(cargo.destination_kind,dest))return fail(409,'supply_destination_still_unavailable');
   await db.execute("UPDATE world_logistics_supply_line_shipments SET status='in_transit',incident_notes='',due_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 60 MINUTE) WHERE id=?",[cargo.id]);
   return ok({status:'in_transit'});
  }
  const [[line]]=await db.execute('SELECT created_by FROM world_logistics_supply_lines WHERE id=?',[cargo.supply_line_id]);
  if(!await shift(db,cargo.source_kind,cargo.source_id,cargo.item_id,Number(cargo.quantity),{id:line.created_by},'recall-'+cargo.id,env.ledger))return fail(409,'supply_recall_could_not_refund');
  await db.execute("UPDATE world_logistics_supply_line_shipments SET status='cancelled',incident_notes='Cargo recalled to source; fuel not refunded' WHERE id=?",[cargo.id]);
  return ok({status:'cancelled'});
 });
 const statusMatch=/^\/world-admin\/logistics\/supply-lines\/(\d+)\/status$/.exec(path);
 if(statusMatch&&req.method==='POST'){
  const b=await parse(req);
  if(!['active','paused','retired'].includes(b?.status))return fail(400,'invalid_supply_line_status');
  return tx(pool,async db=>{
   const [[row]]=await db.execute('SELECT * FROM world_logistics_supply_lines WHERE id=? FOR UPDATE',[Number(statusMatch[1])]);
   if(!row)return fail(404,'supply_line_not_found');
   if(row.status==='retired')return fail(409,'supply_line_retired');
   await db.execute("UPDATE world_logistics_supply_lines SET status=?,wait_reason='',next_due_at=IF(?='active',UTC_TIMESTAMP(),next_due_at) WHERE id=?",[b.status,b.status,row.id]);
   return ok({status:b.status});
  });
 }
 return fail(404,'supply_line_route_not_found');
}
export async function runStandingSupplyAutomation(pool,env){
 if(!pool)return {dispatched:0,arrived:0,waiting:0,disrupted:0};
 let dispatched=0,arrived=0,waiting=0,disrupted=0;
 const [due]=await pool.execute("SELECT id FROM world_logistics_supply_line_shipments WHERE status='in_transit' AND due_at<=UTC_TIMESTAMP() ORDER BY due_at,id LIMIT 40");
 for(const row of due){
  const outcome=await tx(pool,async db=>{
   const [[cargo]]=await db.execute('SELECT * FROM world_logistics_supply_line_shipments WHERE id=? FOR UPDATE',[row.id]);
   if(!cargo||cargo.status!=='in_transit')return ok({skipped:true});
   const dest=await location(db,cargo.destination_kind,cargo.destination_id,env.facilities,true);
   if(!safeLocation(cargo.destination_kind,dest)){
    await db.execute("UPDATE world_logistics_supply_line_shipments SET status='disrupted',incident_notes='Receiving location unavailable; cargo held' WHERE id=?",[cargo.id]);
    return ok({disrupted:true});
   }
   // Capacity was reserved at dispatch, but damage or manual changes may have reduced it.
   if(cargo.destination_kind==='warehouse'){
    const [[stored]]=await db.execute('SELECT COALESCE(SUM(quantity),0) AS qty FROM world_logistics_warehouse_stock WHERE warehouse_id=?',[cargo.destination_id]);
    if(Number(stored.qty)+Number(cargo.quantity)>Number(dest.capacity_units)){
     await db.execute("UPDATE world_logistics_supply_line_shipments SET status='disrupted',incident_notes='Warehouse over capacity; cargo held' WHERE id=?",[cargo.id]);
     return ok({disrupted:true});
    }
   }
   const [[line]]=await db.execute('SELECT created_by FROM world_logistics_supply_lines WHERE id=?',[cargo.supply_line_id]);
   if(!await shift(db,cargo.destination_kind,cargo.destination_id,cargo.item_id,Number(cargo.quantity),{id:line.created_by},cargo.id,env.ledger))return fail(409,'arrival_ledger_unavailable');
   await db.execute("UPDATE world_logistics_supply_line_shipments SET status='arrived',arrived_at=UTC_TIMESTAMP() WHERE id=?",[cargo.id]);
   return ok({arrived:true});
  });
  if(outcome.body.arrived)arrived++;
  if(outcome.body.disrupted)disrupted++;
 }
 const [lines]=await pool.execute("SELECT id FROM world_logistics_supply_lines WHERE status IN ('active','waiting') AND next_due_at<=UTC_TIMESTAMP() ORDER BY next_due_at,id LIMIT 25");
 for(const entry of lines){
  const result=await tx(pool,async db=>{
   const [[line]]=await db.execute('SELECT * FROM world_logistics_supply_lines WHERE id=? FOR UPDATE',[entry.id]);
   if(!line||!['active','waiting'].includes(line.status))return ok({skipped:true});
   const [[clock]]=await db.execute('SELECT ?<=UTC_TIMESTAMP() AS due',[line.next_due_at]);
   if(!clock.due)return ok({skipped:true}); // concurrent scheduler already advanced this departure
   const [src,dest]=await Promise.all([location(db,line.source_kind,line.source_id,env.facilities,true),location(db,line.destination_kind,line.destination_id,env.facilities,true)]);
   if(!safeLocation(line.source_kind,src)||!safeLocation(line.destination_kind,dest))return markWaiting(db,line,'Supply endpoint unavailable');
   const [[vehicleTemplate]]=await db.execute("SELECT * FROM world_logistics_transport_templates WHERE id=? AND active=1",[line.transport_template_id]);
   if(!vehicleTemplate||!['road','air'].includes(vehicleTemplate.mode))return markWaiting(db,line,'Transport service unavailable');
   const link=await env.route(db,src.settlement_id,dest.settlement_id,vehicleTemplate.mode);
   if(!link)return markWaiting(db,line,'No operational transport corridor');
   if(vehicleTemplate.mode==='air'&&!await env.operationalAirDocks(db,src.settlement_id,dest.settlement_id))return markWaiting(db,line,'Airship landing site unavailable');
   const vehicle=await env.availableVehicle(db,line.vehicle_lot_id,vehicleTemplate.mode,src.settlement_id);
   if(!vehicle)return markWaiting(db,line,'Transport vehicle busy or not stationed at source');
   const [[inUse]]=await db.execute("SELECT id FROM world_logistics_supply_line_shipments WHERE vehicle_lot_id=? AND status IN ('in_transit','disrupted') LIMIT 1",[line.vehicle_lot_id]);
   if(inUse)return markWaiting(db,line,'Vehicle already carrying another supply load');
   const specifications=typeof vehicle.specifications==='string'?JSON.parse(vehicle.specifications):vehicle.specifications;
   const capacity=Math.min(Number(vehicleTemplate.capacity),Number(specifications?.cargo_capacity||0)*Number(vehicle.quantity||1));
   if(capacity<=0)return markWaiting(db,line,'Vehicle has no registered freight capacity');
   const available=await stock(db,line.source_kind,line.source_id,line.item_id);
   const reserved=Math.max(0,Number(line.keep_at_least||0));
   const room=await destinationRoom(db,line,dest);
   const target=line.destination_target==null?Infinity:Math.max(0,Number(line.destination_target)-await stock(db,line.destination_kind,line.destination_id,line.item_id));
   const load=round(Math.min(Number(line.quantity),capacity,room,target,available-reserved));
   if(load<=0)return markWaiting(db,line,room<=0?'Receiving warehouse full':target<=0?'Destination target already supplied':'Waiting for factory or warehouse stock');
   const legs=Math.max(1,Number(link.legs||1))*2; // includes return trip to source so vehicle can repeat
   const fuel=round(legs*Number(vehicleTemplate.fuel_per_leg||0)*(vehicleTemplate.mode==='air'?3:1));
   if(!vehicleTemplate.fuel_item_id)return markWaiting(db,line,'Freight service has no fuel type');
   const fuelAvailable=await stock(db,line.source_kind,line.source_id,vehicleTemplate.fuel_item_id);
   if(fuelAvailable<fuel+(line.item_id===vehicleTemplate.fuel_item_id?load:0))return markWaiting(db,line,'Awaiting transport fuel');
   const minutes=Math.max(10,2*(Number(link.duration_minutes??(Number(link.legs||1)*Number(vehicleTemplate.minutes_per_leg||60)))+Number(src.access_minutes||0)));
   const [[time]]=await db.execute('SELECT DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? MINUTE) AS due_at',[minutes]);
   const [created]=await db.execute('INSERT INTO world_logistics_supply_line_shipments(supply_line_id,source_kind,source_id,destination_kind,destination_id,item_id,quantity,transport_template_id,vehicle_lot_id,fuel_item_id,fuel_used,route_segments,due_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',[line.id,line.source_kind,line.source_id,line.destination_kind,line.destination_id,line.item_id,load,line.transport_template_id,line.vehicle_lot_id,vehicleTemplate.fuel_item_id,fuel,JSON.stringify(link.segment_ids||[]),time.due_at]);
   const actor={id:line.created_by};
   if(!await shift(db,line.source_kind,line.source_id,line.item_id,-load,actor,created.insertId,env.ledger))return fail(409,'supply_source_debit_failed');
   if(fuel>0&&!await shift(db,line.source_kind,line.source_id,vehicleTemplate.fuel_item_id,-fuel,actor,'fuel-'+created.insertId,env.ledger))return fail(409,'supply_fuel_debit_failed');
   await db.execute("UPDATE world_logistics_supply_lines SET status='active',wait_reason='',last_dispatched_at=UTC_TIMESTAMP(),next_due_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? MINUTE) WHERE id=?",[Number(line.interval_minutes),line.id]);
   return ok({dispatched:true});
  });
  if(result.body.dispatched)dispatched++;
  if(result.body.waiting)waiting++;
 }
 return {dispatched,arrived,waiting,disrupted};
}
