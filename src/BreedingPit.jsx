import React,{useEffect,useMemo,useState} from 'react';
import './breeding-pit.css';

const tidy=value=>String(value||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const date=value=>value?new Date(value).toLocaleString():'—';
const options={scout:'Reconnaissance',assault:'Frontline assault',support:'Aetheric support'};
const progress=(start,end,now)=>Math.min(100,Math.max(0,Math.round(100*(new Date(now)-new Date(start))/Math.max(1,new Date(end)-new Date(start)))));
const emptyProject=()=>({strain_id:'',mode:'vat',host_character_id:'',notes:''});
const emptyStrain=()=>({name:'',description:'',role:'scout',incubation_days:2,maturation_days:2,hatch_yield:2});
const badge=(state)=>['hatched','ready','deployed'].includes(state)?'complete':state==='cancelled'?'cancelled':'pending';

export default function BreedingPit({request}){
 const [data,setData]=useState(null),[tab,setTab]=useState('incubation');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [dialog,setDialog]=useState(''),[project,setProject]=useState(emptyProject()),[strain,setStrain]=useState(emptyStrain());
 const [deployment,setDeployment]=useState({cohort_id:'',installation_id:''});
 async function reload(){const result=await request('/thralls/breeding-pit');setData(result)}
 useEffect(()=>{let active=true;request('/thralls/breeding-pit').then(x=>{if(active)setData(x)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[]);
 useEffect(()=>{const timer=setInterval(()=>reload().catch(()=>{}),60000);return()=>clearInterval(timer)},[]);
 async function run(action,values={},success='Records updated'){
  setBusy(true);setError('');setNotice('');
  try{await request('/thralls/breeding-pit/actions',{method:'POST',body:{action,...values}});await reload();setDialog('');setNotice(success);return true}
  catch(e){setError(e.message||'The operation could not be completed');return false}
  finally{setBusy(false)}
 }
 const incubations=data?.incubations||[],cohorts=data?.cohorts||[],strains=data?.strains||[];
 const running=incubations.filter(x=>x.status==='incubating');
 const nursery=cohorts.filter(x=>x.status!=='deployed');
 const assignments=data?.installations||[];
 const now=data?.server_time||new Date().toISOString();
 const activeTotal=nursery.reduce((total,x)=>total+Number(x.quantity),0);
 const readyCohorts=useMemo(()=>nursery.filter(x=>new Date(x.mature_at)<=new Date(now)),[data]);
 const initial=project.strain_id||String(strains[0]?.id||'');
 if(!data&&!error)return <section className="brood-root"><div className="brood-panel">Opening the Brood Pit…</div></section>;
 return <section className="brood-root">
  <header className="brood-hero"><div><span className="brood-kicker"><i className="fa-solid fa-dungeon"/> LOWER VAULTS · BIO-ARCANE DIVISION</span><h2>Breeding Pit</h2><p>Brood cultivation, incubation, nursery development and military assignment</p></div>
   <div className="brood-mark"><i className="fa-solid fa-egg"/></div>
  </header>
  {error&&<div className="brood-alert" role="alert">{error} {!data&&<button type="button" onClick={()=>reload().then(()=>setError('')).catch(e=>setError(e.message))}>Retry</button>}</div>}
  {notice&&<div className="brood-success" role="status">{notice}</div>}
  {data&&<>
   <div className="brood-metrics">
    <div><span>ACTIVE INCUBATIONS</span><strong>{running.length} <small>/ {data.capacity.incubators}</small></strong><small>Occupied incubation spaces</small></div>
    <div><span>NURSERY CAPACITY</span><strong>{activeTotal} <small>/ {data.capacity.nursery}</small></strong><small>Undeployed creatures</small></div>
    <div><span>MATURE BROODS</span><strong>{readyCohorts.reduce((s,c)=>s+Number(c.quantity),0)}</strong><small>Available for army transfer</small></div>
    <div><span>REGISTERED STRAINS</span><strong>{strains.length}</strong><small>Distinct brood lines</small></div>
   </div>
   <div className="brood-toolbar">
    <nav aria-label="Breeding Pit areas">
     {[['incubation','Incubation','egg'],['nursery','Nursery','seedling'],['strains','Brood strains','dna'],['military','Military transfer','shield-halved'],['history','Activity ledger','clock-rotate-left']].map(([id,label,icon])=><button key={id} type="button" className={tab===id?'active':''} onClick={()=>setTab(id)}><i className={'fa-solid fa-'+icon}/> {label}</button>)}
    </nav>
    <button type="button" className="brood-refresh" onClick={()=>reload().catch(e=>setError(e.message))}><i className="fa-solid fa-rotate"/> Refresh</button>
   </div>
   {tab==='incubation'&&<div className="brood-panel">
    <div className="brood-heading"><div><small>01 / DEVELOPMENT</small><h3>Incubation Registry</h3><p>Eggs develop in a sealed growth vat or within a registered character-hosted story project. Each incubation uses one egg.</p></div>{data.can_manage&&<button type="button" className="brood-primary" onClick={()=>{setProject(emptyProject());setDialog('project')}} disabled={running.length>=data.capacity.incubators}><i className="fa-solid fa-plus"/> Begin incubation</button>}</div>
    {!incubations.length?<div className="brood-empty"><i className="fa-solid fa-egg"/><strong>No incubation projects</strong><p>Start a project using an available brood strain and egg from the strain registry.</p></div>:
    <div className="brood-projects">{incubations.map(item=>{
     const pct=progress(item.started_at,item.ready_at,now),ready=pct===100;
     return <article className="brood-project" key={item.id}>
      <div className="brood-project-top"><div><small>PROJECT #{item.id} · {item.incubation_mode==='vat'?'GROWTH VAT':'HOST INCUBATION'}</small><h4>{item.strain_name}</h4></div><span className={'brood-tag '+badge(item.status)}>{item.status==='incubating'&&ready?'Ready to hatch':tidy(item.status)}</span></div>
      <p className="brood-muted">{item.incubation_mode==='host'?'Host: '+(item.host_name||'Unknown character'):'Self-contained magitek growth vessel'}</p>
      {item.status==='incubating'&&<><div className="brood-progress"><span style={{width:pct+'%'}}/></div><div className="brood-progress-caption"><span>{pct}% developed</span><span>{ready?'Mature egg': 'Hatch window: '+date(item.ready_at)}</span></div></>}
      {item.notes&&<p className="brood-project-notes">{item.notes}</p>}
      {item.status==='incubating'&&data.can_manage&&<div className="brood-actions"><button disabled={busy||!ready||data.capacity.nursery_used>=data.capacity.nursery} onClick={()=>run('hatch',{incubation_id:Number(item.id)},'Brood moved to the nursery.')}>Hatch specimen</button><button className="danger" disabled={busy} onClick={()=>run('cancel',{incubation_id:Number(item.id)},'Incubation cancelled; egg returned to stock.')}>Cancel</button></div>}
     </article>;
    })}</div>}
   </div>}
   {tab==='nursery'&&<div className="brood-panel">
    <div className="brood-heading"><div><small>02 / NURSERY</small><h3>Hatchling Development</h3><p>Hatched broods require maturation time before they can be deployed. Nursery capacity is shared across all strains.</p></div></div>
    {!cohorts.length?<div className="brood-empty"><i className="fa-solid fa-seedling"/><strong>No hatched broods</strong><p>Hatch a mature incubation project to begin nursery development.</p></div>:<div className="brood-projects">{cohorts.map(c=>{
     const matured=new Date(c.mature_at)<=new Date(now);
     return <article key={c.id} className="brood-project">
      <div className="brood-project-top"><div><small>COHORT #{c.id} · {options[c.role]}</small><h4>{c.strain_name}</h4></div><span className={'brood-tag '+(c.status==='deployed'?'complete':matured?'complete':'pending')}>{c.status==='deployed'?'Deployed':matured?'Combat ready':'Growing'}</span></div>
      <div className="brood-cohort-quantity"><strong>{c.quantity}</strong><span>creatures</span></div>
      <p className="brood-muted">{c.status==='deployed'?'Transferred to military garrison':matured?'Training completed · ready for army assignment':'Maturity expected: '+date(c.mature_at)}</p>
      {c.status!=='deployed'&&matured&&data.can_deploy&&<button type="button" onClick={()=>{setDeployment({cohort_id:String(c.id),installation_id:String(assignments[0]?.id||'')});setDialog('deploy')}}>Assign to army</button>}
     </article>;
    })}</div>}
   </div>}
   {tab==='strains'&&<div className="brood-panel">
    <div className="brood-heading"><div><small>03 / SPECIMENS</small><h3>Brood Strain Catalog</h3><p>Register new strains, cultivate egg stock once per day and establish development times for each military creature type.</p></div>{data.can_manage&&<button type="button" className="brood-primary" onClick={()=>{setStrain(emptyStrain());setDialog('strain')}}><i className="fa-solid fa-plus"/> Register strain</button>}</div>
    <div className="brood-strains">{strains.map(s=><article key={s.id} className="brood-strain">
     <div className="brood-strain-icon"><i className={'fa-solid fa-'+({scout:'eye',assault:'shield',support:'wand-magic-sparkles'}[s.role]||'egg')}/></div>
     <div className="brood-project-top"><div><small>{options[s.role]}</small><h4>{s.name}</h4></div><span className="brood-tag pending">{s.egg_stock} eggs</span></div>
     <p className="brood-muted">{s.description}</p><div className="brood-strain-stats"><span><strong>{s.incubation_days}d</strong> Incubation</span><span><strong>{s.maturation_days}d</strong> Maturation</span><span><strong>{s.hatch_yield}</strong> Per hatch</span></div>
     {data.can_manage&&<button type="button" disabled={busy||Number(s.egg_stock)>=24||(s.last_cultivation_day&&String(s.last_cultivation_day).slice(0,10)===new Date(now).toISOString().slice(0,10))} onClick={()=>run('cultivate',{strain_id:Number(s.id)},'Egg stock replenished.')}>Cultivate eggs (+2/day)</button>}
    </article>)}</div>
   </div>}
   {tab==='military'&&<div className="brood-panel">
    <div className="brood-heading"><div><small>04 / WAR BROODS</small><h3>Military Assignment</h3><p>Mature broods can be transferred into an operational military installation as counted garrison units. A completed transfer cannot be claimed twice.</p></div></div>
    {data.can_deploy?<><div className="brood-assignment-list">{readyCohorts.map(c=><div key={c.id} className="brood-assignment"><div><strong>{c.strain_name}</strong><small>Cohort #{c.id} · {c.quantity} units · {options[c.role]}</small></div><button disabled={busy||!assignments.length} onClick={()=>{setDeployment({cohort_id:String(c.id),installation_id:String(assignments[0]?.id||'')});setDialog('deploy')}}>Assign to garrison</button></div>)}</div>
    {!readyCohorts.length&&<div className="brood-empty"><strong>No mature undeployed broods</strong><p>Hatch incubations, then allow their cohorts to mature before transferring them.</p></div>}
    {!assignments.length&&<p className="brood-muted">No eligible operational military installations are available. Set up a military installation in World Administration first.</p>}</>:<div className="brood-empty"><strong>Command authorization required</strong><p>Domina or High Command officers must approve military transfers.</p></div>}
   </div>}
   {tab==='history'&&<div className="brood-panel"><div className="brood-heading"><div><small>05 / RECORDS</small><h3>Brood Activity Ledger</h3></div></div>
    {!data.history.length?<div className="brood-empty">No activity recorded.</div>:<div className="brood-history">{data.history.map(h=><div key={h.id}><span><i className="fa-solid fa-clock-rotate-left"/></span><div><strong>{tidy(h.action)}</strong><p>{h.detail}</p><small>{h.actor} · {date(h.created_at)}</small></div></div>)}</div>}
   </div>}
   {dialog&&<div className="brood-overlay" role="presentation"><form className="brood-dialog" onSubmit={e=>{e.preventDefault();
    if(dialog==='project')run('incubate',{strain_id:Number(initial),mode:project.mode,host_character_id:project.mode==='host'?project.host_character_id:null,notes:project.notes},'Incubation project created.');
    if(dialog==='strain')run('new_strain',{...strain,incubation_days:Number(strain.incubation_days),maturation_days:Number(strain.maturation_days),hatch_yield:Number(strain.hatch_yield)},'New strain registered.');
    if(dialog==='deploy')run('deploy',{cohort_id:Number(deployment.cohort_id),installation_id:Number(deployment.installation_id)},'Brood transferred to military garrison.');
   }}>
    <div className="brood-heading"><div><small>BROOD PIT / OPERATIONS</small><h3>{dialog==='project'?'Begin incubation':dialog==='strain'?'Register brood strain':'Transfer to army'}</h3></div><button type="button" className="brood-close" onClick={()=>setDialog('')} aria-label="Close dialog"><i className="fa-solid fa-xmark"/></button></div>
    {dialog==='project'&&<>
     <label>Brood strain<select value={initial} onChange={e=>setProject(p=>({...p,strain_id:e.target.value}))} required>{strains.map(s=><option key={s.id} value={s.id} disabled={!Number(s.egg_stock)}>{s.name} · {s.egg_stock} eggs</option>)}</select></label>
     <label>Incubation method<select value={project.mode} onChange={e=>setProject(p=>({...p,mode:e.target.value}))}><option value="vat">Sealed growth vat</option><option value="host">Registered character host</option></select></label>
     {project.mode==='host'&&<label>Character host<select required value={project.host_character_id} onChange={e=>setProject(p=>({...p,host_character_id:e.target.value}))}><option value="">Choose a registered host</option>{data.hosts.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select><small>Characters register availability in their own dossier.</small></label>}
     <label>Project notes<textarea rows={3} maxLength={800} value={project.notes} onChange={e=>setProject(p=>({...p,notes:e.target.value}))}/></label>
    </>}
    {dialog==='strain'&&<>
     <label>Strain name<input required maxLength={100} value={strain.name} onChange={e=>setStrain(s=>({...s,name:e.target.value}))}/></label>
     <label>Military specialization<select value={strain.role} onChange={e=>setStrain(s=>({...s,role:e.target.value}))}>{Object.entries(options).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
     <div className="brood-dialog-grid">{[['incubation_days','Incubation days',14],['maturation_days','Maturation days',14],['hatch_yield','Creatures per hatch',5]].map(([key,label,max])=><label key={key}>{label}<input type="number" min={1} max={max} required value={strain[key]} onChange={e=>setStrain(s=>({...s,[key]:e.target.value}))}/></label>)}</div>
     <label>Strain description<textarea required rows={3} maxLength={700} value={strain.description} onChange={e=>setStrain(s=>({...s,description:e.target.value}))}/></label>
    </>}
    {dialog==='deploy'&&<>
     <label>Brood cohort<select value={deployment.cohort_id} disabled><option value={deployment.cohort_id}>{cohorts.find(c=>String(c.id)===deployment.cohort_id)?.strain_name||'Selected cohort'}</option></select></label>
     <label>Destination installation<select required value={deployment.installation_id} onChange={e=>setDeployment(d=>({...d,installation_id:e.target.value}))}>{assignments.map(a=><option key={a.id} value={a.id}>{a.name} · {a.location_name}</option>)}</select></label>
     <p className="brood-muted">The creatures will appear in that installation's garrison roster under their brood strain name.</p>
    </>}
    <div className="brood-dialog-actions"><button type="button" onClick={()=>setDialog('')}>Cancel</button><button type="submit" className="brood-primary" disabled={busy||(dialog==='project'&&(!strains.find(s=>String(s.id)===initial)?.egg_stock||(project.mode==='host'&&!project.host_character_id)))||(dialog==='deploy'&&!deployment.installation_id)}>{busy?'Saving…':dialog==='project'?'Begin incubation':dialog==='strain'?'Register strain':'Confirm transfer'}</button></div>
   </form></div>}
  </>}
 </section>;
}
