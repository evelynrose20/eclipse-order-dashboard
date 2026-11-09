// Continent cartography stores only shape and backdrop; all simulated geography
// remains in the established regions, zones, settlements and facility records.
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const validUrl=url=>typeof url==='string'&&url.length<=1500&&(!url||(()=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}})());
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const onSegment=(a,b,p)=>Math.min(a.x,b.x)<=p.x&&p.x<=Math.max(a.x,b.x)&&Math.min(a.y,b.y)<=p.y&&p.y<=Math.max(a.y,b.y);
const intersects=(a,b,c,d)=>{
 const p=cross(a,b,c),q=cross(a,b,d),r=cross(c,d,a),s=cross(c,d,b);
 if(((p>0&&q<0)||(p<0&&q>0))&&((r>0&&s<0)||(r<0&&s>0)))return true;
 return (p===0&&onSegment(a,b,c))||(q===0&&onSegment(a,b,d))||(r===0&&onSegment(c,d,a))||(s===0&&onSegment(c,d,b));
};
export function validateTerritoryPolygon(points){
 if(!Array.isArray(points)||points.length<3||points.length>100)return 'invalid_territory_polygon';
 if(points.some(p=>!p||!finite(p.x)||!finite(p.y)||p.x<0||p.x>1000||p.y<0||p.y>700))return 'invalid_territory_coordinates';
 const unique=new Set(points.map(p=>p.x+':'+p.y));
 if(unique.size!==points.length)return 'duplicate_territory_vertex';
 const signed=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.y-q.x*p.y},0);
 if(Math.abs(signed)<40)return 'territory_area_too_small';
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
  if(j===i+1||(i===0&&j===points.length-1))continue;
  if(intersects(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]))return 'territory_self_intersection';
 }
 return null;
}
async function body(req){let total=0,parts=[];for await(const c of req){total+=c.length;if(total>15000)return null;parts.push(c)}try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{return null}}
export async function continentSummary(db){
 const [[settings]]=await db.execute('SELECT name,background_url FROM world_continent_settings WHERE id=1');
 const [polygons]=await db.execute('SELECT zone_id,polygon FROM world_continent_territories ORDER BY zone_id');
 return {name:settings?.name||'The Continent',background_url:settings?.background_url||'',territories:polygons.map(p=>({zone_id:Number(p.zone_id),polygon:typeof p.polygon==='string'?JSON.parse(p.polygon):p.polygon}))};
}
export async function continentRoute(pool,req,path,actor){
 if(!['domina','high_command'].includes(actor?.account_role))return fail(403,'command_required');
 if(path==='/world-admin/continent/settings'&&req.method==='PUT'){
  const b=await body(req);
  if(!b||typeof b.name!=='string'||!b.name.trim()||b.name.length>140||!validUrl(b.background_url))return fail(400,'invalid_continent_settings');
  await pool.execute('UPDATE world_continent_settings SET name=?,background_url=? WHERE id=1',[b.name.trim(),b.background_url]);
  return ok({saved:true});
 }
 const m=/^\/world-admin\/continent\/territories\/(\d+)$/.exec(path);
 if(m&&req.method==='PUT'){
  const b=await body(req),points=b?.polygon;
  const error=points===null?null:validateTerritoryPolygon(points);
  if(error)return fail(400,error);
  const id=Number(m[1]);
  const [[zone]]=await pool.execute('SELECT id FROM world_zones WHERE id=?',[id]);
  if(!zone)return fail(404,'zone_not_found');
  if(points===null)await pool.execute('DELETE FROM world_continent_territories WHERE zone_id=?',[id]);
  else await pool.execute('INSERT INTO world_continent_territories(zone_id,polygon,updated_by) VALUES(?,?,?) ON DUPLICATE KEY UPDATE polygon=VALUES(polygon),updated_by=VALUES(updated_by)',[id,JSON.stringify(points),actor.id]);
  return ok({saved:true,zone_id:id});
 }
 return fail(404,'continent_route_not_found');
}
