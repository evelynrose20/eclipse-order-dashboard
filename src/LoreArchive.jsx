import React,{useEffect,useMemo,useState} from 'react';
import './lore-archive.css';
import './imperial-theme.css';

const API=(import.meta.env.VITE_ECLIPSE_API_URL||'').replace(/\/+$/,'');
export const ERAS=[['garlemald','Origins & Garlean Ties'],['arr','A Realm Reborn'],['heavensward','Heavensward'],['stormblood','Stormblood'],['shadowbringers','Shadowbringers'],['endwalker','Endwalker'],['dawntrail','Dawntrail'],['present','The Return']];
const TYPES=[['history','Chronicle'],['place','Places'],['person','Figures'],['faction','Factions']];
const label=(pairs,id)=>pairs.find(([x])=>x===id)?.[1]||id;
const empty=()=>({id:'',title:'',era:'present',kind:'history',summary:'',body:'',sort_order:100,published:false});
const paragraphs=text=>String(text||'').split(/\n\s*\n/).filter(Boolean);
export default function LoreArchive({request,admin=false}){
 const [data,setData]=useState(null),[selected,setSelected]=useState(null),[filter,setFilter]=useState('all');
 const [draft,setDraft]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[saving,setSaving]=useState(false);
 const load=async()=>{
  const result=admin?await request('/lore'):await (async()=>{
   const response=await fetch(API+'/lore/public',{cache:'no-store'});
   if(!response.ok)throw new Error('The archives are temporarily unavailable.');
   return response.json();
  })();
  setData(result);
  setSelected(old=>old&&result.entries.some(e=>e.id===old)?old:(result.entries.find(e=>e.id==='new-cassia')?.id||result.entries[0]?.id||null));
 };
 useEffect(()=>{let active=true;const init=async()=>{try{const result=admin?await request('/lore'):await (async()=>{const r=await fetch(API+'/lore/public',{cache:'no-store'});if(!r.ok)throw new Error('The archives are temporarily unavailable.');return r.json()})();if(active){setData(result);setSelected(result.entries.find(e=>e.id==='new-cassia')?.id||result.entries[0]?.id||null)}}catch(e){if(active)setError(e.message)}};void init();return()=>{active=false}},[admin]);
 const entries=data?.entries||[];
 const visible=useMemo(()=>entries.filter(e=>filter==='all'||e.kind===filter||e.era===filter),[entries,filter]);
 const entry=entries.find(e=>e.id===selected)||visible[0]||null;
 const editing=admin&&data?.can_edit;
 const edit=e=>{setSelected(e.id);setDraft({...e})};
 const make=()=>{setDraft(empty());setNotice('');setError('')};
 const save=async e=>{
  e.preventDefault();if(!editing||!draft)return;
  const payload={...draft,id:draft.id.trim().toLowerCase(),title:draft.title.trim(),summary:draft.summary.trim(),body:draft.body.trim(),sort_order:Number(draft.sort_order)};
  setSaving(true);setError('');setNotice('');
  try{
   await request('/lore'+(entries.some(x=>x.id===payload.id)?'/'+payload.id:''),{method:entries.some(x=>x.id===payload.id)?'PUT':'POST',body:payload});
   setDraft(null);await load();setSelected(payload.id);setNotice('Entry saved to the Order’s chronicle.');
  }catch(err){setError(err.message||'This entry could not be saved.')}finally{setSaving(false)}
 };
 return <div className={'lore-root '+(admin?'lore-internal':'lore-public')}>
  {!admin&&<nav className="lore-exit"><a href="./"><i className="fa-solid fa-book-open"/> Imperium Noctis</a><a href="./#history">Return to the Order</a><a href="?portal">Member sign-in</a></nav>}
  <header className="lore-hero"><span className="lore-kicker">IMPERIUM NOCTIS · THE WRITTEN RECORD</span><h1>Chronicles of <em>the Eclipse.</em></h1><p>Explore the Imperium Noctis’s Garlean-influenced ambitions, the upheaval of the Final Days, and its imperial resurgence under Domina Rosa in New Cassia.</p><div className="lore-hero-mark" aria-hidden="true"><i className="fa-solid fa-book-open"/></div></header>
  {error&&<div className="lore-error" role="alert">{error}</div>}{notice&&<p className="lore-notice" role="status">{notice}</p>}
  <div className="lore-layout">
   <aside className="lore-index"><div className="lore-index-head"><span>THE ARCHIVES</span>{editing&&<button type="button" onClick={make}>+ New entry</button>}</div>
    <label className="lore-filter-label">Browse records<select value={filter} onChange={e=>{setFilter(e.target.value);setDraft(null)}}><option value="all">All chronicles</option><optgroup label="Records">{TYPES.map(([id,name])=><option key={id} value={id}>{name}</option>)}</optgroup><optgroup label="Eras">{ERAS.map(([id,name])=><option key={id} value={id}>{name}</option>)}</optgroup></select></label>
    <div className="lore-entries">{visible.map(item=><button type="button" key={item.id} className={'lore-index-entry '+(entry?.id===item.id?'active':'')} onClick={()=>{setSelected(item.id);setDraft(null)}}><span>{label(ERAS,item.era)} · {label(TYPES,item.kind)}</span><strong>{item.title}</strong>{admin&&!item.published&&<small>Unpublished</small>}</button>)}</div>
    {data&&!visible.length&&<p className="lore-empty">No records in this collection.</p>}
   </aside>
   <main className="lore-sheet">
    {draft&&editing?<form className="lore-editor" onSubmit={save}>
     <span className="lore-kicker">EDIT THE RECORD</span><h2>{entries.some(e=>e.id===draft.id)?'Revise an entry':'A new chapter'}</h2>
     <label>Entry address <input required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={72} disabled={entries.some(e=>e.id===draft.id)} value={draft.id} onChange={e=>setDraft({...draft,id:e.target.value})} placeholder="example-chronicle"/></label>
     <label>Title<input required maxLength={160} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
     <div className="lore-editor-grid"><label>Era<select value={draft.era} onChange={e=>setDraft({...draft,era:e.target.value})}>{ERAS.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label>Record type<select value={draft.kind} onChange={e=>setDraft({...draft,kind:e.target.value})}>{TYPES.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label></div>
     <label>Short introduction<textarea rows={3} maxLength={420} value={draft.summary} onChange={e=>setDraft({...draft,summary:e.target.value})}/></label>
     <label>Chapter text<textarea rows={13} maxLength={16000} value={draft.body} onChange={e=>setDraft({...draft,body:e.target.value})} placeholder="Write the Order's history here. Separate paragraphs with a blank line."/></label>
     <div className="lore-editor-grid"><label>Display order<input type="number" min={-10000} max={10000} value={draft.sort_order} onChange={e=>setDraft({...draft,sort_order:e.target.value})}/></label><label className="lore-publish"><input type="checkbox" checked={!!draft.published} onChange={e=>setDraft({...draft,published:e.target.checked})}/> Publish to the public archive</label></div>
     <div className="lore-editor-actions"><button type="submit" disabled={saving}>{saving?'Saving…':'Save entry'}</button><button type="button" onClick={()=>setDraft(null)}>Cancel</button></div>
    </form>:entry?<article className="lore-reading"><span className="lore-kicker">{label(ERAS,entry.era)} / {label(TYPES,entry.kind)}</span><div className="lore-reading-head"><h2>{entry.title}</h2>{editing&&<button type="button" onClick={()=>edit(entry)}>Edit entry</button>}</div>{entry.summary&&<p className="lore-lead">{entry.summary}</p>}<div className="lore-text">{paragraphs(entry.body).map((p,i)=><p key={i}>{p}</p>)}</div>{admin&&!entry.published&&<p className="lore-private">This entry is visible to Order leadership until it is published.</p>}</article>:<div className="lore-empty lore-reading">{data?'The archives are awaiting their first record.':'Opening the chronicles…'}</div>}
   </main>
  </div>
  {!admin&&<footer className="lore-footer"><span>IMPERIUM NOCTIS · ILSABARD · NEW CASSIA</span><a href="./#visit">In-game estate address</a></footer>}
 </div>;
}
