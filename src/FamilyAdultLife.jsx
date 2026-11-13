import React,{useEffect,useState} from 'react';

const sentence=x=>String(x||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
export default function FamilyAdultLife({request,lineageCaseId=null,staff=false,readOnly=false,refreshKey=0}){
 const [adults,setAdults]=useState([]),[registry,setRegistry]=useState([]),[facilities,setFacilities]=useState([]);
 const [selected,setSelected]=useState(null),[draft,setDraft]=useState(null),[error,setError]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[admin,setAdmin]=useState(false);
 useEffect(()=>{let alive=true;request('/family/adults').then(r=>{if(alive)setAdults(r.adults||[])}).catch(e=>{if(alive)setError(e.message)});return()=>{alive=false}},[request,refreshKey]);
 const refresh=async()=>{const r=await request('/family/adults');setAdults(r.adults||[]);if(admin&&staff){const a=await request('/family/adults/registry');setRegistry(a.adults||[])}};
 const shown=(admin?registry:adults).filter(a=>lineageCaseId===null||Number(a.lineage_case_id)===Number(lineageCaseId));
 async function openRegistry(){
  try{
   const [r,w]=await Promise.all([request('/family/adults/registry'),request('/family/workplaces')]);
   setRegistry(r.adults||[]);setFacilities(w.workplaces||[]);setAdmin(true);setError('');
  }catch(e){setError(e.message||'Unable to load civilian registry')}
 }
 function edit(adult){
  setSelected(adult);setDraft({settlement_id:String(adult.settlement_id),workplace_facility_id:adult.workplace_facility_id?String(adult.workplace_facility_id):'',
   employment_state:adult.employment_state,wellbeing:adult.wellbeing,public_update:adult.public_update||''});
 }
 async function save(e){
  e.preventDefault();
  if(!selected||busy)return;
  setBusy(true);setError('');setNote('');
  try{
   await request('/family/adults/'+selected.id,{method:'PUT',body:{
    settlement_id:Number(draft.settlement_id),
    workplace_facility_id:draft.workplace_facility_id?Number(draft.workplace_facility_id):null,
    employment_state:draft.employment_state,wellbeing:draft.wellbeing,public_update:draft.public_update
   }});
   setSelected(null);setDraft(null);await refresh();setNote('Civilian status updated.');
  }catch(err){setError(err.message||'Could not update civilian')}
  finally{setBusy(false)}
 }
 return <section className="family-adult-life">
   <div className="family-adult-head"><div><span>FAMILY CONNECTIONS</span><h4>Adult civilian lives</h4><p>After adulthood, family members can keep up with settlement life and work without managing daily childcare.</p></div>
   {staff&&!readOnly&&<button type="button" onClick={()=>admin?setAdmin(false):openRegistry()}>{admin?'My family':'Staff civilian registry'}</button>}</div>
   {error&&<p role="alert" className="lineage-error">{error.replaceAll('_',' ')}</p>}
   {note&&<p role="status" className="lineage-notice">{note}</p>}
   {!shown.length?<p className="family-hint">{admin?'No tracked civilians in this registry.':'No dependents have transitioned to adulthood yet.'}</p>:<div className="family-adult-grid">{shown.map(person=><article key={person.id}>
     <div className="family-adult-top"><div><small>REGISTERED CIVILIAN</small><h4>{person.name}</h4></div><span>{sentence(person.wellbeing)}</span></div>
     <div className="family-info-pair"><span>Residence</span><strong>{person.settlement_name}</strong></div>
     <div className="family-info-pair"><span>Employment</span><strong>{sentence(person.employment_state)}</strong></div>
     <div className="family-info-pair"><span>Workplace</span><strong>{person.workplace_name||'Not assigned'}</strong></div>
     <p>{person.public_update||'No recent civilian update recorded.'}</p>
     <small>Last update: {new Date(person.updated_at).toLocaleDateString()}</small>
     {staff&&!readOnly&&<button type="button" onClick={()=>edit(person)}>Update civilian status</button>}
   </article>)}</div>}
   {selected&&draft&&<div className="lineage-modal-mask" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setSelected(null)}}><section className="lineage-modal" role="dialog" aria-modal="true" aria-label="Update civilian status">
    <header><h3>{selected.name} · Civilian update</h3><button type="button" onClick={()=>setSelected(null)} disabled={busy} aria-label="Close"><i className="fa-solid fa-xmark"/></button></header>
    <form className="lineage-form" onSubmit={save}>
     <label>Employment<select value={draft.employment_state} onChange={e=>setDraft({...draft,employment_state:e.target.value,workplace_facility_id:e.target.value==='employed'?draft.workplace_facility_id:''})}>
      {['seeking','employed','between_jobs','retired'].map(x=><option key={x} value={x}>{sentence(x)}</option>)}</select></label>
     <label>Well-being<select value={draft.wellbeing} onChange={e=>setDraft({...draft,wellbeing:e.target.value})}>{['settled','adjusting','needs_support'].map(x=><option key={x} value={x}>{sentence(x)}</option>)}</select></label>
     <label className="full">Operational workplace<select value={draft.workplace_facility_id} disabled={draft.employment_state!=='employed'} onChange={e=>setDraft({...draft,workplace_facility_id:e.target.value})}><option value="">Not assigned</option>{facilities.filter(f=>Number(f.settlement_id)===Number(draft.settlement_id)).map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
     <label className="full">Public family update<textarea maxLength={500} value={draft.public_update} onChange={e=>setDraft({...draft,public_update:e.target.value})}/></label>
     <p className="family-hint full">Jobs can only reference operating facilities in the current settlement. Changing civilian status does not award wages, create a new facility job, or alter settlement population totals.</p>
     <footer><button type="button" onClick={()=>setSelected(null)}>Cancel</button><button type="submit" disabled={busy||draft.employment_state==='employed'&&!draft.workplace_facility_id}>{busy?'Saving…':'Save update'}</button></footer>
    </form>
   </section></div>}
  </section>;
}
