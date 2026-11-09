import React,{useMemo} from 'react';

// Illustrated terrain details. These are non-interactive and live underneath
// editable strategic polygons. They are interpretations of the supplied second
// fantasy-map reference, not claims about official FFXIV geography.
const rand=(seed,i)=>{const v=Math.sin(seed*101.3+i*57.71)*43758.5453;return v-Math.floor(v)};
const mountainGroups=[
 {x:370,y:161,dx:22,dy:12,n:11,seed:5,ice:true},
 {x:449,y:149,dx:24,dy:14,n:12,seed:11,ice:true},
 {x:523,y:141,dx:22,dy:10,n:13,seed:21,ice:true},
 {x:606,y:170,dx:21,dy:12,n:13,seed:31,ice:true},
 {x:683,y:200,dx:20,dy:12,n:10,seed:41,ice:true},
 {x:760,y:236,dx:17,dy:10,n:9,seed:51,ice:true},
 {x:337,y:232,dx:16,dy:12,n:11,seed:9,ice:false},
 {x:409,y:260,dx:16,dy:9,n:9,seed:13,ice:false},
 {x:179,y:407,dx:15,dy:12,n:9,seed:23,ice:false},
 {x:243,y:474,dx:15,dy:9,n:7,seed:33,ice:false},
 {x:811,y:350,dx:18,dy:13,n:9,seed:43,ice:false}
];
const valleys=[
 {cx:407,cy:366,rx:72,ry:29,color:'#45694c',n:95,seed:4},
 {cx:517,cy:374,rx:74,ry:33,color:'#3a6243',n:110,seed:8},
 {cx:631,cy:421,rx:52,ry:23,color:'#315943',n:85,seed:12},
 {cx:731,cy:447,rx:85,ry:26,color:'#365c36',n:115,seed:18},
 {cx:843,cy:408,rx:52,ry:43,color:'#3f5936',n:75,seed:22},
 {cx:829,cy:510,rx:35,ry:21,color:'#375836',n:56,seed:27}
];
function crest(x,y,s,ice,k){
 const top=-s*1.35,base=s*.54;
 return <g key={k} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} opacity={ice?.94:.9}>
  <path d={`M${-s} ${base} L${-s*.32} ${-s*.53} L0 ${top} L${s*.56} ${-s*.39} L${s} ${base}Z`} fill={ice?'#485c62':'#665947'}/>
  <path d={`M0 ${top} L${s} ${base} L${s*.09} ${s*.2}Z`} fill={ice?'#899c9d':'#947a60'}/>
  <path d={`M0 ${top} L${s*.28} ${-s*.61} L${s*.06} ${-s*.65} L${-s*.13} ${-s*.43} L${-s*.4} ${-s*.48}Z`} fill={ice?'#eff5ef':'#c5b89d'}/>
  <path d={`M${-s*.66} ${s*.2} L0 ${top} L${s*.69} ${s*.23}`} fill="none" stroke={ice?'#e2efed':'#c6ac89'} strokeWidth=".65" opacity=".8"/>
 </g>;
}
function grove(cx,cy,rx,ry,n,seed){
 return Array.from({length:n},(_,i)=>{
  const a=rand(seed,i)*Math.PI*2,r=Math.sqrt(rand(seed+3,i)),x=cx+Math.cos(a)*rx*r,y=cy+Math.sin(a)*ry*r;
  const h=3.6+rand(seed+5,i)*5.2;
  return <g key={'g'+seed+'-'+i} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}>
   <path d={`M0 ${h*.6}v${h*.45}`} stroke="#403b26" strokeWidth=".65"/>
   <path d={`M0 0l${-h*.55} ${h*.68}h${h*1.1}Z`} fill={i%4===0?'#253e34':i%3?'#2d5239':'#52744a'}/>
   <path d={`M0 ${h*.25}l${-h*.47} ${h*.65}h${h*.94}Z`} fill={i%3?'#355d43':'#456b45'}/>
  </g>;
 });
}
export default function AtlasBiomeRelief({paths}){
 const peakDetails=useMemo(()=>mountainGroups.flatMap(g=>Array.from({length:g.n},(_,i)=>{
  const x=g.x+i*g.dx+(rand(g.seed+7,i)-.5)*16;
  const y=g.y+Math.sin(i*.83)*g.dy+(rand(g.seed+9,i)-.5)*16;
  const s=8+rand(g.seed+11,i)*14;
  return crest(x,y,s,g.ice,'crest-'+g.seed+'-'+i);
 })),[]);
 const forestDetails=useMemo(()=>valleys.flatMap(v=>grove(v.cx,v.cy,v.rx,v.ry,v.n,v.seed)),[]);
 return <g className="ils-biome-atlas" pointerEvents="none" aria-hidden="true">
  <defs>
   <linearGradient id="ils-west-lava" x1="0" x2=".8" y1="0" y2="1">
    <stop stopColor="#6d402d"/><stop offset=".42" stopColor="#a24924"/><stop offset=".78" stopColor="#8e351d"/><stop offset="1" stopColor="#4c2925"/>
   </linearGradient>
   <linearGradient id="ils-north-snow" x1=".1" x2=".8" y1="0" y2="1">
    <stop stopColor="#f3efe4"/><stop offset=".5" stopColor="#bec9c7"/><stop offset="1" stopColor="#718a8b"/>
   </linearGradient>
   <linearGradient id="ils-dry-east" x1="0" x2="1" y1="0" y2="1">
    <stop stopColor="#a58d50"/><stop offset=".65" stopColor="#cc9a55"/><stop offset="1" stopColor="#bb7440"/>
   </linearGradient>
   <radialGradient id="ils-volcano">
    <stop stopColor="#fdb13e"/><stop offset=".3" stopColor="#dc5124"/><stop offset=".62" stopColor="#703326"/><stop offset="1" stopColor="#402d2d"/>
   </radialGradient>
   <pattern id="ils-terrain-hatch" width="15" height="12" patternUnits="userSpaceOnUse">
    <path d="M0 6L7 2M8 12L15 7" stroke="#362e27" strokeWidth=".48" opacity=".48"/>
   </pattern>
   <filter id="ils-terrain-grain" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency=".08" numOctaves="3" seed="32" stitchTiles="stitch"/>
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="linear" slope=".18"/></feComponentTransfer>
   </filter>
  </defs>
  <g clipPath="url(#ils-clip-aldenard)">
   <path d={paths.aldenard} fill="url(#ils-west-lava)" opacity=".92"/>
   <path d="M 92 375 Q 175 344 277 371 Q 357 419 360 519 Q 318 603 272 651 L 178 579 L 103 476 Z" fill="#9b411e" opacity=".7"/>
   <path d="M 117 401 Q 206 390 252 438 Q 315 450 353 553" fill="none" stroke="#db7f35" strokeWidth="24" opacity=".15"/>
   <path d="M 125 407 Q 166 390 192 427 L 241 445 Q 263 466 278 504" fill="none" stroke="#402a29" strokeWidth="37" opacity=".43"/>
   <path d="M 164 460 Q 202 445 225 477 L 272 484 Q 299 528 287 570" fill="none" stroke="#3b241f" strokeWidth="14" opacity=".34"/>
   <ellipse cx="244" cy="500" rx="61" ry="45" fill="#49302c" opacity=".62"/>
   <path d="M190 517 L225 478 L244 418 L270 482 L304 519 L275 507 L245 499 L220 521 Z" fill="#382725" stroke="#a55d2f" strokeWidth="2"/>
   <path d="M226 474 L244 418 L259 473 L250 459 L245 435 L239 458Z" fill="#ee5b25" stroke="#ffc46a" strokeWidth="1"/>
   <path d="M227 473L238 454L243 471L234 469Z M248 459L252 450L259 474Z" fill="#f9a52d"/>
   <ellipse cx="247" cy="494" rx="18" ry="6" fill="url(#ils-volcano)" opacity=".85"/>
   <path d="M 145 550 Q 189 536 227 552 Q 262 565 291 605" fill="none" stroke="#532e22" strokeWidth="15" opacity=".3"/>
   <path d={paths.aldenard} fill="url(#ils-terrain-hatch)" opacity=".18"/>
  </g>
  <g clipPath="url(#ils-clip-ilsabard)">
   <path d="M 279 189 Q 350 101 473 87 Q 574 100 661 180 Q 738 207 813 265 L 803 325 Q 679 302 606 276 Q 541 276 466 296 Q 399 300 334 268 Z" fill="url(#ils-north-snow)" opacity=".94"/>
   <path d="M290 194 Q385 101 470 126 Q575 127 674 201 Q737 220 780 273" fill="none" stroke="#f4f4e7" strokeWidth="28" opacity=".4"/>
   <path d="M 322 259 Q 417 287 503 277 Q 628 257 700 312" stroke="#5b6556" strokeWidth="22" opacity=".2" fill="none"/>
   <path d="M 338 324 Q 426 288 519 319 Q 581 351 641 342" fill="none" stroke="#4f704c" strokeWidth="45" opacity=".35"/>
   <path d="M346 389 Q420 403 475 385 Q516 410 567 406" fill="none" stroke="#466f4c" strokeWidth="24" opacity=".36"/>
   <path d="M392 427 Q448 395 498 414 Q554 431 614 403" stroke="#a7a16a" strokeWidth="28" opacity=".36" fill="none"/>
   <path d="M 498 267 Q 517 310 500 344 Q 480 376 515 401 Q 507 439 536 468" fill="none" stroke="#265764" strokeWidth="8" opacity=".7"/>
   <path d="M 498 267 Q 517 310 500 344 Q 480 376 515 401 Q 507 439 536 468" fill="none" stroke="#a1c9be" strokeWidth="3.2"/>
   <path d="M 571 312 Q 550 342 568 358 Q 592 384 581 406" fill="none" stroke="#91c5b5" strokeWidth="2.4"/>
  </g>
  <g clipPath="url(#ils-clip-othard)">
   <path d="M 631 308 Q 703 285 767 319 Q 830 341 913 348 L 916 440 Q 874 457 834 473 Q 770 456 732 484 Q 687 439 644 403 Z" fill="#4e7544" opacity=".66"/>
   <path d="M 791 397 Q 874 389 921 438 Q 943 482 899 537 L 847 593 Q 802 595 770 544 Q 772 483 791 397 Z" fill="url(#ils-dry-east)" opacity=".8"/>
   <path d="M 806 444 Q 857 425 900 453 Q 923 490 879 534 L 833 578 Q 793 545 806 444 Z" fill="#dbab6f" opacity=".4"/>
   <path d="M 644 374 Q 724 337 774 387 Q 790 421 774 468" fill="none" stroke="#284d40" strokeWidth="30" opacity=".37"/>
   <path d="M 833 345 Q 884 375 904 412" fill="none" stroke="#375b40" strokeWidth="38" opacity=".32"/>
   <path d="M 720 328 Q 749 355 727 392 T 767 454 Q 754 486 780 531" fill="none" stroke="#345a63" strokeWidth="8" opacity=".65"/>
   <path d="M 720 328 Q 749 355 727 392 T 767 454 Q 754 486 780 531" fill="none" stroke="#a5cfc4" strokeWidth="2.8"/>
   <path d="M 790 483 Q 820 496 838 523 T 865 558" fill="none" stroke="#d6ba85" strokeWidth="17" opacity=".25"/>
   <path d="M 668 420 Q 694 401 711 426" fill="none" stroke="#b7b06c" strokeWidth="11" opacity=".35"/>
  </g>
  <g clipPath="url(#ils-clip-all)">
   <rect width="1000" height="700" filter="url(#ils-terrain-grain)" opacity=".42"/>
   <g>{forestDetails}</g>
   <g>{peakDetails}</g>
  </g>
 </g>;
}
