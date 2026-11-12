import React,{useEffect,useMemo,useState} from 'react';
import './breeding-pit.css';

const tidy=value=>String(value||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const date=value=>value?new Date(value).toLocaleString():'—';
const options={scout:'Reconnaissance',assault:'Frontline assault',support:'Aetheric support'};
const progress=(start,end,now)=>Math.min(100,Math.max(0,Math.round(100*(new Date(now)-new Date(start))/Math.max(1,new Date(end)-new Date(start)))));
const emptyProject=()=>({strain_id:'',mode:'host',host_character_id:'',notes:''});
const emptyStrain=()=>({name:'',description:'',role:'scout',incubation_days:2,maturation_days:2,hatch_yield:2});
const badge=(state)=>['hatched','ready','deployed'].includes(state)?'complete':state==='cancelled'?'cancelled':'pending';


// Schematic-only magitek monitors: procedure states are driven by persisted incubation records.
function BroodChairMonitor({project,strain,now}){
 const stage=project?progress(project.started_at,project.ready_at,now):0;
 const eggs=project?Math.max(1,Math.min(5,Number(strain?.hatch_yield||2))):0;
 return <div className="brood-chair-console">
  <div className="brood-console-head"><span><i className="fa-solid fa-chair"/> INCUBATION CHAIR / HARNESS STATUS</span><strong>{project?'Host connected':'Standby'}</strong></div>
  <div className="brood-chair-visual" role="img" aria-label="Front-view schematic of a magitek incubation chair with four limb harness anchors and sealed egg-transfer conduit">
   <svg viewBox="0 0 420 260" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><linearGradient id="brood-metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#627881"/><stop offset="1" stopColor="#17242c"/></linearGradient></defs>
    <rect x="142" y="14" width="136" height="225" rx="24" fill="url(#brood-metal)" stroke="#b7a172" strokeWidth="2"/>
    <rect x="163" y="31" width="94" height="169" rx="15" fill="#102128" stroke="#617779" strokeWidth="2"/>
    <rect x="178" y="48" width="64" height="25" rx="6" fill="#345058" stroke="#9a8566"/>
    <path d="M142 95H88L65 134M278 95H332L354 134M175 235L130 248M245 235L290 248" stroke="#849aa1" strokeWidth="13" fill="none" strokeLinecap="round"/>
    {[[68,137],[352,137],[129,244],[291,244]].map(([x,y],i)=><g key={i}><rect x={x-16} y={y-10} width="32" height="21" rx="5" fill="#b5a174" stroke="#e4d2a1"/><circle cx={x} cy={y} r="4" fill="#27434b"/></g>)}
    <path d="M210 210V253" stroke="#dcbe80" strokeWidth="7" strokeLinecap="round"/><circle cx="210" cy="210" r="17" fill="#30444a" stroke="#e0c085" strokeWidth="3"/><circle cx="210" cy="210" r="7" fill={project?'#acd1b9':'#899293'}/>
    <path d="M208 254H352" stroke="#8d8b63" strokeWidth="4" strokeDasharray="8 6"/>
    <text x="20" y="22" fill="#bac6c5" fontSize="11">FOUR-POINT HARNESS</text><text x="270" y="242" fill="#e2c48b" fontSize="10">SEALED CONDUIT</text>
   </svg>
  </div>
  <div className="brood-console-foot"><span>{project?.host_name||'No registered thrall assigned'}</span><span>{project?'Development '+stage+'%':'Awaiting incubation assignment'}</span></div>
 </div>;
}
function BroodCutaway({project,strain,now}){
 const stage=project?progress(project.started_at,project.ready_at,now):0;
 const count=project?Math.max(1,Math.min(5,Number(strain?.hatch_yield||2))):0;
 return <div className="brood-cutaway-console">
  <div className="brood-console-head"><span><i className="fa-solid fa-microscope"/> BROOD DEVELOPMENT / CUTAWAY MONITOR</span><strong>{project?(stage===100?'Ready for transfer':'Developing'):'No signal'}</strong></div>
  <svg viewBox="0 0 460 260" role="img" aria-label="Abstract cross-sectional monitor displaying incubating eggs as glowing shapes, connected to a nursery transfer pipeline">
   <defs><radialGradient id="brood-shell" cx="50%" cy="44%"><stop offset="0" stopColor="#385c61"/><stop offset="1" stopColor="#14242b"/></radialGradient><radialGradient id="brood-egg" cx="38%" cy="35%"><stop offset="0" stopColor="#efe0ae"/><stop offset=".55" stopColor="#b6a477"/><stop offset="1" stopColor="#646442"/></radialGradient></defs>
   <path d="M32 42C103 17 275 19 350 42C393 70 398 181 347 218C274 252 105 244 34 210C-1 159 -2 84 32 42Z" fill="url(#brood-shell)" stroke="#9b9065" strokeWidth="3"/>
   <path d="M59 69C127 47 264 46 320 68C344 104 344 162 319 190C251 217 124 216 62 185C40 143 40 107 59 69Z" fill="#1c3033" stroke="#50716b" strokeWidth="2" strokeDasharray="5 5"/>
   {Array.from({length:count},(_,i)=>{const x=120+(i%3)*88,y=99+Math.floor(i/3)*88;return <g key={i}><ellipse cx={x} cy={y} rx={27} ry={35} fill="url(#brood-egg)" opacity={.85+stage/700}/><path d={`M${x-6} ${y-18}Q${x+10} ${y-4} ${x-4} ${y+18}`} stroke="#e7ddbc" strokeWidth="2" fill="none" opacity=".5"/></g>})}
   <path d="M368 133H434" stroke="#c1ac75" strokeWidth="8"/><path d="M408 119L438 133L408 147" fill="none" stroke="#f0d69d" strokeWidth="4"/>
   <text x="19" y="17" fontSize="11" fill="#c9d3c9">CROSS-SECTION / EGG COUNT: {count}</text><text x="358" y="169" fontSize="10" fill="#dfcb91">NURSERY</text>
  </svg>
  <div className="brood-progress"><span style={{width:stage+'%'}}/></div><div className="brood-progress-caption"><span>{stage}% incubation progress</span><span>{project?date(project.ready_at):'No active project selected'}</span></div>
 </div>;
}
function NurseryLifeSupport({cohorts,now}){
 const active=cohorts.filter(c=>c.status!=='deployed');
 return <section className="brood-lifesupport">
  <div className="brood-console-head"><span><i className="fa-solid fa-heart-pulse"/> NURSERY / NUTRIENT FEED NETWORK</span><strong>{active.length?active.length+' connected cohorts':'Standby'}</strong></div>
  <div className="brood-feed-bank">{active.length?active.slice(0,8).map(c=>{
   const pct=progress(c.created_at,c.mature_at,now);
   return <div key={c.id} className="brood-feed-vessel"><div className="brood-feed-cap"><span/><span/><span/></div><div className="brood-feed-tube"><div className="brood-feed-liquid" style={{height:pct+'%'}}/><div className="brood-feed-specimen"><i className="fa-solid fa-dna"/></div></div><small>#{c.id}</small><strong>{c.quantity} · {pct}%</strong></div>;
  }):<div className="brood-empty"><i className="fa-solid fa-flask"/><strong>Nursery feeds idle</strong><p>Transfer a completed incubation to connect its hatchlings to the growth network.</p></div>}</div>
  <p className="brood-muted">The nursery supplies nutrient flow and aetheric stabilization while each cohort matures. Mature cohorts become eligible for army assignment.</p>
 </section>;
}

export default function BreedingPit({request}){
 const [data,setData]=useState(null),[tab,setTab]=useState('incubation');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [dialog,setDialog]=useState(''),[project,setProject]=useState(emptyProject()),[strain,setStrain]=useState(emptyStrain());
 const [deployment,setDeployment]=useState({cohort_id:'',installation_id:''});
 const [selectedIncubation,setSelectedIncubation]=useState('');
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
 const selectedProject=running.find(x=>String(x.id)===selectedIncubation)||running[0]||null;
 const selectedStrain=strains.find(x=>Number(x.id)===Number(selectedProject?.strain_id));
 const nursery=cohorts.filter(x=>x.status!=='deployed');
 const assignments=data?.installations||[];
 const now=data?.server_time||new Date().toISOString();
 const activeTotal=nursery.reduce((total,x)=>total+Number(x.quantity),0);
 const readyCohorts=useMemo(()=>nursery.filter(x=>new Date(x.mature_at)<=new Date(now)),[data]);
 const initial=project.strain_id||String(strains.find(x=>Number(x.egg_stock)>0)?.id||strains[0]?.id||'');
 if(!data&&!error)return <section className="brood-root"><div className="brood-panel">Opening the Brood Pit…</div></section>;
 return <section className="brood-root">
  <header className="brood-hero"><div><span className="brood-kicker"><i className="fa-solid fa-dungeon"/> LOWER VAULTS · BIO-ARCANE DIVISION</span><h2>Breeding Pit</h2><p>Brood cultivation, incubation, nursery development and military assignment</p></div>
   <div className="brood-mark"><i className="fa-solid fa-egg"/></div>
  </header>
  {error&&<div className="brood-alert" role="alert">{error} {!data&&<button type="button" onClick={()=>reload().then(()=>setError('')).catch(e=>setError(e.message))}>Retry</button>}</div>}
  {notice&&<div className="brood-success" role="status">{notice}</div>}
  {data&&<>
   <div className="brood-metrics">
    <div><span>ACTIVE INCUBATIONS</span><strong>{running.length} <small>/ {data.capacity.incubators}</small></strong><small>Registered thrall hosts</small></div>
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
    <div className="brood-heading"><div><small>01 / DEVELOPMENT</small><h3>Incubation Registry</h3><p>Each egg is assigned to a registered bound thrall for incubation. No growth vats are used for new projects.</p></div>{data.can_manage&&<button type="button" className="brood-primary" onClick={()=>{setProject(emptyProject());setDialog('project')}} disabled={running.length>=data.capacity.incubators||!data.hosts.length}><i className="fa-solid fa-plus"/> Begin incubation</button>}</div>
    <div className="brood-monitor-workspace">
     <div className="brood-monitor-selection"><label>Active incubation monitor<select value={selectedProject?.id||''} onChange={e=>setSelectedIncubation(String(e.target.value))}><option value="">No project selected</option>{running.map(x=><option key={x.id} value={x.id}>{x.host_name||'Thrall'} · {x.strain_name} #{x.id}</option>)}</select></label><small>Chair harness, egg-development cutaway and nursery transfer status</small></div>
     <div className="brood-monitor-grid"><BroodChairMonitor project={selectedProject} strain={selectedStrain} now={now}/><BroodCutaway project={selectedProject} strain={selectedStrain} now={now}/></div>
    </div>
    {!data.hosts.length&&<p className="brood-muted" role="status">No registered bound thralls are available. Register an eligible character through their Brood Pit dossier tab before beginning an incubation.</p>}
    {!incubations.length?<div className="brood-empty"><i className="fa-solid fa-egg"/><strong>No incubation projects</strong><p>Start a project using an available brood strain and egg from the strain registry.</p></div>:
    <div className="brood-projects">{incubations.map(item=>{
     const pct=progress(item.started_at,item.ready_at,now),ready=pct===100;
     return <article className="brood-project" key={item.id}>
      <div className="brood-project-top"><div><small>PROJECT #{item.id} · {item.incubation_mode==='vat'?'LEGACY VAT RECORD':'THRALL INCUBATION'}</small><h4>{item.strain_name}</h4></div><span className={'brood-tag '+badge(item.status)}>{item.status==='incubating'&&ready?'Ready to hatch':tidy(item.status)}</span></div>
      <p className="brood-muted">{item.incubation_mode==='host'?'Thrall host: '+(item.host_name||'Unknown character'):'Historical growth-vat project'}</p>
      {item.status==='incubating'&&<><div className="brood-progress"><span style={{width:pct+'%'}}/></div><div className="brood-progress-caption"><span>{pct}% developed</span><span>{ready?'Mature egg': 'Hatch window: '+date(item.ready_at)}</span></div></>}
      {item.notes&&<p className="brood-project-notes">{item.notes}</p>}
      {item.status==='incubating'&&data.can_manage&&<div className="brood-actions"><button disabled={busy||!ready||data.capacity.nursery_used>=data.capacity.nursery} onClick={()=>run('hatch',{incubation_id:Number(item.id)},'Hatchlings transferred to nursery life support.')}>Transfer brood to nursery</button><button className="danger" disabled={busy} onClick={()=>run('cancel',{incubation_id:Number(item.id)},'Incubation cancelled; egg returned to stock.')}>Cancel</button></div>}
     </article>;
    })}</div>}
   </div>}
   {tab==='nursery'&&<div className="brood-panel">
    <div className="brood-heading"><div><small>02 / NURSERY</small><h3>Hatchling Development</h3><p>Hatched broods require maturation time before they can be deployed. Nursery capacity is shared across all strains.</p></div></div>
    <NurseryLifeSupport cohorts={cohorts} now={now}/>
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
    if(dialog==='project')run('incubate',{strain_id:Number(initial),mode:'host',host_character_id:project.host_character_id,notes:project.notes},'Incubation project created.');
    if(dialog==='strain')run('new_strain',{...strain,incubation_days:Number(strain.incubation_days),maturation_days:Number(strain.maturation_days),hatch_yield:Number(strain.hatch_yield)},'New strain registered.');
    if(dialog==='deploy')run('deploy',{cohort_id:Number(deployment.cohort_id),installation_id:Number(deployment.installation_id)},'Brood transferred to military garrison.');
   }}>
    <div className="brood-heading"><div><small>BROOD PIT / OPERATIONS</small><h3>{dialog==='project'?'Begin incubation':dialog==='strain'?'Register brood strain':'Transfer to army'}</h3></div><button type="button" className="brood-close" onClick={()=>setDialog('')} aria-label="Close dialog"><i className="fa-solid fa-xmark"/></button></div>
    {dialog==='project'&&<>
     <label>Brood strain<select value={initial} onChange={e=>setProject(p=>({...p,strain_id:e.target.value}))} required>{strains.map(s=><option key={s.id} value={s.id} disabled={!Number(s.egg_stock)}>{s.name} · {s.egg_stock} eggs</option>)}</select></label>
     <p className="brood-muted">Incubation method: Registered bound thrall</p>
     <label>Thrall host<select required value={project.host_character_id} onChange={e=>setProject(p=>({...p,host_character_id:e.target.value}))}><option value="">Choose a registered bound thrall</option>{data.hosts.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select><small>Bound characters register availability in their own dossier.</small></label>
     <label>Project notes<textarea rows={3} maxLength={800} value={project.notes} onChange={e=>setProject(p=>({...p,notes:e.target.value}))}/></label>
    </>}
    {dialog==='strain'&&<>
     <label>Strain name<input required maxLength={73} value={strain.name} onChange={e=>setStrain(s=>({...s,name:e.target.value}))}/></label>
     <label>Military specialization<select value={strain.role} onChange={e=>setStrain(s=>({...s,role:e.target.value}))}>{Object.entries(options).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
     <div className="brood-dialog-grid">{[['incubation_days','Incubation days',14],['maturation_days','Maturation days',14],['hatch_yield','Creatures per hatch',5]].map(([key,label,max])=><label key={key}>{label}<input type="number" min={1} max={max} required value={strain[key]} onChange={e=>setStrain(s=>({...s,[key]:e.target.value}))}/></label>)}</div>
     <label>Strain description<textarea required rows={3} maxLength={700} value={strain.description} onChange={e=>setStrain(s=>({...s,description:e.target.value}))}/></label>
    </>}
    {dialog==='deploy'&&<>
     <label>Brood cohort<select value={deployment.cohort_id} disabled><option value={deployment.cohort_id}>{cohorts.find(c=>String(c.id)===deployment.cohort_id)?.strain_name||'Selected cohort'}</option></select></label>
     <label>Destination installation<select required value={deployment.installation_id} onChange={e=>setDeployment(d=>({...d,installation_id:e.target.value}))}>{assignments.map(a=><option key={a.id} value={a.id}>{a.name} · {a.location_name}</option>)}</select></label>
     <p className="brood-muted">The creatures will appear in that installation's garrison roster under their brood strain name.</p>
    </>}
    <div className="brood-dialog-actions"><button type="button" onClick={()=>setDialog('')}>Cancel</button><button type="submit" className="brood-primary" disabled={busy||(dialog==='project'&&(!strains.find(s=>String(s.id)===initial)?.egg_stock||!project.host_character_id))||(dialog==='deploy'&&!deployment.installation_id)}>{busy?'Saving…':dialog==='project'?'Begin incubation':dialog==='strain'?'Register strain':'Confirm transfer'}</button></div>
   </form></div>}
  </>}
 </section>;
}
