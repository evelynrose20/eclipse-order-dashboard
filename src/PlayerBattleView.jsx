import React,{useEffect,useMemo,useState} from 'react';
import {listEncounters} from './apiBridge.js';
import BattleMap from './BattleMap.jsx';
import './encounter-studio.css';

const IN_PROGRESS=new Set(['active','paused']);
export default function PlayerBattleView(){
 const [events,setEvents]=useState([]);
 const [selectedId,setSelectedId]=useState('');
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const visible=useMemo(()=>events.filter(event=>event.published&&IN_PROGRESS.has(event.status)),[events]);
 const chosen=visible.find(event=>event.id===selectedId)||visible[0]||null;
 useEffect(()=>{
  let mounted=true;
  async function load(){
   try{
    const rows=await listEncounters();
    if(mounted){setEvents(rows);setError('');setSelectedId(old=>rows.some(event=>event.id===old&&event.published&&IN_PROGRESS.has(event.status))?old:'');}
   }catch(e){if(mounted)setError(e.message)}
   finally{if(mounted)setLoading(false)}
  }
  load();
  const interval=setInterval(load,15000);
  return()=>{mounted=false;clearInterval(interval)};
 },[]);
 return <div className="encounter-studio player-battle-view">
  <header className="encounter-studio-hero">
   <span className="encounter-eyebrow">THE ECLIPSE ORDER · BATTLEFIELD</span>
   <div className="encounter-hero-row">
    <div><h2>Battle Map</h2><p>{chosen?chosen.name:'The battlefield awaits.'}</p></div>
    {visible.length>1&&<label className="field encounter-choose"><span>ACTIVE ENCOUNTER</span><select value={chosen?.id||''} onChange={e=>setSelectedId(e.target.value)}>{visible.map(event=><option key={event.id} value={event.id}>{event.name}</option>)}</select></label>}
    {chosen&&<div className="encounter-live-badge"><span className="encounter-live-dot"/>{chosen.status==='paused'?'Paused':'In progress'} · Round {chosen.round_number||1}</div>}
   </div>
  </header>
  {error&&<div className="alert" role="alert">{error}</div>}
  {chosen?<BattleMap key={chosen.id} encounter={chosen} canDirect={false} playerView onRefresh={()=>{}} onError={setError}/>:
   <div className="encounter-studio-empty"><span aria-hidden="true">✦</span><h3>{loading?'Opening the battle map…':'No battle in progress'}</h3><p>{loading?'':'The map will appear here when an encounter begins.'}</p></div>}
 </div>;
}
