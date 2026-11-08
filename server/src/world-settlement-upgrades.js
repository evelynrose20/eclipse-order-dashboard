import {civicInfrastructureEffects,civilianStorageCapacity} from './world-civic-building-templates.js';
import {getCivicTemplates,beginCivicTemplateProject} from './world-civic-template-projects.js';
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const categories=['housing','defense','clinic','water','food_storage','insulation','public_works','school'];
const statuses=['planned','building','operational','damaged','destroyed'];
const whole=(x,min,max)=>Number.isInteger(x)&&x>=min&&x<=max;
async function read(req){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>12000)return null;chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}}
async function transact(pool,fn){const db=await pool.getConnection();try{await db.beginTransaction();const result=await fn(db);if(result.status===200)await db.commit();else await db.rollback();return result}catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}}
async function audit(db,actor,action,id,detail=''){await db.execute('INSERT INTO world_administration_audit(actor_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',[actor,action,'upgrade',id,String(detail).slice(0,350)])}
const payload=b=>b&&typeof b.name==='string'&&b.name.trim().length>0&&b.name.length<=120&&categories.includes(b.category)&&statuses.includes(b.status)&&whole(b.condition_pct,0,100)&&whole(b.level,1,20)&&whole(b.housing_bonus,0,10000000)&&whole(b.service_bonus,0,100)&&whole(b.defense_bonus,0,100)&&typeof b.notes==='string'&&b.notes.length<=500&&(!b.material_id||typeof b.material_id==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(b.material_id)&&b.material_id.length<=48)&&whole(b.material_cost??0,0,1000000)&&(!b.material_cost||b.material_id)&&(b.category==='housing'||b.housing_bonus===0)&&(b.category==='defense'||b.defense_bonus===0)&&(['clinic','water','food_storage','insulation','public_works','school'].includes(b.category)||b.service_bonus===0);
export function upgradeEffects(upgrades=[]){
 let housing=0,service=0,defense=0;
 const byCategory={},serviceByCategory={};
 for(const u of upgrades){
  const factor=u.status==='operational'?Number(u.condition_pct)/100:u.status==='damaged'?Number(u.condition_pct)/200:0;
  housing+=Math.floor(Number(u.housing_bonus)*factor);
  service+=Math.floor(Number(u.service_bonus)*factor);
  defense+=Math.floor(Number(u.defense_bonus)*factor);
  byCategory[u.category]=(byCategory[u.category]||0)+1;
  serviceByCategory[u.category]=(serviceByCategory[u.category]||0)+Math.floor(Number(u.service_bonus)*factor);
 }
 const infrastructure=civicInfrastructureEffects(upgrades);
 return {housing_bonus:housing+infrastructure.housing_capacity,service_bonus:Math.min(100,service),defense_bonus:Math.min(100,defense+infrastructure.defense),by_category:byCategory,service_by_category:serviceByCategory,infrastructure};
}
export function housingCapacity(settlement,upgrades=[]){return Number(settlement.housing_capacity||0)+upgradeEffects(upgrades).housing_bonus}
export async function getSettlementUpgradeRecords(db,id,lock=false){
 const [rows]=await db.execute('SELECT * FROM world_settlement_upgrades WHERE settlement_id=? ORDER BY id'+(lock?' FOR UPDATE':''),[id]);return rows;
}
export async function handleSettlementUpgrades(pool,req,path,actor){
 const fundMatch=/^\/world-admin\/settlements\/(\d+)\/upgrades\/projects\/(\d+)\/commit$/.exec(path);
 if(fundMatch&&req.method==='POST'){
  if(!['domina','high_command'].includes(actor.account_role))return fail(403,'command_required');
  const settlementId=Number(fundMatch[1]),projectId=Number(fundMatch[2]);
  const b=await read(req);
  if(!b||!whole(b.quantity,1,1000000)||typeof b.material_id!=='string'||!/^[a-z0-9-]{2,48}$/.test(b.material_id))return fail(400,'invalid_contribution_amount');
  return transact(pool,async db=>{
   // Lock settlement first, like other warehouse transfers, to serialize contributions.
   const [[site]]=await db.execute('SELECT id,controlling_faction_id FROM world_settlements WHERE id=? FOR UPDATE',[settlementId]);
   if(!site)return fail(404,'settlement_not_found');
   if(site.controlling_faction_id&&site.controlling_faction_id!=='eclipse-order')return fail(409,'npc_project_not_order_supply');
   const [[project]]=await db.execute("SELECT * FROM world_civic_building_projects WHERE id=? AND settlement_id=? AND owner_kind='order' FOR UPDATE",[projectId,settlementId]);
   if(!project)return fail(404,'project_not_found');
   if(project.status!=='active'||project.materials_paid)return fail(409,'project_already_funded_or_closed');
   const [[need]]=await db.execute('SELECT * FROM world_civic_project_needs WHERE project_id=? AND material_id=? FOR UPDATE',[project.id,b.material_id]);
   if(!need)return fail(404,'project_material_not_required');
   const remaining=Number(need.required_qty)-Number(need.committed_qty);
   if(remaining<=0)return fail(409,'project_material_fully_funded');
   if(b.quantity>remaining)return fail(409,'project_requirement_exceeded');
   const [[stock]]=await db.execute('SELECT quantity FROM fc_material_stock WHERE material_id=? FOR UPDATE',[b.material_id]);
   if(!stock||Number(stock.quantity)<b.quantity)return fail(409,'insufficient_unreserved_shared_stock');
   const [debit]=await db.execute('UPDATE fc_material_stock SET quantity=quantity-? WHERE material_id=? AND quantity>=?',[b.quantity,b.material_id,b.quantity]);
   if(debit.affectedRows!==1)return fail(409,'insufficient_unreserved_shared_stock');
   const [entry]=await db.execute('INSERT INTO world_civic_project_contributions(project_id,material_id,quantity,actor_id) VALUES(?,?,?,?)',[project.id,b.material_id,b.quantity,actor.id]);
   await db.execute('UPDATE world_civic_project_needs SET committed_qty=committed_qty+? WHERE project_id=? AND material_id=?',[b.quantity,project.id,b.material_id]);
   await db.execute('INSERT INTO fc_material_ledger(material_id,delta,balance_after,activity,account_id,note) VALUES(?,?,?,?,?,?)',[b.material_id,-b.quantity,Number(stock.quantity)-b.quantity,'upgrade',actor.id,'Civic project #'+project.id+' commitment #'+entry.insertId]);
   const [unfunded]=await db.execute('SELECT material_id FROM world_civic_project_needs WHERE project_id=? AND committed_qty<required_qty',[project.id]);
   const fullyFunded=unfunded.length===0;
   if(fullyFunded)await db.execute('UPDATE world_civic_building_projects SET materials_paid=1 WHERE id=?',[project.id]);
   await audit(db,actor.id,'building_material_commit',settlementId,'Project '+project.id+': '+b.material_id+' x'+b.quantity);
   return ok({project_id:project.id,material_id:b.material_id,committed_qty:Number(need.committed_qty)+b.quantity,required_qty:Number(need.required_qty),remaining_qty:Math.max(0,remaining-b.quantity),fully_funded:fullyFunded});
  });
 }
 const createMatch=/^\/world-admin\/settlements\/(\d+)\/upgrades\/from-template$/.exec(path);
 const improveMatch=/^\/world-admin\/settlements\/(\d+)\/upgrades\/(\d+)\/improve$/.exec(path);
 const repairMatch=/^\/world-admin\/settlements\/(\d+)\/upgrades\/(\d+)\/repair$/.exec(path);
 if((createMatch||improveMatch||repairMatch)&&req.method==='POST'){
  if(!['domina','high_command'].includes(actor.account_role))return fail(403,'command_required');
  const id=Number((createMatch||improveMatch||repairMatch)[1]),upgradeId=improveMatch?Number(improveMatch[2]):repairMatch?Number(repairMatch[2]):null;
  const b=await read(req);
  if(createMatch&&(typeof b?.template_id!=='string'||b.template_id.length>48))return fail(400,'invalid_template');
  return transact(pool,async db=>{
   const [[site]]=await db.execute('SELECT * FROM world_settlements WHERE id=? FOR UPDATE',[id]);
   if(!site)return fail(404,'settlement_not_found');
   if(site.controlling_faction_id&&site.controlling_faction_id!=='eclipse-order')return fail(409,'npc_settlement_builds_automatically');
   let upgrade=null;
   if(upgradeId){
    const [[record]]=await db.execute('SELECT * FROM world_settlement_upgrades WHERE id=? AND settlement_id=? FOR UPDATE',[upgradeId,id]);
    if(!record)return fail(404,'upgrade_not_found');
    if(!record.template_id||record.status!==(repairMatch?'damaged':'operational'))return fail(409,repairMatch?'building_not_damaged':'building_not_ready_for_upgrade');
    upgrade=record;
   }
   const templateId=upgrade?.template_id||b.template_id;
   const [[template]]=await db.execute('SELECT * FROM world_civic_building_templates WHERE id=? FOR UPDATE',[templateId]);
   if(!template)return fail(404,'template_not_found');
   const project=await beginCivicTemplateProject(db,{settlement:site,template,upgrade,owner_kind:'order',actorId:actor.id,repair:!!repairMatch});
   if(project.status!==200)return project;
   await audit(db,actor.id,repairMatch?'building_repair':upgrade?'building_improve':'building_start',id,templateId);
   return project;
  });
 }
 const m=/^\/world-admin\/settlements\/(\d+)\/upgrades(?:\/(\d+))?$/.exec(path);
 if(!m)return null;
 if(!['domina','high_command'].includes(actor.account_role))return fail(403,'command_required');
 const id=Number(m[1]),upgradeId=m[2]?Number(m[2]):null;
 if(!Number.isSafeInteger(id)||id<1)return fail(400,'invalid_settlement');
 if(req.method==='GET'&&!upgradeId){
  const [[settlement]]=await pool.execute('SELECT id,population,housing_capacity,security_score,medical_access,housing FROM world_settlements WHERE id=?',[id]);
  if(!settlement)return fail(404,'settlement_not_found');
  const upgrades=await getSettlementUpgradeRecords(pool,id);
  const [projects]=await pool.execute('SELECT p.*,COALESCE(c.committed_qty,0) AS committed_qty FROM world_civic_building_projects p LEFT JOIN (SELECT project_id,SUM(quantity) AS committed_qty FROM world_civic_project_contributions GROUP BY project_id) c ON c.project_id=p.id WHERE p.settlement_id=? ORDER BY p.id DESC',[id]);
  const [needs]=await pool.execute('SELECT n.* FROM world_civic_project_needs n JOIN world_civic_building_projects p ON p.id=n.project_id WHERE p.settlement_id=? ORDER BY n.project_id,n.material_id',[id]);
  const [contributions]=await pool.execute('SELECT c.id,c.project_id,c.material_id,c.quantity,c.contributed_at,c.actor_id FROM world_civic_project_contributions c JOIN world_civic_building_projects p ON p.id=c.project_id WHERE p.settlement_id=? ORDER BY c.id DESC LIMIT 100',[id]);
  const [availableMaterials]=await pool.execute('SELECT s.material_id,m.name,s.quantity FROM fc_material_stock s JOIN fc_materials m ON m.id=s.material_id ORDER BY m.name');
  return ok({housing_capacity:housingCapacity(settlement,upgrades),base_capacity:Number(settlement.housing_capacity),residents:Number(settlement.population),effects:upgradeEffects(upgrades),storage_capacity:civilianStorageCapacity(settlement,upgrades),templates:await getCivicTemplates(pool),projects:projects.map(p=>({...p,needs:needs.filter(n=>Number(n.project_id)===Number(p.id))})),contributions,available_materials:availableMaterials,upgrades});
 }
 if(req.method!=='POST'&&req.method!=='PUT'&&req.method!=='DELETE')return fail(404,'not_found');
 if(req.method==='POST'&&upgradeId||req.method!=='POST'&&!upgradeId)return fail(400,'invalid_upgrade_action');
 const b=req.method==='DELETE'?null:await read(req);
 if(req.method!=='DELETE'&&!payload(b))return fail(400,'invalid_upgrade');
 return transact(pool,async db=>{
  const [[settlement]]=await db.execute('SELECT id,population,housing_capacity FROM world_settlements WHERE id=? FOR UPDATE',[id]);
  if(!settlement)return fail(404,'settlement_not_found');
  const upgrades=await getSettlementUpgradeRecords(db,id,true);
  if(upgradeId&&!upgrades.some(u=>Number(u.id)===upgradeId))return fail(404,'upgrade_not_found');
  if(upgradeId&&upgrades.find(x=>Number(x.id)===upgradeId)?.template_id&&req.method==='PUT')return fail(409,'template_building_requires_project');
  const next=req.method==='DELETE'?upgrades.filter(x=>Number(x.id)!==upgradeId):req.method==='PUT'?upgrades.map(x=>Number(x.id)===upgradeId?{...x,...b}:x):[...upgrades,b];
  if(housingCapacity(settlement,next)<Number(settlement.population))return fail(409,'upgrade_would_displace_residents');
  const vals=b?[b.name.trim(),b.category,b.status,b.condition_pct,b.level,b.housing_bonus,b.service_bonus,b.defense_bonus,b.notes,b.material_id||null,Number(b.material_cost)||0]:null;
  if(b?.material_id){const [[m]]=await db.execute('SELECT id FROM fc_materials WHERE id=?',[b.material_id]);if(!m)return fail(400,'invalid_construction_material')}
  if(b&&upgradeId){const prior=upgrades.find(u=>Number(u.id)===upgradeId);if(prior?.materials_paid&&(String(prior.material_id||'')!==String(b.material_id||'')||Number(prior.material_cost)!==Number(b.material_cost||0)))return fail(409,'already_funded_project_materials_cannot_change')}
  let newId=upgradeId;
  if(req.method==='POST'){
   const [created]=await db.execute('INSERT INTO world_settlement_upgrades(settlement_id,name,category,status,condition_pct,level,housing_bonus,service_bonus,defense_bonus,notes,material_id,material_cost,construction_progress,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,...vals,b.status==='operational'?100:0,actor.id]);
   newId=created.insertId;
  }else if(req.method==='PUT')await db.execute("UPDATE world_settlement_upgrades SET name=?,category=?,status=?,condition_pct=?,level=?,housing_bonus=?,service_bonus=?,defense_bonus=?,notes=?,material_id=?,material_cost=?,construction_progress=CASE WHEN ?='operational' THEN 100 WHEN ?='planned' THEN 0 ELSE construction_progress END WHERE id=? AND settlement_id=?",[...vals,b.status,b.status,upgradeId,id]);
  else await db.execute('DELETE FROM world_settlement_upgrades WHERE id=? AND settlement_id=?',[upgradeId,id]);
  await audit(db,actor.id,'upgrade_'+req.method.toLowerCase(),id,String(newId));
  return ok({saved:true,id:newId});
 });
}
