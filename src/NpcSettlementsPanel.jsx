import React,{useEffect,useMemo,useState} from 'react';
import './world-industry.css';

const fmt=v=>Number(v||0).toLocaleString(undefined,{maximumFractionDigits:1});
const nameCase=v=>String(v||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
export default function NpcSettlementsPanel({request,factions=[],onChanged}){
 const [data,setData]=useState(null),[selected,setSelected]=useState(''),[search,setSearch]=useState(''),[onlyActive,setOnlyActive]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [farmInfo,setFarmInfo]=useState(null),[farmModal,setFarmModal]=useState(false);
 const [farmDraft,setFarmDraft]=useState({source_type:'industry_site',source_id:0,travel_hours:24,cargo_capacity:30});
 async function load(){const response=await request('/world-admin/simulation');setData(response);setSelected(prev=>response.settlements.some(s=>String(s.id)===prev&&s.ownership==='npc')?prev:String(response.settlements.find(s=>s.ownership==='npc')?.id||''));}
 useEffect(()=>{load().catch(e=>setError(e.message||'Unable to load NPC settlements'))},[]);
 const npcs=(data?.settlements||[]).filter(s=>s.ownership==='npc');
 const filtered=npcs.filter(s=>(!onlyActive||s.mode==='automatic'&&!s.paused)&&[s.name,s.region_name,factions.find(f=>f.id===s.controlling_faction_id)?.name].join(' ').toLowerCase().includes(search.toLowerCase()));
 const current=npcs.find(s=>String(s.id)===selected)||filtered[0];
 async function update(settings){
  setBusy(true);setError('');setNotice('');
  try{await request('/world-admin/simulation/'+current.id+'/settings',{method:'PUT',body:settings});await load();await onChanged?.();setNotice('Simulation settings saved. Changes take effect at the next scheduled check.')}
  catch(e){setError(e.message||'Could not save simulation settings')}finally{setBusy(false)}
 }
 useEffect(()=>{
  if(!selected)return;
  let active=true;
  request('/world-admin/simulation/'+selected+'/farm/options').then(result=>{if(active)setFarmInfo(result)}).catch(e=>{if(active)setError(e.message||'Unable to load mapped farms')});
  return()=>{active=false};
 },[selected]);
 const openFarmSelector=()=>{
  const route=farmInfo?.route;
  setFarmDraft({source_type:route?.site_id?'industry_site':route?.map_settlement_id?'settlement_marker':'industry_site',source_id:Number(route?.site_id||route?.map_settlement_id||0),travel_hours:Number(route?.travel_hours||24),cargo_capacity:Number(route?.cargo_capacity||30)});
  setFarmModal(true);
 };
 const saveFarm=async()=>{
  if(!current||!farmDraft.source_id)return;
  setBusy(true);setError('');setNotice('');
  try{
   await request('/world-admin/simulation/'+current.id+'/farm',{method:'PUT',body:farmDraft});
   const response=await request('/world-admin/simulation/'+current.id+'/farm/options');
   setFarmInfo(response);setFarmModal(false);await load();await onChanged?.();
   setNotice('Mapped NPC farm assigned. Harvest stays at the farm until cargo travels to the settlement.');
  }catch(e){setError(e.message||'Unable to assign mapped farm')}finally{setBusy(false)}
 };
 const history=(current?.history||[]).slice().reverse();
 const bounds=history.reduce((m,h)=>Math.max(m,Number(h.population_after)),Math.max(1,Number(current?.population||0)));
 if(!data)return <section className="wa-panel"><h3>NPC settlements</h3><p>{error||'Loading NPC simulation records…'}</p></section>;
 return <div className="wa-npc-world">
  <div className="wa-npc-heading"><div><span className="wa-kicker">LIVING WORLD · AUTONOMOUS FACTIONS</span><h3>NPC Settlements</h3><p>Watch independent communities develop without mixing them into the Order's administrative workload.</p></div><button type="button" onClick={()=>load().catch(e=>setError(e.message))}><i className="fa-solid fa-rotate" aria-hidden="true"/> Refresh</button></div>
  {error&&<p className="wa-error" role="alert">{error}</p>}{notice&&<p role="status" className="wa-notice">{notice}</p>}
  <div className="wa-npc-summary">
   <div><small>NPC settlements</small><strong>{npcs.length}</strong></div><div><small>Autonomous</small><strong>{npcs.filter(s=>s.mode==='automatic'&&!s.paused).length}</strong></div>
   <div><small>Total residents</small><strong>{fmt(npcs.reduce((sum,s)=>sum+Number(s.population),0))}</strong></div>
   <div><small>Active projects</small><strong>{npcs.reduce((n,s)=>n+(s.infrastructure_projects||[]).filter(p=>p.status==='active').length+s.projects.filter(p=>p.status==='building').length,0)}</strong></div>
  </div>
  <div className="wa-npc-layout">
   <aside className="wa-npc-directory" aria-label="NPC settlement directory">
    <div className="wa-npc-filters"><input aria-label="Search NPC settlements" placeholder="Search settlements or factions…" value={search} onChange={e=>setSearch(e.target.value)}/><label><input type="checkbox" checked={onlyActive} onChange={e=>setOnlyActive(e.target.checked)}/> Simulating only</label></div>
    <div className="wa-npc-list">{filtered.map(s=><button type="button" key={s.id} className={current?.id===s.id?'selected':''} onClick={()=>setSelected(String(s.id))}><span><strong>{s.name}</strong><small>{factions.find(f=>f.id===s.controlling_faction_id)?.name||'NPC faction'} · {s.region_name}</small></span><span className="wa-npc-list-right"><strong>{fmt(s.population)}</strong><small>{s.paused?'Paused':s.mode==='automatic'?'Simulating':'Off'}</small></span></button>)}{!filtered.length&&<p className="wa-empty">No matching NPC-controlled settlements. Assign a controlling faction other than the Eclipse Order to classify a settlement as NPC-run.</p>}</div>
   </aside>
   <section className="wa-npc-details" aria-label="NPC settlement details">
    {!current?<div className="wa-empty">Select an NPC settlement to inspect its growth and construction history.</div>:<>
     <div className="wa-npc-details-head"><div><span className="wa-kicker">{current.region_name} · {factions.find(f=>f.id===current.controlling_faction_id)?.name||'NPC faction'}</span><h3>{current.name}</h3><p>{current.mode==='automatic'&&!current.paused?'Autonomous settlement simulation active':current.paused?'Simulation paused':'Simulation disabled'}</p></div><span className="wa-npc-pill">{current.cadence==='slow'?'Slow':current.cadence==='fast'?'Fast':'Daily'}</span></div>
     <div className="wa-npc-stats"><div><small>Residents</small><strong>{fmt(current.population)}</strong></div><div><small>Available housing</small><strong>{fmt(Math.max(0,Number(current.housing_capacity_total??current.housing_capacity)-Number(current.population)))}</strong></div><div><small>Employed</small><strong>{fmt(current.demographics?.employed??current.workforce)}</strong></div><div><small>Stability</small><strong>{fmt(current.civil_stability)}/100</strong></div></div>
     <div className="wa-npc-section"><div className="wa-npc-section-title"><h4>Population & workforce</h4><span>Estimated age distribution · not individually tracked</span></div><div className="wa-npc-stats"><div><small>Children (0–14)</small><strong>{fmt(current.demographics?.children||0)}</strong></div><div><small>Youth (15–17)</small><strong>{fmt(current.demographics?.youth||0)}</strong></div><div><small>Adults (18–64)</small><strong>{fmt(current.demographics?.adults||0)}</strong></div><div><small>Elderly (65+)</small><strong>{fmt(current.demographics?.elderly||0)}</strong></div><div><small>Unable to work</small><strong>{fmt(current.demographics?.unable_to_work||0)}</strong></div><div><small>Eligible workers</small><strong>{fmt(current.demographics?.eligible_workers||0)}</strong></div><div><small>Employed</small><strong>{fmt(current.demographics?.employed||0)}</strong></div><div><small>Available for work</small><strong>{fmt(current.demographics?.unemployed||0)}</strong></div><div><small>Sick workers</small><strong>{fmt(current.worker_health?.sick_workers||0)}</strong></div><div><small>Injured workers</small><strong>{fmt(current.worker_health?.injured_workers||0)}</strong></div></div><p className="wa-npc-subtle">Industry and construction share the employed labor pool in their zone. Children, apprentices and retirees do not automatically operate industrial facilities.</p></div><div className="wa-npc-section"><div className="wa-npc-section-title"><h4>Education</h4><span>School access and workforce training</span></div><div className="wa-npc-stats"><div><small>School places</small><strong>{fmt(current.education?.school_seats||0)}</strong></div><div><small>Enrolled residents</small><strong>{fmt(current.education?.enrolled||0)}</strong></div><div><small>Without school places</small><strong>{fmt(current.education?.unplaced||0)}</strong></div><div><small>Education attainment</small><strong>{current.education?.attainment??20}/100</strong></div><div><small>Trained employees</small><strong>{fmt(current.education?.trained_workers||0)}</strong></div></div><p className="wa-npc-subtle">Education grows through operational schools during committed simulation cycles. Training does not generate additional residents or workers.</p></div><div className="wa-npc-section"><div className="wa-npc-section-title"><h4>Population trend</h4><span>Recent simulation cycles</span></div>
      <div className="wa-npc-bars" role="img" aria-label={'Population history for '+current.name}>{history.length?history.map(h=><div title={h.cycle_date+': '+fmt(h.population_after)+' residents'} key={h.id} style={{height:Math.max(5,Number(h.population_after)/bounds*100)+'%'}}/>):<p>No simulation cycles recorded yet.</p>}</div>
      <p className="wa-npc-subtle">Last cycle: {current.last_cycle_key||'Not yet simulated'}. No catch-up bursts after downtime.</p>
     </div>
     <div className="wa-npc-section"><div className="wa-npc-section-title"><h4>Economy & services</h4><span>NPC-owned reserves and operational infrastructure</span></div><div className="wa-npc-supplies">{[['Food stored',current.food_units],['Food capacity',current.storage_capacity?.food],['Water stored',current.water_units],['Water capacity',current.storage_capacity?.water],['Waterworks output / cycle',current.infrastructure_effects?.water_daily],['Fuel',current.fuel_units],['Medicine',current.medicine_units]].map(([label,value])=><div key={label}><span>{label}</span><strong>{fmt(value)}</strong></div>)}</div><p className="wa-npc-subtle">NPC factions build and improve the same templated granaries, waterworks, clinics and other infrastructure as Order settlements. New development points come only from production completed by operational, NPC-owned industrial sites on the previous day. No productive industry means no new development points.</p></div>
     <div className="wa-npc-section"><div className="wa-npc-section-title"><h4>Founding & farm logistics</h4><span>{current.cargo_route?'NPC supply network active':current.founding?'NPC scouting for farms':'Awaiting founding'}</span></div>
      <p className="wa-npc-subtle">{current.founding?'Basic housing and residents were established once.':'Automatic simulation establishes starter housing and residents once.'} NPC factions automatically locate their own mapped farm locations, establish a supplier and organize transport. You only place territory on the map; you do not need to choose farms or create cargo routes. Farms produce into their own stock, and cargo must physically arrive before it becomes settlement provisions.</p>
      <p className="wa-npc-subtle">{current.cargo_route?'Supplier, cargo limits and shipment departures are now managed automatically by the NPC faction.':'The faction will search its owned mapped farm locations on the next simulation cycle. If none exists, no harvest is invented; you can add farms in the map editor and the NPC will discover them.'}</p>
      <details className="wa-civic-form"><summary><i className="fa-solid fa-sliders" aria-hidden="true"/> Advanced staff override</summary><p className="wa-npc-subtle">Optional intervention for story events or special supply routes. Normal NPC settlements do not need this.</p><button type="button" disabled={busy} onClick={openFarmSelector}>Override farm supplier and cargo</button></details>
      {current.cargo_route&&<div className="wa-npc-supplies"><div><small>Supplying farm</small><strong>{current.cargo_route.farm_name}</strong></div><div><small>Transport time</small><strong>{fmt(current.cargo_route.travel_hours)} hours</strong></div><div><small>Daily cargo capacity</small><strong>{fmt(current.cargo_route.cargo_capacity)} units</strong></div><div><small>Route</small><strong>{current.cargo_route.enabled?'Active':'Paused'}</strong></div></div>}
      {farmInfo?.shipments?.length>0&&<div className="wa-civic-project-supplies"><strong>Recent cargo shipments</strong>{farmInfo.shipments.slice(0,8).map(c=><div className="wa-upgrade-details" key={c.id}><span>{nameCase(c.item_id)}</span><span>{fmt(c.quantity)} units</span><span>{nameCase(c.status)}</span><span>Arrival: {String(c.arrival_at).slice(0,16)}</span></div>)}</div>}
      {!!farmInfo?.warehouse?.length&&<div className="wa-npc-supplies">{farmInfo.warehouse.map(c=><div key={c.item_id}><small>Stored {nameCase(c.item_id)}</small><strong>{fmt(c.quantity)}</strong></div>)}</div>}
      </div>
      <div className="wa-npc-section"><div className="wa-npc-section-title"><h4>Construction & development</h4><span>{fmt(current.development_points)} development points · +{fmt(current.last_industry_development_points||0)} earned from industry last cycle</span></div>{(current.infrastructure_projects||[]).map(p=><div className="wa-npc-project" key={'template-'+p.id}><div><strong>{p.name}</strong><small>Template {p.template_id} · level {p.target_level} · {nameCase(p.status)}</small></div><div className="wa-npc-project-progress"><div style={{width:Math.min(100,Math.round(Number(p.progress)/Math.max(1,Number(p.labor_required))*100))+'%'}}/></div><strong>{Math.round(Number(p.progress)/Math.max(1,Number(p.labor_required))*100)}%</strong></div>)}{current.projects.length?current.projects.slice(0,8).map(p=><div className="wa-npc-project" key={p.id}><div><strong>{p.name}</strong><small>{nameCase(p.kind)} · {nameCase(p.status)}</small></div><div className="wa-npc-project-progress"><div style={{width:p.progress+'%'}}/></div><strong>{p.progress}%</strong></div> ):!(current.infrastructure_projects||[]).length&&<p className="wa-npc-subtle">No construction activity recorded yet.</p>}</div>
     <div className="wa-npc-section"><div className="wa-npc-section-title"><h4>Settlement journal</h4><span>{current.history.length} recent entries</span></div>{current.history.length?current.history.slice(0,12).map(h=><div className="wa-npc-journal" key={h.id}><small>{h.cycle_date} · {nameCase(h.event_type)}</small><strong>{h.headline}</strong><span>Population {fmt(h.population_before)} → {fmt(h.population_after)} · Stability {h.condition_before} → {h.condition_after}</span></div>):<p className="wa-npc-subtle">The first autonomous tick will create the first journal entry.</p>}</div>
     <div className="wa-npc-section wa-npc-settings"><div className="wa-npc-section-title"><h4>Simulation settings</h4><span>Staff only</span></div><p className="wa-npc-subtle">NPC-controlled settlements simulate automatically by default. No riots, deaths, territory transfers or Order supply withdrawals are triggered.</p>
      <div className="wa-npc-settings-row"><label>Simulation<select value={current.mode} disabled={busy} onChange={e=>update({mode:e.target.value,cadence:current.cadence,paused:current.paused})}><option value="automatic">Automatic</option><option value="off">Off</option></select></label><label>Cadence<select value={current.cadence} disabled={busy} onChange={e=>update({mode:current.mode,cadence:e.target.value,paused:current.paused})}><option value="slow">Slow · every 3 days</option><option value="normal">Normal · daily</option><option value="fast">Fast · every 6 hours</option></select></label><label>Pause<select value={current.paused?'yes':'no'} disabled={busy} onChange={e=>update({mode:current.mode,cadence:current.cadence,paused:e.target.value==='yes'})}><option value="no">Running</option><option value="yes">Paused</option></select></label></div>
     </div>
    </>}
   </section>
  {farmModal&&<div className="wa-industry-overlay" role="presentation"><section className="wa-industry-attach wa-civic-attach" role="dialog" aria-modal="true" aria-label="Select mapped NPC farm">
   <header className="wa-industry-attach-head"><div><span className="wa-kicker">NPC SETTLEMENT / PHYSICAL CARGO</span><h3>Assign mapped farm</h3><p>{current?.name} · Choose an existing farm and configure its supply route.</p></div><button type="button" className="wa-industry-close" onClick={()=>setFarmModal(false)} aria-label="Close farm selector">×</button></header>
   <div className="wa-industry-steps"><button type="button" className="active"><span>01</span> Mapped farm</button><button type="button" className={farmDraft.source_id?'active':''} disabled={!farmDraft.source_id}><span>02</span> Cargo settings</button></div>
   <div className="wa-industry-choice-heading"><strong>Available map locations</strong><span>{farmInfo?.options?.length||0} farms belonging to this faction in the region</span></div>
   <div className="wa-industry-location-grid wa-civic-type-grid">{(farmInfo?.options||[]).map(option=><button type="button" key={option.source_type+':'+option.id} className={'wa-industry-location-card '+(farmDraft.source_type===option.source_type&&Number(farmDraft.source_id)===Number(option.id)?'selected':'')} onClick={()=>setFarmDraft(d=>({...d,source_type:option.source_type,source_id:Number(option.id)}))}>
    <div className="wa-industry-location-top"><span className="wa-industry-location-symbol"><i className="fa-solid fa-wheat-awn" aria-hidden="true"/></span></div><strong>{option.name}</strong><span className="wa-industry-location-meta">{nameCase(option.kind)} · {option.source_type==='industry_site'?'Industry map location':'Settlement map marker'}</span><small>Region #{option.region_id} · Zone #{option.zone_id}</small>
   </button>)}</div>
   {!farmInfo?.options?.length&&<p className="wa-npc-subtle">No suitable mapped farm belongs to this faction in the region. Add or capture a farm using the existing map editor, then return here.</p>}
   <div className="wa-civic-build-fields" style={{padding:'16px 22px'}}>
    <label>Travel time (hours)<input type="number" min="1" max="168" step="1" value={farmDraft.travel_hours} onChange={e=>setFarmDraft(d=>({...d,travel_hours:Number(e.target.value)}))}/></label>
    <label>Daily cargo capacity (units)<input type="number" min="1" max="100000" step="1" value={farmDraft.cargo_capacity} onChange={e=>setFarmDraft(d=>({...d,cargo_capacity:Number(e.target.value)}))}/></label>
   </div>
   <footer className="wa-industry-attach-foot"><span>Goods depart from the real farm's stock, arrive after travel time, and cannot be delivered twice.</span><button type="button" onClick={()=>setFarmModal(false)}>Cancel</button><button type="button" className="wa-industry-primary" disabled={busy||!farmDraft.source_id||farmDraft.travel_hours<1||farmDraft.travel_hours>168||farmDraft.cargo_capacity<1} onClick={saveFarm}>Save farm and cargo route</button></footer>
  </section></div>}
  </div>
 </div>;
}
