import {powerProjectRoute,powerProjectSummary} from './world-power-projects.js';
// Persistent settlement power infrastructure. No free power or fuel creation.
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const sqlUtc=ms=>new Date(ms).toISOString().slice(0,23).replace('T',' ');
const utcMs=s=>Date.parse(String(s).replace(' ','T').replace(/(\.\d+)?$/,(v)=>v||'')+'Z');
async function input(req){
 let s='';for await(const part of req){s+=part;if(s.length>8000)return null}
 try{return JSON.parse(s)}catch{return null}
}
export function powerGrade(output,demand,condition){
 if(output<=0||demand<=0)return 'outage';
 const ratio=output/demand;
 if(condition>=90&&ratio>=1.25)return 'perfect';
 if(condition>=50&&ratio>=.75)return 'good';
 return 'low';
}
export function powerRate(grade){
 if(grade==='perfect')return {amount:.5,interval_ms:25000};
 if(grade==='good')return {amount:.2,interval_ms:30000};
 if(grade==='outage'||grade==='low')return {amount:0,interval_ms:30000};
 return {amount:.1,interval_ms:30000};
}
export async function settlePowerGrid(pool){
 const db=await pool.getConnection();
 try{
  await db.beginTransaction();
  const [plants]=await db.execute("SELECT p.*,DATE_FORMAT(p.last_fuel_at,'%Y-%m-%d %H:%i:%s.%f') AS last_utc FROM world_power_plants p ORDER BY p.id FOR UPDATE");
  const [[clock]]=await db.execute("SELECT DATE_FORMAT(UTC_TIMESTAMP(3),'%Y-%m-%d %H:%i:%s.%f') AS now_utc");
  const now=utcMs(clock.now_utc);
  for(const p of plants){
   const start=utcMs(p.last_utc);
   if(!Number.isFinite(start)||start>now){await db.execute('UPDATE world_power_plants SET last_fuel_at=? WHERE id=?',[sqlUtc(now),p.id]);continue}
   const elapsed=Math.max(0,now-start)/86400000;
   if(elapsed<=0)continue;
   const consuming=['operational','damaged'].includes(p.status)&&Number(p.condition_pct)>0;
   const fuel=Number(p.fuel_units);
   const remaining=consuming?Math.max(0,Math.round((fuel-elapsed*Number(p.fuel_per_day))*1000)/1000):fuel;
   await db.execute('UPDATE world_power_plants SET fuel_units=?,last_fuel_at=? WHERE id=?',[remaining,sqlUtc(now),p.id]);
  }
  const [sites]=await db.execute('SELECT id,population,unrest,civil_stability FROM world_settlements ORDER BY id FOR UPDATE');
  const [fresh]=await db.execute("SELECT id,settlement_id,status,condition_pct,rated_output,fuel_units,DATE_FORMAT(last_outage_penalty_date,'%Y-%m-%d') AS last_outage_penalty_date FROM world_power_plants ORDER BY id FOR UPDATE");
  const day=clock.now_utc.slice(0,10);
  for(const s of sites){
   const local=fresh.filter(p=>Number(p.settlement_id)===Number(s.id));
   if(!local.length||Number(s.population)<=0)continue;
   const output=local.reduce((sum,p)=>sum+(Number(p.fuel_units)>0&&['operational','damaged'].includes(p.status)?Number(p.rated_output)*Number(p.condition_pct)/100:0),0);
   if(output>0)continue;
   // One settlement-wide unrest tick per UTC day after genuine generator outage.
   const eligible=local.some(p=>!p.last_outage_penalty_date||String(p.last_outage_penalty_date).slice(0,10)<day);
   if(!eligible)continue;
   await db.execute('UPDATE world_settlements SET unrest=LEAST(100,unrest+3),civil_stability=GREATEST(0,civil_stability-2) WHERE id=?',[s.id]);
   await db.execute('UPDATE world_power_plants SET last_outage_penalty_date=? WHERE settlement_id=?',[day,s.id]);
  }
  await db.commit();
 }catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}
}
export async function powerSnapshot(pool){
 await settlePowerGrid(pool);
 const [plants]=await pool.execute('SELECT p.*,s.name AS settlement_name FROM world_power_plants p JOIN world_settlements s ON s.id=p.settlement_id ORDER BY s.name,p.id');
 const [consumers]=await pool.execute('SELECT consumer_key,settlement_id,load_units FROM world_power_consumers');
 const [settlements]=await pool.execute('SELECT id,population,name FROM world_settlements');
 const grades=new Map();
 for(const s of settlements){
  const local=plants.filter(p=>Number(p.settlement_id)===Number(s.id));
  const load=50+Number(s.population)/100+consumers.filter(c=>Number(c.settlement_id)===Number(s.id)).reduce((sum,c)=>sum+Number(c.load_units),0);
  const output=local.reduce((sum,p)=>sum+(Number(p.fuel_units)>0&&['operational','damaged'].includes(p.status)?Number(p.rated_output)*Number(p.condition_pct)/100:0),0);
  const operating=local.filter(p=>Number(p.fuel_units)>0&&['operational','damaged'].includes(p.status));
  const condition=operating.length?Math.max(...operating.map(p=>Number(p.condition_pct))):0;
  grades.set(Number(s.id),local.length?powerGrade(output,load,condition):'unconfigured');
 }
 return {plants:plants.map(p=>({...p,fuel_days:Number(p.fuel_per_day)>0?Number(p.fuel_units)/Number(p.fuel_per_day):0,grade:grades.get(Number(p.settlement_id))})),consumers,grades};
}
export async function chamberPower(pool){
 const [[link]]=await pool.execute("SELECT settlement_id FROM world_power_consumers WHERE consumer_key='aetheric-chamber'");
 if(!link?.settlement_id)return {grade:'legacy',settlement_id:null,rate:powerRate('legacy')};
 const snapshot=await powerSnapshot(pool);
 const grade=snapshot.grades.get(Number(link.settlement_id))||'outage';
 return {grade:grade==='unconfigured'?'outage':grade,settlement_id:link.settlement_id,rate:powerRate(grade)};
}
export async function worldPowerRoute(pool,req,path,actor){
 if(!['domina','high_command'].includes(actor.account_role))return fail(403,'command_required');
 if(req.method==='GET'&&path==='/world-admin/power'){
  const snapshot=await powerSnapshot(pool);
  const [settlements]=await pool.execute('SELECT id,name,population,unrest,civil_stability,region_id,zone_id,controlling_faction_id,workforce FROM world_settlements ORDER BY name');
  const projects=await powerProjectSummary(pool);
  return ok({plants:snapshot.plants,consumers:snapshot.consumers,settlements,grades:Object.fromEntries(snapshot.grades),...projects});
 }
 if(req.method!=='POST')return fail(405,'method_not_allowed');
 const b=await input(req);
 if(!b)return fail(400,'invalid_request');
 if(path==='/world-admin/power/projects'||/^\/world-admin\/power\/projects\/\d+\/(commit|advance)$/.test(path))return powerProjectRoute(pool,path,b,actor);
 // Former free-form generator creation and repair endpoints are deliberately retired.
 if(path==='/world-admin/power/plants'||/^\/world-admin\/power\/plants\/\d+$/.test(path))
  return fail(409,'generator_changes_require_blueprint_project');
 const refuel=/^\/world-admin\/power\/plants\/(\d+)\/refuel$/.exec(path);
 if(refuel){
  if(!finite(b.quantity,.001,1e7)||!Number.isSafeInteger(b.facility_id))return fail(400,'fuel_delivery_requires_source_facility');
  await settlePowerGrid(pool);
  const db=await pool.getConnection();
  try{
   await db.beginTransaction();
   const [[plant]]=await db.execute('SELECT * FROM world_power_plants WHERE id=? FOR UPDATE',[Number(refuel[1])]);
   if(!plant){await db.rollback();return fail(404,'plant_not_found')}
   const [[facility]]=await db.execute("SELECT f.id FROM world_industry_facilities f WHERE f.id=? AND f.settlement_id=? AND f.owner_faction_id='eclipse-order' FOR UPDATE",[b.facility_id,plant.settlement_id]);
   if(!facility){await db.rollback();return fail(409,'source_facility_not_at_power_station')}
   const [[stock]]=await db.execute("SELECT quantity FROM world_industry_stock WHERE facility_id=? AND item_id='ceruleum-fuel' FOR UPDATE",[b.facility_id]);
   if(!stock||Number(stock.quantity)<b.quantity){await db.rollback();return fail(409,'insufficient_ceruleum_fuel_at_facility')}
   await db.execute("UPDATE world_industry_stock SET quantity=quantity-? WHERE facility_id=? AND item_id='ceruleum-fuel'",[b.quantity,b.facility_id]);
   await db.execute("INSERT INTO world_industry_ledger(facility_id,item_id,delta,balance_after,action,reference_key,actor_id) VALUES(?,'ceruleum-fuel',?,?,'consume',?,?)",[b.facility_id,-b.quantity,Number(stock.quantity)-b.quantity,'power-plant:'+plant.id,actor.id]);
   await db.execute("UPDATE world_power_plants SET fuel_units=fuel_units+?,status=IF(status='paused' AND condition_pct>0,'operational',status) WHERE id=?",[b.quantity,plant.id]);
   await db.commit();return ok({saved:true});
  }catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}
 }
 if(path==='/world-admin/power/chamber'){
  if(!(b.settlement_id===null||Number.isSafeInteger(b.settlement_id)))return fail(400,'invalid_settlement');
  if(b.settlement_id!==null){const [found]=await pool.execute('SELECT id FROM world_settlements WHERE id=?',[b.settlement_id]);if(!found.length)return fail(404,'settlement_not_found')}
  await pool.execute("UPDATE world_power_consumers SET settlement_id=? WHERE consumer_key='aetheric-chamber'",[b.settlement_id]);
  return ok({saved:true});
 }
 return fail(404,'not_found');
}
