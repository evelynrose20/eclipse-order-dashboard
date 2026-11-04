import React,{useEffect,useState} from 'react';
import {getMyPreferences,saveMyPreferences} from './supabase.js';
export const CONTENT_THEMES=[
 ['violence','Violence & combat'],['horror','Horror & fear'],['captivity','Captivity & restraint'],
 ['mind_control','Magical mind control'],['humiliation','Humiliation'],['body_horror','Body horror & transformation'],
 ['romance','Romance'],['sexual_themes','Adult sexual themes'],['character_death','Character death']
];
export function ProfileConsent(){
 const [adult,setAdult]=useState(false),[prefs,setPrefs]=useState({}),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{getMyPreferences().then(data=>{setAdult(Boolean(data?.adult_declaration));setPrefs(data?.content_preferences||{})}).catch(e=>setMessage(e.message)).finally(()=>setLoading(false))},[]);
 async function save(){setSaving(true);setMessage('');try{await saveMyPreferences(adult,prefs);setMessage('Profile content preferences saved. You can change them at any time.')}catch(e){setMessage(e.message)}finally{setSaving(false)}}
 return <section className="panel content-profile">
  <div className="panel-heading"><div><h2>My RP content preferences</h2><p>Set your OOC boundaries on your account, not separately in every scene.</p></div></div>
  <div className="hint-box"><strong>OOC preferences, always yours</strong><p>Only your account can read or edit these selections. An enabled category means you're generally open to it, not that you consent to every action. You may pause, decline or withdraw participation at any time—even when your character cannot do so IC.</p></div>
  {loading?<p>Loading profile preferences…</p>:<>
   <label className="profile-adult-check"><input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)}/> I confirm I am 18 or older and understand this is an adult RP community.</label>
   <div className="profile-theme-grid">{CONTENT_THEMES.map(([key,label])=><label key={key} className={'profile-theme '+(prefs[key]?'enabled':'')}><input type="checkbox" checked={Boolean(prefs[key])} onChange={e=>setPrefs(p=>({...p,[key]:e.target.checked}))}/><span>{label}</span><small>{prefs[key]?'Generally allowed':'Not opted in'}</small></label>)}</div>
   <p className="muted">Default is not opted in. These preferences are private and enforced when joining an encounter's declared content categories. No identity documents are uploaded or stored here. Account admission to adult RP remains a separate staff moderation decision.</p>
   <button className="btn primary" disabled={saving} onClick={save}>{saving?'Saving…':'Save my profile'}</button>
  </>}
  {message&&<div className="alert" role="status">{message}</div>}
 </section>;
}
