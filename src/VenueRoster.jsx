import React,{useEffect,useState} from 'react';
import './imperial-theme.css';
import './venue-site.css';
import './venue-roster.css';
import OrderEmblem from './OrderEmblem.jsx';

const DISCORD='https://discord.gg/ksqTw4SHYn';
const VENUE_API=(import.meta.env.VITE_ECLIPSE_API_URL||'').replace(/\/+$/,'');
function imageSource(value){if(!value)return '';if(value.startsWith('https://'))return value;if(value.startsWith('/venue/images/'))return VENUE_API+value;return '/venue-images/'+value}
function Mark(){return <span className="venue-mark" aria-hidden="true"><OrderEmblem className="venue-order-emblem"/></span>}
function RosterCard({person,category}){
 const [imageError,setImageError]=useState(false);
 const photo=person.image||'';
 const picture=!person.vacancy&&!!photo&&!imageError;
 return <article className={'venue-roster-card'+(person.vacancy?' is-vacancy':'')}>
  <div className="venue-roster-portrait">
   {picture?<img src={imageSource(photo)} alt={'Portrait of '+person.name} loading="lazy" onError={()=>setImageError(true)}/>:<div className="venue-roster-fallback" aria-hidden="true"><Mark/><span>{person.vacancy?'POSITION AVAILABLE':category==='staff'?'THE MIDNIGHT ECLIPSE':'THE HOUSEHOLD'}</span></div>}
  </div>
  <div className="venue-roster-copy"><span className="venue-roster-label">{person.vacancy?'RECRUITING':category==='staff'?'VENUE STAFF':'VENUE THRALL'}</span><h3>{person.name}</h3><strong>{person.title}</strong><p>{person.description}</p>{person.vacancy&&<a href={DISCORD} target="_blank" rel="noopener noreferrer">Ask about this role <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"/></a>}</div>
 </article>;
}
function validEntry(item){return item&&typeof item.id==='string'&&typeof item.name==='string'&&typeof item.title==='string'&&typeof item.description==='string'&&(typeof item.vacancy==='undefined'||typeof item.vacancy==='boolean')&&typeof item.image==='string'}
export default function VenueRoster(){
 const [data,setData]=useState(null);
 const [state,setState]=useState('loading');
 useEffect(()=>{
  document.title='Staff & Thralls — The Midnight Eclipse';
  let active=true;const controller=new AbortController();
  async function load(){
   try{
    let response=VENUE_API?await fetch(VENUE_API+'/venue/public',{cache:'no-store',signal:controller.signal}).catch(()=>null):null;
    if(!response?.ok)response=await fetch('/venue-roster.json',{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error('roster unavailable');
    const result=await response.json();
    if(!Array.isArray(result.staff)||!Array.isArray(result.thralls)||!result.staff.every(validEntry)||!result.thralls.every(validEntry))throw new Error('invalid roster');
    if(active){setData(result);setState('ready')}
   }catch(err){if(active&&err.name!=='AbortError')setState('unavailable')}
  }
  void load();
  const onFocus=()=>void load();
  window.addEventListener('focus',onFocus);
  return()=>{active=false;controller.abort();window.removeEventListener('focus',onFocus);document.title='The Eclipse Order — A Final Fantasy XIV Roleplay Free Company'};
 },[]);
 return <div className="midnight-venue venue-people-page">
  <a className="venue-skip" href="#people-main">Skip to roster</a>
  <header className="venue-header"><a className="venue-brand" href="/venue/"><Mark/><span>THE MIDNIGHT <em>ECLIPSE</em><small>AN ECLIPSE ORDER VENUE</small></span></a><nav aria-label="People navigation"><a href="/venue/">Venue home</a><a href="/venue/menu/">Menu</a><a href="#staff">Staff</a><a href="#thralls">Thralls</a><a href="/venue/rules/">Venue Rules</a><a href={DISCORD} className="venue-nav-discord" target="_blank" rel="noopener noreferrer">Join Discord <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"/></a></nav></header>
  <main id="people-main">
   <section className="venue-roster-intro"><div className="venue-inner"><span className="venue-eyebrow">THE MIDNIGHT ECLIPSE · ITS PEOPLE</span><h1>THE FACES<br/><em>BEHIND THE VEIL.</em></h1><p>Meet the staff and thralls of The Midnight Eclipse. Our household changes as new faces join and others depart.</p><a href={DISCORD} target="_blank" rel="noopener noreferrer" className="venue-btn venue-btn-primary">Inquire about joining <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"/></a></div></section>
   {state==='loading'&&<div className="venue-inner venue-roster-message" role="status">Opening the household roster…</div>}
   {state==='unavailable'&&<div className="venue-inner venue-roster-message" role="alert">The public roster is temporarily unavailable. Contact the venue through <a href={DISCORD} target="_blank" rel="noopener noreferrer">Discord</a>.</div>}
   {state==='ready'&&<><section className="venue-section venue-roster-section" id="staff"><div className="venue-inner"><span className="venue-eyebrow">01 / THE VENUE STAFF</span><h2>The people<br/><em>who keep the doors open.</em></h2><p>Hosts, leadership, and those trusted with the care of our guests.</p><div className="venue-roster-grid">{data.staff.map(person=><RosterCard key={person.id} person={person} category="staff"/>)}</div></div></section><section className="venue-section venue-roster-section venue-thrall-section" id="thralls"><div className="venue-inner"><span className="venue-eyebrow">02 / THE HOUSEHOLD</span><h2>Thralls of<br/><em>the Midnight Eclipse.</em></h2><p>Those serving within the venue and opportunities to join the household. All related character roleplay is subject to participants' out-of-character consent and boundaries.</p><div className="venue-roster-grid">{data.thralls.map(person=><RosterCard key={person.id} person={person} category="thrall"/>)}</div></div></section></>}
  </main>
  <footer className="venue-footer"><div><Mark/><span>THE MIDNIGHT ECLIPSE<small>AN ECLIPSE ORDER VENUE</small></span></div><div><a href="/venue/">Venue home</a><a href={DISCORD} target="_blank" rel="noopener noreferrer">Discord inquiries</a><a href="/venue/rules/">Venue Rules</a><a href="#people-main">Back to top ↑</a></div><small>Final Fantasy XIV fan roleplay venue. Not affiliated with Square Enix.</small></footer>
 </div>;
}
