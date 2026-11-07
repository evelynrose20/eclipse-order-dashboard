import React from 'react';
// The same Font Awesome 6 Free Solid stylesheet is loaded globally by index.html.
// Dashboard navigation and all editable map markers share this icon source.
// A direct fa-* name may be entered for any other Free Solid icon.
export const SITE_MARKER_OPTIONS=[
 ['settlement','Settlement','house'],['capital','Capital','crown'],['village','Village','house-chimney'],
 ['mine','Mine','person-digging'],['factory','Factory','industry'],['refinery','Refinery','flask'],
 ['fortress','Fortress','shield-halved'],['outpost','Outpost','flag'],['farm','Farm','wheat-awn'],
 ['port','Port','anchor'],['depot','Depot','boxes-stacked'],['ruins','Ruins','landmark-dome'],
 ['landmark','Landmark','monument'],['lumber_yard','Lumberyard','tree'],
 ['logging_camp','Logging camp','tree-city'],['sawmill','Sawmill','screwdriver-wrench'],
 ['forest','Forest','tree'],['orchard','Orchard','seedling'],['ranch','Ranch','cow'],
 ['fishery','Fishery','fish'],['quarry','Quarry','mountain'],['workshop','Workshop','hammer'],
 ['warehouse','Warehouse','warehouse'],['barracks','Barracks','person-military-rifle'],
 ['watchtower','Watchtower','tower-observation'],['bridge','Bridge','bridge'],
 ['market','Market','store'],['hospital','Hospital','hospital'],['laboratory','Laboratory','microscope'],
 ['power_plant','Power plant','bolt'],['rail_station','Rail station','train'],
 ['rail_depot','Rail depot','train-subway'],['airfield','Airfield','plane'],
 ['ceruleum_plant','Ceruleum plant','gas-pump'],['drilling_rig','Drilling rig','oil-well'],
 ['logging_road','Logging road','road'],['military_base','Military base','shield'],
 ['temple','Temple','landmark'],['lighthouse','Lighthouse','tower-observation']
];
const safeIconName=value=>typeof value==='string'&&/^fa-[a-z0-9-]{1,29}$/.test(value);
export const markerIconName=value=>{
 const match=SITE_MARKER_OPTIONS.find(([id])=>id===value);
 if(match)return match[2];
 if(safeIconName(value))return value.slice(3);
 return 'house';
};
export default function SiteIcon({name='house',className='',size,style,...props}){
 const icon=safeIconName(name)?name.slice(3):/^[a-z0-9-]+$/.test(name)?name:'house';
 return <i className={'fa-solid fa-'+icon+(className?' '+className:'')} style={{...(style||{}),...(size?{fontSize:size}:null)}} aria-hidden="true" {...props}/>;
}
