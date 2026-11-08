import React,{useEffect,useMemo,useState} from 'react';
import './rail-infrastructure-panel.css';
const stateOptions=['planned','operational','closed','damaged'];
const stateLabel=s=>s.replaceAll('_',' ').replace(/^./,x=>x.toUpperCase());
const asNum=v=>Number(v);
const blankStation=(region,zone)=>({region_id:Number(region),zone_id:Number(zone),node_id:'',name:'',status:'planned',freight_enabled:true,passenger_enabled:false,freight_capacity:0,notes:''});
const blankPlatform=id=>({station_id:Number(id),code:'',kind:'freight',track_length:1,capacity:0,status:'planned'});
const blankSwitch=()=>({node_id:'',entry_segment_id:'',exit_segment_id:'',status:'open',notes:''});
const blankCross=(region,zone,p)=>({region_id:Number(region),zone_id:Number(zone),rail_segment_id:'',road_segment_id:'',name:'',map_x:p?.x??50,map_y:p?.y??50,control_type:'gated',status:'planned',notes:''});
export default function RailInfrastructurePanel({regionId,zoneId,nodes=[],segments=[],legacyRoutes=[],settlements=[],stations=[],platforms=[],switches=[],crossings=[],canEdit,request,onSaved,point,onClearPoint}){
 const [oldRoute,setOldRoute]=useState('');
 const [freightFrom,setFreightFrom]=useState(''),[freightTo,setFreightTo]=useState(''),[freightPreview,setFreightPreview]=useState(null);
 const [tab,setTab]=useState('stations'),[record,setRecord]=useState(null),[editing,setEditing]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const zoneNodes=nodes.filter(n=>Number(n.zone_id)===Number(zoneId)),zoneSegments=segments.filter(e=>Number(e.zone_id)===Number(zoneId));
 const rails=zoneSegments.filter(e=>e.route_type==='rail'),roads=zoneSegments.filter(e=>['road','trail'].includes(e.route_type));
 const stationNodes=zoneNodes.filter(n=>rails.some(e=>Number(e.from_node_id)===Number(n.id)||Number(e.to_node_id)===Number(n.id)));
 const usedStationNodes=new Set(stations.map(s=>Number(s.node_id)));
 const nodeLabel=n=>n.name||settlements.find(s=>Number(s.id)===Number(n.settlement_id))?.name||'Junction #'+n.id;
 const selectedStation=stations.find(s=>Number(s.id)===Number(record?.station_id??record?.id));
 const pairs=useMemo(()=>{const id=Number(editing?.node_id);return rails.filter(e=>Number(e.from_node_id)===id||Number(e.to_node_id)===id)},[rails,editing?.node_id]);
 useEffect(()=>{setRecord(null);setEditing(null);setTab('stations');setError('');setMessage('');setFreightFrom('');setFreightTo('');setFreightPreview(null)},[regionId,zoneId]);
 useEffect(()=>{if(point&&tab==='crossings'&&editing)setEditing(old=>old?{...old,map_x:point.x,map_y:point.y}:old)},[point?.x,point?.y,tab]);
 const update=(key,value)=>setEditing(old=>({...old,[key]:value}));
 const labelEdge=e=>e.route_name||('Track #'+e.id);
 function start(kind,existing=null){
  setTab(kind);setError('');setMessage('');setRecord(existing);
  if(existing){setEditing({...existing});return}
  setEditing(kind==='stations'?blankStation(regionId,zoneId):kind==='platforms'?blankPlatform(selectedStation?.id||stations[0]?.id||0):kind==='switches'?blankSwitch():blankCross(regionId,zoneId,point));
 }
 function choose(kind,item){setTab(kind);setRecord(item);setEditing({...item});setError('');setMessage('')}
 const currentList=tab==='stations'?stations:tab==='platforms'?platforms:tab==='switches'?switches:crossings;
 const validStation=tab==='stations'?editing?.name?.trim()&&editing?.node_id: true;
 async function previewFreight(){
  if(!freightFrom||!freightTo||busy)return;
  setBusy(true);setError('');setFreightPreview(null);
  try{const result=await request('/world-admin/rail/preview',{method:'POST',body:{origin_station_id:Number(freightFrom),destination_station_id:Number(freightTo)}});setFreightPreview(result)}
  catch(e){setError(e?.message||'Unable to check this rail route.')}finally{setBusy(false)}
 }
 async function promote(){
  if(!oldRoute||!canEdit||busy)return;
  setBusy(true);setError('');setMessage('');
  try{await request('/world-admin/network/legacy/'+oldRoute+'/promote',{method:'POST',body:{}});await onSaved?.();setOldRoute('');setMessage('Selected older route now supports station and crossing connections. Its bends and type were preserved.')}
  catch(e){setError(e?.message||'Unable to connect the older route.')}finally{setBusy(false)}
 }
 async function save(){
  if(!editing||!canEdit||busy)return;
  const payload=tab==='stations'?{...editing,region_id:Number(regionId),zone_id:Number(zoneId),node_id:asNum(editing.node_id),freight_capacity:asNum(editing.freight_capacity),freight_enabled:!!editing.freight_enabled,passenger_enabled:!!editing.passenger_enabled}:
    tab==='platforms'?{...editing,station_id:asNum(editing.station_id),track_length:asNum(editing.track_length),capacity:asNum(editing.capacity)}:
    tab==='switches'?{...editing,node_id:asNum(editing.node_id),entry_segment_id:asNum(editing.entry_segment_id),exit_segment_id:asNum(editing.exit_segment_id)}:
    {...editing,region_id:Number(regionId),zone_id:Number(zoneId),rail_segment_id:asNum(editing.rail_segment_id),road_segment_id:asNum(editing.road_segment_id),map_x:Number(editing.map_x),map_y:Number(editing.map_y)};
  setBusy(true);setError('');setMessage('');
  try{await request('/world-admin/rail/'+tab+(editing.id?'/'+editing.id:''),{method:editing.id?'PUT':'POST',body:payload});await onSaved?.();setEditing(null);setRecord(null);setMessage('Railway infrastructure saved.')}
  catch(e){setError(e?.message||'Unable to save railway infrastructure.')}finally{setBusy(false)}
 }
 async function remove(){
  if(!editing?.id||busy||!canEdit||!window.confirm('Delete this '+tab.slice(0,-1)+'? Connected track geometry will remain.'))return;
  setBusy(true);setError('');setMessage('');
  try{await request('/world-admin/rail/'+tab+'/'+editing.id,{method:'DELETE'});await onSaved?.();setEditing(null);setRecord(null);setMessage('Infrastructure record deleted.')}
  catch(e){setError(e?.message||'Unable to delete record.')}finally{setBusy(false)}
 }
 const stationById=id=>stations.find(s=>Number(s.id)===Number(id));
 const tabs=[['stations','train','Stations'],['platforms','boxes-stacked','Platforms'],['switches','code-branch','Switches'],['crossings','road-barrier','Crossings']];
 return <section className="wtm-rail-ops" aria-label="Railway and freight infrastructure">
  <div className="wtm-route-heading"><strong><i className="fa-solid fa-train"/> RAILWAY OPERATIONS</strong><span>{stations.length} stations · {rails.length} rail segments</span></div>
  <nav className="wtm-rail-tabs" aria-label="Rail infrastructure sections">{tabs.map(([id,icon,label])=><button type="button" key={id} aria-pressed={tab===id} className={tab===id?'active':''} onClick={()=>{setTab(id);setEditing(null);setRecord(null);setError('')}}><i className={'fa-solid fa-'+icon}/> {label}</button>)}</nav>
  {error&&<p role="alert" className="wtm-error">{error}</p>}{message&&<p role="status" className="wtm-note">{message}</p>}
  <div className="wtm-rail-catalog">
   {(tab==='stations'?stations:tab==='platforms'?platforms:tab==='switches'?switches:crossings).map(item=><button type="button" key={item.id} className={record?.id===item.id?'selected':''} onClick={()=>choose(tab,item)}>
    <strong>{tab==='stations'?item.name:tab==='platforms'?((stationById(item.station_id)?.name||'Station')+' · '+item.code):tab==='switches'?'Switch #'+item.id+' · Node '+item.node_id:item.name||'Crossing #'+item.id}</strong>
    <small>{tab==='stations'?(item.freight_ready?'Freight ready':stateLabel(item.status)):stateLabel(item.status)}</small>
   </button>)}
   <button className="wtm-rail-new" type="button" disabled={!canEdit||busy||tab==='stations'&&!stationNodes.length||tab==='platforms'&&!stations.length||tab==='switches'&&!rails.length||tab==='crossings'&&(!rails.length||!roads.length)} onClick={()=>start(tab)}><i className="fa-solid fa-plus"/> Add {tab.slice(0,-1)}</button>
  </div>
  {!!legacyRoutes.length&&<div className="wtm-rail-import">
   <label>Older route to connect<select value={oldRoute} onChange={e=>setOldRoute(e.target.value)}><option value="">Choose a single existing road or railway</option>{legacyRoutes.map(r=><option key={r.id} value={r.id}>{r.route_name||('Route '+r.id)} · {r.route_type}</option>)}</select></label>
   <button type="button" disabled={!canEdit||!oldRoute||busy} onClick={promote}><i className="fa-solid fa-link"/> Enable rail infrastructure on selected route</button>
  </div>}
  {stations.length>=2&&<div className="wtm-rail-freight-check" aria-label="Freight railway route check">
   <strong><i className="fa-solid fa-train-subway"/> FREIGHT ROUTE CHECK</strong>
   <label>Origin<select value={freightFrom} onChange={e=>{setFreightFrom(e.target.value);setFreightPreview(null)}}><option value="">Choose origin station</option>{stations.map(st=><option value={st.id} key={st.id}>{st.name}{st.freight_ready?' · Freight ready':''}</option>)}</select></label>
   <label>Destination<select value={freightTo} onChange={e=>{setFreightTo(e.target.value);setFreightPreview(null)}}><option value="">Choose destination</option>{stations.filter(st=>String(st.id)!==String(freightFrom)).map(st=><option value={st.id} key={st.id}>{st.name}</option>)}</select></label>
   <button type="button" disabled={!freightFrom||!freightTo||busy} onClick={previewFreight}><i className="fa-solid fa-route"/> Check route</button>
   {freightPreview&&<p role="status" className={freightPreview.available?'freight-good':'freight-blocked'}>{freightPreview.available?'Railway connection available through '+freightPreview.segment_ids.length+' track segment(s).':'Unavailable: '+String(freightPreview.reason||'unknown').replaceAll('_',' ')+'.'} This is a read-only check; no inventory or trains are moved.</p>}
  </div>}
  {tab==='stations'&&!stationNodes.length&&<p className="wtm-rail-help">Create a railway track between shared map nodes before adding a station. Stations attach to existing rail-connected nodes.</p>}
  {tab==='crossings'&&<p className="wtm-rail-help">Choose a railway and road, then click their intersection on the original map. Crossing status and control type can prevent future freight traversal.</p>}
  {tab==='switches'&&<p className="wtm-rail-help">Connect two railway segments to a shared junction first. Configure which track pair is open, closed or damaged; no train is dispatched automatically.</p>}
  {editing&&canEdit&&<div className="wtm-rail-form">
    {tab==='stations'&&<>
     <label>Station name<input maxLength={140} value={editing.name||''} onChange={e=>update('name',e.target.value)}/></label>
     <label>Rail-connected node<select disabled={!!editing.id} value={editing.node_id||''} onChange={e=>update('node_id',e.target.value)}><option value="">Select location</option>{stationNodes.filter(n=>editing.id||!usedStationNodes.has(Number(n.id))).map(n=><option value={n.id} key={n.id}>{nodeLabel(n)}</option>)}</select></label>
     <label>Station status<select value={editing.status} onChange={e=>update('status',e.target.value)}>{stateOptions.map(v=><option value={v} key={v}>{stateLabel(v)}</option>)}</select></label>
     <label>Freight capacity (units)<input type="number" min="0" max="1000000" value={editing.freight_capacity??0} onChange={e=>update('freight_capacity',e.target.value)}/></label>
     <label className="wtm-rail-check"><input type="checkbox" checked={!!editing.freight_enabled} onChange={e=>update('freight_enabled',e.target.checked)}/> Accept freight</label>
     <label className="wtm-rail-check"><input type="checkbox" checked={!!editing.passenger_enabled} onChange={e=>update('passenger_enabled',e.target.checked)}/> Passenger service</label>
     <label className="wide">Operational notes<textarea rows={2} maxLength={1200} value={editing.notes||''} onChange={e=>update('notes',e.target.value)}/></label>
    </>}
    {tab==='platforms'&&<>
     <label>Station<select disabled={!!editing.id} value={editing.station_id||''} onChange={e=>update('station_id',e.target.value)}>{stations.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
     <label>Platform code<input maxLength={30} value={editing.code||''} onChange={e=>update('code',e.target.value)}/></label>
     <label>Platform role<select value={editing.kind} onChange={e=>update('kind',e.target.value)}>{['freight','passenger','mixed','siding'].map(v=><option key={v}>{v}</option>)}</select></label>
     <label>Track length (relative units)<input type="number" min="1" max="1000000" value={editing.track_length??1} onChange={e=>update('track_length',e.target.value)}/></label>
     <label>Platform capacity (units)<input type="number" min="0" max="1000000" value={editing.capacity??0} onChange={e=>update('capacity',e.target.value)}/></label>
     <label>Status<select value={editing.status} onChange={e=>update('status',e.target.value)}>{stateOptions.map(v=><option key={v}>{stateLabel(v)}</option>)}</select></label>
    </>}
    {tab==='switches'&&<>
     <label>Shared railway node<select disabled={!!editing.id} value={editing.node_id||''} onChange={e=>setEditing(v=>({...v,node_id:e.target.value,entry_segment_id:'',exit_segment_id:''}))}><option value="">Choose junction</option>{zoneNodes.filter(n=>rails.filter(e=>Number(e.from_node_id)===Number(n.id)||Number(e.to_node_id)===Number(n.id)).length>=2).map(n=><option key={n.id} value={n.id}>{nodeLabel(n)}</option>)}</select></label>
     <label>Incoming track<select value={editing.entry_segment_id||''} onChange={e=>update('entry_segment_id',e.target.value)}><option value="">Choose track</option>{pairs.map(e=><option key={e.id} value={e.id}>{labelEdge(e)}</option>)}</select></label>
     <label>Outgoing track<select value={editing.exit_segment_id||''} onChange={e=>update('exit_segment_id',e.target.value)}><option value="">Choose track</option>{pairs.filter(e=>Number(e.id)!==Number(editing.entry_segment_id)).map(e=><option key={e.id} value={e.id}>{labelEdge(e)}</option>)}</select></label>
     <label>Switch state<select value={editing.status} onChange={e=>update('status',e.target.value)}>{['open','closed','damaged'].map(v=><option key={v}>{stateLabel(v)}</option>)}</select></label>
     <label className="wide">Notes<input maxLength={500} value={editing.notes||''} onChange={e=>update('notes',e.target.value)}/></label>
    </>}
    {tab==='crossings'&&<>
     <label>Railway<select value={editing.rail_segment_id||''} onChange={e=>update('rail_segment_id',e.target.value)}><option value="">Select rail</option>{rails.map(e=><option key={e.id} value={e.id}>{labelEdge(e)}</option>)}</select></label>
     <label>Road<select value={editing.road_segment_id||''} onChange={e=>update('road_segment_id',e.target.value)}><option value="">Select road</option>{roads.map(e=><option key={e.id} value={e.id}>{labelEdge(e)}</option>)}</select></label>
     <label>Crossing name<input maxLength={140} value={editing.name||''} onChange={e=>update('name',e.target.value)}/></label>
     <label>X<input type="number" min="0" max="100" step=".01" value={editing.map_x} onChange={e=>update('map_x',e.target.value)}/></label>
     <label>Y<input type="number" min="0" max="100" step=".01" value={editing.map_y} onChange={e=>update('map_y',e.target.value)}/></label>
     <label>Crossing control<select value={editing.control_type} onChange={e=>update('control_type',e.target.value)}>{['gated','ungated','signal','grade_separated'].map(v=><option key={v} value={v}>{stateLabel(v)}</option>)}</select></label>
     <label>Status<select value={editing.status} onChange={e=>update('status',e.target.value)}>{stateOptions.map(v=><option key={v}>{stateLabel(v)}</option>)}</select></label>
     <label className="wide">Notes<input maxLength={500} value={editing.notes||''} onChange={e=>update('notes',e.target.value)}/></label>
    </>}
    <div className="wtm-rail-actions wide"><button type="button" onClick={save} disabled={busy||tab==='stations'&&!validStation}><i className="fa-solid fa-floppy-disk"/> Save {tab.slice(0,-1)}</button><button type="button" onClick={()=>{setEditing(null);setRecord(null);onClearPoint?.()}} disabled={busy}>Cancel</button>{!!editing.id&&<button type="button" onClick={remove} disabled={busy}><i className="fa-solid fa-trash-can"/> Delete</button>}</div>
  </div>}
 </section>;
}
