import React,{useEffect,useMemo,useState} from 'react';
const amount=n=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:1});
const nice=s=>String(s||'').replaceAll('_',' ').replace(/\b\w/g,x=>x.toUpperCase());
const gradeIcon={outage:'fa-plug-circle-xmark',low:'fa-battery-quarter',good:'fa-bolt',perfect:'fa-bolt-lightning',unconfigured:'fa-circle-question'};
export default function PowerGridPanel({request,regionId,zoneId}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [dialog,setDialog]=useState(null),[fuel,setFuel]=useState({}),[source,setSource]=useState({}),[chamber,setChamber]=useState('');
 const [blueprintDraft,setBlueprintDraft]=useState(null);
 async function load(){
  const result=await request('/world-admin/power');
  setData(result);
  setChamber(String(result.consumers?.find(x=>x.consumer_key==='aetheric-chamber')?.settlement_id||''));
 }
 useEffect(()=>{load().catch(e=>setError(e.message||'Unable to load power infrastructure.'))},[]);
 async function action(path,body,message){
  setError('');setNotice('');setBusy(true);
  try{await request(path,{method:'POST',body});await load();setNotice(message);setDialog(null)}
  catch(e){setError(e.message||'Power operation failed.')}
  finally{setBusy(false)}
 }
 const local=useMemo(()=>data?.settlements?.filter(s=>String(s.region_id)===String(regionId)&&String(s.zone_id||'')===String(zoneId||''))||[],[data,regionId,zoneId]);
 const localIds=new Set(local.map(s=>Number(s.id)));
 const plants=data?.plants?.filter(p=>localIds.has(Number(p.settlement_id)))||[];
 const projects=data?.projects?.filter(p=>localIds.has(Number(p.settlement_id)))||[];
 const blueprints=data?.blueprints||[];
 const selectedPlant=dialog?.plant||null;
 const selectedBlueprint=blueprints.find(x=>x.id===dialog?.blueprint_id);
 const needs=projects.filter(p=>p.status==='active');
 const choose=(kind,plant=null)=>{
  const settlementId=plant?.settlement_id||local.find(s=>s.controlling_faction_id==='eclipse-order')?.id||0;
  setDialog({kind,plant,settlement_id:Number(settlementId),blueprint_id:kind==='repair'?plant?.blueprint_id:(kind==='upgrade'||kind==='replace'?blueprints.find(b=>Number(b.technology_level)>Number(plant?.level||0))?.id||blueprints[blueprints.length-1]?.id:blueprints[0]?.id)});
 };
 return <section className="wa-panel power-grid">
  <div className="wa-panel-title"><strong>POWER INFRASTRUCTURE</strong><span>{local.length} settlements · {plants.length} power buildings</span></div>
  <p>Power stations belong to individual settlements. Repair, construction, replacement and modernization use funded projects and workforce progression, just like other rebuilding work. Fuel must be delivered from an existing Order facility's ceruleum stock.</p>
  {error&&<p className="alert" role="alert">{error}</p>}{notice&&<p role="status" className="chamber-notice">{notice}</p>}
  {!data?<p>Loading power infrastructure…</p>:<>
   <div className="power-grid-list">
    {plants.map(p=>{
     const existing=needs.find(x=>Number(x.plant_id)===Number(p.id));
     const supplies=data.fuel_sources?.filter(x=>Number(x.settlement_id)===Number(p.settlement_id)&&Number(x.fuel_units)>0)||[];
     return <article className="power-grid-card" key={p.id}>
      <div><span>POWER BUILDING · LEVEL {p.level||1} · #{p.id}</span><h3>{p.name}</h3><small>{p.settlement_name} · {p.model}</small></div>
      <div className="power-grid-metrics">
       <div><small>GRID POWER</small><strong className={'power-grade '+p.grade}>{nice(p.grade)}</strong></div>
       <div><small>CONDITION</small><strong>{amount(p.condition_pct)}%</strong></div>
       <div><small>FUEL REMAINING</small><strong>{Number(p.fuel_days).toFixed(1)} days</strong></div>
       <div><small>CERULEUM</small><strong>{amount(p.fuel_units)}</strong></div>
       <div><small>RATED OUTPUT</small><strong>{amount(p.rated_output)}</strong></div>
       <div><small>MODEL</small><strong>{nice(p.status)}</strong></div>
      </div>
      {existing?<p className="power-grid-project-link">Project underway: {nice(existing.action)} · {amount(existing.progress)} / {amount(existing.labor_required)} labor</p>:
      <div className="power-grid-actions">
       <button disabled={busy||Number(p.condition_pct)>=100} onClick={()=>choose('repair',p)}>Start repair project</button>
       <button disabled={busy||!blueprints.some(b=>Number(b.technology_level)>Number(p.level))} onClick={()=>choose('upgrade',p)}>Upgrade generator</button>
       <button disabled={busy} onClick={()=>choose('replace',p)}>Replace generator</button>
      </div>}
      <div className="power-grid-fuel">
       <strong>Deliver ceruleum from industry stock</strong>
       <select value={source[p.id]||''} onChange={e=>setSource(v=>({...v,[p.id]:e.target.value}))}><option value="">Select local supplying facility</option>{supplies.map(f=><option value={f.id} key={f.id}>{f.name} · {amount(f.fuel_units)} units</option>)}</select>
       <input type="number" min=".001" step=".001" placeholder="Fuel units" aria-label={'Fuel quantity for '+p.name} value={fuel[p.id]??''} onChange={e=>setFuel(v=>({...v,[p.id]:e.target.value}))}/>
       <button disabled={busy||!source[p.id]||!(Number(fuel[p.id])>0)} onClick={()=>action('/world-admin/power/plants/'+p.id+'/refuel',{facility_id:Number(source[p.id]),quantity:Number(fuel[p.id])},'Ceruleum transferred into the generator.')}>Deliver fuel</button>
      </div>
     </article>;
    })}
    {!plants.length&&<div className="power-grid-empty"><i className="fa-solid fa-plug-circle-xmark"/><h3>No power grid in this zone</h3><p>This zone has no installed generators. Other regions and zones have their own independent power infrastructure.</p></div>}
   </div>
   {!!local.some(s=>s.controlling_faction_id==='eclipse-order')&&<div className="power-grid-actions"><button type="button" disabled={busy} onClick={()=>choose('construct')}><i className="fa-solid fa-plus"/> Start power building project</button></div>}
   <div className="power-grid-projects">
    <h3>Construction & restoration projects</h3>
    {!projects.length?<p className="muted">No power construction projects in this zone.</p>:projects.map(p=><article className="power-grid-project" key={p.id}>
     <div className="power-grid-project-head"><div><strong>{nice(p.action)} · {p.blueprint_name}</strong><small>{p.settlement_name} · Project #{p.id}</small></div><span>{nice(p.status)}</span></div>
     <div className="power-grid-progress"><div style={{width:Math.min(100,Number(p.progress)/Math.max(1,Number(p.labor_required))*100)+'%'}}/></div>
     <small>Workforce progress: {amount(p.progress)} / {amount(p.labor_required)} · Available workers: {amount(local.find(s=>Number(s.id)===Number(p.settlement_id))?.workforce)}</small>
     <div className="power-grid-project-materials">
      {[['iron-ingot','Iron ingots','iron_committed','iron_required'],['repair-timbers','Repair timbers','timber_committed','timber_required']].map(([materialId,label,committed,required])=>{
       const remaining=Math.max(0,Number(p[required])-Number(p[committed]));
       return <div key={materialId}><span>{label}: {amount(p[committed])} / {amount(p[required])}</span>
        {p.status==='active'&&remaining>0&&<button disabled={busy||Number(data.stock.find(x=>x.id===materialId)?.quantity||0)<1} onClick={()=>action('/world-admin/power/projects/'+p.id+'/commit',{material_id:materialId,quantity:Math.min(remaining,Number(data.stock.find(x=>x.id===materialId)?.quantity||0))},'Materials committed to the power project.')}>Commit available stock ({amount(data.stock.find(x=>x.id===materialId)?.quantity)})</button>}</div>;
      })}
     </div>
     {p.status==='active'&&<button disabled={busy||Number(p.iron_committed)<Number(p.iron_required)||Number(p.timber_committed)<Number(p.timber_required)} onClick={()=>action('/world-admin/power/projects/'+p.id+'/advance',{},'Power construction advanced one workforce cycle.')}>Advance funded construction · once per UTC day</button>}
    </article>)}
   </div>
   <details className="power-blueprint-library">
    <summary><i className="fa-solid fa-screwdriver-wrench"/> Generator Blueprint Library · {blueprints.length} models</summary>
    <p>Blueprints are shared templates. Editing one changes future project specifications, not installed generators or already-started project costs.</p>
    <div className="power-blueprint-grid">{blueprints.map(b=><div key={b.id} className="power-blueprint-card">
      <small>LEVEL {b.technology_level} · {b.id}</small>
      <strong>{b.name}</strong>
      <span>Output {amount(b.rated_output)} · Fuel/day {amount(b.fuel_per_day)}</span>
      <span>{amount(b.material_iron)} iron · {amount(b.material_timber)} timber · {amount(b.labor_required)} labor</span>
      <button disabled={busy} onClick={()=>setBlueprintDraft({...b})}>Edit blueprint</button>
    </div>)}</div>
    <button type="button" onClick={()=>setBlueprintDraft({id:'',name:'',technology_level:1,rated_output:100,fuel_per_day:50,material_iron:80,material_timber:80,labor_required:150,description:''})}><i className="fa-solid fa-plus"/> Create blueprint</button>
   </details>
   <div className="power-grid-link"><h3>Extraction Chamber Power Source</h3><p>Link the chamber to the settlement where it is physically installed. Changing the region or zone above does not move an existing chamber.</p>
    <select value={chamber} onChange={e=>setChamber(e.target.value)}><option value="">Unassigned — existing power rate</option>{local.map(s=><option value={s.id} key={s.id}>{s.name} · {nice(data.grades[String(s.id)]||'unconfigured')}</option>)}{chamber&&!localIds.has(Number(chamber))&&<option value={chamber}>Linked outside current zone — choose a local settlement to move</option>}</select>
    <button disabled={busy} onClick={()=>action('/world-admin/power/chamber',{settlement_id:chamber?Number(chamber):null},'Chamber grid link saved.')}>Save location</button>
   </div>
  </>}
  {blueprintDraft&&<div className="wa-overlay"><form className="wa-dialog power-grid-dialog" onSubmit={e=>{e.preventDefault();const id=blueprintDraft.id;const exists=blueprints.some(b=>b.id===id);const url='/world-admin/power/blueprints'+(exists?'/'+id:'');setBusy(true);setError('');setNotice('');request(url,{method:'POST',body:{...blueprintDraft,technology_level:Number(blueprintDraft.technology_level),rated_output:Number(blueprintDraft.rated_output),fuel_per_day:Number(blueprintDraft.fuel_per_day),material_iron:Number(blueprintDraft.material_iron),material_timber:Number(blueprintDraft.material_timber),labor_required:Number(blueprintDraft.labor_required)}}).then(load).then(()=>{setBlueprintDraft(null);setNotice('Generator blueprint saved.')}).catch(err=>setError(err.message||'Unable to save blueprint.')).finally(()=>setBusy(false))}}>
   <div className="wa-dialog-head"><h3>{blueprints.some(b=>b.id===blueprintDraft.id)?'Edit':'Create'} generator blueprint</h3><button type="button" onClick={()=>setBlueprintDraft(null)} aria-label="Close">×</button></div>
   <p className="muted">Defines the cost and capabilities for future construction, repair, upgrades and replacement projects. Existing power station stats are not changed.</p>
   <div className="power-grid-fields">
    <label>Blueprint ID<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength="48" disabled={blueprints.some(b=>b.id===blueprintDraft.id)} value={blueprintDraft.id} onChange={e=>setBlueprintDraft(v=>({...v,id:e.target.value}))}/></label>
    <label>Model name<input required maxLength="110" value={blueprintDraft.name} onChange={e=>setBlueprintDraft(v=>({...v,name:e.target.value}))}/></label>
    {[['technology_level','Technology level',1,20,1],['rated_output','Rated output',1,1000000,.1],['fuel_per_day','Fuel used per day',.001,100000,.001],['material_iron','Iron ingots required',1,1000000,1],['material_timber','Repair timbers required',1,1000000,1],['labor_required','Labor required',1,10000000,1]].map(([key,label,min,max,step])=><label key={key}>{label}<input type="number" required min={min} max={max} step={step} value={blueprintDraft[key]} onChange={e=>setBlueprintDraft(v=>({...v,[key]:e.target.value}))}/></label>)}
    <label className="power-blueprint-description">Description<input maxLength="300" value={blueprintDraft.description||''} onChange={e=>setBlueprintDraft(v=>({...v,description:e.target.value}))}/></label>
   </div>
   <div className="power-grid-actions"><button type="button" onClick={()=>setBlueprintDraft(null)}>Cancel</button><button type="submit" disabled={busy}>Save blueprint</button></div>
  </form></div>}
  {dialog&&<div className="wa-overlay"><form className="wa-dialog power-grid-dialog" onSubmit={e=>{e.preventDefault();action('/world-admin/power/projects',{settlement_id:Number(dialog.settlement_id),plant_id:dialog.plant?Number(dialog.plant.id):null,blueprint_id:dialog.blueprint_id,action:dialog.kind},'Power construction project created.')}}>
   <div className="wa-dialog-head"><h3>{nice(dialog.kind)} power building</h3><button type="button" onClick={()=>setDialog(null)} aria-label="Close">×</button></div>
   <p className="muted">This creates a real construction project. Condition, level and output cannot be changed directly. Fund its materials and advance workforce cycles to finish.</p>
   <div className="power-grid-fields">
    {!selectedPlant&&<label>Settlement<select value={dialog.settlement_id} onChange={e=>setDialog(v=>({...v,settlement_id:Number(e.target.value)}))}>{local.filter(s=>s.controlling_faction_id==='eclipse-order').map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>}
    <label>Generator blueprint<select value={dialog.blueprint_id||''} onChange={e=>setDialog(v=>({...v,blueprint_id:e.target.value}))}>{blueprints.filter(b=>dialog.kind!=='repair'||b.id===selectedPlant?.blueprint_id).filter(b=>dialog.kind!=='upgrade'||Number(b.technology_level)>Number(selectedPlant?.level||0)).map(b=><option key={b.id} value={b.id}>Level {b.technology_level} · {b.name}</option>)}</select></label>
   </div>
   {selectedBlueprint&&<div className="power-grid-preview"><strong>{selectedBlueprint.name}</strong><span>Output: {amount(selectedBlueprint.rated_output)} · Fuel/day: {amount(selectedBlueprint.fuel_per_day)}</span><span>Base cost: {selectedBlueprint.material_iron} iron · {selectedBlueprint.material_timber} timber · {selectedBlueprint.labor_required} labor</span><small>Repair costs scale with existing damage; upgrades and replacements use the full blueprint cost.</small></div>}
   <div className="power-grid-actions"><button type="button" onClick={()=>setDialog(null)}>Cancel</button><button type="submit" disabled={busy||!dialog.blueprint_id||!dialog.settlement_id}>Create project</button></div>
  </form></div>}
 </section>;
}
