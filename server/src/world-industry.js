import {validateIndustryConfiguration,validateIndustryRules,industryDependenciesHaveCycle,validItemId,industryProductionPreview} from './world-industry-rules.js';
import {atomicIndustry,adjustFacilityStock,getIndustryPreview,produceIndustryCycle,advanceIndustryProject} from './world-industry-engine.js';
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const whole=(x,min,max)=>Number.isInteger(x)&&x>=min&&x<=max;
const txt=(x,max)=>typeof x==='string'&&x.trim().length>0&&x.length<=max;
const N=x=>Number(x||0);
const num=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max&&Math.round(x*1000)===x*1000;
async function body(req){let size=0;const chunks=[];for await(const b of req){size+=b.length;if(size>50000)return null;chunks.push(b)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}}
const array=x=>typeof x==='string'?JSON.parse(x):x;
async function audit(db,actor,entity,id,action,detail=''){await db.execute('INSERT INTO world_administration_audit(actor_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',[actor,action,entity,id,String(detail).slice(0,350)])}
async function ensureItems(db,c){
 const ids=[...new Set([...c.inputs,...c.outputs,...(c.byproducts||[])].map(x=>x.item_id))];
 if(!ids.length)return false;
 const [rows]=await db.query('SELECT id FROM world_industry_items WHERE id IN ('+ids.map(()=>'?').join(',')+')',ids);
 return rows.length===ids.length;
}
async function noCycle(db,c,excluding=null){
 const [rows]=await db.execute('SELECT v.configuration FROM world_industry_templates t JOIN world_industry_template_versions v ON v.template_id=t.id AND v.version=t.current_version WHERE t.archived=0'+(excluding?' AND t.id<>?':''),excluding?[excluding]:[]);
 return !industryDependenciesHaveCycle([...rows.map(r=>array(r.configuration)),c]);
}
const validFacility=b=>b&&whole(b.settlement_id,1,Number.MAX_SAFE_INTEGER)&&whole(b.template_id,1,Number.MAX_SAFE_INTEGER)&&txt(b.name,140)&&['captured','liberated','ruined','rebuilding','operational','damaged','paused'].includes(b.status)&&whole(b.level,1,20)&&whole(b.capacity_pct,0,100)&&whole(b.workforce,0,10000000)&&num(b.heat_available,0,1000000)&&num(b.power_available,0,1000000)&&['off','manual','automatic'].includes(b.cycle_mode)&&['slow','normal','fast'].includes(b.cycle_cadence)&&typeof b.notes==='string'&&b.notes.length<=500;
const validProject=b=>b&&whole(b.facility_id,1,Number.MAX_SAFE_INTEGER)&&txt(b.name,140)&&typeof b.description==='string'&&b.description.length<=500&&['planned','active'].includes(b.status)&&['liberated','rebuilding','operational','damaged'].includes(b.result_status)&&whole(b.labor_required,1,1000000)&&Array.isArray(b.needs)&&b.needs.length<=20&&b.needs.every(x=>validItemId(x.item_id)&&num(x.qty,0.001,1000000))&&new Set(b.needs.map(x=>x.item_id)).size===b.needs.length&&(b.campaign_project_id==null||whole(b.campaign_project_id,1,Number.MAX_SAFE_INTEGER));
async function summary(pool){
 const [items]=await pool.execute('SELECT i.*,m.name AS workshop_name,COALESCE(st.quantity,0) AS shared_qty FROM world_industry_items i LEFT JOIN fc_materials m ON m.id=i.workshop_material_id LEFT JOIN fc_material_stock st ON st.material_id=m.id ORDER BY i.name');
 const [workshop]=await pool.execute('SELECT m.id,m.name,m.category,COALESCE(s.quantity,0) AS quantity FROM fc_materials m LEFT JOIN fc_material_stock s ON s.material_id=m.id ORDER BY m.name');
 const [templates]=await pool.execute('SELECT t.id,t.name,t.slug,t.category,t.current_version,t.archived,v.configuration,v.rules FROM world_industry_templates t JOIN world_industry_template_versions v ON v.template_id=t.id AND v.version=t.current_version ORDER BY t.name');
 const [facilities]=await pool.execute('SELECT f.*,s.name AS settlement_name,s.region_id,s.zone_id,s.controlling_faction_id,s.population,s.workforce AS settlement_workers,t.name AS template_name,t.category AS template_category,v.configuration AS template_configuration,v.rules AS template_rules FROM world_industry_facilities f JOIN world_settlements s ON s.id=f.settlement_id JOIN world_industry_templates t ON t.id=f.template_id JOIN world_industry_template_versions v ON v.template_id=f.template_id AND v.version=f.template_version ORDER BY f.id DESC');
 const [projects]=await pool.execute('SELECT p.*,f.name AS facility_name,f.settlement_id FROM world_industry_projects p JOIN world_industry_facilities f ON f.id=p.facility_id ORDER BY p.id DESC');
 const [needs]=await pool.execute('SELECT * FROM world_industry_project_needs ORDER BY project_id,item_id');
 const [stocks]=await pool.execute('SELECT facility_id,item_id,quantity FROM world_industry_stock WHERE quantity>0 ORDER BY facility_id,item_id');
 const [cycles]=await pool.execute('SELECT facility_id,cycle_key,cycle_date,operations,configuration_version FROM world_industry_cycles ORDER BY created_at DESC LIMIT 100');
 const [ledger]=await pool.execute('SELECT facility_id,item_id,delta,balance_after,action,reference_key,created_at FROM world_industry_ledger ORDER BY id DESC LIMIT 150');
 const [settlements]=await pool.execute('SELECT id,name,controlling_faction_id,region_id,zone_id,population,workforce FROM world_settlements ORDER BY name');
 const [campaigns]=await pool.execute("SELECT id,name,state FROM order_construction_projects WHERE state IN ('draft','open','paused') ORDER BY id DESC LIMIT 200");
 return ok({items,workshop,templates:templates.map(t=>({...t,configuration:array(t.configuration),rules:array(t.rules)})),facilities:facilities.map(f=>({...f,template_configuration:array(f.template_configuration),template_rules:array(f.template_rules),stocks:stocks.filter(s=>s.facility_id===f.id),cycles:cycles.filter(c=>c.facility_id===f.id).slice(0,12),ledger:ledger.filter(x=>x.facility_id===f.id).slice(0,30)})),projects:projects.map(p=>({...p,needs:needs.filter(n=>n.project_id===p.id)})),settlements,campaigns});
}
export async function industryRoute(pool,req,path,actor){
 if(!['domina','high_command'].includes(actor?.account_role))return fail(403,'command_required');
 if(req.method==='GET'&&path==='/world-admin/industry')return summary(pool);
 let match;
 if(path==='/world-admin/industry/items'&&req.method==='POST'){
  const b=await body(req);
  if(!b||!validItemId(b.id)||!txt(b.name,120)||!['raw','refined','fuel','supply','byproduct'].includes(b.category)||typeof b.description!=='string'||b.description.length>500||(b.workshop_material_id&&!validItemId(b.workshop_material_id)))return fail(400,'invalid_industry_item');
  return atomicIndustry(pool,async db=>{
   if(b.workshop_material_id){const [[material]]=await db.execute('SELECT id FROM fc_materials WHERE id=?',[b.workshop_material_id]);if(!material)return fail(400,'workshop_material_not_found')}
   try{await db.execute('INSERT INTO world_industry_items(id,name,category,workshop_material_id,description) VALUES(?,?,?,?,?)',[b.id,b.name.trim(),b.category,b.workshop_material_id||null,b.description]);}
   catch(e){if(e.code==='ER_DUP_ENTRY')return fail(409,'industry_item_exists');throw e}
   await audit(db,actor.id,'industry',0,'item_create',b.id);return ok({id:b.id});
  });
 }
 if(path==='/world-admin/industry/templates'&&req.method==='POST'||(match=/^\/world-admin\/industry\/templates\/(\d+)\/versions$/.exec(path))&&req.method==='POST'){
  const b=await body(req),versionTarget=match?Number(match[1]):null;
  const error=validateIndustryConfiguration(b?.configuration)||validateIndustryRules(b?.rules);
  if(error)return fail(400,error);
  if(!versionTarget&&(!txt(b.name,120)||!txt(b.slug,70)||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(b.slug)||!['mine','extraction','refinery','manufacturing','utilities','agriculture','other'].includes(b.category)))return fail(400,'invalid_template');
  return atomicIndustry(pool,async db=>{
   if(!await ensureItems(db,b.configuration))return fail(400,'unknown_industry_item');
   if(!await noCycle(db,b.configuration,versionTarget))return fail(409,'circular_industry_dependency');
   if(versionTarget){
    const [[old]]=await db.execute('SELECT id,current_version FROM world_industry_templates WHERE id=? FOR UPDATE',[versionTarget]);
    if(!old)return fail(404,'template_not_found');
    if(Number(old.current_version)>=999)return fail(409,'template_version_limit');
    const next=Number(old.current_version)+1;
    await db.execute('INSERT INTO world_industry_template_versions(template_id,version,configuration,rules,published_by) VALUES(?,?,?,?,?)',[versionTarget,next,JSON.stringify(b.configuration),JSON.stringify(b.rules),actor.id]);
    await db.execute('UPDATE world_industry_templates SET current_version=? WHERE id=?',[next,versionTarget]);
    await audit(db,actor.id,'industry',versionTarget,'template_publish',String(next));
    return ok({template_id:versionTarget,version:next});
   }
   let created;
   try{[created]=await db.execute('INSERT INTO world_industry_templates(name,slug,category,created_by) VALUES(?,?,?,?)',[b.name.trim(),b.slug,b.category,actor.id]);}
   catch(e){if(e.code==='ER_DUP_ENTRY')return fail(409,'template_slug_exists');throw e}
   await db.execute('INSERT INTO world_industry_template_versions(template_id,version,configuration,rules,published_by) VALUES(?,?,?,?,?)',[created.insertId,1,JSON.stringify(b.configuration),JSON.stringify(b.rules),actor.id]);
   await audit(db,actor.id,'industry',created.insertId,'template_create',b.slug);
   return ok({template_id:created.insertId,version:1});
  });
 }
 if(path==='/world-admin/industry/rules/dry-run'&&req.method==='POST'){
  const b=await body(req),error=validateIndustryConfiguration(b?.configuration)||validateIndustryRules(b?.rules);
  if(error)return fail(400,error);
  const fake={status:b.facility?.status||'operational',level:Number(b.facility?.level||1),capacity_pct:Number(b.facility?.capacity_pct??100),workforce:Number(b.facility?.workforce||0),heat_available:Number(b.facility?.heat_available||0),power_available:Number(b.facility?.power_available||0)};
  return ok({preview:industryProductionPreview(fake,b.configuration,b.rules,b.stock||{},{population:0,stability:80,security:50})});
 }
 if(path==='/world-admin/industry/facilities'&&req.method==='POST'){
  const b=await body(req);if(!validFacility(b))return fail(400,'invalid_facility');
  return atomicIndustry(pool,async db=>{
   const [[site]]=await db.execute('SELECT id,population,workforce,controlling_faction_id FROM world_settlements WHERE id=? FOR UPDATE',[b.settlement_id]);
   const [[template]]=await db.execute('SELECT id,current_version FROM world_industry_templates WHERE id=? AND archived=0',[b.template_id]);
   if(!site||!template)return fail(404,'site_or_template_not_found');
   const [[assigned]]=await db.execute('SELECT COALESCE(SUM(workforce),0) AS n FROM world_industry_facilities WHERE settlement_id=?',[b.settlement_id]);
   if(Number(assigned.n)+b.workforce>Number(site.workforce))return fail(409,'facility_workers_exceed_settlement');
   const [r]=await db.execute('INSERT INTO world_industry_facilities(settlement_id,owner_faction_id,template_id,template_version,name,status,level,capacity_pct,workforce,heat_available,power_available,cycle_mode,cycle_cadence,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[b.settlement_id,site.controlling_faction_id||null,b.template_id,template.current_version,b.name.trim(),b.status,b.level,b.capacity_pct,b.workforce,b.heat_available,b.power_available,b.cycle_mode,b.cycle_cadence,b.notes,actor.id]);
   await audit(db,actor.id,'industry',r.insertId,'facility_create',b.name);return ok({id:r.insertId});
  });
 }
 if((match=/^\/world-admin\/industry\/facilities\/(\d+)$/.exec(path))&&req.method==='PUT'){
  const id=Number(match[1]),b=await body(req);if(!b||!txt(b.name,140)||!whole(b.level,1,20)||!whole(b.capacity_pct,0,100)||!whole(b.workforce,0,10000000)||!num(b.heat_available,0,1000000)||!num(b.power_available,0,1000000)||!['off','manual','automatic'].includes(b.cycle_mode)||!['slow','normal','fast'].includes(b.cycle_cadence)||typeof b.notes!=='string'||b.notes.length>500)return fail(400,'invalid_facility_settings');
  return atomicIndustry(pool,async db=>{
   const [[f]]=await db.execute('SELECT f.id,f.settlement_id,s.workforce AS settlement_workforce FROM world_industry_facilities f JOIN world_settlements s ON s.id=f.settlement_id WHERE f.id=? FOR UPDATE',[id]);
   if(!f)return fail(404,'facility_not_found');
   const [[assigned]]=await db.execute('SELECT COALESCE(SUM(workforce),0) AS n FROM world_industry_facilities WHERE settlement_id=?',[f.settlement_id]);
   if(Number(assigned.n)-Number((await db.execute('SELECT workforce FROM world_industry_facilities WHERE id=?',[id]))[0][0].workforce)+b.workforce>Number(f.settlement_workforce))return fail(409,'facility_workers_exceed_settlement');
   await db.execute('UPDATE world_industry_facilities SET name=?,level=?,capacity_pct=?,workforce=?,heat_available=?,power_available=?,cycle_mode=?,cycle_cadence=?,notes=? WHERE id=?',[b.name.trim(),b.level,b.capacity_pct,b.workforce,b.heat_available,b.power_available,b.cycle_mode,b.cycle_cadence,b.notes,id]);
   await audit(db,actor.id,'industry',id,'facility_settings',b.cycle_mode);return ok({saved:true});
  });
 }
 if((match=/^\/world-admin\/industry\/facilities\/(\d+)\/reconcile$/.exec(path))&&req.method==='POST'){
  const id=Number(match[1]);
  return atomicIndustry(pool,async db=>{
   const [[f]]=await db.execute('SELECT f.owner_faction_id,s.controlling_faction_id FROM world_industry_facilities f JOIN world_settlements s ON s.id=f.settlement_id WHERE f.id=? FOR UPDATE',[id]);
   if(!f)return fail(404,'facility_not_found');
   if((f.owner_faction_id||null)===(f.controlling_faction_id||null))return fail(409,'facility_ownership_unchanged');
   await db.execute("UPDATE world_industry_facilities SET owner_faction_id=?,status='captured',cycle_mode='off',last_cycle_key=NULL WHERE id=?",[f.controlling_faction_id||null,id]);
   await audit(db,actor.id,'industry',id,'facility_control_review',String(f.owner_faction_id||'unclaimed')+' -> '+String(f.controlling_faction_id||'unclaimed'));
   return ok({saved:true,status:'captured',production:'off'});
  });
 }
 if((match=/^\/world-admin\/industry\/facilities\/(\d+)\/transition$/.exec(path))&&req.method==='POST'){
  const id=Number(match[1]),b=await body(req);
  const allowed={captured:['liberated'],ruined:['liberated'],liberated:['rebuilding'],rebuilding:['damaged'],operational:['damaged','paused','captured'],paused:['operational','damaged'],damaged:['rebuilding','paused']};
  return atomicIndustry(pool,async db=>{
   const [[f]]=await db.execute('SELECT f.status,f.owner_faction_id,s.controlling_faction_id FROM world_industry_facilities f JOIN world_settlements s ON s.id=f.settlement_id WHERE f.id=? FOR UPDATE',[id]);
   if(!f)return fail(404,'facility_not_found');
   if((f.owner_faction_id||null)!==(f.controlling_faction_id||null))return fail(409,'facility_ownership_changed');
   if(!allowed[f.status]?.includes(b?.status))return fail(409,'invalid_facility_transition');
   if(b.status==='operational'){
    const [[pending]]=await db.execute("SELECT id FROM world_industry_projects WHERE facility_id=? AND status IN ('planned','active','paused') LIMIT 1",[id]);
    if(pending)return fail(409,'project_incomplete');
   }
   await db.execute('UPDATE world_industry_facilities SET status=?,cycle_mode=IF(? IN (\'captured\',\'damaged\'),\'off\',cycle_mode) WHERE id=?',[b.status,b.status,id]);
   await audit(db,actor.id,'industry',id,'facility_transition',f.status+' to '+b.status);return ok({saved:true});
  });
 }
 if((match=/^\/world-admin\/industry\/facilities\/(\d+)\/preview$/.exec(path))&&req.method==='GET'){
  const data=await getIndustryPreview(pool,Number(match[1]));return data?ok(data):fail(404,'facility_not_found');
 }
 if((match=/^\/world-admin\/industry\/facilities\/(\d+)\/run$/.exec(path))&&req.method==='POST'){
  return atomicIndustry(pool,db=>produceIndustryCycle(db,Number(match[1]),new Date(),actor.id));
 }
 if((match=/^\/world-admin\/industry\/facilities\/(\d+)\/(transfer|shared-in|shared-out)$/.exec(path))&&req.method==='POST'){
  const source=Number(match[1]),action=match[2],b=await body(req);
  if(!b||!validItemId(b.item_id)||!num(b.quantity,0.001,1000000)||action==='transfer'&&!whole(b.target_facility_id,1,Number.MAX_SAFE_INTEGER)||action==='transfer'&&b.target_facility_id===source)return fail(400,'invalid_material_transfer');
  return atomicIndustry(pool,async db=>{
   const ids=action==='transfer'?[source,b.target_facility_id].sort((a,b)=>a-b):[source];
   const [sites]=await db.query('SELECT id FROM world_industry_facilities WHERE id IN ('+ids.map(()=>'?').join(',')+') ORDER BY id FOR UPDATE',ids);
   if(sites.length!==ids.length)return fail(404,'facility_not_found');
   const key='transfer:'+new Date().toISOString()+':'+actor.id.slice(0,8);
   if(action==='transfer'){
    await adjustFacilityStock(db,source,b.item_id,-b.quantity,'transfer_out',key,actor.id);
    await adjustFacilityStock(db,b.target_facility_id,b.item_id,b.quantity,'transfer_in',key,actor.id);
   }else{
    const [[item]]=await db.execute('SELECT workshop_material_id FROM world_industry_items WHERE id=?',[b.item_id]);
    if(!item||!item.workshop_material_id||!Number.isInteger(b.quantity))return fail(409,'item_not_workshop_compatible');
    await db.execute('INSERT IGNORE INTO fc_material_stock(material_id,quantity) VALUES(?,0)',[item.workshop_material_id]);
    const [[st]]=await db.execute('SELECT quantity FROM fc_material_stock WHERE material_id=? FOR UPDATE',[item.workshop_material_id]);
    if(action==='shared-in'){
     if(N(st.quantity)<b.quantity)return fail(409,'insufficient_unreserved_shared_stock');
     await db.execute('UPDATE fc_material_stock SET quantity=quantity-? WHERE material_id=?',[b.quantity,item.workshop_material_id]);
     await adjustFacilityStock(db,source,b.item_id,b.quantity,'shared_in',key,actor.id);
    }else{
     await adjustFacilityStock(db,source,b.item_id,-b.quantity,'transfer_out',key,actor.id);
     await db.execute('UPDATE fc_material_stock SET quantity=quantity+? WHERE material_id=?',[b.quantity,item.workshop_material_id]);
    }
    const [[after]]=await db.execute('SELECT quantity FROM fc_material_stock WHERE material_id=?',[item.workshop_material_id]);
    await db.execute('INSERT INTO fc_material_ledger(material_id,delta,balance_after,activity,account_id,note) VALUES(?,?,?,?,?,?)',[item.workshop_material_id,action==='shared-in'?-b.quantity:b.quantity,after.quantity,'trade',actor.id,'Industry '+action+' facility #'+source]);
    if(action==='shared-in')await db.execute('INSERT INTO world_industry_shared_receipts(facility_id,material_id,item_id,quantity,actor_id) VALUES(?,?,?,?,?)',[source,item.workshop_material_id,b.item_id,b.quantity,actor.id]);
   }
   await audit(db,actor.id,'industry',source,'stock_'+action,b.item_id+' '+b.quantity);
   return ok({saved:true});
  });
 }
 if(path==='/world-admin/industry/projects'&&req.method==='POST'){
  const b=await body(req);if(!validProject(b))return fail(400,'invalid_industry_project');
  return atomicIndustry(pool,async db=>{
   const [[f]]=await db.execute('SELECT id,status FROM world_industry_facilities WHERE id=? FOR UPDATE',[b.facility_id]);
   if(!f)return fail(404,'facility_not_found');
   if(f.status==='captured')return fail(409,'liberate_facility_first');
   if(b.result_status==='operational'&&!['liberated','ruined','rebuilding','damaged','paused'].includes(f.status))return fail(409,'invalid_reconstruction_state');
   if(b.campaign_project_id){
    const [[campaign]]=await db.execute('SELECT id FROM order_construction_projects WHERE id=?',[b.campaign_project_id]);if(!campaign)return fail(404,'campaign_project_not_found');
   }
   const [items]=b.needs.length?await db.query('SELECT id FROM world_industry_items WHERE id IN ('+b.needs.map(()=>'?').join(',')+')',b.needs.map(x=>x.item_id)):[[]];
   if(items.length!==b.needs.length)return fail(400,'unknown_industry_item');
   const [r]=await db.execute('INSERT INTO world_industry_projects(facility_id,name,status,result_status,labor_required,campaign_project_id,description,created_by) VALUES(?,?,?,?,?,?,?,?)',[b.facility_id,b.name.trim(),b.status,b.result_status,b.labor_required,b.campaign_project_id||null,b.description,actor.id]);
   for(const n of b.needs)await db.execute('INSERT INTO world_industry_project_needs(project_id,item_id,required_qty) VALUES(?,?,?)',[r.insertId,n.item_id,n.qty]);
   if(b.status==='active'&&['liberated','ruined','damaged'].includes(f.status))await db.execute("UPDATE world_industry_facilities SET status='rebuilding' WHERE id=?",[b.facility_id]);
   await audit(db,actor.id,'industry',r.insertId,'project_create',b.name);return ok({id:r.insertId});
  });
 }
 if((match=/^\/world-admin\/industry\/projects\/(\d+)\/(activate|pause|advance|commit)$/.exec(path))&&req.method==='POST'){
  const id=Number(match[1]),operation=match[2],b=operation==='commit'?await body(req):null;
  if(operation==='commit'&&(!b||!validItemId(b.item_id)||!num(b.quantity,0.001,1000000)||!['facility','shared'].includes(b.source)))return fail(400,'invalid_project_contribution');
  return atomicIndustry(pool,async db=>{
   const [[p]]=await db.execute('SELECT * FROM world_industry_projects WHERE id=? FOR UPDATE',[id]);
   if(!p)return fail(404,'project_not_found');
   if(operation==='advance')return advanceIndustryProject(db,id,new Date(),actor.id);
   if(operation==='activate'||operation==='pause'){
    if(operation==='activate'&&!['planned','paused'].includes(p.status)||operation==='pause'&&p.status!=='active')return fail(409,'invalid_project_status');
    await db.execute('UPDATE world_industry_projects SET status=? WHERE id=?',[operation==='pause'?'paused':'active',id]);
    return ok({saved:true});
   }
   if(!['planned','active','paused'].includes(p.status))return fail(409,'project_not_receiving_goods');
   const [[need]]=await db.execute('SELECT * FROM world_industry_project_needs WHERE project_id=? AND item_id=? FOR UPDATE',[id,b.item_id]);
   if(!need||N(need.committed_qty)+b.quantity>N(need.required_qty)+.00001)return fail(409,'project_requirement_exceeded');
   if(b.source==='facility')await adjustFacilityStock(db,p.facility_id,b.item_id,-b.quantity,'project_commit','project:'+id,actor.id);
   else{
    const [[item]]=await db.execute('SELECT workshop_material_id FROM world_industry_items WHERE id=?',[b.item_id]);
    if(!item?.workshop_material_id||!Number.isInteger(b.quantity))return fail(409,'item_not_workshop_compatible');
    const [[shared]]=await db.execute('SELECT quantity FROM fc_material_stock WHERE material_id=? FOR UPDATE',[item.workshop_material_id]);
    if(!shared||Number(shared.quantity)<b.quantity)return fail(409,'insufficient_unreserved_shared_stock');
    await db.execute('UPDATE fc_material_stock SET quantity=quantity-? WHERE material_id=?',[b.quantity,item.workshop_material_id]);
    const [[after]]=await db.execute('SELECT quantity FROM fc_material_stock WHERE material_id=?',[item.workshop_material_id]);
    await db.execute('INSERT INTO fc_material_ledger(material_id,delta,balance_after,activity,account_id,note) VALUES(?,?,?,?,?,?)',[item.workshop_material_id,-b.quantity,after.quantity,'project',actor.id,'Committed industry project #'+id]);
   }
   await db.execute('UPDATE world_industry_project_needs SET committed_qty=committed_qty+? WHERE project_id=? AND item_id=?',[b.quantity,id,b.item_id]);
   await audit(db,actor.id,'industry',id,'project_commit',b.source+' '+b.item_id+' '+b.quantity);
   return ok({saved:true});
  });
 }
 return fail(404,'not_found');
}
