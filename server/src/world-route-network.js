// Persistent graph editor: a route is an edge, and a junction is a shared vertex.
// Coordinates are 0-100 map percentages. Splitting and importing are atomic.
import {validRouteType,validWaypoints} from './garlean-climate.js';
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const point=p=>p&&typeof p.x==='number'&&typeof p.y==='number'&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=100&&p.y>=0&&p.y<=100;
const ident=n=>Number.isSafeInteger(n)&&n>0;
const kind=k=>['junction','rail_switch','terminal'].includes(k);
const name=s=>typeof s==='string'&&s.length<=120;
async function body(req){const chunks=[];let n=0;for await(const c of req){n+=c.length;if(n>16000)return null;chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}}
async function tx(pool,fn){const db=await pool.getConnection();try{await db.beginTransaction();const out=await fn(db);if(out.status===200)await db.commit();else await db.rollback();return out}catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}}
async function audit(db,actor,action,id){await db.execute('INSERT INTO world_administration_audit(actor_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',[actor.id,action,'network',id,'Transport network edited'])}
async function nodesIn(db,region,ids){const [a]=await db.execute('SELECT id,region_id,settlement_id,map_x,map_y,node_kind FROM world_route_nodes WHERE region_id=? AND id IN (?,?)',[region,...ids]);return a.length===2?a:null}
async function settlementNode(db,region,settlement,actor){
 const [sites]=await db.execute('SELECT id,map_x,map_y FROM world_settlements WHERE id=? AND region_id=?',[settlement,region]);
 if(sites.length!==1)return null;
 const site=sites[0];
 await db.execute("INSERT INTO world_route_nodes(region_id,settlement_id,name,node_kind,map_x,map_y,created_by) VALUES(?,?,'','terminal',?,?,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)",[region,settlement,site.map_x,site.map_y,actor.id]);
 const [[node]]=await db.execute('SELECT id FROM world_route_nodes WHERE id=LAST_INSERT_ID()');
 return node.id;
}
const projected=(p,a,b)=>{
 const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
 const x=a.x+t*dx,y=a.y+t*dy;return {x:Math.round(x*100)/100,y:Math.round(y*100)/100,d:Math.hypot(p.x-x,p.y-y)};
};
export async function handleTransportGraph(pool,req,path,actor){
 const m=path.match(/^\/world-admin\/network\/(nodes|segments)(?:\/(\d+))?(?:\/(split|remove))?$/);
 if(path==='/world-admin/network/import'&&req.method==='POST'){
  const b=await body(req);if(!ident(b?.region_id))return fail(400,'invalid_region');
  return tx(pool,async db=>{
   const [legacy]=await db.execute('SELECT * FROM world_map_routes WHERE region_id=? ORDER BY id FOR UPDATE',[b.region_id]);
   let count=0;
   for(const r of legacy){
    const from=await settlementNode(db,b.region_id,r.from_settlement_id,actor);
    const to=await settlementNode(db,b.region_id,r.to_settlement_id,actor);
    if(!from||!to)return fail(400,'legacy_route_endpoint_missing');
    await db.execute('INSERT INTO world_route_segments(region_id,from_node_id,to_node_id,route_type,route_name,waypoints,created_by) VALUES(?,?,?,?,?,?,?)',[b.region_id,from,to,r.route_type,r.route_name,typeof r.waypoints==='string'?r.waypoints:JSON.stringify(r.waypoints),actor.id]);
    count++;
   }
   if(count){await db.execute('DELETE FROM world_map_routes WHERE region_id=?',[b.region_id]);await audit(db,actor,'network_import',b.region_id)}
   return ok({imported:count});
  });
 }
 if(!m)return fail(404,'network_route_not_found');
 const table=m[1],id=m[2]?Number(m[2]):null,split=m[3];
 const b=req.method==='DELETE'?null:await body(req);
 if(table==='nodes'&&req.method==='POST'&&!id){
  if(!ident(b?.region_id))return fail(400,'invalid_region');
  if(b.settlement_id!=null&&!ident(b.settlement_id))return fail(400,'invalid_settlement');
  if(b.settlement_id==null&&(!point(b)||!kind(b.node_kind)||!name(b.name||'')))return fail(400,'invalid_node');
  return tx(pool,async db=>{
   const [regions]=await db.execute('SELECT id FROM world_regions WHERE id=?',[b.region_id]);if(!regions.length)return fail(404,'region_not_found');
   if(b.settlement_id!=null){const node=await settlementNode(db,b.region_id,b.settlement_id,actor);return node?ok({id:node}):fail(400,'settlement_outside_region')}
   const [r]=await db.execute('INSERT INTO world_route_nodes(region_id,name,node_kind,map_x,map_y,created_by) VALUES(?,?,?,?,?,?)',[b.region_id,(b.name||'').trim(),b.node_kind,b.x,b.y,actor.id]);
   await audit(db,actor,'network_node_create',r.insertId);return ok({id:r.insertId});
  });
 }
 if(table==='nodes'&&id&&req.method==='PUT'){
  if(!point(b)||!kind(b.node_kind)||!name(b.name||''))return fail(400,'invalid_node');
  return tx(pool,async db=>{
   const [r]=await db.execute('UPDATE world_route_nodes SET map_x=?,map_y=?,node_kind=?,name=? WHERE id=? AND settlement_id IS NULL',[b.x,b.y,b.node_kind,(b.name||'').trim(),id]);
   if(!r.affectedRows)return fail(404,'movable_node_not_found');
   await audit(db,actor,'network_node_edit',id);return ok({saved:true});
  });
 }
 if(table==='nodes'&&id&&split==='remove'&&req.method==='POST'){
  if(b?.delete_connected_segments!==true)return fail(400,'explicit_segment_removal_required');
  return tx(pool,async db=>{
   const [[node]]=await db.execute('SELECT id,settlement_id FROM world_route_nodes WHERE id=? FOR UPDATE',[id]);
   if(!node||node.settlement_id!=null)return fail(404,'junction_not_found');
   const [edges]=await db.execute('SELECT id FROM world_route_segments WHERE from_node_id=? OR to_node_id=? FOR UPDATE',[id,id]);
   await db.execute('DELETE FROM world_route_segments WHERE from_node_id=? OR to_node_id=?',[id,id]);
   const [deleted]=await db.execute('DELETE FROM world_route_nodes WHERE id=? AND settlement_id IS NULL',[id]);
   if(!deleted.affectedRows)return fail(404,'junction_not_found');
   await audit(db,actor,'network_node_remove_with_segments',id);
   return ok({saved:true,deleted_segments:edges.length});
  });
 }
 if(table==='nodes'&&id&&req.method==='DELETE'){
  return tx(pool,async db=>{
   const [edges]=await db.execute('SELECT id FROM world_route_segments WHERE from_node_id=? OR to_node_id=? LIMIT 1',[id,id]);
   if(edges.length)return fail(409,'junction_has_connections');
   const [r]=await db.execute('DELETE FROM world_route_nodes WHERE id=? AND settlement_id IS NULL',[id]);
   if(!r.affectedRows)return fail(404,'junction_not_found');
   await audit(db,actor,'network_node_delete',id);return ok({saved:true});
  });
 }
 if(table==='segments'&&req.method==='POST'&&!id||table==='segments'&&req.method==='PUT'&&id&&!split){
  if(!ident(b?.region_id)||!ident(b?.from_node_id)||!ident(b?.to_node_id)||b.from_node_id===b.to_node_id||!validRouteType(b.route_type)||!name(b.route_name)||!validWaypoints(b.waypoints))return fail(400,'invalid_network_segment');
  return tx(pool,async db=>{
   if(!await nodesIn(db,b.region_id,[b.from_node_id,b.to_node_id]))return fail(400,'nodes_must_share_region');
   if(id){
    const [r]=await db.execute('UPDATE world_route_segments SET from_node_id=?,to_node_id=?,route_type=?,route_name=?,waypoints=? WHERE id=? AND region_id=?',[b.from_node_id,b.to_node_id,b.route_type,b.route_name.trim(),JSON.stringify(b.waypoints),id,b.region_id]);
    if(!r.affectedRows)return fail(404,'segment_not_found');
    await audit(db,actor,'network_segment_edit',id);return ok({saved:true});
   }
   const [r]=await db.execute('INSERT INTO world_route_segments(region_id,from_node_id,to_node_id,route_type,route_name,waypoints,created_by) VALUES(?,?,?,?,?,?,?)',[b.region_id,b.from_node_id,b.to_node_id,b.route_type,b.route_name.trim(),JSON.stringify(b.waypoints),actor.id]);
   await audit(db,actor,'network_segment_create',r.insertId);return ok({id:r.insertId});
  });
 }
 if(table==='segments'&&id&&req.method==='DELETE'&&!split){
  return tx(pool,async db=>{const [r]=await db.execute('DELETE FROM world_route_segments WHERE id=?',[id]);if(!r.affectedRows)return fail(404,'segment_not_found');await audit(db,actor,'network_segment_delete',id);return ok({saved:true})});
 }
 if(table==='segments'&&id&&split&&req.method==='POST'){
  if(!point(b))return fail(400,'invalid_split_point');
  return tx(pool,async db=>{
   const [[edge]]=await db.execute('SELECT * FROM world_route_segments WHERE id=? FOR UPDATE',[id]);
   if(!edge)return fail(404,'segment_not_found');
   const nodes=await nodesIn(db,edge.region_id,[edge.from_node_id,edge.to_node_id]);
   if(!nodes)return fail(409,'segment_nodes_missing');
   const from=nodes.find(n=>n.id===edge.from_node_id),to=nodes.find(n=>n.id===edge.to_node_id);
   const xy=n=>({x:Number(n.map_x),y:Number(n.map_y)});
   const [sites]=await db.execute('SELECT id,map_x,map_y FROM world_settlements WHERE id IN (?,?)',[from.settlement_id||0,to.settlement_id||0]);
   const at=n=>{const s=sites.find(v=>v.id===n.settlement_id);return s?{x:Number(s.map_x),y:Number(s.map_y)}:xy(n)};
   const points=[at(from),...(typeof edge.waypoints==='string'?JSON.parse(edge.waypoints):edge.waypoints),at(to)];
   let best=null;
   for(let i=0;i<points.length-1;i++){const q=projected(b,points[i],points[i+1]);if(!best||q.d<best.d)best={...q,index:i}}
   if(!best||best.d>3)return fail(400,'junction_must_snap_to_route');
   if(Math.hypot(best.x-points[0].x,best.y-points[0].y)<1)return ok({id:from.id,reused:true});
   if(Math.hypot(best.x-points.at(-1).x,best.y-points.at(-1).y)<1)return ok({id:to.id,reused:true});
   const [n]=await db.execute('INSERT INTO world_route_nodes(region_id,name,node_kind,map_x,map_y,created_by) VALUES(?,?,?,?,?,?)',[edge.region_id,'',edge.route_type==='rail'?'rail_switch':'junction',best.x,best.y,actor.id]);
   const left=points.slice(1,best.index+1),right=points.slice(best.index+1,-1);
   await db.execute('UPDATE world_route_segments SET to_node_id=?,waypoints=? WHERE id=?',[n.insertId,JSON.stringify(left),id]);
   await db.execute('INSERT INTO world_route_segments(region_id,from_node_id,to_node_id,route_type,route_name,waypoints,created_by) VALUES(?,?,?,?,?,?,?)',[edge.region_id,n.insertId,edge.to_node_id,edge.route_type,edge.route_name,JSON.stringify(right),actor.id]);
   await audit(db,actor,'network_split',id);return ok({id:n.insertId});
  });
 }
 return fail(405,'method_not_allowed');
}
