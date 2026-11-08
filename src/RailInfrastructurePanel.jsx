import React,{useEffect,useMemo,useState} from 'react';
import './rail-infrastructure-panel.css';
const stateOptions=['planned','operational','closed','damaged'];
const stateLabel=s=>s.replaceAll('_',' ').replace(/^./,x=>x.toUpperCase());
const routeReason={station_not_found:'Choose two saved railway stations.',stations_in_different_zones:'The two stations must belong to the same zone.',freight_platform_not_ready:'Both stations need operational freight platforms and handling capacity.',choose_distinct_stations:'Choose two different stations.',no_operational_rail_path:'No available rail route. Check junction switches, closed tracks and crossing states.',no_interzone_rail_path:'No operational cross-zone rail connection joins these networks.'};
const asNum=v=>Number(v);
const blankStation=(region,zone)=>({region_id:Number(region),zone_id:Number(zone),node_id:'',name:'',status:'planned',freight_enabled:true,passenger_enabled:false,freight_capacity:0,notes:''});
const blankPlatform=(id,platforms=[])=>{
 const existing=new Set(platforms.filter(p=>Number(p.station_id)===Number(id)).map(p=>String(p.code).toLowerCase()));
 let index=1;while(existing.has('f'+index))index++;
 return {station_id:Number(id),code:'F'+index,kind:'freight',track_length:1,capacity:10,status:'planned'};
};
const blankSwitch=()=>({node_id:'',entry_segment_id:'',exit_segment_id:'',status:'open',notes:''});
const blankCross=(region,zone,p)=>({region_id:Number(region),zone_id:Number(zone),rail_segment_id:'',road_segment_id:'',name:'',map_x:p?.x??50,map_y:p?.y??50,control_type:'gated',status:'planned',notes:''});
export default function RailInfrastructurePanel({regionId,zoneId,nodes=[],segments=[],legacyRoutes=[],settlements=[],stations=[],platforms=[],switches=[],crossings=[],allStations=[],links=[],zones=[],regions=[],canEdit,request,onSaved,point,onClearPoint,focus,onFocusHandled}){
 const [oldRoute,setOldRoute]=useState('');
 const [linkDraft,setLinkDraft]=useState(null);
 const [freightFrom,setFreightFrom]=useState(''),[freightTo,setFreightTo]=useState(''),[freightPreview,setFreightPreview]=useState(null);
 const [tab,setTab]=useState('stations'),[record,setRecord]=useState(null),[editing,setEditing]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const zoneNodes=nodes.filter(n=>Number(n.zone_id)===Number(zoneId)),zoneSegments=segments.filter(e=>Number(e.zone_id)===Number(zoneId));
 const rails=zoneSegments.filter(e=>e.route_type==='rail'),roads=zoneSegments.filter(e=>['road','trail'].includes(e.route_type));
 const stationNodes=zoneNodes.filter(n=>rails.some(e=>Number(e.from_node_id)===Number(n.id)||Number(e.to_node_id)===Number(n.id)));
 const usedStationNodes=new Set(stations.map(s=>Number(s.node_id)));
 const nodeLabel=n=>n.name||settlements.find(s=>Number(s.id)===Number(n.settlement_id))?.name||'Junction #'+n.id;
 const selectedStation=stations.find(s=>Number(s.id)===Number(record?.station_id??record?.id));
 const pairs=useMemo(()=>{const id=Number(editing?.node_id);return rails.filter(e=>Number(e.from_node_id)===id||Number(e.to_node_id)===id)},[rails,editing?.node_id]);
 useEffect(()=>{setRecord(null);setEditing(null);setTab('stations');setError('');setMessage('');setFreightFrom('');setFreightTo('');setFreightPreview(null);setLinkDraft(null)},[regionId,zoneId]);
 useEffect(()=>{if(point&&tab==='crossings'&&editing)setEditing(old=>old?{...old,map_x:point.x,map_y:point.y}:old)},[point?.x,point?.y,tab]);
 useEffect(()=>{
  if(!focus?.kind||focus.id==null)return;
  const items=focus.kind==='stations'?stations:focus.kind==='switches'?switches:focus.kind==='crossings'?crossings:platforms;
  const item=items.find(x=>Number(x.id)===Number(focus.id));
  if(item){setTab(focus.kind);setRecord(item);setEditing({...item});setError('');setMessage('')}
  onFocusHandled?.();
 },[focus?.kind,focus?.id]);

 const update=(key,value)=>setEditing(old=>({...old,[key]:value}));
 const labelEdge=e=>e.route_name||('Track #'+e.id);
 function start(kind,existing=null){
  setTab(kind);setError('');setMessage('');setRecord(existing);
  if(existing){setEditing({...existing});return}
  setEditing(kind==='stations'?blankStation(regionId,zoneId):kind==='platforms'?blankPlatform(selectedStation?.id||stations[0]?.id||0,platforms):kind==='switches'?blankSwitch():blankCross(regionId,zoneId,point));
 }
 function choose(kind,item){setTab(kind);setRecord(item);setEditing({...item});setError('');setMessage('')}
 const currentList=tab==='stations'?stations:tab==='platforms'?platforms:tab==='switches'?switches:tab==='crossings'?crossings:localLinks;
 const validation=()=>{
  if(!editing)return '';
  if(tab==='stations')return !editing.name?.trim()?'Enter a station name.':!Number(editing.node_id)?'Choose a rail-connected junction or settlement.':'';
  if(tab==='platforms')return !Number(editing.station_id)?'Select a station before adding its platform.':!editing.code?.trim()?'Enter a platform code (for example F1).':!Number.isInteger(Number(editing.track_length))||Number(editing.track_length)<1?'Track length must be at least 1.':!Number.isInteger(Number(editing.capacity))||Number(editing.capacity)<0?'Platform capacity must be zero or more.':'';
  if(tab==='switches')return !Number(editing.node_id)?'Choose a shared junction.':!Number(editing.entry_segment_id)||!Number(editing.exit_segment_id)?'Choose both tracks that meet at the junction.':Number(editing.entry_segment_id)===Number(editing.exit_segment_id)?'Choose two different tracks.':'';
  if(tab==='crossings')return !Number(editing.rail_segment_id)||!Number(editing.road_segment_id)?'Choose both a railway and a road.':'';
  return '';
 };
 const formError=validation();
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
  if(!editing||!canEdit||busy||tab==='links')return;
  const invalid=validation();if(invalid){setError(invalid);return}
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
 const localLinks=links.filter(l=>allStations.some(st=>Number(st.id)===Number(l.from_station_id)&&Number(st.zone_id)===Number(zoneId))||allStations.some(st=>Number(st.id)===Number(l.to_station_id)&&Number(st.zone_id)===Number(zoneId)));
 const locationFor=st=>{const z=zones.find(x=>Number(x.id)===Number(st?.zone_id)),r=regions.find(x=>Number(x.id)===Number(st?.region_id));return (r?.name||'Region')+' / '+(z?.name||'Zone')};
 const stationLabel=st=>(st?.name||'Unknown station')+' — '+locationFor(st);
 const blankLink=()=>({from_station_id:stations[0]?.id||'',to_station_id:'',name:'',status:'planned',freight_enabled:true,bidirectional:true,notes:''});
 async function saveLink(){
  if(!linkDraft||busy)return;
  if(!Number(linkDraft.from_station_id)||!Number(linkDraft.to_station_id)){setError('Choose both railway stations.');return}
  setBusy(true);setError('');setMessage('');
  try{await request('/world-admin/rail/links'+(linkDraft.id?'/'+linkDraft.id:''),{method:linkDraft.id?'PUT':'POST',body:{...linkDraft,from_station_id:Number(linkDraft.from_station_id),to_station_id:Number(linkDraft.to_station_id)}});await onSaved?.();setLinkDraft(null);setMessage('Cross-zone railway connection saved.')}
  catch(e){setError(e.message||'Unable to save cross-zone link.')}finally{setBusy(false)}
 }
 async function removeLink(){
  if(!linkDraft?.id||busy||!window.confirm('Delete this railway connection?'))return;
  setBusy(true);setError('');
  try{await request('/world-admin/rail/links/'+linkDraft.id,{method:'DELETE'});await onSaved?.();setLinkDraft(null);setMessage('Cross-zone connection deleted.')}
  catch(e){setError(e.message||'Unable to delete connection.')}finally{setBusy(false)}
 }
 const tabs=[['stations','train','Stations'],['platforms','boxes-stacked','Platforms'],['switches','code-branch','Switches'],['crossings','road-barrier','Crossings'],['links','link','Network links']];
 return <section className="wtm-rail-ops" aria-label="Railway and freight infrastructure">
  <div className="wtm-route-heading"><strong><i className="fa-solid fa-train"/> RAILWAY OPERATIONS</strong><span>{stations.length} stations · {rails.length} rail segments</span></div>
  <nav className="wtm-rail-tabs" aria-label="Rail infrastructure sections">{tabs.map(([id,icon,label])=><button type="button" key={id} aria-pressed={tab===id} className={tab===id?'active':''} onClick={()=>{setTab(id);setEditing(null);setRecord(null);setLinkDraft(null);setError('')}}><i className={'fa-solid fa-'+icon}/> {label}</button>)}</nav>
  {error&&<p role="alert" className="wtm-error">{error}</p>}{message&&<p role="status" className="wtm-note">{message}</p>}
  {tab==='links'&&<div className="wtm-rail-links">
    <p className="wtm-rail-help">Link stations on different zone or region maps. These links represent rail continuing beyond the local map; no geometry is inferred between unrelated map coordinates.</p>
    <div className="wtm-rail-catalog">{localLinks.map(l=><button type="button" key={l.id} onClick={()=>setLinkDraft({...l})}><strong>{l.name||'Regional rail connection'}</strong><small>{stationLabel(allStations.find(st=>Number(st.id)===Number(l.from_station_id)))} ↔ {stationLabel(allStations.find(st=>Number(st.id)===Number(l.to_station_id)))} · {stateLabel(l.status)}</small></button>)}
    <button type="button" disabled={!stations.length||!allStations.some(st=>Number(st.zone_id)!==Number(zoneId))} onClick={()=>setLinkDraft(blankLink())}><i className="fa-solid fa-plus"/> Add network link</button></div>
    {linkDraft&&<div className="wtm-rail-form">
     <label>Origin station<select value={linkDraft.from_station_id||''} onChange={e=>setLinkDraft(v=>({...v,from_station_id:e.target.value}))}><option value="">Choose origin station</option>{allStations.map(st=><option key={st.id} value={st.id}>{stationLabel(st)}</option>)}</select></label>
     <label>Destination station<select value={linkDraft.to_station_id||''} onChange={e=>setLinkDraft(v=>({...v,to_station_id:e.target.value}))}><option value="">Choose station on another map</option>{allStations.filter(st=>Number(st.zone_id)!==Number(allStations.find(s=>Number(s.id)===Number(linkDraft.from_station_id))?.zone_id)).map(st=><option key={st.id} value={st.id}>{stationLabel(st)}</option>)}</select></label>
     <label>Connection name<input maxLength={140} value={linkDraft.name} onChange={e=>setLinkDraft(v=>({...v,name:e.target.value}))}/></label>
     <label>Operational status<select value={linkDraft.status} onChange={e=>setLinkDraft(v=>({...v,status:e.target.value}))}>{stateOptions.map(v=><option value={v} key={v}>{stateLabel(v)}</option>)}</select></label>
     <label className="wtm-rail-check"><input type="checkbox" checked={!!linkDraft.bidirectional} onChange={e=>setLinkDraft(v=>({...v,bidirectional:e.target.checked}))}/> Two-way connection</label>
     <label className="wtm-rail-check"><input type="checkbox" checked={!!linkDraft.freight_enabled} onChange={e=>setLinkDraft(v=>({...v,freight_enabled:e.target.checked}))}/> Freight allowed</label>
     <label className="wide">Notes<textarea rows={2} maxLength={1200} value={linkDraft.notes} onChange={e=>setLinkDraft(v=>({...v,notes:e.target.value}))}/></label>
     <div className="wtm-rail-actions wide"><button type="button" disabled={busy||!linkDraft.from_station_id||!linkDraft.to_station_id} onClick={saveLink}>Save connection</button><button type="button" onClick={()=>setLinkDraft(null)}>Cancel</button>{linkDraft.id&&<button type="button" onClick={removeLink}>Delete link</button>}</div>
    </div>}
   </div>}
  {tab!=='links'&&<div className="wtm-rail-catalog">
   {(tab==='stations'?stations:tab==='platforms'?platforms:tab==='switches'?switches:crossings).map(item=><button type="button" key={item.id} className={record?.id===item.id?'selected':''} onClick={()=>choose(tab,item)}>
    <strong>{tab==='stations'?item.name:tab==='platforms'?((stationById(item.station_id)?.name||'Station')+' · '+item.code):tab==='switches'?'Switch #'+item.id+' · Node '+item.node_id:item.name||'Crossing #'+item.id}</strong>
    <small>{tab==='stations'?(item.freight_ready?'Freight ready':stateLabel(item.status)):stateLabel(item.status)}</small>
   </button>)}
   <button className="wtm-rail-new" type="button" disabled={!canEdit||busy||tab==='stations'&&!stationNodes.length||tab==='platforms'&&!stations.length||tab==='switches'&&!rails.length||tab==='crossings'&&(!rails.length||!roads.length)} onClick={()=>start(tab)}><i className="fa-solid fa-plus"/> Add {tab.slice(0,-1)}</button>
  </div>}
  {!!legacyRoutes.length&&tab!=='links'&&<div className="wtm-rail-import">
   <label>Older route to connect<select value={oldRoute} onChange={e=>setOldRoute(e.target.value)}><option value="">Choose a single existing road or railway</option>{legacyRoutes.map(r=><option key={r.id} value={r.id}>{r.route_name||('Route '+r.id)} · {r.route_type}</option>)}</select></label>
   <button type="button" disabled={!canEdit||!oldRoute||busy} onClick={promote}><i className="fa-solid fa-link"/> Enable rail infrastructure on selected route</button>
  </div>}
  {allStations.length>=2&&<div className="wtm-rail-freight-check" aria-label="Freight railway route check">
   <strong><i className="fa-solid fa-train-subway"/> FREIGHT ROUTE CHECK</strong>
   <label>Origin<select value={freightFrom} onChange={e=>{setFreightFrom(e.target.value);setFreightPreview(null)}}><option value="">Choose origin station</option>{allStations.map(st=><option value={st.id} key={st.id}>{stationLabel(st)}{st.freight_ready?' · Freight ready':''}</option>)}</select></label>
   <label>Destination<select value={freightTo} onChange={e=>{setFreightTo(e.target.value);setFreightPreview(null)}}><option value="">Choose destination</option>{allStations.filter(st=>String(st.id)!==String(freightFrom)).map(st=><option value={st.id} key={st.id}>{stationLabel(st)}</option>)}</select></label>
   <button type="button" disabled={!freightFrom||!freightTo||busy} onClick={previewFreight}><i className="fa-solid fa-route"/> Check route</button>
   {freightPreview&&<p role="status" className={freightPreview.available?'freight-good':'freight-blocked'}>{freightPreview.available?'Railway connection available through '+freightPreview.segment_ids.length+' track segment(s).':'Unavailable: '+(routeReason[freightPreview.reason]||'This railway route is not available')+'.'} This is a read-only check; no inventory or trains are moved.</p>}
  </div>}
  {tab==='platforms'&&!stations.length&&<p className="wtm-rail-help">Create a railway station first. Platforms are facilities within a station, not separate points on the map.</p>}
  {tab==='stations'&&!stationNodes.length&&<p className="wtm-rail-help">Create a railway track between shared map nodes before adding a station. Stations attach to existing rail-connected nodes.</p>}
  {tab==='crossings'&&<p className="wtm-rail-help">Choose a railway and road, then click their intersection on the original map. Crossing status and control type can prevent future freight traversal.</p>}
  {tab==='switches'&&<p className="wtm-rail-help">Connect two railway segments to a shared junction first. Configure which track pair is open, closed or damaged; no train is dispatched automatically.</p>}
  {editing&&canEdit&&tab!=='links'&&<div className="wtm-rail-form">
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
     <label>Station<select disabled={!!editing.id} value={editing.station_id||''} onChange={e=>{const b=blankPlatform(Number(e.target.value),platforms);setEditing(old=>({...old,station_id:b.station_id,code:b.code}))}}>{stations.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
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
    {formError&&<p className="wtm-rail-help wide" role="status">{formError}</p>}
    <div className="wtm-rail-actions wide"><button type="button" onClick={save} disabled={busy||!!formError}><i className="fa-solid fa-floppy-disk"/> Save {tab.slice(0,-1)}</button><button type="button" onClick={()=>{setEditing(null);setRecord(null);onClearPoint?.()}} disabled={busy}>Cancel</button>{!!editing.id&&<button type="button" onClick={remove} disabled={busy}><i className="fa-solid fa-trash-can"/> Delete</button>}</div>
  </div>}
 </section>;
}
