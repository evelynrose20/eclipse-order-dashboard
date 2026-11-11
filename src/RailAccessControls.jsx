import React,{useEffect,useState} from 'react';
import './rail-access-controls.css';

/**
 * Compact network-status management embedded in Supply Command.
 * Existing rail tables remain storage/compatibility only; new stations and
 * two-way schedules are created from mapped tracks by the supply-line backend.
 */
export default function RailAccessControls({data,request,onRefresh,onClose}){
 const terminals=data.rail_terminals||[],services=data.rail_service_records||[];
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [editing,setEditing]=useState(null);
 const [stops,setStops]=useState([]),[stopsBusy,setStopsBusy]=useState(false),[stopsError,setStopsError]=useState('');
 useEffect(()=>{
  let active=true;
  setStopsBusy(true);
  request('/internal-rail').then(result=>{if(active){setStops(result.stops||[]);setStopsError('')}})
   .catch(err=>{if(active)setStopsError(err.message||'Station locations are unavailable.')})
   .finally(()=>{if(active)setStopsBusy(false)});
  return()=>{active=false};
 },[request]);
 const newStation=()=>{
  const available=stops[0];
  setEditing({id:null,name:available?available.name+' cargo station':'',stop_type:available?.type||'settlement',stop_id:available?.id||'',status:'planned',platforms:1,notes:''});
  setError('');setNotice('');
 };
 const editStation=st=>{setEditing({id:st.id,name:st.name,stop_type:st.stop_type,stop_id:st.stop_id,status:st.status,platforms:Number(st.platforms),notes:st.notes||''});setError('');setNotice('')};
 const stationName=id=>terminals.find(s=>Number(s.id)===Number(id))?.name||'Terminal '+id;
 async function update(path,body,label,method='PUT'){
  setBusy(true);setError('');setNotice('');
  try{await request(path,{method,body});await onRefresh();setNotice(label);return true}
  catch(err){setError(err.message||'Railway status could not be changed');return false}finally{setBusy(false)}
 }
 async function saveStation(event){
  event.preventDefault();
  if(!editing||busy)return;
  const newRecord=!editing.id;
  const saved=await update('/internal-rail/stations'+(editing.id?'/'+editing.id:''),{name:editing.name,stop_type:editing.stop_type,stop_id:Number(editing.stop_id),status:editing.status,platforms:Number(editing.platforms),notes:editing.notes},editing.name+(newRecord?' added.':' updated.'),newRecord?'POST':'PUT');
  if(saved)setEditing(null);
 }
 function stationStatus(st,status){
  return update('/internal-rail/stations/'+st.id,{name:st.name,stop_type:st.stop_type,stop_id:st.stop_id,status,platforms:Number(st.platforms),notes:st.notes||''},st.name+' set to '+status);
 }
 function serviceStatus(route,status){
  return update('/internal-rail/routes/'+route.id,{name:route.name,from_station_id:Number(route.from_station_id),to_station_id:Number(route.to_station_id),duration_minutes:Number(route.duration_minutes),status,cargo_notes:route.cargo_notes||''},route.name+' set to '+status);
 }
 return <div className="rail-access-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <section className="rail-access-dialog" role="dialog" aria-modal="true" aria-label="Railway network condition">
   <header><div><span>SUPPLY COMMAND · NETWORK READINESS</span><h3><i className="fa-solid fa-train"/> Railway access</h3><p>Create stations at Order locations, manage existing terminals, record repairs, and review paused services. Railway routes still require a connected track network.</p></div><button type="button" aria-label="Close railway access" onClick={onClose}><i className="fa-solid fa-xmark"/></button></header>
   {error&&<p role="alert" className="wa-error">{error}</p>}{notice&&<p role="status" className="wa-notice">{notice}</p>}
   <div className="rail-access-scroll">
    <div className="rail-access-section-heading"><h4>Rail terminals <small>{terminals.length}</small></h4><button type="button" disabled={busy||stopsBusy||!stops.length} onClick={newStation}><i className="fa-solid fa-plus" aria-hidden="true"/> Add station</button></div>
    {stopsError&&<p className="rail-access-empty" role="alert">{stopsError}</p>}
    <div className="rail-access-grid">{terminals.map(st=><article key={st.id}><div><i className="fa-solid fa-location-dot"/><strong>{st.name}</strong><span className={'rail-access-state '+st.status}>{st.status}</span></div><small>{st.stop_type==='settlement'?'Settlement':'Order front'} · {st.platforms} platform(s)</small><div className="rail-access-actions"><button type="button" disabled={busy} onClick={()=>editStation(st)}>Manage</button>{st.status==='operational'?<button type="button" disabled={busy} onClick={()=>stationStatus(st,'closed')}>Close terminal</button>:st.status==='damaged'?<p>Damaged terminal — use Manage to record its repair and return it to service.</p>:<button type="button" disabled={busy} onClick={()=>stationStatus(st,'operational')}>Open terminal</button>}</div></article>)}</div>
    {!terminals.length&&<p className="rail-access-empty">No rail terminals registered yet. Select Add station to establish a terminal at an Order settlement or front.</p>}
    {editing&&<section className="rail-access-editor" aria-label={editing.id?'Manage '+editing.name:'Add railway station'}>
     <div className="rail-access-editor-head"><div><span>TERMINAL ADMINISTRATION</span><h4>{editing.id?'Manage '+editing.name:'Add railway station'}</h4><p>{editing.id?'Update the existing station. Its linked location and railway connections are retained.':'Select an Order location for the new terminal. Stations do not create tracks; freight still needs an operational railway connection.'}</p></div><button type="button" onClick={()=>{setEditing(null);setError('')}} disabled={busy} aria-label="Close station editor"><i className="fa-solid fa-xmark"/></button></div>
     <form onSubmit={saveStation}>
      <div className="rail-access-editor-fields">
       <label>Station name<input type="text" required maxLength={140} value={editing.name} onChange={e=>setEditing(v=>({...v,name:e.target.value}))}/></label>
       <label>Condition / operational status<select value={editing.status} onChange={e=>setEditing(v=>({...v,status:e.target.value}))}><option value="planned">Planned</option><option value="operational">Operational</option><option value="damaged">Damaged</option><option value="closed">Closed</option></select></label>
       <label>Platforms<input type="number" required min={1} max={100} step={1} value={editing.platforms} onChange={e=>setEditing(v=>({...v,platforms:e.target.value}))}/></label>
       {editing.id?<div className="rail-access-editor-location"><span>Attached to</span><strong>{stops.find(x=>x.type===editing.stop_type&&Number(x.id)===Number(editing.stop_id))?.name||((editing.stop_type==='settlement'?'Settlement':'Order front')+' # '+editing.stop_id)}</strong><small>Location is preserved when you save.</small></div>:<label>Station location<select required value={editing.stop_type+':'+editing.stop_id} onChange={e=>{const selected=stops.find(x=>x.type+':'+x.id===e.target.value);if(selected)setEditing(v=>({...v,stop_type:selected.type,stop_id:selected.id,name:v.name||selected.name+' cargo station'}))}}>{stops.map(stop=><option key={stop.type+':'+stop.id} value={stop.type+':'+stop.id}>{stop.name} · {stop.description}</option>)}</select></label>}
       <label className="wide">Station notes<textarea rows={3} maxLength={1200} value={editing.notes} onChange={e=>setEditing(v=>({...v,notes:e.target.value}))}/></label>
      </div>
      <div className="rail-access-editor-actions"><button type="button" onClick={()=>setEditing(null)} disabled={busy}>Cancel</button><button type="submit" disabled={busy||!editing.name.trim()||!Number(editing.stop_id)||!Number.isInteger(Number(editing.platforms))||Number(editing.platforms)<1||Number(editing.platforms)>100}>{busy?'Saving…':editing.id?'Save station':'Create station'}</button></div>
     </form>
    </section>}
    <h4>Rail services <small>{services.length}</small></h4>
    <div className="rail-access-grid">{services.map(s=><article key={s.id}><div><i className="fa-solid fa-route"/><strong>{s.name}</strong><span className={'rail-access-state '+s.status}>{s.status}</span></div><small>{stationName(s.from_station_id)} → {stationName(s.to_station_id)} · {s.duration_minutes} min</small><div className="rail-access-actions">{s.status==='active'?<button type="button" disabled={busy} onClick={()=>serviceStatus(s,'paused')}>Pause service</button>:<button type="button" disabled={busy} onClick={()=>serviceStatus(s,'active')}>Resume service</button>}</div></article>)}</div>
    {!services.length&&<p className="rail-access-empty">Services are registered automatically when a new freight order uses connected tracks.</p>}
   </div>
   <footer><small>Existing rail journeys and cargo history are retained. No freight is created by changing a service status.</small><button type="button" onClick={onClose}>Close</button></footer>
  </section>
 </div>;
}
