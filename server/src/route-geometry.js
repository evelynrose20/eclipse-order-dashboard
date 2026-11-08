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
