import React,{useEffect,useState} from 'react';
import {readFCSettings,writeFCSetting} from './apiBridge.js';
const FIELDS=[['welcome','Welcome announcement'],['house_rules','D&D and FC house rules'],['scene_guidelines','OOC safety and scene guidelines']];
export default function FCSettings({role}){
 const [data,setData]=useState(null),[edited,setEdited]=useState({}),[working,setWorking]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState('');
 const command=['domina','high_command'].includes(role);
 useEffect(()=>{let active=true;readFCSettings().then(result=>{if(active){setData(result);setEdited(result)}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[]);
 async function save(key){setWorking(true);setError('');setSaved('');try{await writeFCSetting(key,edited[key]||'');setData(old=>({...old,[key]:edited[key]||''}));setSaved(key)}catch(e){setError(e.message)}finally{setWorking(false)}}
 return <section className="panel" style={{marginTop:20}}>
   <div className="panel-heading"><div><h2>Published FC rules & guidance</h2><p>{command?'Edit commonly changed FC text without editing GitHub.':'Read the current rules and safety guidelines.'}</p></div></div>
   {error&&<div className="alert" role="alert">{error}</div>}
   {!data?<p className="muted">Loading rules…</p>:FIELDS.map(([key,label])=><div key={key} style={{marginBottom:22}}>
     <label className="field"><span>{label.toUpperCase()}</span>
      {command?<textarea rows={key==='welcome'?2:6} maxLength={12000} value={edited[key]||''} onChange={e=>setEdited(old=>({...old,[key]:e.target.value}))}/>:<div className="sheet-text" style={{whiteSpace:'pre-wrap'}}>{data[key]||'No policy set.'}</div>}
     </label>
     {command&&<button className="mini-btn" disabled={working||edited[key]===data[key]} onClick={()=>save(key)}>{saved===key?'Saved ✓':'Save '+label}</button>}
   </div>)}
   <div className="hint-box"><strong>Code-free, with safety limits</strong><p>These fields are plain text and cannot run code or override server permissions. Character mechanics and ranks still need the planned Rules Editor.</p></div>
 </section>;
}