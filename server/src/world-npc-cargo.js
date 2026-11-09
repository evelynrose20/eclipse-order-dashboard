import {civilianStorageCapacity} from './world-civic-building-templates.js';

const fail=(status,error)=>({status,body:{error}});
const ok=body=>({status:200,body});
const int=(x,a,b)=>Number.isInteger(x)&&x>=a&&x<=b;
const round=x=>Math.round(Number(x)*1000)/1000;
const foodItems=new Set(['grain','vegetables','fruit','fish','animal-produce']);
const dateOf=d=>new Date(d).toISOString().slice(0,10);

export async function npcMappedFarmOptions(db,settlement){
 const [sites]=await db.execute(`SELECT i.id,i.name,i.kind,i.region_id,i.zone_id,
 COALESCE(i.controlling_faction_id,z.controlling_faction_id) AS owner_faction_id
 FROM world_industry_sites i JOIN world_zones z ON z.id=i.zone_id
 WHERE i.kind IN ('farm','ranch') AND i.region_id=? AND COALESCE(i.controlling_faction_id,z.controlling_faction_id)=?
 ORDER BY i.name`,[settlement.region_id,settlement.controlling_faction_id]);
 const [markers]=await db.execute(`SELECT id,name,map_icon AS kind,region_id,zone_id,controlling_faction_id AS owner_faction_id
 FROM world_settlements WHERE region_id=? AND controlling_faction_id=?
 AND map_icon IN ('farm','ranch','orchard') AND strategic_state NOT IN ('destroyed','abandoned')
 ORDER BY name`,[settlement.region_id,settlement.controlling_faction_id]);
 return [...sites.map(x=>({...x,source_type:'industry_site'})),...markers.map(x=>({...x,source_type:'settlement_marker'}))];
}

export async function assignNpcMappedFarm(db,settlement,options){
 if(!['industry_site','settlement_marker'].includes(options?.source_type)||!int(options?.source_id,1,Number.MAX_SAFE_INTEGER)
   ||!int(options?.travel_hours,1,168)||!int(options?.cargo_capacity,1,100000))
  return fail(400,'invalid_npc_farm_route');
 if(!settlement.controlling_faction_id||settlement.controlling_faction_id==='eclipse-order')
  return fail(409,'npc_farm_requires_npc_faction');
 const sourceType=options.source_type;
 const candidates=await npcMappedFarmOptions(db,settlement);
 const chosen=candidates.find(x=>x.source_type===sourceType&&Number(x.id)===options.source_id);
 if(!chosen)return fail(409,'farm_not_owned_or_not_available_on_map');
 const [[alreadyUsed]]=await db.execute(`SELECT settlement_id FROM world_npc_cargo_routes
 WHERE ${sourceType==='industry_site'?'site_id':'map_settlement_id'}=? AND settlement_id<>? FOR UPDATE`,[chosen.id,settlement.id]);
 if(alreadyUsed)return fail(409,'mapped_farm_already_assigned');
 const [[existing]]=await db.execute('SELECT * FROM world_npc_cargo_routes WHERE settlement_id=? FOR UPDATE',[settlement.id]);
 // Never silently strand cargo already in transit. Disable and complete it before switching suppliers.
 if(existing&&Number(existing.site_id||existing.map_settlement_id)!==Number(chosen.id)){
  const [[pending]]=await db.execute("SELECT id FROM world_npc_cargo_shipments WHERE route_id=? AND status='in_transit' LIMIT 1",[existing.id]);
  if(pending)return fail(409,'farm_change_wait_for_cargo_arrival');
 }
 const field=sourceType==='industry_site'?'site_id':'settlement_id';
 const [[facility]]=await db.execute('SELECT * FROM world_industry_facilities WHERE '+field+'=? AND owner_faction_id=? ORDER BY id LIMIT 1 FOR UPDATE',[chosen.id,settlement.controlling_faction_id]);
 let facilityId=facility?.id||null;
 if(facility){
  if(!['operational','paused'].includes(facility.status))return fail(409,'farm_facility_requires_repair');
  if(facility.status==='paused')return fail(409,'farm_facility_paused');
  await db.execute("UPDATE world_industry_facilities SET cycle_mode='automatic',cycle_cadence='normal' WHERE id=?",[facility.id]);
 }else{
  const [[template]]=await db.execute("SELECT t.id,t.current_version FROM world_industry_templates t WHERE slug='starter-working-farmland' AND archived=0 LIMIT 1");
  if(!template)return fail(409,'starter_farm_template_missing');
  const [created]=await db.execute(`INSERT INTO world_industry_facilities
   (settlement_id,site_id,owner_faction_id,template_id,template_version,name,status,level,capacity_pct,workforce,heat_available,power_available,cycle_mode,cycle_cadence,notes,created_by)
   VALUES(?,?,?,?,?,?,'operational',1,100,0,0,0,'automatic','normal','Operates at selected map farm; cargo travels separately',NULL)`,[
    sourceType==='settlement_marker'?chosen.id:null,
    sourceType==='industry_site'?chosen.id:null,
    settlement.controlling_faction_id,template.id,template.current_version,chosen.name+' Farm',]);
  facilityId=created.insertId;
 }
 if(existing){
  const previousId=Number(existing.facility_id);
  await db.execute(`UPDATE world_npc_cargo_routes SET site_id=?,map_settlement_id=?,facility_id=?,travel_hours=?,cargo_capacity=?,enabled=1 WHERE id=?`,[
   sourceType==='industry_site'?chosen.id:null,sourceType==='settlement_marker'?chosen.id:null,facilityId,options.travel_hours,options.cargo_capacity,existing.id]);
  // Prior generated farm has no map attachment: retire it rather than allowing invisible production.
  if(previousId!==facilityId){
   await db.execute("UPDATE world_industry_facilities SET cycle_mode='off' WHERE id=? AND site_id IS NULL AND settlement_id=? AND created_by IS NULL",[previousId,settlement.id]);
  }
 }else{
  await db.execute('INSERT INTO world_npc_cargo_routes(settlement_id,site_id,map_settlement_id,facility_id,travel_hours,cargo_capacity) VALUES(?,?,?,?,?,?)',[
   settlement.id,sourceType==='industry_site'?chosen.id:null,sourceType==='settlement_marker'?chosen.id:null,facilityId,options.travel_hours,options.cargo_capacity]);
 }
 // Retire old automatically generated (unmapped) founding farm if present, without deleting historical stock.
 await db.execute("UPDATE world_industry_facilities SET cycle_mode='off' WHERE id<>? AND settlement_id=? AND site_id IS NULL AND created_by IS NULL AND notes LIKE 'One-time NPC founding farm%' ",[facilityId,settlement.id]);
 return ok({saved:true,facility_id:facilityId,source_type:sourceType,source_id:chosen.id});
}

async function transaction(pool,work){
 const db=await pool.getConnection();
 try{await db.beginTransaction();const result=await work(db);if(result?.status&&result.status!==200)await db.rollback();else await db.commit();return result}
 catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}
}

/** Dispatch capped physical stock, then receive it only after route travel elapses.
 * Both stages are transactional; there are no instant/implicit settlement food credits.
 */
export async function runNpcCargoAutomation(pool,now=new Date()){
 if(!pool)return {delivered:0,dispatched:0};
 const day=dateOf(now),at=new Date(now).toISOString().slice(0,19).replace('T',' ');
 const [pending]=await pool.execute("SELECT id FROM world_npc_cargo_shipments WHERE status='in_transit' AND arrival_at<=? ORDER BY arrival_at,id LIMIT 150",[at]);
 let delivered=0,dispatched=0;
 for(const shipment of pending){
  try{
   const result=await transaction(pool,async db=>{
    const [[s]]=await db.execute('SELECT * FROM world_npc_cargo_shipments WHERE id=? FOR UPDATE',[shipment.id]);
    if(!s||s.status!=='in_transit'||new Date(s.arrival_at).getTime()>new Date(now).getTime())return fail(409,'shipment_not_due');
    const [[route]]=await db.execute('SELECT * FROM world_npc_cargo_routes WHERE id=?',[s.route_id]);
    const [[site]]=await db.execute('SELECT * FROM world_settlements WHERE id=? FOR UPDATE',[s.settlement_id]);
    const [[facility]]=await db.execute('SELECT owner_faction_id,status FROM world_industry_facilities WHERE id=?',[s.facility_id]);
    if(!route||!site||!facility||site.controlling_faction_id!==facility.owner_faction_id||!route.enabled)return fail(409,'shipment_route_ownership_changed');
    if(foodItems.has(s.item_id)){
     const [buildings]=await db.execute('SELECT * FROM world_settlement_upgrades WHERE settlement_id=?',[site.id]);
     const capacity=civilianStorageCapacity(site,buildings);
     const [[npc]]=await db.execute('SELECT food_units FROM world_settlement_autosim WHERE settlement_id=? FOR UPDATE',[site.id]);
     if(!npc||Number(npc.food_units)+Number(s.quantity)>capacity.food)return fail(409,'npc_food_storage_full');
     await db.execute('UPDATE world_settlement_autosim SET food_units=food_units+? WHERE settlement_id=?',[s.quantity,site.id]);
    }else{
     await db.execute('INSERT INTO world_npc_cargo_warehouse(settlement_id,item_id,quantity) VALUES(?,?,?) ON DUPLICATE KEY UPDATE quantity=quantity+VALUES(quantity)',[site.id,s.item_id,s.quantity]);
    }
    await db.execute("UPDATE world_npc_cargo_shipments SET status='delivered',delivered_at=? WHERE id=?",[at,s.id]);
    return ok({delivered:true});
   });
   if(result.status===200)delivered++;
  }catch(e){console.warn('[NPC cargo] delivery',shipment.id,e?.code||e?.name)}
 }
 const [routes]=await pool.execute("SELECT id FROM world_npc_cargo_routes WHERE enabled=1 ORDER BY id LIMIT 150");
 for(const route of routes){
  try{
   const result=await transaction(pool,async db=>{
    const [[r]]=await db.execute('SELECT * FROM world_npc_cargo_routes WHERE id=? FOR UPDATE',[route.id]);
    const [[home]]=await db.execute('SELECT * FROM world_settlements WHERE id=?',[r.settlement_id]);
    const [[facility]]=await db.execute('SELECT * FROM world_industry_facilities WHERE id=? FOR UPDATE',[r.facility_id]);
    if(!home||!facility||home.controlling_faction_id!==facility.owner_faction_id||facility.status!=='operational'||facility.cycle_mode==='off')return fail(409,'cargo_supplier_not_operational');
    // Depart at most once daily on a route, after a real production cycle has stocked the source.
    const [[departed]]=await db.execute('SELECT id FROM world_npc_cargo_shipments WHERE route_id=? AND dispatched_on=? LIMIT 1',[r.id,day]);
    if(departed)return fail(409,'route_already_dispatched_today');
    const [stocks]=await db.execute('SELECT item_id,quantity FROM world_industry_stock WHERE facility_id=? AND quantity>0 ORDER BY item_id FOR UPDATE',[r.facility_id]);
    let remaining=Number(r.cargo_capacity),sent=0;
    const arrival=new Date(new Date(now).getTime()+Number(r.travel_hours)*3600000).toISOString().slice(0,19).replace('T',' ');
    for(const item of stocks){
     const quantity=round(Math.min(Number(item.quantity),remaining));
     if(quantity<=0)continue;
     const [debit]=await db.execute('UPDATE world_industry_stock SET quantity=quantity-? WHERE facility_id=? AND item_id=? AND quantity>=?',[quantity,r.facility_id,item.item_id,quantity]);
     if(debit.affectedRows!==1)throw new Error('cargo_stock_debit_failed');
     const [ship]=await db.execute("INSERT INTO world_npc_cargo_shipments(route_id,settlement_id,facility_id,item_id,quantity,dispatched_on,dispatched_at,arrival_at) VALUES(?,?,?,?,?,?,?,?)",[r.id,r.settlement_id,r.facility_id,item.item_id,quantity,day,at,arrival]);
     await db.execute("INSERT INTO world_industry_ledger(facility_id,item_id,delta,balance_after,action,reference_key,actor_id) VALUES(?,?,?,?, 'transfer_out',?,NULL)",[r.facility_id,item.item_id,-quantity,round(Number(item.quantity)-quantity),'npc-cargo:'+ship.insertId]);
     remaining=round(remaining-quantity);sent++;
     if(remaining<=0)break;
    }
    return sent?ok({sent}):fail(409,'no_cargo_at_farm');
   });
   if(result.status===200)dispatched+=result.body.sent;
  }catch(e){console.warn('[NPC cargo] dispatch',route.id,e?.code||e?.name)}
 }
 return {delivered,dispatched};
}
