import React,{useEffect,useState} from 'react';
import GestationDevelopment from './GestationDevelopment.jsx';
import FamilyCare from './FamilyCare.jsx';
import './character-reproduction.css';

const today=()=>new Date().toISOString().slice(0,10);
const initial=()=>({conception_opt_in:false,cycle_type:'heat',cycle_anchor:today(),cycle_days:30,base_chance:20,shared_with_command:false});
const phases=['dormant','onset','active','peak','recovery'];
const title=s=>String(s||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

export default function CharacterReproduction({character,request,readOnly=false,onPhaseChange,view='pregnancy'}){
 const [data,setData]=useState(null),[draft,setDraft]=useState(initial);
 const [pregnancy,setPregnancy]=useState({anchor:today(),start_day:0,total_days:90,notes:''});
 const [modal,setModal]=useState(null),[subview,setSubview]=useState('overview');
 const [eventDate,setEventDate]=useState(today()),[eventKey,setEventKey]=useState(null),[outcome,setOutcome]=useState(null);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [researchAccess,setResearchAccess]=useState(null),[researchBusy,setResearchBusy]=useState(false);
 const endpoint='/characters/'+character.id+'/reproduction';
 useEffect(()=>{let live=true;setResearchAccess(null);
  if(readOnly)return()=>{live=false};
  request('/characters/'+character.id+'/lineage-consent').then(r=>{if(live)setResearchAccess(Boolean(r.allow_research))}).catch(()=>{});
  return()=>{live=false};
 },[character.id,readOnly]);
 async function toggleResearch(){if(researchBusy||researchAccess===null)return;setResearchBusy(true);setError('');
  try{const next=!researchAccess;await request('/characters/'+character.id+'/lineage-consent',{method:'PUT',body:{allow_research:next}});setResearchAccess(next);setNotice(next?'Research linkage authorized.':'Research linkage withdrawn.');}
  catch(e){setError(e.message||'Unable to update research permission')}finally{setResearchBusy(false)}
 }
 async function load(){
  const result=await request(endpoint);
  setData(result);
  setDraft({...initial(),...result.profile,cycle_anchor:result.profile?.cycle_anchor||today()});
  onPhaseChange?.(result.cycle);
  return result;
 }
 useEffect(()=>{let live=true;setData(null);setError('');
  request(endpoint).then(result=>{if(!live)return;setData(result);setDraft({...initial(),...result.profile,cycle_anchor:result.profile?.cycle_anchor||today()});onPhaseChange?.(result.cycle)}).catch(e=>{if(live)setError(e.message||'Character record unavailable')});
  return()=>{live=false};
 },[character.id]);
 async function submit(action,method,body,message){
  setBusy(true);setError('');setNotice('');
  try{const result=await request(endpoint+'/'+action,{method,body});await load();setNotice(message);return result}
  catch(e){setError(e.message||'Unable to save record');return null}
  finally{setBusy(false)}
 }
 const profile=data?.profile||{},cycle=data?.cycle||{},progress=data?.pregnancy;
 const locked=readOnly||!data?.can_edit;
 const mayRegister=Boolean(data?.can_register_pregnancy);
 const commandLimited=Boolean(data?.command_view&&!data?.details_shared);
 const bound=Boolean(data?.character_bound);
 const settingsLabel=bound?'Cycle & conception settings':'Conception settings';
 const canRoll=Boolean(profile.conception_opt_in&&!locked&&profile.pregnancy_status!=='active');
 const adjustedChance=Math.min(100,Math.round(Number(profile.base_chance||20)*Number(cycle.multiplier||1)));
 async function roll(){
  const key=eventKey||crypto.randomUUID();setEventKey(key);
  const result=await submit('roll','POST',{event_key:key,ic_event_date:eventDate},'Conception event recorded.');
  if(result)setOutcome(result.roll);
  return result;
 }
 const close=()=>{if(!busy)setModal(null)};
 return <section className="repro-root">
  <header className="repro-head">
   <div><span><i className={'fa-solid '+(view==='cycle'?'fa-link':'fa-file-medical')} aria-hidden="true"/> {view==='cycle'?'ARCANE BINDING':'CHARACTER MEDICAL REGISTER'}</span>
    <h3>{view==='cycle'?'Binding cycle':'Pregnancy'}</h3>
    <p>{view==='cycle'?'Monthly collar and rune-brand resonance':'Pregnancy progression, medical records and conception history'}</p></div>
   <div className="repro-head-actions">
    {view==='pregnancy'&&profile.pregnancy_status==='active'&&<strong className="repro-active">Active</strong>}
    {!locked&&(view==='cycle'||!commandLimited)&&<button type="button" className="repro-manage" onClick={()=>setModal('settings')}><i className="fa-solid fa-sliders" aria-hidden="true"/> {settingsLabel}</button>}
   </div>
  </header>
  {error&&<p role="alert" className="repro-error">{error.replaceAll('_',' ')}</p>}
  {notice&&<p role="status" className="repro-success">{notice}</p>}
  {commandLimited&&<p className="repro-privacy"><i className="fa-solid fa-shield-halved" aria-hidden="true"/> Command overview: private case notes and conception details remain sealed.</p>}
  {!data?<p className="repro-empty">Opening character record…</p>:view==='cycle'?<div className="repro-panel">
   <div className="repro-compact-grid">
    <div className="repro-data"><span>Monthly phase</span><strong>{cycle.active?title(cycle.phase):'Inactive'}</strong><small>{cycle.active?'Day '+cycle.day+' / '+cycle.days:'No active brand resonance'}</small></div>
    <div className="repro-data"><span>Resonance</span><strong>{cycle.resonance||0}<small> / 100</small></strong><small>Official Bound Rank {cycle.rank||'—'}</small></div>
    <div className="repro-data"><span>Conception modifier</span><strong>×{Number(cycle.multiplier||1).toFixed(2)}</strong><small>Applied only to enabled conception rolls</small></div>
   </div>
   {cycle.active&&<div className="repro-phase-timeline" aria-label="Monthly cycle phases">{phases.map(p=><div key={p} className={cycle.phase===p?'current':''}><span/><small>{title(p)}</small></div>)}</div>}
   {cycle.alert&&<p className="repro-alert" role="status"><i className="fa-solid fa-bell" aria-hidden="true"/> {cycle.alert}</p>}
   <p className="repro-hint">This cycle follows the character's collar, rune-brand and official bound standing. It ends automatically when the binding ends.</p>
  </div>:<div className="repro-pregnancy">
    <nav className="repro-subnav" aria-label="Pregnancy sections">
     <button type="button" className={subview==='overview'?'selected':''} onClick={()=>setSubview('overview')} aria-pressed={subview==='overview'}><i className="fa-solid fa-clipboard-list" aria-hidden="true"/> Pregnancy record</button>
     <button type="button" className={subview==='events'?'selected':''} onClick={()=>setSubview('events')} aria-pressed={subview==='events'}><i className="fa-solid fa-dice" aria-hidden="true"/> Conception events</button>
     <button type="button" className={subview==='parenthood'?'selected':''} onClick={()=>setSubview('parenthood')} aria-pressed={subview==='parenthood'}><i className="fa-solid fa-hands-holding-child" aria-hidden="true"/> Parenthood & Care</button>
    </nav>
    {subview==='parenthood'&&<FamilyCare request={request} compact readOnly={readOnly}/>}
    {subview==='overview'&&<div className="repro-panel">
     {profile.pregnancy_status==='active'?<>
      <div className="repro-compact-grid">
       <div className="repro-data"><span>Pregnancy week</span><strong>{progress?.week||1}</strong><small>{progress?.days||0} IC days elapsed</small></div>
       <div className="repro-data"><span>Expected term</span><strong>{progress?.total_days||90}<small> days</small></strong><small>Customizable per storyline</small></div>
       <div className="repro-data"><span>Status</span><strong>{progress?.due?'Delivery pending':'Progressing'}</strong><small>{Math.max(0,(progress?.total_days||90)-(progress?.days||0))} IC days remaining</small></div>
      </div>
      <div className="repro-progress-block"><div><span>Progress</span><strong>{progress?.percent||0}%</strong></div><div className="repro-progress"><span style={{width:(progress?.percent||0)+'%'}}/></div></div>
      <GestationDevelopment days={progress?.days||0} totalDays={progress?.total_days||90}/>
      {profile.pregnancy_notes&&<div className="repro-case-notes"><span>Story notes</span><p>{profile.pregnancy_notes}</p></div>}
      {!locked&&<div className="repro-actions"><span>Record an agreed story outcome when the plot reaches that stage.</span><button type="button" onClick={()=>{if(window.confirm('Record this pregnancy as completed?'))void submit('complete','POST',{status:'completed'},'Delivery recorded.')}} disabled={busy}>Record delivery</button><button type="button" className="repro-danger" onClick={()=>{if(window.confirm('End this pregnancy record?'))void submit('complete','POST',{status:'ended'},'Pregnancy record ended.')}} disabled={busy}>End record</button></div>}
     </>:<div className="repro-empty-action"><div className="repro-empty-symbol"><i className="fa-solid fa-file-medical" aria-hidden="true"/></div><div><h4>{profile.pregnancy_status==='none'?'No pregnancy on record':'Previous pregnancy '+title(profile.pregnancy_status)}</h4><p>Register an established IC pregnancy. New records default to a three-month (90 IC day) term.</p>{bound&&!mayRegister&&<p className="repro-hint">Pregnancy registration for bound characters is managed by authorized Order staff.</p>}</div>{mayRegister&&<button type="button" className="repro-primary" onClick={()=>{setPregnancy({anchor:today(),start_day:0,total_days:90,notes:''});setModal('pregnancy')}}><i className="fa-solid fa-plus" aria-hidden="true"/> Register pregnancy</button>}</div>}
     {!locked&&researchAccess!==null&&<div className="repro-research-access"><div><strong><i className="fa-solid fa-microscope" aria-hidden="true"/> Imperial Lineage research</strong><p>Allow authorized research staff to link this character's record to a research case. You can withdraw permission at any time.</p></div><button type="button" disabled={researchBusy} onClick={toggleResearch}>{researchAccess?'Withdraw research access':'Authorize research link'}</button></div>}
     {!commandLimited&&<div className="repro-history"><h4>Story history</h4>{(data.history||[]).length?(data.history||[]).map((h,i)=><div key={i}><span>{String(h.created_at||'').slice(0,10)} · {title(h.action)}</span><strong>{h.summary}</strong></div>):<p>No previous changes recorded.</p>}</div>}
    </div>}
    {subview==='events'&&<div className="repro-panel">
      {commandLimited?<p className="repro-privacy">Conception-roll history is restricted to the character owner.</p>:<>
       <div className="repro-event-toolbar"><div className="repro-data"><span>Current chance</span><strong>{adjustedChance}%</strong><small>{bound&&cycle.active?title(cycle.phase)+' · Rank '+cycle.rank:'Base chance · No binding modifier'}</small></div><div><p>Saved D100 events cannot be rerolled. Each IC day can have one recorded event.</p><button className="repro-primary" type="button" disabled={!canRoll||busy} onClick={()=>setModal('roll')}><i className="fa-solid fa-dice-d20" aria-hidden="true"/> New conception event</button>{!profile.conception_opt_in&&<small>Enable conception rolls in the settings to use this action.</small>}</div></div>
       {outcome&&<div className="repro-result" role="status">Roll {outcome.roll_d100} · Chance {outcome.chance}% · {outcome.success?'Pregnancy established':'No pregnancy established'}</div>}
       <div className="repro-history"><h4>Recorded events</h4>{(data.rolls||[]).length?(data.rolls||[]).map(r=><div key={r.id}><span>{String(r.ic_event_date).slice(0,10)} · {title(r.cycle_phase)}</span><strong>D100: {r.roll_d100} / {r.chance} · {r.success?'Established':'Not established'}</strong></div>):<p>No conception events recorded.</p>}</div>
      </>}
    </div>}
   </div>}
  {modal&&<div className="repro-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
   <section className="repro-modal" role="dialog" aria-modal="true" aria-label={modal==='settings'?settingsLabel:modal==='pregnancy'?'Register pregnancy':'Record conception event'}>
    <header><div><small>{modal==='settings'?'CHARACTER CONFIGURATION':modal==='pregnancy'?'PREGNANCY REGISTRATION':'CONCEPTION RECORD'}</small><h3>{modal==='settings'?settingsLabel:modal==='pregnancy'?'Register pregnancy':'New conception event'}</h3><p>{modal==='settings'?'Conception rolls are optional and separate from binding status.':modal==='pregnancy'?'Record the agreed dates for an existing IC storyline.':'One confirmed D100 outcome per IC date.'}</p></div><button type="button" disabled={busy} onClick={close} aria-label="Close dialog"><i className="fa-solid fa-xmark"/></button></header>
    {modal==='settings'&&<form onSubmit={async e=>{e.preventDefault();const saved=await submit('settings','PUT',{...draft,cycle_days:Number(draft.cycle_days),base_chance:Number(draft.base_chance)},'Settings saved.');if(saved)setModal(null)}}>
     <div className="repro-fields">
      {bound&&<><label>Cycle style<select disabled={busy} value={draft.cycle_type} onChange={e=>setDraft({...draft,cycle_type:e.target.value})}><option value="heat">Heat</option><option value="rut">Rut</option></select></label><label>Cycle anchor<input type="date" required disabled={busy} value={draft.cycle_anchor||today()} onChange={e=>setDraft({...draft,cycle_anchor:e.target.value})}/></label><label>Duration (IC days)<input type="number" required min="20" max="90" disabled={busy} value={draft.cycle_days} onChange={e=>setDraft({...draft,cycle_days:e.target.value})}/></label></>}
      <label>Base D100 chance (%)<input type="number" required min="0" max="100" disabled={busy} value={draft.base_chance} onChange={e=>setDraft({...draft,base_chance:e.target.value})}/></label>
      <label className="repro-check"><input type="checkbox" checked={!!draft.conception_opt_in} disabled={busy} onChange={e=>setDraft({...draft,conception_opt_in:e.target.checked})}/> Allow conception rolls</label>
      <label className="repro-check"><input type="checkbox" checked={!!draft.shared_with_command} disabled={busy} onChange={e=>setDraft({...draft,shared_with_command:e.target.checked})}/> Share private notes and roll details with Command</label>
     </div>
     <footer><span>{bound?'Binding cycle follows the official rank automatically.':'Conception settings are available to non-bound characters.'}</span><div><button type="button" disabled={busy} onClick={close}>Cancel</button><button className="repro-primary" type="submit" disabled={busy}>Save settings</button></div></footer>
    </form>}
    {modal==='pregnancy'&&mayRegister&&<form onSubmit={async e=>{e.preventDefault();const saved=await submit('pregnancy','POST',{...pregnancy,start_day:Number(pregnancy.start_day),total_days:Number(pregnancy.total_days)},'Pregnancy registered.');if(saved)setModal(null)}}>
     <div className="repro-fields"><label>Timeline anchor<input type="date" required disabled={busy||!mayRegister} value={pregnancy.anchor} onChange={e=>setPregnancy({...pregnancy,anchor:e.target.value})}/></label><label>Elapsed IC days<input type="number" required min="0" max="600" disabled={busy||!mayRegister} value={pregnancy.start_day} onChange={e=>setPregnancy({...pregnancy,start_day:e.target.value})}/></label><label>Term (IC days)<input type="number" required min="20" max="600" disabled={busy||!mayRegister} value={pregnancy.total_days} onChange={e=>setPregnancy({...pregnancy,total_days:e.target.value})}/></label><label className="wide">Story notes<textarea rows={3} maxLength={1500} disabled={busy||!mayRegister} value={pregnancy.notes} onChange={e=>setPregnancy({...pregnancy,notes:e.target.value})}/></label></div>
     <footer><span>Existing pregnancy histories are preserved.</span><div><button type="button" disabled={busy} onClick={close}>Cancel</button><button className="repro-primary" type="submit" disabled={busy||!mayRegister}>Register pregnancy</button></div></footer>
    </form>}
    {modal==='roll'&&<form onSubmit={async e=>{e.preventDefault();const result=await roll();if(result)setModal(null)}}>
     <div className="repro-fields"><label>IC event date<input type="date" required disabled={busy} value={eventDate} onChange={e=>{setEventDate(e.target.value);setEventKey(null)}}/></label><div className="repro-data"><span>Chance for this event</span><strong>{adjustedChance}%</strong><small>Saved permanently after confirmation</small></div></div>
     <footer><span>Review the date before recording the result.</span><div><button type="button" disabled={busy} onClick={close}>Cancel</button><button className="repro-primary" type="submit" disabled={busy}>Roll D100</button></div></footer>
    </form>}
   </section>
  </div>}
 </section>;
}
