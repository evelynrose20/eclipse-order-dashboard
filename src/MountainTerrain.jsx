import React,{useMemo} from 'react';
import {inPolygon,distanceToRidge} from '../server/src/world-terrain-placement.js';

// Cartographic relief only. It must never modify the stored terrain outline,
// settlement location, ownership, or mountain placement rules.
const fraction=n=>n-Math.floor(n);
const noise=(x,y,seed=0)=>fraction(Math.sin(x*127.1+y*311.7+seed*74.7)*43758.5453);
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const round=n=>Number(n.toFixed(2));

export function ridgeRelief(points,closed=false){
 if(!Array.isArray(points)||points.length<2)return [];
 const total=points.length-(closed?0:1),markers=[];
 for(let i=0;i<total;i++){
  const a=points[i],b=points[(i+1)%points.length],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
  if(d<1)return markers;
  const steps=Math.max(1,Math.floor(d/7.8));
  for(let j=0;j<steps;j++){
   const t=(j+.5)/steps;
   const x=a.x+dx*t,y=a.y+dy*t;
   if(markers.some(p=>Math.hypot(p.x-x,p.y-y)<5.5))continue;
   const seed=noise(x,y,i);
   markers.push({x:round(x),y:round(y),size:round(.95+seed*.5),variant:Math.floor(seed*3)});
  }
 }
 return markers.slice(0,65);
}

export function areaRelief(points){
 if(!Array.isArray(points)||points.length<3)return [];
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
 const minX=Math.max(0,Math.min(...xs)),maxX=Math.min(100,Math.max(...xs));
 const minY=Math.max(0,Math.min(...ys)),maxY=Math.min(100,Math.max(...ys));
 const candidates=[],spacing=7.8;
 for(let y=Math.floor(minY/spacing)*spacing;y<=maxY;y+=spacing){
  for(let x=Math.floor(minX/spacing)*spacing;x<=maxX;x+=spacing){
   const px=x+(noise(x,y,3)-.5)*spacing*.85;
   const py=y+(noise(x,y,9)-.5)*spacing*.75;
   const p={x:clamp(px,0,100),y:clamp(py,0,100)};
   if(!inPolygon(p,points))continue;
   // Keep terrain icons off the boundary, leaving a clear outline for editing.
   if(distanceToRidge(p,[...points,points[0]])<3.2)continue;
   if(noise(x,y,11)<.29)continue;
   candidates.push({...p,size:.95+noise(x,y,17)*.75,variant:Math.floor(noise(x,y,23)*3)});
  }
 }
 // Larger regions have a richer central landscape but stay readable on desktop.
 return candidates.slice(0,56).map(p=>({...p,x:round(p.x),y:round(p.y),size:round(p.size)}));
}

export function terrainLabelPosition(points,closed){
 if(!Array.isArray(points)||!points.length)return {x:50,y:50};
 if(!closed)return points[Math.floor(points.length/2)];
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
 const box={x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2};
 if(inPolygon(box,points)&&distanceToRidge(box,[...points,points[0]])>3)return box;
 const center={x:points.reduce((n,p)=>n+p.x,0)/points.length,y:points.reduce((n,p)=>n+p.y,0)/points.length};
 if(inPolygon(center,points))return center;
 return points.find(p=>inPolygon({x:p.x+.5,y:p.y+.5},points))||box;
}

function Summit({p}){
 const {x,y,size:s,variant=0}=p;
 return <g transform={`translate(${x} ${y})`} className="wtm-cartographic-summit">
  <path d={`M ${-s*1.15} ${s*.65} L ${-s*.33} ${-s*.26} L 0 ${-s*1.36} L ${s*.45} ${-s*.35} L ${s*1.23} ${s*.65} Z`} className="wtm-summit-face"/>
  <path d={`M 0 ${-s*1.36} L ${s*1.23} ${s*.65} L ${s*.11} ${s*.45} Z`} className="wtm-summit-shadow"/>
  <path d={`M ${-s*.38} ${-s*.39} L 0 ${-s*1.36} L ${s*.37} ${-s*.34} L ${s*.08} ${-s*.5} L ${-s*.14} ${-s*.24} Z`} className={variant===0?'wtm-summit-cap wtm-summit-cap-snow':'wtm-summit-cap'}/>
  <path d={`M ${-s*.65} ${s*.68} L ${-s*.26} ${s*.2} M ${s*.35} ${s*.67} L ${s*.6} ${s*.36}`} className="wtm-summit-strata"/>
 </g>;
}

// This layer is purposefully quieter than settlement pins and transport routes.
// For closed mountains: gently shaded polygon + scattered peaks.
// For historic open ridges: restrained ridge band and sparse peaks.
export default function MountainTerrain({mountain,seed=0}){
 const points=Array.isArray(mountain.points)?mountain.points:[];
 const closed=Boolean(Number(mountain.is_closed));
 const id=String(mountain.id||seed).replace(/[^a-zA-Z0-9_-]/g,'');
 const path=closed?'M '+points.map(p=>p.x+' '+p.y).join(' L ')+' Z':'M '+points.map(p=>p.x+' '+p.y).join(' L ');
 const peaks=useMemo(()=>closed?areaRelief(points):ridgeRelief(points),[mountain.points,mountain.is_closed]);
 const label=terrainLabelPosition(points,closed);
 if(points.length<2)return null;
 return <g className={'wtm-range '+(closed?'wtm-mountain-area':'wtm-mountain-ridge')} aria-label={mountain.name}>
  {closed?<g>
   <path d={path} className="wtm-zone-base"/>
   <path d={path} className="wtm-zone-hatch"/>
   <path d={path} className="wtm-zone-inner"/>
   <path d={path} className="wtm-zone-outline"/>
  </g>:<g>
   <path d={path} className="wtm-ridge-shadow"/>
   <path d={path} className="wtm-ridge-ground"/>
  </g>}
  {peaks.map((p,i)=><Summit key={i} p={p}/>)}
  <text x={label.x} y={Math.max(3.7,label.y-2.4)} textAnchor="middle" className="wtm-range-label">{mountain.name}</text>
 </g>;
}
