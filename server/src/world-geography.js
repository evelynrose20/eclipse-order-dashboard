// Directional zone placement is independent from map marker positions and territory polygons.
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const validId=x=>Number.isSafeInteger(Number(x))&&Number(x)>0;
const vector={north:[0,-1],south:[0,1],west:[-1,0],east:[1,0]};
const opposite={north:'south',south:'north',west:'east',east:'west'};
export function zoneDirection(a,b){
 if(!Number.isInteger(Number(a?.grid_x))||!Number.isInteger(Number(a?.grid_y))||a?.grid_x==null||a?.grid_y==null||b?.grid_x==null||b?.grid_y==null)return null;
 const x=Number(b.grid_x)-Number(a.grid_x),y=Number(b.grid_y)-Number(a.grid_y);
 return Object.keys(vector).find(dir=>vector[dir][0]===x&&vector[dir][1]===y)||null;
}
export function validCardinalCrossing(from,to,a,b){
 const direction=zoneDirection(a,b);
 if(!direction)return false;
 const edge={north:p=>p.y>=2&&p.y<=5,south:p=>p.y>=95&&p.y<=98,west:p=>p.x>=2&&p.x<=5,east:p=>p.x>=95&&p.x<=98};
 return edge[direction](from)&&edge[opposite[direction]](to);
}
async function body(req){const chunks=[];let n=0;for await(const c of req){n+=c.length;if(n>10000)return null;chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}}
async function tx(pool,fn){const db=await pool.getConnection();try{await db.beginTransaction();const out=await fn(db);if(out.status===200)await db.commit();else await db.rollback();return out}catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}}
async function audit(db,actor,id,action){await db.execute('INSERT INTO world_administration_audit(actor_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',[actor.id,action,'zone',id,'Directional geography updated'])}
export async function worldGeographyRoute(pool,req,path,actor){
 const zone=/^\/world-admin\/geography\/zones\/(\d+)\/place$/.exec(path);
 if(zone&&req.method==='POST'){
  const zoneId=Number(zone[1]),b=await body(req);
  const anchorId=Number(b?.anchor_zone_id);
  if(!validId(zoneId)||!b||!(b.anchor_zone_id==null||validId(anchorId))||(b.anchor_zone_id!=null&&!vector[b.direction]))return fail(400,'invalid_zone_placement');
  return tx(pool,async db=>{
   const [[target]]=await db.execute('SELECT id,region_id,is_default,grid_x,grid_y FROM world_zones WHERE id=? FOR UPDATE',[zoneId]);
   if(!target||target.is_default)return fail(404,'placeable_zone_not_found');
   const [placed]=await db.execute('SELECT id,grid_x,grid_y FROM world_zones WHERE region_id=? AND grid_x IS NOT NULL FOR UPDATE',[target.region_id]);
   let x=0,y=0;
   if(b.anchor_zone_id!=null){
    if(Number(anchorId)===zoneId)return fail(400,'cannot_anchor_zone_to_itself');
    const anchor=placed.find(z=>Number(z.id)===anchorId);
    if(!anchor)return fail(409,'anchor_zone_not_positioned');
    x=Number(anchor.grid_x)+vector[b.direction][0];y=Number(anchor.grid_y)+vector[b.direction][1];
   }else if(placed.some(z=>Number(z.id)!==zoneId))return fail(409,'choose_adjacent_zone');
   if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||Math.abs(x)>100||Math.abs(y)>100)return fail(400,'zone_grid_out_of_range');
   if(placed.some(z=>Number(z.id)!==zoneId&&Number(z.grid_x)===x&&Number(z.grid_y)===y))return fail(409,'zone_grid_position_taken');
   // A zone with saved crossings cannot be moved without breaking geographic directions.
   const [[connected]]=await db.execute('SELECT id FROM world_zone_crossings WHERE (from_zone_id=? OR to_zone_id=?) LIMIT 1',[zoneId,zoneId]);
   if(connected&&(Number(target.grid_x)!==x||Number(target.grid_y)!==y))return fail(409,'zone_has_crossings');
   await db.execute('UPDATE world_zones SET grid_x=?,grid_y=? WHERE id=?',[x,y,zoneId]);
   await audit(db,actor,zoneId,'zone_grid_place');
   return ok({saved:true,grid_x:x,grid_y:y});
  });
 }
 const region=/^\/world-admin\/geography\/regions\/(\d+)\/access$/.exec(path);
 if(region&&req.method==='POST'){
  const regionId=Number(region[1]),b=await body(req);
  if(!validId(regionId)||!['ground_and_air','airship_only'].includes(b?.access_policy))return fail(400,'invalid_region_access');
  return tx(pool,async db=>{
   const [[record]]=await db.execute('SELECT id FROM world_regions WHERE id=?',[regionId]);
   if(!record)return fail(404,'region_not_found');
   if(b.access_policy==='airship_only'){
    const [[crossing]]=await db.execute('SELECT id FROM world_zone_crossings WHERE from_region_id<>to_region_id AND (from_region_id=? OR to_region_id=?) LIMIT 1',[regionId,regionId]);
    if(crossing)return fail(409,'remove_ground_crossings_before_airship_only');
   }
   await db.execute('INSERT INTO world_region_access(region_id,access_policy) VALUES(?,?) ON DUPLICATE KEY UPDATE access_policy=VALUES(access_policy)',[regionId,b.access_policy]);
   await audit(db,actor,regionId,'region_access');
   return ok({saved:true});
  });
 }
 return fail(404,'geography_route_not_found');
}
