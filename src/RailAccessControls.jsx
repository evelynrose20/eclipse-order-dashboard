import React,{useState} from 'react';
import './rail-access-controls.css';

/**
 * Compact network-status management embedded in Supply Command.
 * Existing rail tables remain storage/compatibility only; new stations and
 * two-way schedules are created from mapped tracks by the supply-line backend.
 */
export default function RailAccessControls({data,request,onRefresh,onClose}){
 const terminals=data.rail_terminals||[],services=data.rail_service_records||[];
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const stationName=id=>terminals.find(s=>Number(s.id)===Number(id))?.name||'Terminal '+id;
 async function update(path,body,label){
  setBusy(true);setError('');setNotice('');
  try{await request(path,{method:'PUT',body});await onRefresh();setNotice(label)}
  catch(err){setError(err.message||'Railway status could not be changed')}finally{setBusy(false)}
 }
 function stationStatus(st,status){
  return update('/internal-rail/stations/'+st.id,{name:st.name,stop_type:st.stop_type,stop_id:st.stop_id,status,platforms:Number(st.platforms),notes:st.notes||''},st.name+' set to '+status);
 }
 function serviceStatus(route,status){
  return update('/internal-rail/routes/'+route.id,{name:route.name,from_station_id:Number(route.from_station_id),to_station_id:Number(route.to_station_id),duration_minutes:Number(route.duration_minutes),status,cargo_notes:route.cargo_notes||''},route.name+' set to '+status);
 }
 return <div className="rail-access-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <section className="rail-access-dialog" role="dialog" aria-modal="true" aria-label="Railway network condition">
   <header><div><span>SUPPLY COMMAND · NETWORK READINESS</span><h3><i className="fa-solid fa-train"/> Railway access</h3><p>Railway paths and stations are registered automatically from connected map tracks. Review inherited damaged or paused infrastructure here without recreating routes.</p></div><button type="button" aria-label="Close railway access" onClick={onClose}><i className="fa-solid fa-xmark"/></button></header>
   {error&&<p role="alert" className="wa-error">{error}</p>}{notice&&<p role="status" className="wa-notice">{notice}</p>}
   <div className="rail-access-scroll">
    <h4>Rail terminals <small>{terminals.length}</small></h4>
    <div className="rail-access-grid">{terminals.map(st=><article key={st.id}><div><i className="fa-solid fa-location-dot"/><strong>{st.name}</strong><span className={'rail-access-state '+st.status}>{st.status}</span></div><small>{st.stop_type==='settlement'?'Settlement':'Order front'} · {st.platforms} platform(s)</small><div className="rail-access-actions">{st.status==='operational'?<button type="button" disabled={busy} onClick={()=>stationStatus(st,'closed')}>Close terminal</button>:st.status==='damaged'?<p>Damaged terminal — complete restoration before reopening it.</p>:<button type="button" disabled={busy} onClick={()=>stationStatus(st,'operational')}>Open terminal</button>}</div></article>)}</div>
    {!terminals.length&&<p className="rail-access-empty">No rail terminals registered yet. Create a supply line on a connected railway and its stops will be registered automatically.</p>}
    <h4>Rail services <small>{services.length}</small></h4>
    <div className="rail-access-grid">{services.map(s=><article key={s.id}><div><i className="fa-solid fa-route"/><strong>{s.name}</strong><span className={'rail-access-state '+s.status}>{s.status}</span></div><small>{stationName(s.from_station_id)} → {stationName(s.to_station_id)} · {s.duration_minutes} min</small><div className="rail-access-actions">{s.status==='active'?<button type="button" disabled={busy} onClick={()=>serviceStatus(s,'paused')}>Pause service</button>:<button type="button" disabled={busy} onClick={()=>serviceStatus(s,'active')}>Resume service</button>}</div></article>)}</div>
    {!services.length&&<p className="rail-access-empty">Services are registered automatically when a new freight order uses connected tracks.</p>}
   </div>
   <footer><small>Existing rail journeys and cargo history are retained. No freight is created by changing a service status.</small><button type="button" onClick={onClose}>Close</button></footer>
  </section>
 </div>;
}
