import React,{useEffect,useMemo,useRef,useState} from 'react';
import './world-territory-map.css';
export const ICON_OPTIONS=[['settlement','Settlement','⌂'],['capital','Capital','♛'],['village','Village','⌂'],['mine','Mine','⛏'],['factory','Factory','⚙'],['refinery','Refinery','⚗'],['fortress','Fortress','⬟'],['outpost','Outpost','⚑'],['farm','Farm','♧'],['port','Port','⚓'],['depot','Depot','▣'],['ruins','Ruins','⌁'],['landmark','Landmark','✦']];
export const ROUTE_OPTIONS=[['road','Road'],['trail','Trail'],['rail','Railway'],['skyway','Air route'],['waterway','Water route']];
const iconFor=name=>ICON_OPTIONS.find(x=>x[0]===name)?.[2]||'⌂';
const pct=n=>Math.min(100,Math.max(0,Math.round(Number(n)*100)/100));
const routeClass=type=>'wa-route-'+(type||'road');
const normalizeWaypoints=route=>Array.isArray(route.waypoints)?route.waypoints:[];
const normalize=(s,map)=>({...s,...(map[s.id]||{})});
function polyline(route,byId){
 const start=byId.get(Number(route.from_settlement_id)),end=byId.get(Number(route.to_settlement_id));
 if(!start||!end)return [];
 const convert=p=>({x:Number(p.map_x??p.x),y:Number(p.map_y??p.y)});
 return [convert(start),...normalizeWaypoints(route),convert(end)];
}
export default function WorldTerritoryMap({region,settlements,routes=[],canEdit=false,selected,onSelect,request,onSaved}){
 const [mode,setMode]=useState('view'),[positions,setPositions]=useState({}),[routeStart,setRouteStart]=useState(null);
 const [routeType,setRouteType]=useState('road'),[routeName,setRouteName]=useState(''),[selectedRoute,setSelectedRoute]=useState(null),[draftWaypoints,setDraftWaypoints]=useState([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const mapRef=useRef(null),dragRef=useRef(null),suppressRef=useRef(false);
 useEffect(()=>{setMode('view');setPositions({});setRouteStart(null);setSelectedRoute(null);setDraftWaypoints([]);setError('');setNotice('')},[region?.id]);
 const displayed=useMemo(()=>settlements.map(s=>normalize(s,positions)),[settlements,positions]);
 const byId=useMemo(()=>new Map(displayed.map(s=>[Number(s.id),s])),[displayed]);
 const currentRoute=routes.find(r=>Number(r.id)===Number(selectedRoute));
 const segmentPts=r=>polyline(r,byId);
 const activePoints=currentRoute? [byId.get(Number(currentRoute.from_settlement_id)),...draftWaypoints.map(p=>({x:p.x,y:p.y})),byId.get(Number(currentRoute.to_settlement_id))].filter(Boolean).map(p=>({x:Number(p.map_x??p.x),y:Number(p.map_y??p.y)})) : [];
 const coords=e=>{const rect=mapRef.current?.getBoundingClientRect();if(!rect||!rect.width||!rect.height)return null;return {x:pct((e.clientX-rect.left)*100/rect.width),y:pct((e.clientY-rect.top)*100/rect.height)}};
 const reload=async()=>{await onSaved?.();setPositions({})};
 async function persistMarker(s,p){
  if(!canEdit||busy)return;
  setBusy(true);setError('');setNotice('');
  try{await request('/world-admin/settlements/'+s.id+'/map',{method:'PATCH',body:{map_x:p.x,map_y:p.y,map_icon:s.map_icon||'settlement'}});await reload();setNotice('Location saved.')}
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
  try{await request('/world-admin/settlements/'+s.id+'/map',{method:'PATCH',body:{map_x:Number(s.map_x),map_y:Number(s.map_y),map_icon:value}});await reload();setNotice('Map symbol changed.')}
  catch(e){setError(e.message||'Symbol could not be saved.')}finally{setBusy(false)}
 }
 function selectPin(s){
  if(suppressRef.current){suppressRef.current=false;return}
  onSelect(String(s.id));
  if(canEdit&&mode==='link'){
   if(!routeStart){setRouteStart(Number(s.id));setNotice('Choose the destination settlement.');return}
   if(Number(routeStart)===Number(s.id)){setRouteStart(null);return}
   const pair=[Number(routeStart),Number(s.id)];
   setRouteStart(null);
   void saveRoute({region_id:Number(region.id),from_settlement_id:pair[0],to_settlement_id:pair[1],route_type:routeType,route_name:routeName,waypoints:[]});
  }
 }
 async function saveRoute(payload,id=null){
  if(!canEdit||busy)return;
  setBusy(true);setError('');setNotice('');
  try{
   await request('/world-admin/routes'+(id?'/'+id:''),{method:id?'PUT':'POST',body:payload});
   await reload();
   setSelectedRoute(null);setDraftWaypoints([]);setNotice(id?'Route geometry saved.':'Route connected. Click a road to add bends.');
  }catch(e){setError(e.message||'The road could not be saved.')}finally{setBusy(false)}
 }
 async function deleteRoute(){
  if(!currentRoute||!canEdit||busy)return;
  setBusy(true);setError('');
  try{await request('/world-admin/routes/'+currentRoute.id,{method:'DELETE'});await reload();setSelectedRoute(null);setDraftWaypoints([]);setNotice('Route deleted.')}
  catch(e){setError(e.message||'Unable to delete route.')}finally{setBusy(false)}
 }
 function mapClick(e){
  if(canEdit&&mode==='bend'&&currentRoute&&e.target===mapRef.current){
   const p=coords(e);if(p)setDraftWaypoints(old=>[...old,p].slice(0,16));
  }
 }
 function selectRoad(r){
  if(mode==='move')return;
  setSelectedRoute(r.id);setDraftWaypoints(normalizeWaypoints(r).map(p=>({...p})));
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
  setDraftWaypoints(w=>w.map((point,i)=>i===index?p:point));
 }
 function waypointUp(){if(dragRef.current?.waypoint!==undefined)dragRef.current=null}
 const active=displayed.find(s=>String(s.id)===String(selected));
 const segments=routes.filter(r=>segmentPts(r).length>=2);
 return <div className="wtm-root">
  {canEdit&&<div className="wtm-toolbar">
   <div role="group" aria-label="Territory map editing tools">
    {[['view','Inspect'],['move','Move places'],['link','Draw roads'],['bend','Edit roads']].map(([id,name])=><button type="button" key={id} className={mode===id?'active':''} aria-pressed={mode===id} onClick={()=>{setMode(id);setRouteStart(null);setNotice('')}}>{name}</button>)}
   </div>
   {mode==='link'&&<><label>Route type<select value={routeType} onChange={e=>setRouteType(e.target.value)}>{ROUTE_OPTIONS.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label><label>Road name<input value={routeName} maxLength={120} placeholder="Optional" onChange={e=>setRouteName(e.target.value)}/></label></>}
  </div>}
  {error&&<p className="wtm-error" role="alert">{error}</p>}
  {notice&&<p className="wtm-note" role="status">{notice}</p>}
  <div className={'wtm-stage '+(mode!=='view'?'wtm-editing':'')} ref={mapRef} onClick={mapClick} style={region.map_background_url?{backgroundImage:'linear-gradient(#101b25a9,#101b25a9),url("'+region.map_background_url+'")'}:{}}>
   <svg className="wtm-network" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Regional road network">
    {segments.map(route=>{
     const points=segmentPts(route),p=points.map(pt=>pt.x+','+pt.y).join(' ');
     return <g key={route.id} className={'wtm-road '+routeClass(route.route_type)+(selectedRoute===route.id?' selected':'')}>
      <polyline points={p} className="wtm-road-base"/>
      <polyline points={p} className="wtm-road-top"/>
      <polyline points={p} className="wtm-road-hit" onClick={e=>{e.stopPropagation();selectRoad(route)}}/>
     </g>;
    })}
    {currentRoute&&mode==='bend'&&activePoints.length>1&&<polyline points={activePoints.map(p=>p.x+','+p.y).join(' ')} fill="none" stroke="#eac78e" strokeWidth=".55" vectorEffect="non-scaling-stroke" strokeDasharray="4 4"/>}
   </svg>
   {displayed.map(s=><button key={s.id} type="button" className={'wtm-pin '+(String(s.id)===String(selected)?'selected ':'')+(routeStart===Number(s.id)?'origin ':'')} style={{left:s.map_x+'%',top:s.map_y+'%'}} onPointerDown={e=>pointerDown(e,s)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={()=>{dragRef.current=null;setPositions({})}} onClick={()=>selectPin(s)} title={s.name} aria-label={s.name+' ('+s.map_icon+')'}><span className="wtm-pin-icon" aria-hidden="true">{iconFor(s.map_icon)}</span><span className="wtm-pin-name">{s.name}</span></button>)}
   {mode==='bend'&&currentRoute&&draftWaypoints.map((p,i)=><button className="wtm-waypoint" key={i} type="button" aria-label={'Route bend '+(i+1)} style={{left:p.x+'%',top:p.y+'%'}} onPointerDown={e=>waypointDown(e,i)} onPointerMove={waypointMove} onPointerUp={waypointUp} onPointerCancel={waypointUp} onClick={e=>e.stopPropagation()}/>)}
   {canEdit&&mode==='bend'&&currentRoute&&<div className="wtm-bend-layer" onClick={e=>{const p=coords(e);if(p)setDraftWaypoints(w=>[...w,p].slice(0,16))}} title="Click to add a curve bend"/>}
   {!displayed.length&&<div className="wtm-blank">Add settlements to begin drawing the map.</div>}
  </div>
  {canEdit&&<div className="wtm-bottom">
   <span>{mode==='move'?'Drag a settlement icon to place it. Positions save on release.':mode==='link'?(routeStart?'Select the destination icon.':'Select two settlement icons to connect them.'):mode==='bend'?'Select a road, then click the map to add bend handles. Drag handles to shape the road.':'Inspect settlements and roads; choose an editing tool to make changes.'}</span>
   {mode==='bend'&&currentRoute&&<div className="wtm-actions"><button type="button" disabled={busy} onClick={()=>setDraftWaypoints(w=>w.slice(0,-1))}>Undo bend</button><button type="button" disabled={busy} onClick={()=>saveRoute({region_id:Number(region.id),from_settlement_id:Number(currentRoute.from_settlement_id),to_settlement_id:Number(currentRoute.to_settlement_id),route_type:currentRoute.route_type,route_name:currentRoute.route_name,waypoints:draftWaypoints},currentRoute.id)}>Save road</button><button type="button" disabled={busy} onClick={deleteRoute}>Delete road</button></div>}
  </div>}
  {canEdit&&active&&<div className="wtm-symbol"><label>Map icon<select value={active.map_icon||'settlement'} onChange={e=>changeIcon(e.target.value)} disabled={busy}>{ICON_OPTIONS.map(([id,name,symbol])=><option value={id} key={id}>{symbol} {name}</option>)}</select></label><small>Icons are independent of faction affiliation.</small></div>}
  <div className="wtm-legend"><span>Settlements: {displayed.length}</span><span>Routes: {routes.length}</span><span>Current layer: territory and roads</span></div>
 </div>;
}
