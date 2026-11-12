import React,{useEffect,useState} from 'react';

const blank={settlement_id:0,name:'Ceruleum Power Station',model:'Garlean Ceruleum Generator',condition_pct:100,rated_output:120,fuel_units:500,fuel_per_day:100,status:'operational'};
const fmt=n=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:1});
const title=s=>String(s||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());

export default function PowerGridPanel({request}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[draft,setDraft]=useState(blank),[edit,setEdit]=useState(null),[fuel,setFuel]=useState({}),[chamber,setChamber]=useState('');
 async function load(){
  const d=await request('/world-admin/power');setData(d);
  setChamber(String(d.consumers.find(c=>c.consumer_key==='aetheric-chamber')?.settlement_id||''));
 }
 useEffect(()=>{load().catch(e=>setError(e.message))},[]);
 async function action(path,body,success){
  setBusy(true);setError('');setNotice('');
  try{await request(path,{method:'POST',body});await load();setNotice(success);setEdit(null);return true}
  catch(e){setError(e.message||'Unable to save power records.');return false}
  finally{setBusy(false)}
 }
 const asNumbers=b=>({...b,settlement_id:Number(b.settlement_id),condition_pct:Number(b.condition_pct),rated_output:Number(b.rated_output),fuel_units:Number(b.fuel_units),fuel_per_day:Number(b.fuel_per_day)});
 return <section className="wa-panel power-grid">
  <div className="wa-panel-title"><strong>SETTLEMENT POWER GRID</strong><span>Generator infrastructure</span></div>
  <p>Power plants consume ceruleum fuel continuously. Low output restricts machinery; a total outage disables powered heating and lighting. Civilian settlements accrue unrest during sustained outages. Repairing a generator and recording fuel deliveries restores service.</p>
  {error&&<p role="alert" className="chamber-alert">{error}</p>}
  {notice&&<p role="status" className="chamber-notice">{notice}</p>}
  {!data?<p>Loading power infrastructure…</p>:<>
   <div className="power-grid-list">
    {data.plants.map(p=><article className="power-grid-card" key={p.id}>
     <div><span>POWER STATION #{p.id}</span><h3>{p.name}</h3><small>{p.settlement_name} · {p.model}</small></div>
     <div className="power-grid-metrics"><div><small>GRID POWER</small><strong className={'power-grade '+p.grade}>{title(p.grade)}</strong></div><div><small>CONDITION</small><strong>{fmt(p.condition_pct)}%</strong></div><div><small>FUEL LEFT</small><strong>{fmt(p.fuel_days)} days</strong></div><div><small>FUEL</small><strong>{fmt(p.fuel_units)} units</strong></div><div><small>OUTPUT RATING</small><strong>{fmt(p.rated_output)}</strong></div><div><small>STATUS</small><strong>{title(p.status)}</strong></div></div>
     <div className="power-grid-actions"><button type="button" disabled={busy} onClick={()=>setEdit(p)}>Maintain / repair</button><label>Record delivered fuel <input aria-label={'Fuel delivery '+p.name} type="number" min=".001" step=".001" value={fuel[p.id]??''} onChange={e=>setFuel(v=>({...v,[p.id]:e.target.value}))} placeholder="Units"/></label><button type="button" disabled={busy||!(Number(fuel[p.id])>0)} onClick={()=>action('/world-admin/power/plants/'+p.id+'/refuel',{quantity:Number(fuel[p.id])},'Fuel delivery recorded.')}>Deliver fuel</button></div>
    </article>)}
    {!data.plants.length&&<p>No power plants exist yet. Add the first generator to an established settlement.</p>}
   </div>
   <div className="power-grid-actions"><button type="button" disabled={busy} onClick={()=>setEdit({...blank,settlement_id:data.settlements[0]?.id||0})}><i className="fa-solid fa-plus"/> New power building</button></div>
   <div className="power-grid-link"><h3>Extraction Chamber Power Source</h3><p>Choose which settlement supplies the chamber. Unassigned retains the legacy rate until you physically place the chamber in the world.</p><select aria-label="Chamber power source" value={chamber} onChange={e=>setChamber(e.target.value)}><option value="">Unassigned (legacy power)</option>{data.settlements.map(s=><option key={s.id} value={s.id}>{s.name} · {title(data.grades[String(s.id)]||'unconfigured')}</option>)}</select><button type="button" disabled={busy} onClick={()=>action('/world-admin/power/chamber',{settlement_id:chamber?Number(chamber):null},'Chamber power source saved.')}>Save chamber link</button></div>
  </>}
  {edit&&<div className="wa-overlay"><form className="wa-dialog power-grid-dialog" onSubmit={e=>{e.preventDefault();const v=asNumbers(edit);action(edit.id?'/world-admin/power/plants/'+edit.id:'/world-admin/power/plants',v,edit.id?'Power station updated.':'Power station built.')}}>
   <div className="wa-dialog-head"><h3>{edit.id?'Repair / maintain':'Construct'} power building</h3><button type="button" onClick={()=>setEdit(null)} aria-label="Close">×</button></div>
   <div className="power-grid-fields">
    {!edit.id&&<><label>Settlement <select required value={edit.settlement_id} onChange={e=>setEdit(v=>({...v,settlement_id:Number(e.target.value)}))}>{data?.settlements.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Building name <input required maxLength="140" value={edit.name} onChange={e=>setEdit(v=>({...v,name:e.target.value}))}/></label><label>Generator model <input maxLength="100" value={edit.model} onChange={e=>setEdit(v=>({...v,model:e.target.value}))}/></label><label>Initial fuel units <input type="number" min="0" step=".001" value={edit.fuel_units} onChange={e=>setEdit(v=>({...v,fuel_units:e.target.value}))}/></label></>}
    <label>Condition % <input type="number" min="0" max="100" step="1" value={edit.condition_pct} onChange={e=>setEdit(v=>({...v,condition_pct:e.target.value}))}/></label>
    <label>Rated output <input type="number" min="1" step=".1" value={edit.rated_output} onChange={e=>setEdit(v=>({...v,rated_output:e.target.value}))}/></label>
    <label>Fuel consumed per day <input type="number" min=".001" step=".001" value={edit.fuel_per_day} onChange={e=>setEdit(v=>({...v,fuel_per_day:e.target.value}))}/></label>
    <label>Status <select value={edit.status} onChange={e=>setEdit(v=>({...v,status:e.target.value}))}>{['operational','damaged','paused','destroyed'].map(x=><option key={x} value={x}>{title(x)}</option>)}</select></label>
   </div>
   <div className="power-grid-actions"><button type="button" onClick={()=>setEdit(null)}>Cancel</button><button disabled={busy} type="submit">Save power building</button></div>
  </form></div>}
 </section>;
}
