// All coordinates are percentages of the local map (0–100).
// Open legacy mountain ridges exclude a 3.2-unit corridor. Closed mountains
// exclude their complete interior, including the boundary buffer.
export const MOUNTAIN_EXCLUSION_RADIUS=3.2;
export const NPC_MAP_EDGE_PADDING=10;
export const riverPointValid=p=>p&&typeof p.x==='number'&&typeof p.y==='number'&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=100&&p.y>=0&&p.y<=100;
export const validTerrainPoints=points=>Array.isArray(points)&&points.length>=2&&points.length<=256&&points.every(riverPointValid);
export function distanceToRidge(point,points,closed=false){
 if(!riverPointValid(point)||!Array.isArray(points)||points.length<2)return Infinity;
 let nearest=Infinity;
 const count=closed?points.length:points.length-1;
 for(let i=0;i<count;i++){
  const a=points[i],b=points[(i+1)%points.length];
  if(!riverPointValid(a)||!riverPointValid(b))continue;
  const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy;
  const t=d?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/d)):0;
  nearest=Math.min(nearest,Math.hypot(point.x-a.x-dx*t,point.y-a.y-dy*t));
 }
 return nearest;
}
export function inPolygon(point,points){
 if(!riverPointValid(point)||!Array.isArray(points)||points.length<3)return false;
 let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[i],b=points[j];
  if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }
 return inside;
}
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const intersects=(a,b,c,d)=>{
 const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
 return x*y<0&&z*w<0;
};
export function validMountainShape(points,isClosed=false){
 if(!validTerrainPoints(points))return false;
 if(!isClosed)return true;
 if(points.length<3)return false;
 let signed=0;
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length];
  if(Math.hypot(a.x-b.x,a.y-b.y)<.15)return false;
  signed+=a.x*b.y-b.x*a.y;
  for(let j=i+1;j<points.length;j++){
   if(j===i+1||(i===0&&j===points.length-1))continue;
   if(intersects(a,b,points[j],points[(j+1)%points.length]))return false;
  }
 }
 return Math.abs(signed)>=4;
}
export function isMountainBlocked(point,range,exclusion=MOUNTAIN_EXCLUSION_RADIUS){
 const points=typeof range?.points==='string'?JSON.parse(range.points):range?.points;
 const closed=Boolean(Number(range?.is_closed));
 return closed&&inPolygon(point,points)||distanceToRidge(point,points,closed)<exclusion;
}
export function mountainAt(point,mountains,exclusion=MOUNTAIN_EXCLUSION_RADIUS){
 return (mountains||[]).find(range=>isMountainBlocked(point,range,exclusion))||null;
}
export async function mountainPlacementConflict(db,regionId,zoneId,point){
 const [ranges]=await db.execute('SELECT id,name,points,is_closed FROM world_map_mountain_ranges WHERE region_id=? AND zone_id=?',[regionId,zoneId]);
 return mountainAt(point,ranges);
}
export function rangesCoverSettlements(points,settlements,isClosed=false){
 return (settlements||[]).some(s=>isMountainBlocked({x:Number(s.map_x),y:Number(s.map_y)},{points,is_closed:isClosed}));
}
export function npcTooCloseToMapEdge(point,padding=NPC_MAP_EDGE_PADDING){
 return !riverPointValid(point)||point.x<padding||point.x>100-padding||point.y<padding||point.y>100-padding;
}
