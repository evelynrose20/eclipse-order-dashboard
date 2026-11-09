// Freehand strokes become small, editable province/state polygons.
// All points use the continent's 1000 x 700 coordinate system.
const sq=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
const segmentDistance=(p,a,b)=>{
 const dx=b.x-a.x,dy=b.y-a.y,t=dx*dx+dy*dy;
 if(t===0)return sq(p,a);
 const u=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/t));
 return sq(p,{x:a.x+dx*u,y:a.y+dy*u});
};
function simplifyOpen(points,tolerance){
 if(points.length<=2)return points;
 let best=0,index=-1;
 for(let i=1;i<points.length-1;i++){
  const value=segmentDistance(points[i],points[0],points[points.length-1]);
  if(value>best){best=value;index=i;}
 }
 if(best<=tolerance*tolerance||index<0)return [points[0],points[points.length-1]];
 const a=simplifyOpen(points.slice(0,index+1),tolerance);
 const b=simplifyOpen(points.slice(index),tolerance);
 return [...a.slice(0,-1),...b];
}
export function simplifyFreehand(stroke,tolerance=1.8,maxVertices=100){
 if(!Array.isArray(stroke))return [];
 const points=stroke.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)).map(p=>({x:Math.round(p.x*10)/10,y:Math.round(p.y*10)/10}));
 const unique=points.filter((p,i)=>i===0||sq(p,points[i-1])>.01);
 if(unique.length<3)return [];
 if(sq(unique[0],unique[unique.length-1])<1)unique.pop();
 if(unique.length<3)return [];
 // Split the closed ring at the furthest point from the start so RDP
 // preserves both halves of the traced coastline.
 let far=1,best=0;
 for(let i=1;i<unique.length;i++){const d=sq(unique[0],unique[i]);if(d>best){best=d;far=i}}
 const rotated=[...unique.slice(far),...unique.slice(0,far)];
 const a=simplifyOpen([rotated[0],...rotated.slice(1),rotated[0]],tolerance);
 const ring=a.slice(0,-1);
 if(ring.length<=maxVertices&&ring.length>=3)return ring;
 // A low upper bound protects API validation and editing performance.
 const step=Math.ceil(unique.length/maxVertices);
 return unique.filter((_,i)=>i%step===0).slice(0,maxVertices);
}
export function insertVertex(points,point){
 if(!Array.isArray(points)||points.length<3||!point)return points;
 let at=0,best=Infinity;
 for(let i=0;i<points.length;i++){
  const d=segmentDistance(point,points[i],points[(i+1)%points.length]);
  if(d<best){best=d;at=i+1}
 }
 return [...points.slice(0,at),point,...points.slice(at)];
}
