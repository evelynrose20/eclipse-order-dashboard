import React,{useEffect,useState} from 'react';
import {listEventXpAwards,awardEventXp} from './apiBridge.js';

export default function EventXPRewards({event,characters,canDirect,onRefresh}){
 const [awards,setAwards]=useState([]);
 const [recipient,setRecipient]=useState('');
 const [amount,setAmount]=useState(200);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 useEffect(()=>{
  if(!canDirect)return;
  let active=true;
  listEventXpAwards(event.id).then(result=>{if(active)setAwards(result.awards||[])}).catch(error=>{if(active)setMessage(error.message)});
  return()=>{active=false};
 },[event.id,canDirect]);
 if(!canDirect)return null;
 const awarded=new Set(awards.map(a=>a.character_id));
 const eligible=Array.from(new Map((event.combatants||[])
  .filter(c=>c.character_id&&c.kind==='player')
  .map(c=>[c.character_id,{id:c.character_id,name:c.name}])).values());
 const available=eligible.filter(c=>!awarded.has(c.id));
 const chosen=available.some(c=>c.id===recipient)?recipient:available[0]?.id||'';
 async function grant(){
  if(!chosen||busy)return;
  setBusy(true);setMessage('');
  try{
   const result=await awardEventXp(event.id,chosen,Number(amount));
   const updated=await listEventXpAwards(event.id);
   setAwards(updated.awards||[]);
   setRecipient('');
   setMessage('Awarded '+result.amount+' XP. Character is now level '+result.level+'.');
   await onRefresh?.();
  }catch(error){
   const labels={event_xp_already_awarded:'This character has already received XP for this event.',
    event_not_completed:'Finish the event before awarding experience.',
    character_not_in_event:'Only characters who took part in this event can receive XP.',
    legacy_character_requires_progression_setup:'This older character must be moved to the new progression rules first.'};
   setMessage(labels[error.message]||error.message);
  }finally{setBusy(false)}
 }
 return <section className="panel" style={{marginTop:18}}>
  <div className="panel-heading"><div><h2>Event experience rewards</h2><p>Recognize characters who took part in this story. Each participant can receive one XP award per event.</p></div></div>
  {event.status!=='completed'?<p className="muted">Experience rewards unlock after the GM finishes the event.</p>:<>
   {available.length?<div className="inline-sheet-grid"><label className="field"><span>PARTICIPATING CHARACTER</span><select value={chosen} onChange={e=>setRecipient(e.target.value)}>{available.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label className="field"><span>EXPERIENCE (1–5000)</span><input type="number" min={1} max={5000} value={amount} onChange={e=>setAmount(Number(e.target.value))}/></label>
    <button className="btn primary" type="button" disabled={busy||!Number.isSafeInteger(amount)||amount<1||amount>5000} onClick={grant}>Award event XP</button>
   </div>:<p className="muted">All participating characters have received their XP, or no characters were added to this event.</p>}
  </>}
  {awards.length>0&&<div style={{marginTop:16}}><h3>Rewards granted</h3>{awards.map(a=><div className="eo-member" key={a.character_id}><strong>{characters.find(c=>c.id===a.character_id)?.name||eligible.find(c=>c.id===a.character_id)?.name||'Participating character'}</strong><span>{a.amount} XP</span></div>)}</div>}
  {message&&<div className="alert" role="status">{message}</div>}
 </section>;
}
