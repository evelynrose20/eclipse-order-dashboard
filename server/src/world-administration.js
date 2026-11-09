import {civicTemplateCatalogRoute} from './world-civic-template-projects.js';
import {resolveSession} from './auth.js';
import {industryRoute} from './world-industry.js';
import {settlementSimulationRoute} from './world-settlement-simulation.js';
import {handleCivicNeeds,civicSimulationPreview} from './world-civic-needs.js';
import {handleSettlementUpgrades,upgradeEffects,getSettlementUpgradeRecords,housingCapacity} from './world-settlement-upgrades.js';
import {climateForRegions,handleRegionClimate} from './world-region-climate.js';
import {handleTransportGraph} from './world-route-network.js';
import {handleRailInfrastructure} from './world-rail-infrastructure.js';

import {handleZones,zoneFor,ensureOverviewZone} from './world-zones.js';
import {continentSummary,continentRoute} from './world-continent.js';
import {effectiveWeather,validMapIcon,validRouteType,validWaypoints} from './garlean-climate.js';

const fail=(status,error)=>({status,body:{error}}),ok=body=>({status:200,body});
const text=(v,max,required=false)=>typeof v==='string'&&v.trim().length<=max&&(!required||v.trim().length>0);
const num=(v,min,max,whole=false)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max&&(!whole||Number.isInteger(v));
const reference=v=>v===null||v===''||v===undefined||typeof v==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v)&&v.length<=45;
async function read(req){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>16000)throw Object.assign(new Error('request_too_large'),{status:413});chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}}
const regionFields=b=>b&&text(b.name,120,true)&&text(b.description,8000)&&text(b.climate,80,true)&&text(b.weather,80,true)&&num(b.temperature_c,-100,100)&&['off','narrative','managed'].includes(b.simulation_mode)&&['manual','garlean_seasonal'].includes(b.weather_mode)&&text(b.map_background_url,1500)&&(!b.map_background_url||(()=>{try{const u=new URL(b.map_background_url);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}})());
const settlementFields=b=>b&&(b.zone_id==null||num(b.zone_id,1,Number.MAX_SAFE_INTEGER,true))&&num(b.region_id,1,Number.MAX_SAFE_INTEGER,true)&&text(b.name,140,true)&&text(b.description,8000)&&['peaceful','secure','contested','occupied','liberated','rebuilding','abandoned','destroyed'].includes(b.strategic_state)&&['directory_faction_id','governing_faction_id','controlling_faction_id','supporting_faction_id'].every(k=>reference(b[k]))&&['map_x','map_y'].every(k=>num(b[k],0,100))&&['population','workforce'].every(k=>num(b[k],0,10000000,true))&&b.workforce<=b.population&&num(b.food_days,0,99999)&&['food_variety','heating_coverage','insulation','housing','medical_access','food_access','security_score','civil_stability','unrest','weather_exposure'].every(k=>num(b[k],0,100,true))&&typeof b.simulation_enabled==='boolean'&&validMapIcon(b.map_icon);
const fields=['region_id','zone_id','name','description','directory_faction_id','governing_faction_id','controlling_faction_id','supporting_faction_id','map_x','map_y','map_icon','strategic_state','population','workforce','food_days','food_variety','heating_coverage','insulation','housing','medical_access','food_access','security_score','civil_stability','unrest','weather_exposure','simulation_enabled'];
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
  const effective=await climateForRegions(pool,regions,now);
  const [zones]=await pool.execute('SELECT * FROM world_zones ORDER BY region_id,is_default DESC,id');
  let continent={name:'The Continent',background_url:'',territories:[]};
  try{continent=await continentSummary(pool)}catch(error){if(!['ER_NO_SUCH_TABLE','ER_BAD_FIELD_ERROR'].includes(error?.code))throw error;}
  const [settlements]=await pool.execute('SELECT s.* FROM world_settlements s ORDER BY s.region_id,s.id');
  let industrySites=[];
  if(command)try{
   [industrySites]=await pool.execute('SELECT site.id,site.region_id,site.zone_id,site.name,site.kind,site.map_x,site.map_y,z.controlling_faction_id FROM world_industry_sites site JOIN world_zones z ON z.id=site.zone_id ORDER BY site.id');
  }catch(error){
   // The existing World Administration must remain usable during the
   // additive Windows migration to independent industry sites.
   if(!['ER_NO_SUCH_TABLE','ER_BAD_FIELD_ERROR'].includes(error?.code))throw error;
  }
  const [simulationHistory]=command?await pool.execute('SELECT DISTINCT settlement_id FROM world_settlement_sim_history'):[[]];
  const [upgrades]=await pool.execute('SELECT id,settlement_id,name,category,status,condition_pct,level,housing_bonus,service_bonus,defense_bonus FROM world_settlement_upgrades ORDER BY settlement_id,id');
  const [routes]=await pool.execute('SELECT id,region_id,zone_id,from_settlement_id,to_settlement_id,route_type,route_name,waypoints FROM world_map_routes ORDER BY id');
  const [networkNodes]=await pool.execute('SELECT id,region_id,zone_id,settlement_id,name,node_kind,map_x,map_y FROM world_route_nodes ORDER BY id');
  const [networkSegments]=await pool.execute('SELECT id,region_id,zone_id,from_node_id,to_node_id,route_type,route_name,waypoints FROM world_route_segments ORDER BY id');
  const [mountains]=await pool.execute('SELECT id,region_id,zone_id,name,points FROM world_map_mountain_ranges ORDER BY id');
  const [factions]=await pool.execute('SELECT id,name,faction_scope,relationship,public_visible FROM order_factions '+(command?'':'WHERE public_visible=1 ')+'ORDER BY name');
  // Staff-only civic summary. Return actual civic mode and ledger-based needs
  // instead of the legacy settlement's simulation_enabled flag alone.
  const civicSummaries=new Map();
  if(settlements.length){
   const [profiles]=await pool.execute("SELECT settlement_id,enabled_mode,paused,food_daily_per_resident,heat_daily_per_resident,water_daily_per_resident,medicine_daily_per_resident,food_min_days,minimum_variety,grace_cycles,DATE_FORMAT(last_cycle_date,'%Y-%m-%d') AS last_cycle_date FROM world_civic_profiles");
   const [stock]=await pool.execute("SELECT settlement_id,item_code,resource_kind,food_group,quantity FROM world_civic_stock");
   const [heaters]=await pool.execute("SELECT settlement_id,coverage_pct,condition_pct,status FROM world_civic_heating_assets");
   const [history]=await pool.execute("SELECT settlement_id,resource_kind,food_group,quantity_delta FROM world_civic_movements WHERE created_at>=DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)");
   const [cycleCounts]=await pool.execute("SELECT settlement_id,COUNT(*) AS n FROM world_civic_cycles GROUP BY settlement_id");
   for(const site of settlements){
    const profile=profiles.find(p=>Number(p.settlement_id)===Number(site.id));
    const region=effective.find(r=>Number(r.id)===Number(site.region_id));
    const enabled=!!site.simulation_enabled;
    const improvements=upgrades.filter(u=>Number(u.settlement_id)===Number(site.id));
    const effects=upgradeEffects(improvements);
    const mode=!enabled||region?.simulation_mode==='off'?'off':profile?.paused?'paused':!profile||profile.enabled_mode==='off'?'off':region?.simulation_mode==='narrative'?'narrative':profile.enabled_mode==='narrative'?'narrative':region?.simulation_mode==='managed'?profile.enabled_mode:'off';
    const stores=stock.filter(x=>Number(x.settlement_id)===Number(site.id));
    const preview=civicSimulationPreview(site,profile||{enabled_mode:'off',grace_cycles:2},stores,history.filter(x=>Number(x.settlement_id)===Number(site.id)),Number(region?.effective_weather?.temperature_f??32),Number(cycleCounts.find(x=>Number(x.settlement_id)===Number(site.id))?.n||0),heaters.filter(x=>Number(x.settlement_id)===Number(site.id)),improvements);
    civicSummaries.set(site.id,{
     mode,enabled,configured:!!profile,paused:!!profile?.paused,
     housing_capacity:housingCapacity(site,improvements),upgrade_count:improvements.length,upgrade_effects:effects,
     food_days:preview.food_days,heat_days:preview.heat_days,
     food_stock:preview.food_stock,fuel_stock:preview.fuel_stock,
     water_stock:preview.water_stock,medicine_stock:preview.medicine_stock,
     heating_coverage:preview.heating_coverage_effective,
     unrest_risk:preview.risk,warnings:preview.warnings,
     effective_security:preview.effective_security,effective_medical_access:preview.effective_medical_access,
     last_cycle_date:profile?.last_cycle_date||null,
     has_stock:stores.length>0
    });
   }
  }
  const allowed=new Set(factions.map(f=>f.id));
  const safe=command?settlements:settlements.filter(s=>!s.directory_faction_id||allowed.has(s.directory_faction_id)).map(s=>({...s,directory_faction_id:s.directory_faction_id&&allowed.has(s.directory_faction_id)?s.directory_faction_id:null,governing_faction_id:allowed.has(s.governing_faction_id)?s.governing_faction_id:null,controlling_faction_id:allowed.has(s.controlling_faction_id)?s.controlling_faction_id:null,supporting_faction_id:allowed.has(s.supporting_faction_id)?s.supporting_faction_id:null}));
  return ok({can_edit:command,continent,industry_sites:industrySites,simulated_settlement_ids:simulationHistory.map(x=>Number(x.settlement_id)),regions:effective.map(r=>command?r:{...r,climate_profile:null,weather_events:[],effective_weather:r.effective_weather?.source==='dm_weather_event'?{...r.effective_weather,event_title:undefined}:r.effective_weather}),zones:zones.map(z=>command?z:{...z,governing_faction_id:allowed.has(z.governing_faction_id)?z.governing_faction_id:null,controlling_faction_id:allowed.has(z.controlling_faction_id)?z.controlling_faction_id:null,supporting_faction_id:allowed.has(z.supporting_faction_id)?z.supporting_faction_id:null}),upgrades:upgrades.filter(u=>safe.some(s=>Number(s.id)===Number(u.settlement_id))).map(u=>({id:u.id,settlement_id:u.settlement_id,name:u.name,category:u.category,status:u.status,condition_pct:u.condition_pct,level:u.level})),settlements:safe.map(s=>command?({...s,simulation_enabled:!!s.simulation_enabled,civic_summary:civicSummaries.get(s.id)||null,outlook:civicOutlook(s,{temperature_c:effective.find(r=>r.id===s.region_id)?.effective_weather.temperature_c})}):({id:s.id,region_id:s.region_id,zone_id:s.zone_id,name:s.name,description:s.description,map_x:s.map_x,map_y:s.map_y,map_icon:s.map_icon,strategic_state:s.strategic_state,directory_faction_id:s.directory_faction_id,governing_faction_id:s.governing_faction_id,controlling_faction_id:s.controlling_faction_id,supporting_faction_id:s.supporting_faction_id,population:s.population,civic_summary:(()=>{const c=civicSummaries.get(s.id);return c?{food_days:c.food_days,heat_days:c.heat_days,heating_coverage:c.heating_coverage,water_stock:c.water_stock,medicine_stock:c.medicine_stock,unrest_risk:c.unrest_risk,warnings:c.warnings,has_stock:c.has_stock,housing_capacity:c.housing_capacity,upgrade_count:c.upgrade_count,upgrade_effects:c.upgrade_effects,effective_security:c.effective_security,effective_medical_access:c.effective_medical_access}:null})()})),routes:routes.filter(r=>safe.some(s=>s.id===r.from_settlement_id)&&safe.some(s=>s.id===r.to_settlement_id)).map(r=>({...r,waypoints:typeof r.waypoints==='string'?JSON.parse(r.waypoints):r.waypoints})),network_nodes:networkNodes.filter(n=>!n.settlement_id||safe.some(s=>s.id===n.settlement_id)),network_segments:networkSegments.filter(e=>networkNodes.some(n=>n.id===e.from_node_id&&(!n.settlement_id||safe.some(s=>s.id===n.settlement_id)))&&networkNodes.some(n=>n.id===e.to_node_id&&(!n.settlement_id||safe.some(s=>s.id===n.settlement_id)))).map(e=>({...e,waypoints:typeof e.waypoints==='string'?JSON.parse(e.waypoints):e.waypoints})),mountains:mountains.map(m=>({...m,points:typeof m.points==='string'?JSON.parse(m.points):m.points})),factions});
 }
 if(!command)return fail(403,'command_required');
 if(path==='/world-admin/industry'||path.startsWith('/world-admin/industry/'))return industryRoute(pool,req,path,actor);
 if(path==='/world-admin/simulation'||path.startsWith('/world-admin/simulation/'))return settlementSimulationRoute(pool,req,path,actor);
 const upgradeResponse=await handleSettlementUpgrades(pool,req,path,actor);
 if(upgradeResponse)return upgradeResponse;
 if(path.startsWith('/world-admin/civic/templates'))return civicTemplateCatalogRoute(pool,req,path,actor);
 if(path.startsWith('/world-admin/civic/'))return handleCivicNeeds(pool,req,path,actor);
 if(path.startsWith('/world-admin/climate/'))return handleRegionClimate(pool,req,path,actor);
 if(path.startsWith('/world-admin/continent/'))return continentRoute(pool,req,path,actor);
 if(path.startsWith('/world-admin/zones'))return await handleZones(pool,req,path,actor);
 // Existing staff rail API is retained for backwards compatibility; the map no longer exposes it.
 if(path.startsWith('/world-admin/rail/'))return await handleRailInfrastructure(pool,req,path,actor);
 if(path.startsWith('/world-admin/network/'))return await handleTransportGraph(pool,req,path,actor);
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
   const zoneId=await zoneFor(db,b.region_id,b.zone_id);
   if(!zoneId)return fail(400,'zone_not_in_region');
   if(mid){
    const [r]=await db.execute('UPDATE world_map_mountain_ranges SET region_id=?,zone_id=?,name=?,points=? WHERE id=?',[b.region_id,zoneId,b.name.trim(),JSON.stringify(b.points),mid]);
    if(!r.affectedRows)return fail(404,'mountain_not_found');
    await audit(db,actor.id,'mountain_edit','mountain',mid,b.name.trim());
    return ok({saved:true});
   }
   const [r]=await db.execute('INSERT INTO world_map_mountain_ranges(region_id,zone_id,name,points,created_by) VALUES(?,?,?,?,?)',[b.region_id,zoneId,b.name.trim(),JSON.stringify(b.points),actor.id]);
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
 if(path==='/world-admin/routes'&&req.method==='POST'){
  const b=await read(req);
  if(!num(b?.region_id,1,Number.MAX_SAFE_INTEGER,true)||!num(b?.from_settlement_id,1,Number.MAX_SAFE_INTEGER,true)||!num(b?.to_settlement_id,1,Number.MAX_SAFE_INTEGER,true)||b.from_settlement_id===b.to_settlement_id||!validRouteType(b.route_type)||!text(b.route_name,120)||!validWaypoints(b.waypoints))return fail(400,'invalid_route');
  return transact(pool,async db=>{
   const zoneId=await zoneFor(db,b.region_id,b.zone_id);
   if(!zoneId)return fail(400,'zone_not_in_region');
   const [links]=await db.execute('SELECT id FROM world_settlements WHERE region_id=? AND zone_id=? AND id IN (?,?)',[b.region_id,zoneId,b.from_settlement_id,b.to_settlement_id]);
   if(links.length!==2)return fail(400,'route_requires_two_settlements_in_zone');
   const [r]=await db.execute('INSERT INTO world_map_routes(region_id,zone_id,from_settlement_id,to_settlement_id,route_type,route_name,waypoints,created_by) VALUES(?,?,?,?,?,?,?,?)',[b.region_id,zoneId,b.from_settlement_id,b.to_settlement_id,b.route_type,b.route_name.trim(),JSON.stringify(b.waypoints),actor.id]);
   await audit(db,actor.id,'route_create','route',r.insertId,b.route_name||b.route_type);return ok({id:r.insertId});
  });
 }
 if((match=/^\/world-admin\/routes\/(\d+)$/.exec(path))&&req.method==='PUT'){
  const b=await read(req);
  if(!num(b?.region_id,1,Number.MAX_SAFE_INTEGER,true)||!num(b?.from_settlement_id,1,Number.MAX_SAFE_INTEGER,true)||!num(b?.to_settlement_id,1,Number.MAX_SAFE_INTEGER,true)||b.from_settlement_id===b.to_settlement_id||!validRouteType(b.route_type)||!text(b.route_name,120)||!validWaypoints(b.waypoints))return fail(400,'invalid_route');
  return transact(pool,async db=>{
   const zoneId=await zoneFor(db,b.region_id,b.zone_id);
   if(!zoneId)return fail(400,'zone_not_in_region');
   const [links]=await db.execute('SELECT id FROM world_settlements WHERE region_id=? AND zone_id=? AND id IN (?,?)',[b.region_id,zoneId,b.from_settlement_id,b.to_settlement_id]);
   if(links.length!==2)return fail(400,'route_requires_two_settlements_in_zone');
   const [r]=await db.execute('UPDATE world_map_routes SET region_id=?,zone_id=?,from_settlement_id=?,to_settlement_id=?,route_type=?,route_name=?,waypoints=? WHERE id=?',[b.region_id,zoneId,b.from_settlement_id,b.to_settlement_id,b.route_type,b.route_name.trim(),JSON.stringify(b.waypoints),Number(match[1])]);
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
  return transact(pool,async db=>{const [r]=await db.execute('INSERT INTO world_regions('+regionColumns.join(',')+',created_by) VALUES('+[...regionColumns,'created_by'].map(()=>'?').join(',')+')',[...values(b,regionColumns),actor.id]);const overviewId=await ensureOverviewZone(db,r.insertId,actor.id);await audit(db,actor.id,'create','region',r.insertId,b.name);return ok({id:r.insertId,zone_id:overviewId})});
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
   const zoneId=await zoneFor(db,b.region_id,b.zone_id);
   if(!zoneId)return fail(400,'zone_not_in_region');
   if(b.housing_capacity!==undefined&&(!Number.isInteger(b.housing_capacity)||b.housing_capacity<0||b.housing_capacity>10000000))return fail(400,'invalid_housing_capacity');
   if(b.housing_capacity!==undefined&&b.population>b.housing_capacity)return fail(409,'insufficient_housing_capacity');
   const [r]=await db.execute('INSERT INTO world_settlements('+fields.join(',')+',housing_capacity) VALUES('+fields.map(()=>'?').join(',')+',?)',[...values({...b,zone_id:zoneId},fields),b.housing_capacity??b.population]);await audit(db,actor.id,'create','settlement',r.insertId,b.name);return ok({id:r.insertId});
  });
 }
 if((match=/^\/world-admin\/settlements\/(\d+)$/.exec(path))&&req.method==='PUT'){
  const b=await read(req);if(!settlementFields(b))return fail(400,'invalid_settlement');
  return transact(pool,async db=>{
   const [reg]=await db.execute('SELECT id FROM world_regions WHERE id=?',[b.region_id]);if(!reg.length)return fail(404,'region_not_found');
   if(!await referencesExist(db,b))return fail(400,'invalid_faction_reference');
   const zoneId=await zoneFor(db,b.region_id,b.zone_id);
   if(!zoneId)return fail(400,'zone_not_in_region');
   const [[old]]=await db.execute('SELECT * FROM world_settlements WHERE id=? FOR UPDATE',[Number(match[1])]);
   if(!old)return fail(404,'settlement_not_found');
   if(Number(old.region_id)!==b.region_id)return fail(409,'settlement_cannot_change_region');
   // An autonomous population or civic outcome is not a form field.
   // Staff may set starting conditions when creating a settlement, but
   // cannot overwrite simulated workforce, population, stability or stores.
   const [[history]]=await db.execute('SELECT id FROM world_settlement_sim_history WHERE settlement_id=? LIMIT 1',[Number(match[1])]);
   const autonomous=Boolean(history)||(old.controlling_faction_id&&old.controlling_faction_id!=='eclipse-order')||(b.controlling_faction_id&&b.controlling_faction_id!=='eclipse-order');
   if(autonomous){
    const locked=['population','workforce','food_days','food_variety','heating_coverage','insulation','housing','medical_access','food_access','security_score','civil_stability','unrest','weather_exposure','housing_capacity'];
    if(locked.some(k=>b[k]!==undefined&&Number(b[k])!==Number(old[k])))return fail(409,'simulated_settlement_fields_read_only');
   }

   const baseCapacity=b.housing_capacity===undefined?Number(old.housing_capacity):b.housing_capacity;
   if(!Number.isInteger(baseCapacity)||baseCapacity<0||baseCapacity>10000000)return fail(400,'invalid_housing_capacity');
   const savedUpgrades=await getSettlementUpgradeRecords(db,Number(match[1]),true);
   const capacity=housingCapacity({housing_capacity:baseCapacity},savedUpgrades);
   if(b.population>Number(old.population)&&b.population>capacity)return fail(409,'insufficient_housing_capacity');
   if(baseCapacity<Number(old.housing_capacity)&&capacity<b.population)return fail(409,'housing_capacity_below_residents');
   if(Number(old.zone_id)!==Number(zoneId)){
    const [road]=await db.execute('SELECT id FROM world_map_routes WHERE from_settlement_id=? OR to_settlement_id=? LIMIT 1',[Number(match[1]),Number(match[1])]);
    const [nodes]=await db.execute('SELECT id FROM world_route_nodes WHERE settlement_id=?',[Number(match[1])]);
    if(road.length)return fail(409,'settlement_has_routes_move_requires_detaching');
    if(nodes.length){
     const [joined]=await db.execute('SELECT id FROM world_route_segments WHERE from_node_id=? OR to_node_id=? LIMIT 1',[nodes[0].id,nodes[0].id]);
     if(joined.length)return fail(409,'settlement_has_routes_move_requires_detaching');
     await db.execute('UPDATE world_route_nodes SET zone_id=? WHERE settlement_id=?',[zoneId,Number(match[1])]);
    }
   }
   const [r]=await db.execute('UPDATE world_settlements SET '+fields.map(k=>k+'=?').join(',')+',housing_capacity=? WHERE id=?',[...values({...b,zone_id:zoneId},fields),baseCapacity,Number(match[1])]);if(!r.affectedRows)return fail(404,'settlement_not_found');await audit(db,actor.id,'update','settlement',Number(match[1]),b.name);return ok({saved:true});
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
