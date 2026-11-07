import React,{useEffect,useMemo,useRef,useState} from 'react';
import SiteIcon,{SITE_MARKER_OPTIONS,markerIconName} from './SiteIcon.jsx';
import SiteMarkerPicker from './SiteMarkerPicker.jsx';
import './world-territory-map.css';
export const ICON_OPTIONS=SITE_MARKER_OPTIONS;
export const STATUS_OPTIONS=[['peaceful','Peaceful'],['secure','Secure'],['contested','Contested'],['occupied','Occupied'],['liberated','Liberated'],['rebuilding','Rebuilding'],['abandoned','Abandoned'],['destroyed','Destroyed']];
export const ROUTE_OPTIONS=[['road','Road'],['trail','Trail'],['rail','Railway'],['skyway','Air route'],['waterway','Water route']];
const iconFor=name=>markerIconName(name);
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
export default function WorldTerritoryMap({region,settlements,routes=[],junctions=[],mountains=[],canEdit=false,selected,onSelect,request,onSaved}){
 const [mode,setMode]=useState('view'),[positions,setPositions]=useState({}),[routeStart,setRouteStart]=useState(null);
 const [routeType,setRouteType]=useState('road'),[routeName,setRouteName]=useState(''),[selectedRoute,setSelectedRoute]=useState(null),[draftWaypoints,setDraftWaypoints]=useState([]);
 const [routeEnd,setRouteEnd]=useState(null),[newRoutePoints,setNewRoutePoints]=useState([]),[routeDirty,setRouteDirty]=useState(false);
 const [mountainId,setMountainId]=useState(''),[mountainName,setMountainName]=useState(''),[mountainPoints,setMountainPoints]=useState([]);
 const [activeJunction,setActiveJunction]=useState(null),[junctionDraft,setJunctionDraft]=useState(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const mapRef=useRef(null),dragRef=useRef(null),suppressRef=useRef(false);
 useEffect(()=>{setMode('view');setPositions({});setRouteStart(null);setRouteEnd(null);setNewRoutePoints([]);setRouteDirty(false);setSelectedRoute(null);setDraftWaypoints([]);setMountainId('');setMountainName('');setMountainPoints([]);setActiveJunction(null);setJunctionDraft(null);setError('');setNotice('')},[region?.id]);
 const displayed=useMemo(()=>settlements.map(s=>normalize(s,positions)),[settlements,positions]);
 const byId=useMemo(()=>new Map(displayed.map(s=>[Number(s.id),s])),[displayed]);
 const junctionById=useMemo(()=>new Map(junctions.map(j=>[Number(j.id),j])),[junctions]);
 const endpointName=(endpoint)=>endpoint?.kind==='junction'?(junctionById.get(Number(endpoint.id))?.name||'Junction '+endpoint.id):(byId.get(Number(endpoint?.id))?.name||'?');
 const endpointPayload=(side,endpoint)=>({[side+'_settlement_id']:endpoint?.kind==='settlement'?Number(endpoint.id):null,[side+'_junction_id']:endpoint?.kind==='junction'?Number(endpoint.id):null});
 const existingEndpoint=(r,side)=>r?.[side+'_junction_id']?{kind:'junction',id:Number(r[side+'_junction_id'])}:{kind:'settlement',id:Number(r?.[side+'_settlement_id'])};
 const fullRoutePayload=(a,b,waypoints,type,name)=>({region_id:Number(region.id),...endpointPayload('from',a),...endpointPayload('to',b),route_type:type,route_name:name,waypoints});
 const currentRoute=routes.find(r=>Number(r.id)===Number(selectedRoute));
 const editableRoute=currentRoute?fullRoutePayload(existingEndpoint(currentRoute,'from'),existingEndpoint(currentRoute,'to'),draftWaypoints,routeType,routeName):null;
 const previewRoute=routeStart&&routeEnd?fullRoutePayload(routeStart,routeEnd,newRoutePoints,routeType,routeName):null;
 const currentMountain=mountains.find(m=>String(m.id)===mountainId);
 const segmentPts=r=>{
  const resolve=side=>r[side+'_junction_id']?junctionById.get(Number(r[side+'_junction_id'])):byId.get(Number(r[side+'_settlement_id']));
  const from=resolve('from'),to=resolve('to');
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
 function chooseEndpoint(next){
  if(!canEdit||mode!=='link')return;
  if(!routeStart){setRouteStart(next);setRouteEnd(null);setNewRoutePoints([]);setNotice('Choose the second station or junction.');return}
  if(routeStart.kind===next.kind&&Number(routeStart.id)===Number(next.id)){setRouteStart(null);setRouteEnd(null);return}
  setRouteEnd(next);setNotice('Connected endpoints ready. Click for bends or save this route.');
 }
 function selectPin(s){
  if(suppressRef.current){suppressRef.current=false;return}
  onSelect(String(s.id));chooseEndpoint({kind:'settlement',id:s.id});
 }
 async function splitAtRoute(r,e){
  if(!canEdit||mode!=='junction'||busy)return;
  const p=coords(e);if(!p)return;
  setBusy(true);setError('');setNotice('');
  try{
   const result=await request('/world-admin/routes/'+r.id+'/split',{method:'POST',body:p});
   await reload();setActiveJunction(String(result.junction_id));
   setNotice('Junction inserted. Choose Plan a route to connect another road or railway at this node.');
  }catch(error){setError(error.message||'Could not split that route. Select a point on its interior.')}finally{setBusy(false)}
 }
 async function saveJunction(){
  if(!canEdit||!junctionDraft||busy)return;
  setBusy(true);setError('');
  const payload={region_id:Number(region.id),name:junctionDraft.name||'',junction_type:junctionDraft.junction_type,map_x:Number(junctionDraft.map_x),map_y:Number(junctionDraft.map_y)};
  try{
   const result=await request('/world-admin/junctions'+(junctionDraft.id?'/'+junctionDraft.id:''),{method:junctionDraft.id?'PUT':'POST',body:payload});
   await reload();setActiveJunction(String(junctionDraft.id||result.id));setJunctionDraft(null);setNotice('Junction saved.');
  }catch(error){setError(error.message||'Junction save failed.')}finally{setBusy(false)}
 }
 async function deleteJunction(){
  if(!junctionDraft?.id||busy)return;
  setBusy(true);setError('');
  try{await request('/world-admin/junctions/'+junctionDraft.id,{method:'DELETE'});await reload();setActiveJunction(null);setJunctionDraft(null);setNotice('Unused junction removed.')}
  catch(error){setError(error.message||'A junction with routes connected cannot be removed.')}finally{setBusy(false)}
 }
 async function saveRoute(payload,id=null){
  if(!canEdit||busy)return;
  setBusy(true);setError('');setNotice('');
  try{
   await request('/world-admin/routes'+(id?'/'+id:''),{method:id?'PUT':'POST',body:payload});
   await reload();
   setRouteStart(null);setRouteEnd(null);setNewRoutePoints([]);setRouteDirty(false);
   setSelectedRoute(null);setDraftWaypoints([]);setNotice(id?'Route changes saved.':'New route created.');
  }catch(e){setError(e.message||'The road could not be saved.')}finally{setBusy(false)}
 }
 async function deleteRoute(){
  if(!currentRoute||!canEdit||busy)return;
  setBusy(true);setError('');
  try{await request('/world-admin/routes/'+currentRoute.id,{method:'DELETE'});await reload();setSelectedRoute(null);setDraftWaypoints([]);setNotice('Route deleted.')}
  catch(e){setError(e.message||'Unable to delete route.')}finally{setBusy(false)}
 }
 function mapClick(e){
  if(!canEdit||busy)return;
  const p=coords(e);if(!p)return;
  if(mode==='junction'&&junctionDraft&&!junctionDraft.id){setJunctionDraft(d=>({...d,map_x:p.x,map_y:p.y}));return}
  if(mode==='link'&&routeStart&&routeEnd)setNewRoutePoints(old=>old.length<16?[...old,p]:old);
  if(mode==='bend'&&currentRoute)setDraftWaypoints(old=>{
   if(old.length>=16)return old;
   const line=polyline({...currentRoute,waypoints:old},byId);
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
    {[['view','Inspect'],['move','Move places'],['link','Plan a route'],['bend','Edit routes'],['junction','Junctions'],['mountains','Mountains']].map(([id,name])=><button type="button" key={id} className={mode===id?'active':''} aria-pressed={mode===id} onClick={()=>{setMode(id);setRouteStart(null);setRouteEnd(null);setNewRoutePoints([]);setNotice('');if(id==='mountains')selectMountain('');if(id==='junction')setJunctionDraft(null)}}>{name}</button>)}
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
   {junctions.map(j=><button type="button" key={'junction-'+j.id} className={'wtm-junction '+(String(j.id)===String(activeJunction)?'selected':'')} style={{left:j.map_x+'%',top:j.map_y+'%'}} title={(j.name||'Unnamed junction')+' · '+j.junction_type} onClick={e=>{e.stopPropagation();setActiveJunction(String(j.id));if(mode==='junction')setJunctionDraft({...j});chooseEndpoint({kind:'junction',id:j.id})}} aria-label={'Route junction '+(j.name||j.id)}><SiteIcon name="git-merge" size={17}/></button>)}
   {junctionDraft&&!junctionDraft.id&&mode==='junction'&&<span className="wtm-junction wtm-junction-draft" style={{left:junctionDraft.map_x+'%',top:junctionDraft.map_y+'%'}} aria-label="Draft junction location"><SiteIcon name="git-merge" size={18}/></span>}
   {displayed.map(s=><button key={s.id} type="button" className={'wtm-pin '+(String(s.id)===String(selected)?'selected ':'')+(routeStart===Number(s.id)?'origin ':'')} data-state={s.strategic_state||'peaceful'} data-type={s.map_icon||'settlement'} style={{left:s.map_x+'%',top:s.map_y+'%'}} onPointerDown={e=>pointerDown(e,s)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={()=>{dragRef.current=null;setPositions({})}} onClick={e=>{e.stopPropagation();selectPin(s)}} title={s.name+' · '+(STATUS_OPTIONS.find(p=>p[0]===s.strategic_state)?.[1]||'Peaceful')} aria-label={s.name+' ('+s.map_icon+'), '+(STATUS_OPTIONS.find(p=>p[0]===s.strategic_state)?.[1]||'Peaceful')}><span className="wtm-pin-icon" aria-hidden="true"><SiteIcon name={iconFor(s.map_icon)} size={18} strokeWidth={2}/></span><span className="wtm-pin-name">{s.name}</span><span className="wtm-pin-state">{STATUS_OPTIONS.find(p=>p[0]===s.strategic_state)?.[1]||"Peaceful"}</span></button>)}
   {canEdit&&((mode==='bend'&&currentRoute)||(mode==='link'&&routeStart&&routeEnd))&&<div className="wtm-route-draw" onClick={e=>{e.stopPropagation();mapClick(e)}} aria-label="Click the map to add a route bend"/>}
   {canEdit&&mode==='mountains'&&<div className="wtm-mountain-draw" title="Click to add a mountain point" onClick={e=>{const p=coords(e);if(p)setMountainPoints(old=>old.length<16?[...old,p]:old)}}/>}
   {mode==='bend'&&currentRoute&&draftWaypoints.map((p,i)=><button className="wtm-waypoint" key={i} type="button" aria-label={'Route bend '+(i+1)} style={{left:p.x+'%',top:p.y+'%'}} onPointerDown={e=>waypointDown(e,i)} onPointerMove={waypointMove} onPointerUp={waypointUp} onPointerCancel={waypointUp} onClick={e=>e.stopPropagation()}/>)}
   {mode==='link'&&routeStart&&routeEnd&&newRoutePoints.map((p,i)=><span className="wtm-plan-point" key={i} style={{left:p.x+'%',top:p.y+'%'}}/>)}

   {!displayed.length&&<div className="wtm-blank"><strong>THE SURVEY IS EMPTY</strong><span>Create your first settlement or map site to begin charting this region.</span></div>}
   <div className="wtm-map-corner"><span>IMPERIAL SURVEY OFFICE</span><small>MAP COORDINATES · RELATIVE</small></div>
  </div>
  </div>
  {canEdit&&<div className="wtm-bottom">
   <span>{mode==='mountains'?'Click the map to place mountain ridge points; name and save the range below.':mode==='move'?'Drag a settlement icon to place it. Positions save on release.':mode==='link'?(routeStart&&routeEnd?'Click the map for bends, then save. Nothing is created until you save.':routeStart?'Select a destination location or junction.':'Select a starting location or junction.'):mode==='bend'?'Select a route in the route registry, click the map to insert bends or drag its handles.':mode==='junction'?'Click an existing road or railway to split it with a junction; connect new routes to the new node.':'Inspect sites or select an existing route to edit it.'}</span>

  </div>}
  {canEdit&&(mode==='link'||mode==='bend')&&<section className="wtm-route-editor" aria-label="Route construction and railway editor">
   <div className="wtm-route-heading"><strong>ROUTE NETWORK EDITOR</strong><span>{mode==='link'?'PLAN A NEW CONNECTION':'MODIFY EXISTING CONNECTIONS'}</span></div>
   <div className="wtm-route-grid">
    <div className="wtm-route-field"><label>Existing connections<select value={selectedRoute||''} onChange={e=>{const chosen=routes.find(r=>String(r.id)===e.target.value);if(chosen)selectRoad(chosen);else setSelectedRoute(null)}}><option value="">Choose a route to edit</option>{routes.map(r=><option value={r.id} key={r.id}>{r.route_name||ROUTE_OPTIONS.find(t=>t[0]===r.route_type)?.[1]||'Route'} · {endpointName(existingEndpoint(r,'from'))} → {endpointName(existingEndpoint(r,'to'))}</option>)}</select></label></div>
    <div className="wtm-route-field"><label>Route type<select value={routeType} onChange={e=>{setRouteType(e.target.value);setRouteDirty(true)}}>{ROUTE_OPTIONS.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label></div>
    <div className="wtm-route-field"><label>Route name<input maxLength={120} placeholder="Optional route name" value={routeName} onChange={e=>{setRouteName(e.target.value);setRouteDirty(true)}}/></label></div>
    <div className="wtm-route-field"><label>Endpoints<span className="wtm-endpoints">{mode==='link'?(routeStart?endpointName(routeStart):'Select origin')+' → '+(routeEnd?endpointName(routeEnd):'Select destination'):(currentRoute?(endpointName(existingEndpoint(currentRoute,'from')))+' → '+(endpointName(existingEndpoint(currentRoute,'to'))):'Choose existing route')}</span></label></div>
   </div>
   <p className="wtm-route-help">{mode==='link'?'Click two locations, then add optional bends by clicking along the intended path. The preview is unsaved until you confirm.': 'Choose an existing road or railway from the list. Click to insert a bend at the nearest segment, then drag its square handles. Existing routes are unchanged until saved.'}</p>
   <div className="wtm-route-actions">
    {mode==='link'?<>
      <button disabled={busy||!routeStart||!routeEnd} onClick={()=>saveRoute({region_id:Number(region.id),...fullRoutePayload(routeStart,routeEnd,newRoutePoints,routeType,routeName)})}>Save new route</button>
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
    <strong>SHARED ROAD & RAIL JUNCTIONS</strong>
    <p>Click an existing line at the exact location for the junction. The route is split into two connected segments, preserving its original bends. For a new free-standing junction, choose Add junction and click the map to position it.</p>
    <div className="wtm-junction-controls"><label>Saved junction<select value={activeJunction||''} onChange={e=>{setActiveJunction(e.target.value);const j=junctions.find(x=>String(x.id)===e.target.value);setJunctionDraft(j?{...j}:null)}}><option value="">Select junction</option>{junctions.map(j=><option value={j.id} key={j.id}>{j.name||'Junction '+j.id} · {j.junction_type}</option>)}</select></label>
     <button type="button" onClick={()=>{setActiveJunction(null);setJunctionDraft({name:'',junction_type:'road',map_x:50,map_y:50})}}>Add junction</button></div>
    {junctionDraft&&<div className="wtm-junction-fields">
      <label>Name<input maxLength={120} value={junctionDraft.name||''} onChange={e=>setJunctionDraft({...junctionDraft,name:e.target.value})}/></label>
      <label>Junction class<select value={junctionDraft.junction_type} onChange={e=>setJunctionDraft({...junctionDraft,junction_type:e.target.value})}><option value="road">Road junction</option><option value="rail">Rail switch</option><option value="multimodal">Road and rail hub</option></select></label>
      <label>Map X<input type="number" min="0" max="100" step=".1" value={junctionDraft.map_x} onChange={e=>setJunctionDraft({...junctionDraft,map_x:e.target.value})}/></label>
      <label>Map Y<input type="number" min="0" max="100" step=".1" value={junctionDraft.map_y} onChange={e=>setJunctionDraft({...junctionDraft,map_y:e.target.value})}/></label>
      <button type="button" disabled={busy} onClick={saveJunction}>Save junction</button>
      {junctionDraft.id&&<button type="button" disabled={busy} onClick={deleteJunction}>Delete unused junction</button>}
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
  {canEdit&&active&&<div className="wtm-symbol"><label>Map icon<SiteMarkerPicker value={active.map_icon||'settlement'} onChange={changeIcon} disabled={busy}/></label><label>Territorial state<select value={active.strategic_state||'peaceful'} onChange={e=>changeState(e.target.value)} disabled={busy}>{STATUS_OPTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><small>Status is visible on every map marker, including without selecting it.</small></div>}
  <div className="wtm-legend"><div><strong>STATES</strong><span className="wtm-state-key">{STATUS_OPTIONS.map(([value,label])=><span key={value} data-state={value}><i/>{label}</span>)}</span></div><div><strong>MOUNTAIN RANGES</strong><span>{mountains.length} mapped</span></div><div><strong>KNOWN SITES</strong><span>{displayed.length} mapped</span></div><div><strong>ROUTE NETWORK</strong><span>{routes.length} connections</span></div><div><strong>LEGEND</strong><span><i className="wtm-key wtm-key-road"/> Road · <i className="wtm-key wtm-key-trail"/> Trail · <i className="wtm-key wtm-key-rail"/> Rail</span></div></div>
 </div>;
}
