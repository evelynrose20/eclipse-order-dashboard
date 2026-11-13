import React,{useEffect,useState} from 'react';
import LineageViews from './LineageViews.jsx';
import './imperial-lineage.css';

export default function LineageParticipant({request,readOnly=false}){
 const [records,setRecords]=useState(null),[error,setError]=useState(''),[tab,setTab]=useState('cases');
 const [character,setCharacter]=useState('');
 const [conception,setConception]=useState(null),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[busy,setBusy]=useState(false);
 const [outcome,setOutcome]=useState('');
 async function submitConception(e){
  e.preventDefault();
  if(!conception||busy)return;
  setBusy(true);setError('');setOutcome('');
  try{
   const result=await request('/characters/'+conception.character_id+'/reproduction/roll',{
    method:'POST',body:{event_key:conception.eventKey,ic_event_date:date,lineage_case_id:conception.id}
   });
   setOutcome(result.roll?.success?'Lineage conception succeeded. A pregnancy is now recorded.':'Conception did not occur. The D100 result is saved.');
   setConception(null);await load();
  }catch(e){setError(e.message||'Could not record the conception event')}
  finally{setBusy(false)}
 }
 async function load(){
  const result=await request('/thralls/lineage/my');
  setRecords(result.cases||[]);
 }
 useEffect(()=>{let mounted=true;request('/thralls/lineage/my').then(result=>{
   if(mounted)setRecords(result.cases||[]);
  }).catch(e=>{if(mounted)setError(e.message||'Unable to open lineage records')});
  return()=>{mounted=false};
 },[]);
 const ids=[...new Map((records||[]).map(x=>[x.character_id,x.character_name])).entries()];
 const current=character||ids[0]?.[0]||'';
 const cases=(records||[]).filter(x=>x.character_id===current);
 return <section className="lineage-command">
  <div className="lineage-command-head"><div><span>PERSONAL · IMPERIAL LINEAGE RECORD</span><h2>Imperial Lineage Project</h2><p>Review your recorded traits, linked gestation studies and lineage parenthood findings.</p></div>
  {records&&<button type="button" onClick={()=>load().catch(e=>setError(e.message))}><i className="fa-solid fa-rotate" aria-hidden="true"/> Refresh</button>}</div>
  {error&&<p role="alert" className="lineage-error">{error.replaceAll('_',' ')}</p>}
  {outcome&&<p role="status" className="lineage-notice">{outcome}</p>}
  {records===null?<p className="lineage-empty">Opening personal lineage records…</p>:records.length===0?
   <><div className="lineage-empty">There are no research cases linked to your character yet. The character owner can authorize or withdraw research access in their Pregnancy section.</div><LineageViews cases={[]} tab={tab} onTab={setTab}/></>:
   <><div className="lineage-participant-head"><label>Character<select value={current} onChange={e=>{setCharacter(e.target.value);setTab('cases')}}>{ids.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
    <p>{readOnly?'Player preview — records cannot be changed.':'These are your own authorized records. Private staff research and other characters are not visible.'}</p></div>
    <LineageViews cases={cases} tab={tab} onTab={setTab} onConceive={readOnly?null:entry=>{setOutcome('');setConception({...entry,eventKey:crypto.randomUUID()})}}/></>}
  {conception&&<div className="lineage-modal-mask" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setConception(null)}}><section className="lineage-modal" role="dialog" aria-modal="true" aria-label="Record lineage conception">
     <header><h3>Lineage conception · {conception.designation}</h3><button type="button" disabled={busy} onClick={()=>setConception(null)} aria-label="Close"><i className="fa-solid fa-xmark"/></button></header>
     <form className="lineage-form" onSubmit={submitConception}>
      <p className="lineage-hint full">This uses the same consent-controlled D100 rules as ordinary conception, but records the event against this lineage research case. Your character must have conception participation enabled in their private Pregnancy settings. A successful roll starts the existing pregnancy timeline rather than a second pregnancy.</p>
      <label className="full">In-character event date<input type="date" required value={date} onChange={e=>{setDate(e.target.value);setConception({...conception,eventKey:crypto.randomUUID()})}} disabled={busy}/></label>
      <footer><button type="button" disabled={busy} onClick={()=>setConception(null)}>Cancel</button><button type="submit" disabled={busy}>{busy?'Recording…':'Roll D100'}</button></footer>
     </form>
    </section></div>}
 </section>;
}
