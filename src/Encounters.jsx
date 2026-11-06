import React,{useEffect,useState} from 'react';
import {listEncounters,createEncounter,addCombatant,editCombatant,deleteCombatant,encounterTurn,encounterCheck,pauseEncounter,listMonsterTemplates,createMonsterTemplate,updateMonsterTemplate,deleteMonsterTemplate,addMonsterToEncounter,rollAllInitiative,archiveEncounter,restoreEncounter,deleteEncounter} from './apiBridge.js';
import {CONTENT_THEMES} from './ProfileConsent.jsx';
import './encounters.css';
import BattleMap from './BattleMap.jsx';
import {DicePanel,QuickHP} from './EncounterDice.jsx';
import DiceTray from './DiceTray.jsx';
import {EventEditor,EventSignups,EventSummary} from './EventPlanning.jsx';
import EventXPRewards from './EventXPRewards.jsx';
import {editPlannedEvent} from './apiBridge.js';
import './event-planning.css';
import './encounter-studio.css';
const CONDITIONS=['Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious','Exhaustion'];
const label=key=>CONTENT_THEMES.find(x=>x[0]===key)?.[1]||key;
export default function Encounters({role,userId,characters,onOpenProfile,onRefreshCharacters,previewOnly=false,playerFacing=false,classCatalog}){
 const directorRole=!playerFacing&&['domina','high_command','handler'].includes(role);
 const [data,setData]=useState([]),[chosenId,setChosenId]=useState('');
 const [combatName,setCombatName]=useState(''),[kind,setKind]=useState('npc'),[charId,setCharId]=useState(''),[initiative,setInitiative]=useState(10),[hp,setHp]=useState(20),[ac,setAc]=useState(10);

 const [check,setCheck]=useState(null),[working,setWorking]=useState(false),[error,setError]=useState('');
 const [monsters,setMonsters]=useState([]),[chosenMonster,setChosenMonster]=useState('');
 const [monsterForm,setMonsterForm]=useState({name:'',challenge:'Custom',hit_points:20,armor_class:10,initiative_bonus:0,actions:'',notes:''});
 const [showMonsterEditor,setShowMonsterEditor]=useState(false);
 const [editingMonsterId,setEditingMonsterId]=useState(null);
 const [libraryOpen,setLibraryOpen]=useState(false);
 const [section,setSection]=useState('map');
 const [focusMode,setFocusMode]=useState(false);
 const [railMode,setRailMode]=useState('turns');
 const [railOpen,setRailOpen]=useState(true);
 const [scenesOpen,setScenesOpen]=useState(false);
 const [showArchived,setShowArchived]=useState(false);
 const [notice,setNotice]=useState('');
 const [creating,setCreating]=useState(false);
 const selected=data.find(x=>x.id===chosenId)||null;
 const shownScenes=data.filter(e=>showArchived?Boolean(e.archived_at):!e.archived_at);
 const canManageScene=Boolean(!playerFacing&&selected&&(role==='domina'||role==='high_command'||(role==='handler'&&selected.created_by===userId)));
 const canDirect=Boolean(canManageScene&&!selected.archived_at);
 const isParticipant=Boolean(selected?.combatants?.some(c=>characters.some(ch=>ch.id===c.character_id&&ch.player_user_id===userId)));
 const isDirector=Boolean(!playerFacing&&selected?.created_by===userId);
 const activeCombatant=selected?.combatants?.[selected.turn_index%Math.max(1,selected.combatants.length)];
 async function refresh(){const x=await listEncounters();const visible=playerFacing?x.filter(e=>e.published):previewOnly?x.filter(e=>e.published||e.combatants.some(c=>characters.some(ch=>ch.id===c.character_id&&ch.player_user_id===userId))):x;setData(visible);setChosenId(old=>visible.some(e=>e.id===old)?old:visible.find(e=>!e.archived_at)?.id||'')}
 useEffect(()=>{
  refresh().catch(e=>setError(e.message));
  if(directorRole)listMonsterTemplates().then(setMonsters).catch(e=>setError(e.message));
  const timer=setInterval(()=>refresh().catch(()=>{}),30000);return()=>clearInterval(timer)
 },[]);
 useEffect(()=>{if(!chosenId){setCheck(null);return}let active=true;
  const reload=async()=>{try{const result=await encounterCheck(chosenId);if(active)setCheck(result)}catch(e){if(active)setError(e.message)}};
  reload();const timer=setInterval(reload,30000);return()=>{active=false;clearInterval(timer)}
 },[chosenId]);
 async function action(fn){if(previewOnly)return;setWorking(true);setError('');setNotice('');try{const result=await fn();await refresh();if(chosenId)setCheck(await encounterCheck(chosenId));return result}catch(e){setError(e.message)}finally{setWorking(false)}}
 async function changeArchive(archive){
  if(!selected||!canManageScene||working)return;
  if(archive&&!window.confirm('Archive "'+selected.name+'"? You can restore it later.'))return;
  setWorking(true);setError('');setNotice('');
  try{
   if(archive)await archiveEncounter(selected.id);else await restoreEncounter(selected.id);
   setNotice(archive?'Scene archived. You can restore it from Archived scenes.':'Scene restored.');
   setShowArchived(false);setChosenId('');await refresh();
  }catch(e){setError(e.message)}finally{setWorking(false)}
 }
 async function removeScene(){
  if(!selected?.archived_at||!canManageScene||working)return;
  const answer=window.prompt('Permanently delete this archived scene and all linked combat, signups and roll history? Type the full scene name to confirm:');
  if(answer!==selected.name)return;
  setWorking(true);setError('');setNotice('');
  try{
   await deleteEncounter(selected.id);
   setNotice('Scene permanently deleted.');setShowArchived(false);setChosenId('');await refresh();
  }catch(e){setError(e.message)}finally{setWorking(false)}
 }
 async function createEvent(details){
  const id=await action(()=>createEncounter(details.name,details.description||'',details.themes));
  if(!id)return;
  await action(()=>editPlannedEvent(id,details));
  setChosenId(id);setCreating(false);setSection('planning');
 }
 async function savePlan(details){await action(()=>editPlannedEvent(chosenId,details));}
 async function add(e){e.preventDefault();const source=characters.find(c=>c.id===charId);const name=kind==='player'&&source?source.name:combatName;
  const id=await action(()=>addCombatant(chosenId,name,kind,kind==='player'?charId:null,Number(initiative),Number(hp),Number(ac)));
  if(id){setCombatName('');setCharId('')}}
 async function saveMonster(e){
  e.preventDefault();setWorking(true);setError('');
  try{
   const id=editingMonsterId;
   if(id)await updateMonsterTemplate(id,monsterForm);
   else await createMonsterTemplate(monsterForm);
   const list=await listMonsterTemplates();setMonsters(list);
   setChosenMonster(id||list.find(m=>m.name===monsterForm.name)?.id||'');
   setShowMonsterEditor(false);setEditingMonsterId(null);
   setMonsterForm({name:'',challenge:'Custom',hit_points:20,armor_class:10,initiative_bonus:0,actions:'',notes:''});
   await refresh();
  }catch(e){setError(e.message)}finally{setWorking(false)}
 }
 function editMonster(m){
  setMonsterForm({name:m.name,challenge:m.challenge,hit_points:m.hit_points,armor_class:m.armor_class,initiative_bonus:m.initiative_bonus,actions:m.actions||'',notes:m.notes||''});
  setEditingMonsterId(m.id);setChosenMonster(m.id);setShowMonsterEditor(true);
 }
 async function removeMonster(id){
  if(!window.confirm('Delete this saved stat block? Existing encounter combatants will remain.'))return;
  setWorking(true);setError('');
  try{await deleteMonsterTemplate(id);setMonsters(await listMonsterTemplates());setChosenMonster('');setShowMonsterEditor(false);setEditingMonsterId(null)}
  catch(e){setError(e.message)}finally{setWorking(false)}
 }

 return <div className={'encounter-layout encounter-studio encounter-dm-view'+(focusMode?' scene-focus':'')+(railOpen?'':' rail-collapsed')}>
  <aside className="panel encounter-sidebar"><div className="encounter-studio-aside-header"><span className="encounter-eyebrow">THE ECLIPSE ORDER</span><h2>DM Studio</h2><p>Run stories and command the battlefield.</p><button type="button" className="mini-btn encounter-scenes-toggle" aria-expanded={scenesOpen} onClick={()=>setScenesOpen(v=>!v)}>{scenesOpen?'Hide scenes':'Scenes'}</button>{directorRole&&<button className="btn primary" onClick={()=>{setCreating(true);setSection('planning')}}>+ New encounter</button>}</div>{scenesOpen&&<><div className="encounter-scene-filters" role="group" aria-label="Scene list"><button type="button" aria-pressed={!showArchived} className={!showArchived?'active':''} onClick={()=>{setShowArchived(false);setChosenId('')}}>Current</button><button type="button" aria-pressed={showArchived} className={showArchived?'active':''} onClick={()=>{setShowArchived(true);setChosenId(data.find(e=>e.archived_at)?.id||'')}}>Archived ({data.filter(e=>e.archived_at).length})</button></div><div className="encounter-studio-list-label">{showArchived?'ARCHIVED SCENES':'ENCOUNTERS'} <span>{shownScenes.length}</span></div>
   <div className="encounter-list">{shownScenes.map(e=><button key={e.id} className={'encounter-choice '+(!creating&&chosenId===e.id?'active':'')} onClick={()=>{setCreating(false);setChosenId(e.id);setSection('map');setError('')}}>
    <span className="encounter-choice-state">{e.archived_at?'ARCHIVED':e.status==='active'?'LIVE':e.status==='draft'?'PREPARING':e.status.toUpperCase()}</span><strong>{e.name}</strong><small>{e.combatants.length} combatants · {e.signup_count||0}/{e.capacity||8} party</small></button>)}</div></>}
  </aside>
  <main className="encounter-main">
   {error&&<div className="encounter-feedback error" role="alert"><strong>Action couldn't be completed</strong><span>{error}</span><button className="mini-btn" type="button" onClick={()=>setError('')}>Dismiss</button></div>}
   {notice&&<div className="encounter-feedback success" role="status"><span>{notice}</span><button className="mini-btn" type="button" onClick={()=>setNotice('')}>Dismiss</button></div>}
   {creating&&directorRole?<section className="panel"><div className="panel-heading"><div><h2>Plan a new FC event</h2><p>Build the event privately, schedule it, open sign-ups, then prepare monsters and party members.</p></div><button className="mini-btn" onClick={()=>setCreating(false)}>Cancel</button></div><EventEditor key="new-event" event={null} save={createEvent} working={working}/></section>:
   !selected?<div className="panel"><h2>No event selected</h2><p className="muted">{directorRole?'Create a planned event using the New event button.':'There are no published FC events to sign up for yet.'}</p>{error.toLowerCase().includes('adult')&&<div className="hint-box"><strong>My RP profile</strong><p>Confirm the 18+ declaration on your profile to see available events.</p><button className="btn primary" onClick={onOpenProfile}>Open My RP profile</button></div>}</div>:<>
    <header className="encounter-studio-header">
     <div><span className="encounter-eyebrow">DM WORKSPACE · {selected.status.toUpperCase()}</span><h2>{selected.name}</h2><p>{selected.location||'Location unassigned'} · {selected.combatants.length} combatants · Round {selected.round_number||1}</p></div>
     <div className="encounter-studio-header-actions">{canManageScene&&(selected.archived_at?<><button className="btn secondary" disabled={working} onClick={()=>changeArchive(false)}>Restore scene</button><button className="btn secondary encounter-danger" disabled={working} onClick={removeScene}>Delete permanently</button></>:<button className="btn secondary" disabled={working||['active','paused'].includes(selected.status)} onClick={()=>changeArchive(true)} title={['active','paused'].includes(selected.status)?'Finish the encounter before archiving':'Archive scene'}>Archive</button>)}<button type="button" className="btn secondary encounter-studio-focus-action" aria-pressed={focusMode} onClick={()=>{setFocusMode(v=>!v);setSection('map')}}>{focusMode?'Exit focus':'Focus map'}</button><button type="button" className="btn secondary" onClick={()=>refresh().catch(e=>setError(e.message))}>Refresh</button>
      {canDirect&&selected.status==='draft'&&<button className="btn primary" disabled={working||!selected.combatants.length} onClick={()=>{if(window.confirm('Start the encounter now?'))action(()=>encounterTurn(chosenId,'start'))}}>Start encounter</button>}
      {canDirect&&selected.status==='active'&&<button className="btn primary" disabled={working} onClick={()=>action(()=>encounterTurn(chosenId,'next'))}>Next turn →</button>}
     </div>
    </header>
    <nav className="event-tabs encounter-studio-tabs" aria-label="DM tools">
     {[
      ['map','Battle Map','▦'],['combat','Initiative','⚔'],['dice','Dice & Rolls','⚄'],
      ['setup','Combatants','♟'],['signups','Party','♜'],['overview','Event Overview','◇'],
      ...(canDirect?[['planning','Event Editor','✎']]:[])
     ].map(([id,name,icon])=><button key={id} type="button" className={'event-tab '+(section===id?'active':'')} aria-current={section===id?'page':undefined} onClick={()=>setSection(id)}>
      <span aria-hidden="true">{icon}</span>{name}{id==='signups'&&canDirect&&selected.pending_count>0&&<span className="event-tab-count">{selected.pending_count}</span>}
     </button>)}
    </nav>
    {section==='overview'&&<><EventSummary event={selected} playerFacing={playerFacing} canDirect={canDirect}
      onPlan={()=>setSection('planning')} onSignups={()=>setSection('signups')} onPrepare={()=>setSection('setup')} onCombat={()=>setSection('combat')}/>
      {!playerFacing&&<EventXPRewards event={selected} characters={characters} canDirect={canDirect} onRefresh={onRefreshCharacters}/>}</>}
    {section==='planning'&&canDirect&&<section className="panel"><div className="panel-heading"><div><h2>Schedule & publish</h2><p>Only published events appear for member sign-ups. You can prepare enemies beforehand.</p></div></div><EventEditor key={selected.id} event={selected} save={savePlan} working={working}/></section>}
    {section==='signups'&&<EventSignups key={selected.id} event={selected} previewOnly={previewOnly} ownOnly={playerFacing} characters={characters}
      userId={userId} canDirect={canDirect} working={working} action={action} refresh={refresh}/>}
    {section==='setup'&&<section className="panel event-setup-intro"><h2>Combat preparation</h2><p>Prepare bosses, enemies, NPCs and the approved party before event night. Keep this encounter in Draft while setting it up.</p>
    {canDirect&&<div className="encounter-actions">{selected.status==='draft'&&<><button className="btn secondary" disabled={working||!selected.combatants.length} onClick={()=>action(()=>rollAllInitiative(chosenId))}>⚄ Roll initiative</button><button className="btn primary" disabled={working||!selected.combatants.length} onClick={()=>{if(window.confirm('Start combat now? Event preparation will be locked.'))action(()=>encounterTurn(chosenId,'start'))}}>Start combat</button></>}</div>}
    <div className="event-setup-stats"><span>{selected.combatants.filter(c=>c.kind==='player').length} players assigned</span><span>{selected.combatants.filter(c=>c.kind==='npc').length} enemies / NPCs</span></div></section>}
    {section==='map'&&<div className="encounter-studio-map-layout"><BattleMap key={selected.id} encounter={selected} canDirect={canDirect} onRefresh={refresh} onError={setError}/>
     <aside className="encounter-studio-battle-rail"><div className="encounter-rail-tabs"><button type="button" className={railMode==='turns'?'active':''} aria-pressed={railMode==='turns'} onClick={()=>{setRailMode('turns');setRailOpen(true)}}>Initiative</button><button type="button" className={railMode==='dice'?'active':''} aria-pressed={railMode==='dice'} onClick={()=>{setRailMode('dice');setRailOpen(true)}}>Dice</button><button type="button" onClick={()=>setRailOpen(v=>!v)} aria-label={railOpen?'Collapse sidebar':'Expand sidebar'}>{railOpen?'‹':'›'}</button></div>
      {railOpen&&railMode==='turns'&&<><div className="encounter-studio-rail-heading"><span className="encounter-eyebrow">TURN ORDER</span><strong>Round {selected.round_number||1}</strong></div>
      {selected.combatants.length?<div className="encounter-studio-turn-list">{selected.combatants.map((c,i)=><div key={c.id} className={'encounter-studio-turn '+(selected.status==='active'&&i===selected.turn_index%selected.combatants.length?'current':'')}>
       <span className="encounter-studio-initiative">{c.initiative}</span><div><strong>{c.name}</strong><small>{c.kind==='player'?'Player character':'NPC / enemy'}</small><div className="encounter-studio-mini-hp"><span style={{width:Math.max(0,Math.min(100,c.hp/Math.max(1,c.max_hp)*100))+'%'}}/></div><small>{c.hp}/{c.max_hp} HP · AC {c.ac}</small></div>
      </div>)}</div>:<p className="muted">Add combatants to prepare the battlefield.</p>}
      {canDirect&&<div className="encounter-studio-rail-actions">{selected.status==='draft'&&<button type="button" className="btn secondary" disabled={working||!selected.combatants.length} onClick={()=>action(()=>rollAllInitiative(chosenId))}>Roll initiative</button>}
       <button type="button" className="btn secondary" onClick={()=>setSection('setup')}>Manage combatants</button>
       <button type="button" className="btn secondary" onClick={()=>setSection('dice')}>Dice & checks</button>
       {selected.status==='active'&&<button type="button" className="btn primary" disabled={working} onClick={()=>action(()=>encounterTurn(chosenId,'next'))}>Next turn →</button>}
      </div>}</>}
      {railOpen&&railMode==='dice'&&<div className="encounter-rail-dice"><DiceTray key={selected.id+'-tray'} encounter={selected} canDirect={canDirect} working={working} action={action} onOpenFull={()=>setSection('dice')}/></div>}
     </aside></div>}
    {section==='combat'&&<section className="panel encounter-header"><div className="encounter-topline"><div><small>LIVE ENCOUNTER</small><h2>{selected.name}</h2><p className="muted">Status: {selected.status} · Round {selected.round_number}</p></div>{canDirect&&selected.status==='active'&&<div className="encounter-actions"><button className="btn primary" disabled={working} onClick={()=>action(()=>encounterTurn(chosenId,'next'))}>Next turn →</button><button className="btn secondary" disabled={working} onClick={()=>action(()=>encounterTurn(chosenId,'finish'))}>Finish combat</button></div>}</div>
    {activeCombatant&&selected.status==='active'&&<div className="current-turn"><span>NOW ACTING</span><strong>{activeCombatant.name}</strong><small>Round {selected.round_number} · Initiative {activeCombatant.initiative}</small></div>}
    <div className="ooc-access"><div><h3>Player OOC control</h3><p>Profile preferences and your OOC pause control remain available during all encounters.</p>{check&&<p>{check.paused?'Your participation is paused.':check.missing_themes?.length?'Some event themes are not enabled in your profile.':'Your profile themes allow this event.'}</p>}</div><button className="btn secondary" disabled={previewOnly||working} onClick={()=>action(()=>pauseEncounter(chosenId,!check?.paused))}>{check?.paused?'Resume OOC':'Pause OOC'}</button></div></section>}
    {(section==='setup'||section==='combat')&&<section className="panel"><div className="panel-heading"><div><h2>{section==='setup'?'Prepared combatants':'Initiative tracker'}</h2><p>GM-controlled combatants, HP, armor class, conditions and turn order.</p></div></div>
     <div className="encounter-combatants">{selected.combatants.length?selected.combatants.map((c,i)=><Combatant key={c.id} c={c} canDirect={canDirect} active={selected.status==='active'&&i===selected.turn_index%selected.combatants.length} working={working} save={next=>action(()=>editCombatant(c.id,next.hp,next.initiative,next.ac,next.conditions))} hpAction={action} remove={()=>action(()=>deleteCombatant(c.id))}/>):<p className="muted">No combatants added.</p>}</div>
     {canDirect&&section==='setup'&&<div className="monster-library"><div className="panel-heading"><div><h3>Monster & NPC stat-block library</h3><p>Create, inspect, edit and reuse saved stat blocks. Added enemies keep their own HP, AC, attacks and GM notes.</p></div><button className="mini-btn" onClick={()=>{setEditingMonsterId(null);setMonsterForm({name:'',challenge:'Custom',hit_points:20,armor_class:10,initiative_bonus:0,actions:'',notes:''});setShowMonsterEditor(!showMonsterEditor)}}>{showMonsterEditor?'Close editor':'+ Create stat block'}</button></div>
      {showMonsterEditor&&<form className="monster-form" onSubmit={saveMonster}>
       {[
        ['name','NAME','text'],['challenge','CHALLENGE','text'],['hit_points','HIT POINTS','number'],
        ['armor_class','ARMOR CLASS','number'],['initiative_bonus','INITIATIVE BONUS','number']
       ].map(([key,label,type])=><label className="field" key={key}><span>{label}</span><input required type={type} value={monsterForm[key]} onChange={e=>setMonsterForm(old=>({...old,[key]:e.target.value}))}/></label>)}
       <label className="field"><span>ABILITIES / ATTACKS</span><textarea rows={3} maxLength={2500} value={monsterForm.actions} onChange={e=>setMonsterForm(old=>({...old,actions:e.target.value}))}/></label>
       <label className="field"><span>GM NOTES</span><textarea rows={3} maxLength={2500} value={monsterForm.notes} onChange={e=>setMonsterForm(old=>({...old,notes:e.target.value}))}/></label>
       <button className="btn primary" type="submit" disabled={working}>{editingMonsterId?'Update stat block':'Save stat block'}</button><button className="mini-btn" type="button" onClick={()=>{setShowMonsterEditor(false);setEditingMonsterId(null)}}>Cancel</button>
      </form>}
      <div className="monster-quick-add"><select aria-label="Choose saved stat block" value={chosenMonster} onChange={e=>setChosenMonster(e.target.value)}><option value="">Select saved monster/NPC</option>{monsters.map(m=><option key={m.id} value={m.id}>{m.name} · CR {m.challenge} · {m.hit_points} HP · AC {m.armor_class}</option>)}</select><button className="btn secondary" disabled={!chosenMonster||working} onClick={()=>action(()=>addMonsterToEncounter(chosenId,chosenMonster))}>Add to encounter</button><button className="mini-btn" disabled={!chosenMonster||working} onClick={()=>{const m=monsters.find(m=>m.id===chosenMonster);if(m)editMonster(m)}}>Edit</button><button className="mini-btn danger" disabled={!chosenMonster||working} onClick={()=>removeMonster(chosenMonster)}>Delete</button></div>
      {chosenMonster&&monsters.filter(m=>m.id===chosenMonster).map(m=><div key={m.id} className="monster-preview"><strong>{m.name}</strong><p>CR {m.challenge} · HP {m.hit_points} · AC {m.armor_class} · Initiative {m.initiative_bonus>=0?'+':''}{m.initiative_bonus}</p><p><strong>Abilities & attacks</strong></p><p>{m.actions||'No attacks described.'}</p><p><strong>GM notes</strong></p><p>{m.notes||'No notes recorded.'}</p></div>)}
     </div>}
     {canDirect&&section==='setup'&&<form onSubmit={add} className="encounter-add"><h3>Add a combatant</h3><div className="encounter-fields">
      <label className="field"><span>TYPE</span><select value={kind} onChange={e=>setKind(e.target.value)}><option value="npc">NPC / enemy</option></select></label>
      {kind==='npc'?<label className="field"><span>NAME</span><input required value={combatName} onChange={e=>setCombatName(e.target.value)}/></label>:
       <label className="field"><span>CHARACTER</span><select required value={charId} onChange={e=>{const id=e.target.value;const c=characters.find(x=>x.id===id);setCharId(id);if(c){setHp(c.max_hp||c.hp||20);setAc(c.armor_class||10)}}}><option value="">Choose character</option>{characters.filter(c=>c.view_mode!=='bound').map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      <label className="field"><span>INITIATIVE</span><input type="number" min={-100} max={100} value={initiative} onChange={e=>setInitiative(e.target.value)}/></label>
      <label className="field"><span>MAX HP</span><input type="number" min={1} max={999999} value={hp} onChange={e=>setHp(e.target.value)}/></label>
      <label className="field"><span>AC</span><input type="number" min={0} max={99} value={ac} onChange={e=>setAc(e.target.value)}/></label>
      <button className="btn primary" disabled={working} type="submit">Add</button>
     </div></form>}
    </section>}
    {section==='dice'&&((isParticipant||canDirect)&&!(previewOnly&&!isParticipant)?<DicePanel classCatalog={classCatalog} key={selected.id} previewOnly={previewOnly} isDirector={isDirector} encounter={selected} characters={characters} canDirect={canDirect} userId={userId} check={check} working={working} action={action}/>:<section className="panel"><h2>Dice & checks</h2><p className="muted">Only approved party participants and the GM can roll. Sign up first, then have the GM add your character to the party.</p></section>)}
   </>}

  </main>
 </div>;
}
function Combatant({c,canDirect,active,working,save,hpAction,remove}){
 const [editing,setEditing]=useState(false),[draft,setDraft]=useState(c);
 useEffect(()=>{if(!editing)setDraft(c)},[c,editing]);
 return <div className={'combatant '+(active?'acting':'')}><span className="combatant-initiative">{c.initiative}</span><div className="combatant-identity"><strong>{c.name}</strong><small>{c.kind==='npc'?'NPC / enemy':'Player character'}</small>{c.actions&&<details className="combatant-statblock"><summary>Attacks & abilities</summary><p>{c.actions}</p>{c.notes&&canDirect&&<p><strong>GM notes:</strong> {c.notes}</p>}</details>}<div className="combatant-health"><span style={{width:Math.max(0,Math.min(100,c.hp/c.max_hp*100))+'%'}}/></div><small>{c.hp}/{c.max_hp} HP · AC {c.ac}</small>{Boolean(c.conditions.length)&&<p>{c.conditions.join(' · ')}</p>}</div>
  {canDirect&&<QuickHP combatant={c} action={hpAction} working={working}/>}
  {canDirect&&<div className="combatant-actions"><button className="mini-btn" onClick={()=>setEditing(!editing)}>Edit</button><button className="mini-btn danger" disabled={working} onClick={remove}>Remove</button></div>}
  {editing&&<div className="combatant-editor"><label>HP<input type="number" min={0} max={999999} value={draft.hp} onChange={e=>setDraft({...draft,hp:Number(e.target.value)})}/></label><label>Initiative<input type="number" min={-100} max={100} value={draft.initiative} onChange={e=>setDraft({...draft,initiative:Number(e.target.value)})}/></label><label>AC<input type="number" min={0} max={99} value={draft.ac} onChange={e=>setDraft({...draft,ac:Number(e.target.value)})}/></label><label>Conditions<select multiple value={draft.conditions||[]} onChange={e=>setDraft({...draft,conditions:Array.from(e.target.selectedOptions).map(x=>x.value)})}>{CONDITIONS.map(x=><option key={x} value={x}>{x}</option>)}</select></label><button className="mini-btn" disabled={working} onClick={async()=>{await save(draft);setEditing(false)}}>Save</button></div>}
 </div>;
}
