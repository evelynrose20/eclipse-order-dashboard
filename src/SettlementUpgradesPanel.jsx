import React,{useEffect,useState} from 'react';
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
export default function SettlementUpgradesPanel({settlement,request,onChanged,materials=[]}){
 const [data,setData]=useState(null),[draft,setDraft]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const root='/world-admin/settlements/'+settlement.id+'/upgrades';
 const load=async()=>{const r=await request(root);setData(r)};
 useEffect(()=>{setData(null);setDraft(null);load().catch(e=>setError(e.message||'Unable to load upgrades'))},[settlement.id]);
 async function save(method,path,body,message){
  setBusy(true);setError('');setNotice('');
  try{await request(root+path,{method,body});await load();await onChanged?.();setDraft(null);setNotice(message)}
  catch(e){setError(e.message||'Unable to save upgrade')}
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
 const beginCategory=(category)=>setDraft({...blank,category,housing_bonus:category==='housing'?10:0,defense_bonus:category==='defense'?10:0,service_bonus:!['housing','defense'].includes(category)?10:0});
 const renderStructure=(u)=><article className="wa-upgrade-card" key={u.id}>
   <header><span>{kinds.find(x=>x[0]===u.category)?.[1]||title(u.category)}</span><span className={'wa-upgrade-status is-'+u.status}>{title(u.status)}</span></header>
   <strong>{u.name}</strong><p>{u.notes||'No notes.'}</p>
   <div className="wa-upgrade-details"><span>Level {u.level}</span><span>Condition {u.condition_pct}%</span>{u.housing_bonus>0&&<span>+{fmt(u.housing_bonus)} places</span>}{u.service_bonus>0&&<span>+{u.service_bonus} services</span>}{u.defense_bonus>0&&<span>+{u.defense_bonus} defense</span>}{u.status==='building'&&<span>{Number(u.construction_progress||0)}% constructed</span>}</div>
   <footer><button type="button" onClick={()=>setDraft({...u})}>Manage</button><button type="button" disabled={busy} onClick={()=>{if(window.confirm('Delete '+u.name+'? Existing residents must remain housed.'))save('DELETE','/'+u.id,null,'Structure removed.')}}>Remove</button></footer>
  </article>;
 return <div className="wa-upgrades">
  <div className="wa-upgrades-header"><div><h3>Settlement infrastructure</h3><p>Housing, defenses and essential services are managed separately.</p></div></div>
  {error&&<p role="alert" className="wa-error">{error}</p>}{notice&&<p role="status" className="wa-notice">{notice}</p>}
  <div className="wa-upgrade-metrics">
    <div><small>Residents / housing</small><strong>{fmt(population)} / {fmt(cap)}</strong><span>{cap===0?'No housing: settlement cannot gain residents':Math.max(0,cap-population)+' vacant places'}</span></div>
    <div><small>Additional protection</small><strong>+{data.effects.defense_bonus}</strong><span>Operational defenses</span></div>
    <div><small>Additional services</small><strong>+{data.effects.service_bonus}</strong><span>Operational infrastructure</span></div>
  </div>
  {sections.map(section=>{
   const records=data.upgrades.filter(u=>section.categories.includes(u.category));
   return <section className="wa-upgrade-section" key={section.key} aria-label={section.title}>
    <div className="wa-upgrade-section-heading">
     <div className="wa-upgrade-section-title"><i className={'fa-solid '+section.icon} aria-hidden="true"/><div><h4>{section.title}</h4><p>{section.subtitle}</p></div><span className="wa-upgrade-section-count">{records.length}</span></div>
     <button type="button" onClick={()=>beginCategory(section.categories[0])}>+ {section.add}</button>
    </div>
    {records.length?<div className="wa-upgrade-grid">{records.map(renderStructure)}</div>:<div className="wa-upgrade-section-empty">No {section.key==='housing'?'residential buildings':section.key==='defense'?'defensive structures':'civic facilities'} recorded yet.</div>}
   </section>;
  })}
  {draft&&<div className="wa-upgrade-edit" role="region" aria-label="Structure editor">
   <div className="wa-upgrades-header"><h3>{draft.id?'Manage':'Add'} structure</h3><button type="button" onClick={()=>setDraft(null)}>Close</button></div>
   <form onSubmit={e=>{e.preventDefault();const b={...draft,level:Number(draft.level),condition_pct:Number(draft.condition_pct),housing_bonus:Number(draft.housing_bonus),service_bonus:Number(draft.service_bonus),defense_bonus:Number(draft.defense_bonus),material_id:draft.material_id||null,material_cost:Number(draft.material_cost||0)};save(draft.id?'PUT':'POST',draft.id?'/'+draft.id:'',b,draft.id?'Structure updated.':'Structure added.')}} className="wa-fields">
    <label>Name<input required maxLength="120" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
    <label>Category<select value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value,housing_bonus:e.target.value==='housing'?10:0,defense_bonus:e.target.value==='defense'?10:0,service_bonus:['clinic','water','food_storage','insulation','public_works','school'].includes(e.target.value)?10:0})}>{kinds.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
    <label>State<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}>{states.map(x=><option key={x} value={x}>{title(x)}</option>)}</select></label>
    <label>Level<input type="number" required min="1" max="20" step="1" value={draft.level} onChange={e=>setDraft({...draft,level:e.target.value})}/></label>
    <label>Condition %<input type="number" required min="0" max="100" step="1" value={draft.condition_pct} onChange={e=>setDraft({...draft,condition_pct:e.target.value})}/></label>
    {draft.category==='housing'&&<label>Housing places<input type="number" required min="0" max="10000000" step="1" value={draft.housing_bonus} onChange={e=>setDraft({...draft,housing_bonus:e.target.value})}/></label>}
    {draft.category==='defense'&&<label>Defense improvement<input type="number" required min="0" max="100" step="1" value={draft.defense_bonus} onChange={e=>setDraft({...draft,defense_bonus:e.target.value})}/></label>}
    {['clinic','water','food_storage','insulation','public_works'].includes(draft.category)&&<label>Service improvement<input type="number" required min="0" max="100" step="1" value={draft.service_bonus} onChange={e=>setDraft({...draft,service_bonus:e.target.value})}/></label>}
    {['planned','building'].includes(draft.status)&&<><label>Construction material<select value={draft.material_id||''} disabled={Boolean(draft.materials_paid)} onChange={e=>setDraft({...draft,material_id:e.target.value})}><option value="">None required (staff override)</option>{materials.map(m=><option key={m.id} value={m.id}>{m.name} · {fmt(m.quantity)} in shared stock</option>)}</select></label><label>Material units<input type="number" required min="0" max="1000000" step="1" disabled={Boolean(draft.materials_paid)} value={draft.material_cost||0} onChange={e=>setDraft({...draft,material_cost:e.target.value})}/></label></>}
    {draft.status==='building'&&<p className="wide wa-hint">Construction progress: {Number(draft.construction_progress||0)}%. {draft.materials_paid?'Materials already allocated.':'Materials will be deducted once from unreserved shared workshop stock at the first automatic construction step.'} Workers advance this structure each active automatic Order cycle.</p>}
    <label className="wide">Notes<input maxLength="500" value={draft.notes||''} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label>
    <div className="wide wa-upgrade-actions"><button type="button" onClick={()=>setDraft(null)}>Cancel</button><button className="wa-accent" type="submit" disabled={busy}>{busy?'Saving…':'Save structure'}</button></div>
   </form>
   <p className="wa-hint">Planned/building/destroyed structures provide no bonuses. Damaged structures provide reduced effects. Housing cannot be removed or downgraded below the current resident count.</p>
  </div>}
 </div>;
}
