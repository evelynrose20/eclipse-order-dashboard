import React,{useEffect,useState} from 'react';
import LineageViews from './LineageViews.jsx';
import './imperial-lineage.css';

export default function LineageParticipant({request,readOnly=false}){
 const [records,setRecords]=useState(null),[error,setError]=useState(''),[tab,setTab]=useState('cases');
 const [character,setCharacter]=useState('');
 async function load(){
  const result=await request('/thralls/lineage/my');
  setRecords(result.cases||[]);
 }
 useEffect(()=>{let mounted=true;request('/thralls/lineage/my').then(result=>{
   if(mounted)setRecords(result.cases||[]);
  }).catch(e=>{if(mounted)setError(e.message||'Unable to open lineage records')});
  return()=>{mounted=false};
 },[request]);
 const ids=[...new Map((records||[]).map(x=>[x.character_id,x.character_name])).entries()];
 const current=character||ids[0]?.[0]||'';
 const cases=(records||[]).filter(x=>x.character_id===current);
 return <section className="lineage-command">
  <div className="lineage-command-head"><div><span>PERSONAL · IMPERIAL LINEAGE RECORD</span><h2>Imperial Lineage Project</h2><p>Review your recorded traits, linked gestation studies and lineage parenthood findings.</p></div>
  {records&&<button type="button" onClick={()=>load().catch(e=>setError(e.message))}><i className="fa-solid fa-rotate" aria-hidden="true"/> Refresh</button>}</div>
  {error&&<p role="alert" className="lineage-error">{error.replaceAll('_',' ')}</p>}
  {records===null?<p className="lineage-empty">Opening personal lineage records…</p>:records.length===0?
   <div className="lineage-empty">There are no research cases linked to your character. Your character owner must authorize lineage research before staff can associate a case. Research authorization can be withdrawn from the character's Pregnancy section.</div>:
   <><div className="lineage-participant-head"><label>Character<select value={current} onChange={e=>{setCharacter(e.target.value);setTab('cases')}}>{ids.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
    <p>{readOnly?'Player preview — records cannot be changed.':'These are your own authorized records. Private staff research and other characters are not visible.'}</p></div>
    <LineageViews cases={cases} tab={tab} onTab={setTab}/></>}
 </section>;
}
