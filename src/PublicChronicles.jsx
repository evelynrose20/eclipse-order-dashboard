import React,{useEffect,useState} from 'react';
import {ERAS} from './LoreArchive.jsx';
import './public-chronicles.css';

const API=(import.meta.env.VITE_ECLIPSE_API_URL||'').replace(/\/+$/,'');
const eraName=era=>ERAS.find(([id])=>id===era)?.[1]||era;
const CHAPTERS=['garlemald','arr','heavensward','stormblood','shadowbringers','endwalker','dawntrail','present'];
// Published founding summaries remain readable while the archive loads.
const FOUNDING_RECORDS=[
 {id:'origins-thirteenth',title:'Origins in Garlemald',era:'garlemald',kind:'history',published:true,summary:'The Eclipse Order began as a Garlean organization built on influence, secrecy and criminal enterprise.',body:'Its origins lie in Garlemald, where imperial society and the underworld created opportunities for those prepared to exploit them. The details of its earliest campaigns remain part of the Order’s developing chronicle.'},
 {id:'carteneau-crossing',title:'Dalamud and the Calamity',era:'arr',kind:'history',published:true,summary:'The fall of Dalamud marked an era of upheaval for Garlemald and the wider world.',body:'Elira was born in Garlemald and was already alive during the Battle of Carteneau and Dalamud’s fall. Vy’lana remains part of her history. The precise effects of the Calamity on the Order’s early operations are yet to be chronicled.'},
 {id:'yanxia-order',title:'The Yanxia Operations',era:'stormblood',kind:'history',published:true,summary:'The Garlean-born syndicate expanded into Yanxia and formalized its branches.',body:'During Stormblood, the Eclipse Order established its formal ranks and expanded its operations in Yanxia. The region became a significant chapter in its history, but not its birthplace.'},
 {id:'final-days-fall',title:'The Breaking of the Order',era:'endwalker',kind:'history',published:true,summary:'The Final Days shattered the Order’s operations and scattered its people.',body:'The Final Days and their aftermath brought years of disarray to the Eclipse Order. Its surviving loyalties would be tested long after the organization fell silent.'},
 {id:'dawntrail-return',title:'After Dawntrail',era:'dawntrail',kind:'history',published:true,summary:'Old rivals and uneasy allies react to the return of a Garlean criminal power.',body:'The Order’s reappearance invites responses from imperial remnants, rival criminal families and those who still remember its old bargains.'},
 {id:'new-cassia',title:'New Cassia',era:'present',kind:'place',published:true,summary:'A renewed center for the Order’s influence in Ilsabard.',body:'New Cassia offers a home for Garlean political intrigue, underworld deals and the Order’s next chapter.'}
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
    setEntries(rows);setSelected(old=>old&&rows.some(e=>e.id===old)?old:rows.find(e=>e.era==='garlemald'&&e.kind==='history')?.id||rows[0]?.id||null);setState('ready');
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
    <div><div className="public-section-tag"><span>03</span><i/><span>THE WRITTEN RECORD</span></div><h2 id="chronicles-heading">From Garlemald.<br/><em>To New Cassia.</em></h2></div>
    <p>From its Garlean beginnings to the operations in Yanxia, the collapse of its old power and the struggle to rebuild in New Cassia.</p>
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
