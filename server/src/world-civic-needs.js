import {workerHealthSnapshot} from './world-worker-care.js';
import {climateForRegions} from './world-region-climate.js';
import {handleCivicExtras} from './world-civic-extras.js';
import {upgradeEffects} from './world-settlement-upgrades.js';
import {simulatedPopulationGroups,previewPopulationChange} from './world-population-simulation.js';
// Staff-controlled civilian ledger. Never touches player/front inventory.
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const number=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const safeText=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=max;
const modes=['off','narrative','managed','detailed'];
const kinds=['food','fuel','water','medicine'];
const incidentKinds=['petition','strike','demonstration','relief_request','weather_emergency'];
const clamp=n=>Math.max(0,Math.min(100,Math.round(n)));
const parseJson=v=>typeof v==='string'?JSON.parse(v):v;
async function body(req){const chunks=[];let n=0;for await(const chunk of req){n+=chunk.length;if(n>16000)return null;chunks.push(chunk)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}}
async function tx(pool,fn){const c=await pool.getConnection();try{await c.beginTransaction();const result=await fn(c);if(result.status===200)await c.commit();else await c.rollback();return result}catch(e){await c.rollback().catch(()=>{});throw e}finally{c.release()}}
async function log(db,actor,action,id,detail=''){await db.execute('INSERT INTO world_administration_audit(actor_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',[actor,action,'civic',id,detail.slice(0,350)])}
const settingsDefault={food_daily_per_resident:1,heat_daily_per_resident:1,water_daily_per_resident:1,medicine_daily_per_resident:0.01,food_min_days:14,minimum_variety:3,grace_cycles:2,enabled_mode:'off',paused:0};
function readings(settlement,profile,stock,history,regionTempF=32,heatingAssets=[],upgrades=[]){
 const population=Number(settlement.population);
 const effects=upgradeEffects(upgrades),svc=effects.service_by_category;
 const effectiveInsulation=clamp(Number(settlement.insulation||0)+(svc.insulation||0));
 const effectiveHousing=clamp(Number(settlement.housing||0)+(svc.public_works||0));
 const effectiveMedical=clamp(Number(settlement.medical_access||0)+(svc.clinic||0));
 const effectiveFoodAccess=clamp(Number(settlement.food_access||0)+(svc.food_storage||0));
 const effectiveWaterAccess=clamp(Number(settlement.water_access??50)+(svc.water||0));
 const effectiveSecurity=clamp(Number(settlement.security_score||0)+effects.defense_bonus);
 const food=stock.filter(s=>s.resource_kind==='food').reduce((sum,s)=>sum+Number(s.quantity),0);
 const fuel=stock.filter(s=>s.resource_kind==='fuel').reduce((sum,s)=>sum+Number(s.quantity),0);
 const water=stock.filter(s=>s.resource_kind==='water').reduce((sum,s)=>sum+Number(s.quantity),0);
 const medicine=stock.filter(s=>s.resource_kind==='medicine').reduce((sum,s)=>sum+Number(s.quantity),0);
 const foodNeed=population*Number(profile.food_daily_per_resident);
 const waterNeed=population*Number(profile.water_daily_per_resident);
 const medicineNeed=population*Number(profile.medicine_daily_per_resident);
 const exposure=Number(settlement.weather_exposure)/100;
 const insulation=effectiveInsulation/100;
 const temperatureDemand=Math.max(0,65-regionTempF)/65;
 const coverage=heatingAssets.length?Math.min(100,heatingAssets.reduce((n,a)=>n+(a.status==='offline'?0:Number(a.coverage_pct)*Number(a.condition_pct)/100),0)):Number(settlement.heating_coverage??50);
 const heatNeed=population*Number(profile.heat_daily_per_resident)*temperatureDemand*(1-insulation*.65)*(0.6+exposure*.8)*(coverage/100);
 const foodDays=foodNeed?food/foodNeed:null;
 const heatDays=heatNeed?fuel/heatNeed:null;
 const seen=new Set(history.filter(h=>h.resource_kind==='food'&&Number(h.quantity_delta)>0&&h.food_group).map(h=>h.food_group));
 const deficit=foodNeed>food?clamp((foodNeed-food)/Math.max(1,foodNeed)*100):0;
 const monotony=seen.size<Number(profile.minimum_variety)?clamp((Number(profile.minimum_variety)-seen.size)*12):0;
 const chill=clamp((100-coverage)*temperatureDemand+(heatNeed>fuel?(heatNeed-fuel)/Math.max(1,heatNeed)*coverage:0));
 const dehydration=waterNeed>water?clamp((waterNeed-water)/Math.max(1,waterNeed)*100):0;
 const medicalShortage=medicineNeed>medicine?clamp((medicineNeed-medicine)/Math.max(0.001,medicineNeed)*100):0;
 const service=Math.round((100-effectiveHousing)*.12+(100-effectiveMedical)*.10+(100-effectiveFoodAccess)*.10+(100-effectiveSecurity)*.06+(100-effectiveWaterAccess)*.06);
 const pressure=population>0?clamp(deficit*.34+chill*.22+dehydration*.24+medicalShortage*.08+monotony*.12+service):0;
 const risk=population>0?clamp(pressure*.7+Number(settlement.unrest)*.3):0;
 const warnings=[...(foodNeed>0&&foodDays<Number(profile.food_min_days)?['food_reserve_low']:[]),...(chill>0?['heating_shortfall']:[]),...(coverage<75&&temperatureDemand>.35?['heating_infrastructure_low']:[]),...(dehydration>0?['water_shortfall']:[]),...(medicalShortage>0?['medicine_shortfall']:[]),...(monotony>0?['limited_diet_variety']:[]),...(risk>=55?['civic_unrest_watch']:[]),...(regionTempF<5?['extreme_cold']:[]),...(effectiveHousing<60?['housing_public_works_needed']:[]),...(effectiveMedical<60?['clinic_support_needed']:[]),...(effectiveSecurity<45?['public_safety_support_needed']:[])];
 return {effective_security:effectiveSecurity,effective_housing:effectiveHousing,effective_medical_access:effectiveMedical,effective_food_access:effectiveFoodAccess,effective_water_access:effectiveWaterAccess,effective_insulation:effectiveInsulation,food_stock:food,fuel_stock:fuel,heating_coverage_effective:Math.round(coverage),water_stock:water,medicine_stock:medicine,food_need:foodNeed,water_need:waterNeed,medicine_need:medicineNeed,heat_need:Number(heatNeed.toFixed(3)),food_days:foodDays===null?null:Number(foodDays.toFixed(2)),heat_days:heatDays===null?null:Number(heatDays.toFixed(2)),food_groups_30d:[...seen],pressure,risk,warnings:population>0?warnings:[]};
}
export function civicSimulationPreview(settlement,profile,stock,history,temperatureF=32,cycles=0,heatingAssets=[],upgrades=[]){
 const metrics=readings(settlement,{...settingsDefault,...profile},stock,history,temperatureF,heatingAssets,upgrades);
 const eligible=profile.enabled_mode==='managed'||profile.enabled_mode==='detailed';
 const afterGrace=cycles>=Number(profile.grace_cycles);
 const beforeStability=Number(settlement.civil_stability),beforeUnrest=Number(settlement.unrest);
 // Bounded voluntary simulation. Never alters population or authorizes incidents.
 const shift=Number(settlement.population)>0&&afterGrace&&eligible?Math.max(-3,Math.min(2,Math.round((40-metrics.pressure)/22))):0;
 return {...metrics,food_used:eligible?Math.min(metrics.food_stock,metrics.food_need):0,fuel_used:eligible?Math.min(metrics.fuel_stock,metrics.heat_need):0,water_used:eligible?Math.min(metrics.water_stock,metrics.water_need):0,medicine_used:eligible?Math.min(metrics.medicine_stock,metrics.medicine_need):0,before_stability:beforeStability,after_stability:clamp(beforeStability+shift),before_unrest:beforeUnrest,after_unrest:clamp(beforeUnrest-shift),grace_active:!afterGrace,simulation_eligible:eligible};
}
async function context(db,id,lock=false,cycleDate=null){
 const [[settlement]]=await db.execute('SELECT s.*,r.temperature_c,r.weather_mode,r.weather FROM world_settlements s JOIN world_regions r ON r.id=s.region_id WHERE s.id=?'+(lock?' FOR UPDATE':''),[id]);
 if(!settlement)return null;
 const [[profile]]=await db.execute("SELECT *,DATE_FORMAT(last_cycle_date,'%Y-%m-%d') AS last_cycle_date FROM world_civic_profiles WHERE settlement_id=?",[id]);
 const [stock]=await db.execute('SELECT * FROM world_civic_stock WHERE settlement_id=? ORDER BY item_code'+(lock?' FOR UPDATE':''),[id]);
 const [heatingAssets]=await db.execute('SELECT * FROM world_civic_heating_assets WHERE settlement_id=? ORDER BY id',[id]);
 const [upgrades]=await db.execute('SELECT category,status,condition_pct,housing_bonus,defense_bonus,service_bonus FROM world_settlement_upgrades WHERE settlement_id=?',[id]);
 const [history]=await db.execute('SELECT resource_kind,food_group,quantity_delta FROM world_civic_movements WHERE settlement_id=? AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)',[id]);
 const [[cycles]]=await db.execute('SELECT COUNT(*) AS n FROM world_civic_cycles WHERE settlement_id=?',[id]);
 const [[region]]=await db.execute('SELECT * FROM world_regions WHERE id=?',[settlement.region_id]);
 const [climate]=await climateForRegions(db,[region],cycleDate?new Date(cycleDate+'T12:00:00Z'):new Date());
 const tempF=climate.effective_weather.temperature_f;
 return {settlement,heatingAssets,upgrades,region_mode:region.simulation_mode,profile:{...settingsDefault,...profile},stock,history,cycles:Number(cycles.n),temperature_f:tempF};
}
export async function handleCivicNeeds(pool,req,path,actor){
 if(!['domina','high_command'].includes(actor.account_role))return fail(403,'command_required');
 const extras=await handleCivicExtras(pool,req,path,actor);
 if(extras)return extras;
 const match=/^\/world-admin\/civic\/(\d+)(?:\/(profile|stock|transfer|cohorts|preview|run|incidents))?(?:\/(\d+)\/review)?$/.exec(path);
 if(!match)return fail(404,'not_found');
 const id=Number(match[1]),section=match[2]||'overview',reviewId=match[3]?Number(match[3]):null;
 if(!Number.isSafeInteger(id)||id<1)return fail(400,'invalid_settlement');
 if(req.method==='GET'&&section==='overview'){
  const data=await context(pool,id);if(!data)return fail(404,'settlement_not_found');
  const [shared_materials]=await pool.execute('SELECT m.id,m.name,m.category,COALESCE(s.quantity,0) AS quantity FROM fc_materials m LEFT JOIN fc_material_stock s ON s.material_id=m.id ORDER BY m.name');
  const cohorts=simulatedPopulationGroups(data.settlement);
  const worker_health=await workerHealthSnapshot(pool,id);
  const [incidents]=await pool.execute('SELECT * FROM world_civic_incidents WHERE settlement_id=? ORDER BY id DESC LIMIT 50',[id]);
  const [aid_contracts]=await pool.execute('SELECT * FROM world_civic_aid_contracts WHERE settlement_id=? ORDER BY id',[id]);
  const [aid_dispatches]=await pool.execute("SELECT d.*,DATE_FORMAT(d.due_date,'%Y-%m-%d') AS due_date FROM world_civic_aid_dispatches d JOIN world_civic_aid_contracts c ON c.id=d.contract_id WHERE c.settlement_id=? ORDER BY d.due_date DESC LIMIT 50",[id]);
  const [cycles]=await pool.execute('SELECT * FROM world_civic_cycles WHERE settlement_id=? ORDER BY cycle_date DESC LIMIT 18',[id]);
  return ok({profile:data.profile,stock:data.stock,shared_materials,heating_assets:data.heatingAssets,cohorts,worker_health,incidents,aid_contracts,aid_dispatches,cycles,preview:civicSimulationPreview(data.settlement,data.profile,data.stock,data.history,data.temperature_f,data.cycles,data.heatingAssets,data.upgrades),population_simulation:previewPopulationChange(data.settlement,data.upgrades,civicSimulationPreview(data.settlement,data.profile,data.stock,data.history,data.temperature_f,data.cycles,data.heatingAssets,data.upgrades).risk,!!data.settlement.simulation_enabled&&data.region_mode==='managed'&&!data.profile.paused&&['managed','detailed'].includes(data.profile.enabled_mode))});
 }
 if(req.method==='PUT'&&section==='profile'){
  const b=await body(req);
  if(!b||!modes.includes(b.enabled_mode)||typeof b.paused!=='boolean'||!number(b.food_daily_per_resident,0.001,100)||!number(b.heat_daily_per_resident,0.001,100)||!number(b.water_daily_per_resident,0.001,100)||!number(b.medicine_daily_per_resident,0,100)||!integer(b.food_min_days,1,365)||!integer(b.minimum_variety,1,12)||!integer(b.grace_cycles,0,30))return fail(400,'invalid_civic_profile');
  return tx(pool,async db=>{
   const [[s]]=await db.execute('SELECT id FROM world_settlements WHERE id=? FOR UPDATE',[id]);if(!s)return fail(404,'settlement_not_found');
   await db.execute("INSERT INTO world_civic_profiles(settlement_id,food_daily_per_resident,heat_daily_per_resident,water_daily_per_resident,medicine_daily_per_resident,food_min_days,minimum_variety,grace_cycles,enabled_mode,paused) VALUES(?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE food_daily_per_resident=VALUES(food_daily_per_resident),heat_daily_per_resident=VALUES(heat_daily_per_resident),water_daily_per_resident=VALUES(water_daily_per_resident),medicine_daily_per_resident=VALUES(medicine_daily_per_resident),food_min_days=VALUES(food_min_days),minimum_variety=VALUES(minimum_variety),grace_cycles=VALUES(grace_cycles),enabled_mode=VALUES(enabled_mode),paused=VALUES(paused),revision=revision+1",[id,b.food_daily_per_resident,b.heat_daily_per_resident,b.water_daily_per_resident,b.medicine_daily_per_resident,b.food_min_days,b.minimum_variety,b.grace_cycles,b.enabled_mode,b.paused?1:0]);
   await log(db,actor.id,'civic_profile',id,b.enabled_mode);return ok({saved:true});
  });
 }
 if(req.method==='POST'&&section==='stock'){
  const b=await body(req);
  if(!b||!safeText(b.item_code,75)||!/^[a-z0-9][a-z0-9_-]*$/.test(b.item_code)||!safeText(b.item_label,120)||!kinds.includes(b.resource_kind)||!number(b.quantity_delta,-1e9,1e9)||b.quantity_delta===0||!safeText(b.reason,180)||!(b.food_group===null||b.food_group===''||safeText(b.food_group,75))||b.resource_kind==='food'&&!safeText(b.food_group,75))return fail(400,'invalid_civic_stock_movement');
  return tx(pool,async db=>{
   const [[settlement]]=await db.execute('SELECT id FROM world_settlements WHERE id=? FOR UPDATE',[id]);if(!settlement)return fail(404,'settlement_not_found');
   const [[old]]=await db.execute('SELECT * FROM world_civic_stock WHERE settlement_id=? AND item_code=? FOR UPDATE',[id,b.item_code]);
   if(old&&(old.resource_kind!==b.resource_kind||String(old.food_group||'')!==String(b.food_group||'')))return fail(409,'stock_item_classification_conflict');
   const next=Number(old?.quantity||0)+b.quantity_delta;
   if(next<0)return fail(409,'insufficient_civic_stock');
   await db.execute('INSERT INTO world_civic_stock(settlement_id,item_code,item_label,resource_kind,food_group,quantity) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE quantity=VALUES(quantity),item_label=VALUES(item_label)',[id,b.item_code,b.item_label,b.resource_kind,b.food_group||null,next]);
   await db.execute('INSERT INTO world_civic_movements(settlement_id,item_code,resource_kind,food_group,quantity_delta,reason,actor_id) VALUES(?,?,?,?,?,?,?)',[id,b.item_code,b.resource_kind,b.food_group||null,b.quantity_delta,b.reason,actor.id]);
   await log(db,actor.id,'civic_delivery',id,b.item_code);return ok({saved:true,quantity:next});
  });
 }
 if(req.method==='POST'&&section==='transfer'){
  const b=await body(req);
  if(!b||!safeText(b.material_id,48)||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(b.material_id)||!integer(b.quantity,1,1000000)||!kinds.includes(b.resource_kind)||b.resource_kind==='food'&&!safeText(b.food_group,75)||!(b.food_group===null||b.food_group===''||safeText(b.food_group,75))||typeof b.request_key!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.request_key))return fail(400,'invalid_shared_civic_transfer');
  return tx(pool,async db=>{
   const [[old]]=await db.execute('SELECT id FROM world_civic_shared_transfers WHERE request_key=?',[b.request_key]);
   if(old)return ok({saved:true,already_recorded:true});
   const [[settlement]]=await db.execute('SELECT id FROM world_settlements WHERE id=? FOR UPDATE',[id]);if(!settlement)return fail(404,'settlement_not_found');
   const [[material]]=await db.execute('SELECT m.id,m.name,s.quantity FROM fc_materials m JOIN fc_material_stock s ON s.material_id=m.id WHERE m.id=? FOR UPDATE',[b.material_id]);
   if(!material)return fail(404,'shared_material_not_found');
   if(Number(material.quantity)<b.quantity)return fail(409,'insufficient_shared_order_stock');
   const [[classified]]=await db.execute('SELECT * FROM world_civic_stock WHERE settlement_id=? AND item_code=? FOR UPDATE',[id,b.material_id]);
   if(classified&&(classified.resource_kind!==b.resource_kind||String(classified.food_group||'')!==String(b.food_group||'')))return fail(409,'stock_item_classification_conflict');
   await db.execute('UPDATE fc_material_stock SET quantity=quantity-? WHERE material_id=? AND quantity>=?',[b.quantity,b.material_id,b.quantity]);
   await db.execute('INSERT INTO world_civic_stock(settlement_id,item_code,item_label,resource_kind,food_group,quantity) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE quantity=quantity+VALUES(quantity),item_label=VALUES(item_label)',[id,b.material_id,material.name,b.resource_kind,b.resource_kind==='food'?b.food_group:null,b.quantity]);
   await db.execute('INSERT INTO world_civic_shared_transfers(request_key,settlement_id,material_id,quantity,actor_id) VALUES(?,?,?,?,?)',[b.request_key,id,b.material_id,b.quantity,actor.id]);
   await db.execute('INSERT INTO world_civic_movements(settlement_id,item_code,resource_kind,food_group,quantity_delta,reason,actor_id) VALUES(?,?,?,?,?,?,?)',[id,b.material_id,b.resource_kind,b.resource_kind==='food'?b.food_group:null,b.quantity,'Transfer from shared Order workshop stock',actor.id]);
   await log(db,actor.id,'civic_shared_transfer',id,b.material_id+' x'+b.quantity);
   return ok({saved:true,quantity:b.quantity});
  });
 }
 // Population groups are simulation-derived. Manual cohort writes are no longer accepted.
 if(section==='cohorts')return fail(409,'population_groups_are_simulated');
 if(req.method==='POST'&&section==='incidents'){
  const b=await body(req);
  if(!b||!incidentKinds.includes(b.kind)||!safeText(b.title,140)||!safeText(b.detail,4000))return fail(400,'invalid_civic_incident');
  return tx(pool,async db=>{
   const [[s]]=await db.execute('SELECT id FROM world_settlements WHERE id=?',[id]);if(!s)return fail(404,'settlement_not_found');
   const [r]=await db.execute('INSERT INTO world_civic_incidents(settlement_id,kind,title,detail,proposed_by) VALUES(?,?,?,?,?)',[id,b.kind,b.title.trim(),b.detail.trim(),actor.id]);
   await log(db,actor.id,'civic_incident',id,b.kind);return ok({id:r.insertId,status:'proposed'});
  });
 }
 if(req.method==='POST'&&section==='incidents'&&reviewId)return fail(400,'invalid_review');
 if(req.method==='PUT'&&section==='incidents'&&reviewId){
  const b=await body(req);if(!['approved','declined','resolved'].includes(b?.status))return fail(400,'invalid_incident_status');
  return tx(pool,async db=>{
   const [r]=await db.execute("UPDATE world_civic_incidents SET status=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND settlement_id=? AND status IN ('proposed','approved')",[b.status,actor.id,reviewId,id]);
   if(!r.affectedRows)return fail(409,'incident_not_reviewable');
   await log(db,actor.id,'civic_review',id,b.status);return ok({saved:true});
  });
 }
 if(['POST'].includes(req.method)&&['preview','run'].includes(section)){
  const b=await body(req);if(!b||!/^\d{4}-\d{2}-\d{2}$/.test(b.cycle_date)||Number.isNaN(Date.parse(b.cycle_date+'T00:00:00Z')))return fail(400,'invalid_cycle_date');
  const preview=async(db,commit)=>{
   const data=await context(db,id,commit,b.cycle_date);if(!data)return fail(404,'settlement_not_found');
   const report=civicSimulationPreview(data.settlement,data.profile,data.stock,data.history,data.temperature_f,data.cycles,data.heatingAssets,data.upgrades);
   const population=previewPopulationChange(data.settlement,data.upgrades,report.risk,report.simulation_eligible&&!data.profile.paused&&!!data.settlement.simulation_enabled&&data.region_mode==='managed');
   report.population=population;
   if(!commit)return ok({preview:report,committed:false});
   if(!report.simulation_eligible||data.profile.paused||!data.settlement.simulation_enabled||data.region_mode!=='managed')return fail(409,'civic_simulation_not_enabled');
   if(data.profile.last_cycle_date&&b.cycle_date<=String(data.profile.last_cycle_date).slice(0,10))return fail(409,'civic_cycle_out_of_order');
   const [[old]]=await db.execute('SELECT id FROM world_civic_cycles WHERE settlement_id=? AND cycle_date=?',[id,b.cycle_date]);
   if(old)return fail(409,'civic_cycle_already_committed');
   // Consume each category deterministically by item code. Never draw from character/front inventory.
   for(const [kind,needed] of [['food',report.food_used],['fuel',report.fuel_used],['water',report.water_used],['medicine',report.medicine_used]]){
    let remaining=needed;
    for(const item of data.stock.filter(s=>s.resource_kind===kind)){
     const delta=Math.min(remaining,Number(item.quantity));if(delta<=0)continue;remaining-=delta;
     await db.execute('UPDATE world_civic_stock SET quantity=quantity-? WHERE settlement_id=? AND item_code=? AND quantity>=?',[delta,id,item.item_code,delta]);
     await db.execute('INSERT INTO world_civic_movements(settlement_id,item_code,resource_kind,food_group,quantity_delta,reason,cycle_key,actor_id) VALUES(?,?,?,?,?,?,?,?)',[id,item.item_code,kind,item.food_group||null,-delta,'Authorized civilian cycle',b.cycle_date,actor.id]);
    }
   }
   const remainingFoodDays=report.food_need>0?Math.max(0,(report.food_stock-report.food_used)/report.food_need):0;
   const varietyScore=Math.min(100,Math.round(report.food_groups_30d.length/Math.max(1,Number(data.profile.minimum_variety))*100));
   await db.execute('UPDATE world_settlements SET food_days=?,food_variety=?,civil_stability=?,unrest=?,population=? WHERE id=?',[Math.min(99999,remainingFoodDays),varietyScore,report.after_stability,report.after_unrest,population.population_after,id]);
   await db.execute('INSERT INTO world_civic_cycles(settlement_id,cycle_date,mode,food_used,fuel_used,water_used,medicine_used,before_stability,after_stability,before_unrest,after_unrest,report,actor_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,b.cycle_date,data.profile.enabled_mode,report.food_used,report.fuel_used,report.water_used,report.medicine_used,report.before_stability,report.after_stability,report.before_unrest,report.after_unrest,JSON.stringify(report),actor.id]);
   await db.execute('UPDATE world_civic_profiles SET last_cycle_date=? WHERE settlement_id=?',[b.cycle_date,id]);
   await log(db,actor.id,'civic_cycle',id,b.cycle_date);
   return ok({committed:true,preview:report});
  };
  return section==='preview'?preview(pool,false):tx(pool,db=>preview(db,true));
 }
 return fail(404,'not_found');
}
