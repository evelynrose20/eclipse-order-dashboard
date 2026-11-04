import React,{useEffect,useState} from 'react';
import {
 listStatusRequests,requestCharacterStatus,decideCharacterStatus,cancelCharacterStatus,applyCharacterStatus,
 listScenes,createScene,setSceneConsent,setSceneState,rollSceneDice,listSceneRolls
} from './supabase.js';
import './rp-platform.css';

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

export function RPScenes({role,userId}){
 const [scenes,setScenes]=useState([]),[selectedId,setSelectedId]=useState(''),[rolls,setRolls]=useState([]);
 const [title,setTitle]=useState(''),[summary,setSummary]=useState('');
 const [count,setCount]=useState(1),[sides,setSides]=useState(20),[modifier,setModifier]=useState(0);
 const [working,setWorking]=useState(false),[error,setError]=useState(''),[lastRoll,setLastRoll]=useState(null);
 const host=['domina','high_command','handler'].includes(role);
 const chosen=scenes.find(s=>s.id===selectedId);
 async function refresh(){try{const data=await listScenes();setScenes(data);setSelectedId(old=>data.some(s=>s.id===old)?old:(data[0]?.id||''));setError('')}catch(e){setError(e.message)}}
 useEffect(()=>{refresh();const timer=setInterval(refresh,30000);return()=>clearInterval(timer)},[]);
 useEffect(()=>{if(!selectedId){setRolls([]);return;}let active=true;
  async function update(){try{const items=await listSceneRolls(selectedId);if(active)setRolls(items)}catch(e){if(active)setError(e.message)}}
  update();const timer=setInterval(update,15000);return()=>{active=false;clearInterval(timer)};
 },[selectedId]);
 async function act(work){setWorking(true);setError('');try{const value=await work();await refresh();if(selectedId)setRolls(await listSceneRolls(selectedId));return value}catch(e){setError(e.message)}finally{setWorking(false)}}
 async function startScene(e){e.preventDefault();const id=await act(()=>createScene(title,summary));if(id){setSelectedId(id);setTitle('');setSummary('')}}
 async function roll(){const result=await act(()=>rollSceneDice(selectedId,Number(count),Number(sides),Number(modifier)));if(result)setLastRoll(result)}
 return <div className="rp-page">
  <div className="rp-layout">
   <section className="panel rp-panel">
    <div className="panel-heading"><div><h2>RP sessions</h2><p>Create and run scenes with an OOC participation gate.</p></div></div>
    {host&&<form className="rp-create" onSubmit={startScene}>
     <label className="field"><span>NEW SCENE TITLE</span><input required minLength={3} maxLength={140} value={title} onChange={e=>setTitle(e.target.value)} placeholder="The Moonlit Accord"/></label>
     <label className="field"><span>BRIEF OOC PREMISE (NO SENSITIVE DETAILS)</span><textarea maxLength={1200} rows={2} value={summary} onChange={e=>setSummary(e.target.value)}/></label>
     <button className="btn secondary" disabled={working}>Create scene</button>
    </form>}
    <div className="rp-scene-list">{scenes.length?scenes.map(scene=><button className={'rp-scene '+(selectedId===scene.id?'chosen':'')} key={scene.id} onClick={()=>{setSelectedId(scene.id);setLastRoll(null)}}>
     <strong>{scene.title}</strong><Status>{scene.state}</Status><small>{scene.participants} opted-in participants · {date(scene.created_at)}</small>
    </button>):<p className="muted">No RP scenes yet.</p>}</div>
   </section>
   <section className="panel rp-panel">
    {!chosen?<div className="empty"><h3>Select a scene</h3><p>Sessions, consent and rolls appear here.</p></div>:<>
      <div className="panel-heading"><div><h2>{chosen.title}</h2><p>{chosen.summary||'No public premise recorded.'}</p></div><Status>{chosen.state}</Status></div>
      {(host&&(['domina','high_command'].includes(role)||chosen.hosted_by===userId))&&<div className="rp-toolbar">
       <button className="mini-btn" disabled={working||chosen.state==='active'} onClick={()=>act(()=>setSceneState(chosen.id,'active'))}>Start scene</button>
       <button className="mini-btn danger" disabled={working||chosen.state==='closed'} onClick={()=>act(()=>setSceneState(chosen.id,'closed'))}>Close scene</button>
      </div>}
      <div className="rp-consent">
       <h3>Out-of-character scene agreement</h3>
       <p>Fictional characters may refuse IC, but participating players must opt in OOC. No agreement overrides a real player's ability to pause, revoke consent, or leave the scene.</p>
       <div className="rp-toolbar">
        {!chosen.my_consent&&<button className="btn primary" disabled={working||chosen.state==='closed'} onClick={()=>act(()=>setSceneConsent(chosen.id,true,false))}>Opt in OOC</button>}
        {chosen.my_consent&&!chosen.my_paused&&<button className="btn secondary" disabled={working||chosen.state==='closed'} onClick={()=>act(()=>setSceneConsent(chosen.id,true,true))}>Pause my participation</button>}
        {chosen.my_consent&&chosen.my_paused&&<button className="btn secondary" disabled={working||chosen.state==='closed'} onClick={()=>act(()=>setSceneConsent(chosen.id,true,false))}>Resume my participation</button>}
        {chosen.my_consent&&<button className="btn secondary" disabled={working||chosen.state==='closed'} onClick={()=>act(()=>setSceneConsent(chosen.id,false,true))}>Revoke OOC consent</button>}
       </div>
       <p className="rp-consent-label">Your status: <strong>{chosen.my_consent?(chosen.my_paused?'Paused':'Opted in'):'Not participating'}</strong></p>
      </div>
      <h3>Shared dice chamber</h3>
      <p className="muted">Rolls are generated and recorded by the server, not by the browser. Dice require an active scene and your unpaused OOC opt-in.</p>
      <div className="rp-roll-form">
       <label className="field"><span>COUNT</span><input type="number" min={1} max={20} value={count} onChange={e=>setCount(e.target.value)}/></label>
       <label className="field"><span>DIE</span><select value={sides} onChange={e=>setSides(Number(e.target.value))}>{[4,6,8,10,12,20,100].map(n=><option value={n} key={n}>d{n}</option>)}</select></label>
       <label className="field"><span>MODIFIER</span><input type="number" min={-100} max={100} value={modifier} onChange={e=>setModifier(e.target.value)}/></label>
       <button className="btn primary" disabled={working||chosen.state!=='active'||!chosen.my_consent||chosen.my_paused} onClick={roll}>Roll in scene</button>
      </div>
      {lastRoll&&<div className="rp-last-roll" role="status"><small>NEW VERIFIED ROLL</small><strong>{lastRoll.total}</strong><span>{lastRoll.rolls.join(' + ')} {lastRoll.modifier<0?'−':'+'} {Math.abs(lastRoll.modifier)}</span></div>}
      <div className="rp-roll-log"><h3>Recorded rolls</h3>{rolls.length?rolls.map(r=><div className="rp-roll-row" key={r.id}><span>{r.count}d{r.sides} {r.modifier>=0?'+':''}{r.modifier} · {r.rolls.join(', ')}</span><b>{r.total}</b><small>{date(r.created_at)}</small></div>):<p className="muted">No dice rolls yet.</p>}</div>
    </>}
   </section>
  </div>
  {error&&<div className="alert" role="alert">{error}</div>}
 </div>;
}
