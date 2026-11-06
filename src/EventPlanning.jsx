import React,{useEffect,useState} from 'react';
import {readEventStory,MAX_CHAPTERS,eventTypeLabel} from '../server/src/event-story.js';
import {CONTENT_THEMES} from './ProfileConsent.jsx';
import {
 editPlannedEvent,signupForEvent,listEventSignups,decideEventSignup,
 withdrawEventSignup,addApprovedEventPlayer
} from './apiBridge.js';

const displayDate=value=>value?new Date(value).toLocaleString():'Not scheduled';
const localDate=value=>{
 if(!value)return '';
 const d=new Date(value),pad=v=>String(v).padStart(2,'0');
 return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
};
const initial=evt=>({
 name:evt?.name||'',description:evt?.description||'',location:evt?.location||'',
 starts_at:localDate(evt?.starts_at),capacity:evt?.capacity||8,
 published:Boolean(evt?.published),themes:evt?.themes||[],event_story:readEventStory(evt?.event_story)
});
export function EventEditor({event,save,working}){
 const [form,setForm]=useState(()=>initial(event));
 useEffect(()=>setForm(initial(event)),[event?.id]);
 const field=(k,value)=>setForm(f=>({...f,[k]:value}));
 const story=(key,value)=>setForm(f=>({...f,event_story:{...f.event_story,[key]:value}}));
 const chapters=form.event_story.chapters;
 const editChapter=(i,key,value)=>story('chapters',chapters.map((c,n)=>n===i?{...c,[key]:value}:c));
 const addChapter=()=>{if(chapters.length<MAX_CHAPTERS)story('chapters',[...chapters,{title:'',description:'',difficulty:form.event_story.difficulty}])};
 function submit(e){e.preventDefault();save({...form,starts_at:form.starts_at?new Date(form.starts_at).toISOString():null})}
 return <form className="event-editor" onSubmit={submit}>
  <div className="event-form-grid">
   <label className="field"><span>EVENT TITLE</span><input required minLength={2} maxLength={140} value={form.name} onChange={e=>field('name',e.target.value)}/></label>
   <label className="field"><span>EVENT DATE & TIME</span><input required={form.published} type="datetime-local" value={form.starts_at} onChange={e=>field('starts_at',e.target.value)}/></label>
   <label className="field"><span>LOCATION / VENUE</span><input maxLength={160} placeholder="FC house, Kugane, etc." value={form.location} onChange={e=>field('location',e.target.value)}/></label>
   <label className="field"><span>PARTY CAPACITY</span><input type="number" min={1} max={60} value={form.capacity} onChange={e=>field('capacity',Number(e.target.value))}/></label>
  </div>
  <label className="field"><span>EVENT DESCRIPTION</span><textarea rows={4} maxLength={2400} value={form.description} onChange={e=>field('description',e.target.value)}/></label>
  <section className="event-story-editor">
   <div className="event-story-head"><h3>Story & stakes</h3><p>Mark major Order story events and set the challenge and consequences participants can expect.</p></div>
   <div className="event-form-grid">
    <label className="field"><span>EVENT TYPE</span><select value={form.event_story.type} onChange={e=>story('type',e.target.value)}><option value="standard">Order Event</option><option value="fc_msq">FC MSQ · Main Story</option><option value="side_story">Side Story</option></select></label>
    <label className="field"><span>DIFFICULTY · D1–D10</span><select value={form.event_story.difficulty} onChange={e=>story('difficulty',Number(e.target.value))}>{Array.from({length:10},(_,n)=><option value={n+1} key={n+1}>D{n+1}</option>)}</select></label>
    <label className="field"><span>IMPACT · I1–I5</span><select value={form.event_story.impact} onChange={e=>story('impact',Number(e.target.value))}>{Array.from({length:5},(_,n)=><option value={n+1} key={n+1}>I{n+1}</option>)}</select></label>
   </div>
   <div className="event-story-legend"><span><strong>Difficulty</strong> measures how challenging the event is.</span><span><strong>Impact</strong> measures how far its outcome reaches into the Order's story.</span></div>
   <div className="event-story-head"><h3>Chapters</h3><p>Divide an event into scenes or sessions. Each chapter can have its own difficulty.</p></div>
   <div className="event-chapter-edit-list">{chapters.map((chapter,i)=><div className="event-chapter-edit" key={i}><div className="event-chapter-edit-top"><strong>Chapter {i+1}</strong><button className="mini-btn danger" type="button" onClick={()=>story('chapters',chapters.filter((_,n)=>i!==n))}>Remove</button></div>
    <div className="event-form-grid"><label className="field"><span>TITLE</span><input required maxLength={100} value={chapter.title} onChange={e=>editChapter(i,'title',e.target.value)} placeholder="Chapter title"/></label><label className="field"><span>DIFFICULTY</span><select value={chapter.difficulty} onChange={e=>editChapter(i,'difficulty',Number(e.target.value))}>{Array.from({length:10},(_,n)=><option value={n+1} key={n+1}>D{n+1}</option>)}</select></label></div>
    <label className="field"><span>CHAPTER DESCRIPTION</span><textarea rows={2} maxLength={500} value={chapter.description} onChange={e=>editChapter(i,'description',e.target.value)}/></label>
   </div>)}</div>
   <button type="button" className="btn secondary" disabled={chapters.length>=MAX_CHAPTERS} onClick={addChapter}>+ Add chapter {chapters.length}/{MAX_CHAPTERS}</button>
  </section>
  <div className="event-theme-box"><strong>Event content categories</strong><p>Choose the themes participants should know about before signing up.</p><div className="encounter-themes">{CONTENT_THEMES.map(([id,label])=><label key={id}><input type="checkbox" checked={form.themes.includes(id)} onChange={e=>field('themes',e.target.checked?[...form.themes,id]:form.themes.filter(t=>t!==id))}/>{label}</label>)}</div></div>
  <label className="event-publish"><input type="checkbox" checked={form.published} onChange={e=>field('published',e.target.checked)}/> Publish event and open sign-ups <small>Leave unchecked to prepare privately first.</small></label>
  <button className="btn primary" disabled={working} type="submit">Save event details</button>
 </form>;
}
export function EventSignups({event,characters,userId,canDirect,working,action,refresh,previewOnly=false,ownOnly=false}){
 const [signups,setSignups]=useState([]),[selectedCharacter,setSelectedCharacter]=useState('');
 const [error,setError]=useState('');
 const own=characters.filter(c=>c.player_user_id===userId);
 async function load(){try{setSignups(await listEventSignups(event.id));setError('')}catch(e){setError(e.message)}}
 useEffect(()=>{let active=true;const reload=async()=>{try{const rows=await listEventSignups(event.id);if(active)setSignups(rows)}catch(e){if(active)setError(e.message)}};reload();const timer=setInterval(reload,30000);return()=>{active=false;clearInterval(timer)}},[event.id]);
 async function apply(fn){await action(fn);await load();await refresh()}
 const visibleSignups=(ownOnly||previewOnly)?signups.filter(s=>s.player_user_id===userId):signups;
 const approve=signups.filter(s=>s.status==='approved');
 return <section className="panel event-signups">
  <div className="panel-heading"><div><h2>{ownOnly?'My event registration':'Registration & party approvals'}</h2><p>{ownOnly?'Choose one of your characters to request a place, or review and withdraw your own signups.':'Members apply with their own character. The GM approves applicants, then chooses when to add them to the party.'}</p></div><span className="event-count">{approve.length} / {event.capacity||8} approved</span></div>
  {!canDirect&&event.published&&event.status==='draft'&&<div className="signup-form"><label className="field"><span>SIGN UP WITH CHARACTER</span><select value={selectedCharacter} onChange={e=>setSelectedCharacter(e.target.value)}><option value="">Select your character</option>{own.map(c=><option key={c.id} value={c.id}>{c.name} · {c.collar_bound?'Bound':'Free'}</option>)}</select></label><button className="btn primary" disabled={previewOnly||!selectedCharacter||working} onClick={()=>apply(()=>signupForEvent(event.id,selectedCharacter))}>Request a place</button></div>}
  {!canDirect&&!event.published&&<p className="muted">This event isn't accepting sign-ups yet.</p>}
  <div className="signup-list">{visibleSignups.length?visibleSignups.map(s=><div key={s.id} className="signup-row">
    <div><strong>{s.character_name}</strong><small>{s.status} · applied {new Date(s.created_at).toLocaleDateString()}</small></div>
    <div className="signup-actions">
      {canDirect&&s.status==='requested'&&<><button className="mini-btn" disabled={working} onClick={()=>apply(()=>decideEventSignup(s.id,true))}>Approve</button><button className="mini-btn danger" disabled={working} onClick={()=>apply(()=>decideEventSignup(s.id,false))}>Decline</button></>}
      {canDirect&&s.status==='approved'&&!event.combatants.some(c=>c.character_id===s.character_id)&&<button className="mini-btn" disabled={working||event.status!=='draft'} onClick={()=>apply(()=>addApprovedEventPlayer(s.id))}>Add to party</button>}
      {canDirect&&s.status==='approved'&&event.combatants.some(c=>c.character_id===s.character_id)&&<span className="event-added">In party</span>}
      {!previewOnly&&s.mine&&['requested','approved'].includes(s.status)&&<button className="mini-btn danger" disabled={working} onClick={()=>apply(()=>withdrawEventSignup(s.id))}>Withdraw</button>}
    </div>
  </div>):<p className="muted">No applications yet. Publish the event to open registration.</p>}</div>
  {error&&<div className="alert" role="alert">{error}</div>}
 </section>;
}
export function EventSummary({event,canDirect,onPlan,onSignups,onPrepare,onCombat,playerFacing=false}){
 return <section className="panel event-summary">
  <div className="event-summary-top"><div><span className="event-kicker">{eventTypeLabel(readEventStory(event.event_story).type)} · D{readEventStory(event.event_story).difficulty} · I{readEventStory(event.event_story).impact}</span><h2>{event.name}</h2><p>{event.description||'No public story description yet.'}</p></div><span className={'event-status '+(event.status==='active'?'live':'')}>{event.status==='draft'?(event.published?'Open for sign-ups':'Private draft'):event.status}</span></div>
  {readEventStory(event.event_story).chapters.length>0&&<div className="event-chapter-summary"><strong>Chapters</strong>{readEventStory(event.event_story).chapters.map((chapter,i)=><div key={i}>{i+1}. {chapter.title} · D{chapter.difficulty}</div>)}</div>}
  <div className="event-facts"><div><small>DATE & TIME</small><strong>{displayDate(event.starts_at)}</strong></div><div><small>LOCATION</small><strong>{event.location||'Not assigned'}</strong></div><div><small>PARTY</small><strong>{event.signup_count||0}/{event.capacity||8} approved</strong></div>{!playerFacing&&<div><small>ENEMIES / COMBATANTS</small><strong>{event.combatants.length} prepared</strong></div>}</div>
  <div className="event-summary-actions">{canDirect&&event.status==='draft'&&<button className="btn secondary" onClick={onPlan}>Edit event</button>}<button className="btn secondary" onClick={onSignups}>{canDirect?'Manage sign-ups':'My sign-ups'}</button>{canDirect&&<button className="btn secondary" onClick={onPrepare}>Prepare encounters</button>}{!playerFacing&&event.status==='active'&&<button className="btn primary" onClick={onCombat}>Open live combat</button>}</div>
 </section>;
}
