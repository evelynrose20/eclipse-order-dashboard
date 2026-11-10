import React from 'react';
/** Shares the native terrain treatment used by the territory map. */
export default function LogisticsTerrain(){return (
<svg className="supply-terrain" viewBox="0 0 900 560" preserveAspectRatio="none" aria-hidden="true">
    <defs>
     <radialGradient id="supply-terrain-map-vignette"><stop offset="0" stopColor="#405360" stopOpacity=".16"/><stop offset="1" stopColor="#050b12" stopOpacity=".85"/></radialGradient>
     <pattern id="supply-terrain-map-contour" width="125" height="90" patternUnits="userSpaceOnUse" patternTransform="rotate(-21)"><path d="M -30 28 C 15 -3 74 60 130 22 M -30 55 C 30 23 72 86 145 53 M -25 82 C 45 51 93 116 145 78" fill="none" stroke="#a6ac9f" strokeWidth="1.2" opacity=".19"/></pattern>
     <linearGradient id="supply-terrain-ridge" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#6c726f" stopOpacity=".5"/><stop offset="1" stopColor="#1f353e" stopOpacity=".2"/></linearGradient>
    </defs>
    <rect width="900" height="560" fill="#1a2a33"/>
    <path d="M-20 150 105 80 201 130 276 40 390 124 514 50 638 124 725 40 904 102V0H0Z" fill="url(#supply-terrain-ridge)" opacity=".72"/>
    <path d="M-25 300 95 235 172 298 281 195 361 245 468 180 559 267 660 210 755 278 927 191V575H-25Z" fill="#273f45" opacity=".58"/>
    <path d="M0 425 143 359 260 419 350 312 468 350 560 306 663 372 770 320 906 379V560H0Z" fill="#1c333d" opacity=".7"/>
    <rect width="900" height="560" fill="url(#supply-terrain-map-contour)"/>
    <rect width="900" height="560" fill="url(#supply-terrain-map-vignette)"/>
    <path d="M20 18h55 M20 18v55 M880 18h-55 M880 18v55 M20 542h55 M20 542v-55 M880 542h-55 M880 542v-55" stroke="#d1bd96" opacity=".45" strokeWidth="2" fill="none"/>
   </svg>
)}
