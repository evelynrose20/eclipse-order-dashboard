// Region connections designate borders; only the existing crossing graph carries ground freight.
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const opposite={north:'south',south:'north',east:'west',west:'east'};
export function matchingRegionEdge(from,to,direction){
 const check={north:p=>p.y>=2&&p.y<=5,south:p=>p.y>=95&&p.y<=98,east:p=>p.x>=95&&p.x<=98,west:p=>p.x>=2&&p.x<=5};
 return !!(check[direction]&&check[direction](from)&&check[opposite[direction]](to));
}
export function regionConnectionAllowsBorder(connections,fromRegion,toRegion,fromZone,toZone,from,to){
 return connections.some(c=>{
  if(c.connection_kind!=='ground')return false;
  if(Number(c.from_region_id)===Number(fromRegion)&&Number(c.to_region_id)===Number(toRegion)&&Number(c.from_zone_id)===Number(fromZone)&&Number(c.to_zone_id)===Number(toZone))return matchingRegionEdge(from,to,c.direction);
  if(Number(c.to_region_id)===Number(fromRegion)&&Number(c.from_region_id)===Number(toRegion)&&Number(c.to_zone_id)===Number(fromZone)&&Number(c.from_zone_id)===Number(toZone))return matchingRegionEdge(from,to,opposite[c.direction]);
  return false;
 });
}
async function read(req){let bytes=0,parts=[];for await(const c of req){bytes+=c.length;if(bytes>10000)return null;parts.push(c)}try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{return null}}
async function tx(pool,cb){const db=await pool.getConnection();try{await db.beginTransaction();const result=await cb(db);if(result.status===200)await db.commit();else await db.rollback();return result}catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}}
async function audit(db,actor,id,action){await db.execute('INSERT INTO world_administration_audit(actor_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',[actor.id,action,'region_connection',id,'Regional access connection updated'])}
export async function handleRegionConnections(pool,req,path,actor){
 const m=/^\/world-admin\/region-connections(?:\/(\d+))?$/.exec(path);
 if(!m)return fail(404,'region_connection_route_not_found');
 if(req.method==='POST'&&!m[1]){
  const b=await read(req);
  const validId=v=>Number.isSafeInteger(v)&&v>0;
  if(!b||typeof b.name!=='string'||!b.name.trim()||b.name.length>120||!['ground','airship'].includes(b.connection_kind)||!validId(b.from_region_id)||!validId(b.to_region_id)||!validId(b.from_zone_id)||!validId(b.to_zone_id)||b.from_region_id===b.to_region_id||(b.connection_kind==='ground'&&!opposite[b.direction])||(b.connection_kind==='airship'&&b.direction!=null))return fail(400,'invalid_region_connection');
  return tx(pool,async db=>{
   const [zones]=await db.execute('SELECT id,region_id FROM world_zones WHERE id IN (?,?) FOR UPDATE',[b.from_zone_id,b.to_zone_id]);
   if(zones.length!==2||!zones.some(z=>Number(z.id)===b.from_zone_id&&Number(z.region_id)===b.from_region_id)||!zones.some(z=>Number(z.id)===b.to_zone_id&&Number(z.region_id)===b.to_region_id))return fail(400,'region_connection_zone_mismatch');
   if(b.connection_kind==='ground'){
    const [restricted]=await db.execute("SELECT region_id FROM world_region_access WHERE access_policy='airship_only' AND region_id IN (?,?)",[b.from_region_id,b.to_region_id]);
    if(restricted.length)return fail(409,'airship_only_region_no_ground_border');
   }
   const [dup]=await db.execute('SELECT id FROM world_region_connections WHERE (from_zone_id=? AND to_zone_id=?) OR (from_zone_id=? AND to_zone_id=?) LIMIT 1',[b.from_zone_id,b.to_zone_id,b.to_zone_id,b.from_zone_id]);
   if(dup.length)return fail(409,'region_connection_already_exists');
   const [created]=await db.execute('INSERT INTO world_region_connections(name,from_region_id,from_zone_id,to_region_id,to_zone_id,connection_kind,direction,created_by) VALUES(?,?,?,?,?,?,?,?)',[b.name.trim(),b.from_region_id,b.from_zone_id,b.to_region_id,b.to_zone_id,b.connection_kind,b.connection_kind==='ground'?b.direction:null,actor.id]);
   await audit(db,actor,created.insertId,'region_connection_create');
   return ok({id:created.insertId});
  });
 }
 if(req.method==='DELETE'&&m[1]){
  const id=Number(m[1]);
  return tx(pool,async db=>{
   const [[existing]]=await db.execute('SELECT * FROM world_region_connections WHERE id=? FOR UPDATE',[id]);
   if(!existing)return fail(404,'region_connection_not_found');
   if(existing.connection_kind==='ground'){
    const [used]=await db.execute('SELECT id FROM world_zone_crossings WHERE (from_zone_id=? AND to_zone_id=?) OR (from_zone_id=? AND to_zone_id=?) LIMIT 1',[existing.from_zone_id,existing.to_zone_id,existing.to_zone_id,existing.from_zone_id]);
    if(used.length)return fail(409,'remove_map_crossings_before_region_connection');
   }
   await db.execute('DELETE FROM world_region_connections WHERE id=?',[id]);await audit(db,actor,id,'region_connection_delete');return ok({saved:true});
  });
 }
 return fail(405,'method_not_allowed');
}
