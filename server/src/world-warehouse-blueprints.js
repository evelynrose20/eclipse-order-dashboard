// Editable warehouse designs and level-specific real-material construction bills.
// The design catalog can change without rewriting already funded warehouse projects.
const response=body=>({status:200,body}),reject=(status,error)=>({status,body:{error}});
const id=value=>Number.isSafeInteger(Number(value))&&Number(value)>0;
const decimal=value=>Number.isFinite(Number(value))&&Number(value)>0&&Number(value)<=100000&&Math.round(Number(value)*1000)===Number(value)*1000;
export function recipeEntries(raw){
 const input=typeof raw==='string'?JSON.parse(raw):raw;
 if(!Array.isArray(input))return null;
 const seen=new Set(),out=[];
 for(const item of input){
  if(!item||typeof item.item_id!=='string'||!item.item_id||item.item_id.length>48||!decimal(item.quantity)||seen.has(item.item_id))return null;
  seen.add(item.item_id);
  out.push({item_id:item.item_id,quantity:Number(item.quantity)});
 }
 return out.length&&out.length<=20?out:null;
}
export async function validateRecipe(db,requirements){
 const clean=recipeEntries(requirements);
 if(!clean)return null;
 const [known]=await db.execute('SELECT id FROM world_industry_items WHERE id IN ('+clean.map(()=>'?').join(',')+')',clean.map(row=>row.item_id));
 return known.length===clean.length?clean:null;
}
export async function spendWarehouseMaterials(db,warehouse,facilityId,requirements,actor,ledger,reference){
 if(!id(facilityId))return false;
 const [[facility]]=await db.execute('SELECT f.id,f.owner_faction_id,f.status,COALESCE(site.zone_id,home.zone_id) AS zone_id,COALESCE(site.controlling_faction_id,home.controlling_faction_id) AS faction_id FROM world_industry_facilities f LEFT JOIN world_industry_sites site ON site.id=f.site_id LEFT JOIN world_settlements home ON home.id=f.settlement_id WHERE f.id=? FOR UPDATE',[facilityId]);
 const [[settlement]]=await db.execute('SELECT zone_id,controlling_faction_id,strategic_state FROM world_settlements WHERE id=? FOR UPDATE',[warehouse.settlement_id]);
 if(!facility||!settlement||facility.owner_faction_id!=='eclipse-order'||facility.faction_id!=='eclipse-order'||settlement.controlling_faction_id!=='eclipse-order'||Number(facility.zone_id)!==Number(settlement.zone_id)||['ruined','captured'].includes(facility.status)||['destroyed','abandoned'].includes(settlement.strategic_state))return false;
 for(const material of requirements){
  if(!await ledger(db,facility.id,material.item_id,-Number(material.quantity),'corridor_build',reference,actor,'warehouse-blueprint'))return false;
 }
 return true;
}
export async function levelInfo(db,blueprintId,level){
 const [[result]]=await db.execute('SELECT * FROM world_logistics_warehouse_blueprint_levels WHERE blueprint_id=? AND level_number=?',[blueprintId,level]);
 return result||null;
}
async function parse(req){
 let length=0,chunks=[];for await(const part of req){length+=part.length;if(length>20000)return null;chunks.push(part)}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}
}
async function withTransaction(pool,fn){
 const db=await pool.getConnection();
 try{await db.beginTransaction();const output=await fn(db);if(output.status===200)await db.commit();else await db.rollback();return output}
 catch(error){await db.rollback().catch(()=>{});throw error}finally{db.release()}
}
export async function blueprintRoute(pool,req,path,actor,{ledger}){
 if(!['domina','high_command'].includes(actor?.account_role))return reject(403,'command_required');
 if(path==='/world-admin/logistics/warehouses/blueprints'&&req.method==='POST'){
  const body=await parse(req);
  if(!body||typeof body.name!=='string'||!body.name.trim()||body.name.length>140||typeof body.description!=='string'||body.description.length>350||!id(body.capacity_units)||Number(body.capacity_units)<100||Number(body.capacity_units)>100000)return reject(400,'invalid_warehouse_blueprint');
  return withTransaction(pool,async db=>{
   const recipe=await validateRecipe(db,body.requirements);
   if(!recipe)return reject(400,'invalid_warehouse_requirements');
   const [added]=await db.execute("INSERT INTO world_logistics_warehouse_blueprints(name,description,icon) VALUES(?,?,'fa-warehouse')",[body.name.trim(),body.description]);
   await db.execute('INSERT INTO world_logistics_warehouse_blueprint_levels(blueprint_id,level_number,capacity_units,requirements) VALUES(?,1,?,?)',[added.insertId,body.capacity_units,JSON.stringify(recipe)]);
   return response({id:added.insertId,level:1});
  });
 }
 const levelMatch=/^\/world-admin\/logistics\/warehouses\/blueprints\/(\d+)\/levels\/(\d+)$/.exec(path);
 if(levelMatch&&req.method==='PUT'){
  const body=await parse(req),blueprintId=Number(levelMatch[1]),level=Number(levelMatch[2]);
  if(!body||level<1||level>20||!id(body.capacity_units)||Number(body.capacity_units)<100||Number(body.capacity_units)>100000)return reject(400,'invalid_warehouse_level');
  return withTransaction(pool,async db=>{
   const [[blueprint]]=await db.execute('SELECT id FROM world_logistics_warehouse_blueprints WHERE id=? FOR UPDATE',[blueprintId]);
   if(!blueprint)return reject(404,'warehouse_blueprint_not_found');
   const recipe=await validateRecipe(db,body.requirements);
   if(!recipe)return reject(400,'invalid_warehouse_requirements');
   const [[prev]]=level>1?await db.execute('SELECT capacity_units FROM world_logistics_warehouse_blueprint_levels WHERE blueprint_id=? AND level_number=?',[blueprintId,level-1]):[[null]];
   if(level>1&&(!prev||Number(body.capacity_units)<=Number(prev.capacity_units)))return reject(409,'warehouse_level_capacity_must_increase');
   const [[next]]=await db.execute('SELECT capacity_units FROM world_logistics_warehouse_blueprint_levels WHERE blueprint_id=? AND level_number=?',[blueprintId,level+1]);
   if(next&&Number(body.capacity_units)>=Number(next.capacity_units))return reject(409,'warehouse_level_capacity_must_increase');
   await db.execute('INSERT INTO world_logistics_warehouse_blueprint_levels(blueprint_id,level_number,capacity_units,requirements) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE capacity_units=VALUES(capacity_units),requirements=VALUES(requirements)',[blueprintId,level,Number(body.capacity_units),JSON.stringify(recipe)]);
   return response({blueprint_id:blueprintId,level,capacity_units:Number(body.capacity_units)});
  });
 }
 const rename=/^\/world-admin\/logistics\/warehouses\/blueprints\/(\d+)$/.exec(path);
 if(rename&&req.method==='PUT'){
  const body=await parse(req);
  if(!body||typeof body.name!=='string'||!body.name.trim()||body.name.length>140||typeof body.description!=='string'||body.description.length>350)return reject(400,'invalid_warehouse_blueprint');
  return withTransaction(pool,async db=>{
   const [updated]=await db.execute('UPDATE world_logistics_warehouse_blueprints SET name=?,description=?,active=? WHERE id=?',[body.name.trim(),body.description,body.active===false?0:1,Number(rename[1])]);
   return updated.affectedRows?response({updated:true}):reject(404,'warehouse_blueprint_not_found');
  });
 }
 const upgrade=/^\/world-admin\/logistics\/warehouses\/(\d+)\/upgrade$/.exec(path);
 if(upgrade&&req.method==='POST'){
  const body=await parse(req);
  if(!id(body?.facility_id))return reject(400,'upgrade_supply_depot_required');
  return withTransaction(pool,async db=>{
   const [[warehouse]]=await db.execute('SELECT * FROM world_logistics_warehouses WHERE id=? FOR UPDATE',[Number(upgrade[1])]);
   if(!warehouse||warehouse.state!=='operational')return reject(409,'warehouse_not_operational');
   const [[progress]]=await db.execute('SELECT * FROM world_logistics_warehouse_progress WHERE warehouse_id=? FOR UPDATE',[warehouse.id]);
   if(!progress)return reject(409,'warehouse_has_no_blueprint');
   const nextLevel=Number(progress.level_number)+1;
   const level=await levelInfo(db,progress.blueprint_id,nextLevel);
   if(!level)return reject(409,'no_next_warehouse_level');
   const requirements=await validateRecipe(db,level.requirements);
   if(!requirements||Number(level.capacity_units)<=Number(warehouse.capacity_units))return reject(409,'warehouse_upgrade_recipe_unavailable');
   if(!await spendWarehouseMaterials(db,warehouse,body.facility_id,requirements,actor,ledger,'upgrade-'+warehouse.id+'-'+nextLevel))return reject(409,'warehouse_upgrade_materials_insufficient');
   await db.execute('UPDATE world_logistics_warehouses SET capacity_units=? WHERE id=?',[level.capacity_units,warehouse.id]);
   await db.execute('UPDATE world_logistics_warehouse_progress SET level_number=? WHERE warehouse_id=?',[nextLevel,warehouse.id]);
   return response({warehouse_id:warehouse.id,level:nextLevel,capacity_units:Number(level.capacity_units)});
  });
 }
 return reject(404,'warehouse_blueprint_route_not_found');
}
