import React,{useEffect,useState} from 'react';
import {listSharedRPProfiles} from './apiBridge.js';
import {CONTENT_THEMES} from './ProfileConsent.jsx';
import {KINK_RATINGS} from './ProfileKinkList.jsx';
import './rp-profile.css';

const ratings=Object.fromEntries(KINK_RATINGS);
function PublicCard({member}){
 const [expanded,setExpanded]=useState(false);
 const themes=member.content_preferences;
 const entries=member.kink_entries;
 return <article className="panel public-rp-card">
  <div className="public-rp-head"><div><small>OPTED-IN MEMBER PROFILE</small><h3>{member.display_name}</h3><p>{member.shares_content?'RP content preferences':''}{member.shares_content&&member.shares_kinks?' · ':''}{member.shares_kinks?'Kink list':''}</p></div><button className="mini-btn" onClick={()=>setExpanded(!expanded)}>{expanded?'Hide details':'View shared profile'}</button></div>
  {expanded&&<>
   {themes&&<div className="public-rp-section"><h4>RP content preferences</h4><p>These are general preferences and never authorize a scene without ongoing OOC consent.</p><div className="public-theme-grid">{CONTENT_THEMES.map(([key,label])=><div className={'public-theme '+(themes[key]?'allowed':'not-allowed')} key={key}><strong>{label}</strong><span>{themes[key]?'Yes':'No / not opted in'}</span></div>)}<div className={'public-theme '+(themes.minor_transformation?'allowed':'not-allowed')}><strong>Transformation boundary</strong><span>{themes.full_transformation?'Minor & full':themes.minor_transformation?'Minor only':'No / not opted in'}</span></div></div></div>}
   {entries&&<div className="public-rp-section"><h4>Kink list</h4><p>These entries are shared voluntarily by this member.</p>{entries.length?<div className="public-kink-grid">{entries.map((entry,i)=><div className={'public-kink choice-'+entry.rating} key={i}><strong>{entry.label}</strong><span>{ratings[entry.rating]||entry.rating}</span></div>)}</div>:<p className="muted">No entries shared.</p>}</div>}
  </>}
 </article>;
}
export function MemberRPDirectory(){
 const [profiles,setProfiles]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[search,setSearch]=useState('');
 async function load(){setLoading(true);try{setProfiles(await listSharedRPProfiles());setError('')}catch(e){setError(e.message)}finally{setLoading(false)}}
 useEffect(()=>{load()},[]);
 const visible=profiles.filter(p=>p.display_name.toLowerCase().includes(search.trim().toLowerCase()));
 return <section className="member-profile-directory">
  <div className="panel directory-intro"><div><h2>Member RP profiles</h2><p>Browse the RP and kink information members have individually chosen to share. Other preferences remain private.</p></div><button className="mini-btn" onClick={load}>Refresh</button></div>
  <label className="field directory-search"><span>SEARCH SHARED PROFILES</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search display names"/></label>
  {loading?<p className="muted">Loading member profiles…</p>:error?<div className="alert" role="alert">{error}</div>:visible.length?<div className="directory-cards">{visible.map(p=><PublicCard key={p.user_id} member={p}/>)}</div>:<div className="panel"><h3>No shared profiles found</h3><p>Members can publish theirs using the sharing controls in My RP profile.</p></div>}
 </section>;
}
