import React,{useEffect,useState} from 'react';
import {
 listStatusRequests,requestCharacterStatus,decideCharacterStatus,cancelCharacterStatus,applyCharacterStatus
 } from './apiBridge.js';
import './rp-platform.css';
import {parseDiceFormula} from './rpRules.js';

function Status({children}){return <span className="rp-status">{children}</span>}
const date=x=>x?new Date(x).toLocaleString():'—';
export function CharacterTransitions({characters,role,userId,onRefresh}){
 const [requests,setRequests]=useState([]),[error,setError]=useState(''),[working,setWorking]=useState(false),[characterId,setCharacterId]=useState(''),[newBound,setNewBound]=useState('bound');
 const isCommand=['domina','high_command'].includes(role);
 async function refresh(){try{setRequests(await listStatusRequests());setError('')}catch(e){setError(e.message)}}
 useEffect(()=>{refresh()},[]);
 async function perform(work){setWorking(true);setError('');try{await work();await refresh();await onRefresh?.()}catch(e){setError(e.message)}finally{setWorking(false)}}
 const eligible=characters.filter(c=>c.player_user_id && (isCommand || c.player_user_id===userId || (role==='handler'&&c.handler_user_id===userId)));
 return <section className="panel rp-panel">
  <div className="panel-heading"><div><h2>Free ↔ Bound transitions</h2><p>Character status can change in either direction while preserving the entire sheet.</p></div></div>
  <div className="hint-box"><strong>OOC approval is mandatory</strong><p>Regardless of IC events or magical bindings, the linked player must explicitly approve each change. Approval can be withdrawn before high command applies it. Only the database can finalize a transition.</p></div>
  <div className="rp-controls">
   <label className="field"><span>CHARACTER</span><select value={characterId} onChange={e=>setCharacterId(e.target.value)}><option value="">Select a linked character</option>{eligible.map(c=><option key={c.id} value={c.id}>{c.name} · {c.collar_bound?'Currently bound':'Currently free'}</option>)}</select></label>
   <label className="field"><span>REQUEST STATUS</span><select value={newBound} onChange={e=>setNewBound(e.target.value)}><option value="bound">Bound</option><option value="free">Free</option></select></label>
   <button className="btn secondary" disabled={!characterId||working} onClick={()=>perform(()=>requestCharacterStatus(characterId,newBound==='bound'))}>Request transition</button>
  </div>
  {error&&<div className="alert" role="alert">{error}</div>}
  <div className="rp-request-list">{requests.length?requests.map(r=><div className="rp-request" key={r.id}>
   <div><strong>{r.name}</strong> <Status>{r.state}</Status><p>Requested: {r.requested_bound?'Bound':'Free'} · {date(r.created_at)}</p></div>
   <div className="rp-request-actions">
    {r.player_user_id===userId&&r.state==='pending'&&<><button className="mini-btn" disabled={working} onClick={()=>perform(()=>decideCharacterStatus(r.id,true))}>OOC approve</button><button className="mini-btn danger" disabled={working} onClick={()=>perform(()=>decideCharacterStatus(r.id,false))}>Decline</button></>}
    {isCommand&&r.state==='approved'&&<button className="mini-btn" disabled={working} onClick={()=>perform(()=>applyCharacterStatus(r.id))}>Apply approved change</button>}
    {(r.player_user_id===userId||r.requested_by===userId)&&['pending','approved'].includes(r.state)&&<button className="mini-btn danger" disabled={working} onClick={()=>perform(()=>cancelCharacterStatus(r.id))}>Withdraw request</button>}
   </div>
  </div>):<p className="muted">No transition requests to display.</p>}</div>
 </section>;
}

