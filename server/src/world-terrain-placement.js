// A mountain range is an impassable terrain corridor around its drawn ridge.
// Coordinates are percentages of the local map (0–100 in both axes).
// Settlement positions are rejected in this corridor on the server, not just UI.
export const MOUNTAIN_EXCLUSION_RADIUS=3.2;
export const validTerrainPoints=points=>Array.isArray(points)&&points.length>=2&&points.length<=32&&points.every(riverPointValid);
export const riverPointValid=p=>p&&typeof p.x==='number'&&typeof p.y==='number'&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=100&&p.y>=0&&p.y<=100;
export function distanceToRidge(point,points){
 if(!riverPointValid(point)||!Array.isArray(points)||points.length<2)return Infinity;
 let nearest=Infinity;
 for(let i=0;i<points.length-1;i++){
  const a=points[i],b=points[i+1];
  if(!riverPointValid(a)||!riverPointValid(b))continue;
  const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy;
  const t=d?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/d)):0;
  nearest=Math.min(nearest,Math.hypot(point.x-a.x-dx*t,point.y-a.y-dy*t));
 }
 return nearest;
}
export function mountainAt(point,mountains,exclusion=MOUNTAIN_EXCLUSION_RADIUS){
 for(const range of mountains||[]){
  const points=typeof range.points==='string'?JSON.parse(range.points):range.points;
  if(distanceToRidge(point,points)<exclusion)return range;
 }
 return null;
}
export async function mountainPlacementConflict(db,regionId,zoneId,point){
 const [ranges]=await db.execute('SELECT id,name,points FROM world_map_mountain_ranges WHERE region_id=? AND zone_id=?',[regionId,zoneId]);
 return mountainAt(point,ranges);
}
export function rangesCoverSettlements(points,settlements){
 return (settlements||[]).some(s=>distanceToRidge({x:Number(s.map_x),y:Number(s.map_y)},points)<MOUNTAIN_EXCLUSION_RADIUS);
}
