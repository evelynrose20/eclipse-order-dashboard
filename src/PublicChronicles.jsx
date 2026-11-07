import React,{useEffect,useState} from 'react';
import {ERAS} from './LoreArchive.jsx';
import './public-chronicles.css';

const API=(import.meta.env.VITE_ECLIPSE_API_URL||'').replace(/\/+$/,'');
const eraName=era=>ERAS.find(([id])=>id===era)?.[1]||era;
const CHAPTERS=['thirteenth','arr','heavensward','stormblood','shadowbringers','endwalker','dawntrail','present'];
// Published founding extracts remain readable even when the public archive cannot be reached.
const FOUNDING_RECORDS=[
 {id:'origins-thirteenth',title:'The House Before the Flood',era:'thirteenth',kind:'history',published:true,summary:'Elira’s own history reaches back to the Thirteenth; the Order itself began in Garlemald.',body:'Elira’s life before the Source belongs to her personal history. She would later establish the Eclipse Order as a Garlean organization under her own rule.'},
 {id:'carteneau-crossing',title:'A Passage into the Source',era:'arr',kind:'history',published:true,summary:'Elira crossed into the Source near Carteneau.',body:'The crossing preceded Elira’s establishment of the Garlean-founded Eclipse Order. The organization would serve her authority, not another throne.'},
 {id:'yanxia-order',title:'The Order Takes Shape',era:'stormblood',kind:'history',published:true,summary:'The Garlean Order established its formal hierarchy and a base in Yanxia.',body:'The Order was founded in Garlemald. In Stormblood, its operations in Yanxia grew and its formal ranks were established. Yanxia was an expansion, not its birthplace.'},
 {id:'final-days-fall',title:'The Breaking of the Order',era:'endwalker',kind:'history',published:true,summary:'The Final Days shattered the Order.',body:'The Order’s losses scattered its members and ended the organization as it had been. Its survival into the present was never certain.'},
 {id:'dawntrail-return',title:'What Remains After Dawntrail',era:'dawntrail',kind:'history',published:true,summary:'The Order faces the consequences of its fall and Elira’s return.',body:'Old rivals, Garlean remnants and criminal families have their own reasons to welcome or oppose the Order’s return.'},
 {id:'new-cassia',title:'New Cassia',era:'present',kind:'place',published:true,summary:'Elira’s home in Ilsabard and the center of the Order’s new direction.',body:'An in-character home for stories of imperial politics, the underworld, and uneasy alliances.'}
];

const excerpts=body=>String(body||'').split(/\n\s*\n/).filter(Boolean);
export default function PublicChronicles(){
 const [entries,setEntries]=useState(FOUNDING_RECORDS),[state,setState]=useState('loading'),[selected,setSelected]=useState(null);
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
    <p>Founded in Garlemald under Elira’s rule, the Eclipse Order outlived its imperial beginnings, expanded into Yanxia, and endured the cost of its own collapse.</p>
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
     {state==='loading'?<article><span className="imperial-record-kicker">THE FOUNDING RECORD</span><h3>{current?.title||'The Order remembers.'}</h3>{current?.summary&&<p className="imperial-record-lead">{current.summary}</p>}<div className="imperial-record-text">{excerpts(current?.body).map((p,i)=><p key={i}>{p}</p>)}</div></article>:
      state==='unavailable'?<article><span className="imperial-record-kicker">THE FOUNDING RECORD</span><h3>{current?.title||'The Order remembers.'}</h3>{current?.summary&&<p className="imperial-record-lead">{current.summary}</p>}<div className="imperial-record-text">{excerpts(current?.body).map((p,i)=><p key={i}>{p}</p>)}</div><small className="imperial-chronicles-stale">The complete chronicle is available when the Order’s archives reopen.</small></article>:
      current?<article key={current.id}><span className="imperial-record-kicker">{eraName(current.era)} · ORDER CHRONICLE</span><h3>{current.title}</h3>{current.summary&&<p className="imperial-record-lead">{current.summary}</p>}<div className="imperial-record-text">{excerpts(current.body).map((p,i)=><p key={i}>{p}</p>)}</div></article>:
      <p className="imperial-chronicles-message">The record awaits its first published chapter.</p>}
     {newCassia&&<aside className="imperial-cassia-feature"><span>THE ORDER'S PRESENT HOME</span><h4>{newCassia.title}</h4><p>{newCassia.summary||newCassia.body}</p><button type="button" onClick={()=>setSelected(newCassia.id)}>Read the New Cassia record <span aria-hidden="true">↗</span></button></aside>}
    </div>
   </div>
   <div className="imperial-chronicles-footer"><span>THE RECORD BELONGS TO THE ORDER.</span><a href="?lore">Explore the full archives <span aria-hidden="true">↗</span></a></div>
  </div>
 </section>;
}
