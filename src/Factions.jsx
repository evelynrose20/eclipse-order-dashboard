import React,{useEffect,useMemo,useState} from 'react';
import './factions.css';

const RELATIONS={
 friendly:['Allied','friendly'],rival:['Rival','rival'],watchful_rival:['Watchful rival','watchful'],
 hostile:['Hostile','hostile'],neutral:['Neutral','neutral']
};
const empty={name:'',leader:'',relationship:'neutral',description:'',notes:'',image_reference_url:'',public_visible:true,sort_order:100};
const slug=name=>name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 -]/g,'').trim().replace(/\s+/g,'-').slice(0,45);
export default function Factions({request,canEdit=false,previewOnly=false}){
 const [factions,setFactions]=useState([]);
 const [current,setCurrent]=useState('');
 const [events,setEvents]=useState([]);
 const [editing,setEditing]=useState(null);
 const [newFaction,setNewFaction]=useState(false);
 const [eventDraft,setEventDraft]=useState(null);
 const [query,setQuery]=useState('');
 const [filter,setFilter]=useState('all');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const editable=canEdit&&!previewOnly;
 async function reload(){
  const {factions:rows}=await request('/factions');
  setFactions(rows||[]);
  setCurrent(old=>(rows||[]).some(x=>x.id===old)?old:rows?.[0]?.id||'');
 }
 useEffect(()=>{reload().catch(e=>setError(e.message))},[]);
 useEffect(()=>{
  if(!current){setEvents([]);return}
  let active=true;
  request('/factions/'+current+'/events').then(data=>{if(active)setEvents(data.events||[])}).catch(e=>{if(active)setError(e.message)});
  return()=>{active=false}
 },[current]);
 const shown=useMemo(()=>factions.filter(x=>(filter==='all'||x.relationship===filter)&&
  [x.name,x.leader,x.description].join(' ').toLowerCase().includes(query.toLowerCase())),[factions,query,filter]);
 const chosen=factions.find(x=>x.id===current);
 async function save(){
  if(!editing)return;
  const data={...editing,sort_order:Number(editing.sort_order)};
  const id=newFaction?slug(data.name):chosen?.id;
  if(!id){setError('Enter a faction name.');return}
  setBusy(true);setError('');setNotice('');
  try{
   await request('/factions/'+id,{method:newFaction?'POST':'PUT',body:data});
   setEditing(null);setNewFaction(false);await reload();setCurrent(id);setNotice('Faction record saved.');
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function logEvent(){
  if(!chosen||!eventDraft)return;
  setBusy(true);setError('');
  try{
   await request('/factions/'+chosen.id+'/events',{method:'POST',body:eventDraft});
   const result=await request('/factions/'+chosen.id+'/events');
   setEvents(result.events||[]);setEventDraft(null);setNotice('Development added to the faction history.');
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 const relation=r=>RELATIONS[r]||RELATIONS.neutral;
 return <section className="faction-workspace">
  <div className="faction-header">
   <div><span className="faction-eyebrow">DIPLOMACY & INTRIGUE</span><h2>Factions of the realm</h2><p>Allies, rivals and enemies whose ambitions cross the Order's path.</p></div>
   {editable&&<button type="button" className="btn primary" onClick={()=>{setNewFaction(true);setEditing({...empty});setError('')}}>+ Add faction</button>}
  </div>
  {error&&<p className="alert" role="alert">{error}</p>}{notice&&<p className="faction-notice" role="status">{notice}</p>}
  <div className="faction-controls">
   <input aria-label="Search factions" placeholder="Search factions or leaders…" value={query} onChange={e=>setQuery(e.target.value)}/>
   <select aria-label="Filter faction relationships" value={filter} onChange={e=>setFilter(e.target.value)}>
    <option value="all">All relationships</option>{Object.entries(RELATIONS).map(([id,[name]])=><option value={id} key={id}>{name}</option>)}
   </select>
  </div>
  <div className="faction-layout">
   <div className="faction-list" aria-label="Faction list">{shown.map(f=><button type="button" key={f.id} className={'faction-list-item '+(current===f.id?'selected':'')} onClick={()=>{setCurrent(f.id);setEditing(null);setEventDraft(null);setNotice('')}} aria-pressed={current===f.id}>
    <span className="faction-symbol">✦</span><span className="faction-list-copy"><strong>{f.name}</strong><small>{f.leader}</small></span>
    <span className={'faction-relation '+relation(f.relationship)[1]}>{relation(f.relationship)[0]}</span>
   </button>)}{!shown.length&&<p className="faction-empty">No factions match your search.</p>}</div>
   <div className="faction-detail">
    {!chosen?<div className="faction-empty">Choose a faction to read its dossier.</div>:<>
     <div className="faction-dossier-top">
      <span className="faction-eyebrow">FACTION DOSSIER · {String(chosen.sort_order).padStart(2,'0')}</span>
      <span className={'faction-relation '+relation(chosen.relationship)[1]}>{relation(chosen.relationship)[0]}</span>
     </div>
     <h3>{chosen.name}</h3><p className="faction-leader"><span>Led by</span> {chosen.leader}</p>
     <div className="faction-rule"/>
     <p className="faction-description">{chosen.description}</p>
     {chosen.image_reference_url&&<a className="faction-reference" href={chosen.image_reference_url} target="_blank" rel="noreferrer noopener">View portrait reference</a>}
     {editable&&<div className="faction-edit-actions"><button type="button" className="btn secondary" onClick={()=>{setEditing({...chosen});setNewFaction(false)}}>Edit dossier</button>{!chosen.public_visible&&<span className="faction-private">Hidden from members</span>}</div>}
     {editable&&chosen.notes&&<section className="faction-command-notes"><h4>Order command notes</h4><p>{chosen.notes}</p></section>}
     <div className="faction-history-head"><div><span className="faction-eyebrow">THE CHANGING WORLD</span><h4>Faction history</h4></div>{editable&&<button type="button" className="btn secondary" onClick={()=>setEventDraft({title:'',details:'',occurred_on:''})}>+ Record development</button>}</div>
     {events.length?<div className="faction-timeline">{events.map(e=><article key={e.id} className="faction-history-entry"><time>{e.occurred_on?new Date(e.occurred_on).toLocaleDateString():new Date(e.created_at).toLocaleDateString()}</time><strong>{e.title}</strong><p>{e.details}</p></article>)}</div>:<p className="faction-history-empty">No developments recorded yet. The next chapter has not been written.</p>}
    </>}
   </div>
  </div>
  {editable&&editing&&<div className="faction-modal-backdrop" role="presentation"><div className="faction-modal" role="dialog" aria-modal="true" aria-label="Edit faction dossier">
   <div className="faction-modal-head"><h3>{newFaction?'New faction':'Edit faction dossier'}</h3><button type="button" onClick={()=>setEditing(null)} aria-label="Close editor">×</button></div>
   <div className="faction-fields">
    <label>Name<input value={editing.name} maxLength={100} onChange={e=>setEditing({...editing,name:e.target.value})}/></label>
    <label>Leader<input value={editing.leader} maxLength={100} onChange={e=>setEditing({...editing,leader:e.target.value})}/></label>
    <label>Relationship<select value={editing.relationship} onChange={e=>setEditing({...editing,relationship:e.target.value})}>{Object.entries(RELATIONS).map(([id,[name]])=><option key={id} value={id}>{name}</option>)}</select></label>
    <label>Display order<input type="number" min="0" max="999" value={editing.sort_order} onChange={e=>setEditing({...editing,sort_order:e.target.value})}/></label>
    <label className="wide">Faction description<textarea rows="4" maxLength={4500} value={editing.description} onChange={e=>setEditing({...editing,description:e.target.value})}/></label>
    <label className="wide">Portrait reference link<input type="url" value={editing.image_reference_url} maxLength={1500} onChange={e=>setEditing({...editing,image_reference_url:e.target.value})}/></label>
    <label className="wide">Private Order command notes<textarea rows="3" maxLength={6000} value={editing.notes} onChange={e=>setEditing({...editing,notes:e.target.value})}/></label>
    <label className="wide faction-visibility"><input type="checkbox" checked={!!editing.public_visible} onChange={e=>setEditing({...editing,public_visible:e.target.checked})}/> Visible to Order members</label>
   </div>
   <div className="faction-modal-actions"><button type="button" className="btn secondary" onClick={()=>setEditing(null)}>Cancel</button><button type="button" className="btn primary" disabled={busy} onClick={save}>Save faction</button></div>
  </div></div>}
  {editable&&eventDraft&&<div className="faction-modal-backdrop"><div className="faction-modal" role="dialog" aria-modal="true" aria-label="Record faction development">
   <div className="faction-modal-head"><h3>Record a development</h3><button type="button" onClick={()=>setEventDraft(null)} aria-label="Close history editor">×</button></div>
   <div className="faction-fields"><label className="wide">Title<input maxLength={140} value={eventDraft.title} onChange={e=>setEventDraft({...eventDraft,title:e.target.value})}/></label><label>Date (optional)<input type="date" value={eventDraft.occurred_on} onChange={e=>setEventDraft({...eventDraft,occurred_on:e.target.value})}/></label><label className="wide">What changed?<textarea rows="5" maxLength={5000} value={eventDraft.details} onChange={e=>setEventDraft({...eventDraft,details:e.target.value})}/></label></div>
   <div className="faction-modal-actions"><button type="button" className="btn secondary" onClick={()=>setEventDraft(null)}>Cancel</button><button type="button" className="btn primary" disabled={busy} onClick={logEvent}>Add to history</button></div>
  </div></div>}
 </section>;
}
