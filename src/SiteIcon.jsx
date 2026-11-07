import React from 'react';

// Shared, dependency-free SVG icon system. All icons use the same 24px outline
// coordinate space and the same stroke proportions. SiteIcon is reusable in
// navigation, world maps, forms, events and later citizen/industry views.
const catalog={
 'map-pin':'M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z|M12 10h.01',
 'house':'M3 10 12 3l9 7|M5 9v12h14V9|M9 21v-7h6v7',
 'castle':'M3 21V9h4V5h4v4h2V5h4v4h4v12Z|M9 21v-6h6v6|M7 11h.01|M17 11h.01',
 'building-2':'M4 22V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v17|M2 22h20|M8 7h2|M14 7h2|M8 11h2|M14 11h2|M8 15h2|M14 15h2',
 'mountain':'m2 20 8-13 4 6 3-4 5 11Z|M8 12l2-2 2 2',
 'mountain-snow':'m2 20 8-15 4 7 3-4 5 12Z|m7 6 3 3 2-3',
 'pickaxe':'m14 7-7 7|M3 21l6-6|M16 3a6 6 0 0 1 5 5c-3-2-6-2-8 0l-2-2 5-3Z',
 'factory':'M3 21V10l6 4V10l6 4V4h6v17Z|M6 18h2|M12 18h2|M18 18h2',
 'flask-conical':'M9 3h6|M10 3v7L4 20a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1l-6-10V3|M7 16h10',
 'shield':'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
 'flag':'M4 22V4|M4 5c4-3 8 3 12 0v10c-4 3-8-3-12 0',
 'wheat':'M12 22V4|M7 7c3 0 5 3 5 5|M17 7c-3 0-5 3-5 5|M7 13c3 0 5 3 5 5|M17 13c-3 0-5 3-5 5',
 'anchor':'M12 2v18|M8 6h8|M5 15a7 7 0 0 0 14 0|m5 15-3 2|m14 2-3-2',
 'package':'m12 2 9 5v10l-9 5-9-5V7Z|m3 7 9 5 9-5|M12 12v10|m7 4 9 5',
 'landmark':'M3 10h18|M5 10v9|M10 10v9|M14 10v9|M19 10v9|M2 21h20|M2 8l10-6 10 6',
 'trees':'M5 20 2 16l3-4-2-3 4-6 4 6-2 3 3 4-3 4Z|M7 20v2|m16 20-4-5 3-4-2-3 3-5 4 5-2 3 3 4-4 5Z|M16 20v2',
 'tree-pine':'M12 22v-4|M3 18l9-10 9 10Z|M5 12l7-9 7 9',
 'axe':'m4 20 11-11|M15 3c2 1 4 3 5 6l-6 6-5-5Z',
 'logs':'M4 7h16v4H4Z|M3 14h16v4H3Z|M5 14l4-3|M10 18l4-7',
 'warehouse':'m3 9 9-6 9 6v12H3Z|M7 21V12h10v9|M7 16h10|M7 19h10',
 'truck':'M2 6h12v11H2Z|M14 10h4l4 4v3h-8|M6 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z|M18 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
 'train':'M6 2h12v16H6Z|M6 7h12|M9 21h6|M8 18l-2 4|M16 18l2 4|M9 13h.01|M15 13h.01',
 'route':'M4 6h.01|M4 6c7 0 3 12 11 12h5|M20 18l-3-3|M20 18l-3 3|M4 6l2-2',
 'git-merge':'M6 3v12a6 6 0 0 0 6 6|M6 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z|M12 19a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z|M18 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z|M18 7v4a6 6 0 0 1-6 6',
 'hospital':'M4 21V5h16v16|M2 21h20|M9 21v-5h6v5|M12 7v6|M9 10h6',
 'construction':'M2 20h20|M5 20V6h10|M5 9h10|M15 6l6 7|M17 15h4',
 'hammer':'M15 3l6 6-3 3-6-6Z|M13 9 5 21l-3-3 12-8',
 'gear':'M12 3v3|M12 18v3|M3 12h3|M18 12h3|m5.6 5.6 2.2 2.2|m8.6 8.6 5.6 5.6|m18.4 5.6-2.2 2.2|m8.6 15.4-3 3|M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
 'wrench':'M14.7 6a5 5 0 0 0-6.5 6.5L3 18l3 3 5.5-5.2A5 5 0 0 0 18 9l-4 1-1-4Z',
 'cog':'M12 3v3|M3 12h3|M18 12h3|M12 18v3|M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
 'droplets':'M12 3c-3 5-6 8-6 12a6 6 0 0 0 12 0c0-4-3-7-6-12Z|M9 16c.5 1.5 1.5 2 3 2',
 'fish':'M3 12c4-7 10-7 15 0-5 7-11 7-15 0Z|M18 12l4-4v8Z|M7 11h.01',
 'ship':'M3 14l9 7 9-7-2-5H5Z|M12 9V2|M7 6h10|M5 21l2 1|M19 21l-2 1',
 'tower-control':'M5 22h14|M8 22l2-15h4l2 15|M7 7h10l-2-4H9Z|M12 1v2',
 'fuel':'M4 21V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17|M4 9h12|M16 7l4 4v7a2 2 0 0 0 4 0v-6|M3 21h14',
 'drill':'M3 8h14l4 4-4 4H3Z|M7 8v8|M11 8v8|M15 8v8',
 'pickaxe-crossed':'m3 20 13-14|m5 4 15 16|m-2-16 2 2-2 2',
 'briefcase-business':'M3 8h18v12H3Z|M8 8V5h8v3|M3 13h18|M11 13h2',
 'store':'M3 8l2-5h14l2 5v3H3Z|M5 11v10h14V11|M9 21v-7h6v7',
 'circle-dot':'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z|M12 12h.01',
 'map':'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3Z|M9 3v15|M15 6v15',
 'search':'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z|m21 21-4.4-4.4',
 'users':'M16 20a5 5 0 0 0-10 0|M11 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z|M20 20a4 4 0 0 0-3-4|M17 4a4 4 0 0 1 0 8',
 'scroll-text':'M8 21H4a2 2 0 0 1-2-2V5a3 3 0 0 1 6 0v14a2 2 0 0 0 4 0V4h10v15a2 2 0 0 1-2 2Z|M6 9h.01|M16 9h3|M16 13h3',
 'swords':'M4 20 18 6|M3 15l6 6|M14 3l7 7|M20 20 6 6|M15 21l6-6|M3 10l7-7',
 'calendar-days':'M3 6h18v16H3Z|M7 3v6|M17 3v6|M3 11h18|M7 15h.01',
 'shield-check':'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z|m8 12 3 3 5-6',
 'layout-dashboard':'M3 3h7v7H3Z|M14 3h7v7h-7Z|M3 14h7v7H3Z|M14 14h7v7h-7Z',
 'settings':'M12 3v3|M3 12h3|M18 12h3|M12 18v3|M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
 'compass':'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z|m16 8-3 7-7 3 3-7Z'
};
export const SITE_ICON_NAMES=Object.keys(catalog);
export const SITE_MARKER_OPTIONS=[
 ['settlement','Settlement','house'],['capital','Capital','castle'],['village','Village','building-2'],['mine','Mine','pickaxe'],
 ['factory','Factory','factory'],['refinery','Refinery','flask-conical'],['fortress','Fortress','shield'],
 ['outpost','Outpost','flag'],['farm','Farm','wheat'],['port','Port','anchor'],['depot','Depot','package'],
 ['ruins','Ruins','landmark'],['landmark','Landmark','map-pin'],
 ['lumberyard','Lumberyard','logs'],['sawmill','Sawmill','axe'],['logging-camp','Logging camp','tree-pine'],
 ['forest','Forest','trees'],['quarry','Quarry','mountain'],['ranch','Ranch','wheat'],['fishery','Fishery','fish'],
 ['hospital','Hospital','hospital'],['barracks','Barracks','shield-check'],['rail-station','Rail station','train'],
 ['road-junction','Road junction','git-merge'],['warehouse','Warehouse','warehouse'],['market','Market','store'],
 ['workshop','Workshop','hammer'],['ceruleum-plant','Ceruleum plant','fuel'],['drilling-rig','Drilling rig','drill'],
 ['watchtower','Watchtower','tower-control'],['bridge','Bridge','route'],['power-plant','Power plant','factory'],
 ['government','Government','landmark'],['military-base','Military base','swords'],
 ['mountain','Mountain','mountain-snow'],['camp','Camp','flag'],['airship-dock','Airship dock','ship'],
 ['cargo-terminal','Cargo terminal','truck']
];
export const markerIconName=id=>SITE_MARKER_OPTIONS.find(x=>x[0]===id)?.[2]||'map-pin';
export default function SiteIcon({name='map-pin',size=20,className='',strokeWidth=1.9,...rest}){
 const content=(catalog[name]||catalog['map-pin']).split('|');
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={'eo-site-icon '+className} aria-hidden="true" focusable="false" {...rest}>
  {content.map((d,i)=><path d={d} key={i}/>)}
 </svg>;
}
