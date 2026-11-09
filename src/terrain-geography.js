// Cartographic geometry shared by the atlas and terrain validation tests.
// Keep offshore land separate from the continent masks; a center alone is not enough
// because a large island can still overlap a coastal peninsula.
export function pointInPolygon(point, ring) {
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];
  if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}
export function distanceToSegment(point,a,b){
 const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
 if(!length)return Math.hypot(point[0]-a[0],point[1]-a[1]);
 const t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/length));
 return Math.hypot(point[0]-a[0]-dx*t,point[1]-a[1]-dy*t);
}
export function safelyOffshore(island,landmasses,margin=4){
 const [x,y,rx,ry]=island;
 // Use a conservative bounding-radius clearance so that every edge of each
 // irregular island, including generated coast noise, remains water-separated.
 const safeRadius=Math.hypot(rx,ry)*1.15+margin;
 for(const ring of landmasses){
  if(pointInPolygon([x,y],ring))return false;
  for(let i=0;i<ring.length;i++){
   if(distanceToSegment([x,y],ring[i],ring[(i+1)%ring.length])<=safeRadius)return false;
  }
 }
 return true;
}
