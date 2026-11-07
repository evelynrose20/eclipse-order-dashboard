import React,{useEffect,useState} from 'react';
import {ERAS} from './LoreArchive.jsx';
import './public-chronicles.css';

const API=(import.meta.env.VITE_ECLIPSE_API_URL||'').replace(/\/+$/,'');
const eraName=era=>ERAS.find(([id])=>id===era)?.[1]||era;
const CHAPTERS=['thirteenth','arr','heavensward','stormblood','shadowbringers','endwalker','dawntrail','present'];
const excerpts=body=>String(body||'').split(/\n\s*\n/).filter(Boolean);
export default function PublicChronicles(){
 const [entries,setEntries]=useState([]),[state,setState]=useState('loading'),[selected,setSelected]=useState(null);
 useEffect(()=>{
  let active=true;const controller=new AbortController();
  async function load(){
   try{
    const response=await fetch(API+'/lore/public',{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error('unavailable');
    const result=await response.json();
    if(!active)return;
    const rows=(result.entries||[]).filter(e=>e.published);
    setEntries(rows);setSelected(old=>old&&rows.some(e=>e.id===old)?old:rows.find(e=>e.id==='origins-thirteenth')?.id||rows[0]?.id||null);setState('ready');
   }catch(e){if(active&&e.name!=='AbortError')setState('unavailable')}
  }
  void load();
  const refresh=()=>{if(document.visibilityState==='visible')void load()};
  document.addEventListener('visibilitychange',refresh);
  return()=>{active=false;controller.abort();document.removeEventListener('visibilitychange',refresh)};
 },[]);
 const records=entries.filter(e=>e.kind==='history');
 const current=entries.find(e=>e.id===selected)||records[0]||entries[0];
 const newCassia=entries.find(e=>e.id==='new-cassia');
 return <section className="public-section imperial-chronicles" id="chronicles" aria-labelledby="chronicles-heading">
  <div className="public-section-inner">
   <div className="imperial-chronicles-head">
    <div><div className="public-section-tag"><span>03</span><i/><span>THE WRITTEN RECORD</span></div><h2 id="chronicles-heading">From the Thirteenth.<br/><em>To New Cassia.</em></h2></div>
    <p>The Order did not begin as an imperial syndicate. Its history spans a fallen world, a noble household, the rise of an organization, and the bitter cost of its survival.</p>
   </div>
   <div className="imperial-chronicles-frame">
    <div className="imperial-chronicles-timeline" aria-label="History of the Eclipse Order">
     <div className="imperial-timeline-title">THE ORDER'S CHRONICLE</div>
     {CHAPTERS.map((era,i)=>{
      const chapters=records.filter(e=>e.era===era);
      return <div className="imperial-era" key={era}>
       <span className="imperial-era-index">{String(i+1).padStart(2,'0')}</span>
       <div><strong>{eraName(era)}</strong>
        {chapters.length?chapters.map(ch=><button type="button" key={ch.id} className={'imperial-chapter '+(current?.id===ch.id?'active':'')} aria-pressed={current?.id===ch.id} onClick={()=>setSelected(ch.id)}>{ch.title}</button>):<small>Chronicle yet to be published</small>}
       </div>
      </div>;
     })}
    </div>
    <div className="imperial-chronicles-reading" aria-live="polite">
     {state==='loading'?<p className="imperial-chronicles-message">Opening the chronicles…</p>:
      state==='unavailable'?<div className="imperial-chronicles-message"><h3>The chronicle is temporarily unavailable.</h3><p>Its pages may be read when the Order's archive is restored.</p></div>:
      current?<article key={current.id}><span className="imperial-record-kicker">{eraName(current.era)} · ORDER CHRONICLE</span><h3>{current.title}</h3>{current.summary&&<p className="imperial-record-lead">{current.summary}</p>}<div className="imperial-record-text">{excerpts(current.body).map((p,i)=><p key={i}>{p}</p>)}</div></article>:
      <p className="imperial-chronicles-message">The record awaits its first published chapter.</p>}
     {newCassia&&<aside className="imperial-cassia-feature"><span>THE ORDER'S PRESENT HOME</span><h4>{newCassia.title}</h4><p>{newCassia.summary||newCassia.body}</p><button type="button" onClick={()=>setSelected(newCassia.id)}>Read the New Cassia record <span aria-hidden="true">↗</span></button></aside>}
    </div>
   </div>
   <div className="imperial-chronicles-footer"><span>THE RECORD BELONGS TO THE ORDER.</span><a href="?lore">Explore the full archives <span aria-hidden="true">↗</span></a></div>
  </div>
 </section>;
}
