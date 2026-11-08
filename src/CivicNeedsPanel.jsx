import React,{useEffect,useState} from 'react';
const today=()=>new Date().toISOString().slice(0,10);
const num=v=>Number(v||0);
const format=n=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});
const defaults={item_code:'',item_label:'',resource_kind:'food',food_group:'grain',quantity_delta:0,reason:''};
export default function CivicNeedsPanel({request,settlement,regionMode,canEdit,onChanged}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [transfer,setTransfer]=useState({material_id:'',resource_kind:'food',food_group:'grain',quantity:1}),[movement,setMovement]=useState(defaults),[cohort,setCohort]=useState({label:'',residents:0,employed:0,housing_quality:50,medical_access:50,water_access:50});
 const [event,setEvent]=useState({kind:'petition',title:'',detail:''}),[cycleDate,setCycleDate]=useState(today()),[proposed,setProposed]=useState(null);
 const [profile,setProfile]=useState(null);
 const [editingCohort,setEditingCohort]=useState(null);
 const [aid,setAid]=useState({name:'',material_id:'',resource_kind:'food',food_group:'grain',quantity:1,frequency:'weekly',active:true});
 const [aidEditing,setAidEditing]=useState(null);
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
  <div className="wa-civic-values">{[['Residents',format(settlement.population)],['Food reserves',format(p.food_days)+' days'],['Fuel reserves',p.heat_days===null?'No heating demand':format(p.heat_days)+' days'],['Water available',format(p.water_stock)+' units'],['Medical supplies',format(p.medicine_stock)+' units'],['Food groups / 30 days',p.food_groups_30d.length],['Civic pressure',p.pressure+'/100'],['Projected unrest risk',p.risk+'/100']].map(([k,v])=><div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>
  <p className="wa-hint">{p.warnings.length?'Alerts: '+p.warnings.map(x=>x.replaceAll('_',' ')).join(' · '):'No current civic alerts.'} Readings use recorded civilian stock only; member/front inventory is never touched.</p>
  <h3>Deliver from shared Order workshop stores</h3>
  <p className="wa-hint">This is an atomic, audited transfer from unreserved shared Order material stock only. Player-bound crafted goods and front-owned supplies are not available here.</p>
  {canEdit&&<form className="wa-fields" onSubmit={e=>{e.preventDefault();mutate('/transfer','POST',{...transfer,quantity:Number(transfer.quantity),food_group:transfer.resource_kind==='food'?transfer.food_group:null,request_key:crypto.randomUUID()},'Shared workshop supplies delivered to civilian stores.')}}>
   <label>Material<select required value={transfer.material_id} onChange={e=>setTransfer({...transfer,material_id:e.target.value})}><option value="">Choose shared material</option>{data.shared_materials?.filter(m=>Number(m.quantity)>0).map(m=><option key={m.id} value={m.id}>{m.name} ({format(m.quantity)} available)</option>)}</select></label>
   <label>Use as<select value={transfer.resource_kind} onChange={e=>setTransfer({...transfer,resource_kind:e.target.value})}>{['food','fuel','water','medicine'].map(k=><option key={k} value={k}>{k}</option>)}</select></label>
   {transfer.resource_kind==='food'&&<label>Food group<input required maxLength="75" value={transfer.food_group} onChange={e=>setTransfer({...transfer,food_group:e.target.value})}/></label>}
   <label>Quantity<input required type="number" min="1" max="1000000" step="1" value={transfer.quantity} onChange={e=>setTransfer({...transfer,quantity:e.target.value})}/></label>
   <button type="submit" disabled={busy||!transfer.material_id}>Transfer shared materials</button>
  </form>}
  <h3>Scheduled civilian relief</h3><p className="wa-hint">Aid contracts describe recurring delivery obligations. Deliveries are dispatched explicitly by staff, only from available unreserved Order workshop stock. No automatic offline transfers occur.</p>
  {(data.aid_contracts||[]).map(c=><div className="wa-civil-card" key={c.id}><strong>{c.name}</strong><p>{c.quantity} × {c.material_id} · {c.frequency} · {c.active?'Active':'Paused'}</p>{canEdit&&<div className="wa-controls"><button type="button" disabled={busy} onClick={()=>{setAid({...c,quantity:Number(c.quantity),active:!!c.active});setAidEditing(c.id)}}>Edit contract</button><button type="button" disabled={busy} onClick={()=>mutate('/aid/'+c.id,'PUT',{...c,quantity:Number(c.quantity),active:!c.active},c.active?'Aid contract paused.':'Aid contract enabled.')}>{c.active?'Pause':'Resume'}</button><button type="button" disabled={busy||!c.active} onClick={()=>{const due_date=window.prompt('Delivery date (YYYY-MM-DD)',today());if(due_date&&window.confirm('Dispatch '+c.quantity+' '+c.material_id+' from shared Order stores?'))mutate('/aid/'+c.id+'/dispatch','POST',{due_date},'Relief shipment dispatched.')}}>Dispatch supplies</button></div>}</div>)}
  {canEdit&&<form className="wa-fields" onSubmit={e=>{e.preventDefault();mutate(aidEditing?'/aid/'+aidEditing:'/aid',aidEditing?'PUT':'POST',{...aid,quantity:Number(aid.quantity),active:!!aid.active,food_group:aid.resource_kind==='food'?aid.food_group:null},aidEditing?'Aid contract updated.':'Aid contract created.');setAidEditing(null);}}>
   <label>Relief service name<input required maxLength="120" value={aid.name} onChange={e=>setAid({...aid,name:e.target.value})}/></label>
   <label>Shared Order material<select required value={aid.material_id} onChange={e=>setAid({...aid,material_id:e.target.value})}><option value="">Choose material</option>{data.shared_materials?.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
   <label>Essential category<select value={aid.resource_kind} onChange={e=>setAid({...aid,resource_kind:e.target.value})}>{['food','fuel','water','medicine'].map(k=><option key={k} value={k}>{k}</option>)}</select></label>
   {aid.resource_kind==='food'&&<label>Food group<input required maxLength="75" value={aid.food_group||''} onChange={e=>setAid({...aid,food_group:e.target.value})}/></label>}
   <label>Quantity per delivery<input type="number" required min="1" max="1000000" step="1" value={aid.quantity} onChange={e=>setAid({...aid,quantity:e.target.value})}/></label>
   <label>Frequency<select value={aid.frequency} onChange={e=>setAid({...aid,frequency:e.target.value})}>{['daily','weekly','monthly'].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
   <button type="submit" disabled={busy}>{aidEditing?'Save aid contract':'Create aid contract'}</button>{aidEditing&&<button type="button" onClick={()=>setAidEditing(null)}>Cancel edit</button>}
  </form>}
  {data.aid_dispatches?.length>0&&<details><summary>Recent relief deliveries ({data.aid_dispatches.length})</summary>{data.aid_dispatches.map(d=><p key={d.id}>{d.due_date} · Contract #{d.contract_id}</p>)}</details>}
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
  <div className="wa-civic-values">{data.cohorts.map(c=><div key={c.id}><span>{c.label} · {format(c.employed)} employed</span><strong>{format(c.residents)} residents</strong>{canEdit&&<span><button type="button" disabled={busy} onClick={()=>{setEditingCohort(c.id);setCohort({...c})}}>Edit</button> <button type="button" disabled={busy} onClick={()=>{if(window.confirm('Remove this cohort? Civilian population totals will not be changed.'))mutate('/cohorts/'+c.id,'DELETE',null,'Cohort removed.')}}>Remove</button></span>}</div>)}</div>
  {canEdit&&<form className="wa-fields" onSubmit={e=>{e.preventDefault();mutate(editingCohort?'/cohorts/'+editingCohort:'/cohorts',editingCohort?'PUT':'POST',{...cohort,residents:num(cohort.residents),employed:num(cohort.employed),housing_quality:num(cohort.housing_quality),medical_access:num(cohort.medical_access),water_access:num(cohort.water_access)},editingCohort?'Population cohort updated.':'Population cohort added.').then(()=>setEditingCohort(null))}}>
   <label>Population group<input required maxLength="120" value={cohort.label} onChange={e=>setCohort({...cohort,label:e.target.value})}/></label>
   {['residents','employed','housing_quality','medical_access','water_access'].map(k=><label key={k}>{k.replaceAll('_',' ')}<input required type="number" min="0" max={['residents','employed'].includes(k)?10000000:100} value={cohort[k]} onChange={e=>setCohort({...cohort,[k]:e.target.value})}/></label>)}
   <button type="submit" disabled={busy}>{editingCohort?'Save population group':'Add population group'}</button>{editingCohort&&<button type="button" onClick={()=>setEditingCohort(null)}>Cancel edit</button>}
  </form>}
  <h3>Simulation policy and thresholds</h3>
  <p className="wa-hint">Off is the default. Narrative generates warnings only. Managed/detailed require an explicit dated run. Pause immediately prevents new cycles. Unrest events remain proposals until approved.</p>
  {canEdit&&profile&&<form className="wa-fields" onSubmit={e=>{e.preventDefault();mutate('/profile','PUT',{...profile,food_daily_per_resident:num(profile.food_daily_per_resident),heat_daily_per_resident:num(profile.heat_daily_per_resident),water_daily_per_resident:num(profile.water_daily_per_resident),medicine_daily_per_resident:num(profile.medicine_daily_per_resident),food_min_days:num(profile.food_min_days),minimum_variety:num(profile.minimum_variety),grace_cycles:num(profile.grace_cycles),paused:!!profile.paused},'Civic policy saved.')}}>
   <label>Mode<select value={profile.enabled_mode} onChange={e=>setProfile({...profile,enabled_mode:e.target.value})}>{['off','narrative','managed','detailed'].map(k=><option key={k} value={k}>{k}</option>)}</select></label>
   <label>Pause cycles<select value={profile.paused?'yes':'no'} onChange={e=>setProfile({...profile,paused:e.target.value==='yes'})}><option value="no">No</option><option value="yes">Yes</option></select></label>
   {[['food_daily_per_resident','Food units / resident / cycle'],['heat_daily_per_resident','Heating units / resident / cycle'],['water_daily_per_resident','Water units / resident / cycle'],['medicine_daily_per_resident','Medicine units / resident / cycle'],['food_min_days','Food reserve alert (days)'],['minimum_variety','Minimum food groups / 30 days'],['grace_cycles','Grace cycles']].map(([k,label])=><label key={k}>{label}<input required type="number" min={k==='medicine_daily_per_resident'?'0':k.includes('daily')?'.001':k==='grace_cycles'?'0':'1'} max={k.includes('daily')?'100':k==='food_min_days'?'365':k==='grace_cycles'?'30':'12'} step={k.includes('daily')?'.001':'1'} value={profile[k]} onChange={e=>setProfile({...profile,[k]:e.target.value})}/></label>)}
   <button type="submit" disabled={busy}>Save civic policy</button>
  </form>}
  {canEdit&&<div><h3>Controlled cycle</h3><div className="wa-controls"><label>Cycle date <input type="date" value={cycleDate} onChange={e=>{setCycleDate(e.target.value);setProposed(null)}}/></label><button disabled={busy} onClick={async()=>{const r=await mutate('/preview','POST',{cycle_date:cycleDate},'Preview calculated without changing stock.');if(r)setProposed(r.preview)}}>Preview effects</button><button className="wa-accent" disabled={busy||!proposed||profile.paused||!settlement.simulation_enabled||regionMode!=='managed'||!['managed','detailed'].includes(profile.enabled_mode)} onClick={()=>{if(window.confirm('Commit the previewed '+cycleDate+' civic cycle? Civilian stock and civic scores will change once.'))mutate('/run','POST',{cycle_date:cycleDate},'Cycle committed.');setProposed(null)}}>Commit cycle</button></div>
    {proposed&&<p className="wa-hint">Preview: food {format(proposed.food_used)} units, heating {format(proposed.fuel_used)} units, water {format(proposed.water_used)} units, medicine {format(proposed.medicine_used)} units. Stability {proposed.before_stability} → {proposed.after_stability}; unrest {proposed.before_unrest} → {proposed.after_unrest}. {proposed.grace_active?'Grace period active.':''}</p>}
    {(!settlement.simulation_enabled||regionMode!=='managed')&&<p className="wa-hint">To commit cycles, set the region to Managed simulation and enable simulation in the settlement record. Both settings are required.</p>}
    <h4>Cycle history</h4>{data.cycles.map(c=><p key={c.id}>{String(c.cycle_date).slice(0,10)} · Food {format(c.food_used)} · Heating {format(c.fuel_used)} · Stability {c.before_stability} → {c.after_stability}</p>)}
   </div>}
  <h3>Civic incidents and relief requests</h3>
  {data.incidents.map(e=><div key={e.id} className="wa-civil-card"><strong>{e.title}</strong> · {e.kind} · {e.status}<p>{e.detail}</p>{canEdit&&['proposed','approved'].includes(e.status)&&<div className="wa-controls">{(e.status==='proposed'?['approved','declined']:['resolved']).map(status=><button key={status} disabled={busy} onClick={()=>mutate('/incidents/'+e.id+'/review','PUT',{status},'Incident '+status+'.')}>{status}</button>)}</div>}</div>)}
  {canEdit&&<form className="wa-fields" onSubmit={e=>{e.preventDefault();mutate('/incidents','POST',event,'Civic event proposed for approval.')}}><label>Event type<select value={event.kind} onChange={e=>setEvent({...event,kind:e.target.value})}>{['petition','strike','demonstration','relief_request','weather_emergency'].map(k=><option key={k} value={k}>{k.replaceAll('_',' ')}</option>)}</select></label><label>Title<input required maxLength="140" value={event.title} onChange={e=>setEvent({...event,title:e.target.value})}/></label><label className="wide">Description<textarea required maxLength="4000" value={event.detail} onChange={e=>setEvent({...event,detail:e.target.value})}/></label><button type="submit" disabled={busy}>Propose incident / relief</button></form>}
 </section>;
}
