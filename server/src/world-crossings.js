// A crossing pairs two permanent graph nodes across separate zones/regions.
// It is not a teleport: local road/rail segments must reach both endpoint nodes.
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const ident=n=>Number.isSafeInteger(n)&&n>0;
const validPoint=p=>p&&typeof p.x==='number'&&typeof p.y==='number'&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=2&&p.x<=98&&p.y>=2&&p.y<=98&&(p.x<=5||p.x>=95||p.y<=5||p.y>=95);
const types=['road','trail','rail'];
const states=['operational','damaged','closed'];
async function read(req){const chunks=[];let length=0;for await(const c of req){length+=c.length;if(length>10000)return null;chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}}
async function transaction(pool,fn){const db=await pool.getConnection();try{await db.beginTransaction();const out=await fn(db);if(out.status===200)await db.commit();else await db.rollback();return out}catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}}
async function log(db,actor,id,action){await db.execute('INSERT INTO world_administration_audit(actor_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',[actor.id,action,'network',id,'Zone crossing edited'])}
export function crossingEdges(crossings,mode){
 const accepted=mode==='rail'?['rail']:mode==='road'||mode==='pack'?['road','trail']:[];
 return (crossings||[]).filter(c=>c.status==='operational'&&accepted.includes(c.route_type)).map(c=>({id:'crossing:'+c.id,from_node_id:c.from_node_id,to_node_id:c.to_node_id,route_type:c.route_type,travel_minutes:Number(c.travel_minutes)||30}));
}
export async function handleWorldCrossings(pool,req,path,actor){
 const match=/^\/world-admin\/crossings(?:\/(\d+))?$/.exec(path);
 if(!match)return fail(404,'crossing_route_not_found');
 const id=match[1]?Number(match[1]):null;
 if(req.method==='POST'&&!id){
  const b=await read(req);
  if(!b||typeof b.name!=='string'||!b.name.trim()||b.name.length>120||!types.includes(b.route_type)||!ident(b.from_region_id)||!ident(b.from_zone_id)||!ident(b.to_region_id)||!ident(b.to_zone_id)||Number(b.from_zone_id)===Number(b.to_zone_id)||!validPoint(b.from)||!validPoint(b.to)||!Number.isInteger(b.travel_minutes)||b.travel_minutes<1||b.travel_minutes>10080)return fail(400,'invalid_crossing');
  return transaction(pool,async db=>{
   const [zones]=await db.execute('SELECT id,region_id FROM world_zones WHERE id IN (?,?) FOR UPDATE',[b.from_zone_id,b.to_zone_id]);
   if(zones.length!==2||!zones.some(z=>Number(z.id)===b.from_zone_id&&Number(z.region_id)===b.from_region_id)||!zones.some(z=>Number(z.id)===b.to_zone_id&&Number(z.region_id)===b.to_region_id))return fail(400,'crossing_zones_not_found');
   const kind=b.route_type==='rail'?'rail_switch':'junction';
   const label=b.name.trim();
   const [a]=await db.execute('INSERT INTO world_route_nodes(region_id,zone_id,name,node_kind,map_x,map_y,created_by) VALUES(?,?,?,?,?,?,?)',[b.from_region_id,b.from_zone_id,label,kind,b.from.x,b.from.y,actor.id]);
   const [z]=await db.execute('INSERT INTO world_route_nodes(region_id,zone_id,name,node_kind,map_x,map_y,created_by) VALUES(?,?,?,?,?,?,?)',[b.to_region_id,b.to_zone_id,label,kind,b.to.x,b.to.y,actor.id]);
   const [c]=await db.execute('INSERT INTO world_zone_crossings(name,route_type,from_region_id,from_zone_id,from_node_id,to_region_id,to_zone_id,to_node_id,travel_minutes,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)',[label,b.route_type,b.from_region_id,b.from_zone_id,a.insertId,b.to_region_id,b.to_zone_id,z.insertId,b.travel_minutes,actor.id]);
   await log(db,actor,c.insertId,'crossing_create');
   return ok({id:c.insertId,from_node_id:a.insertId,to_node_id:z.insertId});
  });
 }
 if(id&&req.method==='PATCH'){
  const b=await read(req);
  if(!states.includes(b?.status))return fail(400,'invalid_crossing_status');
  return transaction(pool,async db=>{
   const [result]=await db.execute('UPDATE world_zone_crossings SET status=? WHERE id=?',[b.status,id]);
   if(!result.affectedRows)return fail(404,'crossing_not_found');
   await log(db,actor,id,'crossing_status');
   return ok({saved:true});
  });
 }
 if(id&&req.method==='DELETE'){
  return transaction(pool,async db=>{
   const [[c]]=await db.execute('SELECT from_node_id,to_node_id FROM world_zone_crossings WHERE id=? FOR UPDATE',[id]);
   if(!c)return fail(404,'crossing_not_found');
   await db.execute('DELETE FROM world_zone_crossings WHERE id=?',[id]);
   // Preserve route endpoints and segments for future relinking. Unconnected
   // crossing nodes are safe to clear from the map along with the crossing.
   for(const nodeId of [c.from_node_id,c.to_node_id]){
    const [[used]]=await db.execute('SELECT id FROM world_route_segments WHERE from_node_id=? OR to_node_id=? LIMIT 1',[nodeId,nodeId]);
    if(!used)await db.execute('DELETE FROM world_route_nodes WHERE id=? AND settlement_id IS NULL',[nodeId]);
   }
   await log(db,actor,id,'crossing_delete');
   return ok({saved:true});
  });
 }
 return fail(405,'method_not_allowed');
}
