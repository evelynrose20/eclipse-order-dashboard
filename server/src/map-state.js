// Map positions are proportions of the entire board, not grid-cell indices.
export const WAYMARK_IDS=['A','B','C','D','1','2','3','4'];
export function unitCoordinate(value){
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1)return null;
 return Math.round(value*100000)/100000;
}
export function normalizedPosition(x,y){
 if(x===null&&y===null)return {x:null,y:null};
 const a=unitCoordinate(x),b=unitCoordinate(y);
 return a===null||b===null?null:{x:a,y:b};
}
export function validateWaymarks(marks){
 if(!marks||typeof marks!=='object'||Array.isArray(marks))return null;
 if(Object.keys(marks).some(k=>!WAYMARK_IDS.includes(k)))return null;
 const valid={};
 for(const [id,pos] of Object.entries(marks)){
  if(pos===null)continue;
  const point=normalizedPosition(pos?.x,pos?.y);
  if(!point||point.x===null)return null;
  valid[id]=point;
 }
 return valid;
}
