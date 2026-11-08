// Pure railway drawing helpers: no database writes while users sketch.
export function simplifyTrackStroke(points,maxPoints=16){
 const valid=points.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)).map(p=>({x:Math.max(0,Math.min(100,Math.round(p.x*100)/100)),y:Math.max(0,Math.min(100,Math.round(p.y*100)/100))}));
 if(valid.length<=maxPoints)return valid;
 const sqDist=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return (p.x-a.x-dx*t)**2+(p.y-a.y-dy*t)**2};
 const rdp=(arr,tolerance)=>{
  if(arr.length<=2)return arr;
  let max=-1,index=0;
  for(let i=1;i<arr.length-1;i++){const d=sqDist(arr[i],arr[0],arr.at(-1));if(d>max){max=d;index=i}}
  if(max<=tolerance*tolerance)return [arr[0],arr.at(-1)];
  return [...rdp(arr.slice(0,index+1),tolerance).slice(0,-1),...rdp(arr.slice(index),tolerance)];
 };
 let tolerance=.2;
 while(tolerance<50){const simplified=rdp(valid,tolerance);if(simplified.length<=maxPoints)return simplified;tolerance*=1.4}
 return Array.from({length:maxPoints},(_,i)=>valid[Math.round(i*(valid.length-1)/(maxPoints-1))]);
}
export function insertRouteBend(points,first,last,newPoint,maxPoints=16){
 if(!first||!last||!newPoint||points.length>=maxPoints||points.some(p=>Math.hypot(p.x-newPoint.x,p.y-newPoint.y)<.45))return points;
 const chain=[first,...points,last];
 const distance=(a,b,p)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)};
 const nearest=chain.slice(1).map((v,i)=>({i,d:distance(chain[i],v,newPoint)})).sort((a,b)=>a.d-b.d)[0];
 const next=[...points];next.splice(nearest?.i??next.length,0,newPoint);return next;
}

// Match the Catmull-Rom-inspired cubic paths in WorldTerritoryMap.
// Projection uses sampled cubic spans so the split lands on the VISIBLE track,
// not the invisible straight chord between successive bend points.
export function nearestSmoothRoutePoint(points,target,samples=28){
 if(!Array.isArray(points)||points.length<2||!target||!Number.isFinite(target.x)||!Number.isFinite(target.y))return null;
 const p=points.map(v=>({x:Number(v.x),y:Number(v.y)}));
 if(p.some(v=>!Number.isFinite(v.x)||!Number.isFinite(v.y)))return null;
 const projection=(q,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.y-a.y)*dy)/(dx*dx+dy*dy||1)));const x=a.x+t*dx,y=a.y+t*dy;return {x,y,d:Math.hypot(q.x-x,q.y-y)}};
 const bezier=(a,b,c,d,t)=>{const s=1-t;return {x:s*s*s*a.x+3*s*s*t*b.x+3*s*t*t*c.x+t*t*t*d.x,y:s*s*s*a.y+3*s*s*t*b.y+3*s*t*t*c.y+t*t*t*d.y}};
 let best=null;
 for(let i=0;i<p.length-1;i++){
  const before=p[Math.max(i-1,0)],a=p[i],d=p[i+1],after=p[Math.min(i+2,p.length-1)];
  const b={x:a.x+(d.x-before.x)/6,y:a.y+(d.y-before.y)/6};
  const c={x:d.x-(after.x-a.x)/6,y:d.y-(after.y-a.y)/6};
  let previous=a;
  for(let j=1;j<=samples;j++){
   const next=bezier(a,b,c,d,j/samples),candidate=projection(target,previous,next);
   if(!best||candidate.d<best.d)best={...candidate,index:i};
   previous=next;
  }
 }
 return best?{x:Math.max(0,Math.min(100,Math.round(best.x*100)/100)),y:Math.max(0,Math.min(100,Math.round(best.y*100)/100)),d:best.d,index:best.index}:null;
}


export function orientTrackStroke(points,start,end){
 if(!Array.isArray(points)||points.length<2||!start||!end)return points;
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const forward=distance(points[0],start)+distance(points.at(-1),end);
 const reverse=distance(points[0],end)+distance(points.at(-1),start);
 return reverse<forward?[...points].reverse():points;
}
