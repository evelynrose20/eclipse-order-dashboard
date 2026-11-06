import React,{useEffect,useState} from 'react';
import {listGMRequests,requestGMRoll,resolveGMRoll,cancelGMRoll,rollEncounterAction,encounterRolls,adjustCombatantHP,applyRolledHP} from './apiBridge.js';
import {parseDiceFormula,sheetCheckFormula,DND_SKILL_ABILITIES} from './rpRules.js';
import {CLASSES} from './progressionRules.js';
import './encounter-dice.css';

const PRESETS=[
 ['ability','Ability check','1d20+0'],['saving_throw','Saving throw','1d20+0'],
 ['attack','Attack roll','1d20+5'],['damage','Damage roll','2d6+3'],
 ['healing','Healing roll','1d8+3'],['contest','Contested check','1d20+0'],
 ['advantage','Advantage','2d20kh1+0'],['disadvantage','Disadvantage','2d20kl1+0'],
 ['percentile','Percentile','1d100+0'],['death_save','Death save','1d20+0'],['concentration','Concentration save','1d20+0'],['custom','Custom dice','1d20+0']
];
const CHECK_KINDS=['ability','saving_throw','attack','contest','skill'];
export function DicePanel({encounter,characters,canDirect,userId,check,working,action,previewOnly=false,isDirector=false,classCatalog}){
 const availableClasses=classCatalog&&Object.keys(classCatalog).length?classCatalog:CLASSES;
 const [requests,setRequests]=useState([]),[rolls,setRolls]=useState([]),[formula,setFormula]=useState('1d20+0');
 const [preset,setPreset]=useState('ability'),[visibility,setVisibility]=useState('public');
 const [target,setTarget]=useState(''),[targetDC,setTargetDC]=useState(12);
 const [reqCharacter,setReqCharacter]=useState(''),[reqKind,setReqKind]=useState('saving_throw');
 const [reqLabel,setReqLabel]=useState('Constitution saving throw'),[reqFormula,setReqFormula]=useState('1d20+0'),[reqDC,setReqDC]=useState(12);
 const [reqSelection,setReqSelection]=useState('con');
 const [classCharacter,setClassCharacter]=useState('');
 const [skillSelection,setSkillSelection]=useState('Perception');
 const [last,setLast]=useState(null),[error,setError]=useState('');
 const [hpTarget,setHpTarget]=useState(''),[appliedRollIds,setAppliedRollIds]=useState([]);
 const eligible=Boolean(!previewOnly&&check?.adult_declaration&&!check?.paused&&!check?.missing_themes?.length);
 async function refresh(){const [r,l]=await Promise.all([listGMRequests(encounter.id),encounterRolls(encounter.id)]);setRequests(previewOnly?r.filter(row=>row.player_user_id===userId):r);setRolls(previewOnly?l.filter(row=>row.visibility==='public'):l)}
 useEffect(()=>{let active=true;const load=async()=>{try{const [r,l]=await Promise.all([listGMRequests(encounter.id),encounterRolls(encounter.id)]);if(active){setRequests(previewOnly?r.filter(row=>row.player_user_id===userId):r);setRolls(previewOnly?l.filter(row=>row.visibility==='public'):l)}}catch(e){if(active)setError(e.message)}};load();const timer=setInterval(load,15000);return()=>{active=false;clearInterval(timer)}},[encounter.id,previewOnly,userId]);
 async function run(fn){if(previewOnly)return;setError('');try{const result=await action(fn);await refresh();return result}catch(e){setError(e.message)}}
 async function generalRoll(){const p=parseDiceFormula(formula);if(!p.ok){setError(p.error);return}const kind=['advantage','disadvantage','percentile'].includes(preset)?'custom':preset;
 const out=await run(()=>rollEncounterAction(encounter.id,p.normalized,visibility,kind,(kind==='attack'?target:null),(['ability','saving_throw','skill','contest','concentration'].includes(kind)?Number(targetDC):null)));if(out)setLast(out)}
 async function request(e){e.preventDefault();const p=parseDiceFormula(reqFormula);if(!p.ok){setError(p.error);return}
 await run(()=>requestGMRoll(encounter.id,reqCharacter,reqKind,reqLabel,p.normalized,Number(reqDC)))}
 async function applyLastHP(){if(!last?.id||!hpTarget)return;const result=await run(()=>applyRolledHP(last.id,hpTarget));if(result!==undefined){setAppliedRollIds(old=>[...old,last.id]);setLast(old=>({...old,appliedHP:result}))}}
 async function resolve(id){const result=await run(()=>resolveGMRoll(id));if(result)setLast({...result.roll,success:result.success,dc:result.dc})}
 const linked=encounter.combatants.filter(c=>c.kind==='player'&&c.character_id).map(c=>({...c,record:characters.find(x=>x.id===c.character_id)})).filter(c=>c.record?.player_user_id);
 const canRoll=encounter.status==='active'&&(canDirect||eligible);
 const classCharacters=characters.filter(c=>!previewOnly&&c.progression_version===1&&c.view_mode==='full'&&availableClasses[c.class_id]&&encounter.combatants.some(e=>e.character_id===c.id)&&c.player_user_id===userId&&!isDirector);
 const currentClassCharacter=classCharacters.find(c=>c.id===classCharacter)||classCharacters[0];
 async function rollSkillCheck(){
  if(!currentClassCharacter||!canRoll)return;
  const expression=sheetCheckFormula(currentClassCharacter,'skill',skillSelection);
  const out=await run(()=>rollEncounterAction(encounter.id,expression,'public','skill',null,Number(targetDC)));
  if(out)setLast({...out,skillName:skillSelection});
 }
 async function rollClassCheck(){
  if(!currentClassCharacter||!canRoll)return;
  const primary=availableClasses[currentClassCharacter.class_id].primary;
  const proficiency=Number(currentClassCharacter.proficiency_bonus)||2;
  const bonus=Math.floor((Number(currentClassCharacter[primary]||10)-10)/2)+proficiency;
  const expression='1d20'+(bonus>=0?'+':'')+bonus;
  const out=await run(()=>rollEncounterAction(encounter.id,expression,'public','ability',null,null));
  if(out)setLast(out);
 }
 return <section className="panel dice-panel">
  <div className="panel-heading"><div><h2>Dice chamber & GM checks</h2><p>{canDirect?'Roll for NPCs and encounter effects, or request a linked player to roll their own character.':'Every roll is recorded in the encounter history and shown to its intended participants.'}</p></div></div>
  {classCharacters.length>0&&<div className="panel"><h3>Class check</h3><p className="muted">Use your character's main ability and level-based proficiency modifier. The result is recorded in the encounter history.</p><div className="encounter-roll-controls"><label className="field"><span>CLASS CHARACTER</span><select value={currentClassCharacter?.id||''} onChange={e=>setClassCharacter(e.target.value)}>{classCharacters.map(c=><option key={c.id} value={c.id}>{c.name} · {availableClasses[c.class_id].name} level {c.level}</option>)}</select></label><button className="btn secondary" disabled={!canRoll||working} onClick={rollClassCheck}>Roll primary ability check</button></div><div className="encounter-roll-controls"><label className="field"><span>SKILL PROFICIENCY CHECK</span><select value={skillSelection} onChange={e=>setSkillSelection(e.target.value)}>{Object.keys(DND_SKILL_ABILITIES).map(skill=><option key={skill} value={skill}>{skill}</option>)}</select></label><label className="field"><span>TARGET DIFFICULTY (DC)</span><input type="number" min="0" max="99" value={targetDC} onChange={e=>setTargetDC(e.target.value)}/></label><div className="skill-check-preview"><strong>{sheetCheckFormula(currentClassCharacter,'skill',skillSelection)}</strong><small>{currentClassCharacter.skills?.[skillSelection]?'Proficient · level bonus applied':'Not proficient · ability modifier only'}</small></div><button className="btn secondary" disabled={!canRoll||working} onClick={rollSkillCheck}>Roll {skillSelection} check</button></div></div>}
  <div className="dice-preset-row">{PRESETS.map(([id,title,template])=><button key={id} type="button" className={'mini-btn '+(preset===id?'dice-active':'')} onClick={()=>{setPreset(id);setFormula(template)}}>{title}</button>)}</div>
  <div className="encounter-roll-controls"><label className="field"><span>DICE FORMULA</span><input maxLength={24} value={formula} onChange={e=>setFormula(e.target.value)} placeholder="2d20kh1+4"/></label>
   <label className="field"><span>ROLL VISIBILITY</span><select value={visibility} onChange={e=>setVisibility(e.target.value)}><option value="public">Everyone in encounter</option>{canDirect&&<option value="gm_private">GM/private</option>}</select></label>
   {preset==='attack'&&<label className="field"><span>ATTACK TARGET / ARMOR CLASS</span><select required value={target} onChange={e=>setTarget(e.target.value)}><option value="">Select combatant</option>{encounter.combatants.map(c=><option key={c.id} value={c.id}>{c.name} · AC {c.ac}</option>)}</select></label>}
   {['ability','saving_throw','skill','contest','concentration'].includes(preset)&&<label className="field"><span>TARGET DC</span><input type="number" min="0" max="99" value={targetDC} onChange={e=>setTargetDC(e.target.value)}/></label>}
   <button className="btn primary" disabled={working||!canRoll||!parseDiceFormula(formula).ok||(preset==='attack'&&!target)} onClick={generalRoll}>⚄ Roll</button>
  </div>
  <p className="muted">Examples: 1d20+5 (check/attack), 2d6+3 (damage), 2d20kh1 (advantage), 2d20kl1 (disadvantage). For critical hits, roll damage dice twice and add the modifier once.</p>
  {last&&<div className="dice-result" role="status"><div>LAST VERIFIED ROLL{last.skillName?' · '+last.skillName:''}</div><strong>{last.total}</strong><span>{last.rolls.join(' + ')} · {last.formula}{last.target_dc!=null?' · Target '+last.target_dc+' · '+String(last.outcome||'').replaceAll('_',' '):last.dc!=null?' · DC '+last.dc+' · '+(last.success?'SUCCESS':'FAILURE'):''}</span></div>}
  {last&&canDirect&&['damage','healing'].includes(last.kind)&&<div className="apply-roll-hp"><label className="field"><span>APPLY {last.kind.toUpperCase()} TO</span><select value={hpTarget} onChange={e=>setHpTarget(e.target.value)}><option value="">Choose target</option>{encounter.combatants.map(c=><option key={c.id} value={c.id}>{c.name} · {c.hp}/{c.max_hp} HP</option>)}</select></label><button className="btn secondary" disabled={!hpTarget||working||appliedRollIds.includes(last.id)} onClick={applyLastHP}>{appliedRollIds.includes(last.id)?'Applied':'Apply '+last.total+' '+last.kind}</button>{last.appliedHP!==undefined&&<small>Target now has {last.appliedHP} HP.</small>}</div>}
  {canDirect&&<form className="gm-check-form" onSubmit={request}>
    <h3>Ask a character to roll</h3><p className="muted">Send a specific check, saving throw, attack or contest to a linked player.</p>
    <div className="gm-check-grid">
      <label className="field"><span>PLAYER CHARACTER</span><select required value={reqCharacter} onChange={e=>setReqCharacter(e.target.value)}><option value="">Choose character</option>{linked.map(c=><option key={c.id} value={c.character_id}>{c.name}</option>)}</select></label>
      <label className="field"><span>CHECK TYPE</span><select value={reqKind} onChange={e=>{setReqKind(e.target.value);setReqSelection(e.target.value==='skill'?'Perception':'con')}}>{CHECK_KINDS.map(k=><option key={k} value={k}>{k.replace('_',' ')}</option>)}</select></label>
      <label className="field"><span>ABILITY / SKILL</span><select value={reqSelection} onChange={e=>setReqSelection(e.target.value)}>{(reqKind==='skill'?Object.keys(DND_SKILL_ABILITIES):['str','dex','con','int','wis','cha']).map(v=><option key={v} value={v}>{v.toUpperCase()}</option>)}</select></label>
      <button className="mini-btn" type="button" disabled={!reqCharacter} onClick={()=>{const record=linked.find(x=>x.character_id===reqCharacter)?.record;if(record)setReqFormula(sheetCheckFormula(record,reqKind,reqSelection))}}>Use sheet modifier</button>
      <label className="field"><span>CHECK NAME</span><input required minLength={2} maxLength={100} value={reqLabel} onChange={e=>setReqLabel(e.target.value)}/></label>
      <label className="field"><span>FORMULA</span><input required value={reqFormula} onChange={e=>setReqFormula(e.target.value)} maxLength={24}/></label>
      <label className="field"><span>DC / TARGET</span><input type="number" min="0" max="99" value={reqDC} onChange={e=>setReqDC(e.target.value)}/></label>
      <button className="btn secondary" type="submit" disabled={working||!reqCharacter||encounter.status!=='active'}>Send roll request</button>
    </div>
  </form>}
  <div className="gm-request-list"><h3>Requested rolls</h3>{requests.length?requests.map(r=><div className="gm-request-row" key={r.id}>
   <div><strong>{r.name}: {r.label}</strong><small>{r.formula} · DC {r.dc} · {r.state}{r.state==='resolved'?' · total '+r.result_total+(r.result_total>=r.dc?' PASS':' FAIL'):''}</small></div>
   <div className="gm-request-actions">{!previewOnly&&r.state==='pending'&&r.player_user_id===userId&&<button className="mini-btn" disabled={!canRoll||working} onClick={()=>resolve(r.id)}>Roll requested check</button>}
   {!previewOnly&&r.state==='pending'&&(canDirect||r.player_user_id===userId)&&<button className="mini-btn danger" disabled={working} onClick={()=>run(()=>cancelGMRoll(r.id))}>Cancel</button>}</div>
  </div>):<p className="muted">No requests for this encounter.</p>}</div>
  <div className="encounter-roll-log"><h3>Roll history</h3>{rolls.map(r=><div key={r.id}><span>{r.kind&&r.kind!=='custom'?r.kind.replaceAll('_',' ')+' · ':''}{r.formula} · {r.rolls.join(', ')} {r.target_dc!=null?' · DC/AC '+r.target_dc+' · '+String(r.outcome||'').replaceAll('_',' '):''} {r.visibility==='gm_private'?'· GM only':''}</span><strong>{r.total}</strong></div>)}</div>
  {error&&<div className="alert" role="alert">{error}</div>}
 </section>;
}
export function QuickHP({combatant,action,working}){
 const [amount,setAmount]=useState(5);
 async function apply(delta){await action(()=>adjustCombatantHP(combatant.id,delta))}
 return <div className="quick-hp"><label>HP <input type="number" min="1" max="999999" value={amount} onChange={e=>setAmount(Math.max(1,Number(e.target.value)||1))}/></label>
  <button className="mini-btn danger" disabled={working} onClick={()=>apply(-amount)}>− Damage</button>
  <button className="mini-btn" disabled={working} onClick={()=>apply(amount)}>+ Heal</button>
 </div>;
}
