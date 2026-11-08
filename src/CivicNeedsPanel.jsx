import React,{useEffect,useState} from 'react';
const today=()=>new Date().toISOString().slice(0,10);
const num=v=>Number(v||0);
const format=n=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});
const defaults={item_code:'',item_label:'',resource_kind:'food',food_group:'grain',quantity_delta:0,reason:''};
export default function CivicNeedsPanel({request,settlement,canEdit,onChanged}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [movement,setMovement]=useState(defaults),[cohort,setCohort]=useState({label:'',residents:0,employed:0,housing_quality:50,medical_access:50,water_access:50});
 const [event,setEvent]=useState({kind:'petition',title:'',detail:''}),[cycleDate,setCycleDate]=useState(today()),[proposed,setProposed]=useState(null);
 const [profile,setProfile]=useState(null);
 async function load(){const d=await request('/world-admin/civic/'+settlement.id);setData(d);setProfile({...d.profile,paused:!!d.profile.paused})}
 useEffect(()=>{setData(null);setError('');setNotice('');setProposed(null);load().catch(e=>setError(e.message))},[settlement.id]);
 async function mutate(path,method,body,success){
  setBusy(true);setError('');setNotice('');
  try{const r=await request('/world-admin/civic/'+settlement.id+path,{method,body});await load();if(onChanged)await onChanged();setNotice(success);return r}
  catch(e){setError(e.message||'Action failed.');return null}finally{setBusy(false)}
 }
 if(!data)return <section className="wa-panel"><h3>{settlement.name} · Civilian needs</h3>{error?<p role="alert" className="wa-error">{error}</p>:<p>Loading civic records…</p>}</section>;
 const p=data.preview;
 return <section className="wa-panel wa-civic-detail" aria-label={'Civic administration for '+settlement.name}>
  <div className="wa-panel-title"><strong>{settlement.name} · Civilian administration</strong><span>{profile.enabled_mode==='off'?'Simulation off':profile.paused?'Paused':profile.enabled_mode}</span></div>
  {error&&<p role="alert" className="wa-error">{error}</p>}{notice&&<p role="status" className="wa-notice">{notice}</p>}
  <div className="wa-civic-values">{[['Residents',format(settlement.population)],['Food reserves',format(p.food_days)+' days'],['Fuel reserves',p.heat_days===null?'No heating demand':format(p.heat_days)+' days'],['Food groups / 30 days',p.food_groups_30d.length],['Civic pressure',p.pressure+'/100'],['Projected unrest risk',p.risk+'/100']].map(([k,v])=><div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>
  <p className="wa-hint">{p.warnings.length?'Alerts: '+p.warnings.map(x=>x.replaceAll('_',' ')).join(' · '):'No current civic alerts.'} Readings use recorded civilian stock only; member/front inventory is never touched.</p>
  <h3>Food, heating and essentials</h3>
  <div className="wa-civic-values">{data.stock.map(s=><div key={s.item_code}><span>{s.item_label} · {s.resource_kind}{s.food_group?' / '+s.food_group:''}</span><strong>{format(s.quantity)}</strong></div>)}</div>
  {canEdit&&<form className="wa-fields" onSubmit={e=>{e.preventDefault();mutate('/stock','POST',{...movement,quantity_delta:num(movement.quantity_delta),food_group:movement.resource_kind==='food'?movement.food_group:null},'Civilian stock movement recorded.')}}>
   <label>Item code<input required maxLength="75" pattern="[a-z0-9][a-z0-9_-]*" value={movement.item_code} onChange={e=>setMovement({...movement,item_code:e.target.value})}/></label>
   <label>Item name<input required maxLength="120" value={movement.item_label} onChange={e=>setMovement({...movement,item_label:e.target.value})}/></label>
   <label>Essential type<select value={movement.resource_kind} onChange={e=>setMovement({...movement,resource_kind:e.target.value})}>{['food','fuel','water','medicine'].map(k=><option key={k} value={k}>{k}</option>)}</select></label>
   {movement.resource_kind==='food'&&<label>Food group<input required maxLength="75" value={movement.food_group} onChange={e=>setMovement({...movement,food_group:e.target.value})}/></label>}
   <label>Quantity change (+ delivery / − distribution)<input required type="number" step=".001" min="-1000000000" max="1000000000" value={movement.quantity_delta} onChange={e=>setMovement({...movement,quantity_delta:e.target.value})}/></label>
   <label>Reason / source<input required maxLength="180" value={movement.reason} onChange={e=>setMovement({...movement,reason:e.target.value})}/></label>
   <button type="submit" disabled={busy}>Record civic stock movement</button>
  </form>}
  <h3>Population groups and services</h3>
  <div className="wa-civic-values">{data.cohorts.map(c=><div key={c.id}><span>{c.label} · {format(c.employed)} employed</span><strong>{format(c.residents)} residents</strong></div>)}</div>
  {canEdit&&<form className="wa-fields" onSubmit={e=>{e.preventDefault();mutate('/cohorts','POST',{...cohort,residents:num(cohort.residents),employed:num(cohort.employed),housing_quality:num(cohort.housing_quality),medical_access:num(cohort.medical_access),water_access:num(cohort.water_access)},'Population cohort added.')}}>
   <label>Population group<input required maxLength="120" value={cohort.label} onChange={e=>setCohort({...cohort,label:e.target.value})}/></label>
   {['residents','employed','housing_quality','medical_access','water_access'].map(k=><label key={k}>{k.replaceAll('_',' ')}<input required type="number" min="0" max={['residents','employed'].includes(k)?10000000:100} value={cohort[k]} onChange={e=>setCohort({...cohort,[k]:e.target.value})}/></label>)}
   <button type="submit" disabled={busy}>Add population cohort</button>
  </form>}
  <h3>Simulation policy and thresholds</h3>
  <p className="wa-hint">Off is the default. Narrative generates warnings only. Managed/detailed require an explicit dated run. Pause immediately prevents new cycles. Unrest events remain proposals until approved.</p>
  {canEdit&&profile&&<form className="wa-fields" onSubmit={e=>{e.preventDefault();mutate('/profile','PUT',{...profile,food_daily_per_resident:num(profile.food_daily_per_resident),heat_daily_per_resident:num(profile.heat_daily_per_resident),food_min_days:num(profile.food_min_days),minimum_variety:num(profile.minimum_variety),grace_cycles:num(profile.grace_cycles),paused:!!profile.paused},'Civic policy saved.')}}>
   <label>Mode<select value={profile.enabled_mode} onChange={e=>setProfile({...profile,enabled_mode:e.target.value})}>{['off','narrative','managed','detailed'].map(k=><option key={k} value={k}>{k}</option>)}</select></label>
   <label>Pause cycles<select value={profile.paused?'yes':'no'} onChange={e=>setProfile({...profile,paused:e.target.value==='yes'})}><option value="no">No</option><option value="yes">Yes</option></select></label>
   {[['food_daily_per_resident','Food units / resident / cycle'],['heat_daily_per_resident','Heating units / resident / cycle'],['food_min_days','Food reserve alert (days)'],['minimum_variety','Minimum food groups / 30 days'],['grace_cycles','Grace cycles']].map(([k,label])=><label key={k}>{label}<input required type="number" min={k.includes('daily')?'.001':k==='grace_cycles'?'0':'1'} max={k.includes('daily')?'100':k==='food_min_days'?'365':k==='grace_cycles'?'30':'12'} step={k.includes('daily')?'.001':'1'} value={profile[k]} onChange={e=>setProfile({...profile,[k]:e.target.value})}/></label>)}
   <button type="submit" disabled={busy}>Save civic policy</button>
  </form>}
  {canEdit&&<div><h3>Controlled cycle</h3><div className="wa-controls"><label>Cycle date <input type="date" value={cycleDate} onChange={e=>{setCycleDate(e.target.value);setProposed(null)}}/></label><button disabled={busy} onClick={async()=>{const r=await mutate('/preview','POST',{cycle_date:cycleDate},'Preview calculated without changing stock.');if(r)setProposed(r.preview)}}>Preview effects</button><button className="wa-accent" disabled={busy||!proposed||profile.paused||!settlement.simulation_enabled||!['managed','detailed'].includes(profile.enabled_mode)} onClick={()=>{if(window.confirm('Commit the previewed '+cycleDate+' civic cycle? Civilian stock and civic scores will change once.'))mutate('/run','POST',{cycle_date:cycleDate},'Cycle committed.');setProposed(null)}}>Commit cycle</button></div>
    {proposed&&<p className="wa-hint">Preview: food {format(proposed.food_used)} units, heating {format(proposed.fuel_used)} units. Stability {proposed.before_stability} → {proposed.after_stability}; unrest {proposed.before_unrest} → {proposed.after_unrest}. {proposed.grace_active?'Grace period active.':''}</p>}
    {!settlement.simulation_enabled&&<p className="wa-hint">Enable simulation on the settlement record before committing any cycle.</p>}
    <h4>Cycle history</h4>{data.cycles.map(c=><p key={c.id}>{String(c.cycle_date).slice(0,10)} · Food {format(c.food_used)} · Heating {format(c.fuel_used)} · Stability {c.before_stability} → {c.after_stability}</p>)}
   </div>}
  <h3>Civic incidents and relief requests</h3>
  {data.incidents.map(e=><div key={e.id} className="wa-civil-card"><strong>{e.title}</strong> · {e.kind} · {e.status}<p>{e.detail}</p>{canEdit&&['proposed','approved'].includes(e.status)&&<div className="wa-controls">{(e.status==='proposed'?['approved','declined']:['resolved']).map(status=><button key={status} disabled={busy} onClick={()=>mutate('/incidents/'+e.id+'/review','PUT',{status},'Incident '+status+'.')}>{status}</button>)}</div>}</div>)}
  {canEdit&&<form className="wa-fields" onSubmit={e=>{e.preventDefault();mutate('/incidents','POST',event,'Civic event proposed for approval.')}}><label>Event type<select value={event.kind} onChange={e=>setEvent({...event,kind:e.target.value})}>{['petition','strike','demonstration','relief_request','weather_emergency'].map(k=><option key={k} value={k}>{k.replaceAll('_',' ')}</option>)}</select></label><label>Title<input required maxLength="140" value={event.title} onChange={e=>setEvent({...event,title:e.target.value})}/></label><label className="wide">Description<textarea required maxLength="4000" value={event.detail} onChange={e=>setEvent({...event,detail:e.target.value})}/></label><button type="submit" disabled={busy}>Propose incident / relief</button></form>}
 </section>;
}
