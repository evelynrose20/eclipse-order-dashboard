import React,{useEffect,useState} from 'react';

const blank=()=>({id:null,question:'',answer:'',sort_order:100,published:false});
export default function FAQEditor({request,canEdit}){
 const [entries,setEntries]=useState(null),[selected,setSelected]=useState(null);
 const [working,setWorking]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=async()=>{
  const data=await request('/faq');
  setEntries(data.entries||[]);
  return data.entries||[];
 };
 useEffect(()=>{
  let active=true;
  request('/faq').then(data=>{if(active)setEntries(data.entries||[])}).catch(e=>{if(active)setError(e.message||'The questions could not be opened.')});
  return()=>{active=false};
 },[request]);
 const edit=entry=>{setSelected({...entry});setError('');setNotice('')};
 const save=async e=>{
  e.preventDefault();if(!canEdit||!selected)return;
  const value={question:selected.question.trim(),answer:selected.answer.trim(),sort_order:Number(selected.sort_order),published:!!selected.published};
  if(!value.question||!value.answer){setError('Both a question and an answer are required.');return}
  setWorking(true);setError('');setNotice('');
  try{
   const path=selected.id?'/faq/'+selected.id:'/faq';
   await request(path,{method:selected.id?'PUT':'POST',body:value});
   const updated=await load();setSelected(null);
   setNotice('The question was saved. Published changes appear on the public site.');
  }catch(e){setError(e.message||'Unable to save this question.')}finally{setWorking(false)}
 };
 const remove=async()=>{
  if(!canEdit||!selected?.id||!window.confirm('Permanently remove this question from the Order’s FAQ?'))return;
  setWorking(true);setError('');
  try{await request('/faq/'+selected.id,{method:'DELETE'});await load();setSelected(null);setNotice('The question was removed.')}
  catch(e){setError(e.message||'Unable to remove the question.')}finally{setWorking(false)}
 };
 return <section className="panel eo-faq-editor">
  <div className="panel-heading"><div><h2>Public FAQ</h2><p>Questions and answers presented to visitors to the Order.</p></div>{canEdit&&<button type="button" className="btn primary" onClick={()=>edit(blank())}>Add a question</button>}</div>
  {error&&<div className="alert" role="alert">{error}</div>}
  {notice&&<p className="eo-faq-notice" role="status">{notice}</p>}
  {entries===null?<p className="muted">Opening the questions…</p>:
   <div className="eo-faq-list">{entries.map(entry=><article key={entry.id} className="eo-faq-row">
    <div><span className="eo-faq-position">POSITION {entry.sort_order}</span><strong>{entry.question}</strong><p>{entry.answer}</p></div>
    <div className="eo-faq-row-actions"><span className={'eo-faq-visibility '+(entry.published?'is-published':'')}>{entry.published?'Published':'Draft'}</span>{canEdit&&<button type="button" className="mini-btn" onClick={()=>edit(entry)}>Edit</button>}</div>
   </article>)}{!entries.length&&<p className="muted">No questions have been added yet.</p>}</div>}
  {selected&&canEdit&&<form className="eo-faq-form" onSubmit={save}>
   <h3>{selected.id?'Edit question':'New question'}</h3>
   <label className="field"><span>QUESTION</span><input required maxLength={240} value={selected.question} onChange={e=>setSelected({...selected,question:e.target.value})}/></label>
   <label className="field"><span>ANSWER</span><textarea required rows={5} maxLength={8000} value={selected.answer} onChange={e=>setSelected({...selected,answer:e.target.value})}/></label>
   <div className="eo-faq-options"><label className="field"><span>DISPLAY ORDER</span><input type="number" min={-10000} max={10000} required value={selected.sort_order} onChange={e=>setSelected({...selected,sort_order:e.target.value})}/></label>
    <label className="eo-faq-publish"><input type="checkbox" checked={!!selected.published} onChange={e=>setSelected({...selected,published:e.target.checked})}/> Show on public site</label></div>
   <div className="eo-faq-form-actions"><button className="btn primary" disabled={working} type="submit">{working?'Saving…':'Save question'}</button><button className="btn secondary" type="button" onClick={()=>setSelected(null)}>Cancel</button>{selected.id&&<button type="button" className="eo-faq-remove" disabled={working} onClick={remove}>Remove question</button>}</div>
  </form>}
 </section>;
}
