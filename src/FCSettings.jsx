import React,{useEffect,useState} from 'react';
import {readFCSettings,writeFCSetting} from './apiBridge.js';
const FIELDS=[['welcome','Welcome announcement'],['house_rules','D&D and FC house rules'],['scene_guidelines','OOC safety and scene guidelines']];
export default function FCSettings({role,request}){
 const [data,setData]=useState(null),[edited,setEdited]=useState({}),[working,setWorking]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState('');
 const command=['domina','high_command'].includes(role);
 const domina=role==='domina';
 const [recruitment,setRecruitment]=useState(null),[recruitmentDraft,setRecruitmentDraft]=useState('open');
 const [recruitmentError,setRecruitmentError]=useState(''),[recruitmentNotice,setRecruitmentNotice]=useState(''),[recruitmentSaving,setRecruitmentSaving]=useState(false);
 useEffect(()=>{let active=true;request('/recruitment').then(result=>{if(active){setRecruitment(result.status);setRecruitmentDraft(result.status)}}).catch(()=>{if(active)setRecruitmentError('Recruitment status could not be loaded.')});return()=>{active=false}},[request]);
 async function saveRecruitment(){
  if(!domina||!recruitment||recruitment===recruitmentDraft)return;
  setRecruitmentSaving(true);setRecruitmentError('');setRecruitmentNotice('');
  try{const result=await request('/recruitment',{method:'PUT',body:{status:recruitmentDraft}});setRecruitment(result.status);setRecruitmentNotice('Recruitment is now '+result.status+'. The public site has been updated.')}
  catch(e){setRecruitmentError(e.message||'Unable to update recruitment.')}
  finally{setRecruitmentSaving(false)}
 }
 useEffect(()=>{let active=true;readFCSettings().then(result=>{if(active){setData(result);setEdited(result)}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[]);
 async function save(key){setWorking(true);setError('');setSaved('');try{await writeFCSetting(key,edited[key]||'');setData(old=>({...old,[key]:edited[key]||''}));setSaved(key)}catch(e){setError(e.message)}finally{setWorking(false)}}
 return <><section className="panel" style={{marginTop:20}}>
   <div className="panel-heading"><div><h2>Published FC rules & guidance</h2><p>{command?"Update the Order's announcements and house rules.":'Read the current rules and safety guidelines.'}</p></div></div>
   {error&&<div className="alert" role="alert">{error}</div>}
   {!data?<p className="muted">Loading rules…</p>:FIELDS.map(([key,label])=><div key={key} style={{marginBottom:22}}>
     <label className="field"><span>{label.toUpperCase()}</span>
      {command?<textarea rows={key==='welcome'?2:6} maxLength={12000} value={edited[key]||''} onChange={e=>setEdited(old=>({...old,[key]:e.target.value}))}/>:<div className="sheet-text" style={{whiteSpace:'pre-wrap'}}>{data[key]||'No policy set.'}</div>}
     </label>
     {command&&<button className="mini-btn" disabled={working||edited[key]===data[key]} onClick={()=>save(key)}>{saved===key?'Saved ✓':'Save '+label}</button>}
   </div>)}
 
 </section>
 <section className="panel eo-recruitment-settings" style={{marginTop:20}}>
  <div className="panel-heading"><div><h2>Recruitment</h2><p>Choose when new members may request admission to the Order.</p></div><span className={'eo-recruitment-status eo-recruitment-status-'+(recruitment||'unknown')}>{recruitment?recruitment.toUpperCase():'UNAVAILABLE'}</span></div>
  {recruitmentError&&<div className="alert" role="alert">{recruitmentError}</div>}
  {recruitmentNotice&&<p role="status" className="eo-recruitment-saved">{recruitmentNotice}</p>}
  {recruitment&&<><label className="field"><span>RECRUITMENT STATUS</span><select disabled={!domina||recruitmentSaving} value={domina?recruitmentDraft:recruitment} onChange={e=>setRecruitmentDraft(e.target.value)}><option value="open">Open — Accept applications</option><option value="limited">Limited — Selective recruitment</option><option value="closed">Closed — No new applications</option></select></label>
   <p className="muted">{(domina?recruitmentDraft:recruitment)==='closed'?'The Order is not accepting new members. Existing members can still sign in.':(domina?recruitmentDraft:recruitment)==='limited'?'Applications remain open, but entry is selective.':'The Order is accepting applications.'}</p>
   {domina&&<button type="button" className="btn primary" disabled={recruitmentSaving||recruitment===recruitmentDraft} onClick={saveRecruitment}>{recruitmentSaving?'Saving…':'Update recruitment status'}</button>}</>}
 </section></>;
}