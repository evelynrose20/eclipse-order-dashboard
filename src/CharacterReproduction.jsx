import React,{useEffect,useState} from 'react';
import './character-reproduction.css';

const today=()=>new Date().toISOString().slice(0,10);
const fresh=()=>({conception_opt_in:false,cycle_type:'heat',cycle_anchor:today(),cycle_days:30,base_chance:20,shared_with_command:false});
const phases=['dormant','onset','active','peak','recovery'];
const nice=s=>String(s||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

export default function CharacterReproduction({character,request,readOnly=false,onPhaseChange}){
 const [data,setData]=useState(null),[draft,setDraft]=useState(fresh),[page,setPage]=useState('cycle'),[editing,setEditing]=useState(false);
 const [pregnancy,setPregnancy]=useState({anchor:today(),start_day:0,total_days:280,notes:''});
 const [eventDate,setEventDate]=useState(today()),[eventKey,setEventKey]=useState(null),[outcome,setOutcome]=useState(null);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const endpoint='/characters/'+character.id+'/reproduction';
 async function load(){
  const result=await request(endpoint);
  setData(result);
  setDraft({...fresh(),...result.profile,cycle_anchor:result.profile?.cycle_anchor||today()});
  onPhaseChange?.(result.cycle);
 }
 useEffect(()=>{setData(null);setError('');load().catch(e=>setError(e.message||'Unable to open personal record'))},[character.id]);
 async function submit(action,method,body,message){
  setBusy(true);setError('');setNotice('');
  try{
   const result=await request(endpoint+'/'+action,{method,body});
   await load();setNotice(message);
   return result;
  }catch(e){setError(e.message||'The record could not be saved');return null}
  finally{setBusy(false)}
 }
 const profile=data?.profile,cycle=data?.cycle,progress=data?.pregnancy;
 const locked=!data?.can_edit||readOnly;
 async function roll(){
  const key=eventKey||crypto.randomUUID();
  setEventKey(key);
  const r=await submit('roll','POST',{event_key:key,ic_event_date:eventDate},'Conception event recorded.');
  if(r)setOutcome(r.roll);
 }
 const disable=busy||locked;
 const commandLimited=Boolean(data?.command_view&&!data?.details_shared);
 return <div className="repro-root">
  <div className="repro-head"><div><span><i className="fa-solid fa-file-medical" aria-hidden="true"/> ORDER CHARACTER RECORD</span><h3>Pregnancy & Parenthood</h3><p>Monthly resonance and character story records</p></div><div className="repro-head-actions">{profile?.pregnancy_status==='active'&&<strong className="repro-active">Pregnancy active</strong>}{!locked&&<button type="button" className="repro-manage" onClick={()=>setEditing(true)}><i className="fa-solid fa-sliders" aria-hidden="true"/> Cycle settings</button>}</div></div>
  {commandLimited&&<p className="repro-privacy"><i className="fa-solid fa-shield-halved" aria-hidden="true"/> Command may review current IC status. Private notes and detailed conception history remain sealed unless shared by their owner.</p>}
  {error&&<p role="alert" className="repro-error">{error.replaceAll('_',' ')}</p>}{notice&&<p role="status" className="repro-success">{notice}</p>}
  <div className="repro-tabs">{[['cycle','Binding cycle'],['pregnancy','Pregnancy'],['rolls','Conception events']].map(([id,name])=><button key={id} type="button" aria-pressed={page===id} className={page===id?'selected':''} onClick={()=>setPage(id)}>{name}</button>)}</div>
  {!data?<p className="repro-empty">Opening character record…</p>:<>
   {page==='cycle'&&<section className="repro-panel">
    <div className="repro-state">
     <div><small>Monthly binding</small><strong>{cycle.active?nice(cycle.phase):'Inactive'}</strong><span>{cycle.active?'Day '+cycle.day+' of '+cycle.days+' · Bound Rank '+cycle.rank:'Not currently active'}</span></div>
     <div><small>Brand resonance</small><strong>{cycle.resonance} / 100</strong><span>Fictional conception ×{cycle.multiplier.toFixed(2)}</span></div>
    </div>
    {cycle.active&&<><div className="repro-phase-bar" aria-label="Monthly phase">{phases.map(p=><span key={p} className={cycle.phase===p?'current':''} title={nice(p)}/>)}</div>{cycle.alert&&<p className="repro-alert" role="status"><i className="fa-solid fa-bell" aria-hidden="true"/> {cycle.alert}</p>}</>}
    <div className="repro-cycle-footer"><div className="repro-cycle-caption"><i className="fa-solid fa-link" aria-hidden="true"/> Monthly cycles are part of active collar and brand bindings. Strength follows the official Bound Rank.</div><strong>{cycle.active?nice(profile.cycle_type||'heat')+' cycle':'No active binding'}</strong></div>
   </section>}
   {page==='pregnancy'&&<section className="repro-panel">
    {profile.pregnancy_status==='active'?<>
     <div className="repro-state"><div><small>Current stage</small><strong>Week {progress?.week||1}</strong><span>{progress?.days||0} of {progress?.total_days} IC days</span></div><div><small>Expected milestone</small><strong>{progress?.due?'Delivery pending':'Pregnancy active'}</strong><span>Based on the saved story timeline</span></div></div>
     <div className="repro-progress"><span style={{width:(progress?.percent||0)+'%'}}/></div>
     {profile.pregnancy_notes&&<p className="repro-notes">{profile.pregnancy_notes}</p>}
     <div className="repro-actions"><span>Completing or ending a record does not roll an outcome.</span><button type="button" disabled={disable} onClick={()=>{if(window.confirm('Mark this pregnancy as completed?'))void submit('complete','POST',{status:'completed'},'Pregnancy completed.')}}>Record delivery</button><button type="button" disabled={disable} onClick={()=>{if(window.confirm('End this pregnancy record?'))void submit('complete','POST',{status:'ended'},'Record ended.')}}>End record</button></div>
    </>:<>
      <p className="repro-hint">Register an existing IC pregnancy without a conception roll. The date and elapsed days follow your agreed storyline.</p>
      <form onSubmit={e=>{e.preventDefault();void submit('pregnancy','POST',{...pregnancy,start_day:Number(pregnancy.start_day),total_days:Number(pregnancy.total_days)},'Existing pregnancy recorded.')}}>
      <div className="repro-fields"><label>Timeline anchor<input type="date" required disabled={disable} value={pregnancy.anchor} onChange={e=>setPregnancy({...pregnancy,anchor:e.target.value})}/></label><label>Already elapsed (IC days)<input type="number" required min="0" max="600" disabled={disable} value={pregnancy.start_day} onChange={e=>setPregnancy({...pregnancy,start_day:e.target.value})}/></label><label>Term (IC days)<input type="number" required min="20" max="600" disabled={disable} value={pregnancy.total_days} onChange={e=>setPregnancy({...pregnancy,total_days:e.target.value})}/></label><label className="wide">Private storyline notes<textarea maxLength={1500} rows={3} disabled={disable} value={pregnancy.notes} onChange={e=>setPregnancy({...pregnancy,notes:e.target.value})}/></label></div>
      <div className="repro-actions"><span>Only the character owner can register this record.</span><button type="submit" disabled={disable}>Register pregnancy</button></div>
      </form>
    </>}
    {profile.pregnancy_status!=='none'&&<p className="repro-hint">Record status: {nice(profile.pregnancy_status)}</p>}
    {!commandLimited&&<div className="repro-history"><h4>Story history</h4>{(data.history||[]).length?(data.history||[]).map((h,i)=><div key={i}><span>{String(h.created_at||'').slice(0,10)} · {nice(h.action)}</span><strong>{h.summary}</strong></div> ):<p>No previous changes recorded.</p>}</div>}
   </section>}
   {page==='rolls'&&(commandLimited?<section className="repro-panel"><p className="repro-privacy">Detailed conception history is restricted to the character owner.</p></section>:<section className="repro-panel"><p className="repro-hint">Each consented event is resolved once with a stored D100 result. This is a fictional story rule, not a medical prediction.</p>
    <div className="repro-fields"><label>IC event date<input type="date" disabled={disable||!!outcome} value={eventDate} onChange={e=>{setEventDate(e.target.value);setEventKey(null)}}/></label><div className="repro-calculation"><small>Current chance</small><strong>{Math.min(100,Math.round(Number(profile.base_chance)*cycle.multiplier))}%</strong><small>{cycle.active?nice(cycle.phase)+' · Rank '+cycle.rank:'Normal cycle'}</small></div></div>
    <div className="repro-actions"><span>{profile.conception_opt_in?'Conception rolls permitted':'Enable conception rolls in Cycle settings first.'}</span><button type="button" disabled={disable||!profile.conception_opt_in||profile.pregnancy_status==='active'||!!outcome} onClick={roll}>Roll D100</button></div>
    {outcome&&<div className="repro-result" role="status"><strong>Roll {outcome.roll_d100} · Threshold {outcome.chance}</strong><span>{outcome.success?'Pregnancy established':'No pregnancy established'}</span></div>}
    {outcome&&<button type="button" className="repro-reset" onClick={()=>{setEventKey(null);setOutcome(null)}}>Prepare another IC event</button>}
    <div className="repro-history"><h4>Recorded events</h4>{(data.rolls||[]).length?(data.rolls||[]).map(r=><div key={r.id}><span>{String(r.ic_event_date).slice(0,10)} · {r.cycle_phase}</span><strong>{r.roll_d100} / {r.chance} · {r.success?'Established':'Not established'}</strong></div>):<p>No conception events recorded.</p>}</div>
   </section>)}
  </>}
  {editing&&!locked&&<div className="repro-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.currentTarget===e.target)setEditing(false)}}>
   <section className="repro-modal" role="dialog" aria-modal="true" aria-label="Manage monthly binding cycle">
    <header><div><small>COLLAR & BRAND ADMINISTRATION</small><h3>Cycle settings</h3><p>Monthly binding is automatic while the character remains bound. Configure only the calendar and optional conception rolls.</p></div><button type="button" aria-label="Close cycle settings" disabled={busy} onClick={()=>setEditing(false)}><i className="fa-solid fa-xmark"/></button></header>
    <form onSubmit={async e=>{e.preventDefault();const saved=await submit('settings','PUT',{...draft,cycle_days:Number(draft.cycle_days),base_chance:Number(draft.base_chance)},'Cycle preferences saved.');if(saved)setEditing(false)}}>
     <div className="repro-fields">
      <label>Cycle style<select disabled={busy} value={draft.cycle_type} onChange={e=>setDraft({...draft,cycle_type:e.target.value})}><option value="heat">Heat</option><option value="rut">Rut</option></select></label>
      <label>Cycle anchor<input type="date" required disabled={busy} value={draft.cycle_anchor||today()} onChange={e=>setDraft({...draft,cycle_anchor:e.target.value})}/></label>
      <label>Duration in days<input type="number" required min="20" max="90" disabled={busy} value={draft.cycle_days} onChange={e=>setDraft({...draft,cycle_days:e.target.value})}/></label>
      <label>Base D100 chance (%)<input type="number" required min="0" max="100" disabled={busy} value={draft.base_chance} onChange={e=>setDraft({...draft,base_chance:e.target.value})}/></label>
      <label className="repro-check"><input type="checkbox" disabled={busy} checked={!!draft.conception_opt_in} onChange={e=>setDraft({...draft,conception_opt_in:e.target.checked})}/> Allow pregnancy outcome rolls</label>
      <label className="repro-check"><input type="checkbox" disabled={busy} checked={!!draft.shared_with_command} onChange={e=>setDraft({...draft,shared_with_command:e.target.checked})}/> Share private notes and roll details with Command</label>
     </div>
     <footer><span>IC cycle status is visible to Command. Personal details remain sealed unless shared.</span><div><button type="button" disabled={busy} onClick={()=>setEditing(false)}>Cancel</button><button type="submit" disabled={busy}>{busy?'Saving…':'Save settings'}</button></div></footer>
    </form>
   </section>
  </div>}
 </div>;
}
