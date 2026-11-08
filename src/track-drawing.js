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
