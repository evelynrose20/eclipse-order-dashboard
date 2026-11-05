import React,{useEffect,useState} from 'react';
import {getMyPreferences,saveMyPreferences} from './apiBridge.js';
import {ProfileKinkList} from './ProfileKinkList.jsx';
export const CONTENT_THEMES=[
 ['violence','Violence & combat'],['horror','Horror & fear'],['captivity','Captivity & restraint'],
 ['mind_control','Magical mind control'],['humiliation','Humiliation'],['body_horror','Body horror & transformation'],
 ['romance','Romance'],['sexual_themes','Adult sexual themes'],['character_death','Character death']
];
export function ProfileConsent(){
 const [adult,setAdult]=useState(false),[prefs,setPrefs]=useState({}),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{getMyPreferences().then(data=>{setAdult(Boolean(data?.adult_declaration));setPrefs(data?.content_preferences||{})}).catch(e=>setMessage(e.message)).finally(()=>setLoading(false))},[]);
 async function save(){setSaving(true);setMessage('');try{await saveMyPreferences(adult,prefs);setMessage('Profile content preferences saved. You can change them at any time.')}catch(e){setMessage(e.message)}finally{setSaving(false)}}
 async function toggleAdult(next){
  if(saving)return;
  const previous=adult;
  setAdult(next);setSaving(true);setMessage('Saving adult-only declaration…');
  try{await saveMyPreferences(next,prefs);setMessage(next?'18+ declaration saved. Encounter access now follows this setting.':'18+ declaration withdrawn; encounter access disabled.')}
  catch(e){setAdult(previous);setMessage('Could not save declaration: '+e.message)}
  finally{setSaving(false)}
 }
 return <div className="rp-profile-stack"><section className="panel content-profile">
  <div className="panel-heading"><div><h2>My RP content preferences</h2><p>Set your OOC boundaries on your account, not separately in every scene.</p></div></div>
  <div className="hint-box"><strong>OOC preferences, always yours</strong><p>Only you can edit these selections. They stay private unless you turn on RP content sharing below. An enabled category means you're generally open to it, not that you consent to every action. You may pause, decline or withdraw participation at any time—even when your character cannot do so IC.</p></div>
  {loading?<p>Loading profile preferences…</p>:<>
   <div className="profile-adult-row"><label className="profile-adult-check"><input type="checkbox" checked={adult} disabled={saving} onChange={e=>toggleAdult(e.target.checked)}/> I confirm I am 18 or older and understand this is an adult RP community.</label><button className="btn primary" disabled={saving} onClick={save}>{saving?'Saving…':'Save profile preferences'}</button></div><p className="muted">The 18+ declaration saves automatically when changed. Use Save for your content category choices.</p>
   <div className="profile-theme-grid">{CONTENT_THEMES.map(([key,label])=><label key={key} className={'profile-theme '+(prefs[key]?'enabled':'')}><input type="checkbox" checked={Boolean(prefs[key])} onChange={e=>setPrefs(p=>({...p,[key]:e.target.checked}))}/><span>{label}</span><small>{prefs[key]?'Generally allowed':'Not opted in'}</small></label>)}</div>
   <p className="muted">Default is not opted in. Encounter eligibility always checks your private saved categories. Other members see them only if you explicitly publish your RP content profile. No identity documents are collected.</p>
   <button className="btn primary" disabled={saving} onClick={save}>{saving?'Saving…':'Save my profile'}</button>
  </>}
  {message&&<div className="alert" role="status">{message}</div>}
 </section><ProfileKinkList/></div>;
}
