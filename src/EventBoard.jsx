import React,{useEffect,useMemo,useState} from 'react';
import {listEncounters,encounterCheck} from './apiBridge.js';
import {EventSignups} from './EventPlanning.jsx';
import {CONTENT_THEMES} from './ProfileConsent.jsx';
import './event-board.css';
import {readEventStory,eventTypeLabel} from '../server/src/event-story.js';

const themeName=id=>CONTENT_THEMES.find(([key])=>key===id)?.[1]||id;
const dateLabel=value=>{
 if(!value)return 'Date to be announced';
 const time=new Date(value);
 return Number.isNaN(time.getTime())?'Date to be announced':time.toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
};
const timeLabel=value=>{
 if(!value)return 'Schedule pending';
 const d=new Date(value);
 if(Number.isNaN(d.getTime()))return 'Schedule pending';
 return d.toLocaleDateString(undefined,{month:'short',day:'numeric'});
};
const statusLabel=event=>{
 if(event.status==='draft')return 'Sign-ups open';
 if(event.status==='active')return 'In progress';
 if(event.status==='paused')return 'On hold';
 if(event.status==='finished')return 'Completed';
 return (event.status||'Scheduled').replaceAll('_',' ');
};
const statusClass=event=>event.status==='active'?'live':event.status==='finished'?'closed':'open';

export default function EventBoard({userId,characters,onOpenProfile,previewOnly=false}){
 const [events,setEvents]=useState([]);
 const [selectedId,setSelectedId]=useState('');
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [working,setWorking]=useState(false);
 const [showSignups,setShowSignups]=useState(false);
 const [check,setCheck]=useState(null);
 const selected=events.find(e=>e.id===selectedId)||null;
 const ownCharacters=useMemo(()=>characters.filter(c=>c.player_user_id===userId),[characters,userId]);
 async function refresh(){
  const all=await listEncounters();
  const visible=all.filter(e=>e.published);
  setEvents(visible);
  setSelectedId(previous=>visible.some(e=>e.id===previous)?previous:visible[0]?.id||'');
 }
 useEffect(()=>{
  let alive=true;
  const reload=async()=>{try{const all=await listEncounters();if(!alive)return;const visible=all.filter(e=>e.published);setEvents(visible);setSelectedId(previous=>visible.some(e=>e.id===previous)?previous:visible[0]?.id||'');setError('')}catch(e){if(alive)setError(e.message)}finally{if(alive)setLoading(false)}};
  reload();const timer=setInterval(reload,30000);
  return()=>{alive=false;clearInterval(timer)};
 },[]);
 useEffect(()=>{
  if(!selectedId){setCheck(null);return;}
  let alive=true;
  encounterCheck(selectedId).then(result=>{if(alive)setCheck(result)}).catch(()=>{if(alive)setCheck(null)});
  return()=>{alive=false};
 },[selectedId]);
 async function action(fn){
  if(previewOnly)return;
  setWorking(true);setError('');
  try{const result=await fn();await refresh();return result}
  catch(e){setError(e.message)}
  finally{setWorking(false)}
 }
 function choose(id){setSelectedId(id);setShowSignups(false);setError('')}
 return <div className="order-event-board">
  <header className="order-event-board-intro">
   <span className="order-event-eyebrow">THE ECLIPSE ORDER / GATHERINGS</span>
   <div className="order-event-heading"><span className="order-event-sigil" aria-hidden="true">✦</span><div><h2>The Event Board</h2><p>Discover upcoming stories, join an event, and follow the Order's activities.</p></div></div>
  </header>
  <div className="order-event-board-frame">
   <aside className="order-event-postings" aria-label="Published events">
    <div className="order-event-list-label">OPEN POSTINGS <span>{events.length}</span></div>
    {loading?<p className="order-event-muted">Loading events…</p>:events.length===0?<div className="order-event-empty-list"><strong>No postings yet</strong><p>Check back for the Order's next event.</p></div>:
     <div className="order-event-list">{events.map(event=><button type="button" key={event.id} onClick={()=>choose(event.id)} aria-pressed={selectedId===event.id} className={'order-event-posting '+(selectedId===event.id?'selected':'')}>
      <span className="order-event-posting-top"><span>{event.status==='draft'?'RECRUITING':statusLabel(event).toUpperCase()}</span><span className={'order-event-posting-stamp '+statusClass(event)}>{timeLabel(event.starts_at)}</span></span>
      <strong>{event.name}</strong>
      <span className="order-event-posting-metadata"><span className={readEventStory(event.event_story).type==='fc_msq'?'order-event-msq':''}>{eventTypeLabel(readEventStory(event.event_story).type)}</span> · {event.event_story?'D'+readEventStory(event.event_story).difficulty+' · I'+readEventStory(event.event_story).impact:'Difficulty pending'}{event.event_story?' · '+(readEventStory(event.event_story).chapters.length?readEventStory(event.event_story).chapters.length+' chapters':'One-shot'):''}</span>
      <span className="order-event-posting-bottom">{event.location||'Location to be announced'}</span>
      <span className="order-event-posting-count">{Number(event.signup_count)||0} of {event.capacity||8} approved</span>
     </button>)}</div>}
   </aside>
   <main className="order-event-detail" aria-live="polite">
    {!selected?<div className="order-event-no-selection"><span aria-hidden="true">✦</span><h3>{loading?'Gathering the postings':'No events posted'}</h3><p>{loading?'':"When the Order announces its next event, you'll find its details here."}</p></div>:
     <>
      <div className="order-event-detail-top">
       <div><span className="order-event-eyebrow">{eventTypeLabel(readEventStory(selected.event_story).type)}{readEventStory(selected.event_story).type==='fc_msq'?' · MAIN STORY':''}</span><h3>{selected.name}</h3></div>
       <span className={'order-event-status '+statusClass(selected)}>{statusLabel(selected)}</span>
      </div>
      <div className="order-event-detail-facts">
       <div><span>DATE & TIME</span><strong>{dateLabel(selected.starts_at)}</strong></div>
       <div><span>LOCATION</span><strong>{selected.location||'To be announced'}</strong></div>
       <div><span>PARTY</span><strong>{Number(selected.signup_count)||0} / {selected.capacity||8} approved</strong></div>
      </div>
      {selected.event_story?<div className="order-event-stakes"><span><strong>D{readEventStory(selected.event_story).difficulty}</strong> Difficulty</span><span><strong>I{readEventStory(selected.event_story).impact}</strong> Impact</span><span>{readEventStory(selected.event_story).chapters.length?readEventStory(selected.event_story).chapters.length+'-chapter story':'One-shot'}</span></div>:<p className="order-event-muted">Difficulty and impact to be announced.</p>}
      <section className="order-event-story">
       <h4>The posting</h4><p>{selected.description||'Details will be announced soon.'}</p>
      </section>
      {readEventStory(selected.event_story).chapters.length>0&&<section className="order-event-chapters"><h4>Chapters</h4><div>{readEventStory(selected.event_story).chapters.map((chapter,index)=><article className="order-event-chapter" key={index}><span className="order-event-chapter-number">{index+1}</span><div><strong>{chapter.title}</strong>{readEventStory(selected.event_story).type==='fc_msq'&&<span className="order-event-chapter-msq">FC MSQ</span>}{chapter.description&&<p>{chapter.description}</p>}</div><span className="order-event-chapter-difficulty">D{chapter.difficulty}</span></article>)}</div></section>}
      {Array.isArray(selected.themes)&&selected.themes.length>0&&<section className="order-event-themes"><h4>Event themes</h4><div>{selected.themes.map(id=><span key={id}>{themeName(id)}</span>)}</div></section>}
      {check?.missing_themes?.length>0&&<div className="order-event-guidance"><p>This event includes themes outside your current RP preferences.</p><button className="btn secondary" onClick={onOpenProfile} type="button">Review my RP preferences</button></div>}
      <section className="order-event-join">
       <div className="order-event-join-info"><span>JOIN THE EVENT</span><strong>{selected.status==='draft'?(previewOnly?'Preview event registration':ownCharacters.length?'Choose a character to sign up':'A character is required to sign up'):statusLabel(selected)}</strong></div>
       {selected.status==='draft'&&<button type="button" className="order-event-join-button" aria-expanded={showSignups} onClick={()=>setShowSignups(p=>!p)}>{showSignups?'Hide sign-ups':'View sign-ups'} <span aria-hidden="true">{showSignups?'−':'+'}</span></button>}
       {selected.status!=='draft'&&<button type="button" className="order-event-join-button" aria-expanded={showSignups} onClick={()=>setShowSignups(p=>!p)}>My registration <span aria-hidden="true">{showSignups?'−':'+'}</span></button>}
      </section>
      {showSignups&&<div className="order-event-signups"><EventSignups key={selected.id} event={selected} characters={characters} userId={userId} canDirect={false} ownOnly previewOnly={previewOnly} working={working} action={action} refresh={refresh}/></div>}
     </>}
    {error&&<div role="alert" className="alert">{error}</div>}
   </main>
  </div>
 </div>;
}
