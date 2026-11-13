import React,{useEffect,useState} from 'react';
import './family-care.css';
import FamilyAdultLife from './FamilyAdultLife.jsx';
import {careNeeds,carePriority} from './familyCareNeeds.js';
import {LIFE_STAGES,SCHOOL_ACTIVITIES,SKILL_LABELS,skillProgress,DEVELOPMENT_MILESTONES,apparentAge,suggestedStage} from './familyLifeStages.js';
const stages=LIFE_STAGES.map(s=>s.id);
const actions=[
 ['nursing','Nurse','fa-heart'],
 ['bottle','Bottle feed','fa-bottle-water'],
 ['meal','Serve meal','fa-utensils'],
 ['comfort','Comfort / care','fa-hands-holding-child'],
 ['hygiene','Bath / change','fa-soap'],
 ['sleep','Settle to sleep','fa-moon'],
 ['play','Play / enrichment','fa-shapes']
];
const title=v=>String(v||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
export default function FamilyCare({request,lineageCaseId=null,compact=false,readOnly=false,staff=false}){
 const [items,setItems]=useState(null),[selected,setSelected]=useState(null),[details,setDetails]=useState(null);
 const [settings,setSettings]=useState(null),[household,setHousehold]=useState([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[dialog,setDialog]=useState('');
 const [draft,setDraft]=useState({name:'',stage:'newborn',birth_date:'',notes:''}),[supply,setSupply]=useState({action:'restock_milk',quantity:1,detail:''});
 const [school,setSchool]=useState({school_upgrade_id:'',school_days:'1,2,3,4,5'}),[schoolChoices,setSchoolChoices]=useState([]),[milestones,setMilestones]=useState([]);
 const [careTab,setCareTab]=useState('needs');
 const [adultRefresh,setAdultRefresh]=useState(0),[settlements,setSettlements]=useState([]),[newHome,setNewHome]=useState('');

 const refresh=async()=>{
  const [list,opts]=await Promise.all([request('/family'),request('/family/settings')]);
  setItems(list.dependents||[]);setSettings(opts);
 };
 useEffect(()=>{let mounted=true;Promise.all([request('/family'),request('/family/settings')]).then(([a,b])=>{if(mounted){setItems(a.dependents||[]);setSettings(b)}}).catch(e=>{if(mounted)setError(e.message)});return()=>{mounted=false}},[]);
 const visible=(items||[]).filter(c=>!c.graduated&&(lineageCaseId===null||Number(c.lineage_case_id)===Number(lineageCaseId)));
 const child=visible.find(c=>c.id===selected)||visible[0]||null;
 const needs=child&&details?.dependent?.id===child.id?careNeeds(child,details.events||[]):[];
 const attention=carePriority(needs);
 async function loadDetail(id){
  const [d,history,marks]=await Promise.all([request('/family/'+id),request('/family/'+id+'/events'),request('/family/'+id+'/milestones')]);
  setDetails({...d,...history});
  setMilestones(marks.milestones||[]);
  setSchool({school_upgrade_id:String(d.dependent?.school_upgrade_id||''),school_days:d.dependent?.school_days||'1,2,3,4,5'});
 }
 useEffect(()=>{if(child)loadDetail(child.id).catch(e=>setError(e.message));else setDetails(null)},[child?.id]);
 async function perform(work,text){
  setBusy(true);setError('');setNotice('');
  try{await work();await refresh();if(child)await loadDetail(child.id);setNotice(text);setDialog('')}
  catch(e){setError(e.message||'Unable to record care')}
  finally{setBusy(false)}
 }
 async function create(e){e.preventDefault();await perform(()=>request('/family',{method:'POST',body:{...draft,lineage_case_id:lineageCaseId}}),'Dependent registered.')}
 async function logCare(action){await perform(()=>request('/family/'+child.id+'/care',{method:'POST',body:{action,detail:''}}),'Care recorded.')}
 async function restock(e){e.preventDefault();await perform(()=>request('/family/'+child.id+'/supplies',{method:'POST',body:{...supply,quantity:Number(supply.quantity)}}),'Supplies recorded.')}
 async function openAdulthood(){
  setError('');
  try{
   const data=await request('/family/settlements');
   setSettlements(data.settlements||[]);
   setNewHome(String(data.settlements?.[0]?.id||''));
   setDialog('adulthood');
  }catch(e){setError(e.message||'Could not load settlements')}
 }
 async function graduate(e){
  e.preventDefault();
  if(!newHome||busy||!child)return;
  await perform(()=>request('/family/'+child.id+'/adulthood',{method:'POST',body:{settlement_id:Number(newHome)}}),
   'Adulthood recorded. This civilian remains in your family history.');
  setAdultRefresh(v=>v+1);
 }
 async function updateStage(stage){await perform(()=>request('/family/'+child.id,{method:'PUT',body:{stage,notes:child.notes||''}}),'Care stage updated.')}
 async function saveSchool(e){e.preventDefault();await perform(()=>request('/family/'+child.id+'/school',{method:'PUT',body:{school_upgrade_id:school.school_upgrade_id?Number(school.school_upgrade_id):null,school_days:school.school_days}}),'School arrangements saved.')}
 async function openSchool(){setError('');try{const r=await request('/family/schools');setSchoolChoices(r.schools||[]);setDialog('school')}catch(e){setError(e.message||'Unable to load local schools')}}
 async function markMilestone(milestone,complete){await perform(()=>request('/family/'+child.id+'/milestones',{method:'POST',body:{milestone_id:milestone,complete}}),'Milestone updated.')}
 const schoolStage=child&&['child','teen'].includes(child.stage);
 const age=child?apparentAge(child.birth_date):null;
 const recommendation=suggestedStage(age);
 const skillLevels=skillProgress(details?.dependent?.id===child?.id?details.events:[]);
 async function toggleNursing(){const next=!settings.nursing_available;await perform(()=>request('/family/settings',{method:'PUT',body:{nursing_available:next}}),'Your caregiver setting was updated.')}
 async function toggleAssignment(member){
  const assigned=(details?.caregivers||[]).some(a=>a.account_id===member.id);
  await perform(()=>request('/family/'+child.id+'/assign',{method:'PUT',body:{account_id:member.id,enabled:!assigned}}),'Caregiver assignment updated.');
 }
 async function openCaregivers(){
  setError('');try{const res=await request('/family/household');setHousehold(res.members||[]);setDialog('caregivers')}catch(e){setError(e.message)}
 }
 return <section className={'family-care '+(compact?'family-compact':'')}>
  {!compact&&<header className="family-heading"><div><span>HOUSEHOLD · DEPENDENT CARE</span><h2>Family & Care</h2><p>Daily care, feeding, supplies and trusted Household support.</p></div></header>}
  {error&&<p className="lineage-error" role="alert">{error.replaceAll('_',' ')}</p>}
  {notice&&<p className="lineage-notice" role="status">{notice}</p>}
  <div className="family-toolbar">
    <span>{lineageCaseId!==null?'Lineage parenthood care':'Children & dependent care'}</span>
    {!readOnly&&<button type="button" onClick={()=>{setDraft({name:'',stage:'newborn',birth_date:'',notes:''});setDialog('new')}}><i className="fa-solid fa-plus"/> Register dependent</button>}
  </div>
  {items===null?<p className="lineage-empty">Loading care records…</p>:visible.length===0?<p className="lineage-empty">No dependents registered yet. The parent or guardian can add a care record here; dependents are kept separate from adult character rosters.</p>:<div className="family-layout">
    <aside className="family-list">{visible.map(d=><button key={d.id} className={d.id===child?.id?'selected':''} type="button" onClick={()=>setSelected(d.id)}><strong>{d.name}</strong><small>{LIFE_STAGES.find(s=>s.id===d.stage)?.name||title(d.stage)} · {d.is_guardian?'Guardian':'Assigned caregiver'}</small></button>)}</aside>
    <div className="family-detail">
      <header><div><small>{LIFE_STAGES.find(s=>s.id===child.stage)?.name||title(child.stage)} · {child.is_guardian?'Guardian record':'Household care assignment'}</small><h3>{child.name}</h3>{age!==null&&<p className="family-age">Recorded age: {age} years{recommendation&&recommendation!==child.stage?' · Stage advancement available to guardian':''}</p>}</div>
       {child.is_guardian&&!readOnly&&<div className="family-actions"><button type="button" onClick={openCaregivers}><i className="fa-solid fa-users"/> Household caregivers</button>{child.stage==='teen'&&<button type="button" onClick={openAdulthood}><i className="fa-solid fa-city"/> Enter civilian adulthood</button>}</div>}
      </header>
      <div className="family-stats"><div><small>Milk / formula available</small><strong>{child.milk_stock} servings</strong></div><div><small>Meals available</small><strong>{child.food_stock} servings</strong></div><div><small>Life stage</small><strong>{LIFE_STAGES.find(s=>s.id===child.stage)?.name||title(child.stage)}</strong></div></div>
      <nav className="family-subtabs" aria-label="Childcare views">
       {[['needs','Needs & care'],['learning','Learning & activities'],['milestones','Milestones']].map(([id,label])=><button key={id} type="button" className={careTab===id?'selected':''} aria-current={careTab===id?'page':undefined} onClick={()=>setCareTab(id)}>{label}</button>)}
      </nav>
      {careTab==='needs'&&<section className="family-needs" aria-label="Daily care needs">
       <div className="family-needs-heading"><div><h4>Daily needs</h4><p>Needs gradually change between recorded care activities.</p></div><button type="button" onClick={()=>loadDetail(child.id).catch(e=>setError(e.message))} disabled={busy}><i className="fa-solid fa-rotate" aria-hidden="true"/> Refresh</button></div>
       <div className="family-needs-grid">{needs.map(need=><div className="family-need" key={need.id}><div className="family-need-title"><span><i className={'fa-solid '+need.icon} aria-hidden="true"/> {need.label}</span><strong>{need.value}%</strong></div><div className="family-need-track" role="progressbar" aria-label={need.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={need.value}><span style={{width:need.value+'%'}}/></div><small>{need.status}</small></div>)}</div>
       {attention&&<p className="family-care-priority"><i className="fa-solid fa-clipboard-check" aria-hidden="true"/> Next priority: {attention.label.toLowerCase()}. Use the care actions below to record it.</p>}
      </section>}
      {careTab==='learning'&&<section className="family-learning">
       <h4>Development & daily routine</h4>
       {schoolStage&&<div className="family-school"><div><strong>{child.school_name||'School not assigned'}</strong><small>Class days: {(child.school_days||'1,2,3,4,5').split(',').map(n=>['','Mon','Tue','Wed','Thu','Fri','Sat','Sun'][Number(n)]).join(', ')}</small>
       {child.school_name&&<small className="family-schedule-status">{(child.school_days||'1,2,3,4,5').split(',').includes(String(new Date().getDay()||7))?'School scheduled today':'No school scheduled today'}</small>}</div>
       {child.is_guardian&&!readOnly&&<button type="button" onClick={openSchool}><i className="fa-solid fa-pen"/> Set school schedule</button>}</div>}
       <div className="family-skill-list">{Object.entries(SKILL_LABELS).map(([id,label])=><div key={id}><span>{label}</span><strong>{skillLevels[id]||0}/100</strong><div className="family-need-track"><span style={{width:(skillLevels[id]||0)+'%'}}/></div></div>)}</div>
       {!readOnly&&<div className="family-buttons">{Object.entries(SCHOOL_ACTIVITIES).filter(([,activity])=>activity.stages.includes(child.stage)).map(([id,activity])=><button key={id} type="button" disabled={busy||(['school','homework'].includes(id)&&!child.school_upgrade_id)} onClick={()=>logCare(id)}>{activity.label}</button>)}</div>}
       {!['child','teen'].includes(child.stage)&&<p className="family-hint">Early learning and play activities are available here. School schedules unlock at school age.</p>}
      </section>}
      {careTab==='milestones'&&<section className="family-learning">
       <h4>Development milestones</h4>
       <div className="family-milestone-list">{DEVELOPMENT_MILESTONES.filter(m=>m.stages.includes(child.stage)).map(m=>{const checked=milestones.some(v=>v.milestone_id===m.id);return <div key={m.id}><span><i className={'fa-solid '+(checked?'fa-circle-check':'fa-circle')} aria-hidden="true"/> {m.label}</span>{child.is_guardian&&!readOnly&&<button type="button" disabled={busy} onClick={()=>markMilestone(m.id,!checked)}>{checked?'Reopen':'Mark completed'}</button>}</div>})}</div>
      </section>}
      {careTab==='needs'&&<div className="family-controls">
       <h4>Daily care</h4>
       <div className="family-buttons">{actions.filter(([a])=>(['nursing','bottle'].includes(a)?['newborn','infant'].includes(child.stage):a==='meal'?['toddler','child','teen'].includes(child.stage):true)).map(([id,label,icon])=><button key={id} type="button" disabled={busy||readOnly||(id==='nursing'&&!settings?.nursing_available)||(id==='bottle'&&!child.milk_stock)||(id==='meal'&&!child.food_stock)} onClick={()=>logCare(id)}><i className={'fa-solid '+icon}/> {label}</button>)}</div>
       {['newborn','infant'].includes(child.stage)&&<p className="family-hint">Nursing is available only when the caregiver has enabled their own capability. Bottle feeds use recorded milk/formula supplies.</p>}
       {!readOnly&&<div className="family-actions"><button type="button" onClick={()=>{setSupply({action:['newborn','infant'].includes(child.stage)?'restock_milk':'restock_food',quantity:1,detail:''});setDialog('supplies')}}>Record acquired food</button>
       {child.is_guardian&&<label>Care stage <select value={child.stage} disabled={busy} onChange={e=>updateStage(e.target.value)}>{LIFE_STAGES.map(s=><option key={s.id} value={s.id}>{s.name} · {s.age}</option>)}</select></label>}</div>}
      </div>}
      <div className="family-events"><h4>Care log</h4>{(details?.events||[]).map(e=><div key={e.id}><strong>{title(e.action)}</strong><span>{e.display_name} · {new Date(e.created_at).toLocaleString()}</span>{e.detail&&<small>{e.detail}</small>}</div>)}{!details?.events?.length&&<p>No care has been recorded yet.</p>}</div>
    </div>
   </div>}
  <FamilyAdultLife request={request} lineageCaseId={lineageCaseId} refreshKey={adultRefresh} staff={staff} readOnly={readOnly}/>
  <div className="family-self"><div><strong>Caregiver nursing availability</strong><p>Optional personal setting for fictional infant feeding care. Household status or physical attributes never enable this automatically.</p></div><button type="button" disabled={busy||readOnly||!settings} onClick={toggleNursing}>{settings?.nursing_available?'Available — disable':'Not available — enable'}</button></div>
  {dialog&&<div className="lineage-modal-mask" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setDialog('')}}><section className="lineage-modal" role="dialog" aria-modal="true" aria-label="Dependent care editor"><header><h3>{dialog==='new'?'Register dependent':dialog==='school'?'School arrangements':dialog==='adulthood'?'Enter civilian adulthood':dialog==='supplies'?'Record supplies':'Household caregivers'}</h3><button disabled={busy} type="button" onClick={()=>setDialog('')} aria-label="Close"><i className="fa-solid fa-xmark"/></button></header>
   {dialog==='new'&&<form className="lineage-form" onSubmit={create}><label>Dependent name<input required maxLength={120} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>Age stage<select value={draft.stage} onChange={e=>setDraft({...draft,stage:e.target.value})}>{stages.map(s=><option key={s} value={s}>{title(s)}</option>)}</select></label><label>In-character birth date (optional)<input type="date" value={draft.birth_date} onChange={e=>setDraft({...draft,birth_date:e.target.value})}/></label><label className="full">Care notes<textarea maxLength={1000} value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label><footer><button type="button" onClick={()=>setDialog('')}>Cancel</button><button type="submit" disabled={busy}>Register</button></footer></form>}
   {dialog==='adulthood'&&<form className="lineage-form" onSubmit={graduate}>
    <p className="family-hint full">This ends daily dependent care and creates a named civilian connected to your family. Your adult's settlement and future workplace remain visible. Settlement population and employment totals are managed separately.</p>
    <label className="full">Starting settlement<select required value={newHome} onChange={e=>setNewHome(e.target.value)}><option value="">Choose a settlement</option>{settlements.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <footer><button type="button" onClick={()=>setDialog('')}>Cancel</button><button type="submit" disabled={busy||!newHome}>Confirm adulthood</button></footer>
   </form>}
   {dialog==='school'&&<form className="lineage-form" onSubmit={saveSchool}><label className="full">Existing school building<select value={school.school_upgrade_id} onChange={e=>setSchool({...school,school_upgrade_id:e.target.value})}><option value="">Not enrolled</option>{schoolChoices.filter(x=>x.available_seats>0||String(x.id)===school.school_upgrade_id).map(x=><option key={x.id} value={x.id}>{x.name} · {x.settlement_name} · {x.available_seats} places available · {x.teacher_count} teachers</option>)}</select></label>
     <p className="family-hint full">A school must be operational and staffed, with an available place. Buildings and staffing are managed from the settlement's Education structures.</p><label className="full">Class days<div className="family-weekdays">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day,i)=>{const code=String(i+1);const selected=school.school_days.split(',').includes(code);return <label key={code}><input type="checkbox" checked={selected} onChange={e=>{const next=new Set(school.school_days.split(',').filter(Boolean));if(e.target.checked)next.add(code);else next.delete(code);setSchool({...school,school_days:[...next].sort().join(',')})}}/>{day}</label>})}</div></label><p className="family-hint full">School attendance is recorded through the daily activity panel; the schedule does not invent automatic attendance.</p><footer><button type="button" onClick={()=>setDialog('')}>Cancel</button><button type="submit" disabled={busy||!school.school_days}>Save schedule</button></footer></form>}
   {dialog==='supplies'&&<form className="lineage-form" onSubmit={restock}><label>Supply type<select value={supply.action} onChange={e=>setSupply({...supply,action:e.target.value})}><option value="restock_milk">Milk / formula</option><option value="restock_food">Food / meals</option></select></label><label>Servings acquired<input type="number" min="1" max="100" required value={supply.quantity} onChange={e=>setSupply({...supply,quantity:e.target.value})}/></label><label className="full">Where supplies came from<input maxLength={250} required value={supply.detail} onChange={e=>setSupply({...supply,detail:e.target.value})} placeholder="Household stores, personal purchase, delivered supplies…"/></label><p className="lineage-hint full">Record actual supplies acquired for this care record. This log does not automatically transfer goods from world warehouses.</p><footer><button type="button" onClick={()=>setDialog('')}>Cancel</button><button type="submit" disabled={busy}>Record supplies</button></footer></form>}
   {dialog==='caregivers'&&<div className="family-assignment">{household.length?household.map(m=><div key={m.id}><span>{m.display_name}</span><button type="button" disabled={busy} onClick={()=>toggleAssignment(m)}>{(details?.caregivers||[]).some(a=>a.account_id===m.id)?'Remove access':'Allow care'}</button></div>):<p>No eligible Household members found.</p>}<p>Assigned Household members may record feeding and care. They can enable nursing only for their own account.</p></div>}
  </section></div>}
 </section>;
}
