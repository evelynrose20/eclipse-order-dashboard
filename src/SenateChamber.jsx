import React,{useEffect,useMemo,useState} from 'react';
import {DEMO_POLITICS} from './senate-preview-data.js';
import './senate-chamber.css';

const NAV=[['chamber','Chamber'],['parties','Parties'],['elections','Elections'],['coalitions','Coalitions'],['floor','On the Floor'],['history','History']];
const PHASES=['nominations','campaign','voting','confirmation','complete'];
const label=value=>String(value||'').replaceAll('_',' ').replace(/\b\w/g,s=>s.toUpperCase());
const id=x=>Number(x);
const fmtDate=value=>value?new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'Not scheduled';

function Dots({seats,parties,onSelect,active}){
 const sorted=[...seats].sort((a,b)=>Number(a.seat_number)-Number(b.seat_number));
 return <div className="pol-arc" role="group" aria-label="Fifteen Senate seat assignments">
  {sorted.map((seat,i)=>{
   // Three shallow semi-circular rows, fitted to 15 places.
   const row=Math.floor(i/5),column=i%5;
   const x=11+column*17+(row===1?6:row===2?10:0);
   const y=15+row*27+Math.abs(column-2)*6;
   const party=parties.find(p=>id(p.id)===id(seat.party_id));
   return <button type="button" className={'pol-seat '+(active===seat.seat_number?'pol-seat-active':'')} style={{left:x+'%',top:y+'%',backgroundColor:seat.account_id?(party?.color||'#86919C'):'#313943'}} key={seat.seat_number}
    aria-label={'Seat '+seat.seat_number+': '+(seat.holder||'Vacant')+(party?' — '+party.name:'')}
    title={'Seat '+seat.seat_number+' · '+(seat.holder||'Vacant')+(party?' · '+party.name:'')}
    onClick={()=>onSelect(seat.seat_number)}>{!seat.account_id&&<span>+</span>}</button>
  })}
  <div className="pol-majority"><strong>8 OF 15</strong><small>ELECTED-SEAT MAJORITY</small></div>
 </div>;
}
function Bill({bill}){
 const yes=Number(bill.yes)||0,no=Number(bill.no)||0,abstain=Number(bill.abstain)||0;
 const count=yes+no+abstain,denom=Math.max(count,Number(bill.electorate)||0,1);
 return <div className="pol-bill">
  <div className="pol-bill-mark" aria-hidden="true">§</div>
  <div className="pol-bill-copy"><strong>{bill.title}</strong><small>{label(bill.category)} · {bill.sponsor_name||'Order senator'} · {label(bill.state)}</small><p>{bill.description}</p></div>
  <div className="pol-votebar"><div><span>{yes} Yes</span><span>{abstain} Abstain</span><span>{no} No</span></div><div className="pol-votetrack"><i style={{width:yes/denom*100+'%',background:'#51B8A2'}}/><i style={{width:abstain/denom*100+'%',background:'#7C8994'}}/><i style={{width:no/denom*100+'%',background:'#D15A63'}}/></div></div>
 </div>;
}
function PartyRow({party,count,total,selected,onClick}){
 const percent=total?Math.round(count/total*100):0;
 return <button type="button" className={'pol-party-row '+(selected?'selected':'')} onClick={onClick}>
  <span className="pol-party-strip" style={{backgroundColor:party?.color||'#89949E'}}/>
  <span className="pol-party-label"><strong>{party?.abbreviation||'IND'}</strong><small>{party?.name||'Independent'}</small></span>
  <span className="pol-share"><span style={{width:percent+'%',backgroundColor:party?.color||'#89949E'}}/></span>
  <strong className="pol-count">{count}</strong><small className="pol-percent">{percent}%</small>
 </button>;
}
const FORM_PARTY={name:'',abbreviation:'',manifesto:'',color:'#A93B46'};
const FORM_COALITION={title:'',agreement:'',party_ids:[]};
export default function SenateChamber({request,preview=false,senate,onRefresh}){
 const [live,setLive]=useState(null),[section,setSection]=useState('chamber'),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [selectedSeat,setSelectedSeat]=useState(null),[selectedParty,setSelectedParty]=useState(null),[samplePhase,setSamplePhase]=useState('campaign');
 const [partyForm,setPartyForm]=useState(FORM_PARTY),[coalitionForm,setCoalitionForm]=useState(FORM_COALITION);
 const [editingParty,setEditingParty]=useState(null),[partyChanges,setPartyChanges]=useState(FORM_PARTY);
 const [electionName,setElectionName]=useState(''),[termDays,setTermDays]=useState(90),[statement,setStatement]=useState(''),[voteParty,setVoteParty]=useState(''),[voteCandidate,setVoteCandidate]=useState(''),[rejecting,setRejecting]=useState(null),[reason,setReason]=useState('');
 const load=async()=>{const result=await request('/governance/senate/politics');setLive(result);return result};
 useEffect(()=>{if(!preview)load().catch(e=>setError(e.message||'The chamber is unavailable.'))},[preview]);
 const data=preview?{...DEMO_POLITICS,election:{...DEMO_POLITICS.election,phase:samplePhase}}:live;
 const parties=data?.parties||[],seats=data?.seats||[],bills=data?.bills||[];
 const counts=useMemo(()=>seats.reduce((out,s)=>{if(s.account_id){const k=s.party_id===null?'independent':String(s.party_id);out[k]=(out[k]||0)+1}return out},{}),[seats]);
 const total=seats.filter(s=>s.account_id).length;
 const partyRows=[...parties.filter(p=>p.state==='active').map(p=>({p,count:counts[String(p.id)]||0})),{p:null,count:counts.independent||0}].filter(x=>x.count||!x.p);
 const focusedSeat=seats.find(s=>s.seat_number===selectedSeat);
 const focusedParty=parties.find(p=>Number(p.id)===Number(selectedParty));
 const election=data?.election;
 const myParty=parties.find(p=>Number(p.id)===Number(data?.my_party_id));
 const myCandidate=election&&data.candidates?.some(c=>c.account_id===data.actor_id);
 const canManage=!preview&&data?.enabled&&data?.can_manage;
 const canWrite=!preview&&data?.enabled;
 const eligibleSlates=[...new Map((data?.candidates||[]).map(c=>[c.party_id===null?'independent':String(c.party_id),c.party_id])).entries()];
 const candidatesForVote=(data?.candidates||[]).filter(c=>String(c.party_id??'independent')===String(voteParty||'independent'));
 async function change(path,body,success='Saved.'){
  if(!canWrite||busy)return;
  setBusy(true);setError('');setNotice('');
  try{await request(path,{method:'POST',body});await load();await onRefresh?.();setNotice(success);return true}
  catch(e){setError(e.message||'This action could not be completed.');return false}
  finally{setBusy(false)}
 }
 const submitParty=async e=>{e.preventDefault();if(await change('/governance/senate/parties',partyForm,'Party founded.'))setPartyForm(FORM_PARTY)};
 const saveParty=async e=>{
  e.preventDefault();if(!canWrite||!editingParty)return;
  setBusy(true);setError('');setNotice('');
  try{
   await request('/governance/senate/parties/'+editingParty+'/edit',{method:'POST',body:{name:partyChanges.name,manifesto:partyChanges.manifesto,color:partyChanges.color}});
   await load();setEditingParty(null);setNotice('Party platform updated.');
  }catch(e){setError(e.message||'Unable to revise the party.')}finally{setBusy(false)}
 };
 const submitCoalition=async e=>{e.preventDefault();if(await change('/governance/senate/coalitions',coalitionForm,'Coalition proposal recorded.'))setCoalitionForm(FORM_COALITION)};
 const createElection=async e=>{e.preventDefault();if(await change('/governance/senate/elections',{title:electionName,term_days:termDays},'Electoral registration opened.'))setElectionName('')};
 const nextPhase=async()=>change('/governance/senate/elections/'+election.id+'/advance',{},'Election phase advanced.');
 const confirm=async(seat,decision)=>{if(await change('/governance/senate/elections/'+election.id+'/confirm',{seat_number:seat,decision,reason},'Confirmation recorded.')){setRejecting(null);setReason('')}};
 if(!data)return <section className="pol-shell"><div className="pol-empty">{error||'Opening the Senate records…'}</div></section>;
 const accepted=coalition=>coalition.parties.filter(p=>p.status==='accepted').reduce((n,p)=>n+(counts[String(p.party_id)]||0),0);
 return <div className={'pol-shell '+(preview?'pol-preview':'')}>
  {preview&&<div className="pol-preview-banner" role="status"><strong>CHAMBER PREVIEW — SAMPLE DATA</strong><span>Explore the Senate before convening it. No party, vote, election, or appointment here changes the live Order.</span></div>}
  {error&&<p className="pol-error" role="alert">{error}</p>}{notice&&<p className="pol-notice" role="status">{notice}</p>}
  <div className="pol-layout">
   <nav className="pol-rail" aria-label="Senate political sections">
    <span className="pol-rail-title">SENATE RECORDS</span>
    {NAV.map(([key,name],i)=><button type="button" key={key} className={section===key?'active':''} aria-current={section===key?'page':undefined} onClick={()=>setSection(key)}><span>{String(i+1).padStart(2,'0')}</span>{name}</button>)}
   </nav>
   <main className="pol-main">
    <div className="pol-masthead"><div><span className="pol-kicker">NEW CASSIA · SENATE REGISTRY</span><h3>{section==='chamber'?'THE SENATE CHAMBER':section.toUpperCase()}</h3><p>Fifteen senatorial seats · Three Heads of the Order · Domina confirmation</p></div><span className="pol-operational">{preview?'VISUAL PREVIEW':data.enabled?'CHAMBER CONVENED':'NOT CONVENED'}</span></div>
    <div className="pol-stats">
     <div><span>GOVERNING BODY</span><strong>Hybrid Senate</strong><small>Under the Domina</small></div>
     <div><span>CONFIRMING AUTHORITY</span><strong>Domina</strong><small>One of three Heads</small></div>
     <div><span>SEATS HELD</span><strong>{total}<small> / 15</small></strong><small>3 separate leadership seats</small></div>
     <div><span>ELECTORAL CYCLE</span><strong>{election?label(election.phase):'Not scheduled'}</strong><small>{election?'Term: '+election.term_days+' days':'Awaiting first election'}</small></div>
    </div>
    {section==='chamber'&&<>
     <div className="pol-chamber-grid">
      <section className="pol-panel pol-seat-map"><header><strong>THE CHAMBER</strong><small>{total} / 15 senatorial seats filled</small></header>
       <div className="pol-heads"><span>HEADS OF THE ORDER</span><div>{data.heads?.map(h=><div key={h.head_number}><span>{h.head_number===1?'◆':'◇'}</span><strong>{h.title}</strong><small>{h.holder||'Unappointed'}</small></div>)}</div></div>
       <Dots seats={seats} parties={parties} active={selectedSeat} onSelect={setSelectedSeat}/>
       <div className="pol-seat-caption">{focusedSeat?'SEAT '+String(focusedSeat.seat_number).padStart(2,'0')+' · '+(focusedSeat.holder||'Vacant'):'Select a seat to see its holder and party.'}<small>Three Heads are shown separately; they also participate in full-chamber voting.</small></div>
      </section>
      <section className="pol-panel pol-party-breakdown"><header><strong>PARTY DISTRIBUTION</strong><small>15 elected positions</small></header>
       <div className="pol-table-header"><span>PARTY</span><span>SHARE</span><span>SEATS</span><span>%</span></div>
       {partyRows.map(({p,count})=><PartyRow key={p?.id||'ind'} party={p} count={count} total={15} selected={selectedParty===(p?.id??null)} onClick={()=>{setSelectedParty(p?.id??null);setSection('parties')}}/>)}
       {!total&&<p className="pol-empty">No senators appointed yet. Parties will appear here when seats are filled.</p>}
      </section>
     </div>
     <div className="pol-mini-grid">
      <div><span>MAJORITY OF ELECTED SEATS</span><strong>8 / 15</strong><small>Full 18-vote chamber majority: 10</small></div>
      <div><span>PARTIES IN CHAMBER</span><strong>{partyRows.filter(x=>x.p&&x.count).length}</strong><small>Independent senators: {counts.independent||0}</small></div>
      <div><span>ACTIVE COALITIONS</span><strong>{data.coalitions?.filter(c=>c.state==='active').length||0}</strong><small>Negotiated party alliances</small></div>
     </div>
     <section className="pol-panel pol-floor"><header><strong>ON THE FLOOR</strong><button onClick={()=>setSection('floor')}>OPEN DOCKET</button></header>{bills.slice(0,3).map(b=><Bill key={b.id} bill={b}/>)}{!bills.length&&<p className="pol-empty">No measures have been submitted.</p>}</section>
    </>}
    {section==='parties'&&<>
     <section className="pol-panel"><header><strong>REGISTERED PARTIES</strong><small>{parties.filter(p=>p.state==='active').length} recognized groups</small></header>
      <div className="pol-party-cards">{parties.map(p=><article key={p.id} className="pol-party-card" style={{borderTopColor:p.color}}><span className="pol-party-badge" style={{backgroundColor:p.color}}>{p.abbreviation}</span><h4>{p.name}</h4><p>{p.manifesto}</p><small>Leader: {p.leader_name} · Members: {p.members} · Seats: {counts[String(p.id)]||0}</small>
       {canWrite&&Number(data.my_party_id)!==Number(p.id)&&!data.my_party_id&&<button disabled={busy} onClick={()=>change('/governance/senate/parties/'+p.id+'/join',{},'Joined the party.')}>Join party</button>}
       {canWrite&&Number(data.my_party_id)===Number(p.id)&&p.leader_id!==data.actor_id&&<button disabled={busy} onClick={()=>change('/governance/senate/parties/'+p.id+'/leave',{},'Left the party.')}>Leave party</button>}
       {canWrite&&(p.leader_id===data.actor_id||data.can_manage)&&<button disabled={busy} onClick={()=>{setEditingParty(p.id);setPartyChanges({name:p.name,manifesto:p.manifesto,color:p.color})}}>Edit party platform</button>}
      </article>)}</div>
      {!parties.length&&<p className="pol-empty">No parties have been founded.</p>}
     </section>
     {canWrite&&editingParty&&<section className="pol-panel"><header><strong>REVISE PARTY PLATFORM</strong><button onClick={()=>setEditingParty(null)}>CANCEL</button></header><form className="pol-form" onSubmit={saveParty}><label>Party name<input required maxLength={100} value={partyChanges.name} onChange={e=>setPartyChanges({...partyChanges,name:e.target.value})}/></label><label>Party color<input type="color" value={partyChanges.color} onChange={e=>setPartyChanges({...partyChanges,color:e.target.value})}/></label><label className="wide">Manifesto<textarea required rows={4} maxLength={5000} value={partyChanges.manifesto} onChange={e=>setPartyChanges({...partyChanges,manifesto:e.target.value})}/></label><button disabled={busy}>Save party platform</button></form></section>}
     {canWrite&&<section className="pol-panel"><header><strong>FOUND A PARTY</strong><small>One party membership per account</small></header>
      {data.my_party_id?<p className="pol-empty">You belong to {myParty?.name||'a party'}. Leave it before founding another.</p>:<form className="pol-form" onSubmit={submitParty}><label>Official name<input maxLength={100} required value={partyForm.name} onChange={e=>setPartyForm({...partyForm,name:e.target.value})}/></label><label>Abbreviation<input pattern="[A-Z0-9-]{2,12}" maxLength={12} required value={partyForm.abbreviation} onChange={e=>setPartyForm({...partyForm,abbreviation:e.target.value.toUpperCase()})}/></label><label>Party color<input type="color" value={partyForm.color} onChange={e=>setPartyForm({...partyForm,color:e.target.value})}/></label><label className="wide">Platform and manifesto<textarea required rows={4} maxLength={5000} value={partyForm.manifesto} onChange={e=>setPartyForm({...partyForm,manifesto:e.target.value})}/></label><button disabled={busy}>Register party</button></form>}
     </section>}
    </>}
    {section==='elections'&&<>
     <section className="pol-panel"><header><strong>ELECTORAL CYCLE</strong><small>{election?.title||'No election scheduled'}</small></header>
      <div className="pol-phases">{PHASES.map((phase,i)=><div key={phase} className={(election?.phase===phase?'active ':'')+(election&&PHASES.indexOf(election.phase)>i?'done':'')}><span>{String(i+1).padStart(2,'0')}</span><strong>{label(phase)}</strong></div>)}</div>
      <p className="pol-empty">Party-list proportional representation allocates 15 seats. Candidates are ranked by preferences; the Domina confirms every provisional winner before investiture. The three Heads remain outside elections.</p>
      {preview&&<div className="pol-actions"><button onClick={()=>setSamplePhase(PHASES[(PHASES.indexOf(samplePhase)+1)%PHASES.length])}>PREVIEW NEXT PHASE</button><small>Only changes this on-screen example.</small></div>}
      {canManage&&!election&&<form className="pol-form" onSubmit={createElection}><label>Election name<input required maxLength={140} value={electionName} onChange={e=>setElectionName(e.target.value)}/></label><label>Term length (days)<input type="number" min={14} max={365} value={termDays} onChange={e=>setTermDays(Number(e.target.value))}/></label><button disabled={busy}>Open nominations</button></form>}
      {canManage&&election&&['nominations','campaign','voting'].includes(election.phase)&&<button className="pol-primary" disabled={busy} onClick={nextPhase}>{election.phase==='voting'?'Close voting and calculate provisional seats':'Advance to '+label(PHASES[PHASES.indexOf(election.phase)+1])}</button>}
      {canManage&&election?.phase==='confirmation'&&!data.results.some(r=>r.state==='pending')&&<button className="pol-primary" disabled={busy} onClick={()=>change('/governance/senate/elections/'+election.id+'/invest',{},'The new Senate has been invested.')}>Invest the confirmed Senate</button>}
     </section>
     {canWrite&&election?.phase==='nominations'&&!myCandidate&&<section className="pol-panel"><header><strong>YOUR CANDIDACY</strong><small>{myParty?'Standing for '+myParty.name:'Independent candidacy'}</small></header><form className="pol-form" onSubmit={async e=>{e.preventDefault();if(await change('/governance/senate/elections/'+election.id+'/nominate',{statement},'Candidacy filed.'))setStatement('')}}><label className="wide">Candidate statement<textarea required rows={4} maxLength={1500} value={statement} onChange={e=>setStatement(e.target.value)}/></label><button disabled={busy}>Stand for election</button></form></section>}
     {election&&<section className="pol-panel"><header><strong>REGISTERED CANDIDATES</strong><small>{data.candidates?.length||0} nominations</small></header><div className="pol-candidates">{data.candidates?.map(c=><div key={c.account_id}><strong>{c.candidate_name}</strong><small>{parties.find(p=>Number(p.id)===Number(c.party_id))?.name||'Independent'}</small><p>{c.statement}</p></div>)}{!data.candidates?.length&&<p className="pol-empty">No candidates registered yet.</p>}</div></section>}
     {canWrite&&election?.phase==='voting'&&!data.has_voted&&<section className="pol-panel"><header><strong>YOUR SECRET BALLOT</strong><small>One ballot per approved member</small></header><form className="pol-form" onSubmit={async e=>{e.preventDefault();await change('/governance/senate/elections/'+election.id+'/vote',{party_id:voteParty==='independent'?null:Number(voteParty),candidate_id:voteCandidate||null},'Your ballot has been recorded.')}}><label>Choose slate<select required value={voteParty} onChange={e=>{setVoteParty(e.target.value);setVoteCandidate('')}}><option value="">Choose a party or independents</option>{eligibleSlates.map(([k,pid])=><option key={k} value={pid===null?'independent':String(pid)}>{parties.find(p=>Number(p.id)===Number(pid))?.name||'Independents'}</option>)}</select></label><label>Preferred candidate<select value={voteCandidate} onChange={e=>setVoteCandidate(e.target.value)} required={voteParty==='independent'}><option value="">No candidate preference</option>{candidatesForVote.map(c=><option value={c.account_id} key={c.account_id}>{c.candidate_name}</option>)}</select></label><button disabled={busy||!voteParty}>Cast ballot</button></form></section>}
     {data.has_voted&&<p className="pol-notice">Your private ballot has been recorded. Individual votes are never displayed publicly.</p>}
     {election&&['confirmation','complete'].includes(election.phase)&&data.tallies?.length>0&&<section className="pol-panel"><header><strong>ELECTION RESULTS / PARTY VOTE</strong><small>{data.ballot_count} ballots recorded</small></header><div className="pol-tally-grid">{data.tallies.map((t,i)=>{const party=parties.find(p=>Number(p.id)===Number(t.party_id));const won=data.results.filter(r=>String(r.party_id??'independent')===String(t.party_id??'independent')&&r.candidate_id).length;return <div key={party?.id||'independent'}><span style={{backgroundColor:party?.color||'#89949E'}}/><strong>{party?.name||'Independent candidates'}</strong><small>{t.votes} votes · {won} seats provisionally allocated</small></div>})}</div></section>}
     {election&&['confirmation','complete'].includes(election.phase)&&<section className="pol-panel"><header><strong>PROVISIONAL SENATE / CONFIRMATIONS</strong><small>Domina confirmation required</small></header><div className="pol-results">{data.results.map(r=><div key={r.seat_number}><span>SEAT {String(r.seat_number).padStart(2,'0')}</span><strong>{r.candidate_name||'Vacant'}</strong><small>{parties.find(p=>Number(p.id)===Number(r.party_id))?.name||'Independent'} · {label(r.state)}</small>{canManage&&r.state==='pending'&&<div className="pol-actions"><button disabled={busy} onClick={()=>confirm(r.seat_number,'confirm')}>Confirm</button><button disabled={busy} onClick={()=>setRejecting(rejecting===r.seat_number?null:r.seat_number)}>Reject</button></div>}{canManage&&rejecting===r.seat_number&&<div className="pol-reject"><input maxLength={500} placeholder="Required in-character reason" value={reason} onChange={e=>setReason(e.target.value)}/><button disabled={!reason.trim()||busy} onClick={()=>confirm(r.seat_number,'reject')}>Record rejection</button></div>}</div>)}</div></section>}
    </>}
    {section==='coalitions'&&<>
     <section className="pol-panel"><header><strong>POLITICAL COALITIONS</strong><small>Party agreements and their current seats</small></header>
      <div className="pol-coalitions">{data.coalitions?.map(c=><article key={c.id}><span className="pol-kicker">{label(c.state)}</span><h4>{c.title}</h4><p>{c.agreement}</p><div className="pol-coalition-members">{c.parties.map(p=><span key={p.party_id}>{parties.find(v=>Number(v.id)===Number(p.party_id))?.abbreviation||'Party'} · {p.status}</span>)}</div><strong>{accepted(c)} / 15 elected seats</strong>{accepted(c)>=8&&<span className="pol-majority-tag">ELECTED SEAT MAJORITY</span>}{canWrite&&c.parties.some(p=>p.status==='invited'&&parties.some(v=>Number(v.id)===Number(p.party_id)&&v.leader_id===data.actor_id))&&<button disabled={busy} onClick={()=>change('/governance/senate/coalitions/'+c.id+'/accept',{},'Coalition membership accepted.')}>Accept coalition invitation</button>}{canWrite&&(data.can_manage||c.formed_by===data.actor_id)&&c.state==='active'&&<button disabled={busy} onClick={()=>change('/governance/senate/coalitions/'+c.id+'/dissolve',{},'Coalition dissolved.')}>Dissolve coalition</button>}</article>)}{!data.coalitions?.length&&<p className="pol-empty">No coalition agreements have been recorded.</p>}</div>
     </section>
     {canWrite&&(data.can_manage||parties.some(p=>p.leader_id===data.actor_id))&&<section className="pol-panel"><header><strong>PROPOSE A COALITION</strong></header><form className="pol-form" onSubmit={submitCoalition}><label>Coalition name<input required maxLength={100} value={coalitionForm.title} onChange={e=>setCoalitionForm({...coalitionForm,title:e.target.value})}/></label><label className="wide">Coalition parties<select multiple size={Math.min(6,Math.max(2,parties.length))} value={coalitionForm.party_ids.map(String)} onChange={e=>setCoalitionForm({...coalitionForm,party_ids:[...e.target.selectedOptions].map(o=>Number(o.value))})}>{parties.filter(p=>p.state==='active').map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="wide">Coalition agreement<textarea required rows={4} maxLength={6000} value={coalitionForm.agreement} onChange={e=>setCoalitionForm({...coalitionForm,agreement:e.target.value})}/></label><button disabled={busy||coalitionForm.party_ids.length<2}>Propose alliance</button></form></section>}
    </>}
    {section==='floor'&&<section className="pol-panel pol-floor"><header><strong>LEGISLATIVE DOCKET</strong><small>Existing Senate bills and recorded ballots</small></header>{bills.map(b=><Bill key={b.id} bill={b}/>)}{!bills.length&&<p className="pol-empty">No measures have been submitted yet. The Senate docket below can create and vote on live bills.</p>}</section>}
    {section==='history'&&<section className="pol-panel"><header><strong>POLITICAL HISTORY</strong><small>Completed elections and recorded proceedings</small></header><div className="pol-history">{data.elections?.map(e=><div key={'e'+e.id}><strong>{e.title}</strong><small>{label(e.phase)} · {fmtDate(e.created_at)} · {e.term_days}-day term</small></div>)}{data.history?.map((h,i)=><div key={'h'+i}><strong>{label(h.action)}</strong><small>{h.subject} · {h.detail} · {fmtDate(h.created_at)}</small></div>)}{!data.elections?.length&&!data.history?.length&&<p className="pol-empty">No proceedings recorded yet.</p>}</div></section>}
   </main>
  </div>
 </div>;
}
