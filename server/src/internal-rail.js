import {resolveSession} from './auth.js';

const ok=body=>({status:200,body});
const fail=(status,error)=>({status,body:{error}});
const id=value=>Number.isSafeInteger(Number(value))&&Number(value)>0;
const text=(value,max,required=false)=>typeof value==='string'&&value.length<=max&&(!required||value.trim().length>0);
const allowedType=value=>value==='front'||value==='settlement';
const validStation=b=>b&&text(b.name,140,true)&&allowedType(b.stop_type)&&id(b.stop_id)&&['planned','operational','closed','damaged'].includes(b.status)&&Number.isInteger(Number(b.platforms))&&Number(b.platforms)>=1&&Number(b.platforms)<=100&&text(b.notes,1200);
const stationValues=b=>[b.name.trim(),b.stop_type,Number(b.stop_id),b.status,Number(b.platforms),b.notes||''];
const validRoute=b=>b&&text(b.name,140,true)&&id(b.from_station_id)&&id(b.to_station_id)&&Number(b.from_station_id)!==Number(b.to_station_id)&&Number.isInteger(Number(b.duration_minutes))&&Number(b.duration_minutes)>=1&&Number(b.duration_minutes)<=10080&&['active','paused','retired'].includes(b.status)&&text(b.cargo_notes,1200);
const routeValues=b=>[b.name.trim(),Number(b.from_station_id),Number(b.to_station_id),b.from_type,Number(b.from_id),b.to_type,Number(b.to_id),Number(b.duration_minutes),b.status,b.cargo_notes||''];
async function read(req){let bytes=0;const parts=[];for await(const p of req){bytes+=p.length;if(bytes>16000)return null;parts.push(p)}try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{return null}}
async function tx(pool,fn){const db=await pool.getConnection();try{await db.beginTransaction();const result=await fn(db);if(result.status===200)await db.commit();else await db.rollback();return result}catch(error){await db.rollback().catch(()=>{});throw error}finally{db.release()}}
async function stops(db){
 const [settlements]=await db.execute("SELECT id,name,region_id,zone_id FROM world_settlements WHERE controlling_faction_id='eclipse-order' OR governing_faction_id='eclipse-order' OR directory_faction_id='eclipse-order' ORDER BY name,id");
 const [fronts]=await db.execute("SELECT id,name,location,ownership FROM order_fronts WHERE status='active' ORDER BY name,id");
 return [...settlements.map(s=>({type:'settlement',id:Number(s.id),name:s.name,description:'Order settlement',region_id:s.region_id,zone_id:s.zone_id})),...fronts.map(f=>({type:'front',id:Number(f.id),name:f.name,description:(f.ownership==='member'?'Member-run Order front':'Order front')+' · '+f.location}))];
}
function allowedStop(stops,type,key){return stops.some(s=>s.type===type&&Number(s.id)===Number(key))}
export function journeyProgress(journey,now=new Date()){
 const departure=new Date(journey.departed_at).getTime(),arrival=new Date(journey.expected_arrival_at).getTime(),current=now.getTime();
 const progress=Number.isFinite(departure)&&Number.isFinite(arrival)&&arrival>departure?Math.max(0,Math.min(100,Math.round(100*(current-departure)/(arrival-departure)))):0;
 return {...journey,progress_percent:journey.status==='arrived'?100:journey.status==='running'?progress:Math.min(progress,100),display_status:journey.status==='running'&&current>=arrival?'arrived':journey.status};
}
export async function internalRailRoute(pool,req,path){
 if(!pool)return fail(503,'database_unavailable');
 const actor=await resolveSession(pool,req);
 if(!actor)return fail(401,'not_authenticated');
 if(!['domina','high_command'].includes(actor.account_role))return fail(403,'command_required');
 if(path==='/internal-rail'&&req.method==='GET'){
  // Only journeys actually due are finalized; repeated reads never dispatch twice.
  await pool.execute("UPDATE order_internal_rail_journeys SET status='arrived',completed_at=expected_arrival_at WHERE status='running' AND expected_arrival_at<=UTC_TIMESTAMP(3)");
  const [routes]=await pool.execute('SELECT * FROM order_internal_rail_routes ORDER BY status,id DESC');
  const [journeys]=await pool.execute("SELECT id,route_id,DATE_FORMAT(departed_at,'%Y-%m-%dT%H:%i:%s.%fZ') AS departed_at,DATE_FORMAT(expected_arrival_at,'%Y-%m-%dT%H:%i:%s.%fZ') AS expected_arrival_at,status,notes,dispatched_by,DATE_FORMAT(completed_at,'%Y-%m-%dT%H:%i:%s.%fZ') AS completed_at FROM order_internal_rail_journeys ORDER BY id DESC LIMIT 150");
  const [stations]=await pool.execute('SELECT * FROM order_internal_rail_stations ORDER BY id');
  return ok({server_now:new Date().toISOString(),stops:await stops(pool),stations,routes,journeys:journeys.map(j=>journeyProgress(j))});
 }
 const station=/^\/internal-rail\/stations(?:\/(\d+))?$/.exec(path);
 if(station&&['POST','PUT','DELETE'].includes(req.method)){
  const stationId=station[1]?Number(station[1]):null;
  if(req.method==='POST'&&stationId||req.method!=='POST'&&!stationId)return fail(400,'rail_station_invalid_action');
  const b=req.method==='DELETE'?null:await read(req);
  if(req.method!=='DELETE'&&!validStation(b))return fail(400,'rail_station_invalid_fields');
  return tx(pool,async db=>{
   if(req.method==='DELETE'){
    const [used]=await db.execute('SELECT id FROM order_internal_rail_routes WHERE from_station_id=? OR to_station_id=? LIMIT 1',[stationId,stationId]);
    if(used.length)return fail(409,'rail_station_has_routes');
    const [removed]=await db.execute('DELETE FROM order_internal_rail_stations WHERE id=?',[stationId]);
    return removed.affectedRows?ok({saved:true}):fail(404,'rail_station_not_found');
   }
   const available=await stops(db);
   if(!allowedStop(available,b.stop_type,b.stop_id))return fail(400,'rail_station_order_stop_required');
   if(req.method==='PUT'){
    const [[old]]=await db.execute('SELECT * FROM order_internal_rail_stations WHERE id=? FOR UPDATE',[stationId]);
    if(!old)return fail(404,'rail_station_not_found');
    const [running]=await db.execute("SELECT j.id FROM order_internal_rail_journeys j JOIN order_internal_rail_routes r ON r.id=j.route_id WHERE (r.from_station_id=? OR r.to_station_id=?) AND j.status='running' AND j.expected_arrival_at>UTC_TIMESTAMP(3) LIMIT 1",[stationId,stationId]);
    if(running.length&&b.status!=='operational')return fail(409,'rail_station_has_active_journey');
    if(old.stop_type!==b.stop_type||Number(old.stop_id)!==Number(b.stop_id)){
     const [routes]=await db.execute('SELECT id FROM order_internal_rail_routes WHERE from_station_id=? OR to_station_id=? LIMIT 1',[stationId,stationId]);
     if(routes.length)return fail(409,'rail_station_has_routes');
    }
    await db.execute('UPDATE order_internal_rail_stations SET name=?,stop_type=?,stop_id=?,status=?,platforms=?,notes=? WHERE id=?',[...stationValues(b),stationId]);
    return ok({saved:true});
   }
   const [created]=await db.execute('INSERT INTO order_internal_rail_stations(name,stop_type,stop_id,status,platforms,notes,created_by) VALUES(?,?,?,?,?,?,?)',[...stationValues(b),actor.id]);
   return ok({id:created.insertId});
  });
 }
 const route=/^\/internal-rail\/routes(?:\/(\d+))?$/.exec(path);
 if(route&&['POST','PUT','DELETE'].includes(req.method)){
  const routeId=route[1]?Number(route[1]):null;
  if(req.method==='POST'&&routeId||req.method!=='POST'&&!routeId)return fail(400,'rail_route_invalid_action');
  const b=req.method==='DELETE'?null:await read(req);
  if(req.method!=='DELETE'&&!validRoute(b))return fail(400,'rail_route_invalid_fields');
  return tx(pool,async db=>{
   if(req.method==='DELETE'){
    const [active]=await db.execute("SELECT id FROM order_internal_rail_journeys WHERE route_id=? AND status='running' AND expected_arrival_at>UTC_TIMESTAMP(3) LIMIT 1",[routeId]);
    if(active.length)return fail(409,'rail_route_has_active_journey');
    const [updated]=await db.execute("UPDATE order_internal_rail_routes SET status='retired' WHERE id=?",[routeId]);
    return updated.affectedRows?ok({saved:true}):fail(404,'rail_route_not_found');
   }
   const [stationRows]=await db.execute('SELECT * FROM order_internal_rail_stations WHERE id IN (?,?)',[b.from_station_id,b.to_station_id]);
   if(stationRows.length!==2)return fail(400,'rail_route_station_not_found');
   const origin=stationRows.find(x=>Number(x.id)===Number(b.from_station_id));
   const dest=stationRows.find(x=>Number(x.id)===Number(b.to_station_id));
   if(!origin||!dest||origin.stop_type===dest.stop_type&&Number(origin.stop_id)===Number(dest.stop_id))return fail(400,'rail_route_distinct_stations_required');
   const available=await stops(db);
   if(!allowedStop(available,origin.stop_type,origin.stop_id)||!allowedStop(available,dest.stop_type,dest.stop_id))return fail(400,'rail_route_order_stops_only');
   const complete={...b,from_type:origin.stop_type,from_id:origin.stop_id,to_type:dest.stop_type,to_id:dest.stop_id};
   if(req.method==='PUT'){
    const [[current]]=await db.execute('SELECT * FROM order_internal_rail_routes WHERE id=? FOR UPDATE',[routeId]);
    if(!current)return fail(404,'rail_route_not_found');
    const [running]=await db.execute("SELECT id FROM order_internal_rail_journeys WHERE route_id=? AND status='running' AND expected_arrival_at>UTC_TIMESTAMP(3) LIMIT 1",[routeId]);
    if(running.length)return fail(409,'rail_route_has_active_journey');
    await db.execute('UPDATE order_internal_rail_routes SET name=?,from_station_id=?,to_station_id=?,from_type=?,from_id=?,to_type=?,to_id=?,duration_minutes=?,status=?,cargo_notes=? WHERE id=?',[...routeValues(complete),routeId]);
    return ok({saved:true});
   }
   const [created]=await db.execute('INSERT INTO order_internal_rail_routes(name,from_station_id,to_station_id,from_type,from_id,to_type,to_id,duration_minutes,status,cargo_notes,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[...routeValues(complete),actor.id]);
   return ok({id:created.insertId});
  });
 }
 const dispatch=/^\/internal-rail\/routes\/(\d+)\/dispatch$/.exec(path);
 if(dispatch&&req.method==='POST'){
  return tx(pool,async db=>{
   const routeId=Number(dispatch[1]);
   const [[route]]=await db.execute('SELECT * FROM order_internal_rail_routes WHERE id=? FOR UPDATE',[routeId]);
   if(!route)return fail(404,'rail_route_not_found');
   if(route.status!=='active')return fail(409,'rail_route_not_active');
   const [endpoints]=await db.execute('SELECT id,status FROM order_internal_rail_stations WHERE id IN (?,?)',[route.from_station_id||0,route.to_station_id||0]);
   if(endpoints.length!==2||endpoints.some(st=>st.status!=='operational'))return fail(409,'rail_stations_not_operational');
   const available=await stops(db);
   if(!allowedStop(available,route.from_type,route.from_id)||!allowedStop(available,route.to_type,route.to_id))return fail(409,'rail_route_stop_no_longer_order_owned');
   await db.execute("UPDATE order_internal_rail_journeys SET status='arrived',completed_at=expected_arrival_at WHERE route_id=? AND status='running' AND expected_arrival_at<=UTC_TIMESTAMP(3)",[routeId]);
   const [active]=await db.execute("SELECT id FROM order_internal_rail_journeys WHERE route_id=? AND status='running' LIMIT 1 FOR UPDATE",[routeId]);
   if(active.length)return fail(409,'rail_journey_already_running');
   // Store both times directly from the MySQL UTC clock, avoiding a local-time
   // conversion when a Windows API process uses a non-UTC timezone.
   const [created]=await db.execute('INSERT INTO order_internal_rail_journeys(route_id,departed_at,expected_arrival_at,dispatched_by) VALUES(?,UTC_TIMESTAMP(3),DATE_ADD(UTC_TIMESTAMP(3),INTERVAL ? MINUTE),?)',[routeId,Number(route.duration_minutes),actor.id]);
   return ok({id:created.insertId,dispatched:true});
  });
 }
 const cancel=/^\/internal-rail\/journeys\/(\d+)\/cancel$/.exec(path);
 if(cancel&&req.method==='POST'){
  return tx(pool,async db=>{
   const [updated]=await db.execute("UPDATE order_internal_rail_journeys SET status='cancelled',completed_at=UTC_TIMESTAMP(3) WHERE id=? AND status='running' AND expected_arrival_at>UTC_TIMESTAMP(3)",[Number(cancel[1])]);
   return updated.affectedRows?ok({saved:true}):fail(409,'rail_journey_not_running');
  });
 }
 return fail(404,'rail_action_not_found');
}
