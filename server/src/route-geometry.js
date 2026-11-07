export const pointOnSegment=(p,a,b)=>{
 const dx=b.x-a.x,dy=b.y-a.y;
 const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
 const x=a.x+t*dx,y=a.y+t*dy;
 return {x:Math.round(x*100)/100,y:Math.round(y*100)/100,distance:Math.hypot(p.x-x,p.y-y)};
};
export function splitRoutePoints(start,waypoints,end,point,maxDistance=6){
 const line=[start,...waypoints,end];
 if(line.length<2||line.some(p=>!Number.isFinite(p?.x)||!Number.isFinite(p?.y)))return null;
 const candidates=line.slice(1).map((b,i)=>({i,...pointOnSegment(point,line[i],b)}));
 const best=candidates.sort((a,b)=>a.distance-b.distance)[0];
 if(!best||best.distance>maxDistance)return null;
 const junction={x:best.x,y:best.y};
 // A junction exactly on an endpoint is not a split.
 if(Math.hypot(junction.x-start.x,junction.y-start.y)<1.5||Math.hypot(junction.x-end.x,junction.y-end.y)<1.5)return null;
 return {junction,before:waypoints.slice(0,best.i),after:waypoints.slice(best.i),distance:best.distance};
}
