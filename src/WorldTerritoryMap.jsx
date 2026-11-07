import React,{useEffect,useMemo,useRef,useState} from 'react';
import './world-territory-map.css';
export const ICON_OPTIONS=[['settlement','Settlement','house'],['capital','Capital','crown'],['village','Village','house-chimney'],['mine','Mine','person-digging'],['factory','Factory','industry'],['refinery','Refinery','flask'],['fortress','Fortress','shield-halved'],['outpost','Outpost','flag'],['farm','Farm','wheat-awn'],['port','Port','anchor'],['depot','Depot','boxes-stacked'],['ruins','Ruins','landmark-dome'],['landmark','Landmark','monument'],['lumber_yard','Lumber yard','tree'],['logging_camp','Logging camp','tree-city'],['sawmill','Sawmill','screwdriver-wrench'],['quarry','Quarry','mountain'],['workshop','Workshop','hammer'],['warehouse','Warehouse','warehouse'],['barracks','Barracks','person-military-rifle'],['watchtower','Watchtower','tower-observation'],['bridge','Bridge','bridge'],['market','Market','store'],['hospital','Hospital','hospital'],['laboratory','Laboratory','microscope'],['power_plant','Power plant','bolt'],['rail_station','Rail station','train'],['airfield','Airfield','plane']];
export const STATUS_OPTIONS=[['peaceful','Peaceful'],['secure','Secure'],['contested','Contested'],['occupied','Occupied'],['liberated','Liberated'],['rebuilding','Rebuilding'],['abandoned','Abandoned'],['destroyed','Destroyed']];
export const ROUTE_OPTIONS=[['road','Road'],['trail','Trail'],['rail','Railway'],['skyway','Air route'],['waterway','Water route']];
const iconFor=name=>'fa-solid fa-'+(ICON_OPTIONS.find(x=>x[0]===name)?.[2]||'house');
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
export default function WorldTerritoryMap({region,settlements,routes=[],nodes=[],mountains=[],canEdit=false,selected,onSelect,request,onSaved}){
 const [mode,setMode]=useState('view'),[positions,setPositions]=useState({}),[routeStart,setRouteStart]=useState(null);
 const [routeType,setRouteType]=useState('road'),[routeName,setRouteName]=useState(''),[selectedRoute,setSelectedRoute]=useState(null),[draftWaypoints,setDraftWaypoints]=useState([]);
 const [routeEnd,setRouteEnd]=useState(null),[newRoutePoints,setNewRoutePoints]=useState([]),[routeDirty,setRouteDirty]=useState(false);
 const [mountainId,setMountainId]=useState(''),[mountainName,setMountainName]=useState(''),[mountainPoints,setMountainPoints]=useState([]);
 const [nodeId,setNodeId]=useState(''),[nodeDraft,setNodeDraft]=useState(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const mapRef=useRef(null),dragRef=useRef(null),suppressRef=useRef(false);
 useEffect(()=>{setMode('view');setPositions({});setRouteStart(null);setRouteEnd(null);setNewRoutePoints([]);setRouteDirty(false);setSelectedRoute(null);setDraftWaypoints([]);setMountainId('');setMountainName('');setMountainPoints([]);setNodeId('');setNodeDraft(null);setError('');setNotice('')},[region?.id]);
 const displayed=useMemo(()=>settlements.map(s=>normalize(s,positions)),[settlements,positions]);
 const byId=useMemo(()=>new Map(displayed.map(s=>[Number(s.id),s])),[displayed]);
 const nodeById=useMemo(()=>new Map(nodes.map(n=>[Number(n.id),n])),[nodes]);
 const siteNode=useMemo(()=>new Map(nodes.filter(n=>n.settlement_id!==null).map(n=>[Number(n.settlement_id),n])),[nodes]);
 const nodeName=id=>nodeById.get(Number(id))?.name||'Junction '+id;
 const currentRoute=routes.find(r=>Number(r.id)===Number(selectedRoute));
 const editableRoute= currentRoute ? {region_id:Number(region.id),from_node_id:Number(currentRoute.from_node_id),to_node_id:Number(currentRoute.to_node_id),route_type:routeType,route_name:routeName,waypoints:draftWaypoints}:null;
 const previewRoute=routeStart&&routeEnd?{from_node_id:routeStart,to_node_id:routeEnd,route_type:routeType,waypoints:newRoutePoints}:null;
 const currentMountain=mountains.find(m=>String(m.id)===mountainId);
 const segmentPts=r=>{
  const from=nodeById.get(Number(r.from_node_id)),to=nodeById.get(Number(r.to_node_id));
  if(!from||!to)return [];
  return [from,...normalizeWaypoints(r),to].map(p=>({x:Number(p.map_x??p.x),y:Number(p.map_y??p.y)}));
 };
 const activePoints=currentRoute?segmentPts({...currentRoute,waypoints:draftWaypoints}):[];
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
 function chooseNodeEndpoint(id){
  if(!canEdit||mode!=='link'||!id)return;
  if(!routeStart){setRouteStart(Number(id));setRouteEnd(null);setNewRoutePoints([]);setNotice('Choose the destination settlement or junction.');return}
  if(Number(routeStart)===Number(id)){setRouteStart(null);setRouteEnd(null);return}
  setRouteEnd(Number(id));setNotice('Endpoints connected in the draft. Add bends and save.');
 }
 function selectPin(s){
  if(suppressRef.current){suppressRef.current=false;return}
  onSelect(String(s.id));
  chooseNodeEndpoint(siteNode.get(Number(s.id))?.id);
 }
 async function splitAtRoute(r,e){
  if(!canEdit||mode!=='junction'||busy)return;
  const point=coords(e);if(!point)return;
  setBusy(true);setError('');setNotice('');
  try{
   const response=await request('/world-admin/transport/segments/'+r.id+'/split',{method:'POST',body:point});
   await reload();setNodeId(String(response.junction_id));setNodeDraft(null);
   setNotice('Junction inserted. Use Plan a route to branch from it.');
  }catch(error){setError(error.message||'Click on the interior of the road or rail track to split it.')}
  finally{setBusy(false)}
 }
 function editNode(id){
  const n=nodes.find(n=>String(n.id)===String(id)&&n.settlement_id===null);
  setNodeId(n?String(n.id):'');setNodeDraft(n?{...n}:null);
 }
 async function saveNode(){
  if(!nodeDraft||!canEdit||busy)return;
  setBusy(true);setError('');setNotice('');
  const b={region_id:Number(region.id),settlement_id:null,name:nodeDraft.name||'',node_kind:nodeDraft.node_kind,map_x:Number(nodeDraft.map_x),map_y:Number(nodeDraft.map_y)};
  try{
   const r=await request('/world-admin/transport/nodes'+(nodeDraft.id?'/'+nodeDraft.id:''),{method:nodeDraft.id?'PUT':'POST',body:b});
   await reload();setNodeId(String(nodeDraft.id||r.id));setNodeDraft(null);setNotice('Junction saved.');
  }catch(error){setError(error.message||'Junction could not be saved.')}finally{setBusy(false)}
 }
 async function deleteNode(){
  if(!nodeDraft?.id||!canEdit||busy)return;
  setBusy(true);setError('');
  try{await request('/world-admin/transport/nodes/'+nodeDraft.id,{method:'DELETE'});await reload();setNodeId('');setNodeDraft(null);setNotice('Unused junction deleted.')}
  catch(error){setError(error.message||'Remove connected routes before deleting a junction.')}finally{setBusy(false)}
 }
 async function saveRoute(payload,id=null){
  if(!canEdit||busy)return;
  setBusy(true);setError('');setNotice('');
  try{
   await request('/world-admin/transport/segments'+(id?'/'+id:''),{method:id?'PUT':'POST',body:payload});
   await reload();
   setRouteStart(null);setRouteEnd(null);setNewRoutePoints([]);setRouteDirty(false);
   setSelectedRoute(null);setDraftWaypoints([]);setNotice(id?'Route changes saved.':'New route created.');
  }catch(e){setError(e.message||'The road could not be saved.')}finally{setBusy(false)}
 }
 async function deleteRoute(){
  if(!currentRoute||!canEdit||busy)return;
  setBusy(true);setError('');
  try{await request('/world-admin/transport/segments/'+currentRoute.id,{method:'DELETE'});await reload();setSelectedRoute(null);setDraftWaypoints([]);setNotice('Route deleted.')}
  catch(e){setError(e.message||'Unable to delete route.')}finally{setBusy(false)}
 }
 function mapClick(e){
  if(!canEdit||busy)return;
  const p=coords(e);if(!p)return;
  if(mode==='junction'&&nodeDraft&&!nodeDraft.id){setNodeDraft(n=>({...n,map_x:p.x,map_y:p.y}));return}
  if(mode==='link'&&routeStart&&routeEnd)setNewRoutePoints(old=>old.length<16?[...old,p]:old);
  if(mode==='bend'&&currentRoute)setDraftWaypoints(old=>{
   if(old.length>=16)return old;
   const line=segmentPts({...currentRoute,waypoints:old});
   const dist=(pt,a,b)=>{const vx=b.x-a.x,vy=b.y-a.y,t=Math.max(0,Math.min(1,((pt.x-a.x)*vx+(pt.y-a.y)*vy)/(vx*vx+vy*vy||1)));return Math.hypot(pt.x-a.x-t*vx,pt.y-a.y-t*vy)};
   const segments=line.slice(1).map((point,i)=>({i,d:dist(p,line[i],point)}));
   const nearest=segments.sort((a,b)=>a.d-b.d)[0];
   const next=[...old];next.splice(nearest?.i??old.length,0,p);setRouteDirty(true);return next;
  });
 }
 function selectRoad(r){
  if(mode==='move'||mode==='junction')return;
  setSelectedRoute(r.id);setDraftWaypoints(normalizeWaypoints(r).map(p=>({...p})));
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
    {[['view','Inspect'],['move','Move places'],['link','Plan a route'],['bend','Edit routes'],['junction','Junctions'],['mountains','Mountains']].map(([id,name])=><button type="button" key={id} className={mode===id?'active':''} aria-pressed={mode===id} onClick={()=>{setMode(id);setRouteStart(null);setRouteEnd(null);setNewRoutePoints([]);setNotice('');if(id==='mountains')selectMountain('');if(id==='junction')editNode('')}}>{name}</button>)}
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
   <div className="wtm-map-compass" aria-hidden="true"><span>N</span><b>✥</b><small>S</small></div>
   <svg className="wtm-network" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Regional road network">
    {segments.map(route=>{
     const points=segmentPts(route),p=smoothRoadPath(points);
     return <g key={route.id} className={'wtm-road '+routeClass(route.route_type)+(selectedRoute===route.id?' selected':'')}>
      <path d={p} className="wtm-road-base"/>
      <path d={p} className="wtm-road-top"/>
      {route.route_type==='rail'&&<><path d={p} className="wtm-rail-ties"/><path d={p} className="wtm-rail-center"/></>}
      <path d={p} className="wtm-road-hit" onClick={e=>{e.stopPropagation();if(mode==='junction')void splitAtRoute(route,e);else selectRoad(route)}}/>
     </g>;
    })}
    {currentRoute&&mode==='bend'&&activePoints.length>1&&<path d={smoothRoadPath(activePoints)} fill="none" stroke="#f2d4a0" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="5 4"/>}
    {previewRoute&&mode==='link'&&<path className="wtm-planned-route" d={smoothRoadPath(segmentPts(previewRoute))}/>}
   </svg>
   {nodes.filter(n=>n.settlement_id===null).map(n=><button type="button" key={'node-'+n.id} className={'wtm-junction '+(String(n.id)===nodeId?'selected':'')} style={{left:n.map_x+'%',top:n.map_y+'%'}} onClick={e=>{e.stopPropagation();if(mode==='junction')editNode(n.id);else chooseNodeEndpoint(n.id)}} aria-label={(n.node_kind==='rail_switch'?'Rail switch':'Road junction')+' '+(n.name||n.id)} title={(n.name||'Junction')+' · '+n.node_kind}><i className={'fa-solid '+(n.node_kind==='rail_switch'?'fa-train':'fa-code-branch')}/></button>)}
   {nodeDraft&&!nodeDraft.id&&mode==='junction'&&<span className="wtm-junction wtm-junction-draft" style={{left:nodeDraft.map_x+'%',top:nodeDraft.map_y+'%'}}><i className="fa-solid fa-code-branch"/></span>}
   {displayed.map(s=><button key={s.id} type="button" className={'wtm-pin '+(String(s.id)===String(selected)?'selected ':'')+(routeStart===Number(s.id)?'origin ':'')} data-state={s.strategic_state||'peaceful'} data-type={s.map_icon||'settlement'} style={{left:s.map_x+'%',top:s.map_y+'%'}} onPointerDown={e=>pointerDown(e,s)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={()=>{dragRef.current=null;setPositions({})}} onClick={e=>{e.stopPropagation();selectPin(s)}} title={s.name+' · '+(STATUS_OPTIONS.find(p=>p[0]===s.strategic_state)?.[1]||'Peaceful')} aria-label={s.name+' ('+s.map_icon+'), '+(STATUS_OPTIONS.find(p=>p[0]===s.strategic_state)?.[1]||'Peaceful')}><span className="wtm-pin-icon" aria-hidden="true"><i className={iconFor(s.map_icon)}/></span><span className="wtm-pin-name">{s.name}</span><span className="wtm-pin-state">{STATUS_OPTIONS.find(p=>p[0]===s.strategic_state)?.[1]||"Peaceful"}</span></button>)}
   {canEdit&&((mode==='bend'&&currentRoute)||(mode==='link'&&routeStart&&routeEnd))&&<div className="wtm-route-draw" onClick={e=>{e.stopPropagation();mapClick(e)}} aria-label="Click the map to add a route bend"/>}
   {canEdit&&mode==='mountains'&&<div className="wtm-mountain-draw" title="Click to add a mountain point" onClick={e=>{const p=coords(e);if(p)setMountainPoints(old=>old.length<16?[...old,p]:old)}}/>}
   {mode==='bend'&&currentRoute&&draftWaypoints.map((p,i)=><button className="wtm-waypoint" key={i} type="button" aria-label={'Route bend '+(i+1)} style={{left:p.x+'%',top:p.y+'%'}} onPointerDown={e=>waypointDown(e,i)} onPointerMove={waypointMove} onPointerUp={waypointUp} onPointerCancel={waypointUp} onClick={e=>e.stopPropagation()}/>)}
   {mode==='link'&&routeStart&&routeEnd&&newRoutePoints.map((p,i)=><span className="wtm-plan-point" key={i} style={{left:p.x+'%',top:p.y+'%'}}/>)}

   {!displayed.length&&<div className="wtm-blank"><strong>THE SURVEY IS EMPTY</strong><span>Create your first settlement or map site to begin charting this region.</span></div>}
   <div className="wtm-map-corner"><span>IMPERIAL SURVEY OFFICE</span><small>MAP COORDINATES · RELATIVE</small></div>
  </div>
  </div>
  {canEdit&&<div className="wtm-bottom">
   <span>{mode==='mountains'?'Click to add mountain ridge points.':mode==='move'?'Drag a settlement marker to reposition it.':mode==='link'?(routeStart&&routeEnd?'Click for bends and save the connection.':routeStart?'Pick a destination settlement or junction.':'Choose a settlement or junction to begin.'):mode==='bend'?'Select a route, click to insert bends or drag handles.':mode==='junction'?'Click a road/rail line to insert a shared junction, or create one at any map location.':'Select a site or route to inspect.'}</span>

  </div>}
  {canEdit&&(mode==='link'||mode==='bend')&&<section className="wtm-route-editor" aria-label="Route construction and railway editor">
   <div className="wtm-route-heading"><strong>ROUTE NETWORK EDITOR</strong><span>{mode==='link'?'PLAN A NEW CONNECTION':'MODIFY EXISTING CONNECTIONS'}</span></div>
   <div className="wtm-route-grid">
    <div className="wtm-route-field"><label>Existing connections<select value={selectedRoute||''} onChange={e=>{const chosen=routes.find(r=>String(r.id)===e.target.value);if(chosen)selectRoad(chosen);else setSelectedRoute(null)}}><option value="">Choose a route to edit</option>{routes.map(r=><option value={r.id} key={r.id}>{r.route_name||ROUTE_OPTIONS.find(t=>t[0]===r.route_type)?.[1]||'Route'} · {nodeName(r.from_node_id)} → {nodeName(r.to_node_id)}</option>)}</select></label></div>
    <div className="wtm-route-field"><label>Route type<select value={routeType} onChange={e=>{setRouteType(e.target.value);setRouteDirty(true)}}>{ROUTE_OPTIONS.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label></div>
    <div className="wtm-route-field"><label>Route name<input maxLength={120} placeholder="Optional route name" value={routeName} onChange={e=>{setRouteName(e.target.value);setRouteDirty(true)}}/></label></div>
    <div className="wtm-route-field"><label>Endpoints<span className="wtm-endpoints">{mode==='link'?(routeStart?(nodeName(routeStart)):'Select origin')+' → '+(routeEnd?(nodeName(routeEnd)):'Select destination'):(currentRoute?(nodeName(currentRoute.from_node_id))+' → '+(nodeName(currentRoute.to_node_id)):'Choose existing route')}</span></label></div>
   </div>
   <p className="wtm-route-help">{mode==='link'?'Click two locations, then add optional bends by clicking along the intended path. The preview is unsaved until you confirm.': 'Choose an existing road or railway from the list. Click to insert a bend at the nearest segment, then drag its square handles. Existing routes are unchanged until saved.'}</p>
   <div className="wtm-route-actions">
    {mode==='link'?<>
      <button disabled={busy||!routeStart||!routeEnd} onClick={()=>saveRoute({region_id:Number(region.id),from_node_id:Number(routeStart),to_node_id:Number(routeEnd),route_type:routeType,route_name:routeName,waypoints:newRoutePoints})}>Save new route</button>
      <button disabled={busy||!newRoutePoints.length} onClick={()=>setNewRoutePoints(p=>p.slice(0,-1))}>Undo bend</button>
      <button disabled={busy} onClick={()=>{setRouteStart(null);setRouteEnd(null);setNewRoutePoints([]);setNotice('Route draft discarded.')}}>Cancel draft</button>
    </>:<>
      <button disabled={busy||!currentRoute||!routeDirty} onClick={()=>saveRoute(editableRoute,currentRoute.id)}>Save route changes</button>
      <button disabled={busy||!currentRoute||!draftWaypoints.length} onClick={()=>{setDraftWaypoints(p=>p.slice(0,-1));setRouteDirty(true)}}>Remove last bend</button>
      <button disabled={busy||!currentRoute} onClick={()=>{selectRoad(currentRoute);setNotice('Unsaved route edits discarded.')}}>Reset edits</button>
      <button disabled={busy||!currentRoute} className="wtm-delete-route" onClick={deleteRoute}>Delete route</button>
    </>}
   </div>
  </section>}
  {canEdit&&mode==='junction'&&<section className="wtm-junction-editor">
   <div className="wtm-route-heading"><strong>ROAD JUNCTIONS & RAIL SWITCHES</strong><span>CONNECTED TRANSPORT NETWORK</span></div>
   <p>Click a saved road or railway at the desired intersection to split it into two connected segments. Existing bends are retained. New roads and railway spurs can then start or end at that junction.</p>
   <div className="wtm-junction-tools"><label>Existing junction<select value={nodeId} onChange={e=>editNode(e.target.value)}><option value="">Choose junction</option>{nodes.filter(n=>n.settlement_id===null).map(n=><option key={n.id} value={n.id}>{n.name||'Junction '+n.id} · {n.node_kind}</option>)}</select></label>
    <button type="button" onClick={()=>{setNodeId('');setNodeDraft({name:'',node_kind:'junction',map_x:50,map_y:50})}}>+ Place new junction</button>
   </div>
   {nodeDraft&&<div className="wtm-junction-fields">
    <label>Name<input maxLength={120} value={nodeDraft.name||''} onChange={e=>setNodeDraft({...nodeDraft,name:e.target.value})}/></label>
    <label>Connection type<select value={nodeDraft.node_kind} onChange={e=>setNodeDraft({...nodeDraft,node_kind:e.target.value})}><option value="junction">Road junction</option><option value="rail_switch">Rail switch</option><option value="terminal">Multimodal terminal</option></select></label>
    <label>Map X<input type="number" min="0" max="100" step=".1" value={nodeDraft.map_x} onChange={e=>setNodeDraft({...nodeDraft,map_x:e.target.value})}/></label>
    <label>Map Y<input type="number" min="0" max="100" step=".1" value={nodeDraft.map_y} onChange={e=>setNodeDraft({...nodeDraft,map_y:e.target.value})}/></label>
    <button type="button" disabled={busy} onClick={saveNode}>Save junction</button>
    {nodeDraft.id&&<button type="button" disabled={busy} onClick={deleteNode}>Delete unused junction</button>}
    {!nodeDraft.id&&<small>Click the map to position the new junction, then save it.</small>}
   </div>}
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
  {canEdit&&active&&<div className="wtm-symbol"><label>Map icon<select value={active.map_icon||'settlement'} onChange={e=>changeIcon(e.target.value)} disabled={busy}>{ICON_OPTIONS.map(([id,name,symbol])=><option value={id} key={id}>{name}</option>)}</select></label><label>Territorial state<select value={active.strategic_state||'peaceful'} onChange={e=>changeState(e.target.value)} disabled={busy}>{STATUS_OPTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><small>Status is visible on every map marker, including without selecting it.</small></div>}
  <div className="wtm-legend"><div><strong>STATES</strong><span className="wtm-state-key">{STATUS_OPTIONS.map(([value,label])=><span key={value} data-state={value}><i/>{label}</span>)}</span></div><div><strong>MOUNTAIN RANGES</strong><span>{mountains.length} mapped</span></div><div><strong>KNOWN SITES</strong><span>{displayed.length} mapped</span></div><div><strong>ROUTE NETWORK</strong><span>{routes.length} connections</span></div><div><strong>LEGEND</strong><span><i className="wtm-key wtm-key-road"/> Road · <i className="wtm-key wtm-key-trail"/> Trail · <i className="wtm-key wtm-key-rail"/> Rail</span></div></div>
 </div>;
}
