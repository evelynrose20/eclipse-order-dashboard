import React,{useEffect,useMemo,useState} from 'react';
import './internal-rail.css';

const blank=()=>({name:'',from:'',to:'',duration_minutes:60,status:'active',cargo_notes:''});
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
 const [data,setData]=useState(null),[draft,setDraft]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[now,setNow]=useState(Date.now()),[scope,setScope]=useState('active');
 const refresh=async()=>setData(await request('/internal-rail'));
 useEffect(()=>{let active=true;request('/internal-rail').then(r=>{if(active)setData(r)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[request]);
 useEffect(()=>{const handle=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(handle)},[]);
 const stops=data?.stops||[],routes=data?.routes||[],journeys=data?.journeys||[];
 const names=new Map(stops.map(s=>[stopKey(s),s.name]));
 const labelStop=(type,id)=>names.get(type+':'+id)||('Former '+type+' #'+id);
 const routeJourneys=id=>journeys.filter(j=>Number(j.route_id)===Number(id));
 const activeJourney=id=>routeJourneys(id).find(j=>j.status==='running'&&calculateProgress(j,now)<100);
 const viewed=routes.filter(r=>scope==='all'||(scope==='active'?r.status!=='retired':r.status===scope));
 const routeLabel=r=>labelStop(r.from_type,r.from_id)+' → '+labelStop(r.to_type,r.to_id);
 const stats={routes:routes.filter(r=>r.status==='active').length,travelling:journeys.filter(j=>j.status==='running'&&calculateProgress(j,now)<100).length,arrivals:journeys.filter(j=>j.status==='arrived'||j.status==='running'&&calculateProgress(j,now)===100).length};
 function begin(r=null){
  setError('');setNotice('');
  setDraft(r?{...r,from:r.from_type+':'+r.from_id,to:r.to_type+':'+r.to_id}:blank());
 }
 const parseStop=value=>{const [type,n]=String(value).split(':');return {type,id:Number(n)}};
 const routeError=()=>{
  if(!draft)return '';
  if(!draft.name.trim())return 'Give this internal railway service a name.';
  if(!draft.from||!draft.to)return 'Choose both the origin and destination.';
  if(draft.from===draft.to)return 'Origin and destination must be different locations.';
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
  const from=parseStop(draft.from),to=parseStop(draft.to);
  const payload={name:draft.name.trim(),from_type:from.type,from_id:from.id,to_type:to.type,to_id:to.id,duration_minutes:Number(draft.duration_minutes),status:draft.status,cargo_notes:draft.cargo_notes||''};
  if(await perform('/internal-rail/routes'+(draft.id?'/'+draft.id:''),{method:draft.id?'PUT':'POST',body:payload},'Internal railway service saved.'))setDraft(null);
 }
 async function retire(r){
  if(!window.confirm('Retire '+r.name+'? Existing journey records will remain.'))return;
  await perform('/internal-rail/routes/'+r.id,{method:'DELETE'},'Service retired; journey history preserved.');
 }
 const destinations=stops.filter(s=>stopKey(s)!==draft?.from);
 return <section className="internal-rail">
  <header className="ir-header"><div><span>ORDER OPERATIONS · INTERNAL TRANSPORT</span><h2><i className="fa-solid fa-train"/> Internal Rail Logistics</h2><p>Scheduled train services between Order-controlled settlements and Order-owned fronts. No map tracks or railway junction management required.</p></div><button type="button" onClick={()=>begin()} disabled={busy||stops.length<2}><i className="fa-solid fa-plus"/> New rail service</button></header>
  {error&&<p className="ir-error" role="alert">{error}</p>}{notice&&<p className="ir-notice" role="status">{notice}</p>}
  <div className="ir-stats"><div><small>Active services</small><strong>{stats.routes}</strong></div><div><small>Trains en route</small><strong>{stats.travelling}</strong></div><div><small>Arrived runs</small><strong>{stats.arrivals}</strong></div></div>
  <div className="ir-toolbar"><strong>Internal railway services</strong><label>Show <select value={scope} onChange={e=>setScope(e.target.value)}><option value="active">Current routes</option><option value="all">All routes</option><option value="paused">Paused</option><option value="retired">Retired</option></select></label></div>
  {!data&&<p className="ir-empty">Loading the internal rail ledger…</p>}
  {data&&stops.length<2&&<p className="ir-empty">Add at least two Order-controlled settlements or active Order-owned fronts before creating a railway service. These are managed in World Administration and Order Fronts.</p>}
  <div className="ir-route-grid">{viewed.map(r=>{
   const travelling=activeJourney(r.id),history=routeJourneys(r.id),latest=history[0],p=travelling?calculateProgress(travelling,now):latest?.status==='arrived'?100:0;
   const remaining=travelling?Math.max(0,Math.ceil((instant(travelling.expected_arrival_at)-now)/60000)):0;
   return <article className="ir-route-card" key={r.id}>
    <div className="ir-route-head"><div><small>RAIL SERVICE · #{r.id}</small><h3>{r.name}</h3></div><span className={'ir-state '+r.status}>{statusLabel(r.status)}</span></div>
    <div className="ir-stops"><span><i className="fa-solid fa-location-dot"/> {labelStop(r.from_type,r.from_id)}</span><i className="fa-solid fa-arrow-right-long" aria-hidden="true"/><span><i className="fa-solid fa-flag-checkered"/> {labelStop(r.to_type,r.to_id)}</span></div>
    <div className="ir-trip-info"><span><i className="fa-regular fa-clock"/> Planned journey: {durationLabel(r.duration_minutes)}</span><span>{travelling?'En route':latest?.status==='cancelled'?'Last run cancelled':latest?'Last run: '+statusLabel(latest.display_status||latest.status):'Not dispatched'}</span></div>
    <div className="ir-progress" aria-label={'Train journey '+Math.round(p)+' percent complete'}><div className="ir-track"><div className="ir-track-filled" style={{width:p+'%'}}/><span className="ir-train" style={{left:p+'%'}}><i className="fa-solid fa-train" aria-hidden="true"/></span></div><div className="ir-progress-label"><span>{travelling?'Departed '+formatTime(travelling.departed_at):'Origin'}</span><span>{travelling?remaining+'m remaining':latest?.status==='arrived'?'Arrived '+formatTime(latest.expected_arrival_at):'Destination'}</span></div></div>
    {r.cargo_notes&&<p className="ir-notes"><i className="fa-solid fa-boxes-stacked"/> {r.cargo_notes}</p>}
    <div className="ir-actions"><button type="button" disabled={busy} onClick={()=>begin(r)}><i className="fa-solid fa-pen"/> Edit</button><button type="button" className="ir-primary" disabled={busy||r.status!=='active'||!!travelling} onClick={()=>perform('/internal-rail/routes/'+r.id+'/dispatch',{method:'POST',body:{}},'Train dispatched.') }><i className="fa-solid fa-train"/> Dispatch</button>{travelling&&<button type="button" disabled={busy} onClick={()=>perform('/internal-rail/journeys/'+travelling.id+'/cancel',{method:'POST',body:{}},'Journey cancelled.')}>Cancel run</button>}{r.status!=='retired'&&<button type="button" disabled={busy} onClick={()=>retire(r)}>Retire</button>}</div>
    {history.length>0&&<details className="ir-history"><summary>Journey history ({history.length})</summary>{history.slice(0,8).map(j=><div key={j.id}><span>{statusLabel(j.status==='running'&&calculateProgress(j,now)===100?'arrived':j.status)}</span><span>{formatTime(j.departed_at)} → {formatTime(j.expected_arrival_at)}</span></div>)}</details>}
   </article>
  })}</div>
  {data&&!viewed.length&&<p className="ir-empty">No railway services in this view. Add a route to begin managing Order train movements.</p>}
  <p className="ir-footnote">Travel times are set by Order command. Arrivals are clock-based; this ledger does not automatically move or consume inventory, reserve player materials, or simulate actual rail tracks.</p>
  {draft&&<div className="ir-modal-backdrop"><form className="ir-modal" onSubmit={e=>{e.preventDefault();save()}} aria-label="Edit internal railway route"><header><h3>{draft.id?'Edit rail service':'New internal railway service'}</h3><button type="button" onClick={()=>setDraft(null)} aria-label="Close editor"><i className="fa-solid fa-xmark"/></button></header>
   <label>Service name<input maxLength={140} required value={draft.name} onChange={e=>setDraft(v=>({...v,name:e.target.value}))} placeholder="e.g. Moonlight Supply Express"/></label>
   <div className="ir-form-grid"><label>Origin<select value={draft.from} required onChange={e=>setDraft(v=>({...v,from:e.target.value,to:e.target.value===v.to?'':v.to}))}><option value="">Choose origin</option>{stops.map(s=><option value={stopKey(s)} key={stopKey(s)}>{s.name} · {s.description}</option>)}</select></label><label>Destination<select value={draft.to} required onChange={e=>setDraft(v=>({...v,to:e.target.value}))}><option value="">Choose destination</option>{destinations.map(s=><option value={stopKey(s)} key={stopKey(s)}>{s.name} · {s.description}</option>)}</select></label></div>
   <div className="ir-form-grid"><label>Journey duration (minutes)<input type="number" min={1} max={10080} required value={draft.duration_minutes} onChange={e=>setDraft(v=>({...v,duration_minutes:e.target.value}))}/></label><label>Route status<select value={draft.status} onChange={e=>setDraft(v=>({...v,status:e.target.value}))}>{['active','paused','retired'].map(s=><option key={s} value={s}>{statusLabel(s)}</option>)}</select></label></div>
   <label>Service / cargo notes<textarea rows={3} maxLength={1200} value={draft.cargo_notes||''} onChange={e=>setDraft(v=>({...v,cargo_notes:e.target.value}))} placeholder="Goods typically transported, service details or RP notes"/></label>
   <div className="ir-form-actions"><button type="button" onClick={()=>setDraft(null)}>Cancel</button><button className="ir-primary" type="submit" disabled={busy||!!routeError()}><i className="fa-solid fa-floppy-disk"/> Save service</button></div>
  </form></div>}
 </section>;
}
