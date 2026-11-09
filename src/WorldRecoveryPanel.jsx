import React,{useCallback,useEffect,useState} from 'react';
import './world-diplomacy.css';
// A small, separate approval queue for claiming already-authored unclaimed
// locations. No war needed, and staff still control each transfer.
export default function WorldRecoveryPanel({request,factions=[],settlements=[],onChanged}){
 const [data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [draft,setDraft]=useState({claimant_id:'',settlement_id:'',rationale:''});
 const [notes,setNotes]=useState({}),[overrides,setOverrides]=useState({});
 const load=useCallback(async()=>setData(await request('/world-admin/recovery')),[request]);
 useEffect(()=>{load().catch(e=>setError(e.message||'Unable to load recovery claims'))},[load]);
 const act=async(path,body,message)=>{
  if(busy)return;
  setBusy(true);setError('');setNotice('');
  try{
   const result=await request('/world-admin/recovery'+path,{method:'POST',body});
   await load();if(result.ownership_changed)await onChanged?.();
   setNotice(message);return result;
  }catch(e){setError(e.message||'Recovery claim could not be processed')}
  finally{setBusy(false)}
 };
 const available=settlements.filter(s=>!s.controlling_faction_id);
 const choices=factions.filter(f=>f.id!=='eclipse-order'&&['world','settlement','order_story'].includes(f.faction_scope));
 const pending=data?.claims?.filter(c=>['pending','postponed'].includes(c.status))||[];
 const reviewed=data?.claims?.filter(c=>!['pending','postponed'].includes(c.status))||[];
 return <section className="wdi-section wdi-recovery">
  <div className="wdi-section-head"><div><span className="wdi-eyebrow">PRESET LOCATION RECOVERY</span><h4>Reconstruction & takeover requests</h4><p>NPC factions may request to restore a nearby unclaimed ruin. Nothing is claimed until you approve it. Destroyed or abandoned sites become <strong>Rebuilding</strong>, keeping their existing industrial and civilian records. Places already controlled by another faction require the conflict approval system instead.</p></div><button type="button" disabled={busy} onClick={()=>void act('/assess',{},'Existing unclaimed ruins assessed. New eligible proposals added for review.')}>Assess recovery opportunities</button></div>
  {error&&<p className="wdi-error" role="alert">{error}</p>}{notice&&<p className="wdi-notice" role="status">{notice}</p>}
  {!data?<p className="wdi-empty">Loading recovery proposals…</p>:<>
   {!pending.length?<p className="wdi-empty">No pending reconstruction requests. NPC-controlled holdings can suggest nearby unclaimed ruins during their simulation cycles.</p>:<div className="wdi-proposal-list">{pending.map(c=><article className="wdi-proposal" key={c.id}>
    <div className="wdi-proposal-title"><strong>{c.claimant_name} requests {c.settlement_name}</strong><small>{c.strategic_state?.toUpperCase()} · {c.source_kind==='npc_assessment'?'NPC proposal':'Staff proposal'} · #{c.id}</small></div>
    <p>{c.rationale}</p>
    <label>Decision note<textarea maxLength={1500} rows={2} value={notes[c.id]||''} onChange={e=>setNotes(v=>({...v,[c.id]:e.target.value}))}/></label>
    <label className="wdi-check"><input type="checkbox" checked={!!overrides[c.id]} onChange={e=>setOverrides(v=>({...v,[c.id]:e.target.checked}))}/> Explicitly override plot protection, if this site is protected</label>
    <div className="wdi-actions">{['approve','postpone','reject','rp_event'].map(decision=><button type="button" key={decision} disabled={busy} className={decision==='approve'?'wdi-approve':decision==='reject'?'wdi-reject':''} onClick={()=>void act('/claims/'+c.id+'/review',{decision,note:notes[c.id]||'',override_plot_protection:!!overrides[c.id]},decision==='approve'?'Claim approved; the location is now controlled by the claimant.': 'Recovery decision recorded.')}>{decision==='rp_event'?'Convert to RP event':decision.charAt(0).toUpperCase()+decision.slice(1)}</button>)}</div>
   </article>)}</div>}
   <details><summary>Propose the recovery of an unclaimed location</summary>
    <form className="wdi-form" onSubmit={e=>{e.preventDefault();void act('/claims',{...draft,settlement_id:Number(draft.settlement_id)},'Recovery claim added to your approval queue.')}}>
     <label>Claimant faction<select value={draft.claimant_id} required onChange={e=>setDraft(v=>({...v,claimant_id:e.target.value}))}><option value="">Choose NPC faction</option>{choices.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
     <label>Unclaimed preset location<select value={draft.settlement_id} required onChange={e=>setDraft(v=>({...v,settlement_id:e.target.value}))}><option value="">Choose location</option>{available.map(s=><option key={s.id} value={s.id}>{s.name} · {s.strategic_state}</option>)}</select></label>
     <label className="wdi-wide">Reason for the proposed claim<textarea required maxLength={1500} rows={2} value={draft.rationale} onChange={e=>setDraft(v=>({...v,rationale:e.target.value}))}/></label>
     <button type="submit" disabled={busy||!draft.claimant_id||!draft.settlement_id||!draft.rationale.trim()}>Submit for approval</button>
    </form>
   </details>
   {reviewed.length>0&&<details><summary>Previously reviewed recovery requests ({reviewed.length})</summary><div className="wdi-relation-list">{reviewed.map(c=><div key={c.id}><strong>{c.claimant_name} · {c.settlement_name}</strong><span>{c.status} · {c.review_note||'No note'}</span></div>)}</div></details>}
  </>}
 </section>;
}
