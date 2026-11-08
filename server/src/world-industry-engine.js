import {industryProductionPreview} from './world-industry-rules.js';
import {allocateLabor,derivedFacilityResources} from './world-industry-resources.js';
import {simulationCycleKey} from './world-settlement-simulation.js';

export const industryCycleKey=(date,cadence)=>simulationCycleKey(date,cadence);
const num=x=>Number(x||0);
const round=x=>Math.round(num(x)*1000)/1000;
export async function atomicIndustry(pool,work){
 const db=await pool.getConnection();
 try{await db.beginTransaction();const result=await work(db);if(result?.status&&result.status!==200){await db.rollback();return result}await db.commit();return result}
 catch(error){await db.rollback().catch(()=>{});throw error}finally{db.release()}
}
async function stockSnapshot(db,facilityId,lock=false){
 const [rows]=await db.execute('SELECT item_id,quantity FROM world_industry_stock WHERE facility_id=? ORDER BY item_id'+(lock?' FOR UPDATE':''),[facilityId]);
 return Object.fromEntries(rows.map(x=>[x.item_id,num(x.quantity)]));
}
export async function adjustFacilityStock(db,facilityId,itemId,delta,action,referenceKey,actorId=null){
 const [[exists]]=await db.execute('SELECT id FROM world_industry_items WHERE id=?',[itemId]);
 if(!exists)throw Object.assign(new Error('unknown_industry_item'),{status:400});
 await db.execute('INSERT IGNORE INTO world_industry_stock(facility_id,item_id,quantity) VALUES(?,?,0)',[facilityId,itemId]);
 const [[row]]=await db.execute('SELECT quantity FROM world_industry_stock WHERE facility_id=? AND item_id=? FOR UPDATE',[facilityId,itemId]);
 const after=round(num(row.quantity)+delta);
 if(after<0)throw Object.assign(new Error('insufficient_facility_stock'),{status:409});
 if(after>99999999999)throw Object.assign(new Error('stock_capacity_exceeded'),{status:409});
 await db.execute('UPDATE world_industry_stock SET quantity=? WHERE facility_id=? AND item_id=?',[after,facilityId,itemId]);
 await db.execute('INSERT INTO world_industry_ledger(facility_id,item_id,delta,balance_after,action,reference_key,actor_id) VALUES(?,?,?,?,?,?,?)',[facilityId,itemId,round(delta),after,action,referenceKey,actorId]);
 return after;
}
export async function getIndustryPreview(db,id,lock=false){
 const [[facility]]=await db.execute(`SELECT f.*,COALESCE(s.region_id,l.region_id) AS region_id,COALESCE(s.zone_id,l.zone_id) AS zone_id,
 COALESCE(s.population,0) AS population,COALESCE(s.civil_stability,70) AS stability,
 COALESCE(s.security_score,50) AS security,
 COALESCE(s.controlling_faction_id,l.controlling_faction_id) AS controlling_faction_id,
 COALESCE(s.name,l.name) AS host_name
 FROM world_industry_facilities f
 LEFT JOIN world_settlements s ON s.id=f.settlement_id
 LEFT JOIN world_industry_locations l ON l.id=f.location_id
 WHERE f.id=?`+(lock?' FOR UPDATE':''),[id]);
 if(!facility)return null;
 const [[version]]=await db.execute('SELECT configuration,rules FROM world_industry_template_versions WHERE template_id=? AND version=?',[facility.template_id,facility.template_version]);
 const config=typeof version.configuration==='string'?JSON.parse(version.configuration):version.configuration;
 const rules=typeof version.rules==='string'?JSON.parse(version.rules):version.rules;
 // Only the last committed autonomous civic cycle certifies a workforce. Staff
 // typing large numbers into the settlement editor cannot create factory labor.
 const [zoneWorkforce]=await db.execute(`SELECT LEAST(500,FLOOR(s.population*0.6),h.workforce_after) AS workforce
 FROM world_settlements s
 JOIN world_settlement_sim_history h ON h.id=(
  SELECT MAX(history.id) FROM world_settlement_sim_history history WHERE history.settlement_id=s.id
 )
 WHERE s.region_id=? AND s.zone_id=? AND s.controlling_faction_id <=> ?`,
 [facility.region_id,facility.zone_id,facility.controlling_faction_id||null]);
 const workers=zoneWorkforce.reduce((n,row)=>n+Math.max(0,Number(row.workforce||0)),0);
 const [otherFacilities]=await db.execute(`SELECT f.id,v.configuration FROM world_industry_facilities f
 LEFT JOIN world_settlements s ON s.id=f.settlement_id
 LEFT JOIN world_industry_locations l ON l.id=f.location_id
 JOIN world_industry_template_versions v ON v.template_id=f.template_id AND v.version=f.template_version
 WHERE COALESCE(s.region_id,l.region_id)=? AND COALESCE(s.zone_id,l.zone_id)=?
 AND COALESCE(s.controlling_faction_id,l.controlling_faction_id) <=> ?
 AND f.status NOT IN ('captured','paused','ruined') ORDER BY f.id`,[facility.region_id,facility.zone_id,facility.controlling_faction_id||null]);
 const requests=otherFacilities.map(row=>{
  const c=typeof row.configuration==='string'?JSON.parse(row.configuration):row.configuration;
  return {id:row.id,labor:c.labor,capacity:c.capacity};
 });
 const staffing=allocateLabor(workers,requests).get(Number(id))||0;
 const [[utilities]]=await db.execute("SELECT COALESCE(SUM(IF(kind='power',units,0)),0) AS power_units,COALESCE(SUM(IF(kind='heat',units,0)),0) AS heat_units FROM world_industry_utilities WHERE facility_id=?",[id]);
 const effective=derivedFacilityResources(facility,config,staffing,utilities.power_units,utilities.heat_units);
 const stock=await stockSnapshot(db,id,lock);
 const preview=industryProductionPreview(effective,config,rules,stock,{population:num(facility.population),stability:num(facility.stability),security:num(facility.security)});
 if((facility.owner_faction_id||null)!==(facility.controlling_faction_id||null))return {facility:effective,config,rules,stock,preview:{...preview,operations:0,blocked:['facility_ownership_changed'],inputs:{},outputs:{},byproducts:{}}};
 return {facility:effective,config,rules,stock,preview};
}
export async function produceIndustryCycle(db,id,now=new Date(),actorId=null,dry=false){
 const data=await getIndustryPreview(db,id,!dry);
 if(!data)return {status:404,body:{error:'facility_not_found'}};
 const {facility,config,preview}=data;
 if((facility.owner_faction_id||null)!==(facility.controlling_faction_id||null))return {status:409,body:{error:'facility_ownership_changed'}};
 const key=industryCycleKey(now,facility.cycle_cadence);
 if(!dry){
  if(facility.cycle_mode==='off')return {status:409,body:{error:'production_disabled'}};
  if(facility.last_cycle_key===key)return {status:409,body:{error:'cycle_already_committed'}};
  const [[prior]]=await db.execute('SELECT cycle_key FROM world_industry_cycles WHERE facility_id=? AND cycle_key=?',[id,key]);
  if(prior)return {status:409,body:{error:'cycle_already_committed'}};
 }
 if(dry)return {status:200,body:{preview,cycle_key:key,configuration_version:facility.template_version,committed:false}};
 if(preview.operations===0)return {status:409,body:{error:preview.blocked[0]||'production_requirements_unmet',preview}};
 const change=async(entries,sign,action)=>{
  for(const [item,qty] of Object.entries(entries)){
   if(!qty)continue;
   await adjustFacilityStock(db,id,item,round(sign*qty),action,'cycle:'+key,actorId);
  }
 };
 await change(preview.inputs,-1,'consume');
 await change(preview.outputs,1,'produce');
 await change(preview.byproducts,1,'byproduct');
 await db.execute('INSERT INTO world_industry_cycles(facility_id,cycle_key,cycle_date,operations,configuration_version,report) VALUES(?,?,?,?,?,?)',[id,key,new Date(now).toISOString().slice(0,10),preview.operations,facility.template_version,JSON.stringify(preview)]);
 await db.execute('UPDATE world_industry_facilities SET last_cycle_key=? WHERE id=?',[key,id]);
 return {status:200,body:{committed:true,cycle_key:key,preview}};
}
export async function advanceIndustryProject(db,id,now=new Date(),actorId=null){
 const [[project]]=await db.execute('SELECT p.*,f.owner_faction_id,COALESCE(s.controlling_faction_id,l.controlling_faction_id) AS controlling_faction_id,f.status AS facility_status,f.id AS industry_id FROM world_industry_projects p JOIN world_industry_facilities f ON f.id=p.facility_id LEFT JOIN world_settlements s ON s.id=f.settlement_id LEFT JOIN world_industry_locations l ON l.id=f.location_id WHERE p.id=? FOR UPDATE',[id]);
 if(!project)return {status:404,body:{error:'project_not_found'}};
 if(project.status!=='active')return {status:409,body:{error:'project_not_active'}};
 if((project.owner_faction_id||null)!==(project.controlling_faction_id||null))return {status:409,body:{error:'facility_ownership_changed'}};
 const [needs]=await db.execute('SELECT * FROM world_industry_project_needs WHERE project_id=? ORDER BY item_id FOR UPDATE',[id]);
 if(needs.some(n=>num(n.committed_qty)<num(n.required_qty)))return {status:409,body:{error:'project_materials_missing'}};
 const key=industryCycleKey(now,'normal');
 const [[prior]]=await db.execute('SELECT cycle_key FROM world_industry_project_ticks WHERE project_id=? AND cycle_key=?',[id,key]);
 if(prior)return {status:409,body:{error:'project_already_advanced'}};
 const linked=await getIndustryPreview(db,project.facility_id);
 const workforce=Math.max(0,Math.floor(num(linked?.facility?.workforce)));
 if(!workforce)return {status:409,body:{error:'project_no_workers'}};
 const labor=Math.min(Math.max(0,Number(project.labor_required)-Number(project.labor_done)),Math.min(100,Math.max(1,Math.floor(workforce))));
 const updated=Math.min(Number(project.labor_required),Number(project.labor_done)+labor);
 const complete=updated===Number(project.labor_required);
 await db.execute('INSERT INTO world_industry_project_ticks(project_id,cycle_key,labor_added) VALUES(?,?,?)',[id,key,labor]);
 await db.execute('UPDATE world_industry_projects SET labor_done=?,status=?,finished_at=IF(?,UTC_TIMESTAMP(),NULL) WHERE id=?',[updated,complete?'completed':'active',complete?1:0,id]);
 if(complete){
  if(project.utility_kind&&project.utility_kind!=='none'){
   const [[totals]]=await db.execute('SELECT COUNT(*) AS n FROM world_industry_utilities WHERE facility_id=? AND kind=?',[project.facility_id,project.utility_kind]);
   if(Number(totals.n)>=10)throw Object.assign(new Error('utility_capacity_limit'),{status:409});
   await db.execute('INSERT INTO world_industry_utilities(project_id,facility_id,kind,units) VALUES(?,?,?,10)',[id,project.facility_id,project.utility_kind]);
  }else await db.execute('UPDATE world_industry_facilities SET status=? WHERE id=?',[project.result_status,project.facility_id]);
 }
 return {status:200,body:{project_id:id,labor_added:labor,labor_done:updated,completed:complete,result_status:complete?project.result_status:null,cycle_key:key}};
}
export async function runIndustryAutomation(pool,now=new Date()){
 if(!pool)return {production:0,construction:0};
 const [facilities]=await pool.execute("SELECT f.id FROM world_industry_facilities f LEFT JOIN world_settlements s ON s.id=f.settlement_id LEFT JOIN world_industry_locations l ON l.id=f.location_id WHERE f.cycle_mode='automatic' AND f.status='operational' AND f.owner_faction_id <=> COALESCE(s.controlling_faction_id,l.controlling_faction_id) ORDER BY f.id LIMIT 150");
 const [projects]=await pool.execute("SELECT p.id FROM world_industry_projects p JOIN world_industry_facilities f ON f.id=p.facility_id LEFT JOIN world_settlements s ON s.id=f.settlement_id LEFT JOIN world_industry_locations l ON l.id=f.location_id WHERE p.status='active' AND f.cycle_mode='automatic' AND f.owner_faction_id <=> COALESCE(s.controlling_faction_id,l.controlling_faction_id) ORDER BY p.id LIMIT 150");
 let production=0,construction=0;
 for(const f of facilities)try{
  const res=await atomicIndustry(pool,db=>produceIndustryCycle(db,f.id,now));
  if(res.status===200)production++;
 }catch(e){console.warn('[P3 Industry] Production failed',f.id,e?.code||e?.name||'unknown')}
 for(const p of projects)try{
  const res=await atomicIndustry(pool,db=>advanceIndustryProject(db,p.id,now));
  if(res.status===200)construction++;
 }catch(e){console.warn('[P3 Industry] Construction failed',p.id,e?.code||e?.name||'unknown')}
 return {production,construction};
}
