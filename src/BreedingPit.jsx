import React,{useEffect,useMemo,useState} from 'react';
import './breeding-pit.css';

const tidy=value=>String(value||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const date=value=>value?new Date(value).toLocaleString():'—';
const options={scout:'Reconnaissance',assault:'Frontline assault',support:'Aetheric support'};
const progress=(start,end,now)=>Math.min(100,Math.max(0,Math.round(100*(new Date(now)-new Date(start))/Math.max(1,new Date(end)-new Date(start)))));
const emptyProject=()=>({strain_id:'',mode:'host',host_character_id:'',notes:''});
const emptyStrain=()=>({name:'',description:'',role:'scout',incubation_days:2,maturation_days:2,hatch_yield:2});
const badge=(state)=>['hatched','ready','deployed'].includes(state)?'complete':state==='cancelled'?'cancelled':'pending';


// Organic chamber environment. Decorative tendrils remain separate from operational data.
function LivingFloor(){
 return <svg className="brood-living-floor" viewBox="0 0 1200 460" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs>
   <radialGradient id="pit-floor-glow"><stop stopColor="#8a306c" stopOpacity=".57"/><stop offset="1" stopColor="#2a092e" stopOpacity="0"/></radialGradient>
   <linearGradient id="pit-vein-gradient" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#320a38"/><stop offset=".46" stopColor="#ae447c"/><stop offset="1" stopColor="#270923"/></linearGradient>
  </defs>
  <ellipse cx="580" cy="405" rx="570" ry="180" fill="url(#pit-floor-glow)"/>
  {[
   "M-30 395 C190 255 275 505 465 362 S816 205 1230 390",
   "M-25 462 C155 309 367 452 545 349 S853 338 1225 453",
   "M120 485 C230 362 385 378 506 413 S833 471 1002 314",
   "M-35 295 C152 322 236 398 376 364 S623 291 766 350 S1014 419 1250 277",
   "M178 475 C292 435 347 273 520 322 S827 434 952 330"
  ].map((path,i)=><g key={i}><path d={path} fill="none" stroke="#18041b" strokeWidth={24-i*2} strokeLinecap="round"/><path d={path} fill="none" stroke="url(#pit-vein-gradient)" strokeWidth={10-i} strokeLinecap="round"/><path d={path} fill="none" stroke="#d46baa" strokeOpacity=".38" strokeWidth="1.5" strokeLinecap="round"/></g>)}
  {Array.from({length:19},(_,i)=>{
   const x=(i*173+51)%1200,y=325+(i*67)%132;
   return <ellipse key={i} cx={x} cy={y} rx={9+(i%4)*5} ry={4+(i%3)*2} fill="#b24b86" opacity=".29"/>;
  })}
 </svg>;
}
function BroodChairMonitor({project,now}){
 const stage=project?progress(project.started_at,project.ready_at,now):0;
 return <div className={"brood-chair-console brood-organic-monitor "+(project?'brood-monitor-connected':'')}>
  <div className="brood-console-head"><span><i className="fa-solid fa-chair"/> THE BROOD THRONE <small>01 / CHAIR ARRAY</small></span><strong><i className="fa-solid fa-circle"/> {project?'HOST LINKED':'DORMANT'}</strong></div>
  <div className="brood-chair-visual" role="img" aria-label="Organic biomechanical incubation throne with four padded harness anchors, a central aether conduit and purple branching tendrils">
   <svg viewBox="0 0 540 345" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <defs>
     <radialGradient id="brood-throne-heart"><stop stopColor="#ef86c7"/><stop offset=".36" stopColor="#82346f"/><stop offset="1" stopColor="#210b30"/></radialGradient>
     <linearGradient id="brood-throne-body" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#843a70"/><stop offset=".28" stopColor="#3c163f"/><stop offset=".7" stopColor="#180c2a"/><stop offset="1" stopColor="#752c60"/></linearGradient>
     <linearGradient id="brood-throne-limb" x1="0" x2="1"><stop stopColor="#752c6c"/><stop offset=".5" stopColor="#be619f"/><stop offset="1" stopColor="#48234e"/></linearGradient>
     <filter id="brood-throne-aura"><feGaussianBlur stdDeviation="6"/></filter>
    </defs>
    <ellipse cx="270" cy="320" rx="185" ry="17" fill="#8b2c7a" opacity=".36" filter="url(#brood-throne-aura)"/>
    <g fill="none" strokeLinecap="round">
     {["M224 291C146 252 132 301 35 319","M312 291C390 258 391 309 513 318","M231 238C143 185 81 212 25 162","M306 240C390 175 467 219 519 167"].map((d,i)=><g key={i}><path d={d} stroke="#1e0926" strokeWidth="19"/><path d={d} stroke="url(#brood-throne-limb)" strokeWidth="10"/><path d={d} stroke="#d16ba4" strokeWidth="2.5" opacity=".55"/></g>)}
    </g>
    <path d="M218 22C238 10 309 9 326 22C360 66 342 146 342 201L364 281Q278 324 181 283L198 204C198 131 178 67 218 22Z" fill="url(#brood-throne-body)" stroke="#b76a9c" strokeWidth="3"/>
    <path d="M229 51Q273 30 315 51C323 96 318 154 315 201L330 259Q273 284 211 259L226 199C217 143 218 95 229 51Z" fill="#150b22" stroke="#71375e" strokeWidth="3"/>
    <g stroke="#8e3d7a" strokeWidth="2" fill="none" opacity=".8"><path d="M225 64C250 107 230 164 256 216"/><path d="M315 69C284 112 315 155 282 216"/><path d="M204 181C239 159 264 181 269 227"/><path d="M338 183C301 157 286 190 274 229"/></g>
    <path d="M219 94C174 87 146 89 112 117L85 145M322 94C371 77 398 93 434 118L458 143" fill="none" stroke="#251029" strokeWidth="27" strokeLinecap="round"/>
    <path d="M219 94C174 87 146 89 112 117L85 145M322 94C371 77 398 93 434 118L458 143" fill="none" stroke="url(#brood-throne-limb)" strokeWidth="16" strokeLinecap="round"/>
    <path d="M220 254L178 299L127 308M322 254L367 299L412 308" fill="none" stroke="#251029" strokeWidth="29" strokeLinecap="round"/>
    <path d="M220 254L178 299L127 308M322 254L367 299L412 308" fill="none" stroke="url(#brood-throne-limb)" strokeWidth="18" strokeLinecap="round"/>
    {[[85,145,-25],[458,143,25],[127,308,-8],[412,308,8]].map(([x,y,angle],i)=><g key={i} transform={`translate(${x} ${y}) rotate(${angle})`}><rect x="-20" y="-13" width="40" height="26" rx="11" fill="#2c132d" stroke="#dc83b8" strokeWidth="3"/><rect x="-13" y="-7" width="26" height="14" rx="7" fill="#a3558d"/><circle r="3.5" fill="#f4b8df"/></g>)}
    <path d="M270 218C250 247 257 282 269 314" stroke="#bc5596" strokeWidth="15" fill="none" strokeLinecap="round"/><path d="M270 218C250 247 257 282 269 314" stroke="#ffb4e4" strokeWidth="2" fill="none" opacity=".7"/>
    <ellipse cx="270" cy="208" rx="36" ry="42" fill="#240c2d" stroke="#a85188" strokeWidth="7"/>
    <ellipse className="brood-throne-pulse" cx="270" cy="208" rx="20" ry="25" fill="url(#brood-throne-heart)"/>
    <path d="M270 315C322 322 353 320 404 327" stroke="#c05e9b" strokeWidth="7" fill="none" strokeDasharray="13 10" opacity=".8"/>
    <text x="17" y="26" fontSize="11" fill="#e2a9d7" letterSpacing="1">FOUR-POINT BINDING ARRAY</text>
    <text x="379" y="287" fontSize="10" fill="#dda5d2">AETHER LINK</text>
   </svg>
  </div>
  <div className="brood-organic-readout"><div><small>REGISTERED HOST</small><strong>{project?.host_name||'NO HOST ASSIGNED'}</strong></div><div><small>INCUBATION</small><strong>{project?stage+'%':'STANDBY'}</strong></div></div>
 </div>;
}
function BroodCutaway({project,strain,now}){
 const stage=project?progress(project.started_at,project.ready_at,now):0;
 const count=project?Math.max(1,Math.min(5,Number(strain?.hatch_yield||2))):0;
 return <div className={"brood-cutaway-console brood-organic-monitor "+(project?'brood-monitor-connected':'')}>
  <div className="brood-console-head"><span><i className="fa-solid fa-eye"/> BROOD CROSS-SECTION <small>02 / SPECIMEN SCAN</small></span><strong><i className="fa-solid fa-circle"/> {project?(stage===100?'READY':'DEVELOPING'):'NO SIGNAL'}</strong></div>
  <div className="brood-cutaway-visual">
   <svg viewBox="0 0 540 345" role="img" aria-label="Stylized purple organic brood chamber cutaway with glowing eggs and branching veins, connected to a nursery conduit">
    <defs>
     <radialGradient id="brood-womb-wall"><stop stopColor="#6d275f"/><stop offset=".62" stopColor="#391439"/><stop offset="1" stopColor="#130923"/></radialGradient>
     <radialGradient id="brood-egg-shell" cx="36%" cy="28%"><stop stopColor="#fff0cb"/><stop offset=".29" stopColor="#e0adcc"/><stop offset=".72" stopColor="#9e4e96"/><stop offset="1" stopColor="#511f63"/></radialGradient>
     <filter id="brood-egg-halo"><feGaussianBlur stdDeviation="8"/></filter>
    </defs>
    <path d="M89 68C154 19 323 19 395 73C461 118 467 241 389 286C311 332 151 321 90 275C32 219 27 123 89 68Z" fill="#1f0a2b" stroke="#a34b83" strokeWidth="16"/>
    <path d="M89 68C154 19 323 19 395 73C461 118 467 241 389 286C311 332 151 321 90 275C32 219 27 123 89 68Z" fill="url(#brood-womb-wall)" stroke="#d276ae" strokeWidth="2"/>
    <path d="M98 95C168 52 313 51 385 99C430 142 427 226 383 260C303 298 162 301 102 252C64 207 59 149 98 95Z" fill="#230d30" stroke="#732d67" strokeWidth="4"/>
    {["M95 148C157 99 174 182 245 135S353 101 414 149","M91 215C154 260 191 180 258 224S372 266 405 220","M190 75C222 120 224 183 178 268","M315 75C278 124 301 190 341 276"].map((d,i)=><path key={i} d={d} fill="none" stroke={i%2?'#ad4c8c':'#742d72'} strokeWidth={i%2?8:12} strokeLinecap="round" opacity=".55"/>)}
    {Array.from({length:count},(_,i)=>{const x=175+(i%3)*77+(i%2)*11,y=count>3?133+Math.floor(i/3)*83:166+(i%2)*34;return <g key={i} className="brood-floating-egg" style={{animationDelay:(i*.47)+'s'}}><ellipse cx={x} cy={y} rx="31" ry="41" fill="#ee8ad4" opacity=".4" filter="url(#brood-egg-halo)"/><ellipse cx={x} cy={y} rx="28" ry="38" fill="url(#brood-egg-shell)" stroke="#e8b3df" strokeWidth="1.8"/><path d={`M${x-12} ${y-18}Q${x+16} ${y-7} ${x-5} ${y+18}`} stroke="#fff0df" strokeWidth="2" fill="none" opacity=".55"/><circle cx={x+5} cy={y+5} r="7" fill="#531a62" opacity=".6"/></g>})}
    <path d="M426 185C450 183 468 184 517 184" stroke="#692b65" strokeWidth="27" fill="none" strokeLinecap="round"/>
    <path d="M426 185C450 183 468 184 517 184" stroke="#d571b0" strokeWidth="11" fill="none" strokeLinecap="round"/>
    <path d="M493 174L519 184L493 195" stroke="#f4b5da" strokeWidth="3" fill="none"/>
    <text x="19" y="22" fontSize="11" fill="#e3aed3" letterSpacing="1">EGG CLUSTER / {count} DETECTED</text>
    <text x="447" y="214" fontSize="10" fill="#f4b5dc">NURSERY</text>
   </svg>
  </div>
  <div className="brood-scan-info"><div><small>SPECIMEN LINE</small><strong>{strain?.name||'UNASSIGNED'}</strong></div><div><small>GROWTH PHASE</small><strong>{stage}%</strong></div></div>
  <div className="brood-progress"><span style={{width:stage+'%'}}/></div>
  <div className="brood-progress-caption"><span>{project?'Egg maturation in progress':'No active project selected'}</span><span>{project?date(project.ready_at):'Awaiting signal'}</span></div>
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
    <div className="brood-heading"><div><small>01 / DEVELOPMENT</small><h3>Incubation Registry</h3><p>An organic incubation suite where registered hosts sustain the developing brood. Watch the throne and cross-section monitors as each clutch matures.</p></div>{data.can_manage&&<button type="button" className="brood-primary" onClick={()=>{setProject(emptyProject());setDialog('project')}} disabled={running.length>=data.capacity.incubators||!data.hosts.length}><i className="fa-solid fa-plus"/> Begin incubation</button>}</div>
    <div className="brood-monitor-workspace"><LivingFloor/><div className="brood-monitor-content">
     <div className="brood-monitor-selection"><label>Active incubation monitor<select value={selectedProject?.id||''} onChange={e=>setSelectedIncubation(String(e.target.value))}><option value="">No project selected</option>{running.map(x=><option key={x.id} value={x.id}>{x.host_name||'Thrall'} · {x.strain_name} #{x.id}</option>)}</select></label><small>Chair harness, egg-development cutaway and nursery transfer status</small></div>
     <div className="brood-monitor-grid"><BroodChairMonitor project={selectedProject} now={now}/><BroodCutaway project={selectedProject} strain={selectedStrain} now={now}/></div></div>
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
