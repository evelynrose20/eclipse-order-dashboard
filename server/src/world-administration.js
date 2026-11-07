import {resolveSession} from './auth.js';
import {splitRoutePoints} from './route-geometry.js';
import {effectiveWeather,validMapIcon,validRouteType,validWaypoints} from './garlean-climate.js';

const fail=(status,error)=>({status,body:{error}}),ok=body=>({status:200,body});
const text=(v,max,required=false)=>typeof v==='string'&&v.trim().length<=max&&(!required||v.trim().length>0);
const num=(v,min,max,whole=false)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max&&(!whole||Number.isInteger(v));
const reference=v=>v===null||v===''||v===undefined||typeof v==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v)&&v.length<=45;
async function read(req){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>16000)throw Object.assign(new Error('request_too_large'),{status:413});chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}}
const regionFields=b=>b&&text(b.name,120,true)&&text(b.description,8000)&&text(b.climate,80,true)&&text(b.weather,80,true)&&num(b.temperature_c,-100,100)&&['off','narrative','managed'].includes(b.simulation_mode)&&['manual','garlean_seasonal'].includes(b.weather_mode)&&text(b.map_background_url,1500)&&(!b.map_background_url||(()=>{try{const u=new URL(b.map_background_url);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}})());
const settlementFields=b=>b&&num(b.region_id,1,Number.MAX_SAFE_INTEGER,true)&&text(b.name,140,true)&&text(b.description,8000)&&['peaceful','secure','contested','occupied','liberated','rebuilding','abandoned','destroyed'].includes(b.strategic_state)&&['directory_faction_id','governing_faction_id','controlling_faction_id','supporting_faction_id'].every(k=>reference(b[k]))&&['map_x','map_y'].every(k=>num(b[k],0,100))&&['population','workforce'].every(k=>num(b[k],0,10000000,true))&&b.workforce<=b.population&&num(b.food_days,0,99999)&&['food_variety','heating_coverage','insulation','housing','medical_access','food_access','security_score','civil_stability','unrest','weather_exposure'].every(k=>num(b[k],0,100,true))&&typeof b.simulation_enabled==='boolean'&&validMapIcon(b.map_icon);
const fields=['region_id','name','description','directory_faction_id','governing_faction_id','controlling_faction_id','supporting_faction_id','map_x','map_y','map_icon','strategic_state','population','workforce','food_days','food_variety','heating_coverage','insulation','housing','medical_access','food_access','security_score','civil_stability','unrest','weather_exposure','simulation_enabled'];
const regionColumns=['name','description','climate','weather','temperature_c','simulation_mode','map_background_url','weather_mode'];
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
async function worldAdministrationRouteCore(pool,req,path){
 if(!pool)return fail(503,'database_unavailable');
 const actor=await resolveSession(pool,req);
 if(!actor)return fail(401,'not_authenticated');
 const command=['domina','high_command'].includes(actor.account_role);
 if(path==='/world-admin'&&req.method==='GET'){
  const [regions]=await pool.execute('SELECT * FROM world_regions ORDER BY id');
  const now=new Date();
  const effective=regions.map(r=>({...r,effective_weather:effectiveWeather(r,now)}));
  const [settlements]=await pool.execute('SELECT s.* FROM world_settlements s ORDER BY s.region_id,s.id');
  const [routes]=await pool.execute('SELECT id,region_id,from_settlement_id,to_settlement_id,from_junction_id,to_junction_id,route_type,route_name,waypoints FROM world_map_routes ORDER BY id');
  const [mountains]=await pool.execute('SELECT id,region_id,name,points FROM world_map_mountain_ranges ORDER BY id');
  const [junctions]=await pool.execute('SELECT id,region_id,name,junction_type,map_x,map_y FROM world_map_junctions ORDER BY id');
  const [factions]=await pool.execute('SELECT id,name,faction_scope,relationship,public_visible FROM order_factions '+(command?'':'WHERE public_visible=1 ')+'ORDER BY name');
  const allowed=new Set(factions.map(f=>f.id));
  const safe=command?settlements:settlements.filter(s=>!s.directory_faction_id||allowed.has(s.directory_faction_id)).map(s=>({...s,directory_faction_id:s.directory_faction_id&&allowed.has(s.directory_faction_id)?s.directory_faction_id:null,governing_faction_id:allowed.has(s.governing_faction_id)?s.governing_faction_id:null,controlling_faction_id:allowed.has(s.controlling_faction_id)?s.controlling_faction_id:null,supporting_faction_id:allowed.has(s.supporting_faction_id)?s.supporting_faction_id:null}));
  return ok({can_edit:command,regions:effective,settlements:safe.map(s=>({...s,simulation_enabled:!!s.simulation_enabled,outlook:civicOutlook(s,{temperature_c:effective.find(r=>r.id===s.region_id)?.effective_weather.temperature_c})})),routes:routes.filter(r=>(r.from_settlement_id===null||safe.some(s=>s.id===r.from_settlement_id))&&(r.to_settlement_id===null||safe.some(s=>s.id===r.to_settlement_id))).map(r=>({...r,waypoints:typeof r.waypoints==='string'?JSON.parse(r.waypoints):r.waypoints})),junctions:junctions.filter(j=>command||routes.some(r=>r.from_junction_id===j.id||r.to_junction_id===j.id)),mountains:mountains.map(m=>({...m,points:typeof m.points==='string'?JSON.parse(m.points):m.points})),factions});
 }
 if(!command)return fail(403,'command_required');
 let match;
 // Map-only state changes never rewrite the settlement's civilian records.
 if((match=/^\/world-admin\/settlements\/(\d+)\/state$/.exec(path))&&req.method==='POST'){
  const b=await read(req);
  if(!['peaceful','secure','contested','occupied','liberated','rebuilding','abandoned','destroyed'].includes(b?.strategic_state))return fail(400,'invalid_territorial_state');
  return transact(pool,async db=>{
   const [changed]=await db.execute('UPDATE world_settlements SET strategic_state=? WHERE id=?',[b.strategic_state,Number(match[1])]);
   if(!changed.affectedRows)return fail(404,'settlement_not_found');
   await audit(db,actor.id,'territorial_state','settlement',Number(match[1]),b.strategic_state);
   return ok({saved:true});
  });
 }
 // Named mountain ranges are editable geographic annotations, not settlement
 // ownership changes. Only command roles may mutate these records.
 const mountain=/^\/world-admin\/mountains(?:\/(\d+))?$/.exec(path);
 if(mountain&&['POST','PUT','DELETE'].includes(req.method)){
  const mid=mountain[1]?Number(mountain[1]):null;
  if(req.method==='DELETE'){
   if(!mid)return fail(400,'mountain_id_required');
   return transact(pool,async db=>{
    const [r]=await db.execute('DELETE FROM world_map_mountain_ranges WHERE id=?',[mid]);
    if(!r.affectedRows)return fail(404,'mountain_not_found');
    await audit(db,actor.id,'mountain_delete','mountain',mid);
    return ok({saved:true});
   });
  }
  if((req.method==='PUT')!==Boolean(mid))return fail(400,'invalid_mountain_request');
  const b=await read(req);
  if(!num(b?.region_id,1,Number.MAX_SAFE_INTEGER,true)||!text(b?.name,120,true)||!Array.isArray(b?.points)||b.points.length<2||!validWaypoints(b.points))return fail(400,'invalid_mountain_range');
  return transact(pool,async db=>{
   const [region]=await db.execute('SELECT id FROM world_regions WHERE id=?',[b.region_id]);
   if(!region.length)return fail(404,'region_not_found');
   if(mid){
    const [r]=await db.execute('UPDATE world_map_mountain_ranges SET region_id=?,name=?,points=? WHERE id=?',[b.region_id,b.name.trim(),JSON.stringify(b.points),mid]);
    if(!r.affectedRows)return fail(404,'mountain_not_found');
    await audit(db,actor.id,'mountain_edit','mountain',mid,b.name.trim());
    return ok({saved:true});
   }
   const [r]=await db.execute('INSERT INTO world_map_mountain_ranges(region_id,name,points,created_by) VALUES(?,?,?,?)',[b.region_id,b.name.trim(),JSON.stringify(b.points),actor.id]);
   await audit(db,actor.id,'mountain_create','mountain',r.insertId,b.name.trim());
   return ok({id:r.insertId});
  });
 }
 // Small transactional map edits should never overwrite the settlement's
 // concurrently updated civilian/medical/industry fields.
 if((match=/^\/world-admin\/settlements\/(\d+)\/map$/.exec(path))&&['PATCH','POST'].includes(req.method)){
  const b=await read(req);
  if(!num(b?.map_x,0,100)||!num(b?.map_y,0,100)||!validMapIcon(b?.map_icon))return fail(400,'invalid_map_marker');
  return transact(pool,async db=>{
   const [changed]=await db.execute('UPDATE world_settlements SET map_x=?,map_y=?,map_icon=? WHERE id=?',[b.map_x,b.map_y,b.map_icon,Number(match[1])]);
   if(!changed.affectedRows)return fail(404,'settlement_not_found');
   await audit(db,actor.id,'map_position','settlement',Number(match[1]),'Position/icon edited');
   return ok({saved:true});
  });
 }

 // Typed graph endpoints keep settlement ownership independent from roads.
 const endpoint=b=>['from','to'].map(side=>({
  settlement:b[side+'_settlement_id']??null,junction:b[side+'_junction_id']??null
 }));
 const routeFields=b=>b&&num(b.region_id,1,Number.MAX_SAFE_INTEGER,true)&&validRouteType(b.route_type)&&text(b.route_name,120)&&validWaypoints(b.waypoints)&&
  endpoint(b).every(e=>(e.settlement===null)!==(e.junction===null)&&
   (e.settlement===null||num(e.settlement,1,Number.MAX_SAFE_INTEGER,true))&&
   (e.junction===null||num(e.junction,1,Number.MAX_SAFE_INTEGER,true)))&&
  !((b.from_settlement_id??null)===(b.to_settlement_id??null)&&(b.from_junction_id??null)===(b.to_junction_id??null));
 async function routeNodesValid(db,b){
  const e=endpoint(b);if(!e.length)return false;
  for(const side of e){
   if(side.settlement!==null){
    const [rows]=await db.execute('SELECT id FROM world_settlements WHERE id=? AND region_id=?',[side.settlement,b.region_id]);
    if(!rows.length)return false;
   }else{
    const [rows]=await db.execute('SELECT junction_type FROM world_map_junctions WHERE id=? AND region_id=?',[side.junction,b.region_id]);
    if(!rows.length||!['multimodal',b.route_type==='rail'?'rail':'road'].includes(rows[0].junction_type))return false;
   }
  }
  return true;
 }
 const routeColumns=['region_id','from_settlement_id','to_settlement_id','from_junction_id','to_junction_id','route_type','route_name','waypoints'];
 const routeValues=b=>[b.region_id,b.from_settlement_id??null,b.to_settlement_id??null,b.from_junction_id??null,b.to_junction_id??null,b.route_type,b.route_name.trim(),JSON.stringify(b.waypoints)];
 // Junction positions may be independently edited, but deletion refuses any
 // connected route rather than silently destroying transportation history.
 const junctionMatch=/^\/world-admin\/junctions(?:\/(\d+))?$/.exec(path);
 if(junctionMatch&&['POST','PUT','DELETE'].includes(req.method)){
  const id=junctionMatch[1]?Number(junctionMatch[1]):null;
  if(req.method==='DELETE'){
   if(!id)return fail(400,'junction_id_required');
   return transact(pool,async db=>{
    const [[used]]=await db.execute('SELECT COUNT(*) AS total FROM world_map_routes WHERE from_junction_id=? OR to_junction_id=?',[id,id]);
    if(Number(used.total)>0)return fail(409,'junction_has_connected_routes');
    const [removed]=await db.execute('DELETE FROM world_map_junctions WHERE id=?',[id]);
    if(!removed.affectedRows)return fail(404,'junction_not_found');
    await audit(db,actor.id,'junction_delete','junction',id);
    return ok({saved:true});
   });
  }
  if((req.method==='PUT')!==Boolean(id))return fail(400,'invalid_junction_request');
  const b=await read(req);
  if(!num(b?.region_id,1,Number.MAX_SAFE_INTEGER,true)||!num(b?.map_x,0,100)||!num(b?.map_y,0,100)||!text(b?.name,120)||!['road','rail','multimodal'].includes(b?.junction_type))return fail(400,'invalid_junction');
  return transact(pool,async db=>{
   const [regions]=await db.execute('SELECT id FROM world_regions WHERE id=?',[b.region_id]);
   if(!regions.length)return fail(404,'region_not_found');
   if(id){
    const [r]=await db.execute('UPDATE world_map_junctions SET name=?,junction_type=?,map_x=?,map_y=? WHERE id=? AND region_id=?',[b.name.trim(),b.junction_type,b.map_x,b.map_y,id,b.region_id]);
    if(!r.affectedRows)return fail(404,'junction_not_found');
    await audit(db,actor.id,'junction_update','junction',id,b.name.trim());return ok({saved:true});
   }
   const [r]=await db.execute('INSERT INTO world_map_junctions(region_id,name,junction_type,map_x,map_y,created_by) VALUES(?,?,?,?,?,?)',[b.region_id,b.name.trim(),b.junction_type,b.map_x,b.map_y,actor.id]);
   await audit(db,actor.id,'junction_create','junction',r.insertId,b.name.trim());return ok({id:r.insertId});
  });
 }
 // Split a saved road/rail exactly at the requested point, preserving all
 // existing bends on both sides and joining at a persisted graph node.
 if((match=/^\/world-admin\/routes\/(\d+)\/split$/.exec(path))&&req.method==='POST'){
  const id=Number(match[1]),b=await read(req);
  if(!num(b?.x,0,100)||!num(b?.y,0,100))return fail(400,'invalid_split_position');
  return transact(pool,async db=>{
   const [rows]=await db.execute('SELECT * FROM world_map_routes WHERE id=? FOR UPDATE',[id]);
   if(!rows.length)return fail(404,'route_not_found');
   const old=rows[0];
   const pointOf=async side=>{
    const sid=old[side+'_settlement_id'],jid=old[side+'_junction_id'];
    const [nodes]=sid!==null?await db.execute('SELECT map_x,map_y FROM world_settlements WHERE id=?',[sid]):await db.execute('SELECT map_x,map_y FROM world_map_junctions WHERE id=?',[jid]);
    return nodes.length?{x:Number(nodes[0].map_x),y:Number(nodes[0].map_y)}:null;
   };
   const from=await pointOf('from'),to=await pointOf('to');
   const bends=(typeof old.waypoints==='string'?JSON.parse(old.waypoints):old.waypoints||[]).map(p=>({x:Number(p.x),y:Number(p.y)}));
   const split=from&&to?splitRoutePoints(from,bends,to,{x:b.x,y:b.y}):null;
   if(!split)return fail(400,'split_must_touch_interior_of_route');
   const [node]=await db.execute('INSERT INTO world_map_junctions(region_id,name,junction_type,map_x,map_y,created_by) VALUES(?,?,?,?,?,?)',[old.region_id,'',old.route_type==='rail'?'rail':'road',split.junction.x,split.junction.y,actor.id]);
   const jid=node.insertId;
   await db.execute('UPDATE world_map_routes SET to_settlement_id=NULL,to_junction_id=?,waypoints=? WHERE id=?',[jid,JSON.stringify(split.before),id]);
   const [second]=await db.execute('INSERT INTO world_map_routes(region_id,from_settlement_id,to_settlement_id,from_junction_id,to_junction_id,route_type,route_name,waypoints,created_by) VALUES(?,?,?,?,?,?,?,?,?)',[old.region_id,null,old.to_settlement_id,jid,old.to_junction_id,old.route_type,old.route_name,JSON.stringify(split.after),actor.id]);
   await audit(db,actor.id,'junction_split','route',id,'Junction '+jid+'; new segment '+second.insertId);
   return ok({junction_id:jid,route_ids:[id,second.insertId],point:split.junction});
  });
 }
 if(path==='/world-admin/routes'&&req.method==='POST'){
  const b=await read(req);
  if(!routeFields(b))return fail(400,'invalid_route');
  return transact(pool,async db=>{
   if(!await routeNodesValid(db,b))return fail(400,'route_endpoint_mismatch');
   const [r]=await db.execute('INSERT INTO world_map_routes('+routeColumns.join(',')+',created_by) VALUES('+routeColumns.map(()=>'?').join(',')+',?)',[...routeValues(b),actor.id]);
   await audit(db,actor.id,'route_create','route',r.insertId,b.route_name||b.route_type);return ok({id:r.insertId});
  });
 }
 if((match=/^\/world-admin\/routes\/(\d+)$/.exec(path))&&req.method==='PUT'){
  const b=await read(req);
  if(!routeFields(b))return fail(400,'invalid_route');
  return transact(pool,async db=>{
   if(!await routeNodesValid(db,b))return fail(400,'route_endpoint_mismatch');
   const [r]=await db.execute('UPDATE world_map_routes SET '+routeColumns.map(c=>c+'=?').join(',')+' WHERE id=?',[...routeValues(b),Number(match[1])]);
   if(!r.affectedRows)return fail(404,'route_not_found');
   await audit(db,actor.id,'route_update','route',Number(match[1]),b.route_name||b.route_type);return ok({saved:true});
  });
 }
 if((match=/^\/world-admin\/routes\/(\d+)$/.exec(path))&&req.method==='DELETE'){
  return transact(pool,async db=>{
   const [r]=await db.execute('DELETE FROM world_map_routes WHERE id=?',[Number(match[1])]);
   if(!r.affectedRows)return fail(404,'route_not_found');
   await audit(db,actor.id,'route_delete','route',Number(match[1]));return ok({saved:true});
  });
 }
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

 
// Return a recoverable deployment problem instead of treating a missing
// local migration as a generic server failure. Never expose SQL text.
export async function worldAdministrationRoute(pool,req,path){
 try{return await worldAdministrationRouteCore(pool,req,path)}
 catch(error){
  if(['ER_NO_SUCH_TABLE','ER_BAD_FIELD_ERROR'].includes(error?.code)){
   console.error('[World Administration] Required schema is not installed:',error.code,path);
   return fail(503,'world_setup_required');
  }
  throw error;
 }
}
