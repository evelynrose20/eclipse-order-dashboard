import MaterialPicker from './MaterialPicker.jsx';
import React,{useEffect,useState} from 'react';
import SettlementUpgradesPanel from './SettlementUpgradesPanel.jsx';
import SettlementClockPanel from './SettlementClockPanel.jsx';
import OrderCityBuilder from './OrderCityBuilder.jsx';
const today=()=>new Date().toISOString().slice(0,10);
const num=v=>Number(v||0);
const format=n=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});
const defaults={item_code:'',item_label:'',resource_kind:'food',food_group:'grain',quantity_delta:0,reason:''};
export default function CivicNeedsPanel({request,settlement,regionMode,canEdit,onChanged}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [tab,setTab]=useState('city');
 const [addMenu,setAddMenu]=useState(false),[creationAction,setCreationAction]=useState('');
 const [transfer,setTransfer]=useState({material_id:'',resource_kind:'food',food_group:'grain',quantity:1}),[movement,setMovement]=useState(defaults);
 const [event,setEvent]=useState({kind:'petition',title:'',detail:''}),[cycleDate,setCycleDate]=useState(today()),[proposed,setProposed]=useState(null);
 const [profile,setProfile]=useState(null);
 const [aid,setAid]=useState({name:'',material_id:'',resource_kind:'food',food_group:'grain',quantity:1,frequency:'weekly',active:true});
 const [aidEditing,setAidEditing]=useState(null);
 const [heater,setHeater]=useState({name:'',coverage_pct:25,condition_pct:100,status:'operational',notes:''});
 const [heaterEditing,setHeaterEditing]=useState(null);
 async function load(){const d=await request('/world-admin/civic/'+settlement.id);setData(d);setProfile({...d.profile,paused:!!d.profile.paused})}
 useEffect(()=>{setData(null);setError('');setNotice('');setProposed(null);load().catch(e=>setError(e.message))},[settlement.id]);
 async function mutate(path,method,body,success){
  setBusy(true);setError('');setNotice('');
  try{const r=await request('/world-admin/civic/'+settlement.id+path,{method,body});await load();if(onChanged)await onChanged();setNotice(success);return r}
  catch(e){setError(e.message==='civilian_storage_capacity_exceeded'?'Not enough food or water storage. Build or upgrade a Granary or Waterworks first.':e.message||'Action failed.');return null}finally{setBusy(false)}
 }
 if(!data)return <section className="wa-panel"><h3>{settlement.name} · Civilian needs</h3>{error?<p role="alert" className="wa-error">{error}</p>:<p>Loading civic records…</p>}</section>;
 const p=data.preview;
 const empty=Number(settlement.population)===0;
 const groups=[['city','City builder','fa-city'],['overview','Overview','fa-gauge-high'],['upgrades','Buildings & defenses','fa-building'],['supplies','Provisions','fa-boxes-stacked'],['people','Residents','fa-people-group'],['aid','Relief routes','fa-truck-medical'],['events','Civic events','fa-scroll'],['policy','Simulation','fa-sliders']];
 return <section className="wa-panel wa-civic-detail" aria-label={'Civic administration for '+settlement.name}>
  <div className="wa-panel-title"><strong>{settlement.name} · City administration</strong><span>{empty?'Uninhabited':profile.paused?'Paused':profile.enabled_mode==='off'?'Simulation off':profile.enabled_mode}</span></div>
  {error&&<p role="alert" className="wa-error">{error}</p>}{notice&&<p role="status" className="wa-notice">{notice}</p>}
  <div className="wa-civic-tabs" role="tablist" aria-label="Civilian welfare sections">{groups.map(([key,label,icon])=><button role="tab" aria-selected={tab===key} key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}><i className={'fa-solid '+icon} aria-hidden="true"/> {label}</button>)}</div>
  {canEdit&&<div className="wa-civic-add-menu"><button type="button" className="wa-accent" aria-expanded={addMenu} onClick={()=>setAddMenu(true)}><i className="fa-solid fa-plus" aria-hidden="true"/> Add to settlement</button></div>}
  {addMenu&&<div className="wa-industry-overlay" role="presentation"><section className="wa-industry-attach wa-civic-attach" role="dialog" aria-modal="true" aria-label="Add to civilian welfare">
   <header className="wa-industry-attach-head"><div><span className="wa-kicker">CIVILIAN WELFARE</span><h3>Add to settlement</h3><p>{settlement.name} · Choose what you want to add.</p></div><button type="button" className="wa-industry-close" aria-label="Close welfare actions" onClick={()=>setAddMenu(false)}>×</button></header>
   <div className="wa-industry-steps"><button type="button" className="active"><span>01</span> Choose action</button><button type="button" disabled><span>02</span> Configure</button></div>
   <div className="wa-industry-choice-heading"><strong>What would you like to manage?</strong><span>Five civilian services</span></div>
   <div className="wa-industry-location-grid wa-civic-type-grid" role="group" aria-label="Civilian welfare actions">{[['upgrades','Construct buildings','Housing, schools, clinics and civic infrastructure','fa-building'],['upgrades','Add heating','Heating and cold-weather infrastructure','fa-fire-flame-simple'],['supplies','Deliver provisions','Transfer civilian food, fuel, water or medicine','fa-truck'],['aid','Plan relief','Set up a recurring delivery service','fa-truck-medical'],['events','Propose civic event','Petitions, relief requests and weather emergencies','fa-scroll']].map(([section,label,help,icon],i)=><button key={i} type="button" className="wa-industry-location-card" onClick={()=>{setTab(section);setCreationAction(['build','heating','transfer','aid','event'][i]);setAddMenu(false)}}><div className="wa-industry-location-top"><span className="wa-industry-location-symbol"><i className={'fa-solid '+icon} aria-hidden="true"/></span></div><strong>{label}</strong><span className="wa-industry-location-meta">{help}</span></button>)}</div>
   <footer className="wa-industry-attach-foot"><span>Select an action to continue to its setup.</span><button type="button" onClick={()=>setAddMenu(false)}>Cancel</button></footer>
  </section></div>}
  <div className="wa-civic-summary">
    <div><span>Residents</span><strong>{format(settlement.population)}</strong></div>
    <div><span>Housing</span><strong>{format(settlement.civic_summary?.housing_capacity??settlement.housing_capacity??0)}</strong></div>
    <div><span>Food reserves</span><strong>{empty?'Not required':p.food_days==null?'—':format(p.food_days)+' days'}</strong></div>
    <div><span>Unrest risk</span><strong>{empty?'Not applicable':p.risk+'/100'}</strong></div>
  </div>
  {empty&&<div className="wa-civic-empty"><i className="fa-solid fa-house-circle-xmark"/><div><strong>No residents — no provisions required</strong><p>This settlement has no civilian food, water, heating or medical consumption. Construct housing before residents can move in. Existing stock is preserved.</p></div><button type="button" onClick={()=>setTab('upgrades')}>Add housing</button></div>}
  {tab==='city'&&<OrderCityBuilder settlement={settlement} request={request} canEdit={canEdit} onChanged={onChanged} onBuild={()=>{setTab('upgrades');setCreationAction('build')}} onSupply={()=>setTab('supplies')}/>}
  {tab==='overview'&&<div className="wa-civic-dashboard">
   <div className="wa-civic-values">{[['Food stored / capacity',format(p.food_stock)+' / '+format(p.food_storage_capacity)],['Fuel stock',format(p.fuel_stock)],['Water stored / capacity',format(p.water_stock)+' / '+format(p.water_storage_capacity)],['Waterworks production',format(p.waterworks_generated)+' units/cycle'],['Medical stock',format(p.medicine_stock)],['Diet groups / 30 days',empty?'—':p.food_groups_30d.length],['Heating coverage',p.heating_coverage_effective+'%'],['Civic pressure',empty?'—':p.pressure+'/100']].map(([k,v])=><div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>
   <div className="wa-civic-overview-actions"><h3>Settlement administration</h3><p>{empty?'Develop the settlement with housing and essential infrastructure before accepting residents.':p.warnings.length?p.warnings.map(x=>x.replaceAll('_',' ')).join(' · '):'No immediate civilian warnings.'}</p><button type="button" onClick={()=>setTab('upgrades')}>Manage structures</button><button type="button" onClick={()=>setTab('people')}>View population</button>{!empty&&<button type="button" onClick={()=>setTab('supplies')}>Review provisions</button>}</div>
  </div>}
  {tab==='supplies'&&<div className="wa-civic-workspace"><div className="wa-workspace-heading"><h3>Settlement provisions</h3><p>{empty?'No residents are consuming goods. Supplies are optional until settlement is inhabited.':'Manage audited food, fuel, clean water and medicine stores.'}</p></div>
  <div className="wa-civic-values"><div><span>Food storage</span><strong>{format(p.food_stock)} / {format(p.food_storage_capacity)}</strong></div><div><span>Water storage</span><strong>{format(p.water_stock)} / {format(p.water_storage_capacity)}</strong></div><div><span>Waterworks output</span><strong>{format(p.waterworks_generated)} units / cycle</strong></div></div><p className="wa-hint">Granaries expand the food storage limit; Waterworks produce fresh water and increase water storage. Deliveries cannot exceed current capacity. Construct or upgrade infrastructure to expand it.</p>
  <h3>Deliver from shared Order workshop stores</h3>
  <p className="wa-hint">This is an atomic, audited transfer from unreserved shared Order material stock only. Player-bound crafted goods and front-owned supplies are not available here.</p>
  {canEdit&&<details className="wa-civic-form" open={creationAction==='transfer'?true:undefined}><summary><i className="fa-solid fa-plus" aria-hidden="true"/> Move shared Order goods</summary><form className="wa-fields" onSubmit={e=>{e.preventDefault();mutate('/transfer','POST',{...transfer,quantity:Number(transfer.quantity),food_group:transfer.resource_kind==='food'?transfer.food_group:null,request_key:crypto.randomUUID()},'Shared workshop supplies delivered to civilian stores.')}}>
   <label>Material<MaterialPicker catalog={data.shared_materials||[]} required value={transfer.material_id} onChange={e=>setTransfer({...transfer,material_id:e.target.value})}><option value="">Choose shared material</option>{data.shared_materials?.filter(m=>Number(m.quantity)>0).map(m=><option key={m.id} value={m.id}>{m.name} ({format(m.quantity)} available)</option>)}</MaterialPicker></label>
   <label>Use as<select value={transfer.resource_kind} onChange={e=>setTransfer({...transfer,resource_kind:e.target.value})}>{['food','fuel','water','medicine'].map(k=><option key={k} value={k}>{k}</option>)}</select></label>
   {transfer.resource_kind==='food'&&<label>Food group<input required maxLength="75" value={transfer.food_group} onChange={e=>setTransfer({...transfer,food_group:e.target.value})}/></label>}
   <label>Quantity<input required type="number" min="1" max="1000000" step="1" value={transfer.quantity} onChange={e=>setTransfer({...transfer,quantity:e.target.value})}/></label>
   <button type="submit" disabled={busy||!transfer.material_id}>Transfer shared materials</button>
  </form></details>}
  </div>}
  {tab==='upgrades'&&<div className="wa-civic-workspace"><SettlementUpgradesPanel openChooser={creationAction==='build'} settlement={settlement} request={request} onChanged={onChanged} materials={data.shared_materials||[]}/>
  <h3>Heating infrastructure</h3><p className="wa-hint">Operational facilities determine effective heating coverage; damaged and offline systems reduce the capacity of a settlement to keep homes warm. Fuel is only taken from civilian fuel stores during an authorized cycle.</p>
  <div className="wa-civic-values"><div><span>Effective heating coverage</span><strong>{p.heating_coverage_effective}%</strong></div>{(data.heating_assets||[]).map(h=><div key={h.id}><span>{h.name} · {h.status} · {h.condition_pct}% condition</span><strong>{h.coverage_pct}% capacity</strong>{canEdit&&<span><button type="button" disabled={busy} onClick={()=>{setHeater({...h});setHeaterEditing(h.id)}}>Edit</button> <button type="button" disabled={busy} onClick={()=>{if(window.confirm('Delete this heating facility?'))mutate('/heating/'+h.id,'DELETE',null,'Heating facility removed.')}}>Remove</button></span>}</div>)}</div>
  {canEdit&&<details className="wa-civic-form" open={creationAction==='heating'?true:undefined}><summary><i className="fa-solid fa-plus" aria-hidden="true"/> Add heating facility</summary><form className="wa-fields" onSubmit={e=>{e.preventDefault();const path=heaterEditing?'/heating/'+heaterEditing:'/heating';const method=heaterEditing?'PUT':'POST';mutate(path,method,{...heater,coverage_pct:Number(heater.coverage_pct),condition_pct:Number(heater.condition_pct)},heaterEditing?'Heating facility updated.':'Heating facility added.');setHeaterEditing(null);}}>
   <label>Facility name<input required maxLength="120" value={heater.name} onChange={e=>setHeater({...heater,name:e.target.value})}/></label>
   <label>Heating coverage %<input required type="number" min="0" max="100" step="1" value={heater.coverage_pct} onChange={e=>setHeater({...heater,coverage_pct:e.target.value})}/></label>
   <label>Condition %<input required type="number" min="0" max="100" step="1" value={heater.condition_pct} onChange={e=>setHeater({...heater,condition_pct:e.target.value})}/></label>
   <label>Status<select value={heater.status} onChange={e=>setHeater({...heater,status:e.target.value})}>{['operational','damaged','offline'].map(v=><option value={v} key={v}>{v}</option>)}</select></label>
   <label className="wide">Notes<input maxLength="450" value={heater.notes||''} onChange={e=>setHeater({...heater,notes:e.target.value})}/></label>
   <button type="submit" disabled={busy}>{heaterEditing?'Save heating facility':'Add heating facility'}</button>{heaterEditing&&<button type="button" onClick={()=>setHeaterEditing(null)}>Cancel edit</button>}
  </form></details>}
  </div>}
  {tab==='aid'&&<div className="wa-civic-workspace">
  <h3>Scheduled civilian relief</h3><p className="wa-hint">Aid contracts describe recurring delivery obligations. Deliveries are dispatched explicitly by staff, only from available unreserved Order workshop stock. No automatic offline transfers occur.</p>
  {(data.aid_contracts||[]).map(c=><div className="wa-civil-card" key={c.id}><strong>{c.name}</strong><p>{c.quantity} × {c.material_id} · {c.frequency} · {c.active?'Active':'Paused'}</p>{canEdit&&<div className="wa-controls"><button type="button" disabled={busy} onClick={()=>{setAid({...c,quantity:Number(c.quantity),active:!!c.active});setAidEditing(c.id)}}>Edit contract</button><button type="button" disabled={busy} onClick={()=>mutate('/aid/'+c.id,'PUT',{...c,quantity:Number(c.quantity),active:!c.active},c.active?'Aid contract paused.':'Aid contract enabled.')}>{c.active?'Pause':'Resume'}</button><button type="button" disabled={busy||!c.active} onClick={()=>{const due_date=window.prompt('Delivery date (YYYY-MM-DD)',today());if(due_date&&window.confirm('Dispatch '+c.quantity+' '+c.material_id+' from shared Order stores?'))mutate('/aid/'+c.id+'/dispatch','POST',{due_date},'Relief shipment dispatched.')}}>Dispatch supplies</button></div>}</div>)}
  {canEdit&&<details className="wa-civic-form" open={creationAction==='aid'?true:undefined}><summary><i className="fa-solid fa-plus" aria-hidden="true"/> Add relief contract</summary><form className="wa-fields" onSubmit={e=>{e.preventDefault();mutate(aidEditing?'/aid/'+aidEditing:'/aid',aidEditing?'PUT':'POST',{...aid,quantity:Number(aid.quantity),active:!!aid.active,food_group:aid.resource_kind==='food'?aid.food_group:null},aidEditing?'Aid contract updated.':'Aid contract created.');setAidEditing(null);}}>
   <label>Relief service name<input required maxLength="120" value={aid.name} onChange={e=>setAid({...aid,name:e.target.value})}/></label>
   <label>Shared Order material<MaterialPicker catalog={data.shared_materials||[]} required value={aid.material_id} onChange={e=>setAid({...aid,material_id:e.target.value})}><option value="">Choose material</option>{data.shared_materials?.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</MaterialPicker></label>
   <label>Essential category<select value={aid.resource_kind} onChange={e=>setAid({...aid,resource_kind:e.target.value})}>{['food','fuel','water','medicine'].map(k=><option key={k} value={k}>{k}</option>)}</select></label>
   {aid.resource_kind==='food'&&<label>Food group<input required maxLength="75" value={aid.food_group||''} onChange={e=>setAid({...aid,food_group:e.target.value})}/></label>}
   <label>Quantity per delivery<input type="number" required min="1" max="1000000" step="1" value={aid.quantity} onChange={e=>setAid({...aid,quantity:e.target.value})}/></label>
   <label>Frequency<select value={aid.frequency} onChange={e=>setAid({...aid,frequency:e.target.value})}>{['daily','weekly','monthly'].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
   <button type="submit" disabled={busy}>{aidEditing?'Save aid contract':'Create aid contract'}</button>{aidEditing&&<button type="button" onClick={()=>setAidEditing(null)}>Cancel edit</button>}
  </form></details>}
  {data.aid_dispatches?.length>0&&<details><summary>Recent relief deliveries ({data.aid_dispatches.length})</summary>{data.aid_dispatches.map(d=><p key={d.id}>{d.due_date} · Contract #{d.contract_id}</p>)}</details>}
  </div>}
  {tab==='supplies'&&<div className="wa-civic-workspace">
  <h3>Food, heating and essentials</h3>
  <div className="wa-civic-values">{data.stock.map(s=><div key={s.item_code}><span>{s.item_label} · {s.resource_kind}{s.food_group?' / '+s.food_group:''}</span><strong>{format(s.quantity)}</strong></div>)}</div>
  {canEdit&&<details className="wa-civic-form"><summary><i className="fa-solid fa-plus" aria-hidden="true"/> Adjust civilian stock</summary><form className="wa-fields" onSubmit={e=>{e.preventDefault();mutate('/stock','POST',{...movement,quantity_delta:num(movement.quantity_delta),food_group:movement.resource_kind==='food'?movement.food_group:null},'Civilian stock movement recorded.')}}>
   <label>Item code<input required maxLength="75" pattern="[a-z0-9][a-z0-9_-]*" value={movement.item_code} onChange={e=>setMovement({...movement,item_code:e.target.value})}/></label>
   <label>Item name<input required maxLength="120" value={movement.item_label} onChange={e=>setMovement({...movement,item_label:e.target.value})}/></label>
   <label>Essential type<select value={movement.resource_kind} onChange={e=>setMovement({...movement,resource_kind:e.target.value})}>{['food','fuel','water','medicine'].map(k=><option key={k} value={k}>{k}</option>)}</select></label>
   {movement.resource_kind==='food'&&<label>Food group<input required maxLength="75" value={movement.food_group} onChange={e=>setMovement({...movement,food_group:e.target.value})}/></label>}
   <label>Quantity change (+ delivery / − distribution)<input required type="number" step=".001" min="-1000000000" max="1000000000" value={movement.quantity_delta} onChange={e=>setMovement({...movement,quantity_delta:e.target.value})}/></label>
   <label>Reason / source<input required maxLength="180" value={movement.reason} onChange={e=>setMovement({...movement,reason:e.target.value})}/></label>
   <button type="submit" disabled={busy}>Record civic stock movement</button>
  </form></details>}
  </div>}
  {tab==='people'&&<div className="wa-civic-workspace">
   <div className="wa-workspace-heading"><h3>Population simulation</h3><p>Population groups are generated from the settlement's actual residents and workforce. There are no manually managed cohorts.</p></div>
   <div className="wa-civic-summary">
    <div><span>Current residents</span><strong>{format(settlement.population)}</strong></div>
    <div><span>Housing capacity</span><strong>{format(data.population_simulation?.housing_capacity??0)}</strong></div>
    <div><span>Vacant homes</span><strong>{format(data.population_simulation?.vacancies??0)}</strong></div>
    <div><span>Potential arrivals next cycle</span><strong>{format(data.population_simulation?.arrivals??0)}</strong></div>
   </div>
   <h3>Worker health & medical care</h3><div className="wa-civic-values"><div><span>Workers ill</span><strong>{format(data.worker_health?.sick_workers||0)}</strong></div><div><span>Workers injured</span><strong>{format(data.worker_health?.injured_workers||0)}</strong></div><div><span>Available workers</span><strong>{format(Math.max(0,Number(settlement.workforce)-Number(data.worker_health?.sick_workers||0)-Number(data.worker_health?.injured_workers||0)))}</strong></div><div><span>Medical staff</span><strong>{format(data.health_preview?.doctors||0)}</strong></div><div><span>Treatment capacity / cycle</span><strong>{format(data.health_preview?.care_slots||0)}</strong></div></div><p className="wa-hint">Illness and workplace injuries are calculated by the simulation. Clinics, qualified medical staff and civilian medicine supplies help workers recover during settlement cycles. Injured and sick workers cannot work in industry while recovering.</p>
   <h3>Simulated population groups</h3>
   <div className="wa-civic-values">{data.cohorts.map(c=><div key={c.key}><span>{c.label}</span><strong>{format(c.residents)} residents</strong></div>)}</div>
   <p className="wa-hint">{Number(data.population_simulation?.housing_capacity||0)<=Number(settlement.population)?'Population cannot grow until more housing is operational.':'Arrivals are projected from available housing and civic conditions and only apply when a managed civilian cycle is committed.'} No background population changes run automatically.</p>
   <button type="button" onClick={()=>setTab('upgrades')}>View housing & structures</button>
  </div>}
  {tab==='policy'&&<div className="wa-civic-workspace">
  <SettlementClockPanel request={request} settlement={settlement} regionMode={regionMode} profile={profile}/>
  <h3>Simulation policy and thresholds</h3>
  <p className="wa-hint">Off is the default for Order settlements. Narrative generates warnings only. Managed/Detailed may run manually or via the separately enabled Windows simulation clock. Pause prevents new cycles, and major RP events remain proposals until approved.</p>
  {canEdit&&profile&&<form className="wa-fields" onSubmit={e=>{e.preventDefault();mutate('/profile','PUT',{...profile,food_daily_per_resident:num(profile.food_daily_per_resident),heat_daily_per_resident:num(profile.heat_daily_per_resident),water_daily_per_resident:num(profile.water_daily_per_resident),medicine_daily_per_resident:num(profile.medicine_daily_per_resident),food_min_days:num(profile.food_min_days),minimum_variety:num(profile.minimum_variety),grace_cycles:num(profile.grace_cycles),paused:!!profile.paused},'Civic policy saved.')}}>
   <label>Mode<select value={profile.enabled_mode} onChange={e=>setProfile({...profile,enabled_mode:e.target.value})}>{['off','narrative','managed','detailed'].map(k=><option key={k} value={k}>{k}</option>)}</select></label>
   <label>Pause cycles<select value={profile.paused?'yes':'no'} onChange={e=>setProfile({...profile,paused:e.target.value==='yes'})}><option value="no">No</option><option value="yes">Yes</option></select></label>
   {[['food_daily_per_resident','Food units / resident / cycle'],['heat_daily_per_resident','Heating units / resident / cycle'],['water_daily_per_resident','Water units / resident / cycle'],['medicine_daily_per_resident','Medicine units / resident / cycle'],['food_min_days','Food reserve alert (days)'],['minimum_variety','Minimum food groups / 30 days'],['grace_cycles','Grace cycles']].map(([k,label])=><label key={k}>{label}<input required type="number" min={k==='medicine_daily_per_resident'?'0':k.includes('daily')?'.001':k==='grace_cycles'?'0':'1'} max={k.includes('daily')?'100':k==='food_min_days'?'365':k==='grace_cycles'?'30':'12'} step={k.includes('daily')?'.001':'1'} value={profile[k]} onChange={e=>setProfile({...profile,[k]:e.target.value})}/></label>)}
   <button type="submit" disabled={busy}>Save civic policy</button>
  </form>}
  {canEdit&&<div><h3>Controlled cycle</h3><div className="wa-controls"><label>Cycle date <input type="date" value={cycleDate} onChange={e=>{setCycleDate(e.target.value);setProposed(null)}}/></label><button disabled={busy} onClick={async()=>{const r=await mutate('/preview','POST',{cycle_date:cycleDate},'Preview calculated without changing stock.');if(r)setProposed(r.preview)}}>Preview effects</button><button className="wa-accent" disabled={busy||!proposed||profile.paused||!settlement.simulation_enabled||regionMode!=='managed'||!['managed','detailed'].includes(profile.enabled_mode)} onClick={()=>{if(window.confirm('Commit the previewed '+cycleDate+' civic cycle? Civilian stock and civic scores will change once.'))mutate('/run','POST',{cycle_date:cycleDate},'Cycle committed.');setProposed(null)}}>Commit cycle</button></div>
    {proposed&&<p className="wa-hint">Preview: arrivals {format(proposed.population?.arrivals||0)}, food {format(proposed.food_used)} units, heating {format(proposed.fuel_used)} units, water {format(proposed.water_used)} units, medicine {format(proposed.medicine_used)} units. Stability {proposed.before_stability} → {proposed.after_stability}; unrest {proposed.before_unrest} → {proposed.after_unrest}. {proposed.grace_active?'Grace period active.':''}</p>}
    {(!settlement.simulation_enabled||regionMode!=='managed')&&<p className="wa-hint">To commit cycles, set the region to Managed simulation and enable simulation in the settlement record. Both settings are required.</p>}
    <h4>Cycle history</h4>{data.cycles.map(c=><p key={c.id}>{String(c.cycle_date).slice(0,10)} · Food {format(c.food_used)} · Heating {format(c.fuel_used)} · Stability {c.before_stability} → {c.after_stability}</p>)}
   </div>}
  </div>}
  {tab==='events'&&<div className="wa-civic-workspace">
  <h3>Civic incidents and relief requests</h3>
  {data.incidents.map(e=><div key={e.id} className="wa-civil-card"><strong>{e.title}</strong> · {e.kind} · {e.status}<p>{e.detail}</p>{canEdit&&['proposed','approved'].includes(e.status)&&<div className="wa-controls">{(e.status==='proposed'?['approved','declined']:['resolved']).map(status=><button key={status} disabled={busy} onClick={()=>mutate('/incidents/'+e.id+'/review','PUT',{status},'Incident '+status+'.')}>{status}</button>)}</div>}</div>)}
  {canEdit&&<details className="wa-civic-form" open={creationAction==='event'?true:undefined}><summary><i className="fa-solid fa-plus" aria-hidden="true"/> Change simulation policy</summary><form className="wa-fields" onSubmit={e=>{e.preventDefault();mutate('/incidents','POST',event,'Civic event proposed for approval.')}}><label>Event type<select value={event.kind} onChange={e=>setEvent({...event,kind:e.target.value})}>{['petition','strike','demonstration','relief_request','weather_emergency'].map(k=><option key={k} value={k}>{k.replaceAll('_',' ')}</option>)}</select></label><label>Title<input required maxLength="140" value={event.title} onChange={e=>setEvent({...event,title:e.target.value})}/></label><label className="wide">Description<textarea required maxLength="4000" value={event.detail} onChange={e=>setEvent({...event,detail:e.target.value})}/></label><button type="submit" disabled={busy}>Propose incident / relief</button></form></details>}
  </div>}
 </section>;
}
