import React,{useEffect,useMemo,useState} from 'react';
import './factions.css';
import {factionColor} from './territory-ownership.js';

const RELATIONS={
 friendly:['Allied','friendly'],rival:['Rival','rival'],watchful_rival:['Watchful rival','watchful'],
 hostile:['Hostile','hostile'],neutral:['Neutral','neutral']
};
const SCORE_LABEL=value=>value<=-75?'Nemesis':value<=-40?'Hostile':value<=-10?'Unfriendly':value<10?'Neutral':value<40?'Cordial':value<75?'Friendly':'Exalted';
const repBar=(label,score)=> <div className="faction-rep-entry" key={label}><div className="faction-rep-head"><strong>{label}</strong><span>{SCORE_LABEL(score)} · {score>0?'+':''}{score}/100</span></div><div className="faction-rep-track" role="meter" aria-label={label} aria-valuemin={-100} aria-valuemax={100} aria-valuenow={Number(score)||0}><span className="faction-rep-zero"/><span className={'faction-rep-fill '+(score<0?'negative':'positive')} style={{left:(score<0?50+score/2:50)+'%',width:Math.abs(score)/2+'%'}}/></div></div>;
const empty={faction_scope:'world',name:'',leader:'',relationship:'neutral',description:'',notes:'',image_reference_url:'',public_visible:true,trade_enabled:true,map_color:'#688398',sort_order:100};
const slug=name=>name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 -]/g,'').trim().replace(/\s+/g,'-').slice(0,45);
export default function Factions({request,canEdit=false,previewOnly=false}){
 const [factions,setFactions]=useState([]);
 const [current,setCurrent]=useState('');
 const [events,setEvents]=useState([]);
 const [repHistory,setRepHistory]=useState([]);
 const [tradeContracts,setTradeContracts]=useState([]);
 const [repDraft,setRepDraft]=useState(null);
 const [accounts,setAccounts]=useState([]);
 const [encounters,setEncounters]=useState([]);
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
 useEffect(()=>{request('/commerce').then(data=>setTradeContracts(data.contracts||[])).catch(()=>{});reload().catch(e=>setError(e.message));if(editable){request('/factions/accounts').then(data=>setAccounts(data.accounts||[])).catch(()=>{});request('/encounters').then(setEncounters).catch(()=>{})}},[]);
 useEffect(()=>{
  if(!current){setEvents([]);return}
  let active=true;
  request('/factions/'+current+'/events').then(data=>{if(active)setEvents(data.events||[])}).catch(e=>{if(active)setError(e.message)});
  request('/factions/'+current+'/history').then(data=>{if(active)setRepHistory(data.changes||[])}).catch(e=>{if(active)setError(e.message)});
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
 async function awardRep(){
  if(!chosen||!repDraft)return;
  setBusy(true);setError('');setNotice('');
  try{
   await request('/factions/'+chosen.id+'/reputation',{method:'POST',body:{...repDraft,delta:Number(repDraft.delta),source_event_id:repDraft.source_event_id||null,account_id:repDraft.target==='player'?repDraft.account_id:null}});
   await reload();
   const history=await request('/factions/'+chosen.id+'/history');
   setRepHistory(history.changes||[]);setRepDraft(null);setNotice('Reputation updated and recorded in faction history.');
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 const relation=r=>RELATIONS[r]||RELATIONS.neutral;
 return <section className="faction-workspace">
  <div className="faction-header">
   <div><span className="faction-eyebrow">DIPLOMACY & INTRIGUE</span><h2>Factions of the realm</h2><p>Order diplomacy and independent reputations across the realm.</p></div>
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
   <div className="faction-list" aria-label="Faction list">
    {[
     {id:'order_story',title:'Factions connected to the Order',description:'Allies, enemies and rivals in the Order’s story'},
     {id:'world',title:'Other factions',description:'Guilds, organizations and independent groups'},
     {id:'settlement',title:'Settlements',description:'Towns and communities across the realm'}
    ].map(section=><section className="faction-list-section" key={section.id} aria-label={section.title}>
     <div className="faction-section-heading"><h3>{section.title}</h3><span className="faction-section-count">{shown.filter(f=>f.faction_scope===section.id).length}</span></div>
     {shown.filter(f=>f.faction_scope===section.id).map(f=><button type="button" key={f.id} className={'faction-list-item '+(current===f.id?'selected':'')} onClick={()=>{setCurrent(f.id);setEditing(null);setEventDraft(null);setNotice('')}} aria-pressed={current===f.id}>
      <span className="faction-symbol"><i className={'fa-solid fa-'+(section.id==='settlement'?'house':section.id==='world'?'earth-europe':'flag')}/></span><span className="faction-list-copy"><strong>{f.name}</strong><small>{f.leader}</small></span>
      <span className={'faction-relation '+relation(f.relationship)[1]}>{relation(f.relationship)[0]}</span>
     </button>)}
     {!shown.some(f=>f.faction_scope===section.id)&&<p className="faction-section-empty">{query||filter!=='all'?'No matching entries.':'No entries yet.'}</p>}
    </section>)}
   </div>
   <div className="faction-detail">
    {!chosen?<div className="faction-empty">Choose a faction to read its dossier.</div>:<>
     <div className="faction-dossier-top">
      <span className="faction-eyebrow">{chosen.faction_scope==='settlement'?'SETTLEMENT':chosen.faction_scope==='world'?'OTHER FACTION':'ORDER-CONNECTED FACTION'} · {String(chosen.sort_order).padStart(2,'0')}</span>
      <span className={'faction-relation '+relation(chosen.relationship)[1]}>{relation(chosen.relationship)[0]}</span>
     </div>
     <h3><span className="faction-map-swatch" style={{background:chosen.map_color||factionColor(chosen.id)}} aria-hidden="true"/>{chosen.name}</h3><p className="faction-leader"><span>Led by</span> {chosen.leader}</p>
     <div className="faction-rule"/>
     <p className="faction-description">{chosen.description}</p><p className="faction-trade-status"><i className={'fa-solid fa-'+(chosen.trade_enabled?'handshake':'ban')} aria-hidden="true"/> {chosen.trade_enabled?'Trade agreements permitted':'Trade with the Order closed'}</p>
     <section className="faction-reputations"><div className="faction-reputations-title"><span className="faction-eyebrow">RELATIONSHIPS</span><h4>Reputation & standing</h4></div>
      {repBar('The Order’s view of this faction',Number(chosen.order_view)||0)}{repBar('This faction’s view of the Order',Number(chosen.faction_view)||0)}
      {repBar('Your personal reputation',Number(chosen.personal_reputation)||0)}
      {editable&&<button type="button" className="btn secondary" onClick={()=>setRepDraft({target:chosen.faction_scope==='world'?'player':'order_view',account_id:'',delta:5,event_title:'',event_details:'',source_event_id:''})}>Record reputation change</button>}
     </section>
     {chosen.image_reference_url&&<a className="faction-reference" href={chosen.image_reference_url} target="_blank" rel="noreferrer noopener">View portrait reference</a>}
     {editable&&<div className="faction-edit-actions"><button type="button" className="btn secondary" onClick={()=>{setEditing({...chosen,map_color:chosen.map_color||factionColor(chosen.id)});setNewFaction(false)}}>Edit dossier</button>{!chosen.public_visible&&<span className="faction-private">Hidden from members</span>}</div>}
     {editable&&chosen.notes&&<section className="faction-command-notes"><h4>Order command notes</h4><p>{chosen.notes}</p></section>}
     {tradeContracts.some(c=>c.faction_id===chosen.id)&&<section className="faction-trade-section"><span className="faction-eyebrow">THE MERCHANT NETWORK</span><h4>Trade agreements</h4><p>Completed deliveries improve this faction's standing toward the Order.</p>{tradeContracts.filter(c=>c.faction_id===chosen.id).map(c=><article key={c.id}><div><strong>{c.title}</strong><small>{c.item_kind==='material'?c.material_name:c.equipment_name} · {c.status}</small></div><div><span>{c.delivered_quantity} / {c.required_quantity}</span><small>+{c.rep_per_unit} standing per item</small></div></article>)}</section>}
     <div className="faction-history-head"><div><span className="faction-eyebrow">THE CHANGING WORLD</span><h4>Faction history</h4></div>{editable&&<button type="button" className="btn secondary" onClick={()=>setEventDraft({title:'',details:'',occurred_on:''})}>+ Record development</button>}</div>
     {repHistory.length>0&&<div className="faction-timeline">{repHistory.map(e=><article className="faction-history-entry" key={'rep-'+e.id}><time>{new Date(e.created_at).toLocaleDateString()} · {e.target==='order_view'?'Order diplomacy':e.target==='faction_view'?'Faction diplomacy':'Personal reputation'} · {e.applied_delta>0?'+':''}{e.applied_delta}</time><strong>{e.event_title}</strong><p>{e.event_details}</p></article>)}</div>}
     {events.length?<div className="faction-timeline">{events.map(e=><article key={e.id} className="faction-history-entry"><time>{e.occurred_on?new Date(e.occurred_on).toLocaleDateString():new Date(e.created_at).toLocaleDateString()}</time><strong>{e.title}</strong><p>{e.details}</p></article>)}</div>:<p className="faction-history-empty">No general developments recorded yet.</p>}
    </>}
   </div>
  </div>
  {editable&&editing&&<div className="faction-modal-backdrop" role="presentation"><div className="faction-modal" role="dialog" aria-modal="true" aria-label="Edit faction dossier">
   <div className="faction-modal-head"><h3>{newFaction?'New faction':'Edit faction dossier'}</h3><button type="button" onClick={()=>setEditing(null)} aria-label="Close editor">×</button></div>
   <div className="faction-fields">
    <label>Name<input value={editing.name} maxLength={100} onChange={e=>setEditing({...editing,name:e.target.value})}/></label>
    <label>Leader<input value={editing.leader} maxLength={100} onChange={e=>setEditing({...editing,leader:e.target.value})}/></label>
    <label>Faction category<select value={editing.faction_scope||'order_story'} onChange={e=>setEditing({...editing,faction_scope:e.target.value})}><option value="order_story">Connected to the Order</option><option value="world">Other faction</option><option value="settlement">Settlement</option></select></label>
    <label>Relationship<select value={editing.relationship} onChange={e=>setEditing({...editing,relationship:e.target.value,trade_enabled:e.target.value==='hostile'?false:editing.trade_enabled})}>{Object.entries(RELATIONS).map(([id,[name]])=><option key={id} value={id}>{name}</option>)}</select></label>
    <label>Territory map color<div className="faction-color-field"><input type="color" value={editing.map_color||'#688398'} aria-label="Pick faction color" onChange={e=>setEditing({...editing,map_color:e.target.value})}/><input aria-label="Faction color hex" maxLength={7} value={editing.map_color||''} onChange={e=>setEditing({...editing,map_color:e.target.value})}/></div></label>
     <label>Display order<input type="number" min="0" max="999" value={editing.sort_order} onChange={e=>setEditing({...editing,sort_order:e.target.value})}/></label>
    <label className="wide">Faction description<textarea rows="4" maxLength={4500} value={editing.description} onChange={e=>setEditing({...editing,description:e.target.value})}/></label>
    <label className="wide">Portrait reference link<input type="url" value={editing.image_reference_url} maxLength={1500} onChange={e=>setEditing({...editing,image_reference_url:e.target.value})}/></label>
    <label className="wide">Private Order command notes<textarea rows="3" maxLength={6000} value={editing.notes} onChange={e=>setEditing({...editing,notes:e.target.value})}/></label>
    <label className="wide faction-visibility"><input type="checkbox" checked={!!editing.trade_enabled} onChange={e=>setEditing({...editing,trade_enabled:e.target.checked})}/> Allow Merchant Exchange orders and deliveries</label>
     <label className="wide faction-visibility"><input type="checkbox" checked={!!editing.public_visible} onChange={e=>setEditing({...editing,public_visible:e.target.checked})}/> Visible to Order members</label>
   </div>
   <div className="faction-modal-actions"><button type="button" className="btn secondary" onClick={()=>setEditing(null)}>Cancel</button><button type="button" className="btn primary" disabled={busy} onClick={save}>Save faction</button></div>
  </div></div>}
  {editable&&repDraft&&<div className="faction-modal-backdrop"><div className="faction-modal" role="dialog" aria-modal="true" aria-label="Record faction reputation">
   <div className="faction-modal-head"><h3>Record reputation change</h3><button type="button" aria-label="Close reputation editor" onClick={()=>setRepDraft(null)}>×</button></div>
   <div className="faction-fields">
    <label className="wide">Whose relationship changes?<select value={repDraft.target} onChange={e=>setRepDraft({...repDraft,target:e.target.value})}>
     <option value="order_view">The Order’s view of this faction</option><option value="faction_view">This faction’s view of the Order</option><option value="player">A member’s personal reputation</option>
    </select></label>
    {repDraft.target==='player'&&<label className="wide">Member<select value={repDraft.account_id} onChange={e=>setRepDraft({...repDraft,account_id:e.target.value})}><option value="">Choose a member</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.discord_username||a.display_name||'Member'}</option>)}</select></label>}
    <label className="wide">Connected Order event (optional)<select value={repDraft.source_event_id||''} onChange={e=>setRepDraft({...repDraft,source_event_id:e.target.value})}><option value="">Independent development</option>{encounters.map(event=><option key={event.id} value={event.id}>{event.name} · {event.status}</option>)}</select></label>
    <label>Reputation change (-100 to +100)<input type="number" min="-100" max="100" step="1" value={repDraft.delta} onChange={e=>setRepDraft({...repDraft,delta:e.target.value})}/></label>
    <label className="wide">Event or reason<input maxLength={140} value={repDraft.event_title} onChange={e=>setRepDraft({...repDraft,event_title:e.target.value})}/></label>
    <label className="wide">What happened?<textarea rows="4" maxLength={5000} value={repDraft.event_details} onChange={e=>setRepDraft({...repDraft,event_details:e.target.value})}/></label>
   </div><div className="faction-modal-actions"><button type="button" className="btn secondary" onClick={()=>setRepDraft(null)}>Cancel</button><button type="button" className="btn primary" disabled={busy||!repDraft.event_title.trim()||!repDraft.event_details.trim()||(repDraft.target==='player'&&!repDraft.account_id)} onClick={awardRep}>Record change</button></div>
  </div></div>}
  {editable&&eventDraft&&<div className="faction-modal-backdrop"><div className="faction-modal" role="dialog" aria-modal="true" aria-label="Record faction development">
   <div className="faction-modal-head"><h3>Record a development</h3><button type="button" onClick={()=>setEventDraft(null)} aria-label="Close history editor">×</button></div>
   <div className="faction-fields"><label className="wide">Title<input maxLength={140} value={eventDraft.title} onChange={e=>setEventDraft({...eventDraft,title:e.target.value})}/></label><label>Date (optional)<input type="date" value={eventDraft.occurred_on} onChange={e=>setEventDraft({...eventDraft,occurred_on:e.target.value})}/></label><label className="wide">What changed?<textarea rows="5" maxLength={5000} value={eventDraft.details} onChange={e=>setEventDraft({...eventDraft,details:e.target.value})}/></label></div>
   <div className="faction-modal-actions"><button type="button" className="btn secondary" onClick={()=>setEventDraft(null)}>Cancel</button><button type="button" className="btn primary" disabled={busy} onClick={logEvent}>Add to history</button></div>
  </div></div>}
 </section>;
}
