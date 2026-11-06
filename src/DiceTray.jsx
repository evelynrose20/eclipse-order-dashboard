import React,{useEffect,useState} from 'react';
import {rollEncounterAction,encounterRolls} from './apiBridge.js';
import {parseDiceFormula} from './rpRules.js';
import './dice-tray.css';

const ROLLS=[
 {id:'ability',name:'Check',formula:'1d20+0',dc:true},
 {id:'saving_throw',name:'Save',formula:'1d20+0',dc:true},
 {id:'attack',name:'Attack',formula:'1d20+5',target:true},
 {id:'damage',name:'Damage',formula:'2d6+3'},
 {id:'healing',name:'Healing',formula:'1d8+3'},
 {id:'advantage',name:'Advantage',formula:'2d20kh1+0',dc:true},
 {id:'disadvantage',name:'Disadvantage',formula:'2d20kl1+0',dc:true},
 {id:'custom',name:'Custom',formula:'1d20+0'}
];
export default function DiceTray({encounter,canDirect,working,action,onOpenFull}){
 const [kind,setKind]=useState('ability');
 const [formula,setFormula]=useState('1d20+0');
 const [visibility,setVisibility]=useState('public');
 const [dc,setDc]=useState(12);
 const [target,setTarget]=useState('');
 const [latest,setLatest]=useState(null);
 const [history,setHistory]=useState([]);
 const [error,setError]=useState('');
 const [rolling,setRolling]=useState(false);
 const selected=ROLLS.find(r=>r.id===kind)||ROLLS[0];
 const parsed=parseDiceFormula(formula);
 const enabled=encounter.status==='active'&&canDirect&&!working&&!rolling&&parsed.ok&&(!selected.target||target);
 useEffect(()=>{
  let mounted=true;
  const refresh=async()=>{
   try{const rows=await encounterRolls(encounter.id);if(mounted)setHistory(rows.slice(-5).reverse());}
   catch(e){if(mounted)setError(e.message)}
  };
  refresh();const timer=setInterval(refresh,15000);
  return()=>{mounted=false;clearInterval(timer)};
 },[encounter.id]);
 async function roll(){
  if(!enabled)return;
  setRolling(true);setError('');
  try{
   const rollKind=['advantage','disadvantage'].includes(kind)?'custom':kind;
   const result=await action(()=>rollEncounterAction(encounter.id,parsed.normalized,visibility,rollKind,selected.target?target:null,selected.dc?Number(dc):null));
   if(result){setLatest(result);const rows=await encounterRolls(encounter.id);setHistory(rows.slice(-5).reverse())}
  }catch(e){setError(e.message)}
  finally{setRolling(false)}
 }
 return <section className="compact-dice-tray" aria-label="Quick dice tray">
  <div className="dice-tray-heading"><div><span>DICE TRAY</span><h3>Make a roll</h3></div><button type="button" className="dice-tray-expand" onClick={onOpenFull}>All dice tools <span aria-hidden="true">↗</span></button></div>
  <div className="dice-tray-preset-grid" role="group" aria-label="Roll type">
   {ROLLS.map(roll=><button key={roll.id} type="button" aria-pressed={kind===roll.id} className={'dice-tray-preset '+(kind===roll.id?'active':'')} onClick={()=>{setKind(roll.id);setFormula(roll.formula)}}>{roll.name}</button>)}
  </div>
  <div className="dice-tray-roll-fields">
   <label><span>Dice formula</span><input value={formula} maxLength={24} onChange={e=>setFormula(e.target.value)} aria-invalid={!parsed.ok}/></label>
   {selected.dc&&<label><span>DC</span><input type="number" min="0" max="99" value={dc} onChange={e=>setDc(e.target.value)}/></label>}
   {selected.target&&<label className="dice-tray-wide"><span>Target</span><select value={target} onChange={e=>setTarget(e.target.value)}><option value="">Choose target</option>{encounter.combatants.map(c=><option key={c.id} value={c.id}>{c.name} · AC {c.ac}</option>)}</select></label>}
   {canDirect&&<label className="dice-tray-wide"><span>Visibility</span><select value={visibility} onChange={e=>setVisibility(e.target.value)}><option value="public">Public roll</option><option value="gm_private">GM only</option></select></label>}
  </div>
  {!parsed.ok&&<p className="dice-tray-validation" role="alert">{parsed.error}</p>}
  <button type="button" className="dice-tray-roll-button" disabled={!enabled} onClick={roll}>⚄ {rolling?'Rolling…':'Roll '+selected.name}</button>
  {latest&&<div className="dice-tray-result" role="status"><span>LAST ROLL</span><strong>{latest.total}</strong><small>{latest.formula}{latest.target_dc!=null?' · DC '+latest.target_dc:''}</small></div>}
  <div className="dice-tray-recent"><div><strong>Recent rolls</strong><span>{history.length?history.length+' shown':''}</span></div>
   {history.length?history.map((entry,i)=><div className="dice-tray-history-row" key={entry.id||i}><span>{entry.formula}</span><strong>{entry.total}</strong></div>):<p>No rolls yet.</p>}
  </div>
  {error&&<p className="dice-tray-validation" role="alert">{error}</p>}
 </section>;
}
