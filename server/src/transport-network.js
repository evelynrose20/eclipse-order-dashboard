import {validRouteType,validWaypoints} from './garlean-climate.js';
import {splitRoutePoints} from './route-geometry.js';
const fail=(status,error)=>({status,body:{error}}),ok=body=>({status:200,body});
const integer=n=>Number.isSafeInteger(n)&&n>0;
const position=(x,y)=>Number.isFinite(x)&&x>=0&&x<=100&&Number.isFinite(y)&&y>=0&&y<=100;
const nameOk=s=>typeof s==='string'&&s.length<=120;
async function read(req){
 const chunks=[];let size=0;
 for await(const chunk of req){size+=chunk.length;if(size>16000)return null;chunks.push(chunk);}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}
}
async function transaction(pool,fn){
 const db=await pool.getConnection();
 try{
  await db.beginTransaction();
  const result=await fn(db);
  if(result.status===200)await db.commit();else await db.rollback();
  return result;
 }catch(error){await db.rollback().catch(()=>{});throw error}
 finally{db.release()}
}
async function audit(db,actor,action,entity,id,detail=''){
 await db.execute('INSERT INTO world_administration_audit(actor_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',[actor,action,entity,id,String(detail).slice(0,350)]);
}
async function nodesInRegion(db,ids,region){
 if(ids.some(id=>!integer(id)))return [];
 const [rows]=await db.execute('SELECT id,region_id,node_kind,map_x,map_y FROM world_route_nodes WHERE id IN (?,?) AND region_id=?',[ids[0],ids[1],region]);
 return rows;
}
function compatible(node,kind){
 if(node.node_kind==='terminal')return true;
 if(kind==='rail')return node.node_kind==='rail_switch';
 // Route junctions are general land connections, not rail switches.
 if(kind==='skyway'||kind==='waterway')return node.node_kind==='terminal';
 return node.node_kind==='junction';
}
function routeValid(b){
 return b&&integer(b.region_id)&&integer(b.from_node_id)&&integer(b.to_node_id)&&b.from_node_id!==b.to_node_id&&
 validRouteType(b.route_type)&&nameOk(b.route_name)&&validWaypoints(b.waypoints);
}
function nodeValid(b){
 return b&&integer(b.region_id)&&position(b.map_x,b.map_y)&&nameOk(b.name)&&
 ['junction','rail_switch','terminal'].includes(b.node_kind)&&
 (b.settlement_id===undefined||b.settlement_id===null||integer(b.settlement_id));
}
export async function transportNetworkRoute(pool,req,path,actor){
 const matchNode=/^\/world-admin\/transport\/nodes(?:\/(\d+))?$/.exec(path);
 const matchEdge=/^\/world-admin\/transport\/segments(?:\/(\d+))?$/.exec(path);
 const split=/^\/world-admin\/transport\/segments\/(\d+)\/split$/.exec(path);
 if(matchNode&&['POST','PUT','DELETE'].includes(req.method)){
  const id=matchNode[1]?Number(matchNode[1]):null;
  if(req.method==='DELETE'){
   if(!id)return fail(400,'node_id_required');
   return transaction(pool,async db=>{
    const [[used]]=await db.execute('SELECT COUNT(*) AS total FROM world_route_segments WHERE from_node_id=? OR to_node_id=?',[id,id]);
    if(used.total>0)return fail(409,'junction_has_connected_routes');
    const [result]=await db.execute('DELETE FROM world_route_nodes WHERE id=? AND settlement_id IS NULL',[id]);
    if(!result.affectedRows)return fail(404,'junction_not_found_or_settlement_terminal');
    await audit(db,actor,'node_delete','transport_node',id);
    return ok({saved:true});
   });
  }
  if((req.method==='PUT')!==Boolean(id))return fail(400,'invalid_node_action');
  const b=await read(req);
  if(!nodeValid(b))return fail(400,'invalid_transport_node');
  return transaction(pool,async db=>{
   const [r]=await db.execute('SELECT id FROM world_regions WHERE id=?',[b.region_id]);
   if(!r.length)return fail(404,'region_not_found');
   if(b.settlement_id){
    const [sites]=await db.execute('SELECT id FROM world_settlements WHERE id=? AND region_id=?',[b.settlement_id,b.region_id]);
    if(!sites.length)return fail(400,'node_settlement_region_mismatch');
   }
   if(id){
    // Bound settlement nodes follow the settlement map position and can't be
    // changed separately from their canonical settlement record.
    const [result]=await db.execute('UPDATE world_route_nodes SET name=?,node_kind=?,map_x=?,map_y=? WHERE id=? AND region_id=? AND settlement_id IS NULL',[b.name,b.node_kind,b.map_x,b.map_y,id,b.region_id]);
    if(!result.affectedRows)return fail(404,'junction_not_found');
    await audit(db,actor,'node_update','transport_node',id,b.name);
    return ok({saved:true});
   }
   const [result]=await db.execute('INSERT INTO world_route_nodes(region_id,settlement_id,name,node_kind,map_x,map_y,created_by) VALUES(?,?,?,?,?,?,?)',[b.region_id,b.settlement_id??null,b.name,b.node_kind,b.map_x,b.map_y,actor]);
   await audit(db,actor,'node_create','transport_node',result.insertId,b.name);
   return ok({id:result.insertId});
  });
 }
 if(split&&req.method==='POST'){
  const id=Number(split[1]),b=await read(req);
  if(!position(b?.x,b?.y))return fail(400,'invalid_split_location');
  return transaction(pool,async db=>{
   const [routes]=await db.execute('SELECT * FROM world_route_segments WHERE id=? FOR UPDATE',[id]);
   if(!routes.length)return fail(404,'segment_not_found');
   const r=routes[0],nodes=await nodesInRegion(db,[r.from_node_id,r.to_node_id],r.region_id);
   if(nodes.length!==2)return fail(400,'missing_route_endpoint');
   const from=nodes.find(n=>n.id===r.from_node_id),to=nodes.find(n=>n.id===r.to_node_id);
   const bends=typeof r.waypoints==='string'?JSON.parse(r.waypoints):r.waypoints||[];
   const splitData=splitRoutePoints({x:Number(from.map_x),y:Number(from.map_y)},bends,{x:Number(to.map_x),y:Number(to.map_y)},b,8);
   if(!splitData)return fail(400,'split_must_touch_route_interior');
   const [newNode]=await db.execute('INSERT INTO world_route_nodes(region_id,settlement_id,name,node_kind,map_x,map_y,created_by) VALUES(?,NULL,?,?,?, ?,?)',[r.region_id,'',r.route_type==='rail'?'rail_switch':'junction',splitData.junction.x,splitData.junction.y,actor]);
   const jid=newNode.insertId;
   await db.execute('UPDATE world_route_segments SET to_node_id=?,waypoints=? WHERE id=?',[jid,JSON.stringify(splitData.before),id]);
   const [next]=await db.execute('INSERT INTO world_route_segments(region_id,from_node_id,to_node_id,route_type,route_name,waypoints,created_by) VALUES(?,?,?,?,?,?,?)',[r.region_id,jid,r.to_node_id,r.route_type,r.route_name,JSON.stringify(splitData.after),actor]);
   await audit(db,actor,'segment_split','transport_segment',id,'Junction '+jid+' and segment '+next.insertId);
   return ok({junction_id:jid,segment_ids:[id,next.insertId],position:splitData.junction});
  });
 }
 if(matchEdge&&['POST','PUT','DELETE'].includes(req.method)){
  const id=matchEdge[1]?Number(matchEdge[1]):null;
  if(req.method==='DELETE'){
   if(!id)return fail(400,'segment_id_required');
   return transaction(pool,async db=>{
    const [deleted]=await db.execute('DELETE FROM world_route_segments WHERE id=?',[id]);
    if(!deleted.affectedRows)return fail(404,'segment_not_found');
    await audit(db,actor,'segment_delete','transport_segment',id);
    return ok({saved:true});
   });
  }
  if((req.method==='PUT')!==Boolean(id))return fail(400,'invalid_segment_action');
  const b=await read(req);
  if(!routeValid(b))return fail(400,'invalid_transport_segment');
  return transaction(pool,async db=>{
   const nodes=await nodesInRegion(db,[b.from_node_id,b.to_node_id],b.region_id);
   if(nodes.length!==2||nodes.some(n=>!compatible(n,b.route_type)))return fail(400,'segment_endpoint_type_mismatch');
   const values=[b.region_id,b.from_node_id,b.to_node_id,b.route_type,b.route_name.trim(),JSON.stringify(b.waypoints)];
   if(id){
    const [updated]=await db.execute('UPDATE world_route_segments SET region_id=?,from_node_id=?,to_node_id=?,route_type=?,route_name=?,waypoints=? WHERE id=?',[...values,id]);
    if(!updated.affectedRows)return fail(404,'segment_not_found');
    await audit(db,actor,'segment_update','transport_segment',id,b.route_name);
    return ok({saved:true});
   }
   const [created]=await db.execute('INSERT INTO world_route_segments(region_id,from_node_id,to_node_id,route_type,route_name,waypoints,created_by) VALUES(?,?,?,?,?,?,?)',[...values,actor]);
   await audit(db,actor,'segment_create','transport_segment',created.insertId,b.route_name);
   return ok({id:created.insertId});
  });
 }
 return fail(404,'not_found');
}
