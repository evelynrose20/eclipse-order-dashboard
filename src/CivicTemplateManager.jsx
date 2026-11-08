import React,{useState} from 'react';
import './world-industry.css';

const defs={
 housing:['housing_capacity','Housing places per level'],
 defense:['defense','Defense score per level'],
 clinic:['medical_access','Medical access per level'],
 water:['water_daily','Fresh water units per cycle / level'],
 food_storage:['food_capacity','Food storage units per level'],
 insulation:['insulation','Insulation per level'],
 public_works:['public_works','Public service score per level'],
 school:['school_places','Student places per level']
};
const heading=x=>String(x||'').replaceAll('_',' ').replace(/\b\w/g,k=>k.toUpperCase());
const blank=()=>({id:'',name:'',description:'',category:'housing',effect_key:'housing_capacity',effect_per_level:30,material_id:'iron-ingot',material_per_level:20,npc_development_cost:12,construction_labor:100,max_level:6,enabled:true});
export default function CivicTemplateManager({templates=[],materials=[],request,onSaved,onClose}){
 const [draft,setDraft]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const save=async()=>{
  if(!draft)return;
  setBusy(true);setError('');
  try{
   const body={...draft,effect_per_level:Number(draft.effect_per_level),material_per_level:Number(draft.material_per_level),npc_development_cost:Number(draft.npc_development_cost),construction_labor:Number(draft.construction_labor),max_level:Number(draft.max_level),enabled:!!draft.enabled};
   await request('/world-admin/civic/templates'+(templates.some(t=>t.id===draft.id)?'/'+draft.id:''),{method:templates.some(t=>t.id===draft.id)?'PUT':'POST',body});
   await onSaved?.();setDraft(null);
  }catch(e){setError(e.message||'Unable to save infrastructure template')}finally{setBusy(false)}
 };
 return <div className="wa-industry-overlay" role="presentation"><section role="dialog" aria-modal="true" aria-label="Civic building templates" className="wa-industry-attach wa-civic-attach">
  <header className="wa-industry-attach-head"><div><span className="wa-kicker">CIVILIAN INFRASTRUCTURE</span><h3>Building templates</h3><p>Reusable building types for Order settlements and autonomous NPC construction.</p></div><button type="button" className="wa-industry-close" aria-label="Close template editor" onClick={onClose}>×</button></header>
  {error&&<p className="wa-error wa-civic-modal-error" role="alert">{error}</p>}
  {!draft?<><div className="wa-industry-choice-heading"><strong>Available building recipes</strong><button type="button" className="wa-industry-primary" onClick={()=>setDraft(blank())}>+ Create template</button></div>
   <div className="wa-industry-location-grid wa-civic-type-grid">{templates.map(t=><button key={t.id} type="button" className="wa-industry-location-card" onClick={()=>setDraft({...t,enabled:!!t.enabled})}><div className="wa-industry-location-top"><span className="wa-industry-location-symbol"><i className="fa-solid fa-building" aria-hidden="true"/></span><span>{t.enabled?'Available':'Disabled'}</span></div><strong>{t.name}</strong><span className="wa-industry-location-meta">{t.description}</span><small>Level effect: +{t.effect_per_level} {heading(t.effect_key)} · Up to level {t.max_level}</small><small>Recipe revision {t.revision} · {t.material_per_level} {t.material_id} per tier</small></button>)}</div>
   <footer className="wa-industry-attach-foot"><span>Editing a recipe changes future construction and upgrades, not completed buildings.</span><button type="button" onClick={onClose}>Close</button></footer>
  </>:<><div className="wa-industry-steps"><button type="button" className="active"><span>01</span> Template setup</button><button type="button" disabled><span>02</span> Use in construction</button></div>
   <div className="wa-industry-production-layout"><div className="wa-industry-production-main"><div className="wa-civic-build-fields">
    <label>Template ID<input required pattern="[a-z][a-z0-9-]{2,47}" maxLength="48" disabled={templates.some(t=>t.id===draft.id)} value={draft.id} onChange={e=>setDraft({...draft,id:e.target.value.toLowerCase()})}/></label>
    <label>Name<input required maxLength="120" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
    <label className="wide">Description<input maxLength="400" value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
    <label>Category<select disabled={templates.some(t=>t.id===draft.id)} value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value,effect_key:defs[e.target.value][0]})}>{Object.keys(defs).map(x=><option key={x} value={x}>{heading(x)}</option>)}</select></label>
    <label>{defs[draft.category]?.[1]}<input type="number" required min="1" max="100000" step="1" value={draft.effect_per_level} onChange={e=>setDraft({...draft,effect_per_level:e.target.value})}/></label>
    <label>Construction material<select required value={draft.material_id} onChange={e=>setDraft({...draft,material_id:e.target.value})}>{materials.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
    <label>Material units / tier<input type="number" min="5" max="10000" required value={draft.material_per_level} onChange={e=>setDraft({...draft,material_per_level:e.target.value})}/></label>
    <label>Construction labor / tier<input type="number" min="50" max="100000" required value={draft.construction_labor} onChange={e=>setDraft({...draft,construction_labor:e.target.value})}/></label>
    <label>NPC development cost / tier<input type="number" min="5" max="10000" required value={draft.npc_development_cost} onChange={e=>setDraft({...draft,npc_development_cost:e.target.value})}/></label>
    <label>Maximum level<input type="number" min="1" max="10" required value={draft.max_level} onChange={e=>setDraft({...draft,max_level:e.target.value})}/></label>
    <label>Availability<select value={draft.enabled?'on':'off'} onChange={e=>setDraft({...draft,enabled:e.target.value==='on'})}><option value="on">Available to all settlements</option><option value="off">Disable future construction</option></select></label>
   </div></div><aside className="wa-industry-configuration"><h4>Template rules</h4><p>Templates define building effects and the materials, labor and NPC development required for each level.</p><p>A building receives its effect snapshot when its project completes. Editing this recipe will not rewrite an already completed level.</p><p>NPC factions choose enabled templates according to settlement needs and available development resources. Excessive building benefits or unrealistically cheap recipes are rejected.</p></aside></div>
   <footer className="wa-industry-attach-foot"><button type="button" onClick={()=>setDraft(null)}>Back to templates</button><button type="button" className="wa-industry-primary" disabled={busy||!draft.id||!draft.name.trim()} onClick={save}>{busy?'Saving…':'Save template'}</button></footer>
  </>}
 </section></div>;
}
