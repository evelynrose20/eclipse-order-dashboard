// Generator construction, repair and replacement follow material-funded settlement projects.
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const integer=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
async function atomic(pool,fn){
 const db=await pool.getConnection();
 try{await db.beginTransaction();const result=await fn(db);if(result.status===200)await db.commit();else await db.rollback();return result}
 catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}
}
export async function powerProjectSummary(pool){
 const [blueprints]=await pool.execute('SELECT * FROM world_power_blueprints ORDER BY technology_level');
 const [projects]=await pool.execute("SELECT p.*,s.name AS settlement_name,b.name AS blueprint_name,plant.name AS plant_name,plant.condition_pct AS existing_condition FROM world_power_projects p JOIN world_settlements s ON s.id=p.settlement_id JOIN world_power_blueprints b ON b.id=p.blueprint_id LEFT JOIN world_power_plants plant ON plant.id=p.plant_id ORDER BY p.id DESC LIMIT 150");
 const [stock]=await pool.execute("SELECT m.id,m.name,COALESCE(s.quantity,0) AS quantity FROM fc_materials m LEFT JOIN fc_material_stock s ON s.material_id=m.id WHERE m.id IN ('iron-ingot','repair-timbers') ORDER BY m.name");
 const [fuelSources]=await pool.execute("SELECT f.id,f.name,f.settlement_id,COALESCE(st.quantity,0) AS fuel_units FROM world_industry_facilities f LEFT JOIN world_industry_stock st ON st.facility_id=f.id AND st.item_id='ceruleum-fuel' WHERE f.settlement_id IS NOT NULL AND f.owner_faction_id='eclipse-order' ORDER BY f.name");
 return {blueprints,projects,stock,fuel_sources:fuelSources};
}
export async function powerProjectRoute(pool,path,b,actor){
 const create=path==='/world-admin/power/projects';
 const match=/^\/world-admin\/power\/projects\/(\d+)\/(commit|advance)$/.exec(path);
 if(!create&&!match)return fail(404,'not_found');
 return atomic(pool,async db=>{
  if(create){
   if(!integer(b?.settlement_id,1)||!(b.plant_id===null||integer(b.plant_id,1))||!['construct','repair','upgrade','replace'].includes(b.action)||typeof b.blueprint_id!=='string')return fail(400,'invalid_power_project');
   const [[settlement]]=await db.execute('SELECT id,controlling_faction_id FROM world_settlements WHERE id=? FOR UPDATE',[b.settlement_id]);
   if(!settlement)return fail(404,'settlement_not_found');
   if(settlement.controlling_faction_id!=='eclipse-order')return fail(409,'power_projects_require_order_settlement');
   const [[blueprint]]=await db.execute('SELECT * FROM world_power_blueprints WHERE id=?',[b.blueprint_id]);
   if(!blueprint)return fail(404,'blueprint_not_found');
   let plant=null;
   if(b.plant_id!==null){
    const [[record]]=await db.execute('SELECT * FROM world_power_plants WHERE id=? AND settlement_id=? FOR UPDATE',[b.plant_id,b.settlement_id]);
    if(!record)return fail(404,'plant_not_found');
    plant=record;
   }
   if((b.action==='construct')!==(!plant))return fail(400,'project_target_invalid');
   if(plant){
    const [[pending]]=await db.execute("SELECT id FROM world_power_projects WHERE plant_id=? AND status='active' LIMIT 1 FOR UPDATE",[plant.id]);
    if(pending)return fail(409,'generator_project_already_active');
    if(b.action==='repair'&&Number(plant.condition_pct)>=100)return fail(409,'generator_already_repaired');
    if(b.action==='upgrade'&&Number(blueprint.technology_level)<=Number(plant.level))return fail(409,'upgrade_requires_higher_level_blueprint');
    if(b.action==='replace'&&Number(blueprint.technology_level)<Number(plant.level))return fail(409,'replacement_cannot_downgrade');
    if(b.action==='repair'&&b.blueprint_id!==plant.blueprint_id)return fail(409,'repair_preserves_existing_blueprint');
   }
   const factor=b.action==='repair'?Math.max(.25,(100-Number(plant.condition_pct))/100):1;
   const iron=Math.max(1,Math.ceil(Number(blueprint.material_iron)*factor));
   const timber=Math.max(1,Math.ceil(Number(blueprint.material_timber)*factor));
   const labor=Math.max(1,Math.ceil(Number(blueprint.labor_required)*factor));
   const [created]=await db.execute('INSERT INTO world_power_projects(plant_id,settlement_id,blueprint_id,action,labor_required,iron_required,timber_required,created_by) VALUES(?,?,?,?,?,?,?,?)',[plant?.id||null,b.settlement_id,blueprint.id,b.action,labor,iron,timber,actor.id]);
   return ok({id:created.insertId});
  }
  const id=Number(match[1]),op=match[2];
  const [[project]]=await db.execute('SELECT * FROM world_power_projects WHERE id=? FOR UPDATE',[id]);
  if(!project)return fail(404,'project_not_found');
  if(project.status!=='active')return fail(409,'project_not_active');
  if(op==='commit'){
   if(!['iron-ingot','repair-timbers'].includes(b.material_id)||!integer(b.quantity,1,1e6))return fail(400,'invalid_contribution');
   const iron=b.material_id==='iron-ingot',required=Number(project[iron?'iron_required':'timber_required']),committed=Number(project[iron?'iron_committed':'timber_committed']);
   if(b.quantity>required-committed)return fail(409,'contribution_exceeds_requirement');
   await db.execute('INSERT IGNORE INTO fc_material_stock(material_id,quantity) VALUES(?,0)',[b.material_id]);
   const [[stock]]=await db.execute('SELECT quantity FROM fc_material_stock WHERE material_id=? FOR UPDATE',[b.material_id]);
   if(Number(stock.quantity)<b.quantity)return fail(409,'insufficient_workshop_materials');
   await db.execute('UPDATE fc_material_stock SET quantity=quantity-? WHERE material_id=?',[b.quantity,b.material_id]);
   await db.execute('INSERT INTO fc_material_ledger(material_id,delta,balance_after,activity,account_id,note) VALUES(?,?,?,?,?,?)',[b.material_id,-b.quantity,Number(stock.quantity)-b.quantity,'upgrade',actor.id,'Power station project #'+project.id]);
   await db.execute('INSERT INTO world_power_project_contributions(project_id,material_id,quantity,actor_id) VALUES(?,?,?,?)',[id,b.material_id,b.quantity,actor.id]);
   await db.execute('UPDATE world_power_projects SET '+(iron?'iron_committed':'timber_committed')+'='+ (iron?'iron_committed':'timber_committed')+'+? WHERE id=?',[b.quantity,id]);
   return ok({saved:true});
  }
  if(Number(project.iron_committed)<Number(project.iron_required)||Number(project.timber_committed)<Number(project.timber_required))return fail(409,'project_materials_not_funded');
  const [[site]]=await db.execute('SELECT workforce,controlling_faction_id FROM world_settlements WHERE id=? FOR UPDATE',[project.settlement_id]);
  if(site.controlling_faction_id!=='eclipse-order')return fail(409,'settlement_control_changed');
  if(Number(site.workforce)<1)return fail(409,'workers_required_for_power_repair');
  const [[clock]]=await db.execute("SELECT DATE_FORMAT(UTC_DATE(),'%Y-%m-%d') AS day");
  if(project.last_advanced&&new Date(project.last_advanced).toISOString().slice(0,10)===clock.day||typeof project.last_advanced==='string'&&project.last_advanced.slice(0,10)===clock.day)return fail(409,'power_project_already_advanced_today');
  const next=Math.min(Number(project.labor_required),Number(project.progress)+Math.max(1,Math.min(Number(site.workforce),200)));
  if(next<Number(project.labor_required)){
   await db.execute('UPDATE world_power_projects SET progress=?,last_advanced=UTC_DATE() WHERE id=?',[next,id]);
   return ok({progress:next,complete:false});
  }
  const [[blueprint]]=await db.execute('SELECT * FROM world_power_blueprints WHERE id=?',[project.blueprint_id]);
  if(project.action==='construct'){
   await db.execute("INSERT INTO world_power_plants(settlement_id,name,model,blueprint_id,level,condition_pct,rated_output,fuel_units,fuel_per_day,status,last_fuel_at) VALUES(?,?,?,?,?,100,?,0,?,'paused',UTC_TIMESTAMP(3))",[project.settlement_id,blueprint.name,blueprint.name,blueprint.id,blueprint.technology_level,blueprint.rated_output,blueprint.fuel_per_day]);
  }else{
   await db.execute("UPDATE world_power_plants SET blueprint_id=?,level=?,model=?,condition_pct=100,rated_output=?,fuel_per_day=?,status=IF(fuel_units>0,'operational','paused'),last_fuel_at=UTC_TIMESTAMP(3) WHERE id=?",[blueprint.id,blueprint.technology_level,blueprint.name,blueprint.rated_output,blueprint.fuel_per_day,project.plant_id]);
  }
  await db.execute("UPDATE world_power_projects SET progress=labor_required,status='complete',last_advanced=UTC_DATE(),completed_at=UTC_TIMESTAMP() WHERE id=?",[id]);
  return ok({complete:true});
 });
}
