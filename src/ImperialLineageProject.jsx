import React,{useEffect,useState} from 'react';
import './imperial-lineage.css';
const blankProject={title:'',objective:'',status:'planned'};
const blankCase={project_id:'',character_id:'',designation:'',method:'',observations:'',lineage_markers:'',result:'ongoing',pregnancy_linked:false};
const stateName=s=>String(s||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

export default function ImperialLineageProject({request}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [selected,setSelected]=useState(null),[dialog,setDialog]=useState(null),[form,setForm]=useState(null),[search,setSearch]=useState('');
 async function load(){const r=await request('/thralls/lineage');setData(r);setSelected(old=>old&&r.projects.some(p=>p.id===old)?old:r.projects[0]?.id||null)}
 useEffect(()=>{load().catch(e=>setError(e.message||'Research registry unavailable'))},[]);
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
    <div className="lineage-case-list">{cases.filter(c=>[c.designation,c.character_name,c.lineage_markers].join(' ').toLowerCase().includes(search.toLowerCase())).map(c=><article key={c.id}><div><span>{stateName(c.result)} {c.pregnancy_linked?'· GESTATION LINKED':''}</span><h4>{c.designation}</h4><p>{c.character_name||'Unlinked research record'}</p><p>{c.method||'No method recorded'}</p>{c.lineage_markers&&<small>Observed traits: {c.lineage_markers}</small>}</div><button type="button" onClick={()=>openCase(c)}>Manage</button></article>)}{!cases.length&&<p className="lineage-empty">No research cases yet. Create a case to record an experiment or investigation.</p>}</div>
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
     <label className="full">Research method<textarea rows={3} maxLength={900} value={form.method} onChange={e=>setForm({...form,method:e.target.value})}/></label>
     <label className="full">Observed lineage traits<input maxLength={600} value={form.lineage_markers} onChange={e=>setForm({...form,lineage_markers:e.target.value})}/></label>
     <label className="full">Observations<textarea rows={4} maxLength={8000} value={form.observations||''} onChange={e=>setForm({...form,observations:e.target.value})}/></label>
     <label className="lineage-check full"><input type="checkbox" checked={!!form.pregnancy_linked} disabled={!form.character_id} onChange={e=>setForm({...form,pregnancy_linked:e.target.checked})}/> Link to currently active pregnancy</label>
     <p className="lineage-hint full">Only character sheets with authorized research access can be linked. Pregnancy association is verified against the current character record.</p>
    </>}
    <footer><button type="button" disabled={busy} onClick={()=>setDialog(null)}>Cancel</button><button type="submit" disabled={busy||dialog==='case'&&!form.project_id}>{busy?'Saving…':'Save record'}</button></footer>
   </form>
  </section></div>}
 </section>;
}
