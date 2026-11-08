import {advanceWorkerHealth,workerHealthSnapshot} from './world-worker-care.js';
import {educationPreview,advanceEducation} from './world-education.js';
import {settlementDemographics,cappedEmployment} from './world-demographics.js';
import {climateForRegions} from './world-region-climate.js';
import {civicSimulationPreview} from './world-civic-needs.js';
import {previewPopulationChange} from './world-population-simulation.js';
import {housingCapacity} from './world-settlement-upgrades.js';

const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Math.round(Number(n)||0)));
const round=n=>Math.round(Math.max(0,Number(n)||0)*1000)/1000;
const dateOf=now=>new Date(now).toISOString().slice(0,10);
export const settlementOwnership=s=>s?.controlling_faction_id==='eclipse-order'?'order':s?.controlling_faction_id?'npc':'unclaimed';
export function simulationCycleKey(now,cadence='normal'){
 const date=new Date(now);
 if(cadence==='fast')return date.toISOString().slice(0,13).replace('T','-').replace(/-\d\d$/,h=>'-'+String(Math.floor(Number(h.slice(1))/6)*6).padStart(2,'0'));
 if(cadence==='slow')return 'slow-'+Math.floor(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate())/86400000/3);
 return dateOf(date);
}
export function npcSupplyCycle(input){
 const population=Math.max(0,Math.floor(Number(input.population)||0));
 const employed=cappedEmployment(input,input.workforce);
 const temperature=Number(input.temperature_f??32);
 const current={food:Number(input.food_units)||0,water:Number(input.water_units)||0,fuel:Number(input.fuel_units)||0,medicine:Number(input.medicine_units)||0};
 if(!population)return {next:current,shortages:[],consumption:{food:0,water:0,fuel:0,medicine:0},production:{food:0,water:0,fuel:0,medicine:0},risk:0};
 const cold=Math.max(0,(55-temperature)/65);
 const effectiveHousing=Math.min(100,Number(input.insulation)||0);
 const consumption={food:round(population*.75),water:round(population),fuel:round(population*.8*cold*(1-effectiveHousing*.005)),medicine:round(population*.01)};
 const production={food:round(population*.46+employed*.8),water:round(population*.72+employed*.75),fuel:round((population*.25+employed*.5)*(cold>.1?1:.45)),medicine:round(population*.008+employed*.007)};
 const next={},shortages=[];
 for(const kind of ['food','water','fuel','medicine']){
  const available=current[kind]+production[kind];
  next[kind]=round(Math.min(population*40,Math.max(0,available-consumption[kind])));
  if(available+0.001<consumption[kind])shortages.push(kind);
 }
 return {next,shortages,consumption,production,risk:clamp(shortages.length*17+Math.max(0,50-Number(input.medical_access||50))*.15)};
}
export function npcProjectChoice(site,openProject){
 if(openProject)return null;
 const vacant=housingCapacity(site,[])-Number(site.population||0);
 if(vacant<=Math.max(2,Math.floor(Number(site.population||0)*.12)))return 'housing';
 if(Number(site.security_score)<55)return 'defenses';
 if(Number(site.medical_access)<60)return 'clinic';
 if(Number(site.food_access)<65)return 'market';
 if(Number(site.housing)<70)return 'waterworks';
 return null;
}
const projectNames={housing:'Residential quarter',defenses:'Perimeter defenses',clinic:'Civic clinic',waterworks:'Waterworks',market:'Market district'};
const projectDuration=kind=>kind==='housing'?100:kind==='defenses'?120:90;
export function npcEverydayStory(site,key,temperature){
 const population=Number(site.population||0);
 if(!population)return {event:'idle',headline:'The uninhabited outpost awaits new settlers'};
 const hash=[...String(key)+String(site.id)].reduce((n,c)=>(n*33+c.charCodeAt(0))%9973,19);
 if(hash%4!==0)return {event:'routine',headline:'Everyday life continued through the settlement'};
 const stories=temperature<25?[
  'Neighbors organized a small winter warming gathering',
  'Local workers cleared snow from community paths',
  'Civic volunteers inspected heating shelters'
 ]:[
  'Local merchants held a modest market day',
  'Residents organized repairs to shared pathways',
  'Apprentices helped maintain local workshops'
 ];
 return {event:'community',headline:stories[hash%stories.length]};
}

async function ensureNpcRows(pool){
 // No seed settlements: only existing, explicitly NPC-controlled sites are eligible.
 await pool.execute(`INSERT IGNORE INTO world_settlement_autosim
 (settlement_id,mode,ownership,cadence,food_units,fuel_units,water_units,medicine_units)
 SELECT s.id,'automatic','npc','normal',s.population*12,s.population*7,s.population*12,s.population*.2
 FROM world_settlements s WHERE s.controlling_faction_id IS NOT NULL AND s.controlling_faction_id<>'eclipse-order'`);
}
async function applyNpcCycle(db,site,state,now,key,weather){
 const pop=Number(site.population),beforeStability=Number(site.civil_stability);
 const outcome=npcSupplyCycle({...site,...state,temperature_f:weather});
 const [upgrades]=await db.execute('SELECT category,status,condition_pct,level FROM world_settlement_upgrades WHERE settlement_id=?',[site.id]); // Completed schools provide education.
 const arrival=previewPopulationChange(site,upgrades,outcome.risk,outcome.risk<75);
 const nextPopulation=arrival.population_after;
 const targetJobs=Math.min(settlementDemographics({...site,population:nextPopulation}).eligible_workers,Math.floor(nextPopulation*.55));
 const beforeJobs=Number(site.workforce);
 const step=targetJobs>beforeJobs?Math.max(1,Math.ceil((targetJobs-beforeJobs)*.18)):-Math.max(1,Math.ceil((beforeJobs-targetJobs)*.18));
 const workforce=cappedEmployment({...site,population:nextPopulation},Math.max(0,beforeJobs===targetJobs?beforeJobs:beforeJobs+step));
 const stability=clamp(beforeStability+(outcome.shortages.length?-2:1)),unrest=clamp(Number(site.unrest)+(outcome.shortages.length?2:-1));
 const [[project]]=await db.execute("SELECT * FROM world_npc_construction WHERE settlement_id=? AND status='building' ORDER BY id LIMIT 1 FOR UPDATE",[site.id]);
 let development=Number(state.development_points)+Math.max(3,workforce*.16);
 const ambient=npcEverydayStory(site,key,weather);
 let event=ambient.event,headline=ambient.headline;
 if(arrival.arrivals){event='arrivals';headline=arrival.arrivals+' new resident'+(arrival.arrivals===1?'':'s')+' settled in '+site.name}
 if(outcome.shortages.length){event='shortage';headline='Residents report '+outcome.shortages.join(', ')+' shortages'}
 let updates={};
 if(project){
  const work=Math.max(6,Math.min(35,Math.round(workforce*.3)+8));
  const progress=Math.min(100,Number(project.progress)+Math.round(work/projectDuration(project.kind)*100));
  if(progress>=100){
   if(project.kind==='housing')updates.housing_capacity=Number(site.housing_capacity)+Math.max(6,Math.round(Math.max(10,pop*.2)));
   if(project.kind==='defenses')updates.security_score=clamp(Number(site.security_score)+9);
   if(project.kind==='clinic')updates.medical_access=clamp(Number(site.medical_access)+8);
   if(project.kind==='market')updates.food_access=clamp(Number(site.food_access)+7);
   if(project.kind==='waterworks')updates.housing=clamp(Number(site.housing)+7);
   await db.execute("UPDATE world_npc_construction SET progress=100,status='completed',finished_on=? WHERE id=?",[dateOf(now),project.id]);
   event='construction';headline=project.name+' completed';development=Math.max(0,development-15);
  }else{
   await db.execute('UPDATE world_npc_construction SET progress=? WHERE id=?',[progress,project.id]);
   if([25,50,75].some(mark=>Number(project.progress)<mark&&progress>=mark)&&event!=='shortage'){event='construction';headline=project.name+' reached '+progress+'% completion'}
  }
 }else{
  const choice=npcProjectChoice(site,null);
  if(choice&&development>=10){
   await db.execute('INSERT INTO world_npc_construction(settlement_id,kind,name,progress,started_on) VALUES(?,?,?,?,?)',[site.id,choice,projectNames[choice],0,dateOf(now)]);
   development-=10;
   if(event==='routine'){event='construction';headline=projectNames[choice]+' construction began'}
  }
 }
 if(arrival.arrivals&&[10,25,50,100,250,500,1000,2500,5000].some(mark=>pop<mark&&nextPopulation>=mark)&&event!=='shortage'){event='milestone';headline=site.name+' reached '+nextPopulation+' residents'}
 const education=await advanceEducation(db,{...site,population:nextPopulation,workforce},upgrades);
 const workerHealth=await advanceWorkerHealth(db,{...site,population:nextPopulation,workforce},upgrades,education,{cycle_key:key,temperature_f:weather,heating_coverage:site.heating_coverage,medicine_available:outcome.next.medicine,weather:weather<=0?'blizzard':'clear'});
 outcome.next.medicine=Math.max(0,round(outcome.next.medicine-workerHealth.medicine_required));
 const report={education,worker_health:workerHealth,origin:'npc',temperature_f:weather,population_before:pop,population_after:nextPopulation,workforce_before:beforeJobs,workforce_after:workforce,arrivals:arrival.arrivals,shortages:outcome.shortages,consumption:outcome.consumption,production:outcome.production,project_event:event,stability_before:beforeStability,stability_after:stability};
 await db.execute('UPDATE world_settlements SET population=?,workforce=?,civil_stability=?,unrest=?,housing_capacity=COALESCE(?,housing_capacity),security_score=COALESCE(?,security_score),medical_access=COALESCE(?,medical_access),food_access=COALESCE(?,food_access),housing=COALESCE(?,housing) WHERE id=?',[nextPopulation,workforce,stability,unrest,updates.housing_capacity??null,updates.security_score??null,updates.medical_access??null,updates.food_access??null,updates.housing??null,site.id]);
 await db.execute('UPDATE world_settlement_autosim SET last_cycle_key=?,food_units=?,water_units=?,fuel_units=?,medicine_units=?,development_points=? WHERE settlement_id=?',[key,outcome.next.food,outcome.next.water,outcome.next.fuel,outcome.next.medicine,round(development),site.id]);
 await db.execute('INSERT INTO world_settlement_sim_history(settlement_id,cycle_key,cycle_date,origin,population_before,population_after,workforce_after,condition_before,condition_after,food_units,water_units,fuel_units,medicine_units,development_points,event_type,headline,report) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[site.id,key,dateOf(now),'npc',pop,nextPopulation,workforce,beforeStability,stability,outcome.next.food,outcome.next.water,outcome.next.fuel,outcome.next.medicine,round(development),event,headline,JSON.stringify(report)]);
 return {settlement_id:site.id,origin:'npc',event,headline};
}
async function advanceOrderStructures(db,site,key){
 const result={advanced:[],completed:[],blocked:[]};
 const workforce=Number(site.workforce||0);
 if(workforce<=0)return result;
 const [structures]=await db.execute("SELECT * FROM world_settlement_upgrades WHERE settlement_id=? AND status='building' ORDER BY id FOR UPDATE",[site.id]);
 for(const item of structures){
  if(Number(item.material_cost)>0&&!item.materials_paid){
   const [[material]]=await db.execute('SELECT quantity FROM fc_material_stock WHERE material_id=? FOR UPDATE',[item.material_id]);
   if(!material||Number(material.quantity)<Number(item.material_cost)){result.blocked.push(item.name+' needs shared materials');continue}
   const [debit]=await db.execute('UPDATE fc_material_stock SET quantity=quantity-? WHERE material_id=? AND quantity>=?',[item.material_cost,item.material_id,item.material_cost]);
   if(debit.affectedRows!==1){result.blocked.push(item.name+' needs shared materials');continue}
   await db.execute('INSERT INTO world_settlement_upgrade_material_receipts(upgrade_id,material_id,quantity,cycle_key) VALUES(?,?,?,?)',[item.id,item.material_id,item.material_cost,key]);
   await db.execute('UPDATE world_settlement_upgrades SET materials_paid=1 WHERE id=?',[item.id]);
  }
  const work=Math.min(35,Math.max(3,Math.round(workforce/(5*Math.max(1,Number(item.level))))+5));
  const progress=Math.min(100,Number(item.construction_progress||0)+work);
  const done=progress>=100;
  await db.execute('UPDATE world_settlement_upgrades SET construction_progress=?,status=? WHERE id=?',[progress,done?'operational':'building',item.id]);
  (done?result.completed:result.advanced).push({name:item.name,progress,work});
 }
 return result;
}
async function applyOrderCycle(db,site,state,now,key,temperature){
 const [[profile]]=await db.execute("SELECT *,DATE_FORMAT(last_cycle_date,'%Y-%m-%d') AS last_cycle_date FROM world_civic_profiles WHERE settlement_id=?",[site.id]);
 if(!profile||profile.paused||!['managed','detailed'].includes(profile.enabled_mode)||!site.simulation_enabled||site.simulation_mode!=='managed')return null;
 const cycleDate=dateOf(now);
 if(profile.last_cycle_date&&profile.last_cycle_date>=cycleDate)return null;
 const [[previous]]=await db.execute('SELECT id FROM world_civic_cycles WHERE settlement_id=? AND cycle_date=?',[site.id,cycleDate]);
 if(previous)return null;
 const [stock]=await db.execute('SELECT * FROM world_civic_stock WHERE settlement_id=? ORDER BY item_code FOR UPDATE',[site.id]);
 const [heater]=await db.execute('SELECT * FROM world_civic_heating_assets WHERE settlement_id=?',[site.id]);
 const [upgrades]=await db.execute('SELECT * FROM world_settlement_upgrades WHERE settlement_id=?',[site.id]);
 const [history]=await db.execute('SELECT resource_kind,food_group,quantity_delta FROM world_civic_movements WHERE settlement_id=? AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)',[site.id]);
 const [[count]]=await db.execute('SELECT COUNT(*) AS n FROM world_civic_cycles WHERE settlement_id=?',[site.id]);
 const preview=civicSimulationPreview(site,profile,stock,history,temperature,Number(count.n),heater,upgrades);
 const migration=previewPopulationChange(site,upgrades,preview.risk,true);
 const education=await advanceEducation(db,{...site,population:migration.population_after},upgrades);
 for(const [kind,used] of [['food',preview.food_used],['fuel',preview.fuel_used],['water',preview.water_used],['medicine',preview.medicine_used]]){
  let remaining=round(used);
  for(const item of stock.filter(x=>x.resource_kind===kind)){
   const debit=Math.min(remaining,Number(item.quantity));if(debit<=0)continue;
   const [changed]=await db.execute('UPDATE world_civic_stock SET quantity=quantity-? WHERE settlement_id=? AND item_code=? AND quantity>=?',[debit,site.id,item.item_code,debit]);
   if(changed.affectedRows!==1)throw new Error('civic_stock_concurrent_change');
   await db.execute('INSERT INTO world_civic_movements(settlement_id,item_code,resource_kind,food_group,quantity_delta,reason,cycle_key,actor_id) VALUES(?,?,?,?,?,?,?,NULL)',[site.id,item.item_code,kind,item.food_group||null,-debit,'Automated Order settlement cycle',cycleDate]);
   remaining=round(remaining-debit);
  }
 }
 // Medicine for treating ill or injured workers is separate from routine civilian use.
 const remainingMedicine=Math.max(0,preview.medicine_stock-preview.medicine_used);
 const workerHealth=await advanceWorkerHealth(db,{...site,population:migration.population_after},upgrades,education,{cycle_key:key,temperature_f:temperature,heating_coverage:preview.heating_coverage_effective,medicine_available:remainingMedicine,weather:temperature<=0?'blizzard':'clear'});
 let careMedicine=workerHealth.medicine_required||0;
 if(careMedicine>0){
  const [medicalStocks]=await db.execute("SELECT item_code,quantity FROM world_civic_stock WHERE settlement_id=? AND resource_kind='medicine' AND quantity>0 ORDER BY item_code FOR UPDATE",[site.id]);
  for(const item of medicalStocks){
   if(careMedicine<=0)break;
   const used=Math.min(careMedicine,Number(item.quantity));
   if(!used)continue;
   await db.execute('UPDATE world_civic_stock SET quantity=quantity-? WHERE settlement_id=? AND item_code=? AND quantity>=?',[used,site.id,item.item_code,used]);
   await db.execute('INSERT INTO world_civic_movements(settlement_id,item_code,resource_kind,food_group,quantity_delta,reason,cycle_key,actor_id) VALUES(?,?,?,?,?,?,?,NULL)',[site.id,item.item_code,'medicine',null,-used,'Worker medical treatment',cycleDate]);
   careMedicine-=used;
  }
  if(careMedicine>0)throw new Error('worker_care_medicine_balance_inconsistent');
 }
  const remains=preview.food_need>0?Math.max(0,(preview.food_stock-preview.food_used)/preview.food_need):0;
 const variety=Math.min(100,Math.round(preview.food_groups_30d.length/Math.max(1,Number(profile.minimum_variety))*100));
 await db.execute('UPDATE world_settlements SET population=?,food_days=?,food_variety=?,civil_stability=?,unrest=? WHERE id=?',[migration.population_after,Math.min(99999,remains),variety,preview.after_stability,preview.after_unrest,site.id]);
 await db.execute('INSERT INTO world_civic_cycles(settlement_id,cycle_date,mode,food_used,fuel_used,water_used,medicine_used,before_stability,after_stability,before_unrest,after_unrest,report,actor_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,NULL)',[site.id,cycleDate,profile.enabled_mode,preview.food_used,preview.fuel_used,preview.water_used,preview.medicine_used,preview.before_stability,preview.after_stability,preview.before_unrest,preview.after_unrest,JSON.stringify({...preview,population:migration,education,worker_health:workerHealth,system_generated:true})]);
 await db.execute('UPDATE world_civic_profiles SET last_cycle_date=? WHERE settlement_id=?',[cycleDate,site.id]);
 await db.execute('UPDATE world_settlement_autosim SET last_cycle_key=? WHERE settlement_id=?',[key,site.id]);
 const construction=await advanceOrderStructures(db,site,key);
 const shortage=preview.warnings.filter(w=>w.includes('shortfall')||w.includes('low'));
 const event=shortage.length?'shortage':construction.completed.length?'construction':migration.arrivals?'arrivals':'routine';
 const headline=shortage.length?'Civilian shortages require attention':construction.completed.length?construction.completed[0].name+' completed':migration.arrivals?migration.arrivals+' residents arrived':construction.blocked.length?construction.blocked[0]:'Daily civilian operations completed';
 await db.execute('INSERT INTO world_settlement_sim_history(settlement_id,cycle_key,cycle_date,origin,population_before,population_after,workforce_after,condition_before,condition_after,food_units,water_units,fuel_units,medicine_units,development_points,event_type,headline,report) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[site.id,key,cycleDate,'order',site.population,migration.population_after,site.workforce,preview.before_stability,preview.after_stability,Math.max(0,preview.food_stock-preview.food_used),Math.max(0,preview.water_stock-preview.water_used),Math.max(0,preview.fuel_stock-preview.fuel_used),Math.max(0,preview.medicine_stock-preview.medicine_used),0,event,headline,JSON.stringify({...preview,population:migration,construction,education,worker_health:workerHealth,system_generated:true})]);
 return {settlement_id:site.id,origin:'order',event,headline};
}
export async function runSettlementSimulation(pool,now=new Date()){
 if(!pool)return {processed:0};
 await ensureNpcRows(pool);
 const [sites]=await pool.execute("SELECT s.id FROM world_settlements s JOIN world_regions r ON r.id=s.region_id LEFT JOIN world_civic_profiles p ON p.settlement_id=s.id JOIN world_settlement_autosim a ON a.settlement_id=s.id WHERE a.mode='automatic' AND a.paused=0 AND ((s.controlling_faction_id IS NOT NULL AND s.controlling_faction_id<>'eclipse-order') OR (s.controlling_faction_id='eclipse-order' AND s.simulation_enabled=1 AND r.simulation_mode='managed' AND p.enabled_mode IN ('managed','detailed') AND p.paused=0)) ORDER BY a.last_cycle_key ASC,s.id LIMIT 150");
 const results=[];
 for(const {id} of sites){
  const db=await pool.getConnection();
  try{
   await db.beginTransaction();
   const [[site]]=await db.execute('SELECT s.*,r.simulation_mode,r.weather_mode,r.weather,r.temperature_c FROM world_settlements s JOIN world_regions r ON r.id=s.region_id WHERE s.id=? FOR UPDATE',[id]);
   const [[state]]=await db.execute('SELECT * FROM world_settlement_autosim WHERE settlement_id=? FOR UPDATE',[id]);
   if(!site||!state||state.mode!=='automatic'||state.paused){await db.rollback();continue}
   const ownership=settlementOwnership(site);
   if(ownership==='unclaimed'){await db.rollback();continue}
   if(state.ownership!==ownership){
    // Crossing the Order/NPC ownership boundary always disables automatic updates
    // until a commander explicitly reviews and re-enables the new owner's policy.
    await db.execute("UPDATE world_settlement_autosim SET mode='off',paused=1,ownership=? WHERE settlement_id=?",[ownership,id]);
    await db.commit();continue;
   }
   const cadence=ownership==='order'&&state.cadence==='fast'?'normal':state.cadence;
   const key=simulationCycleKey(now,cadence);
   if(state.last_cycle_key===key){await db.rollback();continue}
   const [weather]=await climateForRegions(db,[{...site,weather_mode:site.weather_mode}],now);
   const temperature=Number(weather.effective_weather.temperature_f);
   const result=ownership==='npc'?await applyNpcCycle(db,site,state,now,key,temperature):await applyOrderCycle(db,site,state,now,key,temperature);
   if(!result){await db.rollback();continue}
   await db.commit();
   results.push(result);
  }catch(error){await db.rollback().catch(()=>{});console.warn('[World simulation] Settlement cycle failed:',id,error?.code||error?.name||'error')}
  finally{db.release()}
 }
 return {processed:results.length,events:results};
}
const command=actor=>['domina','high_command'].includes(actor?.account_role);
async function read(req){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>8000)return null;chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}}
export async function settlementSimulationRoute(pool,req,path,actor){
 if(!command(actor))return {status:403,body:{error:'command_required'}};
 if(path==='/world-admin/simulation'&&req.method==='GET'){
  const [sites]=await pool.execute("SELECT s.id,s.name,s.region_id,s.zone_id,s.controlling_faction_id,s.population,s.workforce,s.housing_capacity,s.security_score,s.medical_access,s.food_access,s.civil_stability,s.unrest,s.simulation_enabled,r.name AS region_name,r.simulation_mode,a.mode,a.ownership AS state_ownership,a.cadence,a.paused,a.last_cycle_key,a.food_units,a.fuel_units,a.water_units,a.medicine_units,a.development_points FROM world_settlements s JOIN world_regions r ON r.id=s.region_id LEFT JOIN world_settlement_autosim a ON a.settlement_id=s.id ORDER BY s.name");
  const [healthStates]=await pool.execute('SELECT settlement_id,sick_workers,injured_workers FROM world_settlement_worker_health');
  const [educationStates]=await pool.execute('SELECT settlement_id,attainment FROM world_settlement_education');
  const [schools]=await pool.execute("SELECT settlement_id,category,status,condition_pct,level FROM world_settlement_upgrades WHERE category='school'");
  const [projects]=await pool.execute("SELECT id,settlement_id,kind,name,status,progress,DATE_FORMAT(started_on,'%Y-%m-%d') AS started_on,DATE_FORMAT(finished_on,'%Y-%m-%d') AS finished_on FROM world_npc_construction ORDER BY id DESC");
  const [history]=await pool.execute("SELECT id,settlement_id,cycle_key,DATE_FORMAT(cycle_date,'%Y-%m-%d') AS cycle_date,origin,population_before,population_after,workforce_after,condition_before,condition_after,food_units,water_units,fuel_units,medicine_units,development_points,event_type,headline FROM world_settlement_sim_history ORDER BY id DESC LIMIT 300");
  return {status:200,body:{settlements:sites.map(s=>({...s,demographics:settlementDemographics(s),worker_health:healthStates.find(x=>Number(x.settlement_id)===Number(s.id))||{sick_workers:0,injured_workers:0},education:educationPreview(s,schools.filter(x=>Number(x.settlement_id)===Number(s.id)),educationStates.find(x=>Number(x.settlement_id)===Number(s.id))||{}),ownership:settlementOwnership(s),mode:s.state_ownership&&s.state_ownership!==settlementOwnership(s)?'off':s.mode||(settlementOwnership(s)==='npc'?'automatic':'off'),cadence:s.cadence||'normal',paused:!!s.paused,projects:projects.filter(p=>p.settlement_id===s.id),history:history.filter(h=>h.settlement_id===s.id).slice(0,25)}))}};
 }
 const match=/^\/world-admin\/simulation\/(\d+)\/settings$/.exec(path);
 if(match&&req.method==='PUT'){
  const b=await read(req),id=Number(match[1]);
  if(!b||!['off','automatic'].includes(b.mode)||!['slow','normal','fast'].includes(b.cadence)||typeof b.paused!=='boolean')return {status:400,body:{error:'invalid_simulation_settings'}};
  const db=await pool.getConnection();
  try{
   await db.beginTransaction();
   const [[site]]=await db.execute('SELECT id,population,controlling_faction_id FROM world_settlements WHERE id=? FOR UPDATE',[id]);
   if(!site)return await rollbackResponse(db,404,'settlement_not_found');
   const ownership=settlementOwnership(site);
   if(ownership==='unclaimed'&&b.mode==='automatic')return await rollbackResponse(db,409,'unclaimed_settlement_cannot_auto_simulate');
   if(ownership==='order'&&b.cadence==='fast')return await rollbackResponse(db,409,'order_cycles_are_daily_at_most');
   await db.execute("INSERT INTO world_settlement_autosim(settlement_id,mode,ownership,cadence,paused,food_units,fuel_units,water_units,medicine_units) VALUES(?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE mode=VALUES(mode),ownership=VALUES(ownership),cadence=VALUES(cadence),paused=VALUES(paused)",[id,b.mode,ownership==='order'?'order':'npc',b.cadence,b.paused?1:0,ownership==='npc'?site.population*12:0,ownership==='npc'?site.population*7:0,ownership==='npc'?site.population*12:0,ownership==='npc'?site.population*.2:0]);
   await db.execute('INSERT INTO world_administration_audit(actor_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',[actor.id,'simulation_policy','settlement',id,b.mode+' '+b.cadence+(b.paused?' paused':'')]);
   await db.commit();return {status:200,body:{saved:true}};
  }catch(error){await db.rollback().catch(()=>{});throw error}finally{db.release()}
 }
 return {status:404,body:{error:'not_found'}};
}
async function rollbackResponse(db,status,error){await db.rollback();return {status,body:{error}}}
