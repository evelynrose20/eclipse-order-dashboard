import React,{useState} from 'react';
import './governance-preview.css';

// Intentionally uses fabricated, in-memory records. Never calls a live API.
const OFFICES=[
 {id:'domina',title:'Domina',department:'Council Chair · Reserved ratification',holder:'Demonstration Chair'},
 {id:'operations',title:'Chief of Operations',department:'Missions and strategic operations',holder:'Demonstration Officer A'},
 {id:'commerce',title:'Master of Commerce',department:'Syndicate enterprises and front licenses',holder:'Demonstration Officer B'},
 {id:'faction',title:'Faction Envoy',department:'Relations and external agreements',holder:'Demonstration Officer C'},
 {id:'internal',title:'Prefect of Internal Affairs',department:'Recruitment and internal governance',holder:null}
];
const SEED_MOTIONS=[
 {id:1,title:'Harbor Trade Charter',type:'major',category:'Commerce',votes:['yes','yes','yes','pending','pending'],ratification:'pending',detail:'Proposal to establish a fictional charter for regional market operations.'},
 {id:2,title:'New Front Licensing Policy',type:'ordinary',category:'Governance',votes:['yes','yes','yes','no','abstain'],ratification:'pending',detail:'Clarify routine licenses and which commercial activities require renewed review.'},
 {id:3,title:'Territory Accord',type:'reserved',category:'Diplomacy',votes:['yes','yes','yes','yes','no'],ratification:'pending',detail:'A fictional major diplomatic agreement requiring the Domina\'s ratification.'}
];
const SEED_REQUESTS=[
 {id:1,title:'Moonveil Apothecary',kind:'Front business',owner:'Demo Applicant Ada',ic:'approved',site:'pending'},
 {id:2,title:'The Gilded Lantern',kind:'Front business',owner:'Demo Applicant Bea',ic:'pending',site:'pending'},
 {id:3,title:'Aetheric Ward',kind:'Custom spell',owner:'Demo Mage Cal',ic:'not_required',site:'pending'},
 {id:4,title:'Membership introduction',kind:'Recruitment',owner:'Demo Applicant Dee',ic:'approved',site:'approved'}
];
const STAGES=['pending','approved','declined'];
function evaluate(motion){
 const votes=motion.votes;
 const yes=votes.filter(v=>v==='yes').length;
 const no=votes.filter(v=>v==='no').length;
 const participated=votes.filter(v=>v!=='pending').length;
 const quorum=participated>=3;
 const finished=!votes.includes('pending');
 const passed=motion.type==='ordinary'?quorum&&finished&&yes>no:quorum&&yes>=4;
 const status=!passed?'Not passed':motion.type==='reserved'?
   motion.ratification==='approved'?'Ratified':motion.ratification==='declined'?'Returned to Council':'Awaiting ratification'
   :'Passed';
 return {yes,participated,passed,status};
}
function Status({value}){
 const type=value==='approved'||value==='Passed'||value==='Ratified'?'good':
  value==='declined'||value==='Returned to Council'?'bad':'pending';
 return <span className={'gov-status gov-status-'+type}>{value.replaceAll('_',' ')}</span>;
}
export default function GovernancePreview({currentUser}){
 const [section,setSection]=useState('chamber');
 const [motions,setMotions]=useState(SEED_MOTIONS);
 const [selected,setSelected]=useState(1);
 const [offices,setOffices]=useState(OFFICES);
 const dominaLabel=currentUser?.role==='domina'?(currentUser.display_name||'Signed-in Domina'):'Current Domina';
 const displayedOffices=offices.map(o=>o.id==='domina'?{...o,holder:dominaLabel}:o);
 const [requests,setRequests]=useState(SEED_REQUESTS);
 const [newMotion,setNewMotion]=useState({title:'',type:'ordinary',detail:''});
 const [creating,setCreating]=useState(false);
 const current=motions.find(m=>m.id===selected)||motions[0];
 const evaluation=current?evaluate({...current,votes:current.votes.map((v,i)=>displayedOffices[i].holder?v:'pending')}):null;
 const changeVote=(index,value)=>setMotions(prev=>prev.map(m=>m.id===selected?{...m,votes:m.votes.map((v,i)=>i===index?value:v)}:m));
 const changeRatification=value=>setMotions(prev=>prev.map(m=>m.id===selected?{...m,ratification:value}:m));
 const reset=()=>{setMotions(SEED_MOTIONS);setOffices(OFFICES);setRequests(SEED_REQUESTS);setSelected(1);setCreating(false);};
 const addMotion=e=>{
  e.preventDefault();
  if(!newMotion.title.trim())return;
  const id=Math.max(...motions.map(m=>m.id),0)+1;
  setMotions(prev=>[...prev,{...newMotion,title:newMotion.title.trim(),id,category:'Drafted in preview',votes:Array(5).fill('pending'),ratification:'pending'}]);
  setSelected(id);setNewMotion({title:'',type:'ordinary',detail:''});setCreating(false);
 };
 const pendingCount=requests.filter(x=>x.site==='pending').length;
 return <div className="gov-root">
  <div className="gov-warning" role="status"><span className="gov-warning-mark">◈</span><div><strong>Interactive demonstration · No live changes</strong><p>All officers, applications, votes and approvals here are fictional test data held only in this page. Nothing is saved to MySQL, posted to Discord or applied to real characters. Reloading resets the preview.</p></div><button type="button" onClick={reset}>Reset demo</button></div>
  <div className="gov-heading"><div><span className="gov-kicker">THE INNER CHAMBER</span><h2>Governance of the Order</h2><p>Explore the Council, office appointments and approval procedures before activation.</p></div><span className="gov-edition">Charter 0.2 · Five voting seats</span></div>
  <div className="gov-summary">
   <div><span>Established seats</span><strong>05</strong><small>Original thresholds remain fixed</small></div>
   <div><span>Occupied in preview</span><strong>{String(displayedOffices.filter(o=>o.holder).length).padStart(2,'0')}</strong><small>Domina-appointed</small></div>
   <div><span>Major approvals</span><strong>04 / 05</strong><small>Quorum requires three</small></div>
   <div><span>Review queue</span><strong>{String(pendingCount).padStart(2,'0')}</strong><small>Website reviews remaining</small></div>
  </div>
  <div className="gov-tabs" role="tablist" aria-label="Governance preview sections">
   {[['chamber','Council Chamber'],['offices','Appointments'],['queue','Approval Queue'],['charter','Charter & Authority']].map(([id,label])=><button key={id} role="tab" aria-selected={section===id} className={section===id?'selected':''} onClick={()=>setSection(id)}>{label}</button>)}
  </div>
  {section==='chamber'&&<div className="gov-two">
    <section className="gov-panel gov-list"><div className="gov-panel-head"><div><h3>Council motions</h3><p>Select a motion to inspect or simulate voting.</p></div><button className="gov-button" onClick={()=>setCreating(v=>!v)}>{creating?'Cancel':'+ New demo motion'}</button></div>
     {creating&&<form className="gov-new" onSubmit={addMotion}><label>Motion title<input maxLength={110} required value={newMotion.title} onChange={e=>setNewMotion(x=>({...x,title:e.target.value}))}/></label><label>Classification<select value={newMotion.type} onChange={e=>setNewMotion(x=>({...x,type:e.target.value}))}><option value="ordinary">Ordinary</option><option value="major">Major</option><option value="reserved">Reserved · Domina ratification</option></select></label><label>Description<textarea rows={3} maxLength={500} value={newMotion.detail} onChange={e=>setNewMotion(x=>({...x,detail:e.target.value}))}/></label><button type="submit" className="gov-button gov-primary">Create test motion</button></form>}
     {motions.map(m=>{const r=evaluate({...m,votes:m.votes.map((v,i)=>displayedOffices[i].holder?v:'pending')});return <button type="button" onClick={()=>setSelected(m.id)} key={m.id} className={'gov-motion '+(selected===m.id?'active':'')}><span className="gov-motion-icon">✦</span><span className="gov-motion-info"><strong>{m.title}</strong><small>{m.category} · {m.type} motion</small></span><Status value={r.status}/></button>})}
    </section>
    <section className="gov-panel">{current&&<><div className="gov-panel-head"><div><span className="gov-kicker">MOTION #{current.id}</span><h3>{current.title}</h3></div><Status value={evaluation.status}/></div><p>{current.detail||'No further details supplied.'}</p>
      <div className="gov-rule"><span>Threshold</span><strong>{current.type==='ordinary'?'More yes than no · Quorum 3':'Four yes votes · Quorum 3'}</strong></div>
      <div className="gov-rule"><span>Vacancy policy</span><strong>Fixed five-seat thresholds</strong></div>
      <div className="gov-rule"><span>Participation</span><strong>{evaluation.participated}/5</strong></div>
      <h4>Simulate votes</h4>
      {displayedOffices.map((office,i)=><label className="gov-vote-row" key={office.id}><span>{office.title}<small>{office.holder||'Vacant in demo'}</small></span><select aria-label={'Vote for '+office.title} disabled={!office.holder} value={current.votes[i]} onChange={e=>changeVote(i,e.target.value)}><option value="pending">Not cast</option><option value="yes">Approve</option><option value="no">Oppose</option><option value="abstain">Abstain</option></select></label>)}
      <div className="gov-result"><strong>{evaluation.yes} affirmative votes</strong><span>{evaluation.status}</span></div>
      {current.type==='reserved'&&evaluation.passed&&<div className="gov-ratify"><h4>Domina ratification</h4><p>A reserved motion cannot be enacted until ratified. Formal motions have a seven-calendar-day deadline.</p><div className="gov-actions">{STAGES.map(s=><button type="button" key={s} aria-pressed={current.ratification===s} onClick={()=>changeRatification(s)}>{s==='pending'?'Awaiting':s==='approved'?'Ratify':'Decline'}</button>)}</div></div>}
     </>}</section>
  </div>}
  {section==='offices'&&<section className="gov-panel"><div className="gov-panel-head"><div><h3>Council appointments</h3><p>Demo appointment selections. Real offices require the Domina's authorization.</p></div><Status value="pending"/></div><div className="gov-offices">{displayedOffices.map(o=><article className="gov-office" key={o.id}><div className="gov-office-sigil">{o.id==='domina'?'♛':'✦'}</div><div><h4>{o.title}</h4><p>{o.department}</p>{o.id==='domina'?<div className="gov-seat-fixed"><span>Office holder · Assigned by rank</span><strong>{o.holder}</strong><small>This Council seat is permanent and cannot be vacated or reassigned here.</small></div>:<label>Demo office holder<select value={o.holder||''} onChange={e=>setOffices(prev=>prev.map(x=>x.id===o.id?{...x,holder:e.target.value||null}:x))}><option value="">Vacant</option>{['Demonstration Officer A','Demonstration Officer B','Demonstration Officer C','Demonstration Officer D'].map(n=><option key={n} value={n}>{n}</option>)}</select></label>}</div></article>)}</div><p className="gov-note">An appointed Council office lasts until resignation or removal. Empty seats do not reduce the four-vote major threshold.</p></section>}
  {section==='queue'&&<section className="gov-panel"><div className="gov-panel-head"><div><h3>Unified approval queue</h3><p>Practice the separate IC authorization and website review stages.</p></div><Status value="pending"/></div><div className="gov-queue">{requests.map(q=>{const ready=(q.ic==='approved'||q.ic==='not_required')&&q.site==='approved';return <article className="gov-request" key={q.id}><div><span className="gov-kicker">{q.kind}</span><h4>{q.title}</h4><p>{q.owner}</p><div className="gov-stage">IC authorization <Status value={q.ic}/></div><div className="gov-stage">Website review <Status value={q.site}/></div></div><div className="gov-request-controls"><label>IC decision<select disabled={q.ic==='not_required'} value={q.ic} onChange={e=>setRequests(prev=>prev.map(x=>x.id===q.id?{...x,ic:e.target.value}:x))}>{STAGES.map(v=><option key={v} value={v}>{v}</option>)}{q.ic==='not_required'&&<option value="not_required">Not required</option>}</select></label><label>Site decision<select value={q.site} onChange={e=>setRequests(prev=>prev.map(x=>x.id===q.id?{...x,site:e.target.value}:x))}>{STAGES.map(v=><option key={v} value={v}>{v}</option>)}</select></label><span className={'gov-license '+(ready?'ready':'locked')}>{ready?'Eligible for activation':'Not authorized to activate'}</span></div></article>})}</div><p className="gov-note">The actual implementation will enforce reviewer eligibility, version checks and audit records on the backend. This demo only illustrates stage outcomes.</p></section>}
  {section==='charter'&&<div className="gov-two"><section className="gov-panel"><h3>Founding charter</h3><p>Approved design decisions from Charter Revision 0.2.</p><div className="gov-rule"><span>Appointments</span><strong>Domina appoints</strong></div><div className="gov-rule"><span>Terms</span><strong>Until resignation or removal</strong></div><div className="gov-rule"><span>Quorum</span><strong>Three of five</strong></div><div className="gov-rule"><span>Ordinary votes</span><strong>Majority of votes cast</strong></div><div className="gov-rule"><span>Major votes</span><strong>Four yes votes</strong></div><div className="gov-rule"><span>Ratification</span><strong>Seven days</strong></div><div className="gov-rule"><span>Vacancies</span><strong>Thresholds unchanged</strong></div></section><section className="gov-panel"><h3>Separation of authority</h3><p>IC rank does not provide website administration. Discord-managed groups will provide baseline permission; site appointments will limit scope.</p><div className="gov-authority"><strong>Domina and Council</strong><p>Fictional governance, political decisions and charter mandates.</p><strong>Economic administration</strong><p>Separate website approval of every player-owned Order front.</p><strong>OOC moderators</strong><p>Independent oversight of player safety, consent and account protections.</p><strong>Platform security</strong><p>Discord roles and website capabilities are not modified by Council votes.</p></div><a className="gov-doc-link" href="https://github.com/evelynrose20/eclipse-order-dashboard/blob/main/docs/GOVERNANCE-CHARTER-0.2.md" target="_blank" rel="noreferrer">Read the full charter ↗</a></section></div>}
 </div>;
}
