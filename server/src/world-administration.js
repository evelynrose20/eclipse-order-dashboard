import {resolveSession} from './auth.js';

const fail=(status,error)=>({status,body:{error}}),ok=body=>({status:200,body});
const text=(v,max,required=false)=>typeof v==='string'&&v.trim().length<=max&&(!required||v.trim().length>0);
const num=(v,min,max,whole=false)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max&&(!whole||Number.isInteger(v));
const reference=v=>v===null||v===''||v===undefined||typeof v==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v)&&v.length<=45;
async function read(req){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>16000)throw Object.assign(new Error('request_too_large'),{status:413});chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}}
const regionFields=b=>b&&text(b.name,120,true)&&text(b.description,8000)&&text(b.climate,80,true)&&text(b.weather,80,true)&&num(b.temperature_c,-100,100)&&['off','narrative','managed'].includes(b.simulation_mode)&&text(b.map_background_url,1500)&&(!b.map_background_url||(()=>{try{const u=new URL(b.map_background_url);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}})());
const settlementFields=b=>b&&num(b.region_id,1,Number.MAX_SAFE_INTEGER,true)&&text(b.name,140,true)&&text(b.description,8000)&&['peaceful','contested','occupied','liberated','rebuilding'].includes(b.strategic_state)&&['directory_faction_id','governing_faction_id','controlling_faction_id','supporting_faction_id'].every(k=>reference(b[k]))&&['map_x','map_y'].every(k=>num(b[k],0,100))&&['population','workforce'].every(k=>num(b[k],0,10000000,true))&&b.workforce<=b.population&&num(b.food_days,0,99999)&&['food_variety','heating_coverage','insulation','housing','medical_access','food_access','security_score','civil_stability','unrest','weather_exposure'].every(k=>num(b[k],0,100,true))&&typeof b.simulation_enabled==='boolean';
const fields=['region_id','name','description','directory_faction_id','governing_faction_id','controlling_faction_id','supporting_faction_id','map_x','map_y','strategic_state','population','workforce','food_days','food_variety','heating_coverage','insulation','housing','medical_access','food_access','security_score','civil_stability','unrest','weather_exposure','simulation_enabled'];
const regionColumns=['name','description','climate','weather','temperature_c','simulation_mode','map_background_url'];
const values=(b,cols)=>cols.map(c=>c.endsWith('_faction_id')?(b[c]||null):c==='simulation_enabled'?(b[c]?1:0):b[c]);
async function audit(db,actor,action,entity,id,detail=''){await db.execute('INSERT INTO world_administration_audit(actor_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',[actor,action,entity,id,detail.slice(0,350)])}
async function transact(pool,fn){const c=await pool.getConnection();try{await c.beginTransaction();const r=await fn(c);if(r.status===200)await c.commit();else await c.rollback();return r}catch(e){await c.rollback().catch(()=>{});throw e}finally{c.release()}}
async function referencesExist(db,b){
 const ids=[...new Set(['directory_faction_id','governing_faction_id','controlling_faction_id','supporting_faction_id'].map(k=>b[k]).filter(Boolean))];
 if(!ids.length)return true;
 const [found]=await db.query('SELECT id FROM order_factions WHERE id IN ('+ids.map(()=>'?').join(',')+')',ids);
 return found.length===ids.length;
}
export function civicOutlook(settlement,region){
 const s=settlement||{},cold=Math.max(0,12-Number(region?.temperature_c??15));
 const heatDemand=Math.min(100,Math.round(cold*7*(1+Math.max(0,100-Number(s.insulation??50))/120)));
 const heated=Math.min(100,Number(s.heating_coverage??50));
 const coldStress=Math.max(0,heatDemand-heated);
 const shortage=Math.max(0,14-Number(s.food_days??0))*4;
 const monotony=Math.max(0,55-Number(s.food_variety??50))*0.5;
 const unmet=Math.min(100,Math.round(shortage+coldStress*0.45+monotony+(100-Number(s.food_access??50))*.14+(100-Number(s.medical_access??50))*.08));
 const risk=Math.max(0,Math.min(100,Math.round(unmet*.6+Number(s.unrest??0)*.4)));
 return {heat_demand:heatDemand,cold_stress:Math.round(coldStress),food_pressure:Math.round(shortage),diet_monotony:Math.round(monotony),unmet_needs:unmet,unrest_risk:risk,warning:risk>=65?'elevated':risk>=30?'watch':'stable'};
}
export async function worldAdministrationRoute(pool,req,path){
 if(!pool)return fail(503,'database_unavailable');
 const actor=await resolveSession(pool,req);
 if(!actor)return fail(401,'not_authenticated');
 const command=['domina','high_command'].includes(actor.account_role);
 if(path==='/world-admin'&&req.method==='GET'){
  const [regions]=await pool.execute('SELECT * FROM world_regions ORDER BY id');
  const [settlements]=await pool.execute('SELECT s.* FROM world_settlements s ORDER BY s.region_id,s.id');
  const [factions]=await pool.execute('SELECT id,name,faction_scope,relationship,public_visible FROM order_factions '+(command?'':'WHERE public_visible=1 ')+'ORDER BY name');
  const allowed=new Set(factions.map(f=>f.id));
  const safe=command?settlements:settlements.filter(s=>!s.directory_faction_id||allowed.has(s.directory_faction_id)).map(s=>({...s,directory_faction_id:s.directory_faction_id&&allowed.has(s.directory_faction_id)?s.directory_faction_id:null,governing_faction_id:allowed.has(s.governing_faction_id)?s.governing_faction_id:null,controlling_faction_id:allowed.has(s.controlling_faction_id)?s.controlling_faction_id:null,supporting_faction_id:allowed.has(s.supporting_faction_id)?s.supporting_faction_id:null}));
  return ok({can_edit:command,regions,settlements:safe.map(s=>({...s,simulation_enabled:!!s.simulation_enabled,outlook:civicOutlook(s,regions.find(r=>r.id===s.region_id))})),factions});
 }
 if(!command)return fail(403,'command_required');
 let match;
 if(path==='/world-admin/regions'&&req.method==='POST'){
  const b=await read(req);if(!regionFields(b))return fail(400,'invalid_region');
  return transact(pool,async db=>{const [r]=await db.execute('INSERT INTO world_regions('+regionColumns.join(',')+',created_by) VALUES('+[...regionColumns,'created_by'].map(()=>'?').join(',')+')',[...values(b,regionColumns),actor.id]);await audit(db,actor.id,'create','region',r.insertId,b.name);return ok({id:r.insertId})});
 }
 if((match=/^\/world-admin\/regions\/(\d+)$/.exec(path))&&req.method==='PUT'){
  const b=await read(req);if(!regionFields(b))return fail(400,'invalid_region');
  return transact(pool,async db=>{const [r]=await db.execute('UPDATE world_regions SET '+regionColumns.map(k=>k+'=?').join(',')+' WHERE id=?',[...values(b,regionColumns),Number(match[1])]);if(!r.affectedRows)return fail(404,'region_not_found');await audit(db,actor.id,'update','region',Number(match[1]),b.name);return ok({saved:true})});
 }
 if(path==='/world-admin/settlements'&&req.method==='POST'){
  const b=await read(req);if(!settlementFields(b))return fail(400,'invalid_settlement');
  return transact(pool,async db=>{
   const [reg]=await db.execute('SELECT id FROM world_regions WHERE id=?',[b.region_id]);if(!reg.length)return fail(404,'region_not_found');
   if(!await referencesExist(db,b))return fail(400,'invalid_faction_reference');
   const [r]=await db.execute('INSERT INTO world_settlements('+fields.join(',')+') VALUES('+fields.map(()=>'?').join(',')+')',values(b,fields));await audit(db,actor.id,'create','settlement',r.insertId,b.name);return ok({id:r.insertId});
  });
 }
 if((match=/^\/world-admin\/settlements\/(\d+)$/.exec(path))&&req.method==='PUT'){
  const b=await read(req);if(!settlementFields(b))return fail(400,'invalid_settlement');
  return transact(pool,async db=>{
   const [reg]=await db.execute('SELECT id FROM world_regions WHERE id=?',[b.region_id]);if(!reg.length)return fail(404,'region_not_found');
   if(!await referencesExist(db,b))return fail(400,'invalid_faction_reference');
   const [r]=await db.execute('UPDATE world_settlements SET '+fields.map(k=>k+'=?').join(',')+' WHERE id=?',[...values(b,fields),Number(match[1])]);if(!r.affectedRows)return fail(404,'settlement_not_found');await audit(db,actor.id,'update','settlement',Number(match[1]),b.name);return ok({saved:true});
  });
 }
 return fail(404,'not_found');
}
