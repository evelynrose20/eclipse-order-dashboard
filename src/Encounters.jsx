import React,{useEffect,useState} from 'react';
import {listEncounters,createEncounter,addCombatant,editCombatant,deleteCombatant,encounterTurn,encounterCheck,pauseEncounter,encounterRoll,encounterRolls,setEncounterMap,moveEncounterToken,listMonsterTemplates,createMonsterTemplate,addMonsterToEncounter,rollAllInitiative} from './supabase.js';
import {CONTENT_THEMES} from './ProfileConsent.jsx';
import {parseDiceFormula} from './rpRules.js';
import './encounters.css';
import BattleMap from './BattleMap.jsx';
import {DicePanel,QuickHP} from './EncounterDice.jsx';
import {EventEditor,EventSignups,EventSummary} from './EventPlanning.jsx';
import {editPlannedEvent} from './supabase.js';
import './event-planning.css';
const CONDITIONS=['Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious','Exhaustion'];
const label=key=>CONTENT_THEMES.find(x=>x[0]===key)?.[1]||key;
export default function Encounters({role,userId,characters,onOpenProfile}){
 const directorRole=['domina','high_command','handler'].includes(role);
 const [data,setData]=useState([]),[chosenId,setChosenId]=useState(''),[newName,setNewName]=useState(''),[newNotes,setNewNotes]=useState(''),[themes,setThemes]=useState([]);
 const [combatName,setCombatName]=useState(''),[kind,setKind]=useState('npc'),[charId,setCharId]=useState(''),[initiative,setInitiative]=useState(10),[hp,setHp]=useState(20),[ac,setAc]=useState(10);
 const [formula,setFormula]=useState('1d20+0'),[visibility,setVisibility]=useState('public'),[rolls,setRolls]=useState([]),[lastRoll,setLastRoll]=useState(null);
 const [check,setCheck]=useState(null),[working,setWorking]=useState(false),[error,setError]=useState('');
 const [monsters,setMonsters]=useState([]),[chosenMonster,setChosenMonster]=useState('');
 const [monsterForm,setMonsterForm]=useState({name:'',challenge:'Custom',hit_points:20,armor_class:10,initiative_bonus:0,actions:'',notes:''});
 const [showMonsterEditor,setShowMonsterEditor]=useState(false);
 const [section,setSection]=useState('overview');
 const [creating,setCreating]=useState(false);
 const selected=data.find(x=>x.id===chosenId)||null;
 const canDirect=selected&&(role==='domina'||role==='high_command'||(role==='handler'&&selected.created_by===userId));
 const isParticipant=Boolean(canDirect||selected?.combatants?.some(c=>characters.some(ch=>ch.id===c.character_id&&ch.player_user_id===userId)));
 const activeCombatant=selected?.combatants?.[selected.turn_index%Math.max(1,selected.combatants.length)];
 async function refresh(){const x=await listEncounters();setData(x);setChosenId(old=>x.some(e=>e.id===old)?old:x[0]?.id||'')}
 useEffect(()=>{
  refresh().catch(e=>setError(e.message));
  if(directorRole)listMonsterTemplates().then(setMonsters).catch(e=>setError(e.message));
  const timer=setInterval(()=>refresh().catch(()=>{}),30000);return()=>clearInterval(timer)
 },[]);
 useEffect(()=>{if(!chosenId){setCheck(null);return}let active=true;
  const reload=async()=>{try{const result=await encounterCheck(chosenId);if(active)setCheck(result)}catch(e){if(active)setError(e.message)}};
  reload();const timer=setInterval(reload,30000);return()=>{active=false;clearInterval(timer)}
 },[chosenId]);
 async function action(fn){setWorking(true);setError('');try{const result=await fn();await refresh();if(chosenId)setCheck(await encounterCheck(chosenId));return result}catch(e){setError(e.message)}finally{setWorking(false)}}
 async function createEvent(details){
  const id=await action(()=>createEncounter(details.name,details.description||'',details.themes));
  if(!id)return;
  const next={...details,published:false};
  await action(()=>editPlannedEvent(id,next));
  setChosenId(id);setCreating(false);setSection('planning');
 }
 async function savePlan(details){await action(()=>editPlannedEvent(chosenId,details));}
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
  <section className="panel encounter-sidebar"><div className="event-library-top"><div><h2>FC events</h2><p className="muted">Plan stories and sign up for upcoming events.</p></div>{directorRole&&<button className="btn primary" onClick={()=>{setCreating(true);setSection('planning')}}>+ New event</button>}</div>
   <div className="encounter-list">{data.map(e=><button key={e.id} className={'encounter-choice '+(!creating&&chosenId===e.id?'active':'')} onClick={()=>{setCreating(false);setChosenId(e.id);setSection('overview');setLastRoll(null)}}>
    <strong>{e.name}</strong><small>{e.starts_at?new Date(e.starts_at).toLocaleDateString():'Date TBD'} · {e.status==='draft'?(e.published?'Sign-ups open':'Preparing'):e.status}</small><small>{e.signup_count||0}/{e.capacity||8} approved · {e.combatants.length} combatants</small></button>)}</div>
  </section>
  <section className="encounter-main">
   {creating&&directorRole?<section className="panel"><div className="panel-heading"><div><h2>Plan a new FC event</h2><p>Build the event privately, schedule it, open sign-ups, then prepare monsters and party members.</p></div><button className="mini-btn" onClick={()=>setCreating(false)}>Cancel</button></div><EventEditor key="new-event" event={null} save={createEvent} working={working}/></section>:
   !selected?<div className="panel"><h2>No event selected</h2><p className="muted">{directorRole?'Create a planned event using the New event button.':'There are no published FC events to sign up for yet.'}</p>{error.toLowerCase().includes('adult')&&<div className="hint-box"><strong>My RP profile</strong><p>Confirm the 18+ declaration on your profile to see available events.</p><button className="btn primary" onClick={onOpenProfile}>Open My RP profile</button></div>}</div>:<>
    <header className="event-workspace-header"><div><small>EVENT MANAGEMENT</small><h2>{selected.name}</h2><p>{selected.starts_at?new Date(selected.starts_at).toLocaleString():'Unscheduled'} · {selected.location||'Location TBD'} · {selected.status}</p></div></header>
    <nav className="event-tabs" aria-label="Event workspace">
    {[
      ['overview','Overview'],['planning','Event details'],['signups','Sign-ups'],
      ['setup','Combat setup'],['map','Battle map'],['combat','Live encounter'],['dice','Dice & checks']
    ].filter(([id])=>id!=='planning'||canDirect).map(([id,label])=><button key={id} className={'event-tab '+(section===id?'active':'')} aria-current={section===id?'page':undefined} onClick={()=>setSection(id)}>{label}{id==='signups'&&canDirect&&selected.pending_count>0?<span className="event-tab-count">{selected.pending_count}</span>:null}</button>)}
    </nav>
    {section==='overview'&&<EventSummary event={selected} canDirect={canDirect}
      onPlan={()=>setSection('planning')} onSignups={()=>setSection('signups')} onPrepare={()=>setSection('setup')} onCombat={()=>setSection('combat')}/>}
    {section==='planning'&&canDirect&&<section className="panel"><div className="panel-heading"><div><h2>Schedule & publish</h2><p>Only published events appear for member sign-ups. You can prepare enemies beforehand.</p></div></div><EventEditor key={selected.id} event={selected} save={savePlan} working={working}/></section>}
    {section==='signups'&&<EventSignups key={selected.id} event={selected} characters={characters}
      userId={userId} canDirect={canDirect} working={working} action={action} refresh={refresh}/>}
    {section==='setup'&&<section className="panel event-setup-intro"><h2>Combat preparation</h2><p>Prepare bosses, enemies, NPCs and the approved party before event night. Keep this encounter in Draft while setting it up.</p>
    {canDirect&&<div className="encounter-actions">{selected.status!=='active'&&<><button className="btn secondary" disabled={working||!selected.combatants.length} onClick={()=>action(()=>rollAllInitiative(chosenId))}>⚄ Roll initiative</button><button className="btn primary" disabled={working||!selected.combatants.length} onClick={()=>{if(window.confirm('Start combat now? Event preparation will be locked.'))action(()=>encounterTurn(chosenId,'start'))}}>Start combat</button></>}</div>}
    <div className="event-setup-stats"><span>{selected.combatants.filter(c=>c.kind==='player').length} players assigned</span><span>{selected.combatants.filter(c=>c.kind==='npc').length} enemies / NPCs</span></div></section>}
    {section==='map'&&<BattleMap encounter={selected} canDirect={canDirect} onRefresh={refresh} onError={setError}/>}
    {section==='combat'&&<section className="panel encounter-header"><div className="encounter-topline"><div><small>LIVE ENCOUNTER</small><h2>{selected.name}</h2><p className="muted">Status: {selected.status} · Round {selected.round_number}</p></div>{canDirect&&selected.status==='active'&&<div className="encounter-actions"><button className="btn primary" disabled={working} onClick={()=>action(()=>encounterTurn(chosenId,'next'))}>Next turn →</button><button className="btn secondary" disabled={working} onClick={()=>action(()=>encounterTurn(chosenId,'finish'))}>Finish combat</button></div>}</div>
    {activeCombatant&&selected.status==='active'&&<div className="current-turn"><span>NOW ACTING</span><strong>{activeCombatant.name}</strong><small>Round {selected.round_number} · Initiative {activeCombatant.initiative}</small></div>}
    <div className="ooc-access"><div><h3>Player OOC control</h3><p>Profile preferences and your OOC pause control remain available during all encounters.</p>{check&&<p>{check.paused?'Your participation is paused.':check.missing_themes?.length?'Some event themes are not enabled in your profile.':'Your profile themes allow this event.'}</p>}</div><button className="btn secondary" disabled={working} onClick={()=>action(()=>pauseEncounter(chosenId,!check?.paused))}>{check?.paused?'Resume OOC':'Pause OOC'}</button></div></section>}
    {(section==='setup'||section==='combat')&&<section className="panel"><div className="panel-heading"><div><h2>{section==='setup'?'Prepared combatants':'Initiative tracker'}</h2><p>GM-controlled combatants, HP, armor class, conditions and turn order.</p></div></div>
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
    {section==='dice'&&(isParticipant?<DicePanel key={selected.id} encounter={selected} characters={characters} canDirect={canDirect} userId={userId} check={check} working={working} action={action}/>:<section className="panel"><h2>Dice & checks</h2><p className="muted">Only approved party participants and the GM can roll. Sign up first, then have the GM add your character to the party.</p></section>)}
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
