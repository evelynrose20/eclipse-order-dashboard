import React,{useEffect,useState} from 'react';
import {FullDndSheet,LimitedSheet} from './OrderSheets.jsx';
import CharacterProgression from './CharacterProgression.jsx';
import ClassSpellbook from './ClassSpellbook.jsx';
import CharacterEquipment from './CharacterEquipment.jsx';
import ContributionPreferences from './ContributionPreferences.jsx';
import BroodHostSettings from './BroodHostSettings.jsx';
import CharacterReproduction from './CharacterReproduction.jsx';
import FamilyCare from './FamilyCare.jsx';
import {DOSSIER_TABS,dossierTabs,dossierSummary,isDossierRestricted,defaultDossierTab,canViewCharacterChamber} from './characterDossierRules.js';
import './character-dossier.css';

function ReadField({title,children,wide=false}){
 return <div className={'dossier-field '+(wide?'dossier-field-wide':'')}><span>{title}</span><div>{children||<em>Not recorded yet</em>}</div></div>;
}
function Chapter({eyebrow,title,description,children}){
 return <section className="dossier-chapter"><div className="dossier-chapter-head"><span>{eyebrow}</span><h3>{title}</h3><p>{description}</p></div>{children}</section>;
}
function TextCard({title,body}){
 return <div className="dossier-story-card"><h4>{title}</h4><p>{body||'Not recorded yet.'}</p></div>;
}
export default function CharacterDossier({
 character,playerPreview=false,canEdit=false,onEdit,onOpenPreferences,
 canCommand=false,canChangeBoundRank=false,canViewPregnancyStaff=false,canViewChamberStaff=false,servitudeRanks=[],request,onRefresh,classCatalog={},userId
}){
 const restricted=isDossierRestricted(character,playerPreview);
 const summary=dossierSummary(character,playerPreview);
 const canViewChamber=canViewCharacterChamber(character,userId,{staff:canViewChamberStaff,playerPreview});
 const recordOwner=!playerPreview&&character?.player_user_id===userId;
 const personalRecord=!playerPreview&&(recordOwner||canCommand||canViewPregnancyStaff);
 const allowed=[...dossierTabs(character,playerPreview),...(canViewChamber?[{id:'contributions',label:'Chamber',icon:'◇'}]:[]),...(personalRecord?[...(character?.collar_bound?[{id:'brood-host',label:'Brood Pit',icon:'✧'}]:[]),...(character?.collar_bound?[{id:'binding-cycle',label:'Binding cycle',icon:'◌'}]:[]),{id:'pregnancy',label:'Pregnancy',icon:'○'},{id:'parenthood',label:'Parenthood',icon:'♧'}]:[])];
 const [section,setSection]=useState(()=>defaultDossierTab(character,playerPreview));
 const [rankBusy,setRankBusy]=useState(false),[rankError,setRankError]=useState('');
 const [privateCycle,setPrivateCycle]=useState(null);
 async function changeBoundRank(code){
  setRankBusy(true);setRankError('');
  try{await request('/characters/'+character.id+'/rank',{method:'POST',body:{rank:code}});await onRefresh?.()}
  catch(error){setRankError(error.message||'Unable to update bound standing')}
  finally{setRankBusy(false)}
 }
 useEffect(()=>setSection(defaultDossierTab(character,playerPreview)),[character?.id,restricted]);
 useEffect(()=>{
  if(!recordOwner){setPrivateCycle(null);return}
  let live=true;
  request('/characters/'+character.id+'/reproduction').then(r=>{if(live)setPrivateCycle(r.cycle)}).catch(()=>{if(live)setPrivateCycle(null)});
  return()=>{live=false};
 },[character?.id,recordOwner]);
 useEffect(()=>{if(!allowed.some(x=>x.id===section))setSection(defaultDossierTab(character,playerPreview))},[section,restricted]);
 if(!summary)return null;
 const active=allowed.some(x=>x.id===section)?section:defaultDossierTab(character,playerPreview);
 const klass=classCatalog[character.class_id];
 return <div className="dossier-root">
  <header className="dossier-hero">
   <div className="dossier-emblem" aria-hidden="true"><i className="fa-solid fa-scroll"/></div>
   <div className="dossier-person">
    <div className="dossier-eyebrow">THE ECLIPSE ORDER <span> / </span> CHARACTER DOSSIER</div>
    <h2>{summary.name}</h2>
    <p>{restricted?(summary.specialty+' · Bound record'):[summary.species,summary.className||summary.specialty].filter(Boolean).join(' · ')||'An unwritten chapter'}</p>
    <div className="dossier-tags"><span>{restricted?'Sealed view':'Character record'}</span><span>{summary.rank||'Order member'}</span>{!restricted&&<span>Level {summary.level}</span>}{!restricted&&<span>{character.player_user_id?character.player_user_id===userId?'Linked to your account':'Linked to another account':'No player account linked'}</span>}</div>
   </div>
   {canEdit&&!restricted&&<button type="button" className="btn primary dossier-edit" onClick={onEdit}>Edit character</button>}
  </header>

  {canChangeBoundRank&&character.collar_bound&&<div className="dossier-rank-control"><label>Bound standing <select value={character.servitude_rank||''} onChange={e=>changeBoundRank(e.target.value)} disabled={rankBusy||!servitudeRanks.length}><option value="" disabled>{character.servitude_rank?'Select rank':'Select official bound rank'}</option>{servitudeRanks.map(rank=><option key={rank.code} value={rank.code}>{rank.title}</option>)}</select></label>{rankError&&<p role="alert">{rankError}</p>}</div>}
  {recordOwner&&privateCycle?.active&&privateCycle?.alert&&<div className="dossier-cycle-notice" role="status"><i className="fa-solid fa-bell" aria-hidden="true"/>{privateCycle.alert}<button type="button" onClick={()=>setSection('binding-cycle')}>View cycle</button></div>}
  {restricted&&<div className="dossier-seal" role="note"><strong>Arcane binding · Limited character knowledge</strong><p>This in-character view intentionally hides sealed mechanical and private fields. Your OOC account preferences remain under your control.</p></div>}
  <div className="dossier-frame">
   <nav className="dossier-tabs" aria-label="Character dossier sections">
    {allowed.map(t=><button key={t.id} type="button" className={active===t.id?'active':''} aria-current={active===t.id?'page':undefined} onClick={()=>setSection(t.id)}><span aria-hidden="true">{t.icon}</span>{t.label}</button>)}
   </nav>
   <div className="dossier-body">
    {active==='identity'&&(restricted?<Chapter eyebrow="01 / RESTRICTED" title="Known identity" description="Only details visible to this bound character appear here."><div className="dossier-fields"><ReadField title="Character">{summary.name}</ReadField><ReadField title="Role">{summary.specialty}</ReadField><ReadField title="Assigned handler">{summary.assignedHandler}</ReadField><ReadField title="Binding status">{summary.rank}</ReadField><ReadField title="Visible condition">{summary.hp===null?'Not recorded':summary.hp+' HP'}</ReadField></div></Chapter>:
     <Chapter eyebrow="01 / THE PERSON" title="Identity & origin" description="The character behind the legend, before the dice are rolled."><div className="dossier-fields"><ReadField title="Name">{summary.name}</ReadField><ReadField title="Race / species">{summary.species}</ReadField><ReadField title="Syndicate role">{summary.specialty}</ReadField><ReadField title="Class">{summary.className}</ReadField><ReadField title="Background" wide>{summary.background}</ReadField><ReadField title="Alignment / outlook">{summary.alignment}</ReadField><ReadField title="Order standing">{summary.rank}</ReadField></div></Chapter>)}
    {active==='roleplay'&&(restricted?<Chapter eyebrow="02 / ROLEPLAY" title="Your story, your boundaries" description="The character's sealed dossier does not restrict the player's OOC preferences."><div className="dossier-empty"><p>Some IC history is not visible while this binding is active. You can always review your OOC boundaries and account-level RP preferences.</p><button type="button" className="btn secondary" onClick={onOpenPreferences}>Open my RP preferences</button></div></Chapter>:
     <Chapter eyebrow="02 / CHARACTER" title="Roleplay & personality" description="Story details are part of the character record. OOC consent settings are held separately on your own account."><div className="dossier-stories"><TextCard title="Personality" body={summary.personality}/><TextCard title="Ideals & motivations" body={summary.ideals}/><TextCard title="Bonds & relationships" body={summary.bonds}/><TextCard title="Flaws & conflicts" body={summary.flaws}/></div><div className="dossier-privacy"><div><strong>OOC boundaries are separate</strong><p>Your personal RP preferences and content limits are never determined by a character's IC rank or handler.</p></div><button type="button" className="btn secondary" onClick={onOpenPreferences}>My RP preferences</button></div></Chapter>)}
    {active==='combat'&&!restricted&&<Chapter eyebrow="03 / GAMEPLAY" title="Combat record" description="Current gameplay statistics from the existing system. These will change when we finalize our original rules."><div className="dossier-stats"><div><span>Hit points</span><strong>{summary.hp??'—'} <small>/ {summary.maxHp??'—'}</small></strong></div><div><span>Defense / AC</span><strong>{summary.armor??'—'}</strong></div><div><span>Speed</span><strong>{summary.speed??'—'}</strong></div><div><span>Level</span><strong>{summary.level}</strong></div></div><div className="dossier-abilities">{Object.entries(summary.abilities).map(([key,value])=><div key={key}><span>{({str:'Strength',dex:'Dexterity',con:'Constitution',int:'Intelligence',wis:'Wisdom',cha:'Charisma'})[key]}</span><strong>{value??'—'}</strong></div>)}</div><div className="dossier-fields"><ReadField title="Features & traits" wide>{summary.features}</ReadField><ReadField title="Conditions" wide>{summary.conditions}</ReadField></div></Chapter>}
    {active==='spells'&&!restricted&&<Chapter eyebrow="04 / ARCANUM" title="Spellbook & abilities" description="Job abilities and spells unlock as characters gain levels through Order events."><div className="dossier-integrated"><ClassSpellbook key={character.id} character={character} klass={klass} request={request} onRefresh={onRefresh} userId={userId} readOnly={playerPreview}/></div><div className="dossier-fields"><ReadField title="Additional spell notes" wide>{summary.spells}</ReadField></div></Chapter>}
    {active==='possessions'&&!restricted&&<Chapter eyebrow="05 / BELONGINGS" title="Equipment & personal effects" description="Character-owned crafted equipment, equipped slots, and descriptive RP belongings."><div className="dossier-integrated"><CharacterEquipment character={character} request={request} canEquip={!playerPreview&&character.player_user_id===userId}/></div><div className="dossier-fields"><ReadField title="Personal effects (RP only)" wide>{summary.equipment}</ReadField><ReadField title="Proficiencies & languages" wide>{summary.proficiencies}</ReadField></div></Chapter>}
    {active==='progression'&&!restricted&&<Chapter eyebrow="06 / JOURNEY" title="Progression" description="Levels and event-earned experience remain on the current system until the original RPG design replaces it."><div className="dossier-stats"><div><span>Current level</span><strong>{summary.level}</strong></div><div><span>Event XP</span><strong>{Number(summary.experience||0).toLocaleString()}</strong></div><div><span>Ability points</span><strong>{character.ability_points??0}</strong></div></div><div className="dossier-integrated"><CharacterProgression key={character.id} character={character} canCommand={canCommand} readOnly={playerPreview} request={request} onRefresh={onRefresh}/></div></Chapter>}
    {active==='binding-cycle'&&personalRecord&&character.collar_bound&&<CharacterReproduction key={character.id+'-cycle'} view="cycle" character={character} request={request} readOnly={!recordOwner} onPhaseChange={recordOwner?setPrivateCycle:undefined}/>}
    {active==='pregnancy'&&personalRecord&&<CharacterReproduction key={character.id+'-pregnancy'} view="pregnancy" character={character} request={request} readOnly={!recordOwner}/>}
    {active==='parenthood'&&personalRecord&&<FamilyCare key={character.id+'-parenthood'} request={request} readOnly={!recordOwner} compact/>}
    {active==='brood-host'&&personalRecord&&character.collar_bound&&<BroodHostSettings key={character.id+'-brood'} character={character} request={request} userId={userId} readOnly={!recordOwner}/>}
    {active==='contributions'&&canViewChamber&&<ContributionPreferences key={character.id} character={character} request={request} userId={userId} readOnly={playerPreview}/>}
    {active==='legacy'&&!restricted&&<Chapter eyebrow="PRIMARY / CHARACTER SHEET" title="Classic character sheet" description="Your complete character sheet, with all existing details and mechanics. Explore the other dossier tabs whenever you like."><FullDndSheet character={character}/><div className="dossier-integrated"><CharacterEquipment character={character} request={request} canEquip={!playerPreview&&character.player_user_id===userId}/></div></Chapter>}
   </div>
  </div>
 </div>;
}
