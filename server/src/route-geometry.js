export function closestPointOnSegment(point,a,b){
 const dx=b.x-a.x,dy=b.y-a.y;
 const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1)));
 const x=a.x+t*dx,y=a.y+t*dy;
 return {x:Math.round(x*100)/100,y:Math.round(y*100)/100,distance:Math.hypot(point.x-x,point.y-y)};
}
export function splitRoutePoints(start,waypoints,end,point,maxDistance=8){
 const line=[start,...waypoints,end];
 if(line.length<2||line.some(p=>!Number.isFinite(p?.x)||!Number.isFinite(p?.y)))return null;
 const candidates=line.slice(1).map((to,i)=>({i,...closestPointOnSegment(point,line[i],to)}));
 const best=candidates.sort((a,b)=>a.distance-b.distance)[0];
 if(!best||best.distance>maxDistance)return null;
 const junction={x:best.x,y:best.y};
 if(Math.hypot(junction.x-start.x,junction.y-start.y)<1.5||Math.hypot(junction.x-end.x,junction.y-end.y)<1.5)return null;
 return {junction,before:waypoints.slice(0,best.i),after:waypoints.slice(best.i)};
}
