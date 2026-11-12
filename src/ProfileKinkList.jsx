import React,{useEffect,useState} from 'react';
import {getMyKinkProfile,saveMyKinkProfile} from './apiBridge.js';
import './rp-profile.css';

export const KINK_RATINGS=[
 ['favorite','Favorite'],['yes','Yes'],['maybe','Maybe'],['no','No']
];
export function ProfileKinkList(){
 const [name,setName]=useState(''),[shareContent,setShareContent]=useState(false),[shareKinks,setShareKinks]=useState(false);
 const [entries,setEntries]=useState([]),[newLabel,setNewLabel]=useState(''),[newRating,setNewRating]=useState('maybe');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState('');
 useEffect(()=>{getMyKinkProfile().then(data=>{
  setName(data?.display_name||'');setShareContent(Boolean(data?.share_content));
  setShareKinks(Boolean(data?.share_kinks));setEntries(Array.isArray(data?.kink_entries)?data.kink_entries:[]);
 }).catch(e=>setMessage(e.message)).finally(()=>setLoading(false))},[]);
 async function save(){
  setBusy(true);setMessage('');
  try{await saveMyKinkProfile(name.trim(),shareContent,shareKinks,entries);setMessage('RP sharing and kink list saved. You can change or hide them at any time.')}
  catch(e){setMessage('Could not save: '+e.message)}
  finally{setBusy(false)}
 }
 function add(e){
  e.preventDefault();const label=newLabel.trim();
  if(!label||entries.length>=60||entries.some(x=>x.label.toLowerCase()===label.toLowerCase()))return;
  setEntries(list=>[...list,{label:label.slice(0,80),rating:newRating}]);setNewLabel('');
 }
 return <section className="panel kink-profile">
  <div className="panel-heading"><div><h2>My kink list & public RP profile</h2><p>Mark each interest as Favorite, Yes, Maybe, or No. Edit your choices whenever they change.</p></div></div>
  <div className="hint-box"><strong>Your choices are yours</strong><p>Favorite and Yes are general interests, not consent to any particular scene. Maybe means discuss first. No is a boundary, not an invitation to negotiate. This list and your content categories are private until you explicitly enable each sharing option.</p></div>
  {loading?<p className="muted">Loading your kink list…</p>:<>
   <label className="field kink-display"><span>VISIBLE RP DISPLAY NAME</span><input maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="A name other FC members recognize"/></label>
   <div className="rp-share-controls">
    <label><input type="checkbox" checked={shareContent} onChange={e=>setShareContent(e.target.checked)}/><span><strong>Show my RP content preferences to members</strong><small>Members see your Yes/No content categories, not your 18+ declaration or account email.</small></span></label>
    <label><input type="checkbox" checked={shareKinks} onChange={e=>setShareKinks(e.target.checked)}/><span><strong>Show my kink list to members</strong><small>Members see all categories, including No boundaries. Turn this off to hide the entire list.</small></span></label>
   </div>
   <div className="kink-list-header"><h3>Preferences <small>{entries.length}/60</small></h3><p>Starter labels are suggested for new profiles. Change each rating or remove any entry before saving; nothing is shared unless you opt in.</p></div>
   <form className="kink-entry-new" onSubmit={add}><input aria-label="New preference name" maxLength={80} placeholder="Add a preference or boundary" value={newLabel} onChange={e=>setNewLabel(e.target.value)}/><select aria-label="Preference rating" value={newRating} onChange={e=>setNewRating(e.target.value)}>{KINK_RATINGS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button className="btn secondary" type="submit" disabled={!newLabel.trim()||entries.length>=60}>Add</button></form>
   <div className="kink-entry-list">{entries.length?entries.map((item,i)=><div className="kink-entry" key={i}>
    <input aria-label={'Preference '+(i+1)} maxLength={80} value={item.label} onChange={e=>setEntries(old=>old.map((x,j)=>j===i?{...x,label:e.target.value}:x))}/>
    <select aria-label={'Rating for '+item.label} value={item.rating} onChange={e=>setEntries(old=>old.map((x,j)=>j===i?{...x,rating:e.target.value}:x))}>{KINK_RATINGS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
    <button type="button" className="mini-btn danger" onClick={()=>setEntries(old=>old.filter((_,j)=>j!==i))}>Remove</button>
   </div>):<div className="empty-kink-list">Your list is empty. Add preferences above and choose whether to share them.</div>}</div>
   <div className="rp-profile-save"><span>Profile sharing is opt-in and limited to signed-in adult members.</span><button className="btn primary" disabled={busy} onClick={save}>{busy?'Saving…':'Save kink list & sharing'}</button></div>
  </>}
  {message&&<div className="alert" role="status">{message}</div>}
 </section>;
}
