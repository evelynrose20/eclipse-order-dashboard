import {equipmentRoute,equipmentSummary} from './world-magitek-equipment.js';
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
export function evaluateEquipmentManufacture(config,category,equipmentOutputs,equipmentByproducts=[],rules=[]){
 if(equipmentByproducts.length)return 'equipment_cannot_be_byproduct';
 if(!equipmentOutputs.length)return null;
 if(rules.some(r=>r.action?.type==='multiplier'))return 'equipment_output_multipliers_forbidden';
 if(equipmentOutputs.some(x=>!x.enabled))return 'equipment_template_disabled';
 if(category!=='manufacturing')return 'equipment_requires_manufacturing_facility';
 if((config.inputs||[]).length<2||config.labor<5||config.power<1)return 'equipment_requires_materials_labor_and_power';
 const outputs=equipmentOutputs.map(x=>({...x,qty:Number(config.outputs.find(o=>o.item_id===x.id)?.qty||0)}));
 if(outputs.some(x=>!Number.isInteger(x.qty)||x.qty<1))return 'equipment_requires_whole_units';
 const costs={transport:10,locomotive:18,railcar:12,armored_vehicle:14,airship:25,capital_airship:120,field_equipment:5,siege_equipment:18,other:8};
 const workforce={transport:6,locomotive:10,railcar:7,armored_vehicle:10,airship:14,capital_airship:100,field_equipment:5,siege_equipment:12,other:5};
 const power={transport:2,locomotive:4,railcar:2,armored_vehicle:3,airship:5,capital_airship:80,field_equipment:1,siege_equipment:3,other:1};
 const totalMaterials=(config.inputs||[]).reduce((n,row)=>n+Number(row.qty||0),0);
 const requiredMaterials=outputs.reduce((n,x)=>{
  const perUnit=(costs[x.equipment_kind]||8)+Math.ceil(Number(x.cargo_capacity||0)/50)+
   Math.ceil(Number(x.transport_capacity||0)/10);
  return n+perUnit*x.qty;
 },0);
 const minLabor=Math.max(...outputs.map(x=>workforce[x.equipment_kind]||5));
 const minPower=Math.max(...outputs.map(x=>power[x.equipment_kind]||1));
 if(totalMaterials<requiredMaterials||config.labor<minLabor||config.power<minPower)return 'equipment_assembly_requirements_too_low';
 return null;
}
async function validateEquipmentManufacture(db,b){
 const outputs=[...(b.configuration?.outputs||[]),...(b.configuration?.byproducts||[])];
 if(!outputs.length)return null;
 const [rows]=await db.query("SELECT i.id,i.category,t.enabled,t.equipment_kind,t.cargo_capacity,t.transport_capacity FROM world_industry_items i LEFT JOIN world_magitek_equipment_templates t ON t.item_id=i.id WHERE i.id IN ("+outputs.map(()=>'?').join(',')+")",outputs.map(x=>x.item_id));
 const equipment=rows.filter(x=>x.category==='equipment');
 return evaluateEquipmentManufacture(b.configuration,b.category,
 equipment.filter(x=>(b.configuration.outputs||[]).some(o=>o.item_id===x.id)),
 equipment.filter(x=>(b.configuration.byproducts||[]).some(o=>o.item_id===x.id)),b.rules||[]);
}
async function noCycle(db,c,excluding=null){
 const [rows]=await db.execute('SELECT v.configuration FROM world_industry_templates t JOIN world_industry_template_versions v ON v.template_id=t.id AND v.version=t.current_version WHERE t.archived=0'+(excluding?' AND t.id<>?':''),excluding?[excluding]:[]);
 const [pinned]=await db.execute("SELECT DISTINCT v.configuration FROM world_industry_facilities f JOIN world_industry_template_versions v ON v.template_id=f.template_id AND v.version=f.template_version WHERE f.status IN ('operational','rebuilding','liberated','damaged')"+(excluding?' AND f.template_id<>?':''),excluding?[excluding]:[]);
 return !industryDependenciesHaveCycle([...rows.map(r=>array(r.configuration)),...pinned.map(r=>array(r.configuration)),c]);
}
const validFacility=b=>b&&(whole(b.settlement_id,1,Number.MAX_SAFE_INTEGER)!==whole(b.site_id,1,Number.MAX_SAFE_INTEGER))&&whole(b.template_id,1,Number.MAX_SAFE_INTEGER)&&txt(b.name,140)&&['captured','liberated','ruined','rebuilding','operational','damaged','paused'].includes(b.status)&&['off','manual','automatic'].includes(b.cycle_mode)&&['slow','normal','fast'].includes(b.cycle_cadence)&&typeof b.notes==='string'&&b.notes.length<=500;
const validProject=b=>b&&whole(b.facility_id,1,Number.MAX_SAFE_INTEGER)&&txt(b.name,140)&&typeof b.description==='string'&&b.description.length<=500&&['planned','active'].includes(b.status)&&['liberated','rebuilding','operational','damaged'].includes(b.result_status)&&whole(b.labor_required,1,1000000)&&Array.isArray(b.needs)&&b.needs.length<=20&&b.needs.every(x=>validItemId(x.item_id)&&num(x.qty,0.001,1000000))&&new Set(b.needs.map(x=>x.item_id)).size===b.needs.length&&(b.campaign_project_id==null||whole(b.campaign_project_id,1,Number.MAX_SAFE_INTEGER));
async function summary(pool){
 const [items]=await pool.execute('SELECT i.*,m.name AS workshop_name,COALESCE(st.quantity,0) AS shared_qty FROM world_industry_items i LEFT JOIN fc_materials m ON m.id=i.workshop_material_id LEFT JOIN fc_material_stock st ON st.material_id=m.id ORDER BY i.name');
 const [workshop]=await pool.execute('SELECT m.id,m.name,m.category,COALESCE(s.quantity,0) AS quantity FROM fc_materials m LEFT JOIN fc_material_stock s ON s.material_id=m.id ORDER BY m.name');
 const [templates]=await pool.execute('SELECT t.id,t.name,t.slug,t.category,t.current_version,t.archived,v.configuration,v.rules FROM world_industry_templates t JOIN world_industry_template_versions v ON v.template_id=t.id AND v.version=t.current_version ORDER BY t.name');
 const [facilities]=await pool.execute(`SELECT f.*,COALESCE(s.name,site.name) AS settlement_name,
 COALESCE(s.region_id,site.region_id) AS region_id,COALESCE(s.zone_id,site.zone_id) AS zone_id,
 COALESCE(s.controlling_faction_id,z.controlling_faction_id) AS controlling_faction_id,
 COALESCE(s.population,0) AS population,t.name AS template_name,t.category AS template_category,
 v.configuration AS template_configuration,v.rules AS template_rules
 FROM world_industry_facilities f LEFT JOIN world_settlements s ON s.id=f.settlement_id
 LEFT JOIN world_industry_sites site ON site.id=f.site_id
 LEFT JOIN world_zones z ON z.id=site.zone_id
 JOIN world_industry_templates t ON t.id=f.template_id
 JOIN world_industry_template_versions v ON v.template_id=f.template_id AND v.version=f.template_version
 ORDER BY f.id DESC`);
 const [projects]=await pool.execute('SELECT p.*,f.name AS facility_name,f.settlement_id FROM world_industry_projects p JOIN world_industry_facilities f ON f.id=p.facility_id ORDER BY p.id DESC');
 const [needs]=await pool.execute('SELECT * FROM world_industry_project_needs ORDER BY project_id,item_id');
 const [stocks]=await pool.execute('SELECT facility_id,item_id,quantity FROM world_industry_stock WHERE quantity>0 ORDER BY facility_id,item_id');
 const [weatherIncidents]=await pool.execute('SELECT facility_id,cycle_key,weather,temperature_f,equipment_damage,crop_loss_pct,injured_workers,note,created_at FROM world_industry_weather_incidents ORDER BY id DESC LIMIT 150');
 const [cycles]=await pool.execute('SELECT facility_id,cycle_key,cycle_date,operations,configuration_version FROM world_industry_cycles ORDER BY created_at DESC LIMIT 100');
 const [ledger]=await pool.execute('SELECT facility_id,item_id,delta,balance_after,action,reference_key,created_at FROM world_industry_ledger ORDER BY id DESC LIMIT 150');
 const [settlements]=await pool.execute('SELECT id,name,description,map_icon,strategic_state,controlling_faction_id,region_id,zone_id,population,workforce FROM world_settlements ORDER BY name');
 const [sites]=await pool.execute('SELECT site.*,z.controlling_faction_id AS controlling_faction_id FROM world_industry_sites site JOIN world_zones z ON z.id=site.zone_id ORDER BY site.name');
 const [zones]=await pool.execute('SELECT id,region_id,name FROM world_zones ORDER BY region_id,name');
 const [regions]=await pool.execute('SELECT id,name FROM world_regions ORDER BY name');
 const [campaigns]=await pool.execute("SELECT id,name,state FROM order_construction_projects WHERE state IN ('draft','open','paused') ORDER BY id DESC LIMIT 200");
 const equipment=await equipmentSummary(pool);
 return ok({equipment,items,workshop,templates:templates.map(t=>({...t,configuration:array(t.configuration),rules:array(t.rules)})),facilities:facilities.map(f=>({...f,template_configuration:array(f.template_configuration),template_rules:array(f.template_rules),weather_incidents:weatherIncidents.filter(x=>x.facility_id===f.id).slice(0,12),stocks:stocks.filter(s=>s.facility_id===f.id),cycles:cycles.filter(c=>c.facility_id===f.id).slice(0,12),ledger:ledger.filter(x=>x.facility_id===f.id).slice(0,30)})),projects:projects.map(p=>({...p,needs:needs.filter(n=>n.project_id===p.id)})),settlements,sites,zones,regions,campaigns});
}
export async function industryRoute(pool,req,path,actor){
 if(!['domina','high_command'].includes(actor?.account_role))return fail(403,'command_required');
 if(path.startsWith('/world-admin/industry/equipment')||path.startsWith('/world-admin/industry/trains'))return equipmentRoute(pool,req,path,actor);
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
 if(path==='/world-admin/industry/templates'&&req.method==='POST'||(match=/^\/world-admin\/industry\/templates\/(\d+)\/(versions|edit)$/.exec(path))&&req.method==='POST'){
  const b=await body(req),versionTarget=match?Number(match[1]):null,editExisting=match?.[2]==='edit';
  const error=validateIndustryConfiguration(b?.configuration)||validateIndustryRules(b?.rules);
  if(error)return fail(400,error);
  if(!versionTarget&&(!txt(b.name,120)||!txt(b.slug,70)||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(b.slug)||!['mine','extraction','refinery','manufacturing','utilities','agriculture','other'].includes(b.category)))return fail(400,'invalid_template');
  return atomicIndustry(pool,async db=>{
   await db.execute('SELECT id FROM world_industry_catalog_lock WHERE id=1 FOR UPDATE');
   if(!await ensureItems(db,b.configuration))return fail(400,'unknown_industry_item');
   let effectiveCategory=b.category;
   if(versionTarget){
    const [[templateCategory]]=await db.execute('SELECT category FROM world_industry_templates WHERE id=?',[versionTarget]);
    if(!templateCategory)return fail(404,'template_not_found');
    if(b.category!==undefined&&b.category!==templateCategory.category)return fail(409,'template_category_locked');
    effectiveCategory=templateCategory.category;
   }
   const manufactureError=await validateEquipmentManufacture(db,{...b,category:effectiveCategory});
   if(manufactureError)return fail(409,manufactureError);
   if(!await noCycle(db,b.configuration,versionTarget))return fail(409,'circular_industry_dependency');
   if(versionTarget){
    const [[old]]=await db.execute('SELECT id,current_version,category FROM world_industry_templates WHERE id=? FOR UPDATE',[versionTarget]);
    if(!old)return fail(404,'template_not_found');
    if(effectiveCategory!==old.category)return fail(409,'template_category_locked');
    if(editExisting){
     const [[existing]]=await db.execute('SELECT configuration,rules FROM world_industry_template_versions WHERE template_id=? AND version=? FOR UPDATE',[versionTarget,Number(old.current_version)]);
     if(!existing)return fail(404,'template_version_not_found');
     // Preserve prior recipes in an append-only audit record for historical review.
     await db.execute('INSERT INTO world_industry_template_edit_history(template_id,version,configuration,rules,edited_by) VALUES(?,?,?,?,?)',[versionTarget,old.current_version,JSON.stringify(array(existing.configuration)),JSON.stringify(array(existing.rules)),actor.id]);
     await db.execute('UPDATE world_industry_template_versions SET configuration=?,rules=? WHERE template_id=? AND version=?',[JSON.stringify(b.configuration),JSON.stringify(b.rules),versionTarget,old.current_version]);
     await audit(db,actor.id,'industry',versionTarget,'template_edit',String(old.current_version));
     return ok({template_id:versionTarget,version:Number(old.current_version),updated:true});
    }
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
  return ok({preview:industryProductionPreview(fake,b.configuration,b.rules,b.stock||{},{population:0,stability:80,security:50,weather:b.facility?.weather||'clear',temperature_f:Number(b.facility?.temperature_f??32),industry_category:b.category||'other'})});
 }
 if(path==='/world-admin/industry/sites'&&req.method==='POST'){
  const b=await body(req);
  if(!b||!txt(b.name,140)||!['farm','ranch','lumberyard','quarry','mine','refinery','workshop','plant','power','other'].includes(b.kind)||!whole(b.region_id,1,Number.MAX_SAFE_INTEGER)||!whole(b.zone_id,1,Number.MAX_SAFE_INTEGER)||!num(b.map_x,0,100)||!num(b.map_y,0,100)||typeof b.description!=='string'||b.description.length>500)return fail(400,'invalid_industry_site');
  return atomicIndustry(pool,async db=>{
   const [[zone]]=await db.execute('SELECT id,controlling_faction_id FROM world_zones WHERE id=? AND region_id=?',[b.zone_id,b.region_id]);
   if(!zone)return fail(404,'zone_not_found');
   const [result]=await db.execute('INSERT INTO world_industry_sites(region_id,zone_id,name,kind,description,controlling_faction_id,map_x,map_y,created_by) VALUES(?,?,?,?,?,?,?,?,?)',[b.region_id,b.zone_id,b.name.trim(),b.kind,b.description,zone.controlling_faction_id||null,b.map_x,b.map_y,actor.id]);
   await audit(db,actor.id,'industry',result.insertId,'site_create',b.name);
   return ok({id:result.insertId});
  });
 }
 if(path==='/world-admin/industry/facilities'&&req.method==='POST'){
  const b=await body(req);if(!validFacility(b))return fail(400,'invalid_facility');
  return atomicIndustry(pool,async db=>{
   let loc;
   if(b.site_id){
    [[loc]]=await db.execute('SELECT site.id,z.controlling_faction_id FROM world_industry_sites site JOIN world_zones z ON z.id=site.zone_id WHERE site.id=? FOR UPDATE',[b.site_id]);
   }else{
    [[loc]]=await db.execute('SELECT id,controlling_faction_id FROM world_settlements WHERE id=? FOR UPDATE',[b.settlement_id]);
   }
   const [[template]]=await db.execute('SELECT id,current_version FROM world_industry_templates WHERE id=? AND archived=0',[b.template_id]);
   if(!loc||!template)return fail(404,'site_or_template_not_found');
   // Workers, fuel, level and output capacity are simulated. No initial numbers from the form.
   const [created]=await db.execute(`INSERT INTO world_industry_facilities
   (settlement_id,site_id,owner_faction_id,template_id,template_version,name,status,level,capacity_pct,workforce,heat_available,power_available,cycle_mode,cycle_cadence,notes,created_by)
   VALUES(?,?,?,?,?,?,?,1,100,0,0,0,?,?,?,?)`,
   [b.settlement_id||null,b.site_id||null,loc.controlling_faction_id||null,b.template_id,template.current_version,b.name.trim(),b.status==='captured'?'captured':'ruined',b.cycle_mode,b.cycle_cadence,b.notes,actor.id]);
   await audit(db,actor.id,'industry',created.insertId,'facility_create',b.name);
   return ok({id:created.insertId});
  });
 }
 if((match=/^\/world-admin\/industry\/facilities\/(\d+)$/.exec(path))&&req.method==='PUT'){
  const id=Number(match[1]),b=await body(req);
  if(!b||!txt(b.name,140)||!['off','manual','automatic'].includes(b.cycle_mode)||!['slow','normal','fast'].includes(b.cycle_cadence)||typeof b.notes!=='string'||b.notes.length>500)return fail(400,'invalid_facility_settings');
  if(['workforce','heat_available','power_available','level','capacity_pct','status','settlement_id','site_id','owner_faction_id'].some(k=>Object.hasOwn(b,k)))return fail(400,'simulated_resources_read_only');
  return atomicIndustry(pool,async db=>{
   const [[f]]=await db.execute('SELECT id,cycle_cadence,last_cycle_key FROM world_industry_facilities WHERE id=? FOR UPDATE',[id]);
   if(!f)return fail(404,'facility_not_found');
   if(f.last_cycle_key&&f.cycle_cadence!==b.cycle_cadence)return fail(409,'production_cadence_locked_after_first_cycle');
   await db.execute('UPDATE world_industry_facilities SET name=?,cycle_mode=?,cycle_cadence=?,notes=? WHERE id=?',[b.name.trim(),b.cycle_mode,b.cycle_cadence,b.notes,id]);
   await audit(db,actor.id,'industry',id,'facility_settings',b.cycle_mode);
   return ok({saved:true});
  });
 }
 if((match=/^\/world-admin\/industry\/facilities\/(\d+)\/reconcile$/.exec(path))&&req.method==='POST'){
  const id=Number(match[1]);
  return atomicIndustry(pool,async db=>{
   const [[f]]=await db.execute('SELECT f.owner_faction_id,COALESCE(s.controlling_faction_id,z.controlling_faction_id) AS controlling_faction_id FROM world_industry_facilities f LEFT JOIN world_settlements s ON s.id=f.settlement_id LEFT JOIN world_industry_sites site ON site.id=f.site_id LEFT JOIN world_zones z ON z.id=site.zone_id WHERE f.id=? FOR UPDATE',[id]);
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
   const [[f]]=await db.execute('SELECT f.status,f.owner_faction_id,COALESCE(s.controlling_faction_id,z.controlling_faction_id) AS controlling_faction_id FROM world_industry_facilities f LEFT JOIN world_settlements s ON s.id=f.settlement_id LEFT JOIN world_industry_sites site ON site.id=f.site_id LEFT JOIN world_zones z ON z.id=site.zone_id WHERE f.id=? FOR UPDATE',[id]);
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
 // Repair damage with material commitments and daily workforce. Never directly edit condition.
 if((match=/^\/world-admin\/industry\/facilities\/(\d+)\/repair-equipment$/.exec(path))&&req.method==='POST'){
  const id=Number(match[1]);
  return atomicIndustry(pool,async db=>{
   const [[f]]=await db.execute('SELECT id,status,equipment_condition,owner_faction_id FROM world_industry_facilities WHERE id=? FOR UPDATE',[id]);
   if(!f)return fail(404,'facility_not_found');
   const damage=100-Number(f.equipment_condition);
   if(damage<=0)return fail(409,'equipment_already_repaired');
   if(!['operational','damaged','paused'].includes(f.status))return fail(409,'facility_not_repairable');
   const [[pending]]=await db.execute("SELECT id FROM world_industry_projects WHERE facility_id=? AND equipment_repair=1 AND status IN ('planned','active','paused') LIMIT 1",[id]);
   if(pending)return fail(409,'equipment_repair_already_underway');
   const [items]=await db.execute("SELECT id FROM world_industry_items WHERE id IN ('iron-ingot','repair-timbers')");
   if(items.length!==2)return fail(409,'equipment_repair_materials_unavailable');
   const requiredIron=Math.max(10,Math.ceil(damage*3));
   const requiredWood=Math.max(10,Math.ceil(damage*4));
   const labor=Math.max(100,damage*15);
   const [newProject]=await db.execute("INSERT INTO world_industry_projects(facility_id,name,status,result_status,labor_required,description,created_by,equipment_repair) VALUES(?,?,'active','operational',?,?,?,1)",[id,'Repair damaged equipment',labor,'Repair weather-damaged industrial equipment',actor.id]);
   for(const [item,qty] of [['iron-ingot',requiredIron],['repair-timbers',requiredWood]])await db.execute('INSERT INTO world_industry_project_needs(project_id,item_id,required_qty) VALUES(?,?,?)',[newProject.insertId,item,qty]);
   await audit(db,actor.id,'industry',id,'equipment_repair_started','Project '+newProject.insertId);
   return ok({id:newProject.insertId,labor_required:labor});
  });
 }
 // Climate protection is always built with a fixed, escalating materials/labor bill.
 if((match=/^\/world-admin\/industry\/facilities\/(\d+)\/climate-upgrade$/.exec(path))&&req.method==='POST'){
  const facilityId=Number(match[1]);
  return atomicIndustry(pool,async db=>{
   const [[f]]=await db.execute('SELECT id,status,owner_faction_id,weather_protection_level FROM world_industry_facilities WHERE id=? FOR UPDATE',[facilityId]);
   if(!f)return fail(404,'facility_not_found');
   if(!['operational','paused'].includes(f.status))return fail(409,'facility_must_be_operational_for_upgrade');
   const [[existing]]=await db.execute("SELECT id FROM world_industry_projects WHERE facility_id=? AND weather_upgrade_target IS NOT NULL AND status IN ('planned','active','paused') LIMIT 1",[facilityId]);
   if(existing)return fail(409,'climate_upgrade_already_underway');
   const target=Number(f.weather_protection_level)+1;
   const tiers=[
    {name:'Weather Shelters',labor:500,needs:[['iron-ingot',100],['repair-timbers',150],['ceruleum-fuel',20]]},
    {name:'Insulated Production Enclosures',labor:1500,needs:[['iron-ingot',350],['repair-timbers',400],['ceruleum-fuel',100]]},
    {name:'Active Climate Control',labor:4000,needs:[['iron-ingot',800],['repair-timbers',1000],['ceruleum-fuel',350]]}
   ];
   if(target>tiers.length)return fail(409,'maximum_climate_protection_reached');
   const tier=tiers[target-1];
   const [available]=await db.execute("SELECT id FROM world_industry_items WHERE id IN ('iron-ingot','repair-timbers','ceruleum-fuel')");
   if(available.length!==3)return fail(409,'climate_upgrade_material_catalog_incomplete');
   const [created]=await db.execute("INSERT INTO world_industry_projects(facility_id,name,status,result_status,labor_required,description,created_by,weather_upgrade_target) VALUES(?,?,'active','operational',?,?,?,?)",[facilityId,tier.name,tier.labor,'Industrial weather protection: tier '+target,actor.id,target]);
   for(const [item,amount] of tier.needs)await db.execute('INSERT INTO world_industry_project_needs(project_id,item_id,required_qty) VALUES(?,?,?)',[created.insertId,item,amount]);
   await audit(db,actor.id,'industry',facilityId,'climate_upgrade_started','Tier '+target+' project '+created.insertId);
   return ok({id:created.insertId,target_level:target,name:tier.name});
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
