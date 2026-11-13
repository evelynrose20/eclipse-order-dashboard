import React,{useEffect,useState} from 'react';
import LineageViews from './LineageViews.jsx';
import LineageParticipant from './LineageParticipant.jsx';
import {LINEAGE_TRAITS,LINEAGE_ROLES,LINEAGE_STAGES,OFFSPRING_STAGES} from './lineageTraits.js';
import './imperial-lineage.css';
const blankProject={title:'',objective:'',status:'planned'};
const blankCase={project_id:'',character_id:'',designation:'',method:'',observations:'',lineage_markers:'',result:'ongoing',pregnancy_linked:false,
 lineage_type:'standard',subject_role:'carrier',expression_stage:'none',traits:[],offspring_stage:'not_recorded',offspring_traits:[],
 participant_note:'',parenthood_note:'',void_revealed:false};
const stateName=s=>String(s||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

export default function ImperialLineageProject({request,participantOnly=false,readOnly=false}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [selected,setSelected]=useState(null),[dialog,setDialog]=useState(null),[form,setForm]=useState(null),[search,setSearch]=useState('');
 const [view,setView]=useState('cases');
 async function load(){const r=await request('/thralls/lineage');setData(r);setSelected(old=>old&&r.projects.some(p=>p.id===old)?old:r.projects[0]?.id||null)}
 useEffect(()=>{if(!participantOnly)load().catch(e=>setError(e.message||'Research registry unavailable'))},[participantOnly]);
 function openProject(project){setDialog('project');setForm(project?{...project}:{...blankProject})}
 function openCase(entry){setDialog('case');setForm(entry?{...entry,pregnancy_linked:!!entry.pregnancy_linked}:{...blankCase,project_id:selected||''})}
 async function save(e){
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   if(dialog==='project'){
    const exists=!!form.id;
    await request('/thralls/lineage/projects'+(exists?'/'+form.id:''),{method:exists?'PUT':'POST',body:{title:form.title,objective:form.objective,status:form.status}});
   }else{
    const exists=!!form.id;
    await request('/thralls/lineage/cases'+(exists?'/'+form.id:''),{method:exists?'PUT':'POST',body:{...form,project_id:Number(form.project_id),character_id:form.character_id||null,pregnancy_linked:!!form.pregnancy_linked}});
   }
   await load();setDialog(null);setForm(null);setNotice('Research record saved.');
  }catch(err){setError(err.message||'Unable to save research record')}
  finally{setBusy(false)}
 }
 const projects=data?.projects||[],cases=(data?.cases||[]).filter(c=>c.project_id===selected),eligible=data?.eligible||[];
 const project=projects.find(p=>p.id===selected);
 if(participantOnly)return <LineageParticipant request={request} readOnly={readOnly}/>;
 return <section className="lineage-command">
  <div className="lineage-command-head"><div><span>OFFICE OF THE STEWARDS · RESTRICTED RESEARCH</span><h2>Imperial Lineage Project</h2><p>Heredity studies, aetheric reconstruction and research observations</p></div><button type="button" onClick={()=>openProject()}><i className="fa-solid fa-plus"/> New program</button></div>
  {error&&<p className="lineage-error" role="alert">{error.replaceAll('_',' ')}</p>}
  {notice&&<p className="lineage-notice" role="status">{notice}</p>}
  {!data?<p className="lineage-empty">Opening research registry…</p>:<div className="lineage-layout">
   <aside className="lineage-directory"><div className="lineage-directory-title">Research programs <small>{projects.length}</small></div>
    {projects.map(p=><button className={selected===p.id?'selected':''} key={p.id} type="button" onClick={()=>setSelected(p.id)}><strong>{p.title}</strong><span>{stateName(p.status)}</span></button>)}
    {!projects.length&&<p>No research programs have been established.</p>}
   </aside>
   <div className="lineage-detail">{project?<><div className="lineage-detail-head"><div><span>{stateName(project.status)} · RESEARCH PROGRAM</span><h3>{project.title}</h3><p>{project.objective||'No research objective recorded.'}</p></div><button type="button" onClick={()=>openProject(project)}><i className="fa-solid fa-pen"/> Manage program</button></div>
    <div className="lineage-list-head"><strong>Research cases <small>{cases.length}</small></strong><div><input aria-label="Filter research cases" placeholder="Find a case…" value={search} onChange={e=>setSearch(e.target.value)}/><button type="button" onClick={()=>openCase()}><i className="fa-solid fa-plus"/> Add case</button></div></div>
    <LineageViews cases={cases.filter(c=>[c.designation,c.character_name,c.lineage_markers].join(' ').toLowerCase().includes(search.toLowerCase()))} tab={view} onTab={setView} staff onManage={openCase}/>
    </>:<p className="lineage-empty">Select a research program to inspect its cases.</p>}</div>
  </div>}
  {dialog&&<div className="lineage-modal-mask" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setDialog(null)}}><section className="lineage-modal" role="dialog" aria-modal="true" aria-label={dialog==='project'?'Research program editor':'Research case editor'}>
   <header><div><span>RESTRICTED RECORD</span><h3>{dialog==='project'?'Research program':'Research case'}</h3></div><button type="button" onClick={()=>setDialog(null)} disabled={busy} aria-label="Close editor"><i className="fa-solid fa-xmark"/></button></header>
   <form onSubmit={save} className="lineage-form">
    {dialog==='project'?<><label>Program name<input required maxLength={130} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{['planned','active','paused','completed','archived'].map(x=><option key={x} value={x}>{stateName(x)}</option>)}</select></label><label className="full">Objective<textarea maxLength={900} rows={3} value={form.objective} onChange={e=>setForm({...form,objective:e.target.value})}/></label></>:<>
     <label>Research program<select value={form.project_id} required onChange={e=>setForm({...form,project_id:e.target.value})}>{projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
     <label>Case designation<input required maxLength={130} value={form.designation} onChange={e=>setForm({...form,designation:e.target.value})}/></label>
     <label>Authorized character<select value={form.character_id||''} onChange={e=>setForm({...form,character_id:e.target.value,pregnancy_linked:false})}><option value="">No character linked</option>{eligible.map(c=><option key={c.id} value={c.id}>{c.character_name}</option>)}</select></label>
     <label>Finding<select value={form.result} onChange={e=>setForm({...form,result:e.target.value})}>{['ongoing','inconclusive','promising','unsuccessful','confirmed'].map(x=><option key={x} value={x}>{stateName(x)}</option>)}</select></label>
     <label>Research classification<select value={form.lineage_type||'standard'} onChange={e=>setForm({...form,lineage_type:e.target.value})}><option value="standard">Standard heredity</option><option value="voidsent">Voidsent lineage</option></select></label>
     {form.lineage_type==='voidsent'&&<>
      <label>Subject role<select value={form.subject_role||'carrier'} onChange={e=>setForm({...form,subject_role:e.target.value,traits:[]})}>{LINEAGE_ROLES.map(x=><option key={x} value={x}>{stateName(x)}</option>)}</select></label>
      <label>Expression stage<select value={form.expression_stage||'none'} onChange={e=>setForm({...form,expression_stage:e.target.value})}>{LINEAGE_STAGES.map(x=><option key={x} value={x}>{stateName(x)}</option>)}</select></label>
      <label className="full">Observed trait markers<div className="lineage-trait-options">{LINEAGE_TRAITS.filter(t=>t.kind===(form.subject_role||'carrier')).map(trait=><label key={trait.id}><input type="checkbox" checked={(form.traits||[]).includes(trait.id)} onChange={e=>setForm({...form,traits:e.target.checked?[...(form.traits||[]),trait.id]:(form.traits||[]).filter(x=>x!==trait.id)})}/>{trait.name}</label>)}</div></label>
      <label className="full">Participant-visible changes and effects<textarea rows={3} maxLength={1200} value={form.participant_note||''} onChange={e=>setForm({...form,participant_note:e.target.value})}/></label>
      <label className="lineage-check full"><input type="checkbox" checked={!!form.void_revealed} onChange={e=>setForm({...form,void_revealed:e.target.checked})}/> Reveal the voidsent classification and hereditary markers to the participant</label>
      <p className="lineage-hint full">Source cases can record aetheric and dream resonance without physical changes. Carrier cases use minor visual effects; descendants may have full hereditary markers. These are fictional research observations, not automatic character mutations.</p>
      <label>Lineage parenthood status<select value={form.offspring_stage||'not_recorded'} onChange={e=>setForm({...form,offspring_stage:e.target.value})}>{OFFSPRING_STAGES.map(x=><option key={x} value={x}>{stateName(x)}</option>)}</select></label>
      <label className="full">Possible inherited traits<div className="lineage-trait-options">{LINEAGE_TRAITS.filter(t=>t.kind==='descendant').map(trait=><label key={trait.id}><input type="checkbox" checked={(form.offspring_traits||[]).includes(trait.id)} onChange={e=>setForm({...form,offspring_traits:e.target.checked?[...(form.offspring_traits||[]),trait.id]:(form.offspring_traits||[]).filter(x=>x!==trait.id)})}/>{trait.name}</label>)}</div></label>
      <label className="full">Lineage parenthood observations<textarea rows={3} maxLength={1200} value={form.parenthood_note||''} onChange={e=>setForm({...form,parenthood_note:e.target.value})}/></label>
     </>}
     <label className="full">Research method<textarea rows={3} maxLength={900} value={form.method} onChange={e=>setForm({...form,method:e.target.value})}/></label>
     <label className="full">Research markers (free text)<input maxLength={600} value={form.lineage_markers} onChange={e=>setForm({...form,lineage_markers:e.target.value})}/></label>
     <label className="full">Observations<textarea rows={4} maxLength={8000} value={form.observations||''} onChange={e=>setForm({...form,observations:e.target.value})}/></label>
     <label className="lineage-check full"><input type="checkbox" checked={!!form.pregnancy_linked} disabled={!form.character_id} onChange={e=>setForm({...form,pregnancy_linked:e.target.checked})}/> Link to currently active pregnancy</label>
     <p className="lineage-hint full">Only character sheets with authorized research access can be linked. Pregnancy association is verified against the current character record.</p>
    </>}
    <footer><button type="button" disabled={busy} onClick={()=>setDialog(null)}>Cancel</button><button type="submit" disabled={busy||dialog==='case'&&!form.project_id}>{busy?'Saving…':'Save record'}</button></footer>
   </form>
  </section></div>}
 </section>;
}
