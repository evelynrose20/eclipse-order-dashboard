import React,{useMemo} from 'react';
import {safelyOffshore} from './terrain-geography.js';

// A native, non-interactive terrain atlas, derived from the broad geography
// in the supplied Three Great Continents reference. No source-map image,
// labels, pins, or faction claims are baked into the terrain.
// Coordinates share the strategy map's 1000 x 700 world-space viewBox.
const LAND={
 ilsabard:[[254,292],[269,256],[250,229],[275,196],[272,158],[300,135],[319,98],[341,114],[360,89],[377,112],[400,83],[419,94],[443,77],[470,104],[496,78],[522,97],[540,124],[567,114],[588,143],[604,169],[630,182],[648,213],[667,223],[685,251],[680,288],[707,307],[690,346],[716,378],[697,411],[710,445],[683,469],[655,477],[628,512],[595,503],[559,522],[529,493],[496,478],[474,445],[451,455],[425,489],[390,480],[373,448],[341,433],[312,414],[301,381],[273,358],[261,322]],
 aldenard:[[97,368],[126,350],[151,346],[175,312],[208,329],[222,311],[251,337],[265,360],[291,344],[310,374],[331,391],[350,424],[340,450],[367,472],[339,496],[318,510],[323,546],[313,579],[289,598],[285,630],[262,654],[242,650],[233,617],[216,605],[198,579],[200,557],[181,538],[185,516],[156,505],[157,477],[126,461],[136,430],[109,412],[94,390]],
 othard:[[615,309],[643,286],[645,245],[674,221],[690,190],[718,197],[728,169],[757,197],[784,208],[800,232],[821,219],[850,254],[857,286],[890,295],[926,305],[931,336],[913,349],[944,377],[935,414],[917,436],[919,463],[896,489],[897,513],[880,533],[866,570],[836,593],[817,610],[786,588],[771,564],[754,547],[728,537],[700,512],[680,488],[658,471],[641,439],[633,403],[610,380]],
 snowfield:[[469,116],[505,93],[548,107],[574,129],[600,155],[622,149],[645,172],[665,172],[675,144],[698,155],[704,185],[720,178],[748,202],[759,224],[735,237],[721,263],[701,279],[672,267],[651,273],[639,290],[613,278],[594,266],[567,279],[549,260],[524,242],[500,254],[486,231],[469,204],[483,181]],
 eastice:[[640,225],[676,207],[692,185],[715,200],[749,192],[781,220],[811,221],[836,247],[819,271],[787,286],[753,305],[729,289],[705,310],[677,284]]
};
// Candidate islands are validated against every mainland outline before rendering.
// Islands touching a continent are discarded rather than being painted inland.
const ISLANDS=[
 [80,233,12,20,9],[60,271,8,14,17],[123,560,10,12,22],[135,604,7,10,24],
 [174,658,7,10,17],[449,46,12,7,36],[439,37,8,6,28],
 [483,40,10,7,42],[557,49,12,7,32],[604,76,8,5,16],
 [796,150,10,7,23],[966,398,10,8,25],[968,366,7,7,34],[947,293,9,9,37],
 [957,249,10,8,28],[981,317,12,10,24],[877,182,7,6,11],[825,143,7,5,5],
 [412,654,11,8,25],[530,645,8,6,13],[679,653,11,10,11],[750,671,11,9,15]
];
const RIDGES=[
 {path:[[300,141],[319,165],[344,202],[366,241],[385,279],[402,307]],amount:26,seed:4},
 {path:[[372,129],[397,150],[421,186],[441,211],[460,252]],amount:19,seed:9},
 {path:[[470,164],[497,176],[525,207],[550,229],[571,255]],amount:21,seed:7},
 {path:[[512,118],[528,147],[541,167],[555,189]],amount:14,seed:12},
 {path:[[572,209],[599,229],[627,252],[644,281],[659,309]],amount:19,seed:21},
 {path:[[694,239],[721,261],[744,272],[765,285],[784,320]],amount:20,seed:15},
 {path:[[726,337],[751,346],[783,354],[803,367]],amount:18,seed:20},
 {path:[[147,377],[171,405],[199,417],[224,432],[245,460]],amount:21,seed:6},
 {path:[[181,484],[216,492],[247,523],[267,554]],amount:18,seed:5},
 {path:[[688,394],[721,417],[747,435]],amount:14,seed:11},
 {path:[[788,247],[811,265],[834,273]],amount:13,seed:31}
];
const WOODS=[
 [346,324,31,17,32],[390,368,24,18,30],[482,337,28,22,29],[540,348,24,19,31],
 [268,454,28,15,38],[201,520,21,11,20],[722,473,30,18,34],[846,483,28,19,45],
 [754,381,21,14,19],[362,225,14,12,19],[622,368,18,13,23],
 [547,416,16,14,12],[292,538,19,13,20]
];
const HASH=(seed,n)=>{let x=Math.sin(seed*127.1+n*311.7)*43758.5453;return x-Math.floor(x)};
function coast(points,seed=1,roughness=2.25){
 const out=[];
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1];
  const length=Math.hypot(dx,dy),count=Math.max(1,Math.round(length/7));
  for(let j=0;j<count;j++){
   const t=j/count,amp=Math.sin(Math.PI*t)*Math.min(roughness,length*.16);
   const wobble=(HASH(seed+i*53,j+1)-.5)*2*amp;
   out.push([a[0]+dx*t+(-dy/length||0)*wobble,a[1]+dy*t+(dx/length||0)*wobble]);
  }
 }
 return 'M '+out.map(p=>p.map(v=>v.toFixed(1)).join(' ')).join(' L ')+' Z';
}
function mountain(x,y,scale=1,ice=false,k=0){
 const a=11*scale,b=17*scale,side=7*scale;
 return <g key={'m'+k} transform={`translate(${x} ${y})`} opacity={ice?.86:.77}>
  <path d={`M ${-a} 0 L 0 ${-b} L ${a} 0 L ${side} ${-2*scale} L 0 ${-b*.66} L ${-side} ${-2*scale} Z`} fill={ice?'#41545b':'#3c392c'}/>
  <path d={`M 0 ${-b} L ${a} 0 L ${2*scale} ${-3*scale} Z`} fill={ice?'#74838a':'#7d735b'}/>
  <path d={`M ${-3*scale} ${-b*.65} L 0 ${-b} L ${4*scale} ${-b*.63} L ${1*scale} ${-b*.69} L ${-1*scale} ${-b*.56} Z`} fill={ice?'#cad6d5':'#c0b099'}/>
  <path d={`M ${-a*.7} ${-1*scale} L 0 ${-b} L ${a*.7} ${-1*scale}`} fill="none" stroke="#242c2c" strokeWidth={.6*scale} opacity=".5"/>
 </g>;
}
function routePoints(path,count,seed){
 const spans=path.slice(0,-1).map((p,i)=>Math.hypot(path[i+1][0]-p[0],path[i+1][1]-p[1]));
 const total=spans.reduce((a,b)=>a+b,0);let sum=0;
 return Array.from({length:count},(_,j)=>{
  const at=(j+.5)/count*total;let idx=0,len=0;
  while(idx<spans.length-1&&len+spans[idx]<at){len+=spans[idx++];}
  const t=Math.min(1,(at-len)/spans[idx]);
  return {x:path[idx][0]+(path[idx+1][0]-path[idx][0])*t+(HASH(seed,j)-.5)*9,
          y:path[idx][1]+(path[idx+1][1]-path[idx][1])*t+(HASH(seed+9,j)-.5)*5,
          s:.5+HASH(seed+18,j)*.63};
 });
}
function pine(x,y,size,key){
 return <g key={key} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} opacity=".8">
 <path d={`M0 ${size*.28}V${size*.86}`} stroke="#4a4b32" strokeWidth="1"/>
 <path d={`M0 0 L${-size*.43} ${size*.63} L${size*.43} ${size*.63} Z`} fill="#343f30"/>
 <path d={`M0 ${size*.24} L${-size*.51} ${size*.76} L${size*.51} ${size*.76} Z`} fill="#46533b"/>
 </g>;
}
const mainContours=['ilsabard','aldenard','othard'];
export default function IlsabardTerrain({showRelief=true}){
 const paths=useMemo(()=>Object.fromEntries(Object.entries(LAND).map(([k,v],i)=>[k,coast(v,i*23+7,k.includes('ice')?2:3)])),[]);
 const mountains=useMemo(()=>RIDGES.flatMap(({path,amount,seed})=>routePoints(path,amount,seed).filter((p,i)=>i%7!==3).map((p,i)=>mountain(p.x,p.y,p.s*(.8+HASH(seed+42,i)*.35),p.x>510&&p.y<290,seed*100+i))),[]);
 const forests=useMemo(()=>WOODS.flatMap(([cx,cy,rx,ry,n],i)=>Array.from({length:n},(_,j)=>{const a=HASH(i+4,j)*Math.PI*2,r=Math.sqrt(HASH(i+15,j));return pine(cx+Math.cos(a)*rx*r,cy+Math.sin(a)*ry*r,3+HASH(i+27,j)*5,'tree'+i+'-'+j)})),[]);
 const offshoreIslands=useMemo(()=>ISLANDS.filter(island=>safelyOffshore(island,[LAND.ilsabard,LAND.aldenard,LAND.othard],5)),[]);
 return <g className="ilsabard-native-terrain" pointerEvents="none" aria-hidden="true">
  <defs>
   <radialGradient id="ils-ocean"><stop offset="0" stopColor="#385960"/><stop offset=".7" stopColor="#24444e"/><stop offset="1" stopColor="#152e3a"/></radialGradient>
   <linearGradient id="ils-ground" x1="0" y1="0" x2=".75" y2="1"><stop stopColor="#a69a73"/><stop offset=".43" stopColor="#776b4a"/><stop offset=".85" stopColor="#85794f"/><stop offset="1" stopColor="#5a5c40"/></linearGradient>
   <linearGradient id="ils-east" x1=".1" y1="0" x2="1" y2="1"><stop stopColor="#8b8664"/><stop offset=".63" stopColor="#6d754d"/><stop offset="1" stopColor="#68744c"/></linearGradient>
   <linearGradient id="ils-frost" x1="0" y1="0" x2=".7" y2="1"><stop stopColor="#91abb0"/><stop offset=".5" stopColor="#8c9e9f"/><stop offset="1" stopColor="#728b92"/></linearGradient>
   <pattern id="ils-sea-lines" width="34" height="21" patternUnits="userSpaceOnUse"><path d="M4 11q7-3 14 0t14 0" fill="none" stroke="#8aa9ad" strokeWidth=".5" opacity=".25"/></pattern>
   <filter id="ils-noise" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".042" numOctaves="3" seed="11" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".12"/></feComponentTransfer></filter>
   {mainContours.map(k=><clipPath key={'clip'+k} id={'ils-clip-'+k}><path d={paths[k]}/></clipPath>)}
  </defs>
  <rect x="0" y="0" width="1000" height="700" fill="url(#ils-ocean)"/>
  <rect width="1000" height="700" fill="url(#ils-sea-lines)" opacity=".5"/>
  <path d="M0 530Q160 476 350 594T730 542T1000 612" fill="none" stroke="#97b2b1" strokeWidth="1" strokeDasharray="2 8" opacity=".15"/>
  {mainContours.map((k,i)=><g key={k}>
   <path d={paths[k]} transform="translate(1 4)" stroke="#0d2730" strokeWidth="8" fill="#0c252d" opacity=".7"/>
   <path d={paths[k]} fill={i===2?'url(#ils-east)':'url(#ils-ground)'} stroke="#c5c19b" strokeWidth="1.4" strokeLinejoin="round"/>
   <path d={paths[k]} fill="none" stroke="#3b5248" strokeWidth="5" strokeOpacity=".18" strokeLinejoin="round"/>
   <g clipPath={`url(#ils-clip-${k})`} opacity=".5">
    <rect x="0" y="0" width="1000" height="700" filter="url(#ils-noise)"/>
    {Array.from({length:34},(_,n)=>{const cx=HASH(i+3,n)*1000,cy=HASH(i+37,n)*700,rx=25+HASH(i+90,n)*100,ry=15+HASH(i+133,n)*55;return <ellipse key={n} cx={cx} cy={cy} rx={rx} ry={ry} fill={n%3?'#41563a':'#c2aa74'} opacity={.10+HASH(i+75,n)*.23}/>;})}
   </g>
  </g>)}
  {offshoreIslands.map(([x,y,rx,ry,s],i)=><path key={'island'+i} d={coast(Array.from({length:10},(_,j)=>{const angle=Math.PI*2*j/10,noise=.72+HASH(s,j)*.56;return [x+Math.cos(angle)*rx*noise,y+Math.sin(angle)*ry*noise]}),s,1.7)} fill={i%4===0?'#668269':'#776f4c'} stroke="#b1a987" strokeWidth="1.1"/>)}
  <path d={paths.snowfield} fill="url(#ils-frost)" stroke="#93b0ae" strokeWidth="1.2" opacity=".96"/>
  <path d={paths.eastice} fill="url(#ils-frost)" stroke="#acb8b7" strokeWidth="1" opacity=".98"/>
  <path d="M 315 146 Q 380 190 414 254 T 493 317 Q 529 339 554 388" fill="none" stroke="#d4bb83" strokeWidth="19" opacity=".16"/>
  <path d="M 630 325 Q 677 370 699 414 T 750 506" fill="none" stroke="#a69d71" strokeWidth="22" opacity=".2"/>
  {showRelief&&<g>{forests}{mountains}
   <path d="M 484 214 Q 474 266 486 299 Q 464 344 442 373 T 406 434" fill="none" stroke="#72979b" strokeWidth="3.5" strokeLinecap="round" opacity=".9"/>
   <path d="M 484 214 Q 474 266 486 299 Q 464 344 442 373 T 406 434" fill="none" stroke="#bbd1c6" strokeWidth=".8" opacity=".7"/>
   <path d="M 753 333 Q 773 378 775 425 Q 794 467 809 510" fill="none" stroke="#82a1a0" strokeWidth="3.4"/>
   <path d="M 246 416 Q 250 447 281 480 T 277 546" fill="none" stroke="#7b9ea1" strokeWidth="2.4"/>
  </g>}
  <g fontFamily="Georgia,serif" fill="#e2d8b6" stroke="#172f38" strokeWidth="2.7" paintOrder="stroke" letterSpacing="4" opacity=".85" textAnchor="middle">
   <text x="484" y="330" fontSize="20">ILSABARD</text>
   <text x="240" y="473" fontSize="17">ALDENARD</text>
   <text x="803" y="441" fontSize="17">OTHARD</text>
  </g>
 </g>;
}
