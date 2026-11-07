// Geometry of the 15 elected Senate positions; 6 + 5 + 4 seats on
// concentric semicircles, independent of live party or appointment data.
export function senateSeatPositions(){
 const rows=[{count:6,rx:43,ry:65},{count:5,rx:32,ry:51},{count:4,rx:21,ry:37}];
 return rows.flatMap(({count,rx,ry})=>Array.from({length:count},(_,index)=>{
  const angle=(198+(144*index)/(count-1))*Math.PI/180;
  return {left:50+Math.cos(angle)*rx,top:92+Math.sin(angle)*ry};
 }));
}
