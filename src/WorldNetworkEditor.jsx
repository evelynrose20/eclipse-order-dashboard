import React,{useMemo,useRef,useState} from 'react';
import {smoothRoadPath,ROUTE_OPTIONS} from './WorldTerritoryMap.jsx';
import './world-network-editor.css';

const percent=v=>Math.max(0,Math.min(100,Math.round(v*100)/100));
const coordinate=(e,ref)=>{const r=ref.current?.getBoundingClientRect();return r&&r.width&&r.height?{x:percent((e.clientX-r.left)*100/r.width),y:percent((e.clientY-r.top)*100/r.height)}:null};
const format=t=>ROUTE_OPTIONS.find(r=>r[0]===t)?.[1]||'Road';
const point=n=>({x:Number(n.map_x),y:Number(n.map_y)});
export function graphPoints(segment,nodeMap,siteMap){
 const start=nodeMap.get(Number(segment.from_node_id)),end=nodeMap.get(Number(segment.to_node_id));
 if(!start||!end)return [];
 const at=n=>n.settlement_id&&siteMap.get(Number(n.settlement_id))?{x:Number(siteMap.get(Number(n.settlement_id)).map_x),y:Number(siteMap.get(Number(n.settlement_id)).map_y)}:point(n);
 return [at(start),...(Array.isArray(segment.waypoints)?segment.waypoints:[]),at(end)];
}
export function NetworkPaths({nodes=[],segments=[],settlements=[],onSegment,activeId}){
 const nodeMap=new Map(nodes.map(n=>[Number(n.id),n])),siteMap=new Map(settlements.map(s=>[Number(s.id),s]));
 return <>{segments.map(edge=>{const pts=graphPoints(edge,nodeMap,siteMap);if(pts.length<2)return null;const d=smoothRoadPath(pts);return <g key={'graph-'+edge.id} className={'wtm-road wa-route-'+edge.route_type+(activeId===Number(edge.id)?' selected':'')}>
   <path d={d} className="wtm-road-base"/><path d={d} className="wtm-road-top"/>
   {edge.route_type==='rail'&&<><path d={d} className="wtm-rail-ties"/><path d={d} className="wtm-rail-center"/></>}
   {onSegment&&<path d={d} className="wtm-road-hit" onClick={e=>{e.stopPropagation();onSegment(edge,e)}}/>}
  </g>})}</>;
}
export default function WorldNetworkEditor({region,settlements=[],nodes=[],segments=[],legacyRoutes=[],mountains=[],canEdit,request,onSaved}){
 const map=useRef(null),drag=useRef(null);
 const [tool,setTool]=useState('connect'),[start,setStart]=useState(null),[end,setEnd]=useState(null),[bends,setBends]=useState([]);
 const [routeType,setRouteType]=useState('road'),[routeName,setRouteName]=useState('');
 const [selected,setSelected]=useState(null),[workingNodes,setWorkingNodes]=useState({});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [selectedNode,setSelectedNode]=useState(null);
 const siteMap=useMemo(()=>new Map(settlements.map(s=>[Number(s.id),s])),[settlements]);
 const displayed=useMemo(()=>nodes.map(n=>({...n,...(workingNodes[n.id]||{})})),[nodes,workingNodes]);
 const nodeMap=useMemo(()=>new Map(displayed.map(n=>[Number(n.id),n])),[displayed]);
 const edge=segments.find(s=>Number(s.id)===Number(selected));
 const nodeXY=n=>{const s=siteMap.get(Number(n?.settlement_id));return s?{x:Number(s.map_x),y:Number(s.map_y)}:n?point(n):null};
 const isSame=(a,b)=>a&&b&&Number(a)===Number(b);
 const reset=()=>{setStart(null);setEnd(null);setBends([]);setSelected(null)};
 async function invoke(endpoint,method,body,success){
  if(busy||!canEdit)return null;
  setBusy(true);setError('');setNotice('');
  try{const r=await request(endpoint,{method,body});await onSaved?.();if(success)setNotice(success);return r}
  catch(e){setError(e?.message||'Network change could not be saved.');return null}
  finally{setBusy(false)}
 }
 const nodeNear=p=>displayed.find(n=>{const xy=nodeXY(n);return xy&&Math.hypot(p.x-xy.x,p.y-xy.y)<2.2});
 const siteNear=p=>settlements.find(s=>Math.hypot(p.x-Number(s.map_x),p.y-Number(s.map_y))<2.5);
 async function createNode(p,kind){
  const existing=nodeNear(p);if(existing)return existing;
  const site=siteNear(p);
  const result=await invoke('/world-admin/network/nodes','POST',site?{region_id:Number(region.id),settlement_id:Number(site.id)}:{region_id:Number(region.id),...p,node_kind:kind,name:''},'Junction saved.');
  return result?.id?{id:result.id,map_x:p.x,map_y:p.y,node_kind:kind}:null;
 }
 function endpoint(id){
  if(!start||end){setStart(id);setEnd(null);setBends([]);setSelected(null);return}
  if(!isSame(start,id))setEnd(id);
 }
 async function tapNode(n){
  setSelectedNode(n.id);
  if(tool==='connect')endpoint(n.id);
 }
 async function tapSite(s){
  if(tool!=='connect'||busy)return;
  const old=displayed.find(n=>Number(n.settlement_id)===Number(s.id));
  if(old){endpoint(old.id);return}
  const r=await invoke('/world-admin/network/nodes','POST',{region_id:Number(region.id),settlement_id:Number(s.id)},'Site joined to route network.');
  if(r?.id)endpoint(r.id);
 }
 function clickMap(e){
  if(!canEdit||busy)return;
  const p=coordinate(e,map);if(!p)return;
  if(tool==='place')void createNode(p,routeType==='rail'?'rail_switch':'junction');
  else if(tool==='connect'&&start&&end)setBends(old=>old.length<16?[...old,p]:old);
  else if(tool==='edit'&&edge)setBends(old=>old.length<16?[...old,p]:old);
 }
 async function clickEdge(s,e){
  if(!canEdit)return;
  if(tool==='split'){
   const p=coordinate(e,map);if(!p)return;
   const r=await invoke('/world-admin/network/segments/'+s.id+'/split','POST',p,'Route split at a shared junction.');
   if(r?.id){setSelectedNode(r.id);setTool('connect');setStart(r.id);setEnd(null);setBends([])}
  }else{
   setSelected(s.id);setStart(null);setEnd(null);setRouteType(s.route_type);setRouteName(s.route_name||'');setBends((s.waypoints||[]).map(p=>({...p})));setTool('edit');
  }
 }
 function startDrag(e,n){
  if(tool!=='move'||n.settlement_id||!canEdit)return;
  e.preventDefault();e.stopPropagation();drag.current={id:n.id,moved:false};e.currentTarget.setPointerCapture(e.pointerId);
 }
 function moveDrag(e){
  if(!drag.current)return;const p=coordinate(e,map);if(!p)return;
  drag.current.moved=true;setWorkingNodes(w=>({...w,[drag.current.id]:{map_x:p.x,map_y:p.y}}));
 }
 async function stopDrag(e,n){
  if(!drag.current)return;const was=drag.current;drag.current=null;
  if(!was.moved)return;
  const p=coordinate(e,map);if(!p)return;
  const result=await invoke('/world-admin/network/nodes/'+n.id,'PUT',{...p,node_kind:n.node_kind,name:n.name||''},'Junction moved; connected routes updated.');
  if(!result)setWorkingNodes({});
  else setWorkingNodes({});
 }
 async function save(){
  if(tool==='connect'){
   if(!start||!end||isSame(start,end))return;
   const r=await invoke('/world-admin/network/segments','POST',{region_id:Number(region.id),from_node_id:Number(start),to_node_id:Number(end),route_type:routeType,route_name:routeName,waypoints:bends},'New connection saved.');
   if(r)reset();
  }else if(tool==='edit'&&edge){
   const r=await invoke('/world-admin/network/segments/'+edge.id,'PUT',{region_id:Number(region.id),from_node_id:Number(edge.from_node_id),to_node_id:Number(edge.to_node_id),route_type:routeType,route_name:routeName,waypoints:bends},'Connection updated.');
   if(r)reset();
  }
 }
 async function removeSelected(){
  if(!edge)return;
  const r=await invoke('/world-admin/network/segments/'+edge.id,'DELETE',undefined,'Connection removed.');if(r)reset();
 }
 async function removeNode(){
  if(!selectedNode)return;
  const r=await invoke('/world-admin/network/nodes/'+selectedNode,'DELETE',undefined,'Unused junction removed.');if(r)setSelectedNode(null);
 }
 const startPoint=nodeXY(nodeMap.get(Number(start))),endPoint=nodeXY(nodeMap.get(Number(end)));
 const edgePoints=edge?graphPoints({...edge,waypoints:bends},nodeMap,siteMap):[];
 return <div className="wn-root">
  <div className="wn-tools">
   { [['connect','route','Connect'],['place','location-dot','Place junction'],['split','code-branch','Split / branch'],['move','arrows-up-down-left-right','Move junction'],['edit','pen-to-square','Edit route']].map(([id,icon,label])=><button type="button" disabled={!canEdit||busy} key={id} className={tool===id?'active':''} onClick={()=>{setTool(id);reset()}}><i className={'fa-solid fa-'+icon} aria-hidden="true"/> {label}</button>)}
  </div>
  {error&&<p className="wtm-error" role="alert">{error}</p>}
  {notice&&<p className="wtm-note" role="status">{notice}</p>}
  <div className="wn-map" ref={map} onClick={clickMap} style={region.map_background_url?{backgroundImage:'linear-gradient(#15232ec9,#15232ec9),url("'+region.map_background_url+'")'}:{}}>
   <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Connected road and railway network">
    <NetworkPaths nodes={displayed} segments={segments} settlements={settlements} activeId={selected} onSegment={clickEdge}/>
    {startPoint&&endPoint&&tool==='connect'&&<path d={smoothRoadPath([startPoint,...bends,endPoint])} className="wn-draft"/>}
    {tool==='edit'&&edgePoints.length>1&&<path d={smoothRoadPath(edgePoints)} className="wn-draft"/>}
   </svg>
   {settlements.map(s=><button className="wn-site" key={s.id} type="button" style={{left:s.map_x+'%',top:s.map_y+'%'}} onClick={e=>{e.stopPropagation();void tapSite(s)}} title={s.name}><i className="fa-solid fa-city" aria-hidden="true"/><span>{s.name}</span></button>)}
   {displayed.filter(n=>!n.settlement_id).map(n=>{const p=nodeXY(n);return <button type="button" key={n.id} className={'wn-node '+(isSame(selectedNode,n.id)?'selected ':'')+(isSame(start,n.id)||isSame(end,n.id)?'endpoint ':'')} style={{left:p.x+'%',top:p.y+'%'}} title={(n.name|| (n.node_kind==='rail_switch'?'Rail switch':'Junction'))+' #'+n.id} onClick={e=>{e.stopPropagation();void tapNode(n)}} onPointerDown={e=>startDrag(e,n)} onPointerMove={moveDrag} onPointerUp={e=>void stopDrag(e,n)} onPointerCancel={()=>{drag.current=null;setWorkingNodes({})}}><i className={'fa-solid fa-'+(n.node_kind==='rail_switch'?'train-tram':'circle-nodes')} aria-hidden="true"/></button>})}
   {tool==='connect'&&bends.map((p,i)=><span className="wn-bend" key={i} style={{left:p.x+'%',top:p.y+'%'}}/>)}
  </div>
  <div className="wn-controls">
   <p>{tool==='connect'?'Select two settlements or junctions. Click the map to add bends, then save. Existing nodes are shared by every attached road.':tool==='split'?'Click an existing road or railway to insert a shared junction directly on it; then connect a branch from that junction.':tool==='move'?'Drag a junction or rail switch. Every attached route follows the node automatically.':tool==='place'?'Click the map to add a junction. Near an existing site or node, the editor snaps to that endpoint.': 'Select a segment to edit its name, type and waypoints.'}</p>
   <div className="wn-form">
    <label>Transport type<select disabled={!canEdit||busy} value={routeType} onChange={e=>setRouteType(e.target.value)}>{ROUTE_OPTIONS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
    <label>Connection name<input disabled={!canEdit||busy} value={routeName} maxLength={120} placeholder="Optional route name" onChange={e=>setRouteName(e.target.value)}/></label>
    <label>Existing segments<select disabled={!canEdit||busy} value={selected||''} onChange={e=>{const s=segments.find(s=>String(s.id)===e.target.value);if(s)void clickEdge(s,{stopPropagation(){},clientX:0,clientY:0});else reset()}}><option value="">Select existing connection</option>{segments.map(s=><option key={s.id} value={s.id}>{s.route_name||format(s.route_type)} #{s.id}</option>)}</select></label>
   </div>
   <div className="wn-actions">
    {(tool==='connect'||tool==='edit')&&<button disabled={!canEdit||busy||(tool==='connect'?!(start&&end):!edge)} onClick={save}><i className="fa-solid fa-floppy-disk"/> Save {tool==='edit'?'changes':'connection'}</button>}
    {(tool==='connect'||tool==='edit')&&<button disabled={!bends.length||busy} onClick={()=>setBends(p=>p.slice(0,-1))}><i className="fa-solid fa-rotate-left"/> Undo point</button>}
    <button disabled={busy} onClick={reset}>Clear selection</button>
    {tool==='edit'&&edge&&<button disabled={busy} onClick={removeSelected}>Delete connection</button>}
    {tool==='move'&&selectedNode&&<button disabled={busy} onClick={removeNode}>Delete unused junction</button>}
   </div>
   <div className="wn-stats"><span>{nodes.length} shared nodes</span><span>{segments.length} connected segments</span><span>{legacyRoutes.length} older routes</span></div>
   {!!legacyRoutes.length&&canEdit&&<div className="wn-import"><span>Older routes use the former settlement-to-settlement format. Import converts their geometry into connected graph segments in one transaction, preserving names, track types and bends.</span><button type="button" disabled={busy} onClick={async()=>{const r=await invoke('/world-admin/network/import','POST',{region_id:Number(region.id)},'Existing routes converted to the shared network.');if(r)reset()}}><i className="fa-solid fa-file-import"/> Convert {legacyRoutes.length} older routes</button></div>}
  </div>
 </div>;
}
