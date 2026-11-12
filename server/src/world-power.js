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
  const [fresh]=await db.execute('SELECT id,settlement_id,status,condition_pct,rated_output,fuel_units,last_outage_penalty_date FROM world_power_plants ORDER BY id FOR UPDATE');
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
  const condition=local.length?Math.max(...local.map(p=>Number(p.condition_pct))):0;
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
  const [settlements]=await pool.execute('SELECT id,name,population,unrest,civil_stability FROM world_settlements ORDER BY name');
  return ok({plants:snapshot.plants,consumers:snapshot.consumers,settlements,grades:Object.fromEntries(snapshot.grades)});
 }
 if(req.method!=='POST')return fail(405,'method_not_allowed');
 const b=await input(req);
 if(!b)return fail(400,'invalid_request');
 if(path==='/world-admin/power/plants'){
  if(!Number.isSafeInteger(b.settlement_id)||!b.name||typeof b.name!=='string'||b.name.length>140||!finite(b.condition_pct,0,100)||!Number.isInteger(b.condition_pct)||!finite(b.rated_output,1,1000000)||!finite(b.fuel_units,0,1e9)||!finite(b.fuel_per_day,.001,100000)||!['operational','paused','damaged','destroyed'].includes(b.status)||typeof b.model!=='string'||b.model.length>100)return fail(400,'invalid_power_plant');
  const [found]=await pool.execute('SELECT id FROM world_settlements WHERE id=?',[b.settlement_id]);
  if(!found.length)return fail(404,'settlement_not_found');
  const [result]=await pool.execute('INSERT INTO world_power_plants(settlement_id,name,model,condition_pct,rated_output,fuel_units,fuel_per_day,status) VALUES(?,?,?,?,?,?,?,?)',[b.settlement_id,b.name.trim(),b.model.trim(),b.condition_pct,b.rated_output,b.fuel_units,b.fuel_per_day,b.status]);
  return ok({id:result.insertId});
 }
 const edit=/^\/world-admin\/power\/plants\/(\d+)$/.exec(path);
 if(edit){
  if(!finite(b.condition_pct,0,100)||!Number.isInteger(b.condition_pct)||!finite(b.rated_output,1,1e6)||!finite(b.fuel_per_day,.001,1e5)||!['operational','paused','damaged','destroyed'].includes(b.status))return fail(400,'invalid_power_plant');
  await settlePowerGrid(pool);
  const [updated]=await pool.execute('UPDATE world_power_plants SET condition_pct=?,rated_output=?,fuel_per_day=?,status=? WHERE id=?',[b.condition_pct,b.rated_output,b.fuel_per_day,b.status,Number(edit[1])]);
  return updated.affectedRows?ok({saved:true}):fail(404,'plant_not_found');
 }
 const refuel=/^\/world-admin\/power\/plants\/(\d+)\/refuel$/.exec(path);
 if(refuel){
  if(!finite(b.quantity,.001,1e7))return fail(400,'invalid_fuel_quantity');
  await settlePowerGrid(pool);
  // Only a recorded refuel delivery; not a free automated fuel source.
  const [updated]=await pool.execute('UPDATE world_power_plants SET fuel_units=fuel_units+? WHERE id=?',[b.quantity,Number(refuel[1])]);
  return updated.affectedRows?ok({saved:true}):fail(404,'plant_not_found');
 }
 if(path==='/world-admin/power/chamber'){
  if(!(b.settlement_id===null||Number.isSafeInteger(b.settlement_id)))return fail(400,'invalid_settlement');
  if(b.settlement_id!==null){const [found]=await pool.execute('SELECT id FROM world_settlements WHERE id=?',[b.settlement_id]);if(!found.length)return fail(404,'settlement_not_found')}
  await pool.execute("UPDATE world_power_consumers SET settlement_id=? WHERE consumer_key='aetheric-chamber'",[b.settlement_id]);
  return ok({saved:true});
 }
 return fail(404,'not_found');
}
