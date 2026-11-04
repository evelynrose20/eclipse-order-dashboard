import React,{useEffect,useState} from 'react';
import {listEncounters,createEncounter,addCombatant,editCombatant,deleteCombatant,encounterTurn,encounterCheck,pauseEncounter,encounterRoll,encounterRolls,setEncounterMap,moveEncounterToken,listMonsterTemplates,createMonsterTemplate,addMonsterToEncounter,rollAllInitiative} from './supabase.js';
import {CONTENT_THEMES} from './ProfileConsent.jsx';
import {parseDiceFormula} from './rpRules.js';
import './encounters.css';
import BattleMap from './BattleMap.jsx';
import {DicePanel,QuickHP} from './EncounterDice.jsx';
const CONDITIONS=['Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious','Exhaustion'];
const label=key=>CONTENT_THEMES.find(x=>x[0]===key)?.[1]||key;
export default function Encounters({role,userId,characters}){
 const directorRole=['domina','high_command','handler'].includes(role);
 const [data,setData]=useState([]),[chosenId,setChosenId]=useState(''),[newName,setNewName]=useState(''),[newNotes,setNewNotes]=useState(''),[themes,setThemes]=useState([]);
 const [combatName,setCombatName]=useState(''),[kind,setKind]=useState('npc'),[charId,setCharId]=useState(''),[initiative,setInitiative]=useState(10),[hp,setHp]=useState(20),[ac,setAc]=useState(10);
 const [formula,setFormula]=useState('1d20+0'),[visibility,setVisibility]=useState('public'),[rolls,setRolls]=useState([]),[lastRoll,setLastRoll]=useState(null);
 const [check,setCheck]=useState(null),[working,setWorking]=useState(false),[error,setError]=useState('');
 const [monsters,setMonsters]=useState([]),[chosenMonster,setChosenMonster]=useState('');
 const [monsterForm,setMonsterForm]=useState({name:'',challenge:'Custom',hit_points:20,armor_class:10,initiative_bonus:0,actions:'',notes:''});
 const [showMonsterEditor,setShowMonsterEditor]=useState(false);
 const selected=data.find(x=>x.id===chosenId)||null;
 const canDirect=selected&&(role==='domina'||role==='high_command'||(role==='handler'&&selected.created_by===userId));
 const activeCombatant=selected?.combatants?.[selected.turn_index%Math.max(1,selected.combatants.length)];
 async function refresh(){const x=await listEncounters();setData(x);setChosenId(old=>x.some(e=>e.id===old)?old:x[0]?.id||'')}
 useEffect(()=>{
  refresh().catch(e=>setError(e.message));
  if(directorRole)listMonsterTemplates().then(setMonsters).catch(e=>setError(e.message));
  const timer=setInterval(()=>refresh().catch(()=>{}),30000);return()=>clearInterval(timer)
 },[]);
 useEffect(()=>{if(!chosenId){setCheck(null);setRolls([]);return}let active=true;
  const reload=async()=>{try{const [a,b]=await Promise.all([encounterCheck(chosenId),encounterRolls(chosenId)]);if(active){setCheck(a);setRolls(b)}}catch(e){if(active)setError(e.message)}};
  reload();const timer=setInterval(reload,15000);return()=>{active=false;clearInterval(timer)}
 },[chosenId]);
 async function action(fn){setWorking(true);setError('');try{const result=await fn();await refresh();if(chosenId){setCheck(await encounterCheck(chosenId));setRolls(await encounterRolls(chosenId))}return result}catch(e){setError(e.message)}finally{setWorking(false)}}
 async function create(e){e.preventDefault();const id=await action(()=>createEncounter(newName,newNotes,themes));if(id){setChosenId(id);setNewName('');setNewNotes('');setThemes([])}}
 async function add(e){e.preventDefault();const source=characters.find(c=>c.id===charId);const name=kind==='player'&&source?source.name:combatName;
  const id=await action(()=>addCombatant(chosenId,name,kind,kind==='player'?charId:null,Number(initiative),Number(hp),Number(ac)));
  if(id){setCombatName('');setCharId('')}}
 async function saveMonster(e){
  e.preventDefault();
  const id=await action(()=>createMonsterTemplate(monsterForm));
  if(id){setMonsters(await listMonsterTemplates());setChosenMonster(id);setShowMonsterEditor(false);setMonsterForm({name:'',challenge:'Custom',hit_points:20,armor_class:10,initiative_bonus:0,actions:'',notes:''})}
 }
 async function roll(){const parsed=parseDiceFormula(formula);if(!parsed.ok){setError(parsed.error);return;}const result=await action(()=>encounterRoll(chosenId,parsed.normalized,visibility));if(result)setLastRoll(result)}
 return <div className="encounter-layout">
  <section className="panel encounter-sidebar"><h2>Encounter library</h2><p className="muted">Shared initiative, combatants, HP, effects and dice.</p>
   {directorRole&&<form className="encounter-create" onSubmit={create}>
    <label className="field"><span>ENCOUNTER NAME</span><input required maxLength={140} minLength={2} value={newName} onChange={e=>setNewName(e.target.value)}/></label>
    <label className="field"><span>GM NOTES</span><textarea maxLength={2000} rows={2} value={newNotes} onChange={e=>setNewNotes(e.target.value)}/></label>
    <p className="muted">Content categories used by this encounter (players control their general opt-ins in My Profile).</p>
    <div className="encounter-themes">{CONTENT_THEMES.map(([key,text])=><label key={key}><input type="checkbox" checked={themes.includes(key)} onChange={e=>setThemes(old=>e.target.checked?[...old,key]:old.filter(x=>x!==key))}/>{text}</label>)}</div>
    <button className="btn secondary" disabled={working} type="submit">Create encounter</button>
   </form>}
   <div className="encounter-list">{data.map(e=><button key={e.id} className={'encounter-choice '+(chosenId===e.id?'active':'')} onClick={()=>{setChosenId(e.id);setLastRoll(null)}}>
    <strong>{e.name}</strong><small>{e.status} · {e.combatants.length} combatants</small></button>)}</div>
  </section>
  <section className="encounter-main">
   {!selected?<div className="panel"><h2>No encounter selected</h2><p className="muted">A GM can create a new encounter from the left panel.</p></div>:<>
    <div className="panel encounter-header"><div className="encounter-topline"><div><small>ENCOUNTER TRACKER</small><h2>{selected.name}</h2><p className="muted">Status: {selected.status} · Round {selected.round_number}</p></div>{canDirect&&<div className="encounter-actions">
     {selected.status!=='active'&&<>
      <button className="btn secondary" disabled={working||!selected.combatants.length} onClick={()=>action(()=>rollAllInitiative(chosenId))}>⚄ Roll initiative</button>
      <button className="btn secondary" disabled={working||!selected.combatants.length} onClick={()=>action(()=>encounterTurn(chosenId,'start'))}>Start / restart</button>
     </>}
     {selected.status==='active'&&<><button className="btn primary" disabled={working} onClick={()=>action(()=>encounterTurn(chosenId,'next'))}>End turn →</button><button className="btn secondary" disabled={working} onClick={()=>action(()=>encounterTurn(chosenId,'finish'))}>Finish</button></>}
    </div>}</div>
    <div className="encounter-tags">{selected.themes?.map(t=><span key={t}>{label(t)}</span>)}</div>
    {activeCombatant&&selected.status==='active'&&<div className="current-turn"><span>NOW ACTING</span><strong>{activeCombatant.name}</strong><small>Round {selected.round_number} · Initiative {activeCombatant.initiative}</small></div>}
    <div className="ooc-access"><div><h3>Player OOC control</h3><p>Your saved profile choices are checked against the declared encounter themes. Regardless of IC circumstances, you can pause participation here at any time.</p>
    {check&&<p>Eligibility: {check.adult_declaration?'18+ profile declaration saved':'Save your 18+ declaration under My RP profile'} · {check.missing_themes?.length?'Not opted into: '+check.missing_themes.map(label).join(', '):'Declared themes allowed'}</p>}</div>
    <button className="btn secondary" disabled={working} onClick={()=>action(()=>pauseEncounter(chosenId,!check?.paused))}>{check?.paused?'Resume OOC':'Pause OOC'}</button></div></div>
    <BattleMap encounter={selected} canDirect={canDirect} onRefresh={refresh} onError={setError}/>
    <section className="panel"><div className="panel-heading"><div><h2>Initiative tracker</h2><p>GM-controlled combatants, HP, armor class, conditions and turn order.</p></div></div>
     <div className="encounter-combatants">{selected.combatants.length?selected.combatants.map((c,i)=><Combatant key={c.id} c={c} canDirect={canDirect} active={selected.status==='active'&&i===selected.turn_index%selected.combatants.length} working={working} save={next=>action(()=>editCombatant(c.id,next.hp,next.initiative,next.ac,next.conditions))} hpAction={action} remove={()=>action(()=>deleteCombatant(c.id))}/>):<p className="muted">No combatants added.</p>}</div>
     {canDirect&&<div className="monster-library"><div className="panel-heading"><div><h3>Monster & NPC stat-block library</h3><p>Save reusable homebrew enemies, then add them to encounters without retyping HP and AC.</p></div><button className="mini-btn" onClick={()=>setShowMonsterEditor(!showMonsterEditor)}>{showMonsterEditor?'Close editor':'+ Create stat block'}</button></div>
      {showMonsterEditor&&<form className="monster-form" onSubmit={saveMonster}>
       {[
        ['name','NAME','text'],['challenge','CHALLENGE','text'],['hit_points','HIT POINTS','number'],
        ['armor_class','ARMOR CLASS','number'],['initiative_bonus','INITIATIVE BONUS','number']
       ].map(([key,label,type])=><label className="field" key={key}><span>{label}</span><input required type={type} value={monsterForm[key]} onChange={e=>setMonsterForm(old=>({...old,[key]:e.target.value}))}/></label>)}
       <label className="field"><span>ABILITIES / ATTACKS</span><textarea rows={3} maxLength={2500} value={monsterForm.actions} onChange={e=>setMonsterForm(old=>({...old,actions:e.target.value}))}/></label>
       <label className="field"><span>GM NOTES</span><textarea rows={3} maxLength={2500} value={monsterForm.notes} onChange={e=>setMonsterForm(old=>({...old,notes:e.target.value}))}/></label>
       <button className="btn primary" type="submit" disabled={working}>Save stat block</button>
      </form>}
      <div className="monster-quick-add"><select aria-label="Choose saved stat block" value={chosenMonster} onChange={e=>setChosenMonster(e.target.value)}><option value="">Select saved monster/NPC</option>{monsters.map(m=><option key={m.id} value={m.id}>{m.name} · CR {m.challenge} · {m.hit_points} HP · AC {m.armor_class}</option>)}</select><button className="btn secondary" disabled={!chosenMonster||working} onClick={()=>action(()=>addMonsterToEncounter(chosenId,chosenMonster))}>Add saved NPC</button></div>
      {chosenMonster&&monsters.filter(m=>m.id===chosenMonster).map(m=><div key={m.id} className="monster-preview"><strong>{m.name}</strong><p>CR {m.challenge} · HP {m.hit_points} · AC {m.armor_class} · Initiative {m.initiative_bonus>=0?'+':''}{m.initiative_bonus}</p><p>{m.actions||'No attacks described.'}</p></div>)}
     </div>}
     {canDirect&&<form onSubmit={add} className="encounter-add"><h3>Add a combatant</h3><div className="encounter-fields">
      <label className="field"><span>TYPE</span><select value={kind} onChange={e=>setKind(e.target.value)}><option value="npc">NPC / enemy</option><option value="player">Player character</option></select></label>
      {kind==='npc'?<label className="field"><span>NAME</span><input required value={combatName} onChange={e=>setCombatName(e.target.value)}/></label>:
       <label className="field"><span>CHARACTER</span><select required value={charId} onChange={e=>{const id=e.target.value;const c=characters.find(x=>x.id===id);setCharId(id);if(c){setHp(c.max_hp||c.hp||20);setAc(c.armor_class||10)}}}><option value="">Choose character</option>{characters.filter(c=>c.view_mode!=='bound').map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      <label className="field"><span>INITIATIVE</span><input type="number" min={-100} max={100} value={initiative} onChange={e=>setInitiative(e.target.value)}/></label>
      <label className="field"><span>MAX HP</span><input type="number" min={1} max={999999} value={hp} onChange={e=>setHp(e.target.value)}/></label>
      <label className="field"><span>AC</span><input type="number" min={0} max={99} value={ac} onChange={e=>setAc(e.target.value)}/></label>
      <button className="btn primary" disabled={working} type="submit">Add</button>
     </div></form>}
    </section>
    <DicePanel key={selected.id} encounter={selected} characters={characters} canDirect={canDirect} userId={userId} check={check} working={working} action={action}/>
   </>}
   {error&&<div className="alert" role="alert">{error}</div>}
  </section>
 </div>;
}
function Combatant({c,canDirect,active,working,save,hpAction,remove}){
 const [editing,setEditing]=useState(false),[draft,setDraft]=useState(c);
 useEffect(()=>{if(!editing)setDraft(c)},[c,editing]);
 return <div className={'combatant '+(active?'acting':'')}><span className="combatant-initiative">{c.initiative}</span><div className="combatant-identity"><strong>{c.name}</strong><small>{c.kind==='npc'?'NPC / enemy':'Player character'}</small><div className="combatant-health"><span style={{width:Math.max(0,Math.min(100,c.hp/c.max_hp*100))+'%'}}/></div><small>{c.hp}/{c.max_hp} HP · AC {c.ac}</small>{Boolean(c.conditions.length)&&<p>{c.conditions.join(' · ')}</p>}</div>
  {canDirect&&<QuickHP combatant={c} action={hpAction} working={working}/>}
  {canDirect&&<div className="combatant-actions"><button className="mini-btn" onClick={()=>setEditing(!editing)}>Edit</button><button className="mini-btn danger" disabled={working} onClick={remove}>Remove</button></div>}
  {editing&&<div className="combatant-editor"><label>HP<input type="number" min={0} max={999999} value={draft.hp} onChange={e=>setDraft({...draft,hp:Number(e.target.value)})}/></label><label>Initiative<input type="number" min={-100} max={100} value={draft.initiative} onChange={e=>setDraft({...draft,initiative:Number(e.target.value)})}/></label><label>AC<input type="number" min={0} max={99} value={draft.ac} onChange={e=>setDraft({...draft,ac:Number(e.target.value)})}/></label><label>Conditions<select multiple value={draft.conditions||[]} onChange={e=>setDraft({...draft,conditions:Array.from(e.target.selectedOptions).map(x=>x.value)})}>{CONDITIONS.map(x=><option key={x} value={x}>{x}</option>)}</select></label><button className="mini-btn" disabled={working} onClick={async()=>{await save(draft);setEditing(false)}}>Save</button></div>}
 </div>;
}
