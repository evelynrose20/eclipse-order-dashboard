import {atomicIndustry,adjustFacilityStock} from './world-industry-engine.js';
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const kinds=new Set(['transport','locomotive','railcar','armored_vehicle','airship','field_equipment','siege_equipment','other']);
const classLimits={
 transport:[100,2000,40],locomotive:[100,4000,60],railcar:[400,5000,30],
 armored_vehicle:[40,300,20],airship:[2000,20000,500],
 field_equipment:[50,3000,100],siege_equipment:[50,1000,100],other:[100,2000,100]
};
const whole=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
const ident=x=>typeof x==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x)&&x.length<=48;
async function read(req){let size=0,parts=[];for await(const chunk of req){size+=chunk.length;if(size>16000)return null;parts.push(chunk)}try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{return null}}
export function validateEquipmentTemplate(b){
 if(!b||!ident(b.item_id)||typeof b.name!=='string'||!b.name.trim()||b.name.length>120||
  typeof b.description!=='string'||b.description.length>500||!kinds.has(b.equipment_kind)||
  !whole(b.transport_capacity,0,10000)||!whole(b.cargo_capacity,0,100000)||!whole(b.crew_required,0,1000)||
  typeof b.fuel_per_operation!=='number'||!Number.isFinite(b.fuel_per_operation)||b.fuel_per_operation<0||b.fuel_per_operation>10000||
  Math.round(b.fuel_per_operation*1000)!==b.fuel_per_operation*1000||!['boolean'].includes(typeof b.enabled)||
  (b.fuel_item_id!==null&&b.fuel_item_id!==''&&!ident(b.fuel_item_id)))return 'invalid_equipment_template';
 const [maxPassengers,maxCargo,maxCrew]=classLimits[b.equipment_kind];
 if(b.transport_capacity>maxPassengers||b.cargo_capacity>maxCargo||b.crew_required>maxCrew)return 'equipment_class_capacity_exceeded';
 if(b.equipment_kind==='locomotive'||b.equipment_kind==='railcar'){
  if(b.transport_capacity===0&&b.cargo_capacity===0)return 'equipment_requires_capacity';
 }
 if(b.fuel_per_operation>0&&!b.fuel_item_id)return 'equipment_fuel_item_required';
 return null;
}
const fields=b=>[b.name.trim(),b.description,b.transport_capacity,b.cargo_capacity,b.crew_required,b.fuel_item_id||null,b.fuel_per_operation,b.enabled?1:0];
export function equipmentSnapshot(t){
 return {item_id:t.item_id,name:t.name,equipment_kind:t.equipment_kind,revision:Number(t.revision),
  transport_capacity:Number(t.transport_capacity),cargo_capacity:Number(t.cargo_capacity),
  crew_required:Number(t.crew_required),fuel_item_id:t.fuel_item_id||null,fuel_per_operation:Number(t.fuel_per_operation)};
}
export async function equipmentSummary(db){
 const [templates]=await db.execute('SELECT * FROM world_magitek_equipment_templates ORDER BY equipment_kind,name');
 const [inventory]=await db.execute(`SELECT i.*,t.name AS template_name,t.equipment_kind,f.name AS origin_name,s.name AS stationed_name
 FROM world_magitek_equipment_inventory i JOIN world_magitek_equipment_templates t ON t.id=i.equipment_template_id
 JOIN world_industry_facilities f ON f.id=i.origin_facility_id
 LEFT JOIN world_settlements s ON s.id=i.stationed_settlement_id ORDER BY i.id DESC LIMIT 500`);
 const [history]=await db.execute('SELECT * FROM world_magitek_equipment_movements ORDER BY id DESC LIMIT 120');
 return {templates,inventory:inventory.map(x=>({...x,specifications:typeof x.specifications==='string'?JSON.parse(x.specifications):x.specifications})),history};
}
export async function equipmentRoute(pool,req,path,actor){
 if(!['domina','high_command'].includes(actor?.account_role))return fail(403,'command_required');
 if(path==='/world-admin/industry/equipment'&&req.method==='GET')return ok(await equipmentSummary(pool));
 let match;
 if((path==='/world-admin/industry/equipment/templates'&&req.method==='POST')||
   ((match=/^\/world-admin\/industry\/equipment\/templates\/(\d+)$/.exec(path))&&req.method==='PUT')){
  const b=await read(req),error=validateEquipmentTemplate(b);
  if(error)return fail(400,error);
  return atomicIndustry(pool,async db=>{
   await db.execute('SELECT id FROM world_industry_catalog_lock WHERE id=1 FOR UPDATE');
   if(b.fuel_item_id){
    const [[fuel]]=await db.execute('SELECT id,category FROM world_industry_items WHERE id=?',[b.fuel_item_id]);
    if(!fuel||fuel.category!=='fuel')return fail(409,'equipment_fuel_item_invalid');
   }
   if(match){
    const id=Number(match[1]);
    const [[old]]=await db.execute('SELECT * FROM world_magitek_equipment_templates WHERE id=? FOR UPDATE',[id]);
    if(!old)return fail(404,'equipment_template_not_found');
    if(old.item_id!==b.item_id||old.equipment_kind!==b.equipment_kind)return fail(409,'equipment_identity_locked');
    await db.execute(`UPDATE world_magitek_equipment_templates SET name=?,description=?,transport_capacity=?,cargo_capacity=?,
      crew_required=?,fuel_item_id=?,fuel_per_operation=?,enabled=?,revision=revision+1 WHERE id=?`,[...fields(b),id]);
    await db.execute("UPDATE world_industry_items SET name=?,description=? WHERE id=? AND category='equipment'",[b.name.trim(),b.description,b.item_id]);
    // Existing commissioned lots keep pinned specifications for their entire service life.
    return ok({id,saved:true});
   }
   const [[existing]]=await db.execute('SELECT id FROM world_industry_items WHERE id=?',[b.item_id]);
   if(existing)return fail(409,'equipment_item_id_exists');
   await db.execute("INSERT INTO world_industry_items(id,name,category,workshop_material_id,description) VALUES(?,?,'equipment',NULL,?)",[b.item_id,b.name.trim(),b.description]);
   const [made]=await db.execute(`INSERT INTO world_magitek_equipment_templates
    (item_id,name,description,equipment_kind,transport_capacity,cargo_capacity,crew_required,fuel_item_id,fuel_per_operation,enabled,created_by)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`,[b.item_id,b.name.trim(),b.description,b.equipment_kind,b.transport_capacity,b.cargo_capacity,b.crew_required,b.fuel_item_id||null,b.fuel_per_operation,b.enabled?1:0,actor.id]);
   return ok({id:made.insertId,item_id:b.item_id,saved:true});
  });
 }
 if((match=/^\/world-admin\/industry\/equipment\/facilities\/(\d+)\/commission$/.exec(path))&&req.method==='POST'){
  const facilityId=Number(match[1]),b=await read(req);
  if(!whole(b?.equipment_template_id,1,Number.MAX_SAFE_INTEGER)||!whole(b?.quantity,1,100000))return fail(400,'invalid_commission_quantity');
  return atomicIndustry(pool,async db=>{
   const [[facility]]=await db.execute(`SELECT f.id,f.status,f.owner_faction_id,t.category AS factory_category,v.configuration,
    COALESCE(s.controlling_faction_id,z.controlling_faction_id) AS controlling_faction_id
    FROM world_industry_facilities f
    JOIN world_industry_templates t ON t.id=f.template_id
    JOIN world_industry_template_versions v ON v.template_id=f.template_id AND v.version=f.template_version
    LEFT JOIN world_settlements s ON s.id=f.settlement_id
    LEFT JOIN world_industry_sites site ON site.id=f.site_id
    LEFT JOIN world_zones z ON z.id=site.zone_id WHERE f.id=? FOR UPDATE`,[facilityId]);
   if(!facility)return fail(404,'facility_not_found');
   if(facility.status!=='operational'||facility.owner_faction_id!==facility.controlling_faction_id)return fail(409,'facility_not_operational_or_captured');
   // Only the Order may commission assets into the staff-controlled reserve here; NPCs manufacture via the normal engine.
   if(facility.owner_faction_id!=='eclipse-order')return fail(409,'order_equipment_commission_only');
   const [[template]]=await db.execute('SELECT * FROM world_magitek_equipment_templates WHERE id=?',[b.equipment_template_id]);
   if(!template)return fail(404,'equipment_template_not_found');
   const recipe=typeof facility.configuration==='string'?JSON.parse(facility.configuration):facility.configuration;
   if(facility.factory_category!=='manufacturing'||!(recipe?.outputs||[]).some(x=>x.item_id===template.item_id))
    return fail(409,'equipment_must_come_from_its_assembly_line');
   const [[item]]=await db.execute('SELECT category FROM world_industry_items WHERE id=?',[template.item_id]);
   if(item?.category!=='equipment')return fail(409,'not_equipment_output');
   const [[stock]]=await db.execute('SELECT quantity FROM world_industry_stock WHERE facility_id=? AND item_id=? FOR UPDATE',[facilityId,template.item_id]);
   if(!stock||Number(stock.quantity)<b.quantity)return fail(409,'insufficient_finished_equipment');
   await adjustFacilityStock(db,facilityId,template.item_id,-b.quantity,'transfer_out','magitek-commission:'+Date.now(),actor.id);
   const snapshot=equipmentSnapshot(template);
   const [created]=await db.execute(`INSERT INTO world_magitek_equipment_inventory
    (equipment_template_id,origin_facility_id,owner_faction_id,quantity,specifications,registered_by)
    VALUES(?,?,?,?,?,?)`,[template.id,facilityId,facility.owner_faction_id,b.quantity,JSON.stringify(snapshot),actor.id]);
   await db.execute("INSERT INTO world_magitek_equipment_movements(inventory_id,action,quantity,actor_id,detail) VALUES(?,'commission',?,?,?)",[created.insertId,b.quantity,actor.id,'Commissioned from verified factory output']);
   return ok({id:created.insertId,quantity:b.quantity});
  });
 }
 if((match=/^\/world-admin\/industry\/equipment\/inventory\/(\d+)\/state$/.exec(path))&&req.method==='POST'){
  const id=Number(match[1]),b=await read(req);
  if(!['reserve','assigned','damaged','retired'].includes(b?.status)||typeof b.notes!=='string'||b.notes.length>300||
   (b.stationed_settlement_id!==null&&b.stationed_settlement_id!==undefined&&!whole(b.stationed_settlement_id,1,Number.MAX_SAFE_INTEGER)))return fail(400,'invalid_equipment_assignment');
  return atomicIndustry(pool,async db=>{
   const [[unit]]=await db.execute('SELECT * FROM world_magitek_equipment_inventory WHERE id=? FOR UPDATE',[id]);
   if(!unit)return fail(404,'inventory_lot_not_found');
   if(unit.status==='retired')return fail(409,'retired_equipment_locked');
   const destination=b.status==='assigned'?b.stationed_settlement_id:null;
   if(b.status==='assigned'&&!destination)return fail(400,'stationing_location_required');
   if(destination){
    const [[site]]=await db.execute('SELECT controlling_faction_id FROM world_settlements WHERE id=?',[destination]);
    if(!site||site.controlling_faction_id!==unit.owner_faction_id)return fail(409,'stationing_requires_faction_control');
   }
   const qty=b.quantity===undefined?Number(unit.quantity):Number(b.quantity);
   if(!whole(qty,1,Number(unit.quantity)))return fail(400,'invalid_assigned_quantity');
   if(qty<Number(unit.quantity)){
    if(unit.status!=='reserve'||b.status!=='assigned')return fail(409,'partial_allocation_requires_reserve');
    const [left]=await db.execute('UPDATE world_magitek_equipment_inventory SET quantity=quantity-? WHERE id=? AND quantity>=?',[qty,id,qty]);
    if(left.affectedRows!==1)return fail(409,'equipment_allocation_balance_changed');
    const [newLot]=await db.execute(`INSERT INTO world_magitek_equipment_inventory
     (equipment_template_id,origin_facility_id,owner_faction_id,stationed_settlement_id,quantity,specifications,status,notes,registered_by)
     VALUES(?,?,?,?,?,?,'assigned',?,?)`,[unit.equipment_template_id,unit.origin_facility_id,unit.owner_faction_id,destination,qty,
      typeof unit.specifications==='string'?unit.specifications:JSON.stringify(unit.specifications),b.notes,actor.id]);
    await db.execute("INSERT INTO world_magitek_equipment_movements(inventory_id,action,quantity,actor_id,detail) VALUES(?,'reserve',?,?,?)",[id,qty,actor.id,'Allocated to lot '+newLot.insertId]);
    await db.execute("INSERT INTO world_magitek_equipment_movements(inventory_id,action,quantity,actor_id,detail) VALUES(?,'assign',?,?,?)",[newLot.insertId,qty,actor.id,'Allocated from reserve lot '+id]);
    return ok({saved:true,status:'assigned',allocated_lot_id:newLot.insertId,quantity:qty});
   }
   await db.execute('UPDATE world_magitek_equipment_inventory SET status=?,stationed_settlement_id=?,notes=? WHERE id=?',[b.status,destination,b.notes,id]);
   await db.execute('INSERT INTO world_magitek_equipment_movements(inventory_id,action,quantity,actor_id,detail) VALUES(?,?,?,?,?)',[id,b.status==='assigned'?'assign':b.status,unit.quantity,actor.id,b.notes]);
   return ok({saved:true,status:b.status});
  });
 }
 return fail(404,'equipment_route_not_found');
}
