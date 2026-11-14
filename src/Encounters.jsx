import React,{useEffect,useState} from 'react';
import {listEncounters,createEncounter,encounterTurn,encounterCheck,pauseEncounter,rollAllInitiative,archiveEncounter,restoreEncounter,deleteEncounter} from './apiBridge.js';
import {CONTENT_THEMES} from './ProfileConsent.jsx';
import './encounters.css';
import BattleMap from './BattleMap.jsx';
import {DicePanel} from './EncounterDice.jsx';
import CombatantWorkspace from './CombatantWorkspace.jsx';
import DiceTray from './DiceTray.jsx';
import {EventEditor,EventSignups,EventSummary} from './EventPlanning.jsx';
import EventXPRewards from './EventXPRewards.jsx';
import {editPlannedEvent} from './apiBridge.js';
import './event-planning.css';
import './encounter-studio.css';
const label=key=>CONTENT_THEMES.find(x=>x[0]===key)?.[1]||key;
export default function Encounters({role,userId,characters,onOpenProfile,onRefreshCharacters,previewOnly=false,playerFacing=false,classCatalog}){
 const directorRole=!playerFacing&&['domina','high_command','handler'].includes(role);
 const [data,setData]=useState([]),[chosenId,setChosenId]=useState('');

 const [check,setCheck]=useState(null),[working,setWorking]=useState(false),[error,setError]=useState('');
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

 return <div className={'encounter-layout encounter-studio encounter-dm-view'+(focusMode?' scene-focus':'')+(railOpen?'':' rail-collapsed')}>
  <aside className="panel encounter-sidebar"><div className="encounter-studio-aside-header"><span className="encounter-eyebrow">IMPERIUM NOCTIS</span><h2>DM Studio</h2><p>Run stories and command the battlefield.</p><button type="button" className="mini-btn encounter-scenes-toggle" aria-expanded={scenesOpen} onClick={()=>setScenesOpen(v=>!v)}>{scenesOpen?'Hide scenes':'Scenes'}</button>{directorRole&&<button className="btn primary" onClick={()=>{setCreating(true);setSection('planning')}}>+ New encounter</button>}</div>{scenesOpen&&<><div className="encounter-scene-filters" role="group" aria-label="Scene list"><button type="button" aria-pressed={!showArchived} className={!showArchived?'active':''} onClick={()=>{setShowArchived(false);setChosenId('')}}>Current</button><button type="button" aria-pressed={showArchived} className={showArchived?'active':''} onClick={()=>{setShowArchived(true);setChosenId(data.find(e=>e.archived_at)?.id||'')}}>Archived ({data.filter(e=>e.archived_at).length})</button></div><div className="encounter-studio-list-label">{showArchived?'ARCHIVED SCENES':'ENCOUNTERS'} <span>{shownScenes.length}</span></div>
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
      {canDirect&&['active','paused'].includes(selected.status)&&<button type="button" className="btn secondary" disabled={working} onClick={()=>{if(window.confirm('Finish this encounter? You can then archive the scene.'))action(()=>encounterTurn(chosenId,'finish'))}}>Finish encounter</button>}
     </div>
    </header>
    <nav className="event-tabs encounter-studio-tabs" aria-label="DM tools">
     {[
      ['map','Battle Map','map'],['combat','Initiative','shield-halved'],['dice','Dice & Rolls','dice-d20'],
      ['setup','Combatants','users'],['signups','Party','people-group'],['overview','Event Overview','calendar-days'],
      ...(canDirect?[['planning','Event Editor','pen-to-square']]:[])
     ].map(([id,name,icon])=><button key={id} type="button" className={'event-tab '+(section===id?'active':'')} aria-current={section===id?'page':undefined} onClick={()=>setSection(id)}>
      <span aria-hidden="true"><i className={'fa-solid fa-'+icon}/></span>{name}{id==='signups'&&canDirect&&selected.pending_count>0&&<span className="event-tab-count">{selected.pending_count}</span>}
     </button>)}
    </nav>
    {section==='overview'&&<><EventSummary event={selected} playerFacing={playerFacing} canDirect={canDirect}
      onPlan={()=>setSection('planning')} onSignups={()=>setSection('signups')} onPrepare={()=>setSection('setup')} onCombat={()=>setSection('combat')}/>
      {!playerFacing&&<EventXPRewards event={selected} characters={characters} canDirect={canDirect} onRefresh={onRefreshCharacters}/>}</>}
    {section==='planning'&&canDirect&&<section className="panel"><div className="panel-heading"><div><h2>Schedule & publish</h2><p>Only published events appear for member sign-ups. You can prepare enemies beforehand.</p></div></div><EventEditor key={selected.id} event={selected} save={savePlan} working={working}/></section>}
    {section==='signups'&&<EventSignups key={selected.id} event={selected} previewOnly={previewOnly} ownOnly={playerFacing} characters={characters}
      userId={userId} canDirect={canDirect} working={working} action={action} refresh={refresh}/>}
    {section==='setup'&&<section className="panel event-setup-intro"><h2>Combat preparation</h2><p>Prepare bosses, enemies, NPCs and the approved party before event night. Keep this encounter in Draft while setting it up.</p>
    {canDirect&&<div className="encounter-actions">{selected.status==='draft'&&<><button className="btn secondary" disabled={working||!selected.combatants.length} onClick={()=>action(()=>rollAllInitiative(chosenId))}><i className="fa-solid fa-dice-d20"/> Roll initiative</button><button className="btn primary" disabled={working||!selected.combatants.length} onClick={()=>{if(window.confirm('Start combat now? Event preparation will be locked.'))action(()=>encounterTurn(chosenId,'start'))}}>Start combat</button></>}</div>}
    <div className="event-setup-stats"><span>{selected.combatants.filter(c=>c.kind==='player').length} players assigned</span><span>{selected.combatants.filter(c=>c.kind==='ally').length} NPC allies</span><span>{selected.combatants.filter(c=>c.kind==='npc').length} enemies / NPCs</span></div></section>}
    {section==='map'&&<div className="encounter-studio-map-layout"><BattleMap key={selected.id} encounter={selected} canDirect={canDirect} onRefresh={refresh} onError={setError}/>
     <aside className="encounter-studio-battle-rail"><div className="encounter-rail-tabs"><button type="button" className={railMode==='turns'?'active':''} aria-pressed={railMode==='turns'} onClick={()=>{setRailMode('turns');setRailOpen(true)}}>Initiative</button><button type="button" className={railMode==='dice'?'active':''} aria-pressed={railMode==='dice'} onClick={()=>{setRailMode('dice');setRailOpen(true)}}>Dice</button><button type="button" onClick={()=>setRailOpen(v=>!v)} aria-label={railOpen?'Collapse sidebar':'Expand sidebar'}>{railOpen?'‹':'›'}</button></div>
      {railOpen&&railMode==='turns'&&<><div className="encounter-studio-rail-heading"><span className="encounter-eyebrow">TURN ORDER</span><strong>Round {selected.round_number||1}</strong></div>
      {selected.combatants.length?<div className="encounter-studio-turn-list">{selected.combatants.map((c,i)=><div key={c.id} className={'encounter-studio-turn '+(selected.status==='active'&&i===selected.turn_index%selected.combatants.length?'current':'')}>
       <span className="encounter-studio-initiative">{c.initiative}</span><div><strong>{c.name}</strong><small>{c.kind==='player'?'Player character':c.kind==='ally'?'NPC ally · DM controlled':'Enemy · DM controlled'}</small><div className="encounter-studio-mini-hp"><span style={{width:Math.max(0,Math.min(100,c.hp/Math.max(1,c.max_hp)*100))+'%'}}/></div><small>{c.hp}/{c.max_hp} HP · AC {c.ac}</small></div>
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
    {(section==='setup'||section==='combat')&&<CombatantWorkspace key={selected.id} encounter={selected} characters={characters} canDirect={canDirect} working={working} action={action}/>}
    {section==='dice'&&((isParticipant||canDirect)&&!(previewOnly&&!isParticipant)?<DicePanel classCatalog={classCatalog} key={selected.id} previewOnly={previewOnly} isDirector={isDirector} encounter={selected} characters={characters} canDirect={canDirect} userId={userId} check={check} working={working} action={action}/>:<section className="panel"><h2>Dice & checks</h2><p className="muted">Only approved party participants and the GM can roll. Sign up first, then have the GM add your character to the party.</p></section>)}
   </>}

  </main>
 </div>;
}
