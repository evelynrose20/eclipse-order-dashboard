import React,{useEffect,useState} from 'react';
import './senate.css';
import SenateChamber from './SenateChamber.jsx';

const CATEGORIES=[['general','Affairs of the Order'],['commerce','Commerce'],['diplomacy','Diplomacy'],['operations','Operations'],['charter','The Charter']];
const freshBill={title:'',description:'',category:'general'};
export default function Senate({request,accounts=[],onModeChange}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [draft,setDraft]=useState(freshBill),[selected,setSelected]=useState(null),[showForm,setShowForm]=useState(false);
 const [quorum,setQuorum]=useState(50),[headTitles,setHeadTitles]=useState({});
 const [preview,setPreview]=useState(false);
 const load=async()=>{
  const result=await request('/governance/senate');
  setData(result);setQuorum(result.quorum_percent);
  setHeadTitles(old=>Object.fromEntries(result.heads.map(h=>[h.head_number,old[h.head_number]??h.title])));
  setSelected(old=>old&&result.bills.some(b=>b.id===old)?old:result.bills[0]?.id||null);
 };
 useEffect(()=>{load().catch(e=>setError(e.message))},[]);
 async function act(path,body,method='POST',message='The record has been updated.'){
  setBusy(true);setError('');setNotice('');
  try{const result=await request(path,{method,body});await load();setNotice(message);return result}
  catch(e){setError(e.message||'The change could not be saved.');return null}
  finally{setBusy(false)}
 }
 const enabled=!!data?.enabled,canManage=!!data?.can_manage;
 const bill=data?.bills.find(b=>b.id===selected)||data?.bills[0];
 const availableAccounts=accounts.filter(a=>a.approval_status==='approved'&&a.role!=='domina');
 const accountOptions=(current)=>availableAccounts.filter(a=>{
  const id=a.user_id||a.id;
  return id===current||!data.seats.some(s=>s.account_id===id)&&!data.heads.some(h=>h.account_id===id);
 });
 const changeHead=async(head,accountId)=>act('/governance/senate/heads',{head_number:head.head_number,title:headTitles[head.head_number]||head.title,account_id:accountId},'PUT','The Head of the Senate has been appointed.');
 const updateMode=async()=>{
  const next=!enabled;
  if(!window.confirm(next?'Establish the Senate as the governing chamber in place of the Council?':'Suspend the Senate and restore the Council as the governing chamber?'))return;
  const result=await act('/governance/senate/settings',{enabled:next,quorum_percent:quorum},'PUT',next?'The Senate has been convened.':'The Council has resumed its duties.');
  if(result)onModeChange?.(next);
 };
 const submit=async e=>{
  e.preventDefault();
  if(await act('/governance/senate/bills',draft,'POST','The bill has been entered into the docket.')){setDraft(freshBill);setShowForm(false)}
 };
 if(!data)return <section className="gov-panel"><h3>The Senate</h3>{error?<p role="alert">{error}</p>:<p>Opening the chamber…</p>}</section>;
 const filled=data.seats.filter(s=>s.account_id).length,heads=data.heads.filter(h=>h.account_id).length;
 return <div className="sen-root">
  <section className="gov-panel sen-top"><div><span className="gov-kicker">THE GOVERNING CHAMBER</span><h3>Senate of the Imperium Noctis</h3><p>Fifteen senatorial seats and three Heads of the Order. The Domina presides over the chamber.</p></div><strong className={'sen-state '+(enabled?'active':'')}>{enabled?'CONVENED':'NOT YET CONVENED'}</strong></section>
  {error&&<p role="alert" className="sen-alert">{error.replaceAll('_',' ')}</p>}{notice&&<p role="status" className="sen-notice">{notice}</p>}
  {canManage&&<section className="gov-panel"><div className="gov-panel-head"><div><h3>Authority of the Chamber</h3><p>The Domina determines when the Senate shall assume the Council's duties.</p></div></div><div className="sen-settings"><label>Quorum <select disabled={busy} value={quorum} onChange={e=>setQuorum(Number(e.target.value))}>{[50,60,67,75,100].map(n=><option key={n} value={n}>{n}%</option>)}</select></label><button type="button" disabled={busy||quorum===data.quorum_percent} onClick={()=>act('/governance/senate/settings',{enabled,quorum_percent:quorum},'PUT','The chamber rules have been amended.')}>Save quorum</button><button type="button" disabled={busy} className={enabled?'sen-danger':''} onClick={updateMode}>{enabled?'Suspend Senate':'Convene Senate'}</button></div></section>}
  {!enabled?<><section className="gov-panel sen-dormant"><div className="sen-seal"><i className="fa-solid fa-crown"/></div><h3>The Senate awaits its founding session</h3><p>The Council continues to govern until the Domina convenes the Senate.</p><button type="button" className="sen-preview-open" onClick={()=>setPreview(v=>!v)}>{preview?'Close Senate preview':'Explore Senate overview preview'}</button><small>Preview uses sample parties and bills. It cannot activate the Senate or save changes.</small></section>{preview&&<SenateChamber preview request={request}/>}</>:<><SenateChamber request={request} senate={data} onRefresh={load}/><details className="sen-management"><summary>Senate appointments and legislative controls</summary>
   <div className="sen-stats">
    <div><span>Senatorial seats</span><strong>{filled} / 15</strong></div>
    <div><span>Heads of the Order</span><strong>{heads} / 3</strong></div>
    <div><span>Open bills</span><strong>{data.bills.filter(b=>b.state==='open').length}</strong></div>
    <div><span>Resolutions passed</span><strong>{data.bills.filter(b=>b.state==='passed').length}</strong></div>
   </div>
   <section className="gov-panel"><div className="gov-panel-head"><div><h3>The Three Heads</h3><p>The Domina holds the first seat. The titles and appointments of the two other Heads are established by her authority.</p></div></div>
    <div className="sen-roster sen-heads">{data.heads.map(h=><div key={h.head_number}><div><span className="gov-kicker">HEAD {h.head_number}</span><strong>{h.title}</strong><small>{h.holder||'Seat vacant'}</small></div>{canManage&&h.head_number!==1&&<div className="sen-head-editor"><label>Title<input maxLength={90} value={headTitles[h.head_number]??h.title} onChange={e=>setHeadTitles(v=>({...v,[h.head_number]:e.target.value}))}/></label><label>Office holder<select disabled={busy} value={h.account_id||''} onChange={e=>changeHead(h,e.target.value||null)}><option value="">Vacant</option>{accountOptions(h.account_id).map(a=><option key={a.user_id||a.id} value={a.user_id||a.id}>{a.display_name||a.discord_username||a.email}</option>)}</select></label><button disabled={busy||!headTitles[h.head_number]?.trim()||headTitles[h.head_number]===h.title} onClick={()=>changeHead(h,h.account_id)}>Save title</button></div>}</div>)}</div>
   </section>
   <section className="gov-panel"><div className="gov-panel-head"><div><h3>The Fifteen Seats</h3><p>Each serving senator holds a single seat and casts one vote. After the first investiture, seats are filled through confirmed elections.</p></div></div>
    <div className="sen-roster">{data.seats.map(seat=><div key={seat.seat_number}><span><strong>Seat {String(seat.seat_number).padStart(2,'0')}</strong><small>{seat.holder||'Vacant'}</small></span>{canManage&&!data.elected_senate&&<select aria-label={'Senator for seat '+seat.seat_number} disabled={busy} value={seat.account_id||''} onChange={e=>act('/governance/senate/senators',{seat_number:seat.seat_number,account_id:e.target.value||null},'PUT','The Senate roster has been updated.')}><option value="">Vacant</option>{accountOptions(seat.account_id).map(a=><option key={a.user_id||a.id} value={a.user_id||a.id}>{a.display_name||a.discord_username||a.email}</option>)}</select>}</div>)}</div>
   </section>
   <div className="gov-two"><section className="gov-panel"><div className="gov-panel-head"><div><h3>Senate Docket</h3><p>Measures placed before the chamber.</p></div>{(canManage||data.is_senator)&&<button type="button" className="gov-button" onClick={()=>setShowForm(v=>!v)}>{showForm?'Cancel':'+ Propose bill'}</button>}</div>
    {showForm&&<form className="gov-new" onSubmit={submit}><label>Title<input required maxLength={160} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label><label>Affairs<select value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})}>{CATEGORIES.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label>Proposed measure<textarea required rows={5} maxLength={6000} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label><button className="gov-button" disabled={busy}>Submit proposal</button></form>}
    {data.bills.map(b=><button type="button" key={b.id} className={'gov-motion '+(bill?.id===b.id?'active':'')} onClick={()=>setSelected(b.id)}><span className="gov-motion-icon"><i className="fa-solid fa-scroll"/></span><span className="gov-motion-info"><strong>{b.title}</strong><small>#{b.id} · {b.category} · {b.sponsor_name}</small></span><span className="gov-status">{b.state.replaceAll('_',' ')}</span></button>)}{!data.bills.length&&<p>No measures have yet come before the Senate.</p>}
   </section><section className="gov-panel">{bill?<><div className="gov-panel-head"><div><span className="gov-kicker">MEASURE #{bill.id}</span><h3>{bill.title}</h3></div><span className="gov-status">{bill.state.replaceAll('_',' ')}</span></div><p className="sen-bill-text">{bill.description}</p><div className="gov-rule"><span>Voting members</span><strong>{bill.electorate}</strong></div><div className="gov-rule"><span>Quorum</span><strong>{bill.participated} / {bill.quorum_required}</strong></div><div className="gov-rule"><span>In favor / Against / Abstained</span><strong>{bill.yes} / {bill.no} / {bill.abstain}</strong></div><div className="gov-rule"><span>Your vote</span><strong>{bill.my_vote||'Not cast'}</strong></div>
    {bill.state==='open'&&bill.can_vote&&data.is_senator&&<div className="sen-voting"><h4>Cast your vote</h4>{[['yes','In favor'],['no','Against'],['abstain','Abstain']].map(([vote,label])=><button key={vote} type="button" disabled={busy} aria-pressed={bill.my_vote===vote} onClick={()=>act('/governance/senate/bills/'+bill.id+'/vote',{vote},'POST','Your vote has been counted.')}>{label}</button>)}</div>}
    {canManage&&<div className="sen-bill-actions">{bill.state==='draft'&&<button disabled={busy} onClick={()=>act('/governance/senate/bills/'+bill.id+'/open',{},'POST','Voting has begun.')}>Open the vote</button>}{bill.state==='open'&&<button disabled={busy||!bill.quorum_met} onClick={()=>act('/governance/senate/bills/'+bill.id+'/close',{},'POST','The vote has been concluded.')}>Conclude vote</button>}{['draft','open'].includes(bill.state)&&<button disabled={busy} className="sen-danger" onClick={()=>act('/governance/senate/bills/'+bill.id+'/withdraw',{},'POST','The measure has been withdrawn.')}>Withdraw</button>}</div>}
   </>:<p>Select a measure to read its terms.</p>}</section></div>
  </details></>}
  {canManage&&enabled&&<section className="gov-panel"><h3>Chamber Chronicle</h3><div className="sen-history">{data.history.map(h=><div key={h.id}><span>{h.action.replaceAll('_',' ')} · {h.subject}<small>{h.actor_name} · {new Date(h.created_at).toLocaleString()}</small></span><small>{h.detail}</small></div>)}{!data.history.length&&<p>No proceedings have yet been recorded.</p>}</div></section>}
 </div>;
}
