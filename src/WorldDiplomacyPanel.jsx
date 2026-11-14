import React,{useCallback,useEffect,useState} from 'react';
import './world-diplomacy.css';
import WorldRecoveryPanel from './WorldRecoveryPanel.jsx';
const clean=s=>String(s||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const NONE='';
export default function WorldDiplomacyPanel({request,factions=[],settlements=[],onChanged}){
 const [data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [view,setView]=useState('inbox');
 const [relationship,setRelationship]=useState({faction_a:'',faction_b:'',tension:50,trust:50});
 const [proposal,setProposal]=useState({attacker_id:'',defender_id:'',target_settlement_id:'',conflict_kind:'border_dispute',rationale:'',proposed_effect:''});
 const [protection,setProtection]=useState({settlement_id:'',protection:'major_changes',explanation:''});
 const [outcome,setOutcome]=useState({conflict_id:'',target_settlement_id:'',kind:'territory_transfer',rationale:''});
 const [reviewNotes,setReviewNotes]=useState({}),[overrides,setOverrides]=useState({});
 const load=useCallback(async()=>setData(await request('/world-admin/diplomacy')),[request]);
 useEffect(()=>{load().catch(e=>setError(e.message||'Unable to open diplomatic records'))},[load]);
 const act=async(path,body,method='POST',message='Decision saved.')=>{
  if(busy)return;
  setBusy(true);setError('');setNotice('');
  try{const response=await request('/world-admin/diplomacy'+path,{method,body});await load();if(response.ownership_changed)await onChanged?.();setNotice(message);return response}
  catch(e){setError(e.message||'Unable to save diplomatic action')}
  finally{setBusy(false)}
 };
 const npcFactions=factions.filter(f=>f.id!=='eclipse-order'&&['order_story','world','settlement'].includes(f.faction_scope));
 const name=id=>factions.find(f=>f.id===id)?.name||id;
 const active=data?.conflicts?.filter(c=>['authorized','active'].includes(c.status))||[];
 const open=data?.proposals?.filter(p=>['pending','postponed'].includes(p.status))||[];
 const history=data?.proposals?.filter(p=>!['pending','postponed'].includes(p.status))||[];
 const commandViews=[['inbox','Incident desk',open.length,'fa-envelope-open-text'],['recovery','Recovery claims',null,'fa-hammer'],['campaigns','War command',active.length,'fa-shield-halved'],['relations','Foreign relations',data?.relations?.length||0,'fa-handshake'],['safeguards','Plot protection',data?.protected_sites?.length||0,'fa-lock'],['history','Archive',history.length,'fa-box-archive']];
 const factionSelect=(value,onChange,exclude='')=><select value={value} onChange={e=>onChange(e.target.value)}><option value="">Select faction</option>{npcFactions.filter(f=>f.id!==exclude).map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select>;
 const siteSelect=(value,onChange,scope)=> <select value={value} onChange={e=>onChange(e.target.value)}><option value="">Select location</option>{settlements.filter(s=>!scope||s.controlling_faction_id===scope||!s.controlling_faction_id).map(s=><option value={s.id} key={s.id}>{s.name} · {s.strategic_state==='destroyed'?'RUINS':s.strategic_state==='abandoned'?'ABANDONED':s.controlling_faction_id?'Controlled':'Unclaimed'}</option>)}</select>;
 return <section className="wdi-root">
  <header className="wdi-header"><div><span className="wdi-eyebrow">WORLD ADMINISTRATION / FACTION DIPLOMACY</span><h3>Diplomatic Council</h3><p>NPCs may propose a conflict, but they cannot declare war, annex settlements, or end major plots without command approval.</p></div><div className="wdi-stats"><div><strong>{open.length}</strong><span>Awaiting review</span></div><div><strong>{active.length}</strong><span>Authorized conflicts</span></div><div><strong>{data?.protected_sites?.length||0}</strong><span>Plot-protected sites</span></div></div></header>
  {error&&<p className="wdi-error" role="alert">{clean(error)}</p>}{notice&&<p className="wdi-notice" role="status">{notice}</p>}
  {!data?<p>Loading diplomatic records…</p>:<>
   <div className="wdi-command-layout"><nav className="wdi-command-nav" aria-label="Diplomatic council sections"><span className="wdi-command-nav-title">COUNCIL CHAMBERS</span>{commandViews.map(([id,label,count,icon])=><button type="button" key={id} aria-current={view===id?'page':undefined} className={view===id?'active':''} onClick={()=>setView(id)}><i className={'fa-solid '+icon} aria-hidden="true"/><span>{label}</span>{count!==null&&<small>{count}</small>}</button>)}<p>Command approval is required for wars, capture, and reconstruction.</p></nav><div className="wdi-command-stage">
   {view==='recovery'&&<WorldRecoveryPanel request={request} factions={factions} settlements={settlements} onChanged={onChanged}/>}
   {view==='inbox'&&<section className="wdi-section"><div className="wdi-section-head"><div><span className="wdi-eyebrow">CONFLICT REVIEW</span><h4>Pending decisions</h4><p>Approving a war only authorizes it. No settlement ownership or industry changes are performed. Destroyed sites can be claimed through a separate approved outcome and then enter rebuilding.</p></div><button type="button" disabled={busy} onClick={()=>act('/assess',{},'POST','NPC tensions assessed. Newly eligible incidents added to the review queue.')}>Assess NPC tensions</button></div>
    {!open.length?<p className="wdi-empty">No active proposals. Adjust faction relations or record a story incident to populate this queue.</p>:<div className="wdi-proposal-list">{open.map(p=><article className="wdi-proposal" key={p.id}>
     <div className="wdi-proposal-title"><strong>{name(p.attacker_id)} <span>vs.</span> {name(p.defender_id)}</strong><small>{clean(p.conflict_kind)} · {clean(p.source_kind)} · {clean(p.status)} · #{p.id}</small></div>
     <p>{p.rationale}</p>{p.target_name&&<p className="wdi-target"><strong>Location:</strong> {p.target_name}</p>}
     {p.proposed_effect&&<p className="wdi-target"><strong>Suggested outcome:</strong> {p.proposed_effect}</p>}
     <label>Command decision note<textarea rows={2} maxLength={1500} value={reviewNotes[p.id]||''} onChange={e=>setReviewNotes(v=>({...v,[p.id]:e.target.value}))}/></label>
     {p.source_kind==='war_outcome'&&<label className="wdi-check"><input type="checkbox" checked={!!overrides[p.id]} onChange={e=>setOverrides(v=>({...v,[p.id]:e.target.checked}))}/> Explicitly override plot protection for this outcome, if applicable</label>}
     <div className="wdi-actions">{(p.source_kind==='war_outcome'?['approve','postpone','reject']:['approve','postpone','reject','rp_event']).map(decision=><button key={decision} disabled={busy} className={decision==='approve'?'wdi-approve':decision==='reject'?'wdi-reject':''} onClick={()=>act((p.source_kind==='war_outcome'?'/outcomes/':'/proposals/')+p.id+'/review',{decision,note:reviewNotes[p.id]||'',...(p.source_kind==='war_outcome'?{override_plot_protection:!!overrides[p.id]}:{})},'POST',decision==='approve'?'Approved. The recorded authorization is now effective.':clean(decision)+' decision recorded.')}>{decision==='rp_event'?'Convert to RP event':clean(decision)}</button>)}</div>
    </article>)}</div>}
   </section>}
   {view==='campaigns'&&<section className="wdi-section"><div className="wdi-section-head"><div><span className="wdi-eyebrow">AUTHORIZED OPERATIONS</span><h4>Active conflicts</h4><p>Campaign simulation is a separate future system. This queue records authorization and requires another proposal for control changes or peace. Ruined, abandoned, and unclaimed places may be claimed with approval, but never automatically.</p></div></div>
    {!active.length?<p className="wdi-empty">No authorized wars or raids.</p>:<div className="wdi-conflicts">{active.map(c=><div className="wdi-conflict" key={c.id}><strong>#{c.id} · {c.attacker_name} — {c.defender_name}</strong><span>{c.target_name||'No specific location'} · {clean(c.status)}</span></div>)}</div>}
    <form className="wdi-form" onSubmit={e=>{e.preventDefault();void act('/outcomes',{...outcome,conflict_id:Number(outcome.conflict_id),target_settlement_id:outcome.kind==='territory_transfer'?Number(outcome.target_settlement_id):null},'POST','Outcome proposed for separate approval.')}}>
     <strong>Propose a war outcome for review</strong><label>Authorized conflict<select required value={outcome.conflict_id} onChange={e=>setOutcome(v=>({...v,conflict_id:e.target.value}))}><option value="">Select conflict</option>{active.map(c=><option key={c.id} value={c.id}>#{c.id} · {c.attacker_name} vs {c.defender_name}</option>)}</select></label>
     <label>Proposal<select value={outcome.kind} onChange={e=>setOutcome(v=>({...v,kind:e.target.value}))}><option value="territory_transfer">Capture / claim preset location</option><option value="peace">Conclude conflict</option></select></label>
     {outcome.kind==='territory_transfer'&&<label>Target location{siteSelect(outcome.target_settlement_id,value=>setOutcome(v=>({...v,target_settlement_id:value})),active.find(c=>String(c.id)===String(outcome.conflict_id))?.defender_id)}</label>}
     <label className="wdi-wide">Story justification<textarea required maxLength={1500} rows={2} value={outcome.rationale} onChange={e=>setOutcome(v=>({...v,rationale:e.target.value}))}/></label>
     <button disabled={busy||!outcome.conflict_id||(outcome.kind==='territory_transfer'&&!outcome.target_settlement_id)||!outcome.rationale.trim()} type="submit">Submit outcome for approval</button>
    </form>
   </section>}
   {view==='relations'&&<section className="wdi-section"><div className="wdi-section-head"><div><span className="wdi-eyebrow">POLITICAL PRESSURE</span><h4>Faction relations</h4><p>NPC faction relationships generate assessed disputes; the Imperium Noctis is excluded from automatic NPC-vs-NPC proposals. Relationships never start a war automatically.</p></div></div>
    <div className="wdi-relation-list">{data.relations.map(r=><div key={r.faction_a+'-'+r.faction_b}><strong>{r.faction_a_name} / {r.faction_b_name}</strong><span>Tension {r.tension} · Trust {r.trust}</span></div>)}</div>
    <form className="wdi-form" onSubmit={e=>{e.preventDefault();void act('/relations',{...relationship,tension:Number(relationship.tension),trust:Number(relationship.trust)},'PUT','Faction relationship saved.')}}>
     <label>Faction A{factionSelect(relationship.faction_a,value=>setRelationship(v=>({...v,faction_a:value})),relationship.faction_b)}</label><label>Faction B{factionSelect(relationship.faction_b,value=>setRelationship(v=>({...v,faction_b:value})),relationship.faction_a)}</label>
     <label>Tension: {relationship.tension}/100<input type="range" min="0" max="100" value={relationship.tension} onChange={e=>setRelationship(v=>({...v,tension:Number(e.target.value)}))}/></label>
     <label>Trust: {relationship.trust}/100<input type="range" min="0" max="100" value={relationship.trust} onChange={e=>setRelationship(v=>({...v,trust:Number(e.target.value)}))}/></label>
     <button type="submit" disabled={busy||!relationship.faction_a||!relationship.faction_b}>Save relationship</button>
    </form>
   </section>}
   {view==='safeguards'&&<section className="wdi-section"><div className="wdi-section-head"><div><span className="wdi-eyebrow">WORLD STORY SAFEGUARDS</span><h4>Plot protection</h4><p>Protected locations are never silently transferred. A proposed outcome requires a second approval and an explicit override to change protected control.</p></div></div>
    <div className="wdi-protected-list">{data.protected_sites.map(p=><div key={p.settlement_id}><strong>{p.settlement_name}</strong><span>{clean(p.protection)} · {p.explanation||'No explanation'}</span></div>)}</div>
    <form className="wdi-form" onSubmit={e=>{e.preventDefault();void act('/protection',{...protection,settlement_id:Number(protection.settlement_id)},'PUT','Location protection updated.')}}>
     <label>Preset location{siteSelect(protection.settlement_id,value=>setProtection(v=>({...v,settlement_id:value})))}</label>
     <label>Protection<select value={protection.protection} onChange={e=>setProtection(v=>({...v,protection:e.target.value}))}><option value="major_changes">Require override for major changes</option><option value="all_conflict">No new conflict and require override for capture</option><option value="none">Remove protection</option></select></label>
     <label className="wdi-wide">Plot notes<input maxLength={500} value={protection.explanation} onChange={e=>setProtection(v=>({...v,explanation:e.target.value}))}/></label>
     <button type="submit" disabled={busy||!protection.settlement_id}>Save protection</button>
    </form>
   </section>}
   {view==='inbox'&&<section className="wdi-section wdi-incident-editor"><details><summary>Write a diplomatic incident manually</summary><form className="wdi-form" onSubmit={e=>{e.preventDefault();void act('/proposals',{...proposal,target_settlement_id:proposal.target_settlement_id?Number(proposal.target_settlement_id):null},'POST','Incident added to the review queue.')}}>
    <label>Initiating faction{factionSelect(proposal.attacker_id,value=>setProposal(v=>({...v,attacker_id:value})),proposal.defender_id)}</label><label>Opposing faction{factionSelect(proposal.defender_id,value=>setProposal(v=>({...v,defender_id:value})),proposal.attacker_id)}</label>
    <label>Incident type<select value={proposal.conflict_kind} onChange={e=>setProposal(v=>({...v,conflict_kind:e.target.value}))}>{['border_dispute','raid','siege','war'].map(k=><option key={k} value={k}>{clean(k)}</option>)}</select></label>
    <label>Optional location{siteSelect(proposal.target_settlement_id,value=>setProposal(v=>({...v,target_settlement_id:value})))}</label>
    <label className="wdi-wide">Reason<textarea required maxLength={1500} rows={2} value={proposal.rationale} onChange={e=>setProposal(v=>({...v,rationale:e.target.value}))}/></label>
    <label className="wdi-wide">Possible outcome (not automatically applied)<input maxLength={1000} value={proposal.proposed_effect} onChange={e=>setProposal(v=>({...v,proposed_effect:e.target.value}))}/></label>
    <button disabled={busy||!proposal.attacker_id||!proposal.defender_id||!proposal.rationale.trim()}>Create proposal</button>
   </form></details></section>}
   {view==='history'&&<section className="wdi-section"><details open><summary>Past decisions ({history.length})</summary><div className="wdi-relation-list">{history.map(p=><div key={p.id}><strong>#{p.id} · {p.attacker_name} / {p.defender_name}</strong><span>{clean(p.conflict_kind)} · {clean(p.status)} · {p.review_note||'No note'}</span></div>)}</div></details></section>}
   </div></div>
  </>}
 </section>;
}
