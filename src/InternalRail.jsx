import React,{useEffect,useMemo,useState} from 'react';
import './internal-rail.css';

const blank=()=>({name:'',from_station_id:'',to_station_id:'',duration_minutes:60,status:'active',cargo_notes:''});
const blankStation=()=>({name:'',stop:'',status:'planned',platforms:1,notes:''});
const stopKey=s=>s.type+':'+s.id;
const durationLabel=value=>{const n=Number(value||0),hours=Math.floor(n/60),minutes=n%60;return (hours?hours+'h ':'')+(minutes?minutes+'m':hours?'':'0m')};
const formatTime=value=>{if(!value)return 'Not scheduled';const t=new Date(value);return Number.isNaN(t.getTime())?'—':t.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})};
const statusLabel=status=>String(status||'').replaceAll('_',' ').replace(/^./,s=>s.toUpperCase());
const instant=value=>new Date(value).getTime();
export function calculateProgress(journey,now=Date.now()){
 const a=instant(journey.departed_at),b=instant(journey.expected_arrival_at);
 if(journey.status==='arrived')return 100;
 return Number.isFinite(a)&&Number.isFinite(b)&&b>a?Math.max(0,Math.min(100,Math.round((now-a)/(b-a)*100))):0;
}
export default function InternalRail({request}){
 const [trainSelection,setTrainSelection]=useState({});
 const [timetables,setTimetables]=useState({});
 const [data,setData]=useState(null),[draft,setDraft]=useState(null),[stationDraft,setStationDraft]=useState(null),[view,setView]=useState('services'),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[now,setNow]=useState(Date.now()),[scope,setScope]=useState('active');
 const refresh=async()=>setData(await request('/internal-rail'));
 useEffect(()=>{let active=true;request('/internal-rail').then(r=>{if(active)setData(r)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[request]);
 useEffect(()=>{const handle=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(handle)},[]);
 const stops=data?.stops||[],stations=data?.stations||[],routes=data?.routes||[],journeys=data?.journeys||[],trains=data?.trains||[];
 const stationNames=new Map(stations.map(st=>[Number(st.id),st.name]));
 const stationLabel=id=>stationNames.get(Number(id))||'Station #'+id;
 const names=new Map(stops.map(s=>[stopKey(s),s.name]));
 const labelStop=(type,id)=>names.get(type+':'+id)||('Former '+type+' #'+id);
 const routeJourneys=id=>journeys.filter(j=>Number(j.route_id)===Number(id));
 const activeJourney=id=>routeJourneys(id).find(j=>j.status==='running'&&calculateProgress(j,now)<100);
 const viewed=routes.filter(r=>scope==='all'||(scope==='active'?r.status!=='retired':r.status===scope));
 const routeLabel=r=>labelStop(r.from_type,r.from_id)+' → '+labelStop(r.to_type,r.to_id);
 const stats={routes:routes.filter(r=>r.status==='active').length,travelling:journeys.filter(j=>j.status==='running'&&calculateProgress(j,now)<100).length,arrivals:journeys.filter(j=>j.status==='arrived'||j.status==='running'&&calculateProgress(j,now)===100).length};
 function begin(r=null){
  setError('');setNotice('');
  setDraft(r?{...r,from_station_id:String(r.from_station_id||''),to_station_id:String(r.to_station_id||'')}:blank());
 }
 const parseStop=value=>{const [type,n]=String(value).split(':');return {type,id:Number(n)}};
 const routeError=()=>{
  if(!draft)return '';
  if(!draft.name.trim())return 'Give this internal railway service a name.';
  if(!draft.from_station_id||!draft.to_station_id)return 'Choose both the origin and destination stations.';
  if(draft.from_station_id===draft.to_station_id)return 'Choose different origin and destination stations.';
  if(!Number.isInteger(Number(draft.duration_minutes))||Number(draft.duration_minutes)<1||Number(draft.duration_minutes)>10080)return 'Travel time must be between 1 minute and 7 days.';
  return '';
 };
 async function perform(path,options,message){
  setBusy(true);setError('');setNotice('');
  try{await request(path,options);await refresh();setNotice(message);return true}
  catch(e){setError(e.message||'Railway operation failed.');return false}
  finally{setBusy(false)}
 }
 async function save(){
  if(!draft)return;
  const invalid=routeError();if(invalid){setError(invalid);return}
  const payload={name:draft.name.trim(),from_station_id:Number(draft.from_station_id),to_station_id:Number(draft.to_station_id),duration_minutes:Number(draft.duration_minutes),status:draft.status,cargo_notes:draft.cargo_notes||''};
  if(await perform('/internal-rail/routes'+(draft.id?'/'+draft.id:''),{method:draft.id?'PUT':'POST',body:payload},'Internal railway service saved.'))setDraft(null);
 }
 async function retire(r){
  if(!window.confirm('Retire '+r.name+'? Existing journey records will remain.'))return;
  await perform('/internal-rail/routes/'+r.id,{method:'DELETE'},'Service retired; journey history preserved.');
 }
 const destinations=stations.filter(st=>String(st.id)!==String(draft?.from_station_id)&&!(stations.find(x=>String(x.id)===String(draft?.from_station_id))?.stop_type===st.stop_type&&Number(stations.find(x=>String(x.id)===String(draft?.from_station_id))?.stop_id)===Number(st.stop_id)));
 const stationStop=station=>labelStop(station.stop_type,station.stop_id);
 const stationError=()=>{
  if(!stationDraft)return '';
  if(!stationDraft.name.trim())return 'Name the railway station.';
  if(!stationDraft.stop)return 'Choose a settlement or Order front for the station.';
  if(!Number.isInteger(Number(stationDraft.platforms))||Number(stationDraft.platforms)<1||Number(stationDraft.platforms)>100)return 'Platform count must be between 1 and 100.';
  return '';
 };
 async function saveStation(){
  const invalid=stationError();if(invalid){setError(invalid);return}
  const stop=parseStop(stationDraft.stop);
  const payload={name:stationDraft.name.trim(),stop_type:stop.type,stop_id:stop.id,status:stationDraft.status,platforms:Number(stationDraft.platforms),notes:stationDraft.notes||''};
  if(await perform('/internal-rail/stations'+(stationDraft.id?'/'+stationDraft.id:''),{method:stationDraft.id?'PUT':'POST',body:payload},'Internal rail station saved.'))setStationDraft(null);
 }
 async function removeStation(st){
  if(!window.confirm('Delete station '+st.name+'? Stations used by railway services must be retained.'))return;
  await perform('/internal-rail/stations/'+st.id,{method:'DELETE'},'Station deleted.');
 }

 return <section className="internal-rail">
  <header className="ir-header"><div><span>ORDER OPERATIONS · INTERNAL TRANSPORT</span><h2><i className="fa-solid fa-train"/> Internal Rail Logistics</h2><p>Manage Order railway stations, internal routes and timed train runs between settlements and fronts. All operations are menu-based.</p></div><button type="button" onClick={()=>{setView('services');begin()}} disabled={busy||stations.length<2}><i className="fa-solid fa-plus"/> New rail service</button></header>
  {error&&<p className="ir-error" role="alert">{error}</p>}{notice&&<p className="ir-notice" role="status">{notice}</p>}
  <nav className="ir-tabs" aria-label="Internal railway management"><button type="button" className={view==='services'?'active':''} onClick={()=>setView('services')}><i className="fa-solid fa-route"/> Rail services</button><button type="button" className={view==='stations'?'active':''} onClick={()=>setView('stations')}><i className="fa-solid fa-train-subway"/> Stations</button></nav>
  <div className="ir-stats"><div><small>Active services</small><strong>{stats.routes}</strong></div><div><small>Trains en route</small><strong>{stats.travelling}</strong></div><div><small>Arrived runs</small><strong>{stats.arrivals}</strong></div></div>
  {view==='services'&&<><div className="ir-toolbar"><strong>Internal railway services</strong><label>Show <select value={scope} onChange={e=>setScope(e.target.value)}><option value="active">Current routes</option><option value="all">All routes</option><option value="paused">Paused</option><option value="retired">Retired</option></select></label></div>
  {!data&&<p className="ir-empty">Loading the internal rail ledger…</p>}
  {data&&stations.length<2&&<p className="ir-empty">Create two stations in the Stations tab first, assigning each to an Order-controlled settlement or Order front.</p>}
  <div className="ir-route-grid">{viewed.map(r=>{
   const travelling=activeJourney(r.id),history=routeJourneys(r.id),latest=history[0],p=travelling?calculateProgress(travelling,now):latest?.status==='arrived'?100:0;
   const remaining=travelling?Math.max(0,Math.ceil((instant(travelling.expected_arrival_at)-now)/60000)):0;
   return <article className="ir-route-card" key={r.id}>
    <div className="ir-route-head"><div><small>RAIL SERVICE · #{r.id}</small><h3>{r.name}</h3></div><span className={'ir-state '+r.status}>{statusLabel(r.status)}</span></div>
    <div className="ir-stops"><span><i className="fa-solid fa-location-dot"/> {stationLabel(r.from_station_id)} <small>({labelStop(r.from_type,r.from_id)})</small></span><i className="fa-solid fa-arrow-right-long" aria-hidden="true"/><span><i className="fa-solid fa-flag-checkered"/> {stationLabel(r.to_station_id)} <small>({labelStop(r.to_type,r.to_id)})</small></span></div>
    <div className="ir-trip-info"><span><i className="fa-regular fa-clock"/> Planned journey: {durationLabel(r.duration_minutes)}</span><span>{travelling?'En route':latest?.status==='cancelled'?'Last run cancelled':latest?'Last run: '+statusLabel(latest.display_status||latest.status):'Not dispatched'}</span>{(travelling||latest)?.train_name&&<span>Train: {(travelling||latest).train_name} · freight {Number((travelling||latest).cargo_capacity_snapshot||0).toLocaleString()}</span>}{travelling?.location&&<span>{travelling.location.status==='loading'?'At station: '+labelStop('settlement',travelling.location.at_settlement_id):travelling.location.status==='travelling'?'Approaching '+labelStop('settlement',travelling.location.next_settlement_id):'Current: '+statusLabel(travelling.location.status)}</span>}</div>
    <div className="ir-progress" aria-label={'Train journey '+Math.round(p)+' percent complete'}><div className="ir-track"><div className="ir-track-filled" style={{width:p+'%'}}/><span className="ir-train" style={{left:p+'%'}}><i className="fa-solid fa-train" aria-hidden="true"/></span></div><div className="ir-progress-label"><span>{travelling?'Departed '+formatTime(travelling.departed_at):'Origin'}</span><span>{travelling?remaining+'m remaining':latest?.status==='arrived'?'Arrived '+formatTime(latest.expected_arrival_at):'Destination'}</span></div></div>
    {r.cargo_notes&&<p className="ir-notes"><i className="fa-solid fa-boxes-stacked"/> {r.cargo_notes}</p>}
    <div className="ir-form-grid"><label>Manufactured train consist<select aria-label={'Train assigned to '+r.name} value={trainSelection[r.id]||''} onChange={e=>setTrainSelection(v=>({...v,[r.id]:e.target.value}))}><option value="">Select assembled train</option>{trains.filter(t=>!journeys.some(j=>Number(j.train_consist_id)===Number(t.id)&&j.status==='running'&&calculateProgress(j,now)<100)).map(t=><option key={t.id} value={t.id}>{t.name} · {t.wagon_count} wagons · {Number(t.cargo_capacity).toLocaleString()} freight</option>)}</select></label></div>
    <details className="ir-history ir-scheduled-stops"><summary>Intermediate station stops ({(timetables[r.id]||[]).length})</summary><p className="ir-notes">Choose up to eight operational Order stations on this service. The journey splits its travel time between stops, including a loading window at each station.</p>{stations.filter(st=>st.status==='operational'&&st.stop_type==='settlement'&&Number(st.id)!==Number(r.from_station_id)&&Number(st.id)!==Number(r.to_station_id)).map(st=><label key={st.id} className="ir-stop-option"><input type="checkbox" checked={(timetables[r.id]||[]).includes(Number(st.id))} disabled={busy||(!(timetables[r.id]||[]).includes(Number(st.id))&&(timetables[r.id]||[]).length>=8)} onChange={e=>setTimetables(old=>({...old,[r.id]:e.target.checked?[...(old[r.id]||[]),Number(st.id)]:(old[r.id]||[]).filter(id=>id!==Number(st.id))}))}/>{st.name} · {stationStop(st)}</label>)}</details>
    {!trains.length&&<p className="ir-notes">No manufactured trains yet. Assemble a locomotive and carriages in Industry &amp; Projects → Magitek &amp; war stores.</p>}
    {trainSelection[r.id]&&<p className="ir-notes">Available capacity is calculated from the train's actual manufactured carriages. This schedules the train; cargo loading and fuel transfer are not yet automatic.</p>}
    <div className="ir-actions"><button type="button" disabled={busy} onClick={()=>begin(r)}><i className="fa-solid fa-pen"/> Edit</button><button type="button" className="ir-primary" disabled={busy||r.status!=='active'||!!travelling||!trainSelection[r.id]} onClick={()=>perform('/internal-rail/routes/'+r.id+'/dispatch',{method:'POST',body:{train_consist_id:Number(trainSelection[r.id]),intermediate_station_ids:timetables[r.id]||[]}},'Manufactured train dispatched.') }><i className="fa-solid fa-train"/> Dispatch train</button>{travelling&&<button type="button" disabled={busy} onClick={()=>perform('/internal-rail/journeys/'+travelling.id+'/cancel',{method:'POST',body:{}},'Journey cancelled.')}>Cancel run</button>}{r.status!=='retired'&&<button type="button" disabled={busy} onClick={()=>retire(r)}>Retire</button>}</div>
    {history.length>0&&<details className="ir-history"><summary>Journey history ({history.length})</summary>{history.slice(0,8).map(j=><div key={j.id}><span>{statusLabel(j.status==='running'&&calculateProgress(j,now)===100?'arrived':j.status)}</span><span>{formatTime(j.departed_at)} → {formatTime(j.expected_arrival_at)}</span></div>)}</details>}
   </article>
  })}</div>
  {data&&!viewed.length&&<p className="ir-empty">No railway services in this view. Add a route to begin managing Order train movements.</p>}
  </>}
  {view==='stations'&&<div className="ir-stations">
   <div className="ir-toolbar"><strong>Order railway stations</strong><button type="button" disabled={busy||!stops.length} onClick={()=>{setStationDraft(blankStation());setError('')}}><i className="fa-solid fa-plus"/> Add station</button></div>
   {data&&!stops.length&&<p className="ir-empty">There are no eligible Order settlements or fronts yet. Assign a settlement to the Order in World Administration, or activate an Order front.</p>}
   <div className="ir-route-grid">{stations.map(st=><article key={st.id} className="ir-route-card"><div className="ir-route-head"><div><small>INTERNAL STATION · #{st.id}</small><h3><i className="fa-solid fa-train-subway"/> {st.name}</h3></div><span className={'ir-state '+st.status}>{statusLabel(st.status)}</span></div>
   <p className="ir-station-location"><i className="fa-solid fa-location-dot"/> {stationStop(st)} · {st.stop_type==='front'?'Order front':'Settlement'}</p>
   <p className="ir-trip-info">{st.platforms} {Number(st.platforms)===1?'platform':'platforms'} · No physical map tracks required</p>
   {st.notes&&<p className="ir-notes">{st.notes}</p>}
   <div className="ir-actions"><button type="button" onClick={()=>setStationDraft({...st,stop:st.stop_type+':'+st.stop_id})}><i className="fa-solid fa-pen"/> Edit station</button><button type="button" disabled={busy} onClick={()=>removeStation(st)}>Delete</button></div>
   </article>)}</div>
   {data&&!stations.length&&<p className="ir-empty">No internal stations yet. Create one at a settlement or Order front, then configure a rail service to another station.</p>}
  </div>}
  <p className="ir-footnote">Travel times are set by Order command. Arrivals are clock-based; this ledger does not automatically move or consume inventory, reserve player materials, or simulate actual rail tracks.</p>
  {stationDraft&&<div className="ir-modal-backdrop"><form className="ir-modal" onSubmit={e=>{e.preventDefault();saveStation()}} aria-label="Edit Order railway station"><header><h3>{stationDraft.id?'Edit station':'New Order railway station'}</h3><button type="button" onClick={()=>setStationDraft(null)} aria-label="Close editor"><i className="fa-solid fa-xmark"/></button></header>
   <label>Station name<input required maxLength={140} value={stationDraft.name} onChange={e=>setStationDraft(v=>({...v,name:e.target.value}))} placeholder="e.g. Moonlight Freight Terminal"/></label>
   <label>At settlement or front<select value={stationDraft.stop} required onChange={e=>setStationDraft(v=>({...v,stop:e.target.value}))}><option value="">Choose Order location</option>{stops.map(st=><option value={stopKey(st)} key={stopKey(st)}>{st.name} · {st.description}</option>)}</select></label>
   <div className="ir-form-grid"><label>Status<select value={stationDraft.status} onChange={e=>setStationDraft(v=>({...v,status:e.target.value}))}>{['planned','operational','closed','damaged'].map(status=><option key={status} value={status}>{statusLabel(status)}</option>)}</select></label><label>Platforms (count)<input type="number" min={1} max={100} value={stationDraft.platforms} onChange={e=>setStationDraft(v=>({...v,platforms:e.target.value}))}/></label></div>
   <label>Station notes<textarea maxLength={1200} rows={3} value={stationDraft.notes||''} onChange={e=>setStationDraft(v=>({...v,notes:e.target.value}))}/></label>
   <div className="ir-form-actions"><button type="button" onClick={()=>setStationDraft(null)}>Cancel</button><button type="submit" className="ir-primary" disabled={busy||!!stationError()}><i className="fa-solid fa-floppy-disk"/> Save station</button></div></form></div>}
  {draft&&<div className="ir-modal-backdrop"><form className="ir-modal" onSubmit={e=>{e.preventDefault();save()}} aria-label="Edit internal railway route"><header><h3>{draft.id?'Edit rail service':'New internal railway service'}</h3><button type="button" onClick={()=>setDraft(null)} aria-label="Close editor"><i className="fa-solid fa-xmark"/></button></header>
   <label>Service name<input maxLength={140} required value={draft.name} onChange={e=>setDraft(v=>({...v,name:e.target.value}))} placeholder="e.g. Moonlight Supply Express"/></label>
   <div className="ir-form-grid"><label>Origin station<select value={draft.from_station_id} required onChange={e=>setDraft(v=>({...v,from_station_id:e.target.value,to_station_id:e.target.value===v.to_station_id?'':v.to_station_id}))}><option value="">Choose origin</option>{stations.map(st=><option key={st.id} value={st.id}>{st.name} · {stationStop(st)}</option>)}</select></label><label>Destination station<select value={draft.to_station_id} required onChange={e=>setDraft(v=>({...v,to_station_id:e.target.value}))}><option value="">Choose destination</option>{destinations.map(st=><option key={st.id} value={st.id}>{st.name} · {stationStop(st)}</option>)}</select></label></div>
   <div className="ir-form-grid"><label>Journey duration (minutes)<input type="number" min={1} max={10080} required value={draft.duration_minutes} onChange={e=>setDraft(v=>({...v,duration_minutes:e.target.value}))}/></label><label>Route status<select value={draft.status} onChange={e=>setDraft(v=>({...v,status:e.target.value}))}>{['active','paused','retired'].map(s=><option key={s} value={s}>{statusLabel(s)}</option>)}</select></label></div>
   <label>Service / cargo notes<textarea rows={3} maxLength={1200} value={draft.cargo_notes||''} onChange={e=>setDraft(v=>({...v,cargo_notes:e.target.value}))} placeholder="Goods typically transported, service details or RP notes"/></label>
   <div className="ir-form-actions"><button type="button" onClick={()=>setDraft(null)}>Cancel</button><button className="ir-primary" type="submit" disabled={busy||!!routeError()}><i className="fa-solid fa-floppy-disk"/> Save service</button></div>
  </form></div>}
 </section>;
}
