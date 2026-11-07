import React,{useEffect,useMemo,useRef,useState} from 'react';
import './world-territory-map.css';
import MapIconPicker from './MapIconPicker.jsx';
export const ICON_OPTIONS=[['settlement','Settlement','house'],['capital','Capital','crown'],['village','Village','house-chimney'],['mine','Mine','person-digging'],['factory','Factory','industry'],['refinery','Refinery','flask'],['fortress','Fortress','shield-halved'],['outpost','Outpost','flag'],['farm','Farm','wheat-awn'],['port','Port','anchor'],['depot','Depot','boxes-stacked'],['ruins','Ruins','landmark-dome'],['landmark','Landmark','monument'],['lumber_yard','Lumberyard','tree'],['logging_camp','Logging camp','tree-city'],['sawmill','Sawmill','screwdriver-wrench'],['forest','Forest','tree'],['orchard','Orchard','seedling'],['ranch','Ranch','cow'],['fishery','Fishery','fish'],['ceruleum_plant','Ceruleum processing plant','gas-pump'],['drilling_rig','Drilling rig','oil-well'],['rail_depot','Rail depot','train-subway'],['logging_road','Logging road','road'],['military_base','Military base','shield'],['lighthouse','Lighthouse','tower-observation'],['quarry','Quarry','mountain'],['workshop','Workshop','hammer'],['warehouse','Warehouse','warehouse'],['barracks','Barracks','person-military-rifle'],['watchtower','Watchtower','tower-observation'],['bridge','Bridge','bridge'],['market','Market','store'],['hospital','Hospital','hospital'],['laboratory','Laboratory','microscope'],['power_plant','Power plant','bolt'],['rail_station','Rail station','train'],['airfield','Airfield','plane']];
export const STATUS_OPTIONS=[['peaceful','Peaceful'],['secure','Secure'],['contested','Contested'],['occupied','Occupied'],['liberated','Liberated'],['rebuilding','Rebuilding'],['abandoned','Abandoned'],['destroyed','Destroyed']];
export const ROUTE_OPTIONS=[['road','Road'],['trail','Trail'],['rail','Railway'],['skyway','Air route'],['waterway','Water route']];
const iconFor=name=>'fa-solid fa-'+(ICON_OPTIONS.find(x=>x[0]===name)?.[2]||(/^(fa-[a-z0-9-]{1,29})$/.test(name||'')?name.slice(3):'house'));
const pct=n=>Math.min(100,Math.max(0,Math.round(Number(n)*100)/100));
const routeClass=type=>'wa-route-'+(type||'road');
// Draw a smooth mapped road through optional manual bend points. Roads remain
// editable via the same authored waypoints; no fake distances or travel times.
export function smoothRoadPath(points){
 if(!Array.isArray(points)||points.length<2)return '';
 const p=points.map(v=>({x:Number(v.x),y:Number(v.y)}));
 if(p.some(v=>!Number.isFinite(v.x)||!Number.isFinite(v.y)))return '';
 let path='M '+p[0].x+' '+p[0].y;
 for(let i=0;i<p.length-1;i++){
  const before=p[Math.max(i-1,0)],current=p[i],next=p[i+1],after=p[Math.min(i+2,p.length-1)];
  const cp1={x:current.x+(next.x-before.x)/6,y:current.y+(next.y-before.y)/6};
  const cp2={x:next.x-(after.x-current.x)/6,y:next.y-(after.y-current.y)/6};
  path+=' C '+cp1.x+' '+cp1.y+' '+cp2.x+' '+cp2.y+' '+next.x+' '+next.y;
 }
 return path;
}
const normalizeWaypoints=route=>Array.isArray(route.waypoints)?route.waypoints:[];
const normalize=(s,map)=>({...s,...(map[s.id]||{})});
function polyline(route,byId){
 const start=byId.get(Number(route.from_settlement_id)),end=byId.get(Number(route.to_settlement_id));
 if(!start||!end)return [];
 const convert=p=>({x:Number(p.map_x??p.x),y:Number(p.map_y??p.y)});
 return [convert(start),...normalizeWaypoints(route),convert(end)];
}
export default function WorldTerritoryMap({region,settlements,routes=[],networkNodes=[],networkSegments=[],mountains=[],canEdit=false,selected,onSelect,request,onSaved}){
 const [mode,setMode]=useState('view'),[positions,setPositions]=useState({}),[routeStart,setRouteStart]=useState(null);
 const [routeType,setRouteType]=useState('road'),[routeName,setRouteName]=useState(''),[selectedRoute,setSelectedRoute]=useState(null),[draftWaypoints,setDraftWaypoints]=useState([]);
 const [routeEnd,setRouteEnd]=useState(null),[newRoutePoints,setNewRoutePoints]=useState([]),[routeDirty,setRouteDirty]=useState(false);
 const [junctionAction,setJunctionAction]=useState(''),[junctionPositions,setJunctionPositions]=useState({});
 const [mountainId,setMountainId]=useState(''),[mountainName,setMountainName]=useState(''),[mountainPoints,setMountainPoints]=useState([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const mapRef=useRef(null),dragRef=useRef(null),suppressRef=useRef(false);
 useEffect(()=>{setMode('view');setPositions({});setRouteStart(null);setRouteEnd(null);setNewRoutePoints([]);setRouteDirty(false);setSelectedRoute(null);setDraftWaypoints([]);setMountainId('');setMountainName('');setMountainPoints([]);setJunctionAction('');setJunctionPositions({});setError('');setNotice('')},[region?.id]);
 const displayed=useMemo(()=>settlements.map(s=>normalize(s,positions)),[settlements,positions]);
 const byId=useMemo(()=>new Map(displayed.map(s=>[Number(s.id),s])),[displayed]);
 const graphNodes=useMemo(()=>new Map(networkNodes.map(n=>[Number(n.id),{...n,...(junctionPositions[n.id]||{})}])),[networkNodes,junctionPositions]);
 const graphSelected=String(selectedRoute||'').startsWith('graph:');
 const currentRoute=graphSelected?networkSegments.find(r=>String(r.id)===String(selectedRoute).slice(6)):routes.find(r=>String(r.id)===String(selectedRoute).replace('legacy:',''));
 const graphPoint=node=>{if(!node)return null;const site=byId.get(Number(node.settlement_id));return site?{x:Number(site.map_x),y:Number(site.map_y)}:{x:Number(node.map_x),y:Number(node.map_y)}};
 const graphPoints=(route,waypoints=normalizeWaypoints(route))=>{
  const start=graphPoint(graphNodes.get(Number(route.from_node_id))),end=graphPoint(graphNodes.get(Number(route.to_node_id)));
  return start&&end?[start,...waypoints,end]:[];
 };
 const pointsForRoute=(r,waypoints=normalizeWaypoints(r))=>r?.from_node_id?graphPoints(r,waypoints):r?polyline({...r,waypoints},byId):[];
 const pointForRef=id=>id==null?null:Number(id)<0?graphPoint(graphNodes.get(-Number(id))):(()=>{const site=byId.get(Number(id));return site?{x:Number(site.map_x),y:Number(site.map_y)}:null})();
 const labelForRef=id=>id==null?'Choose endpoint':Number(id)<0?(graphNodes.get(-Number(id))?.name||'Junction #'+(-Number(id))):(byId.get(Number(id))?.name||'Unknown place');
 const chooseEndpoint=id=>{if(routeStart==null||routeEnd!=null){setRouteStart(id);setRouteEnd(null);setNewRoutePoints([]);setNotice('Select the destination, then draw bends before saving.');return}if(Number(routeStart)===Number(id)){setRouteStart(null);return}setRouteEnd(id);setNotice('Endpoints selected. Draw bends on the map, then save.')};
 const editableRoute=currentRoute?(graphSelected?{region_id:Number(region.id),from_node_id:Number(currentRoute.from_node_id),to_node_id:Number(currentRoute.to_node_id),route_type:routeType,route_name:routeName,waypoints:draftWaypoints}:{region_id:Number(region.id),from_settlement_id:Number(currentRoute.from_settlement_id),to_settlement_id:Number(currentRoute.to_settlement_id),route_type:routeType,route_name:routeName,waypoints:draftWaypoints}):null;
 const previewPoints=routeStart!=null&&routeEnd!=null&&pointForRef(routeStart)&&pointForRef(routeEnd)?[pointForRef(routeStart),...newRoutePoints,pointForRef(routeEnd)]:[];
 const currentMountain=mountains.find(m=>String(m.id)===mountainId);
 const segmentPts=r=>polyline(r,byId);
 const activePoints=currentRoute?pointsForRoute(currentRoute,draftWaypoints):[];
 const coords=e=>{const rect=mapRef.current?.getBoundingClientRect();if(!rect||!rect.width||!rect.height)return null;return {x:pct((e.clientX-rect.left)*100/rect.width),y:pct((e.clientY-rect.top)*100/rect.height)}};
 const reload=async()=>{await onSaved?.();setPositions({})};
 async function persistMarker(s,p){
  if(!canEdit||busy)return;
  setBusy(true);setError('');setNotice('');
  try{await request('/world-admin/settlements/'+s.id+'/map',{method:'POST',body:{map_x:p.x,map_y:p.y,map_icon:s.map_icon||'settlement'}});await reload();setNotice('Location saved.')}
  catch(e){setPositions({});setError(e.message||'Map position could not be saved.')}finally{setBusy(false)}
 }
 function pointerDown(e,s){
  if(!canEdit||mode!=='move'||busy)return;
  e.preventDefault();e.stopPropagation();
  const p=coords(e);if(!p)return;
  dragRef.current={id:s.id,old:{x:Number(s.map_x),y:Number(s.map_y)},moved:false};
  e.currentTarget.setPointerCapture(e.pointerId);
  onSelect(String(s.id));
 }
 function pointerMove(e){
  const drag=dragRef.current;if(!drag)return;
  const p=coords(e);if(!p)return;
  if(Math.hypot(p.x-drag.old.x,p.y-drag.old.y)>.25)drag.moved=true;
  if(drag.moved)setPositions(old=>({...old,[drag.id]:{map_x:p.x,map_y:p.y}}));
 }
 function pointerUp(e){
  const drag=dragRef.current;if(!drag)return;
  dragRef.current=null;suppressRef.current=drag.moved;
  const p=coords(e);
  if(p&&drag.moved){const original=settlements.find(s=>s.id===drag.id);if(original)void persistMarker(original,p)}
 }
 async function changeIcon(value){
  const s=displayed.find(s=>String(s.id)===String(selected));if(!s||!canEdit||busy)return;
  setBusy(true);setError('');setNotice('');
  try{await request('/world-admin/settlements/'+s.id+'/map',{method:'POST',body:{map_x:Number(s.map_x),map_y:Number(s.map_y),map_icon:value}});await reload();setNotice('Map symbol changed.')}
  catch(e){setError(e.message||'Symbol could not be saved.')}finally{setBusy(false)}
 }
 async function changeState(value){
  const s=displayed.find(x=>String(x.id)===String(selected));
  if(!s||!canEdit||busy)return;
  setBusy(true);setError('');setNotice('');
  try{await request('/world-admin/settlements/'+s.id+'/state',{method:'POST',body:{strategic_state:value}});await reload();setNotice('Territory state updated.')}
  catch(e){setError(e.message||'Territory state could not be saved.')}finally{setBusy(false)}
 }
 function selectMountain(id){
  setMountainId(id);
  const existing=mountains.find(m=>String(m.id)===id);
  setMountainName(existing?.name||'');
  setMountainPoints(existing?.points?.map(p=>({...p}))||[]);
 }
 async function saveMountain(){
  if(!canEdit||busy||!mountainName.trim()||mountainPoints.length<2)return;
  setBusy(true);setError('');setNotice('');
  try{
   await request('/world-admin/mountains'+(mountainId?'/'+mountainId:''),{method:mountainId?'PUT':'POST',body:{region_id:Number(region.id),name:mountainName.trim(),points:mountainPoints}});
   await reload();selectMountain('');setNotice('Mountain range saved.');
  }catch(e){setError(e.message||'Mountain range could not be saved.')}finally{setBusy(false)}
 }
 async function deleteMountain(){
  if(!canEdit||!mountainId||busy)return;
  setBusy(true);setError('');setNotice('');
  try{await request('/world-admin/mountains/'+mountainId,{method:'DELETE'});await reload();selectMountain('');setNotice('Mountain range removed.')}
  catch(e){setError(e.message||'Mountain range could not be deleted.')}finally{setBusy(false)}
 }
 function selectPin(s){
  if(suppressRef.current){suppressRef.current=false;return}
  onSelect(String(s.id));
  if(canEdit&&mode==='link'){
   chooseEndpoint(Number(s.id));
  }
 }
 async function saveRoute(payload,id=null,isGraph=false){
  if(!canEdit||busy)return;
  setBusy(true);setError('');setNotice('');
  try{
   await request(isGraph?'/world-admin/network/segments/'+id:'/world-admin/routes'+(id?'/'+id:''),{method:id?'PUT':'POST',body:payload});
   await reload();
   setRouteStart(null);setRouteEnd(null);setNewRoutePoints([]);setRouteDirty(false);
   setSelectedRoute(null);setDraftWaypoints([]);setNotice(id?'Route changes saved.':'New route created.');
  }catch(e){setError(e.message||'The road could not be saved.')}finally{setBusy(false)}
 }
 async function deleteRoute(){
  if(!currentRoute||!canEdit||busy)return;
  setBusy(true);setError('');
  try{await request(graphSelected?'/world-admin/network/segments/'+currentRoute.id:'/world-admin/routes/'+currentRoute.id,{method:'DELETE'});await reload();setSelectedRoute(null);setDraftWaypoints([]);setNotice('Route deleted.')}
  catch(e){setError(e.message||'Unable to delete route.')}finally{setBusy(false)}
 }

 async function mutation(path,method,body,success){
  if(!canEdit||busy)return null;
  setBusy(true);setError('');setNotice('');
  try{const value=await request(path,{method,body});await reload();setNotice(success);return value}
  catch(e){setError(e.message||'Unable to update the road network.');return null}
  finally{setBusy(false)}
 }
 async function endpointNode(id){
  if(Number(id)<0)return -Number(id);
  const previous=networkNodes.find(n=>Number(n.settlement_id)===Number(id));
  if(previous)return Number(previous.id);
  const data=await request('/world-admin/network/nodes',{method:'POST',body:{region_id:Number(region.id),settlement_id:Number(id)}});
  if(!data?.id)throw new Error('Unable to connect the settlement.');
  return Number(data.id);
 }
 async function savePlannedRoute(){
  if(!canEdit||busy||routeStart==null||routeEnd==null||Number(routeStart)===Number(routeEnd))return;
  setBusy(true);setError('');setNotice('');
  try{
   const from=await endpointNode(routeStart),to=await endpointNode(routeEnd);
   if(from===to)throw new Error('A route must have two different endpoints.');
   await request('/world-admin/network/segments',{method:'POST',body:{region_id:Number(region.id),from_node_id:from,to_node_id:to,route_type:routeType,route_name:routeName,waypoints:newRoutePoints}});
   await reload();setRouteStart(null);setRouteEnd(null);setNewRoutePoints([]);setNotice('Route saved on the existing map.');
  }catch(e){setError(e.message||'Unable to save this connection.')}finally{setBusy(false)}
 }
 async function createJunction(p){
  const candidate=networkNodes.find(n=>!n.settlement_id&&Math.hypot(Number(n.map_x)-p.x,Number(n.map_y)-p.y)<1.8);
  if(candidate){setNotice('This junction already exists. Select it as an endpoint.');setJunctionAction('');return}
  const data=await mutation('/world-admin/network/nodes','POST',{region_id:Number(region.id),x:p.x,y:p.y,node_kind:routeType==='rail'?'rail_switch':'junction',name:''},'Junction placed. Select it to connect a route.');
  if(data?.id)setJunctionAction('');
 }
 async function splitRoute(route,e){
  if(!canEdit||busy)return;
  const p=coords(e);if(!p)return;
  const result=await mutation('/world-admin/network/segments/'+route.id+'/split','POST',p,'Shared junction inserted. Plan a route from it to create a branch.');
  if(result?.id){setJunctionAction('');setMode('link');chooseEndpoint(-Number(result.id))}
 }
 function junctionPointerDown(e,n){
  if(mode!=='move'||busy||!canEdit||n.settlement_id)return;
  e.preventDefault();e.stopPropagation();
  dragRef.current={junction:Number(n.id),moved:false};
  e.currentTarget.setPointerCapture(e.pointerId);
 }
 function junctionPointerMove(e){
  if(dragRef.current?.junction===undefined)return;
  const p=coords(e);if(!p)return;
  dragRef.current.moved=true;
  const id=dragRef.current.junction;
  setJunctionPositions(old=>({...old,[id]:{map_x:p.x,map_y:p.y}}));
 }
 async function junctionPointerUp(e,n){
  if(dragRef.current?.junction===undefined)return;
  const moved=dragRef.current.moved;dragRef.current=null;
  if(!moved)return;
  const p=coords(e);if(!p){setJunctionPositions({});return}
  await mutation('/world-admin/network/nodes/'+n.id,'PUT',{x:p.x,y:p.y,node_kind:n.node_kind,name:n.name||''},'Junction moved; all attached routes remain connected.');
  setJunctionPositions({});
 }
 async function importLegacyRoutes(){
  if(!routes.length)return;
  const response=await mutation('/world-admin/network/import','POST',{region_id:Number(region.id)},'Existing routes joined the shared network, preserving their bends and types.');
  if(response){setSelectedRoute(null);setDraftWaypoints([]);setJunctionAction('')}
 }
 function mapClick(e){
  if(!canEdit||busy)return;
  const p=coords(e);if(!p)return;
  if(junctionAction==='place'&&(mode==='link'||mode==='bend')){void createJunction(p);return}
  if(mode==='link'&&routeStart!=null&&routeEnd!=null)setNewRoutePoints(old=>old.length<16?[...old,p]:old);
  if(mode==='bend'&&currentRoute)setDraftWaypoints(old=>{
   if(old.length>=16)return old;
   const line=pointsForRoute(currentRoute,old);
   const dist=(pt,a,b)=>{const vx=b.x-a.x,vy=b.y-a.y,t=Math.max(0,Math.min(1,((pt.x-a.x)*vx+(pt.y-a.y)*vy)/(vx*vx+vy*vy||1)));return Math.hypot(pt.x-a.x-t*vx,pt.y-a.y-t*vy)};
   const segments=line.slice(1).map((point,i)=>({i,d:dist(p,line[i],point)}));
   const nearest=segments.sort((a,b)=>a.d-b.d)[0];
   const next=[...old];next.splice(nearest?.i??old.length,0,p);setRouteDirty(true);return next;
  });
 }
 function selectRoad(r){
  if(mode==='move')return;
  setSelectedRoute((r.from_node_id?'graph:':'legacy:')+r.id);setDraftWaypoints(normalizeWaypoints(r).map(p=>({...p})));setJunctionAction('');
  setRouteType(r.route_type);setRouteName(r.route_name||'');setRouteDirty(false);
  if(mode!=='bend'&&canEdit)setMode('bend');
 }
 function waypointDown(e,i){
  if(!canEdit||mode!=='bend')return;
  e.preventDefault();e.stopPropagation();dragRef.current={waypoint:i};
  e.currentTarget.setPointerCapture(e.pointerId);
 }
 function waypointMove(e){
  if(dragRef.current?.waypoint===undefined)return;
  const p=coords(e);if(!p)return;
  const index=dragRef.current.waypoint;
  setDraftWaypoints(w=>w.map((point,i)=>i===index?p:point));setRouteDirty(true);
 }
 function waypointUp(){if(dragRef.current?.waypoint!==undefined)dragRef.current=null}
 const active=displayed.find(s=>String(s.id)===String(selected));
 const segments=routes.filter(r=>segmentPts(r).length>=2);
 return <div className="wtm-root">
  {canEdit&&<div className="wtm-toolbar">
   <div role="group" aria-label="Territory map editing tools">
    {[['view','Inspect'],['move','Move places'],['link','Plan a route'],['bend','Edit routes'],['mountains','Mountains']].map(([id,name])=><button type="button" key={id} className={mode===id?'active':''} aria-pressed={mode===id} onClick={()=>{setMode(id);setRouteStart(null);setRouteEnd(null);setNewRoutePoints([]);setNotice('');if(id==='mountains')selectMountain('')}}>{name}</button>)}
   </div>

  </div>}
  {error&&<p className="wtm-error" role="alert">{error}</p>}
  {notice&&<p className="wtm-note" role="status">{notice}</p>}
  <div className="wtm-map-frame">
  <div className="wtm-map-title"><span>STRATEGIC CARTOGRAPHY</span><strong>{region.name}</strong><small>{mode==='view'?'SURVEY VIEW':'CARTOGRAPHER MODE · '+mode.toUpperCase()}</small></div>
  <div className={'wtm-stage '+(mode!=='view'?'wtm-editing':'')+(region.map_background_url?' wtm-with-image':'')} ref={mapRef} onClick={mapClick} style={region.map_background_url?{backgroundImage:'linear-gradient(#101b25a9,#101b25a9),url("'+region.map_background_url+'")'}:{}}>
   <svg className="wtm-terrain" viewBox="0 0 900 560" preserveAspectRatio="none" aria-hidden="true">
    <defs>
     <radialGradient id="wtm-map-vignette"><stop offset="0" stopColor="#405360" stopOpacity=".16"/><stop offset="1" stopColor="#050b12" stopOpacity=".85"/></radialGradient>
     <pattern id="wtm-map-contour" width="125" height="90" patternUnits="userSpaceOnUse" patternTransform="rotate(-21)"><path d="M -30 28 C 15 -3 74 60 130 22 M -30 55 C 30 23 72 86 145 53 M -25 82 C 45 51 93 116 145 78" fill="none" stroke="#a6ac9f" strokeWidth="1.2" opacity=".19"/></pattern>
     <linearGradient id="wtm-ridge" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#6c726f" stopOpacity=".5"/><stop offset="1" stopColor="#1f353e" stopOpacity=".2"/></linearGradient>
    </defs>
    <rect width="900" height="560" fill="#1a2a33"/>
    <path d="M-20 150 105 80 201 130 276 40 390 124 514 50 638 124 725 40 904 102V0H0Z" fill="url(#wtm-ridge)" opacity=".72"/>
    <path d="M-25 300 95 235 172 298 281 195 361 245 468 180 559 267 660 210 755 278 927 191V575H-25Z" fill="#273f45" opacity=".58"/>
    <path d="M0 425 143 359 260 419 350 312 468 350 560 306 663 372 770 320 906 379V560H0Z" fill="#1c333d" opacity=".7"/>
    <rect width="900" height="560" fill="url(#wtm-map-contour)"/>
    <rect width="900" height="560" fill="url(#wtm-map-vignette)"/>
    <path d="M20 18h55 M20 18v55 M880 18h-55 M880 18v55 M20 542h55 M20 542v-55 M880 542h-55 M880 542v-55" stroke="#d1bd96" opacity=".45" strokeWidth="2" fill="none"/>
   </svg>
   <svg className="wtm-mountains" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Named mountain ranges">
    {mountains.map(m=>{
     const pts=Array.isArray(m.points)?m.points:[];
     if(pts.length<2)return null;
     const path=smoothRoadPath(pts),mid=pts[Math.floor(pts.length/2)];
     return <g key={m.id} className="wtm-range" aria-label={m.name}>
      <path d={path} className="wtm-range-shadow"/>
      <path d={path} className="wtm-range-ridge"/>
      {pts.map((p,i)=><path key={i} d={'M '+(p.x-1.3)+' '+(p.y+1.2)+' L '+p.x+' '+(p.y-1.6)+' L '+(p.x+1.3)+' '+(p.y+1.2)} className="wtm-range-peak"/>)}
      <text x={mid.x} y={Math.max(4,mid.y-3)} textAnchor="middle" className="wtm-range-label">{m.name}</text>
     </g>;
    })}
    {mode==='mountains'&&mountainPoints.length>0&&<g className="wtm-range-draft">
     <path d={mountainPoints.length>=2?smoothRoadPath(mountainPoints):''} className="wtm-range-draft-path"/>
     {mountainPoints.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="1.15" fill="#f2cd8b" stroke="#19232c" strokeWidth=".5"/>)}
    </g>}
   </svg>
   <div className="wtm-map-compass" aria-hidden="true"><span>N</span><b><i className="fa-solid fa-compass"/></b><small>S</small></div>
   <svg className="wtm-network" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Regional road network">
     {networkSegments.map(route=>{const points=graphPoints(route),p=smoothRoadPath(points);return points.length<2?null:<g key={'graph-'+route.id} className={'wtm-road '+routeClass(route.route_type)+(selectedRoute==='graph:'+route.id?' selected':'')}><path d={p} className="wtm-road-base"/><path d={p} className="wtm-road-top"/>{route.route_type==='rail'&&<><path d={p} className="wtm-rail-ties"/><path d={p} className="wtm-rail-center"/></>}<path d={p} className="wtm-road-hit" onClick={e=>{e.stopPropagation();if(junctionAction==='split')void splitRoute(route,e);else selectRoad(route)}}/></g>})}
    {segments.map(route=>{
     const points=segmentPts(route),p=smoothRoadPath(points);
     return <g key={route.id} className={'wtm-road '+routeClass(route.route_type)+(selectedRoute==='legacy:'+route.id?' selected':'')}>
      <path d={p} className="wtm-road-base"/>
      <path d={p} className="wtm-road-top"/>
      {route.route_type==='rail'&&<><path d={p} className="wtm-rail-ties"/><path d={p} className="wtm-rail-center"/></>}
      <path d={p} className="wtm-road-hit" onClick={e=>{e.stopPropagation();selectRoad(route)}}/>
     </g>;
    })}
    {currentRoute&&mode==='bend'&&activePoints.length>1&&<path d={smoothRoadPath(activePoints)} fill="none" stroke="#f2d4a0" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="5 4"/>}
    {previewPoints.length>=2&&mode==='link'&&<path className="wtm-planned-route" d={smoothRoadPath(previewPoints)}/>}
   </svg>
   {displayed.map(s=><button key={s.id} type="button" className={'wtm-pin '+(String(s.id)===String(selected)?'selected ':'')+(routeStart===Number(s.id)?'origin ':'')} data-state={s.strategic_state||'peaceful'} data-type={s.map_icon||'settlement'} style={{left:s.map_x+'%',top:s.map_y+'%'}} onPointerDown={e=>pointerDown(e,s)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={()=>{dragRef.current=null;setPositions({})}} onClick={e=>{e.stopPropagation();selectPin(s)}} title={s.name+' · '+(STATUS_OPTIONS.find(p=>p[0]===s.strategic_state)?.[1]||'Peaceful')} aria-label={s.name+' ('+s.map_icon+'), '+(STATUS_OPTIONS.find(p=>p[0]===s.strategic_state)?.[1]||'Peaceful')}><span className="wtm-pin-icon" aria-hidden="true"><i className={iconFor(s.map_icon)}/></span><span className="wtm-pin-name">{s.name}</span><span className="wtm-pin-state">{STATUS_OPTIONS.find(p=>p[0]===s.strategic_state)?.[1]||"Peaceful"}</span></button>)}
   {canEdit&&junctionAction!=='split'&&((mode==='bend'&&currentRoute)||(mode==='link'&&routeStart!=null&&routeEnd!=null)||((mode==='link'||mode==='bend')&&junctionAction==='place'))&&<div className="wtm-route-draw" onClick={e=>{e.stopPropagation();mapClick(e)}} aria-label="Click the map to add a route bend"/>}
   {canEdit&&mode==='mountains'&&<div className="wtm-mountain-draw" title="Click to add a mountain point" onClick={e=>{const p=coords(e);if(p)setMountainPoints(old=>old.length<16?[...old,p]:old)}}/>}
   {mode==='bend'&&currentRoute&&draftWaypoints.map((p,i)=><button className="wtm-waypoint" key={i} type="button" aria-label={'Route bend '+(i+1)} style={{left:p.x+'%',top:p.y+'%'}} onPointerDown={e=>waypointDown(e,i)} onPointerMove={waypointMove} onPointerUp={waypointUp} onPointerCancel={waypointUp} onClick={e=>e.stopPropagation()}/>)}
   {mode==='link'&&routeStart!=null&&routeEnd!=null&&newRoutePoints.map((p,i)=><span className="wtm-plan-point" key={i} style={{left:p.x+'%',top:p.y+'%'}}/>)}

   {(mode==='link'||mode==='bend'||mode==='move')&&networkNodes.filter(n=>!n.settlement_id).map(n=>{
    const p=graphPoint(graphNodes.get(Number(n.id)));
    return p?<button key={'junction-'+n.id} type="button" className={'wtm-junction '+((Number(routeStart)===-Number(n.id)||Number(routeEnd)===-Number(n.id))?'endpoint':'')} style={{left:p.x+'%',top:p.y+'%'}} title={(n.node_kind==='rail_switch'?'Rail switch':'Junction')+' #'+n.id} aria-label={(n.node_kind==='rail_switch'?'Rail switch':'Junction')+' '+n.id} onClick={e=>{e.stopPropagation();if(mode==='link')chooseEndpoint(-Number(n.id))}} onPointerDown={e=>junctionPointerDown(e,n)} onPointerMove={junctionPointerMove} onPointerUp={e=>void junctionPointerUp(e,n)} onPointerCancel={()=>{dragRef.current=null;setJunctionPositions({})}}><i className={'fa-solid fa-'+(n.node_kind==='rail_switch'?'train-tram':'circle-nodes')} aria-hidden="true"/></button>:null
   })}
   {!displayed.length&&<div className="wtm-blank"><strong>THE SURVEY IS EMPTY</strong><span>Create your first settlement or map site to begin charting this region.</span></div>}
   <div className="wtm-map-corner"><span>IMPERIAL SURVEY OFFICE</span><small>MAP COORDINATES · RELATIVE</small></div>
  </div>
  </div>
  {canEdit&&<div className="wtm-bottom">
   <span>{mode==='mountains'?'Click the map to place mountain ridge points; name and save the range below.':mode==='move'?'Drag a settlement icon to place it. Positions save on release.':mode==='link'?(routeStart!=null&&routeEnd!=null?'Click the map for bends, then save. Nothing is created until you save.':routeStart!=null?'Select the destination location or junction.':'Select a starting location or junction.'):mode==='bend'?'Select a route in the route registry, click the map to insert bends or drag its handles.':'Inspect sites or select an existing route to edit it.'}</span>

  </div>}
  {canEdit&&(mode==='link'||mode==='bend')&&<section className="wtm-route-editor" aria-label="Route construction and railway editor">
   <div className="wtm-route-heading"><strong>ROUTE NETWORK EDITOR</strong><span>{mode==='link'?'PLAN A NEW CONNECTION':'MODIFY EXISTING CONNECTIONS'}</span></div>
   <div className="wtm-route-grid">
    <div className="wtm-route-field"><label>Existing connections<select value={selectedRoute||''} onChange={e=>{const r=[...routes,...networkSegments].find(r=>(r.from_node_id?'graph:':'legacy:')+r.id===e.target.value);if(r)selectRoad(r);else setSelectedRoute(null)}}><option value="">Choose a route to edit</option>{[...routes,...networkSegments].map(r=><option value={(r.from_node_id?'graph:':'legacy:')+r.id} key={(r.from_node_id?'graph:':'legacy:')+r.id}>{r.route_name||ROUTE_OPTIONS.find(t=>t[0]===r.route_type)?.[1]||'Route'} · {r.from_node_id?(graphNodes.get(Number(r.from_node_id))?.name||'Node '+r.from_node_id)+' → '+(graphNodes.get(Number(r.to_node_id))?.name||'Node '+r.to_node_id):(byId.get(Number(r.from_settlement_id))?.name||'?')+' → '+(byId.get(Number(r.to_settlement_id))?.name||'?')}</option>)}</select></label></div>
    <div className="wtm-route-field"><label>Route type<select value={routeType} onChange={e=>{setRouteType(e.target.value);setRouteDirty(true)}}>{ROUTE_OPTIONS.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label></div>
    <div className="wtm-route-field"><label>Route name<input maxLength={120} placeholder="Optional route name" value={routeName} onChange={e=>{setRouteName(e.target.value);setRouteDirty(true)}}/></label></div>
    <div className="wtm-route-field"><label>Endpoints<span className="wtm-endpoints">{mode==='link'?labelForRef(routeStart)+' → '+labelForRef(routeEnd):(currentRoute?(graphSelected?'Shared network route':(byId.get(Number(currentRoute.from_settlement_id))?.name||'?')+' → '+(byId.get(Number(currentRoute.to_settlement_id))?.name||'?')):'Choose existing route')}</span></label></div>
   </div>
   <p className="wtm-route-help">{mode==='link'?'Select two settlements or junctions on this map, add optional bends and save. To branch from a road, use Branch from route first.':'Choose a road or railway in this same editor. Click to insert a bend at the nearest segment and drag its handles; saving preserves the original curved style.'}</p>
   <div className="wtm-junction-tools">
    <button type="button" className={junctionAction==='place'?'active':''} disabled={busy} onClick={()=>{setJunctionAction(v=>v==='place'?'':'place');setNotice('Click on the same map to place a junction.');}}><i className="fa-solid fa-location-dot"/> Place junction</button>
    <button type="button" className={junctionAction==='split'?'active':''} disabled={busy||!networkSegments.length} onClick={()=>{setJunctionAction(v=>v==='split'?'':'split');setNotice('Click an existing route directly to create a shared junction.');}}><i className="fa-solid fa-code-branch"/> Branch from route</button>
    {routes.length>0&&<button type="button" disabled={busy} onClick={importLegacyRoutes}><i className="fa-solid fa-link"/> Connect {routes.length} older routes</button>}
    {junctionAction&&<button type="button" onClick={()=>setJunctionAction('')}>Done placing junctions</button>}
    <small>New roads keep the original smooth bends. Choose a junction while planning a route; drag it with Move places.</small>
   </div>
   <div className="wtm-route-actions">
    {mode==='link'?<>
      <button disabled={busy||routeStart==null||routeEnd==null} onClick={savePlannedRoute}>Save new route</button>
      <button disabled={busy||!newRoutePoints.length} onClick={()=>setNewRoutePoints(p=>p.slice(0,-1))}>Undo bend</button>
      <button disabled={busy} onClick={()=>{setRouteStart(null);setRouteEnd(null);setNewRoutePoints([]);setNotice('Route draft discarded.')}}>Cancel draft</button>
    </>:<>
      <button disabled={busy||!currentRoute||!routeDirty} onClick={()=>saveRoute(editableRoute,currentRoute.id,graphSelected)}>Save route changes</button>
      <button disabled={busy||!currentRoute||!draftWaypoints.length} onClick={()=>{setDraftWaypoints(p=>p.slice(0,-1));setRouteDirty(true)}}>Remove last bend</button>
      <button disabled={busy||!currentRoute} onClick={()=>{selectRoad(currentRoute);setNotice('Unsaved route edits discarded.')}}>Reset edits</button>
      <button disabled={busy||!currentRoute} className="wtm-delete-route" onClick={deleteRoute}>Delete route</button>
    </>}
   </div>
  </section>}
  {canEdit&&mode==='mountains'&&<div className="wtm-mountain-editor">
   <label>Mountain range<select value={mountainId} onChange={e=>selectMountain(e.target.value)}><option value="">+ New mountain range</option>{mountains.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
   <label>Range name<input maxLength={120} value={mountainName} placeholder="e.g. Northern Peaks" onChange={e=>setMountainName(e.target.value)}/></label>
   <span>{mountainPoints.length} ridge points</span>
   <button type="button" disabled={!mountainPoints.length||busy} onClick={()=>setMountainPoints(p=>p.slice(0,-1))}>Undo point</button>
   <button type="button" disabled={!mountainPoints.length||busy} onClick={()=>setMountainPoints([])}>Redraw</button>
   <button type="button" disabled={busy||mountainPoints.length<2||!mountainName.trim()} onClick={saveMountain}>Save range</button>
   {mountainId&&<button type="button" disabled={busy} onClick={deleteMountain}>Delete range</button>}
  </div>}
  {canEdit&&active&&<div className="wtm-symbol"><MapIconPicker options={ICON_OPTIONS} label="Map icon" value={active.map_icon||'settlement'} onChange={changeIcon} disabled={busy}/><label>Territorial state<select value={active.strategic_state||'peaceful'} onChange={e=>changeState(e.target.value)} disabled={busy}>{STATUS_OPTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><small>Status is visible on every map marker, including without selecting it.</small></div>}
  <div className="wtm-legend"><div><strong>STATES</strong><span className="wtm-state-key">{STATUS_OPTIONS.map(([value,label])=><span key={value} data-state={value}><i/>{label}</span>)}</span></div><div><strong>MOUNTAIN RANGES</strong><span>{mountains.length} mapped</span></div><div><strong>KNOWN SITES</strong><span>{displayed.length} mapped</span></div><div><strong>ROUTE NETWORK</strong><span>{routes.length+networkSegments.length} connections</span></div><div><strong>LEGEND</strong><span><i className="wtm-key wtm-key-road"/> Road · <i className="wtm-key wtm-key-trail"/> Trail · <i className="wtm-key wtm-key-rail"/> Rail</span></div></div>
 </div>;
}
