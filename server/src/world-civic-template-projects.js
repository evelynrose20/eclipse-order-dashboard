import {CIVIC_EFFECT_KEYS,validateCivicTemplate,civicProjectCost,normalizedCivicMaterials} from './world-civic-building-templates.js';
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const safe=(n)=>Math.max(0,Math.floor(Number(n)||0));
const parse=v=>typeof v==='string'?JSON.parse(v):v;
async function read(req){let n=0,parts=[];for await(const c of req){n+=c.length;if(n>14000)return null;parts.push(c)}try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{return null}}
async function atomic(pool,fn){const db=await pool.getConnection();try{await db.beginTransaction();const v=await fn(db);if(v.status===200)await db.commit();else await db.rollback();return v}catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}}
export async function getCivicTemplates(db){
 const [rows]=await db.execute('SELECT * FROM world_civic_building_templates ORDER BY category,name');
 const [materials]=await db.execute('SELECT template_id,material_id,units_per_level FROM world_civic_template_materials ORDER BY template_id,material_id');
 return rows.map(x=>({...x,enabled:!!x.enabled,materials:materials.filter(m=>m.template_id===x.id)}));
}
export async function civicTemplateCatalogRoute(pool,req,path,actor){
 const m=/^\/world-admin\/civic\/templates(?:\/([a-z0-9-]+))?$/.exec(path);
 if(!m)return null;
 if(!['domina','high_command'].includes(actor.account_role))return fail(403,'command_required');
 if(req.method==='GET'&&!m[1])return ok({templates:await getCivicTemplates(pool)});
 if(req.method!=='POST'&&req.method!=='PUT')return fail(404,'not_found');
 const b=await read(req);
 if(validateCivicTemplate(b))return fail(400,'invalid_civic_template');
 if(b.access_scope!==undefined&&!['shared','order_only'].includes(b.access_scope))return fail(400,'invalid_blueprint_access');
 if(req.method==='POST'&&(m[1]||typeof b.id!=='string'||!/^[a-z][a-z0-9-]{2,47}$/.test(b.id)))return fail(400,'invalid_template_id');
 if(req.method==='PUT'&&!m[1])return fail(400,'template_id_required');
 return atomic(pool,async db=>{
  const id=m[1]||b.id;
  const recipe=normalizedCivicMaterials(b);
  const [catalog]=await db.query('SELECT id FROM fc_materials WHERE id IN ('+recipe.map(()=>'?').join(',')+')',recipe.map(x=>x.material_id));
  if(catalog.length!==recipe.length)return fail(409,'unknown_template_material');
  if(m[1]){
   const [[old]]=await db.execute('SELECT * FROM world_civic_building_templates WHERE id=? FOR UPDATE',[id]);
   if(!old)return fail(404,'template_not_found');
   if(old.category!==b.category||old.effect_key!==b.effect_key)return fail(409,'template_category_locked');
   await db.execute('UPDATE world_civic_building_templates SET name=?,description=?,effect_per_level=?,material_id=?,material_per_level=?,npc_development_cost=?,construction_labor=?,max_level=?,enabled=?,access_scope=?,revision=revision+1 WHERE id=?',[b.name.trim(),b.description,b.effect_per_level,b.material_id,b.material_per_level,b.npc_development_cost,b.construction_labor,b.max_level,b.enabled?1:0,b.access_scope||old.access_scope,id]);
  }else{
   const [[exists]]=await db.execute('SELECT id FROM world_civic_building_templates WHERE id=?',[id]);
   if(exists)return fail(409,'template_id_exists');
   await db.execute('INSERT INTO world_civic_building_templates(id,name,description,category,effect_key,effect_per_level,material_id,material_per_level,npc_development_cost,construction_labor,max_level,enabled,access_scope) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,b.name.trim(),b.description,b.category,b.effect_key,b.effect_per_level,b.material_id,b.material_per_level,b.npc_development_cost,b.construction_labor,b.max_level,b.enabled?1:0,b.access_scope||'order_only']);
  }
  await db.execute('DELETE FROM world_civic_template_materials WHERE template_id=?',[id]);
  for(const line of recipe)await db.execute('INSERT INTO world_civic_template_materials(template_id,material_id,units_per_level) VALUES(?,?,?)',[id,line.material_id,line.units_per_level]);
  await db.execute('INSERT INTO world_administration_audit(actor_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',[actor.id,'civic_template_'+req.method.toLowerCase(),'template',0,id]);
  return ok({id,saved:true});
 });
}
export function effectSnapshot(t){return JSON.stringify({key:t.effect_key,per_level:Number(t.effect_per_level)});}
export const civicRepairEligible=status=>['damaged','destroyed'].includes(status);
export async function beginCivicTemplateProject(db,{settlement,template,upgrade=null,owner_kind='order',actorId=null,npcDevelopment=0,repair=false}){
 if(!template||(!template.enabled&&!repair))return fail(409,'template_disabled');
 if(owner_kind==='npc'&&template.access_scope==='order_only')return fail(409,'order_only_blueprint');
 if(repair&&(!upgrade||!civicRepairEligible(upgrade.status)))return fail(409,'repair_requires_damaged_or_destroyed_building');
 const target=repair?Number(upgrade.level):upgrade?Number(upgrade.level)+1:1;
 if(!repair&&target>Number(template.max_level))return fail(409,'maximum_building_level');
 if(upgrade){
  const [[pending]]=await db.execute("SELECT id FROM world_civic_building_projects WHERE upgrade_id=? AND status IN ('active','paused') LIMIT 1",[upgrade.id]);
  if(pending)return fail(409,'building_project_already_active');
 }
 const [recipeLines]=await db.execute('SELECT material_id,units_per_level FROM world_civic_template_materials WHERE template_id=? ORDER BY material_id',[template.id]);
 const baseCost=civicProjectCost({...template,materials:recipeLines},target);
 const factor=repair?Math.max(.2,(100-Number(upgrade.condition_pct||0))/100)*.5:1;
 const cost=repair?{...baseCost,materials:baseCost.materials.map(m=>({...m,required_qty:Math.max(1,Math.ceil(m.required_qty*factor))})),labor_required:Math.max(10,Math.ceil(baseCost.labor_required*factor)),npc_development_cost:Math.max(1,Math.ceil(baseCost.npc_development_cost*factor))}:baseCost;
 cost.material_id=cost.materials[0].material_id;
 cost.material_required=cost.materials[0].required_qty;
 if(owner_kind==='npc'&&npcDevelopment<cost.npc_development_cost)return fail(409,'npc_development_insufficient');
 let upgradeId=upgrade?.id;
 if(!upgradeId){
  const [created]=await db.execute("INSERT INTO world_settlement_upgrades(settlement_id,name,category,status,condition_pct,level,housing_bonus,service_bonus,defense_bonus,notes,material_id,material_cost,construction_progress,created_by,template_id,effect_snapshot,template_revision) VALUES(?,?,?,'building',100,1,0,0,0,'',NULL,0,0,?,?,?,?)",[settlement.id,template.name,template.category,actorId,template.id,effectSnapshot(template),template.revision]);
  upgradeId=created.insertId;
 }
 const [p]=await db.execute("INSERT INTO world_civic_building_projects(upgrade_id,settlement_id,template_id,target_level,project_kind,status,progress,labor_required,material_id,material_required,materials_paid,npc_development_cost,owner_kind,effect_snapshot,template_revision,created_by) VALUES(?,?,?,?,?,'active',0,?,?,?,?,?,?,?,?,?)",[upgradeId,settlement.id,template.id,target,repair?'repair':upgrade?'upgrade':'build',cost.labor_required,owner_kind==='order'&&template.effect_key!=='insulation'?cost.material_id:null,owner_kind==='order'&&template.effect_key!=='insulation'?cost.material_required:0,owner_kind==='npc'||owner_kind==='order'&&template.effect_key==='insulation'?1:0,cost.npc_development_cost,owner_kind,repair?JSON.stringify(parse(upgrade.effect_snapshot)):effectSnapshot(template),repair?upgrade.template_revision:template.revision,actorId]);
 if(owner_kind==='order'&&template.effect_key==='insulation'){
   await db.execute("INSERT INTO world_logistics_insulation_needs(project_id,item_id,required_qty) VALUES(?,'freight-insulation',?)",[p.insertId,Math.max(10,Math.ceil(10*target*factor))]);
  }
  if(owner_kind==='order'&&template.effect_key!=='insulation')for(const line of cost.materials){
  await db.execute('INSERT INTO world_civic_project_needs(project_id,material_id,required_qty,committed_qty) VALUES(?,?,?,0)',[p.insertId,line.material_id,line.required_qty]);
 }
 return ok({project_id:p.insertId,upgrade_id:upgradeId,target_level:target,cost});
}
export async function advanceCivicTemplateProjects(db,settlement,key,ownerKind,healthyWorkers){
 const result={advanced:[],completed:[],blocked:[],spent_development:0};
 const [projects]=await db.execute("SELECT * FROM world_civic_building_projects WHERE settlement_id=? AND owner_kind=? AND status='active' ORDER BY id FOR UPDATE",[settlement.id,ownerKind]);
 // Project labor is shared, not cloned across simultaneous sites.
 let capacity=Math.max(0,Math.floor(Number(healthyWorkers)||0));
 if(ownerKind==='npc'&&Number(settlement.population)===0)capacity=5; // Founding work crews funded from NPC development budget.
 for(const p of projects){
  const [[previous]]=await db.execute('SELECT cycle_key FROM world_civic_building_project_ticks WHERE project_id=? AND cycle_key=?',[p.id,key]);
  if(previous)continue;
  if(!p.materials_paid){
   // Only explicitly committed and already debited stock can fund construction.
   // No other system can spend goods reserved for this project.
   result.blocked.push(p.id);
   continue;
  }
  const [[insulation]]=await db.execute('SELECT required_qty,committed_qty FROM world_logistics_insulation_needs WHERE project_id=?',[p.id]);
  if(insulation&&Number(insulation.committed_qty)+0.00001<Number(insulation.required_qty)){
   result.blocked.push(p.id);continue;
  }
  const work=Math.min(capacity,Math.max(0,Math.ceil(capacity*.3)),Math.max(0,Number(p.labor_required)-Number(p.progress)),30);
  if(!work){result.blocked.push(p.id);continue}
  capacity-=work;
  const next=Number(p.progress)+work,done=next>=Number(p.labor_required);
  await db.execute('INSERT INTO world_civic_building_project_ticks(project_id,cycle_key,labor_added) VALUES(?,?,?)',[p.id,key,work]);
  await db.execute("UPDATE world_civic_building_projects SET progress=?,status=?,completed_at=IF(?,UTC_TIMESTAMP(),NULL) WHERE id=?",[next,done?'completed':'active',done?1:0,p.id]);
  if(done){
   const [[building]]=await db.execute('SELECT id,level,status FROM world_settlement_upgrades WHERE id=? FOR UPDATE',[p.upgrade_id]);
   if(!building)return fail(409,'building_missing');
   if(p.project_kind==='repair'&&Number(building.level)!==Number(p.target_level))return fail(409,'building_level_changed');
   if(p.project_kind!=='repair'&&Number(p.target_level)>1&&Number(building.level)!==Number(p.target_level)-1)return fail(409,'building_level_changed');
   await db.execute("UPDATE world_settlement_upgrades SET level=?,status='operational',condition_pct=100,construction_progress=100,effect_snapshot=?,template_revision=? WHERE id=?",[p.target_level,JSON.stringify(parse(p.effect_snapshot)),p.template_revision,p.upgrade_id]);
   result.completed.push({id:p.id,upgrade_id:p.upgrade_id,level:p.target_level});
  }else{
   if(Number(p.target_level)===1)await db.execute('UPDATE world_settlement_upgrades SET construction_progress=? WHERE id=?',[Math.min(99,Math.floor(next/Number(p.labor_required)*100)),p.upgrade_id]);
   result.advanced.push({id:p.id,work,progress:next,total:p.labor_required});
  }
 }
 return result;
}
