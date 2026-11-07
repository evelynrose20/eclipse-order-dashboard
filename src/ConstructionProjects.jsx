import React,{useEffect,useMemo,useState} from 'react';
import './construction.css';

const blankStage=()=>({name:'',description:'',requirements:[{material_id:'',quantity:10}]});
const blankProject=()=>({name:'',description:'',location:'',event_id:'',stages:[blankStage()]});
const num=x=>Number(x||0).toLocaleString();
const percent=(part,total)=>total?Math.min(100,Math.round(100*Number(part)/Number(total))):0;
const phaseName=s=>s.status==='active'?'Current chapter':s.status==='complete'?'Finished':'Waiting';
export default function ConstructionProjects({request,characters=[],canManage=false,readOnly=false,userId='',initialEventId='',onSelectEvent}){
 const [projects,setProjects]=useState([]),[projectId,setProjectId]=useState('');
 const [project,setProject]=useState(null),[materials,setMaterials]=useState([]);
 const [reserved,setReserved]=useState([]),[events,setEvents]=useState([]);
 const [draft,setDraft]=useState(null),[activeStage,setActiveStage]=useState('');
 const [characterId,setCharacterId]=useState('');
 const [delivery,setDelivery]=useState({requirement_id:'',quantity:1,source:'reserved'});
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const ownCharacters=characters.filter(c=>(c.player_user_id||c.player_account_id)===userId);
 const canCreate=canManage&&!readOnly;
 const matName=id=>materials.find(m=>m.id===id)?.name||id;
 const ownReserved=id=>Number(reserved.find(r=>r.character_id===characterId&&r.material_id===id)?.quantity||0);
 const sharedAvailable=id=>Number(materials.find(m=>m.id===id)?.quantity||0);
 const available=id=>delivery.source==='reserved'?ownReserved(id):sharedAvailable(id);
 const selectedStage=project?.stages.find(s=>String(s.id)===String(activeStage))||project?.stages.find(s=>s.status==='active')||project?.stages[0];
 const selectedReq=selectedStage?.requirements.find(r=>String(r.id)===String(delivery.requirement_id))||selectedStage?.requirements.find(r=>Number(r.contributed_quantity)<Number(r.required_quantity))||selectedStage?.requirements[0];
 const remaining=selectedReq?Math.max(0,Number(selectedReq.required_quantity)-Number(selectedReq.contributed_quantity)):0;
 const maxQuantity=Math.min(100,remaining,selectedReq?available(selectedReq.material_id):0);
 const total=project?.stages.reduce((sum,s)=>sum+s.requirements.reduce((n,r)=>n+Number(r.required_quantity),0),0)||0;
 const done=project?.stages.reduce((sum,s)=>sum+s.requirements.reduce((n,r)=>n+Number(r.contributed_quantity),0),0)||0;
 async function load(target=projectId){
  const [catalog,workshop,bags]=await Promise.all([request('/construction'),request('/workshop'),request('/workshop/reserved')]);
  setProjects(catalog.projects||[]);setMaterials(workshop.materials||[]);setReserved(bags.goods||[]);
  const chosen=(catalog.projects||[]).find(p=>String(p.id)===String(target))||(catalog.projects||[])[0];
  if(chosen){
   const details=await request('/construction/'+chosen.id);
   setProject(details.project);setProjectId(String(chosen.id));
  }else{setProject(null);setProjectId('')}
 }
 useEffect(()=>{load(initialEventId?'':projectId).then(()=>{
  if(initialEventId)request('/construction').then(async catalog=>{
   const linked=(catalog.projects||[]).find(p=>p.event_id===initialEventId);
   if(linked){const result=await request('/construction/'+linked.id);setProject(result.project);setProjectId(String(linked.id))}
  }).catch(()=>{})
 }).catch(e=>setError(e.message))},[]);
 useEffect(()=>{
  if(!characterId&&ownCharacters.length)setCharacterId(ownCharacters[0].id)
 },[ownCharacters.length,characterId]);
 const mayCreate=canCreate;
 async function beginDraft(){
  setDraft(blankProject());setError('');setNotice('');
  try{const result=await request('/construction/events');setEvents(result.events||[])}catch{setEvents([])}
 }
 async function execute(path,body,message,method='POST',select=projectId){
  setBusy(true);setError('');setNotice('');
  try{
   const result=await request(path,{method,body});
   await load(select==='created'?result.id:select);
   setNotice(message);
   return result;
  }catch(e){setError(e.message||String(e));return null}
  finally{setBusy(false)}
 }
 async function create(){
  const body={...draft,event_id:draft.event_id||null,stages:draft.stages.map(s=>({...s,requirements:s.requirements.map(r=>({material_id:r.material_id,quantity:Number(r.quantity)}))}))};
  const result=await execute('/construction',body,'Construction storyline saved as a private draft.','POST','created');
  if(result){setDraft(null);setActiveStage('')}
 }
 const stageAction=(action)=>execute('/construction/'+project.id+'/'+action,null,{
  activate:'Construction drive published; the first stage now accepts contributions.',
  pause:'Contributions paused.',
  resume:'Contributions reopened.',
  archive:'Construction storyline archived.'
 }[action]||'Project updated.');
 const finishStage=s=>execute('/construction/'+project.id+'/stages/'+s.id+'/complete',null,'Stage signed off. The next chapter is now ready, or the project has been completed.');
 const give=()=>execute('/construction/'+project.id+'/contribute',{
  requirement_id:Number(selectedReq.id),character_id:characterId,quantity:Number(delivery.quantity),source:delivery.source
 },'Crafted goods permanently delivered toward '+selectedStage.name+'.');
 const projectRow=(entry)=><button type="button" key={entry.id} className={'eo-construction-project '+(String(entry.id)===projectId?'selected':'')} onClick={async()=>{setError('');setNotice('');try{const r=await request('/construction/'+entry.id);setProject(r.project);setProjectId(String(entry.id));setActiveStage('');setDelivery({requirement_id:'',quantity:1,source:'reserved'})}catch(e){setError(e.message)}}}>
  <span className="eo-construction-project-icon" aria-hidden="true">⌘</span><span><strong>{entry.name}</strong><small>{entry.event_name||'Order construction campaign'}</small><em>{entry.stage_count} stage{Number(entry.stage_count)===1?'':'s'} · {entry.state}</em></span>
 </button>;
 return <section className="eo-construction">
  <header className="eo-construction-hero"><div><span>THE ECLIPSE ORDER · LONG-FORM OPERATIONS</span><h2>Construction & Restoration</h2><p>Turn crafting into a living storyline. Plan a restoration, a new structure, or a major Order undertaking and let materials arrive over many events.</p></div><span className="eo-construction-emblem" aria-hidden="true">⚒</span></header>
  {error&&<p className="alert" role="alert">{error.replaceAll('_',' ')}</p>}
  {notice&&<p className="eo-construction-notice" role="status">{notice}</p>}
  <div className="eo-construction-toolbar"><div><span>ONGOING STORYLINES</span><strong>{projects.filter(p=>p.state==='open').length} active · {projects.length} recorded</strong></div>{mayCreate&&<button type="button" onClick={beginDraft}>+ Plan a construction storyline</button>}</div>
  <div className="eo-construction-layout">
   <aside className="eo-construction-directory"><h3>Project ledger</h3>{projects.map(projectRow)}{!projects.length&&<div className="eo-construction-empty"><strong>Nothing has been commissioned.</strong><p>Order command can prepare the complete construction storyline here before a public event is announced.</p></div>}</aside>
   <main className="eo-construction-detail">
    {project?<>
     <header className="eo-construction-main-head"><span>OFFICIAL ORDER COMMISSION · {project.state.toUpperCase()}</span><h3>{project.name}</h3><p>{project.description||'An ongoing material and construction undertaking of the Eclipse Order.'}</p><div className="eo-construction-meta"><span>{project.location||'Location to be announced'}</span>{project.event_name&&<span>Linked event: {project.event_name}</span>}</div></header>
     <div className="eo-construction-progress"><div><span>PROJECT SUPPLIES</span><strong>{num(done)} / {num(total)} delivered</strong></div><div className="eo-construction-bar"><span style={{width:percent(done,total)+'%'}}/></div><small>{percent(done,total)}% of all material targets met · storyline stages advance separately</small></div>
     {project.can_edit&&!readOnly&&<div className="eo-construction-command">
      {project.state==='draft'&&<button type="button" disabled={busy} onClick={()=>stageAction('activate')}>Open the drive to members</button>}
      {project.state==='open'&&<button type="button" disabled={busy} onClick={()=>stageAction('pause')}>Pause deliveries</button>}
      {project.state==='paused'&&<button type="button" disabled={busy} onClick={()=>stageAction('resume')}>Resume the drive</button>}
      {!['archived'].includes(project.state)&&<button type="button" className="subtle" disabled={busy} onClick={()=>{if(window.confirm('Archive this construction project? It will leave the public project board but keep the records.'))stageAction('archive')}}>Archive</button>}
     </div>}
     <section className="eo-construction-stages"><div className="eo-construction-section-heading"><span>THE BUILDING CHRONICLE</span><h4>Construction phases</h4></div>
      <nav aria-label="Construction stages">{project.stages.map((stage,i)=><button type="button" key={stage.id} className={'eo-construction-stage '+(String(stage.id)===String(selectedStage?.id)?'selected':'')+' '+stage.status} onClick={()=>{setActiveStage(String(stage.id));setDelivery({requirement_id:'',quantity:1,source:'reserved'})}}><span>{String(i+1).padStart(2,'0')}</span><div><strong>{stage.name}</strong><small>{phaseName(stage)}</small></div><em>{stage.status==='complete'?'✓':stage.status==='locked'?'⌑':'◆'}</em></button>)}</nav>
     </section>
     {selectedStage&&<section className="eo-construction-work"><div className="eo-construction-section-heading"><span>PHASE {selectedStage.position} · {selectedStage.status.toUpperCase()}</span><h4>{selectedStage.name}</h4><p>{selectedStage.description||'Gather materials for the next milestone in the Order’s work.'}</p></div>
      <div className="eo-construction-requirements">{selectedStage.requirements.map(r=><div className="eo-construction-material" key={r.id}><div><strong>{r.material_name}</strong><small>{num(r.contributed_quantity)} / {num(r.required_quantity)} supplied</small></div><span>{percent(r.contributed_quantity,r.required_quantity)}%</span><div className="eo-construction-bar"><span style={{width:percent(r.contributed_quantity,r.required_quantity)+'%'}}/></div></div>)}</div>
      {selectedStage.status==='active'&&project.state==='open'&&<div className="eo-construction-delivery"><div><span>THE MATERIALS DEPOT</span><h5>Deliver crafted goods</h5><p>Supplies are removed only when you confirm a contribution. Goods reserved for your character stay protected until you choose to send them here.</p></div>
       <div className="eo-construction-fields"><label>Character sheet<select value={characterId} onChange={e=>setCharacterId(e.target.value)}><option value="">Choose character</option>{ownCharacters.map(c=><option key={c.id} value={c.id}>{c.name||c.character_name}</option>)}</select></label><label>Requested material<select value={selectedReq?.id||''} onChange={e=>setDelivery({...delivery,requirement_id:e.target.value,quantity:1})}>{selectedStage.requirements.filter(r=>Number(r.contributed_quantity)<Number(r.required_quantity)).map(r=><option key={r.id} value={r.id}>{r.material_name} · {r.required_quantity-r.contributed_quantity} needed</option>)}</select></label><label>Use supplies from<select value={delivery.source} onChange={e=>setDelivery({...delivery,source:e.target.value,quantity:1})}><option value="reserved">My character's reserved goods</option><option value="shared">FC common stores</option></select></label><label>Quantity<input type="number" min="1" max={Math.max(1,maxQuantity)} value={delivery.quantity} onChange={e=>setDelivery({...delivery,quantity:e.target.value})}/></label></div>
       <div className="eo-construction-delivery-foot"><span>{selectedReq?num(available(selectedReq.material_id))+' available from selected source':'No materials remaining'}</span><button type="button" disabled={busy||readOnly||!characterId||!selectedReq||remaining===0||Number(delivery.quantity)<1||Number(delivery.quantity)>maxQuantity} onClick={give}>Contribute materials</button></div>
       {selectedReq&&maxQuantity===0&&<p className="eo-construction-hint">Craft the material in Workshop & Garden, then reserve it for your character or add it to the FC stores.</p>}
      </div>}
      {selectedStage.status==='locked'&&<p className="eo-construction-hint">This phase is waiting for the previous chapter to be completed. Materials cannot be delivered early.</p>}
      {selectedStage.status==='complete'&&<p className="eo-construction-hint">All requirements were met, and the Order recorded this construction milestone as complete.</p>}
      {selectedStage.status==='active'&&project.state==='open'&&project.can_edit&&!readOnly&&<div className="eo-construction-signoff"><div><strong>Event director's sign-off</strong><small>Even when every material is ready, the story only advances when you mark this chapter complete.</small></div><button type="button" disabled={busy||selectedStage.requirements.some(r=>Number(r.contributed_quantity)<Number(r.required_quantity))} onClick={()=>finishStage(selectedStage)}>Complete stage & advance</button></div>}
     </section>}
     <section className="eo-construction-history"><div className="eo-construction-section-heading"><span>THE ORDER'S WORKERS</span><h4>Contribution record</h4></div>{project.history.map(h=><div className="eo-construction-history-entry" key={h.id}><div><strong>{h.character_name}</strong><small>{new Date(h.created_at).toLocaleDateString()} · {h.source==='reserved'?'Personal reserve':'FC common stores'}</small></div><span>+{num(h.quantity)} {h.material_name}</span></div>)}{!project.history.length&&<p>No supplies have been delivered to this commission yet.</p>}</section>
    </>:<div className="eo-construction-empty"><strong>Choose a construction commission</strong><p>Projects remain available between events, so the Order can build towards a large RP milestone over weeks or months.</p></div>}
   </main>
  </div>
  {draft&&<div className="eo-construction-overlay"><section className="eo-construction-builder" role="dialog" aria-modal="true" aria-label="Plan construction project"><header><div><span>ORDER COMMAND · CAMPAIGN PLANNING</span><h3>Commission a major undertaking</h3><p>Write the full construction arc in advance. Only the first stage can receive supplies when the project opens.</p></div><button type="button" aria-label="Close project builder" onClick={()=>setDraft(null)}>×</button></header>
   <div className="eo-construction-fields"><label>Project title<input maxLength={150} value={draft.name} placeholder="Rebuild the old observatory…" onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>Location<input maxLength={160} value={draft.location} placeholder="Where the work will happen" onChange={e=>setDraft({...draft,location:e.target.value})}/></label></div>
   <label className="eo-construction-label">Story premise<textarea value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})} rows={3} placeholder="Why the Order is taking on this project…"/></label>
   <label className="eo-construction-label">Related event (optional)<select value={draft.event_id} onChange={e=>setDraft({...draft,event_id:e.target.value})}><option value="">Standalone storyline · no event linked yet</option>{events.map(e=><option key={e.id} value={e.id}>{e.name}{e.published?' · published':' · draft'}</option>)}</select></label>
   <div className="eo-construction-builder-stages"><div className="eo-construction-section-heading"><span>STORYLINE ROADMAP</span><h4>Stages & material targets</h4></div>
    {draft.stages.map((stage,i)=><article key={i}><div className="eo-construction-builder-stagehead"><strong>Phase {String(i+1).padStart(2,'0')}</strong>{draft.stages.length>1&&<button type="button" onClick={()=>setDraft({...draft,stages:draft.stages.filter((_,j)=>j!==i)})}>Remove stage</button>}</div>
     <label>Chapter title<input maxLength={130} value={stage.name} placeholder="Clear the rubble / Raise the foundations…" onChange={e=>setDraft({...draft,stages:draft.stages.map((s,j)=>j===i?{...s,name:e.target.value}:s)})}/></label><label>RP milestone<textarea maxLength={1400} rows={2} value={stage.description} onChange={e=>setDraft({...draft,stages:draft.stages.map((s,j)=>j===i?{...s,description:e.target.value}:s)})}/></label>
     <div className="eo-construction-ingredient-editor">{stage.requirements.map((r,j)=><div key={j}><select aria-label="Required material" value={r.material_id} onChange={e=>setDraft({...draft,stages:draft.stages.map((s,k)=>k===i?{...s,requirements:s.requirements.map((v,l)=>l===j?{...v,material_id:e.target.value}:v)}:s)})}><option value="">Choose crafted material</option>{materials.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select><input aria-label="Required quantity" type="number" min="1" max="100000" value={r.quantity} onChange={e=>setDraft({...draft,stages:draft.stages.map((s,k)=>k===i?{...s,requirements:s.requirements.map((v,l)=>l===j?{...v,quantity:e.target.value}:v)}:s)})}/><button type="button" aria-label="Remove requirement" disabled={stage.requirements.length===1} onClick={()=>setDraft({...draft,stages:draft.stages.map((s,k)=>k===i?{...s,requirements:s.requirements.filter((_,l)=>l!==j)}:s)})}>×</button></div>)}</div>
     <button type="button" className="eo-construction-add-line" onClick={()=>setDraft({...draft,stages:draft.stages.map((s,k)=>k===i?{...s,requirements:[...s.requirements,{material_id:'',quantity:10}]}:s)})}>+ Required material</button>
    </article>)}
    <button type="button" className="eo-construction-add-stage" disabled={draft.stages.length>=20} onClick={()=>setDraft({...draft,stages:[...draft.stages,blankStage()]})}>+ Add another story phase</button>
   </div>
   <footer><button type="button" onClick={()=>setDraft(null)}>Cancel</button><button type="button" disabled={busy||!draft.name.trim()||draft.stages.some(s=>!s.name.trim()||s.requirements.some(r=>!r.material_id||!Number.isInteger(Number(r.quantity))||Number(r.quantity)<1||new Set(s.requirements.map(r=>r.material_id)).size!==s.requirements.length))} onClick={create}>{busy?'Saving…':'Save private project plan'}</button></footer>
  </section></div>}
 </section>;
}
