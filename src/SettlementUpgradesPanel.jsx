import React,{useEffect,useState} from 'react';
const kinds=[
 ['housing','Housing','Adds residential capacity'],
 ['defense','Defenses','Walls, watchtowers and fortifications'],
 ['clinic','Medical','Improves civilian medical services'],
 ['water','Waterworks','Improves fresh water access'],
 ['food_storage','Granaries','Improves food storage and logistics'],
 ['insulation','Weatherproofing','Improves protection against cold'],
 ['public_works','Public works','Improves settlement services']
];
const states=['planned','building','operational','damaged','destroyed'];
const blank={name:'',category:'housing',status:'planned',condition_pct:100,level:1,housing_bonus:10,service_bonus:0,defense_bonus:0,notes:''};
const fmt=n=>Number(n||0).toLocaleString();
const title=x=>String(x||'').replaceAll('_',' ').replace(/\b\w/g,k=>k.toUpperCase());
export default function SettlementUpgradesPanel({settlement,request,onChanged}){
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
 return <div className="wa-upgrades">
  <div className="wa-upgrades-header"><div><h3>Settlement structures</h3><p>Manage defenses, homes and public works without drawing new map markers.</p></div><button type="button" className="wa-accent" onClick={()=>setDraft({...blank})}>+ Add structure</button></div>
  {error&&<p role="alert" className="wa-error">{error}</p>}{notice&&<p role="status" className="wa-notice">{notice}</p>}
  <div className="wa-upgrade-metrics">
    <div><small>Residents / housing</small><strong>{fmt(population)} / {fmt(cap)}</strong><span>{cap===0?'No housing: settlement cannot gain residents':Math.max(0,cap-population)+' vacant places'}</span></div>
    <div><small>Additional protection</small><strong>+{data.effects.defense_bonus}</strong><span>Operational defenses</span></div>
    <div><small>Additional services</small><strong>+{data.effects.service_bonus}</strong><span>Operational infrastructure</span></div>
  </div>
  <div className="wa-upgrade-grid">{data.upgrades.length?data.upgrades.map(u=><article className="wa-upgrade-card" key={u.id}>
   <header><span>{kinds.find(x=>x[0]===u.category)?.[1]||title(u.category)}</span><span className={'wa-upgrade-status is-'+u.status}>{title(u.status)}</span></header>
   <strong>{u.name}</strong><p>{u.notes||'No notes.'}</p>
   <div className="wa-upgrade-details"><span>Level {u.level}</span><span>Condition {u.condition_pct}%</span>{u.housing_bonus>0&&<span>+{fmt(u.housing_bonus)} places</span>}{u.service_bonus>0&&<span>+{u.service_bonus} services</span>}{u.defense_bonus>0&&<span>+{u.defense_bonus} defense</span>}</div>
   <footer><button type="button" onClick={()=>setDraft({...u})}>Manage</button><button type="button" disabled={busy} onClick={()=>{if(window.confirm('Delete '+u.name+'? Existing residents must remain housed.'))save('DELETE','/'+u.id,null,'Structure removed.')}}>Remove</button></footer>
  </article>):<p className="wa-empty">No structures recorded. Add housing, defensive walls or service buildings to develop this settlement.</p>}</div>
  {draft&&<div className="wa-upgrade-edit" role="region" aria-label="Structure editor">
   <div className="wa-upgrades-header"><h3>{draft.id?'Manage':'Add'} structure</h3><button type="button" onClick={()=>setDraft(null)}>Close</button></div>
   <form onSubmit={e=>{e.preventDefault();const b={...draft,level:Number(draft.level),condition_pct:Number(draft.condition_pct),housing_bonus:Number(draft.housing_bonus),service_bonus:Number(draft.service_bonus),defense_bonus:Number(draft.defense_bonus)};save(draft.id?'PUT':'POST',draft.id?'/'+draft.id:'',b,draft.id?'Structure updated.':'Structure added.')}} className="wa-fields">
    <label>Name<input required maxLength="120" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
    <label>Category<select value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value,housing_bonus:e.target.value==='housing'?10:0,defense_bonus:e.target.value==='defense'?10:0,service_bonus:['clinic','water','food_storage','insulation','public_works'].includes(e.target.value)?10:0})}>{kinds.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
    <label>State<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}>{states.map(x=><option key={x} value={x}>{title(x)}</option>)}</select></label>
    <label>Level<input type="number" required min="1" max="20" step="1" value={draft.level} onChange={e=>setDraft({...draft,level:e.target.value})}/></label>
    <label>Condition %<input type="number" required min="0" max="100" step="1" value={draft.condition_pct} onChange={e=>setDraft({...draft,condition_pct:e.target.value})}/></label>
    {draft.category==='housing'&&<label>Housing places<input type="number" required min="0" max="10000000" step="1" value={draft.housing_bonus} onChange={e=>setDraft({...draft,housing_bonus:e.target.value})}/></label>}
    {draft.category==='defense'&&<label>Defense improvement<input type="number" required min="0" max="100" step="1" value={draft.defense_bonus} onChange={e=>setDraft({...draft,defense_bonus:e.target.value})}/></label>}
    {['clinic','water','food_storage','insulation','public_works'].includes(draft.category)&&<label>Service improvement<input type="number" required min="0" max="100" step="1" value={draft.service_bonus} onChange={e=>setDraft({...draft,service_bonus:e.target.value})}/></label>}
    <label className="wide">Notes<input maxLength="500" value={draft.notes||''} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label>
    <div className="wide wa-upgrade-actions"><button type="button" onClick={()=>setDraft(null)}>Cancel</button><button className="wa-accent" type="submit" disabled={busy}>{busy?'Saving…':'Save structure'}</button></div>
   </form>
   <p className="wa-hint">Planned/building/destroyed structures provide no bonuses. Damaged structures provide reduced effects. Housing cannot be removed or downgraded below the current resident count.</p>
  </div>}
 </div>;
}
