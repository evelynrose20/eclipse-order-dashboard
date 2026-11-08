import {effectiveWeather} from './garlean-climate.js';
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const validF=v=>typeof v==='number'&&Number.isFinite(v)&&v>=-148&&v<=212;
const validCurve=v=>Array.isArray(v)&&v.length===12&&v.every(validF);
const defaults=[9,13,26,39,51,61,67,64,54,40,25,13];
async function input(req){let n=0;const chunks=[];for await(const c of req){n+=c.length;if(n>12000)return null;chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}}
async function audit(db,actor,action,id,detail){await db.execute('INSERT INTO world_administration_audit(actor_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',[actor,action,'region',id,detail.slice(0,350)])}
async function tx(pool,fn){const db=await pool.getConnection();try{await db.beginTransaction();const r=await fn(db);if(r.status===200)await db.commit();else await db.rollback();return r}catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}}
export async function climateForRegions(pool,regions,date=new Date()){
 const [profiles]=await pool.execute('SELECT * FROM world_region_climate_profiles');
 const [events]=await pool.execute('SELECT * FROM world_weather_events WHERE ends_on>=DATE_SUB(UTC_DATE(),INTERVAL 30 DAY) ORDER BY starts_on DESC,id DESC');
 return regions.map(r=>({...r,climate_profile:(()=>{const p=profiles.find(p=>Number(p.region_id)===Number(r.id));return p?{...p,monthly_f:typeof p.monthly_f==='string'?JSON.parse(p.monthly_f):p.monthly_f}:null})(),weather_events:events.filter(e=>Number(e.region_id)===Number(r.id)),effective_weather:null})).map(r=>({...r,effective_weather:effectiveWeather(r,date)}));
}
export async function handleRegionClimate(pool,req,path,actor){
 if(!['domina','high_command'].includes(actor.account_role))return fail(403,'command_required');
 const match=/^\/world-admin\/climate\/(\d+)(?:\/(events))?$/.exec(path);
 if(!match)return fail(404,'not_found');
 const id=Number(match[1]);if(!Number.isSafeInteger(id)||id<1)return fail(400,'invalid_region');
 if(req.method==='GET'&&!match[2]){
  const [[region]]=await pool.execute('SELECT * FROM world_regions WHERE id=?',[id]);if(!region)return fail(404,'region_not_found');
  const [climate]=await climateForRegions(pool,[region]);
  const days=Array.from({length:10},(_,i)=>{const d=new Date();d.setUTCDate(d.getUTCDate()+i);return effectiveWeather(climate,d)});
  return ok({monthly_f:climate.climate_profile?.monthly_f||defaults,daily_variation_f:Number(climate.climate_profile?.daily_variation_f??10),severity_modifier:Number(climate.climate_profile?.severity_modifier??0),events:climate.weather_events,forecast:days});
 }
 if(req.method==='PUT'&&!match[2]){
  const b=await input(req);if(!b||!validCurve(b.monthly_f)||typeof b.daily_variation_f!=='number'||b.daily_variation_f<0||b.daily_variation_f>60||typeof b.severity_modifier!=='number'||b.severity_modifier< -40||b.severity_modifier>40)return fail(400,'invalid_climate_profile');
  return tx(pool,async db=>{
   const [[region]]=await db.execute('SELECT id FROM world_regions WHERE id=? FOR UPDATE',[id]);if(!region)return fail(404,'region_not_found');
   await db.execute('INSERT INTO world_region_climate_profiles(region_id,monthly_f,daily_variation_f,severity_modifier) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE monthly_f=VALUES(monthly_f),daily_variation_f=VALUES(daily_variation_f),severity_modifier=VALUES(severity_modifier)',[id,JSON.stringify(b.monthly_f),b.daily_variation_f,b.severity_modifier]);
   await audit(db,actor.id,'climate_profile',id,'Monthly curve updated');return ok({saved:true});
  });
 }
 if(req.method==='POST'&&match[2]==='events'){
  const b=await input(req);
  if(!b||typeof b.title!=='string'||!b.title.trim()||b.title.length>140||typeof b.weather!=='string'||!b.weather.trim()||b.weather.length>80||!validF(b.temperature_f)||!/^\d{4}-\d{2}-\d{2}$/.test(b.starts_on)||!/^\d{4}-\d{2}-\d{2}$/.test(b.ends_on)||b.ends_on<b.starts_on||Number.isNaN(Date.parse(b.starts_on))||Number.isNaN(Date.parse(b.ends_on)))return fail(400,'invalid_weather_event');
  return tx(pool,async db=>{
   const [[region]]=await db.execute('SELECT id FROM world_regions WHERE id=?',[id]);if(!region)return fail(404,'region_not_found');
   const [r]=await db.execute('INSERT INTO world_weather_events(region_id,title,weather,temperature_f,starts_on,ends_on,created_by) VALUES(?,?,?,?,?,?,?)',[id,b.title.trim(),b.weather.trim(),b.temperature_f,b.starts_on,b.ends_on,actor.id]);
   await audit(db,actor.id,'weather_event',id,b.title);return ok({id:r.insertId});
  });
 }
 return fail(404,'not_found');
}
