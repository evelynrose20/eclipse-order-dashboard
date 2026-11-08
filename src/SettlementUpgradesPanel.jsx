import React,{useEffect,useState} from 'react';
import './world-industry.css';
import CivicTemplateManager from './CivicTemplateManager.jsx';
const kinds=[
 ['housing','Housing','Adds residential capacity'],
 ['defense','Defenses','Walls, watchtowers and fortifications'],
 ['clinic','Medical','Improves civilian medical services'],
 ['water','Waterworks','Improves fresh water access'],
 ['food_storage','Granaries','Improves food storage and logistics'],
 ['insulation','Weatherproofing','Improves protection against cold'],
 ['public_works','Public works','Improves settlement services'],
 ['school','School','Provides education and trained workers']
];
const states=['planned','building','operational','damaged','destroyed'];
const blank={name:'',category:'housing',status:'planned',condition_pct:100,level:1,housing_bonus:10,service_bonus:0,defense_bonus:0,notes:'',material_id:'',material_cost:0};
const fmt=n=>Number(n||0).toLocaleString();
const title=x=>String(x||'').replaceAll('_',' ').replace(/\b\w/g,k=>k.toUpperCase());
export default function SettlementUpgradesPanel({settlement,request,onChanged,materials=[],openChooser=false}){
 const [data,setData]=useState(null),[draft,setDraft]=useState(null),[addMenu,setAddMenu]=useState(Boolean(openChooser)),[step,setStep]=useState('choose'),[chosen,setChosen]=useState(''),[showTemplates,setShowTemplates]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{if(openChooser){setAddMenu(true);setStep('choose');setChosen('');setDraft(null)}},[openChooser]);
 const root='/world-admin/settlements/'+settlement.id+'/upgrades';
 const load=async()=>{const r=await request(root);setData(r)};
 useEffect(()=>{setData(null);setDraft(null);load().catch(e=>setError(e.message||'Unable to load upgrades'))},[settlement.id]);
 async function save(method,path,body,message){
  setBusy(true);setError('');setNotice('');
  try{await request(root+path,{method,body});await load();await onChanged?.();setDraft(null);setNotice(message);return true}
  catch(e){setError(e.message||'Unable to save upgrade');return false}
  finally{setBusy(false)}
 }
 if(!data)return <div className="wa-empty">{error||'Loading settlement upgrades…'}</div>;
 const cap=Number(data.housing_capacity||0),population=Number(data.residents||0);
 const sections=[
  {key:'housing',title:'Housing infrastructure',subtitle:'Residential buildings and available accommodation',icon:'fa-house',categories:['housing'],add:'Add housing'},
  {key:'defense',title:'Defensive infrastructure',subtitle:'Walls, watchtowers and fortifications',icon:'fa-shield-halved',categories:['defense'],add:'Add defenses'},
  {key:'education',title:'Education',subtitle:'Schools and places for young residents',icon:'fa-graduation-cap',categories:['school'],add:'Add school'},
  {key:'services',title:'Civic infrastructure',subtitle:'Clinics, waterworks, granaries and public works',icon:'fa-city',categories:['clinic','water','food_storage','insulation','public_works'],add:'Add civic structure'}
 ];
 const beginCategory=category=>setDraft({...blank,category,name:kinds.find(x=>x[0]===category)?.[1]||'',housing_bonus:category==='housing'?10:0,defense_bonus:category==='defense'?10:0,service_bonus:!['housing','defense','school'].includes(category)?10:0});
 const launch=()=>{setAddMenu(true);setStep('choose');setChosen('');setDraft(null)};
 const close=()=>{setAddMenu(false);setDraft(null);setStep('choose');setChosen('')};
 const editRecord=record=>{setDraft({...record});setChosen(record.template_id||record.category);setStep('details');setAddMenu(true)};
 const selectKind=template=>{setChosen(template.id);setDraft({...blank,template_id:template.id,category:template.category,name:template.name,status:'building'})};
 const categoryIcon={housing:'fa-house',defense:'fa-shield-halved',clinic:'fa-kit-medical',water:'fa-droplet',food_storage:'fa-warehouse',insulation:'fa-snowflake',public_works:'fa-city',school:'fa-graduation-cap'};
 const selectedTemplate=(data.templates||[]).find(x=>x.id===chosen);
 const chosenLabel=selectedTemplate?.name||kinds.find(x=>x[0]===chosen)?.[1]||'Structure';
 const effectText=x=>({housing_capacity:'housing places',defense:'defense',medical_access:'medical access',water_daily:'water units per cycle',food_capacity:'food storage units',insulation:'insulation',public_works:'public works',school_places:'student places'})[x]||title(x);
 const snapshot=x=>{try{return typeof x==='string'?JSON.parse(x):x||{}}catch{return {}}};
 const costFor=(t,level)=>({material:t?.material_id||'iron-ingot',units:Number(t?.material_per_level||0)*level,labor:Number(t?.construction_labor||0)*level,npc:Number(t?.npc_development_cost||0)*level});
 const renderStructure=(u)=><article className="wa-upgrade-card" key={u.id}>
   <header><span>{kinds.find(x=>x[0]===u.category)?.[1]||title(u.category)}</span><span className={'wa-upgrade-status is-'+u.status}>{title(u.status)}</span></header>
   <strong>{u.name}</strong><p>{u.notes||'No notes.'}</p>
   <div className="wa-upgrade-details"><span>Level {u.level}</span>{u.template_id&&<span>Effective: +{Math.floor(Number(snapshot(u.effect_snapshot).per_level||0)*Number(u.level)*(u.status==='operational'?Number(u.condition_pct)/100:u.status==='damaged'?Number(u.condition_pct)/200:0))} {effectText(snapshot(u.effect_snapshot).key)}</span>}{data.projects?.some(p=>Number(p.upgrade_id)===Number(u.id)&&p.status==='active')&&<span>Upgrade in progress</span>}<span>Condition {u.condition_pct}%</span>{u.housing_bonus>0&&<span>+{fmt(u.housing_bonus)} places</span>}{u.service_bonus>0&&<span>+{u.service_bonus} services</span>}{u.defense_bonus>0&&<span>+{u.defense_bonus} defense</span>}{u.status==='building'&&<span>{Number(u.construction_progress||0)}% constructed</span>}</div>
   <footer><button type="button" onClick={()=>editRecord(u)}>Manage</button><button type="button" disabled={busy} onClick={()=>{if(window.confirm('Delete '+u.name+'? Existing residents must remain housed.'))save('DELETE','/'+u.id,null,'Structure removed.')}}>Remove</button></footer>
  </article>;
 return <div className="wa-upgrades">
  <div className="wa-upgrades-header"><div><h3>Settlement infrastructure</h3><p>Functional buildings and upgrades shared by NPCs and Order settlements.</p></div><button type="button" onClick={()=>setShowTemplates(true)}>Manage templates</button></div>
  {error&&<p role="alert" className="wa-error">{error}</p>}{notice&&<p role="status" className="wa-notice">{notice}</p>}
  <div className="wa-upgrade-metrics">
    <div><small>Residents / housing</small><strong>{fmt(population)} / {fmt(cap)}</strong><span>{cap===0?'No housing: settlement cannot gain residents':Math.max(0,cap-population)+' vacant places'}</span></div>
    <div><small>Additional protection</small><strong>+{data.effects.defense_bonus}</strong><span>Operational defenses</span></div>
    <div><small>Food storage capacity</small><strong>{fmt(data.storage_capacity?.food||0)}</strong><span>Operational granaries expand this</span></div>
    <div><small>Waterworks output</small><strong>{fmt(data.effects.infrastructure?.water_daily||0)}</strong><span>Units per production cycle before labor limit</span></div>
    <div><small>Water storage capacity</small><strong>{fmt(data.storage_capacity?.water||0)}</strong><span>Operational waterworks expand this</span></div>
  </div>
  <div className="wa-upgrade-section-heading"><div className="wa-upgrade-section-title"><i className="fa-solid fa-plus" aria-hidden="true"/><div><h4>Build infrastructure</h4><p>Plan new buildings and services for this settlement.</p></div></div><button type="button" onClick={launch}>+ Add structure</button></div>
  {sections.map(section=>{
   const records=data.upgrades.filter(u=>section.categories.includes(u.category));
   return <section className="wa-upgrade-section" key={section.key} aria-label={section.title}>
    <div className="wa-upgrade-section-heading">
     <div className="wa-upgrade-section-title"><i className={'fa-solid '+section.icon} aria-hidden="true"/><div><h4>{section.title}</h4><p>{section.subtitle}</p></div><span className="wa-upgrade-section-count">{records.length}</span></div>
     <button type="button" onClick={launch}>+ Add</button>
    </div>
    {records.length?<div className="wa-upgrade-grid">{records.map(renderStructure)}</div>:<div className="wa-upgrade-section-empty">No {section.key==='housing'?'residential buildings':section.key==='defense'?'defensive structures':'civic facilities'} recorded yet.</div>}
   </section>;
  })}
  {showTemplates&&<CivicTemplateManager templates={data.templates||[]} materials={materials} request={request} onSaved={load} onClose={()=>setShowTemplates(false)}/>}
  {addMenu&&<div className="wa-industry-overlay" role="presentation">
   <section className="wa-industry-attach wa-civic-attach" role="dialog" aria-modal="true" aria-label="Plan settlement infrastructure">
    <header className="wa-industry-attach-head"><div><span className="wa-kicker">CIVILIAN WELFARE / INFRASTRUCTURE</span><h3>{draft?.id?'Manage structure':'Build infrastructure'}</h3><p>{settlement.name} · Choose a structure and configure its construction.</p></div><button type="button" className="wa-industry-close" aria-label="Close structure setup" onClick={close}>×</button></header>
    <div className="wa-industry-steps">
     <button type="button" className={step==='choose'?'active':''} onClick={()=>setStep('choose')}><span>01</span> Structure type</button>
     <button type="button" className={step==='details'?'active':''} disabled={!chosen} onClick={()=>setStep('details')}><span>02</span> Construction setup</button>
    </div>
    {error&&<p role="alert" className="wa-error wa-civic-modal-error">{error}</p>}
    {step==='choose'?<>
     <div className="wa-industry-choice-heading"><strong>Choose a building or service</strong><span>{(data.templates||[]).filter(t=>t.enabled).length} available templates · {settlement.name}</span></div>
     <div className="wa-industry-location-grid wa-civic-type-grid" role="group" aria-label="Structure types">
      {(data.templates||[]).filter(t=>t.enabled).map(t=><button type="button" className={'wa-industry-location-card '+(chosen===t.id?'selected':'')} aria-pressed={chosen===t.id} key={t.id} onClick={()=>selectKind(t)}>
       <div className="wa-industry-location-top"><span className="wa-industry-location-symbol"><i className={'fa-solid '+categoryIcon[t.category]} aria-hidden="true"/></span>{chosen===t.id&&<span className="wa-industry-location-status is-secure">SELECTED</span>}</div>
       <strong>{t.name}</strong><span className="wa-industry-location-meta">{t.description}</span>
       <small>+{fmt(t.effect_per_level)} {effectText(t.effect_key)} per level</small>
       <small>Construction: {fmt(t.material_per_level)} {t.material_id} · {fmt(t.construction_labor)} labor</small>
      </button>)}
     </div>
     <footer className="wa-industry-attach-foot"><span>{chosen?chosenLabel+' selected':'Select a structure type to continue.'}</span><button type="button" className="wa-industry-primary" disabled={!chosen} onClick={()=>setStep('details')}>Continue to construction <i className="fa-solid fa-chevron-right" aria-hidden="true"/></button></footer>
    </>:draft&&<>
     {draft.template_id&&<div className="wa-civic-build-form">
      <div className="wa-industry-production-layout"><div className="wa-industry-production-main">
       <div className="wa-industry-picked-location"><span className="wa-kicker">{draft.id?'EXISTING BUILDING':'SELECTED TEMPLATE'}</span><strong>{chosenLabel}</strong><small>{settlement.name} · {title(draft.category)}</small>{!draft.id&&<button type="button" onClick={()=>setStep('choose')}>Change template</button>}</div>
       <div className="wa-industry-requirement-preview">
        <strong>{draft.id?'Current building performance':'Template production and capacity'}</strong>
        <span>Level {draft.id?draft.level:1} · {selectedTemplate?.effect_per_level||snapshot(draft.effect_snapshot).per_level||0} {effectText(selectedTemplate?.effect_key||snapshot(draft.effect_snapshot).key)} per level</span>
        <span>{draft.id?'Installed level remains active during an upgrade.':'Construction must finish before the new building produces effects.'}</span>
        {data.projects?.filter(p=>Number(p.upgrade_id)===Number(draft.id)&&p.status==='active').map(p=><span key={p.id}>Construction: {fmt(p.progress)} / {fmt(p.labor_required)} labor · {p.materials_paid?'Materials funded':'Materials still needed'}</span>)}
       </div>
      </div><aside className="wa-industry-configuration"><h4>{draft.id?(draft.status==='damaged'?'Repair structure':'Next upgrade'):'Construction requirements'}</h4>
       {selectedTemplate&&(draft.status==='damaged'||Number(draft.id?draft.level:0)<Number(selectedTemplate.max_level))?<>
        <p>{draft.status==='damaged'?'Restore level '+draft.level:'Target level '+(draft.id?Number(draft.level)+1:1)} / {selectedTemplate.max_level}</p>
        <p>{fmt(draft.status==='damaged'?Math.max(1,Math.ceil(costFor(selectedTemplate,Number(draft.level)).units*Math.max(.2,(100-Number(draft.condition_pct||0))/100)*.5)):costFor(selectedTemplate,draft.id?Number(draft.level)+1:1).units)} × {selectedTemplate.material_id} from shared Order inventory</p>
        <p>{fmt(draft.status==='damaged'?Math.max(10,Math.ceil(costFor(selectedTemplate,Number(draft.level)).labor*Math.max(.2,(100-Number(draft.condition_pct||0))/100)*.5)):costFor(selectedTemplate,draft.id?Number(draft.level)+1:1).labor)} simulated worker labor</p>
        <p>NPCs pay {fmt(draft.status==='damaged'?Math.max(1,Math.ceil(costFor(selectedTemplate,Number(draft.level)).npc*Math.max(.2,(100-Number(draft.condition_pct||0))/100)*.5)):costFor(selectedTemplate,draft.id?Number(draft.level)+1:1).npc)} development points for this tier instead.</p>
       </>:<p>Maximum building level reached or template is no longer available.</p>}
       <p>Effects and construction costs are determined by the saved template, not manual service bonuses.</p>
      </aside></div>
      <footer className="wa-industry-attach-foot"><button type="button" onClick={()=>draft.id?close():setStep('choose')}>{draft.id?'Close':'Back to templates'}</button>
       <button type="button" className="wa-industry-primary" disabled={busy||!selectedTemplate||(!selectedTemplate.enabled&&draft.status!=='damaged')||(draft.status!=='damaged'&&Number(draft.id?draft.level:0)>=Number(selectedTemplate.max_level))||Boolean(data.projects?.some(p=>Number(p.upgrade_id)===Number(draft.id)&&['active','paused'].includes(p.status)))} onClick={async()=>{const result=await save('POST',draft.id?'/'+draft.id+(draft.status==='damaged'?'/repair':'/improve'):'/from-template',draft.id?{}:{template_id:draft.template_id},draft.id?(draft.status==='damaged'?'Repair project started.':'Upgrade project started.'):'Building project started.');if(result)close()}}>{busy?'Saving…':draft.id?(draft.status==='damaged'?'Repair building':'Start upgrade project'):'Start construction'}</button>
      </footer>
     </div>}
     {!draft.template_id&&     <form id="wa-civic-build-form" className="wa-civic-build-form" onSubmit={e=>{e.preventDefault();const b={...draft,level:Number(draft.level),condition_pct:Number(draft.condition_pct),housing_bonus:Number(draft.housing_bonus),service_bonus:Number(draft.service_bonus),defense_bonus:Number(draft.defense_bonus),material_id:draft.material_id||null,material_cost:Number(draft.material_cost||0)};save(draft.id?'PUT':'POST',draft.id?'/'+draft.id:'',b,draft.id?'Structure updated.':'Structure added.').then(saved=>{if(saved)close()})}}>
      <div className="wa-industry-production-layout">
       <div className="wa-industry-production-main">
        <div className="wa-industry-picked-location"><span className="wa-kicker">SELECTED STRUCTURE</span><strong><i className={'fa-solid '+categoryIcon[draft.category]} aria-hidden="true"/> {chosenLabel}</strong><small>{settlement.name} · Civilian infrastructure</small>{!draft.id&&<button type="button" onClick={()=>setStep('choose')}>Change structure type</button>}</div>
        <div className="wa-civic-build-fields">
         <label>Name<input required maxLength="120" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
         <label>Category<select value={draft.category} disabled={!draft.id} onChange={e=>setDraft({...draft,category:e.target.value,housing_bonus:e.target.value==='housing'?10:0,defense_bonus:e.target.value==='defense'?10:0,service_bonus:['clinic','water','food_storage','insulation','public_works','school'].includes(e.target.value)?10:0})}>{kinds.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
         <label>State<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}>{states.map(x=><option key={x} value={x}>{title(x)}</option>)}</select></label>
         <label>Level<input type="number" required min="1" max="20" step="1" value={draft.level} onChange={e=>setDraft({...draft,level:e.target.value})}/></label>
         <label>Condition %<input type="number" required min="0" max="100" step="1" value={draft.condition_pct} onChange={e=>setDraft({...draft,condition_pct:e.target.value})}/></label>
         {draft.category==='housing'&&<label>Housing places<input type="number" required min="0" max="10000000" step="1" value={draft.housing_bonus} onChange={e=>setDraft({...draft,housing_bonus:e.target.value})}/></label>}
         {draft.category==='defense'&&<label>Defense improvement<input type="number" required min="0" max="100" step="1" value={draft.defense_bonus} onChange={e=>setDraft({...draft,defense_bonus:e.target.value})}/></label>}
         {['clinic','water','food_storage','insulation','public_works'].includes(draft.category)&&<label>Service improvement<input type="number" required min="0" max="100" step="1" value={draft.service_bonus} onChange={e=>setDraft({...draft,service_bonus:e.target.value})}/></label>}
         {['planned','building'].includes(draft.status)&&<><label>Construction material<select value={draft.material_id||''} disabled={Boolean(draft.materials_paid)} onChange={e=>setDraft({...draft,material_id:e.target.value})}><option value="">None required</option>{materials.map(m=><option key={m.id} value={m.id}>{m.name} · {fmt(m.quantity)} available</option>)}</select></label><label>Material units<input type="number" required min="0" max="1000000" step="1" disabled={Boolean(draft.materials_paid)} value={draft.material_cost||0} onChange={e=>setDraft({...draft,material_cost:e.target.value})}/></label></>}
         <label className="wide">Notes<input maxLength="500" value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label>
        </div>
       </div>
       <aside className="wa-industry-configuration"><h4>Construction details</h4><p>Current residents: {fmt(population)}</p><p>Housing capacity: {fmt(cap)}</p><p>Planned and building structures do not provide finished benefits.</p><p>Damaged buildings provide reduced effects. Housing cannot be downgraded below existing residents.</p>{draft.status==='building'&&<p>Construction progress: {Number(draft.construction_progress||0)}%. Building progresses using available workers and committed materials during settlement cycles.</p>}</aside>
      </div>
      <footer className="wa-industry-attach-foot"><button type="button" onClick={()=>draft.id?close():setStep('choose')}>{draft.id?'Cancel':'Back to structures'}</button><button type="submit" className="wa-industry-primary" disabled={busy}>{busy?'Saving…':draft.id?'Save changes':'Create structure'}</button></footer>
     </form>}
    </>}
   </section>
  </div>}
 </div>;
}
