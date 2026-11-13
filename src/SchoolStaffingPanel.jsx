import React,{useEffect,useState} from 'react';
export default function SchoolStaffingPanel({school,request}){
 const [record,setRecord]=useState(null),[draft,setDraft]=useState({teachers:0,support_staff:0}),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function load(){
  const r=await request('/family/schools/'+school.id);
  setRecord(r.school);setDraft({teachers:Number(r.school.teacher_count||0),support_staff:Number(r.school.support_staff||0)});
 }
 useEffect(()=>{let mounted=true;request('/family/schools/'+school.id).then(r=>{
  if(mounted){setRecord(r.school);setDraft({teachers:Number(r.school.teacher_count||0),support_staff:Number(r.school.support_staff||0)})}
 }).catch(e=>{if(mounted)setError(e.message)});return()=>{mounted=false}},[school.id]);
 async function save(e){
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{await request('/family/schools/'+school.id,{method:'PUT',body:{teachers:Number(draft.teachers),support_staff:Number(draft.support_staff)}});
   await load();setEditing(false);setNotice('School staffing updated.')}
  catch(e){setError(e.message||'Unable to save school staffing')}
  finally{setBusy(false)}
 }
 return <section className="wa-school-staff">
  <div className="wa-school-staff-header"><strong><i className="fa-solid fa-person-chalkboard"/> School operations</strong>
   <button type="button" onClick={()=>setEditing(v=>!v)} disabled={busy}>{editing?'Cancel':'Manage staff'}</button></div>
  {record?<div className="wa-school-staff-metrics">
    <span>Teachers <strong>{Number(record.teacher_count)||0}</strong></span>
    <span>Support staff <strong>{Number(record.support_staff)||0}</strong></span>
    <span>Available seats <strong>{record.available_seats} / {record.staffed_seats}</strong></span>
    <span>Enrolled <strong>{record.enrolled}</strong></span>
  </div>:<p>Checking staffing and classroom capacity…</p>}
  {editing&&<form className="wa-school-staff-editor" onSubmit={save}>
    <label>Assigned teachers<input required type="number" min="0" max="10000" value={draft.teachers} onChange={e=>setDraft(v=>({...v,teachers:e.target.value}))}/></label>
    <label>Support staff<input required type="number" min="0" max="10000" value={draft.support_staff} onChange={e=>setDraft(v=>({...v,support_staff:e.target.value}))}/></label>
    <small>Teachers provide up to 20 places each, capped by the school's effective building capacity. All school staff are allocated from this settlement's existing workforce.</small>
    <button type="submit" disabled={busy}>{busy?'Saving…':'Save staffing'}</button>
   </form>}
  {error&&<p role="alert" className="wa-error">{error.replaceAll('_',' ')}</p>}
  {notice&&<p role="status" className="wa-notice">{notice}</p>}
 </section>;
}
