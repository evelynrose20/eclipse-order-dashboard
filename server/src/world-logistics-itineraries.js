import {randomUUID} from 'node:crypto';
// Multi-leg Order freight. Intermediate receipts are removed from general depot stock
// into escrow inside the SAME arrival transaction, so no other dispatch can borrow them.
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const id=value=>Number.isSafeInteger(Number(value))&&Number(value)>0;
const qty=value=>typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=100000&&Math.round(value*1000)===value*1000;
async function json(req){
 let n=0,parts=[];for await(const part of req){n+=part.length;if(n>16000)return null;parts.push(part)}
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{return null}
}
async function transaction(pool,fn){
 const db=await pool.getConnection();
 try{
  await db.beginTransaction();
  const outcome=await fn(db);
  if(outcome.status===200)await db.commit();else await db.rollback();
  return outcome;
 }catch(error){await db.rollback().catch(()=>{});throw error}finally{db.release()}
}
async function event(db,orderId,action,detail,actor){
 await db.execute('INSERT INTO world_logistics_itinerary_events(itinerary_id,action,detail,actor_id) VALUES(?,?,?,?)',[orderId,action,detail.slice(0,300),actor?.id||null]);
}
export function validateItinerary(body){
 if(!body||typeof body.name!=='string'||!body.name.trim()||body.name.length>140||!qty(body.quantity)
  ||typeof body.item_id!=='string'||!(/^[a-z0-9][a-z0-9-]{0,47}$/).test(body.item_id)
  ||!Array.isArray(body.legs)||body.legs.length<2||body.legs.length>6)return false;
 return body.legs.every((leg,i)=>{
  if(!['road','rail','air'].includes(leg.mode)||!id(leg.source_facility_id)||!id(leg.destination_facility_id)||!id(leg.transport_template_id)
    ||Number(leg.source_facility_id)===Number(leg.destination_facility_id))return false;
  return !i||Number(body.legs[i-1].destination_facility_id)===Number(leg.source_facility_id);
 });
}
export async function itineraryRoute(pool,req,path,actor,dispatch,ledger){
 if(!['domina','high_command'].includes(actor?.account_role))return fail(403,'command_required');
 if(path==='/world-admin/logistics/itineraries'&&req.method==='GET'){
  const [orders]=await pool.execute('SELECT * FROM world_logistics_itineraries ORDER BY id DESC LIMIT 100');
  const [legs]=await pool.execute('SELECT l.*,s.status AS shipment_status,s.due_at,s.arrived_at FROM world_logistics_itinerary_legs l LEFT JOIN world_logistics_shipments s ON s.id=l.shipment_id WHERE l.itinerary_id IN (SELECT id FROM (SELECT id FROM world_logistics_itineraries ORDER BY id DESC LIMIT 100) recent) ORDER BY l.itinerary_id,l.leg_number');
  const [reservations]=await pool.execute('SELECT * FROM world_logistics_itinerary_reservations ORDER BY itinerary_id');
  return ok({orders:orders.map(order=>({...order,legs:legs.filter(l=>Number(l.itinerary_id)===Number(order.id)),reservation:reservations.find(r=>Number(r.itinerary_id)===Number(order.id))||null}))});
 }
 if(path==='/world-admin/logistics/itineraries'&&req.method==='POST'){
  const body=await json(req);if(!validateItinerary(body))return fail(400,'invalid_itinerary');
  return transaction(pool,async db=>{
   const [[item]]=await db.execute('SELECT id FROM world_industry_items WHERE id=?',[body.item_id]);
   if(!item)return fail(404,'item_not_found');
   for(const leg of body.legs){
    const [[template]]=await db.execute('SELECT id,mode,capacity FROM world_logistics_transport_templates WHERE id=? AND active=1',[Number(leg.transport_template_id)]);
    if(!template||template.mode!==leg.mode||Number(template.capacity)<body.quantity)return fail(409,'itinerary_transport_unavailable');
    const [facilities]=await db.execute('SELECT id FROM world_industry_facilities WHERE id IN (?,?)',[Number(leg.source_facility_id),Number(leg.destination_facility_id)]);
    if(facilities.length!==2)return fail(404,'itinerary_facility_not_found');
   }
   const [created]=await db.execute('INSERT INTO world_logistics_itineraries(name,item_id,quantity,created_by) VALUES(?,?,?,?)',[body.name.trim(),body.item_id,body.quantity,actor.id]);
   for(let i=0;i<body.legs.length;i++){
    const leg=body.legs[i];
    await db.execute('INSERT INTO world_logistics_itinerary_legs(itinerary_id,leg_number,mode,source_facility_id,destination_facility_id,transport_template_id) VALUES(?,?,?,?,?,?)',[created.insertId,i+1,leg.mode,Number(leg.source_facility_id),Number(leg.destination_facility_id),Number(leg.transport_template_id)]);
   }
   await event(db,created.insertId,'plan','Planned '+body.legs.length+' connected transport legs',actor);
   return ok({id:created.insertId,state:'planned'});
  });
 }
 const match=/^\/world-admin\/logistics\/itineraries\/(\d+)\/dispatch$/.exec(path);
 if(match&&req.method==='POST'){
  const b=await json(req);
  if(!b||b.vehicle_lot_id!=null&&b.vehicle_lot_id!==''&&!id(b.vehicle_lot_id)
     ||b.train_journey_id!=null&&b.train_journey_id!==''&&!id(b.train_journey_id))return fail(400,'invalid_itinerary_dispatch');
  return transaction(pool,async db=>{
   const itineraryId=Number(match[1]);
   const [[order]]=await db.execute('SELECT * FROM world_logistics_itineraries WHERE id=? FOR UPDATE',[itineraryId]);
   if(!order)return fail(404,'itinerary_not_found');
   if(!['planned','at_hub'].includes(order.state))return fail(409,'itinerary_not_ready_for_dispatch');
   const [legs]=await db.execute('SELECT * FROM world_logistics_itinerary_legs WHERE itinerary_id=? ORDER BY leg_number FOR UPDATE',[itineraryId]);
   const next=legs.find(leg=>leg.shipment_id===null);
   if(!next)return fail(409,'itinerary_all_legs_dispatched');
   if(order.state==='planned'&&Number(next.leg_number)!==1)return fail(409,'itinerary_state_conflict');
   if(order.state==='at_hub'){
    const [[reserved]]=await db.execute('SELECT * FROM world_logistics_itinerary_reservations WHERE itinerary_id=? FOR UPDATE',[itineraryId]);
    if(!reserved||Number(reserved.facility_id)!==Number(next.source_facility_id)||reserved.item_id!==order.item_id||Number(reserved.quantity)!==Number(order.quantity))return fail(409,'itinerary_reserved_cargo_unavailable');
    if(!await ledger(db,reserved.facility_id,order.item_id,Number(order.quantity),'freight_unstage',reserved.shipment_id,actor))return fail(409,'itinerary_unstage_failed');
    await db.execute('DELETE FROM world_logistics_itinerary_reservations WHERE itinerary_id=?',[itineraryId]);
   }
   const manifest={
    request_key:randomUUID(),
    source_facility_id:Number(next.source_facility_id),destination_facility_id:Number(next.destination_facility_id),
    transport_template_id:Number(next.transport_template_id),item_id:order.item_id,quantity:Number(order.quantity),
    vehicle_lot_id:Number(b.vehicle_lot_id)||null,train_journey_id:Number(b.train_journey_id)||null,
    escort_notes:String(b.escort_notes||'').slice(0,300)
   };
   const sent=await dispatch(db,manifest,actor);
   if(sent.status!==200)return sent; // rolls back escrow release too
   await db.execute('UPDATE world_logistics_itinerary_legs SET shipment_id=? WHERE itinerary_id=? AND leg_number=?',[sent.body.shipment_id,itineraryId,next.leg_number]);
   await db.execute("UPDATE world_logistics_itineraries SET state='in_transit' WHERE id=?",[itineraryId]);
   await event(db,itineraryId,next.leg_number===1?'dispatch':'continue','Leg '+next.leg_number+' departed via '+next.mode,actor);
   return ok({itinerary_id:itineraryId,leg:next.leg_number,shipment_id:sent.body.shipment_id,state:'in_transit'});
  });
 }
 const release=/^\/world-admin\/logistics\/itineraries\/(\d+)\/release$/.exec(path);
 if(release&&req.method==='POST')return transaction(pool,async db=>{
  const key=Number(release[1]);
  const [[order]]=await db.execute('SELECT * FROM world_logistics_itineraries WHERE id=? FOR UPDATE',[key]);
  if(!order)return fail(404,'itinerary_not_found');
  if(order.state!=='at_hub')return fail(409,'itinerary_cargo_not_at_hub');
  const [[reserved]]=await db.execute('SELECT * FROM world_logistics_itinerary_reservations WHERE itinerary_id=? FOR UPDATE',[key]);
  if(!reserved)return fail(409,'itinerary_reservation_missing');
  if(!await ledger(db,reserved.facility_id,reserved.item_id,Number(reserved.quantity),'freight_unstage',reserved.shipment_id,actor))return fail(409,'release_failed');
  await db.execute('DELETE FROM world_logistics_itinerary_reservations WHERE itinerary_id=?',[key]);
  await db.execute("UPDATE world_logistics_itineraries SET state='cancelled' WHERE id=?",[key]);
  await event(db,key,'recall','Remaining cargo released to hub depot; no new freight dispatched',actor);
  return ok({state:'cancelled'});
 });
 return fail(404,'itinerary_route_not_found');
}
// Invoked by manual and scheduled arrivals BEFORE the surrounding transaction commits.
export async function stageItineraryArrival(db,shipment,ledger,actor){
 const [[link]]=await db.execute('SELECT itinerary_id,leg_number FROM world_logistics_itinerary_legs WHERE shipment_id=?',[shipment.id]);
 if(!link)return;
 const [[order]]=await db.execute('SELECT * FROM world_logistics_itineraries WHERE id=? FOR UPDATE',[link.itinerary_id]);
 if(!order||order.state!=='in_transit')throw new Error('itinerary_arrival_state_conflict');
 const [[later]]=await db.execute('SELECT leg_number FROM world_logistics_itinerary_legs WHERE itinerary_id=? AND leg_number>? ORDER BY leg_number LIMIT 1',[link.itinerary_id,link.leg_number]);
 if(later){
  if(!await ledger(db,shipment.destination_facility_id,shipment.item_id,-Number(shipment.quantity),'freight_stage',shipment.id,actor))throw new Error('itinerary_stage_stock_failed');
  await db.execute('INSERT INTO world_logistics_itinerary_reservations(itinerary_id,facility_id,item_id,quantity,shipment_id) VALUES(?,?,?,?,?)',[link.itinerary_id,shipment.destination_facility_id,shipment.item_id,shipment.quantity,shipment.id]);
  await db.execute("UPDATE world_logistics_itineraries SET state='at_hub' WHERE id=?",[link.itinerary_id]);
  await event(db,link.itinerary_id,'stage','Cargo secured at intermediate hub, available only for the next itinerary leg',actor);
 }else{
  await db.execute("UPDATE world_logistics_itineraries SET state='delivered',completed_at=UTC_TIMESTAMP() WHERE id=?",[link.itinerary_id]);
  await event(db,link.itinerary_id,'deliver','Final leg credited to destination depot',actor);
 }
}
export async function handleItineraryRecall(db,shipment,ledger,actor){
 const [[link]]=await db.execute('SELECT itinerary_id,leg_number FROM world_logistics_itinerary_legs WHERE shipment_id=?',[shipment.id]);
 if(!link)return;
 const [[order]]=await db.execute('SELECT * FROM world_logistics_itineraries WHERE id=? FOR UPDATE',[link.itinerary_id]);
 if(!order||order.state!=='in_transit')throw new Error('itinerary_recall_state_conflict');
 if(Number(link.leg_number)>1){
  // An interrupted leg can be retried from its last hub, but the cancelled
  // journey is never reused as an active leg.
  if(!await ledger(db,shipment.source_facility_id,shipment.item_id,-Number(shipment.quantity),'freight_stage',shipment.id,actor))throw new Error('itinerary_recall_reserve_failed');
  await db.execute('INSERT INTO world_logistics_itinerary_reservations(itinerary_id,facility_id,item_id,quantity,shipment_id) VALUES(?,?,?,?,?)',[link.itinerary_id,shipment.source_facility_id,shipment.item_id,shipment.quantity,shipment.id]);
  await db.execute('UPDATE world_logistics_itinerary_legs SET shipment_id=NULL WHERE itinerary_id=? AND leg_number=?',[link.itinerary_id,link.leg_number]);
  await db.execute("UPDATE world_logistics_itineraries SET state='at_hub' WHERE id=?",[link.itinerary_id]);
 }else{
  await db.execute("UPDATE world_logistics_itineraries SET state='cancelled' WHERE id=?",[link.itinerary_id]);
 }
 await event(db,link.itinerary_id,'recall','Cargo recalled; no duplicated receipt',actor);
}
