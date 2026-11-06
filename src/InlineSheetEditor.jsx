import React,{useEffect,useMemo,useState} from 'react';
import './inline-sheet.css';
import {xpForLevel} from './progressionRules.js';
import {ATTRIBUTES,BUDGET,POINT_COST,pointsSpent,creationIssue,characterClassGroups,editorJobPreview} from './characterEditorRules.js';
import {SPECIALIZATIONS,ALIGNMENTS,GAME_PROFICIENCIES,splitCharacterName,joinCharacterName,skillBonus,formatSigned,selectedGameProficiencies,otherProficiencyNotes,updateProficiencySelection,classArmor} from './characterFieldRules.js';

const SECTIONS=[
 ['identity','Identity & job','Character name, race, class and background'],
 ['attributes','Attributes & skills','Dice scores and proficiencies'],
 ['roleplay','Story & personality','Character-only roleplay information'],
 ['equipment','Combat & belongings','Conditions, equipment and capabilities'],
 ['assignments','Order records','Character links and assignments']
];
const SKILLS=['Acrobatics','Animal Handling','Arcana','Athletics','Deception','History','Insight','Intimidation','Investigation','Medicine','Nature','Perception','Performance','Persuasion','Religion','Sleight of Hand','Stealth','Survival'];
const FIELDS={
 identity:[['species','Race / species'],['player','Player handle'],['background','Background / origin']],
 roleplay:[['personality','Personality and demeanor'],['ideals','Ideals and motivations'],['bonds','Relationships and bonds'],['flaws','Flaws and complications']],
 equipment:[['features','Additional features and traits'],['spells','Additional spell notes'],['inventory','Personal effects (RP only)'],['conditions','Conditions']],
 assignments:[['notes','Ledger notes']]
};
const LONG=new Set(['background','personality','ideals','bonds','flaws','features','spells','inventory','conditions','notes']);
const NUMERIC=new Set([]);
const NO_EDIT_CREATION=new Set(['player','owner']);
function Field({name,label,form,onSet,disabled=false,help}){
 const value=form[name]??'';
 return <label className={'inline-field '+(LONG.has(name)?'long':'')}><span>{label}</span>
 {LONG.has(name)?<textarea rows={name==='notes'?5:3} maxLength={name==='notes'?4000:12000} value={value} disabled={disabled} onChange={e=>onSet(name,e.target.value)}/>:
  <input value={value} disabled={disabled} type={NUMERIC.has(name)?'number':'text'} min={NUMERIC.has(name)?0:undefined} maxLength={NUMERIC.has(name)?undefined:name==='name'?120:160} required={name==='name'} onChange={e=>onSet(name,NUMERIC.has(name)?Number(e.target.value):e.target.value)}/>}
 {help&&<small className="inline-help">{help}</small>}</label>;
}
function SectionTitle({number,title,description}){
 return <div className="inline-editor-section-head"><span>SECTION {number}</span><h3>{title}</h3><p>{description}</p></div>;
}
export default function InlineSheetEditor({character,canCommand,members=[],onSave,onCancel,saving,classCatalog={}}){
 const [form,setForm]=useState(()=>({...character}));
 const [section,setSection]=useState('identity');
 const [submitAttempt,setSubmitAttempt]=useState(false);
 const firstCreation=!character.id;
 const tracked=character.progression_version===1;
 const catalog=classCatalog||{};
 const groups=useMemo(()=>characterClassGroups(catalog),[catalog]);
 const job=catalog[form.class_id];
 const preview=editorJobPreview(job);
 const nameParts=splitCharacterName(form.name);
 const gameSelected=selectedGameProficiencies(form.proficiencies);
 const playerOwned=Boolean(form.collar_bound);
 const spent=pointsSpent(form);
 const remaining=spent===null?null:BUDGET-spent;
 const issue=firstCreation?creationIssue(form,catalog):'';
 const changed=JSON.stringify(form)!==JSON.stringify(character);
 const title=SECTIONS.find(s=>s[0]===section)?.[1]||'Character';
 const progress=SECTIONS.findIndex(s=>s[0]===section)+1;
 const lockedClass=!firstCreation&&tracked;
 useEffect(()=>{setForm({...character});setSection('identity');setSubmitAttempt(false)},[character.id]);
 function set(name,value){setForm(old=>({...old,[name]:value}))}
 function cancel(){
  if(saving)return;
  if(changed&&!window.confirm('Discard unsaved character changes?'))return;
  onCancel();
 }
 function pickJob(e){if(firstCreation)set('class_id',e.target.value)}
 function setNamePart(part,value){set('name',joinCharacterName(part==='first'?value:nameParts.first,part==='last'?value:nameParts.last))}
 function updateGameProficiency(value,checked){set('proficiencies',updateProficiencySelection(form.proficiencies,value,checked))}
 function updateOtherProficiencies(text){set('proficiencies',[...gameSelected,text.trim()].filter(Boolean).join('\n'))}
 async function submit(e){
  e.preventDefault();
  setSubmitAttempt(true);
  if(issue||nameIssue){if(firstCreation)setSection(issue.includes('ability')||issue.includes('budget')?'attributes':'identity');return;}
  await onSave(form);
 }
 const nameIssue=firstCreation&&(!nameParts.first||!nameParts.last)?'Enter both a first and last name.':'';
 const canSave=!saving&&String(form.name||'').trim()&&(!firstCreation||(!issue&&!nameIssue));
 const fieldSet=(key)=>FIELDS[key].map(([id,label])=><Field key={id} name={id} label={label} form={form} onSet={set} disabled={!canCommand&&NO_EDIT_CREATION.has(id)} />);
 const sectionIndex=SECTIONS.findIndex(s=>s[0]===section);
 return <form className="inline-sheet-editor" onSubmit={submit} noValidate>
  <div className="inline-sheet-top">
   <div><small>{firstCreation?'NEW CHARACTER / CREATION':'CHARACTER DOSSIER / EDITING'}</small><h2>{form.name||'Unnamed character'}</h2>
    <p>{firstCreation?'Build a new character using the Order’s 20-level FFXIV-inspired class rules.':'Update character details. Current XP, class and locked progression values are preserved.'}</p>
   </div>
   <div className="inline-sheet-actions"><button type="button" className="btn secondary" onClick={cancel} disabled={saving}>Cancel</button><button type="submit" className="btn primary" disabled={!canSave}>{saving?'Saving…':firstCreation?'Create character':'Save changes'}</button></div>
  </div>
  <div className="inline-sheet-step-status"><span>SECTION {progress} OF {SECTIONS.length}</span><span>{changed?'Unsaved changes':'No changes to save'}</span></div>
  <nav className="inline-sheet-nav" aria-label="Character editor sections">{SECTIONS.map(([key,label,desc],i)=><button type="button" key={key} className={section===key?'active':''} aria-current={section===key?'step':undefined} onClick={()=>{setSection(key);setSubmitAttempt(false)}}><small>{String(i+1).padStart(2,'0')}</small><strong>{label}</strong><span>{desc}</span></button>)}</nav>
  {section==='identity'&&<section className="panel">
   <SectionTitle number="01" title="Identity and job" description="Choose a job for new characters, then establish their background and place within the Order."/>
   <div className="inline-sheet-grid">
    <label className="inline-field"><span>Combat job</span>
     <select required={firstCreation} value={form.class_id||''} disabled={!firstCreation} onChange={pickJob}>
      <option value="">Choose a job</option>
      {!job&&form.class_id&&<option value={form.class_id}>{form.class_name||form.class_id} · Existing / unavailable</option>}
      {groups.map(group=><optgroup label={group.label} key={group.id}>{group.jobs.map(([id,c])=><option key={id} value={id}>{c.name}</option>)}</optgroup>)}
     </select>
     <small className="inline-help">{firstCreation?'Job is chosen at creation and cannot be changed through ordinary sheet editing.':'Existing characters keep their original job to protect progression and learned abilities.'}</small>
    </label>
    <div className="inline-job-level"><span>Progression</span><strong>Level {firstCreation?1:form.level||1} <small>/ 20</small></strong><small>{firstCreation?'Starts at 0 XP · Earn XP through events':Number(form.level)>=20?'Maximum level reached':(Number(form.experience)||0).toLocaleString()+' XP · Next level '+xpForLevel((Number(form.level)||1)+1).toLocaleString()+' XP'}</small></div>
   </div>
   {firstCreation&&groups.length===0&&<div className="alert" role="alert">The job catalog has not loaded. Creation is unavailable until the server returns the classes. Existing sheets can still be edited.</div>}
   {preview&&<div className="inline-job-preview">
    <div className="inline-job-preview-top"><div><span>JOB OVERVIEW</span><h4>{job.name}</h4><p>{job.description}</p></div><div className="inline-job-meta"><span>{preview.hitDie} Hit die</span><span>{preview.primary} primary</span><span>{preview.style}</span></div></div>
    <div className="inline-job-preview-columns"><div><h5>Starting techniques</h5>{preview.features.length?preview.features.map((f,i)=><div key={i} className="inline-preview-unlock"><strong>{f.name}</strong><p>{f.description||'Unlocked at level 1.'}</p></div>):<p className="muted">No starting features listed.</p>}</div>
    <div><h5>Starting spells</h5>{preview.spells.length?preview.spells.map(s=><div key={s.id} className="inline-preview-unlock"><strong>{s.name} · {s.cost} SP</strong><p>{s.description}</p></div>):<p className="muted">No spells at level 1.</p>}
    <h5>Future milestones</h5><div className="inline-preview-future">{preview.upcoming.map((f,i)=><span key={i}>Lv {f.level} · {f.name}</span>)}</div></div></div>
   </div>}
   <div className="inline-sheet-grid"><div className="inline-field"><span>Character name · first</span><input value={nameParts.first} maxLength={60} required onChange={e=>setNamePart('first',e.target.value)}/></div><div className="inline-field"><span>Character name · last</span><input value={nameParts.last} maxLength={60} required={firstCreation} onChange={e=>setNamePart('last',e.target.value)}/>{!nameParts.last&&!firstCreation&&<small className="inline-help">This older character has a single name on record. A surname can be added without changing other data.</small>}</div>{fieldSet('identity')}<label className="inline-field"><span>Syndicate specialization</span><select value={form.specialty||'Unassigned'} onChange={e=>set('specialty',e.target.value)}>{form.specialty&&!SPECIALIZATIONS.includes(form.specialty)&&<option value={form.specialty}>{form.specialty} · Existing</option>}{SPECIALIZATIONS.map(v=><option value={v} key={v}>{v}</option>)}</select></label><label className="inline-field"><span>Outlook / alignment</span><select value={form.alignment||''} onChange={e=>set('alignment',e.target.value)}><option value="">Not chosen</option>{form.alignment&&!ALIGNMENTS.includes(form.alignment)&&<option value={form.alignment}>{form.alignment} · Existing</option>}{ALIGNMENTS.map(v=><option value={v} key={v}>{v}</option>)}</select></label></div>
  </section>}
  {section==='attributes'&&<section className="panel">
   <SectionTitle number="02" title="Attributes and skills" description="The six standard dice attributes remain in use while our original tabletop rules are developed."/>
   {firstCreation?<div className={'inline-point-banner '+(remaining===null||remaining<0?'over':'')} role="status">
    <div><span>CREATION POINT BUDGET</span><strong>{remaining===null?'Invalid':remaining+' remaining'} <small>/ {BUDGET}</small></strong></div><p>Unbound characters start with 10 in every attribute (+0 modifiers). Raise or lower scores within 8–15 and stay under the 27-point budget.</p></div>:
    <div className="inline-point-banner locked"><div><span>CHARACTER PROGRESSION</span><strong>Level {form.level||1}</strong></div><p>{tracked?'Ability scores and class saving throws are locked after creation. Spend earned ability points from the dossier’s Progression tab.':'This legacy character may retain editable scores until migrated to managed progression.'}</p></div>}
   <div className="inline-abilities">{ATTRIBUTES.map(([key,label])=>{
    const score=Number(form[key]??8);const modifier=Math.floor((score-10)/2);
    return <label key={key}><span>{label}</span><input type="number" min={firstCreation?8:1} max={firstCreation?15:30} disabled={tracked&&!firstCreation} value={form[key]??8} onChange={e=>set(key,Number(e.target.value))}/><small>{modifier>=0?'+':''}{modifier} modifier{firstCreation&&Object.hasOwn(POINT_COST,score)?' · '+POINT_COST[score]+' pts':''}</small></label>})}</div>
   <div className="inline-proficiency-head"><div><h4>Saving throws</h4><p>{firstCreation?'Automatically determined by your chosen job.':'Class saving throws are preserved by progression rules.'}</p></div><div>{preview?.saves.join(' · ')||'Select a job'}</div></div>
   {!firstCreation&&<div className="inline-checkboxes">{ATTRIBUTES.map(([key,label])=><label key={key}><input type="checkbox" checked={Boolean(form.saving_throws?.[key])} disabled={tracked} onChange={e=>set('saving_throws',{...form.saving_throws,[key]:e.target.checked})}/>{label}</label>)}</div>}
   <h4>Skill proficiencies · used in dice checks</h4><p className="muted">A checked skill adds your level-based proficiency bonus to its associated attribute modifier. These bonuses appear on the Classic Sheet and can be applied to skill rolls in Encounters & dice when the GM selects “Use sheet modifier.”</p>
   <div className="inline-checkboxes">{SKILLS.map(skill=><label key={skill}><input type="checkbox" checked={Boolean(form.skills?.[skill])} onChange={e=>set('skills',{...form.skills,[skill]:e.target.checked})}/><span>{skill}<small className="inline-skill-bonus">{formatSigned(skillBonus(form,skill))} check</small></span></label>)}</div>
  </section>}
  {section==='roleplay'&&<section className="panel"><SectionTitle number="03" title="Character story and roleplay" description="These are in-character details only. The player's OOC consent preferences are configured separately under My RP preferences."/><div className="inline-story-warning"><strong>Character knowledge and player consent are different.</strong><p>Character history, fictional relationships and IC restrictions never override the player's boundaries or OOC permissions.</p></div><div className="inline-sheet-grid">{fieldSet('roleplay')}</div></section>}
  {section==='equipment'&&<section className="panel"><SectionTitle number="04" title="Combat record and belongings" description="Class-derived HP and defense, plus personal effects and RP notes. Real equipment and inventories will come from the future economy system."/><p className="muted">HP is determined by job, Constitution and level; Armor Class by Dexterity and job role. Neither value can be edited directly. Combat damage and healing are handled in encounters, not through the sheet editor.</p><div className="inline-computed-stats"><div><span>Current HP</span><strong>{firstCreation?(job?Math.max(1,Number(job.hit_die||8)+Math.floor((Number(form.con??10)-10)/2)):'Choose a job'):form.hp??'—'}</strong></div><div><span>Maximum HP</span><strong>{firstCreation?(job?Math.max(1,Number(job.hit_die||8)+Math.floor((Number(form.con??10)-10)/2)):'Choose a job'):form.max_hp??'—'}</strong></div><div><span>Armor Class</span><strong>{firstCreation?classArmor(form.class_id,job,form):form.armor_class??'—'}</strong></div><div><span>Level</span><strong>{firstCreation?1:form.level||1}</strong></div></div><div className="inline-sheet-grid">{fieldSet('equipment')}</div><section className="inline-game-proficiencies"><h4>Languages, crafting & gathering</h4><p className="muted">Check the FFXIV disciplines and RP languages this character knows. These are descriptive proficiencies, not automatically granted game jobs or inventory items.</p>{['Languages','Crafting','Gathering'].map(group=><div key={group}><h5>{group}</h5><div className="inline-checkboxes">{GAME_PROFICIENCIES.filter(([g])=>g===group).map(([,value])=><label key={value}><input type="checkbox" checked={gameSelected.includes(value)} onChange={e=>updateGameProficiency(value,e.target.checked)}/>{value}</label>)}</div></div>)}<label className="inline-field"><span>Other recorded proficiencies (legacy/freeform)</span><textarea rows={3} value={otherProficiencyNotes(form.proficiencies)} onChange={e=>updateOtherProficiencies(e.target.value)}/></label></section><p className="inline-assign-note">Personal effects are descriptive RP items only. Equipment with combat bonuses, ownership, or economic value will use the future inventory/economy system.</p></section>}
  {section==='assignments'&&<section className="panel"><SectionTitle number="05" title="Order records and assignments" description="Link characters to approved accounts. Roleplay binding changes use their separate player-approved workflow."/><div className="inline-sheet-grid">{fieldSet('assignments')}{playerOwned&&<Field name="owner" label="Assigned-to description" form={form} onSet={set} disabled={!canCommand}/> }
   <label className="inline-field"><span>Binding status</span><input readOnly value={form.collar_bound?(form.rank||'Bound'):'Free / Unbound'}/><small className="inline-help">Not editable from this screen. Use Binding requests for player-approved transitions.</small></label>
   {canCommand&&<label className="inline-field"><span>Linked player account</span><select value={form.player_user_id||''} onChange={e=>set('player_user_id',e.target.value)}><option value="">Unlinked</option>{members.map(m=><option value={m.user_id} key={m.user_id}>{m.display_name||m.email} · {m.email}</option>)}</select></label>}
   {canCommand&&playerOwned&&<label className="inline-field"><span>Assigned handler</span><select value={form.handler_user_id||''} onChange={e=>set('handler_user_id',e.target.value)}><option value="">None</option>{members.filter(m=>['domina','high_command','handler'].includes(m.role)).map(m=><option key={m.user_id} value={m.user_id}>{m.display_name||m.email} · {m.email}</option>)}</select></label>}
   </div><p className="inline-assign-note">Account links are saved through the existing staff assignment endpoint. An approved player must explicitly authorize a binding; changing these fields does not grant IC consent.</p>
  </section>}
  {submitAttempt&&(issue||nameIssue)&&<div className="alert" role="alert">{nameIssue||issue}</div>}
  <footer className="inline-sheet-footer"><div><strong>{firstCreation?'Character creation':'Editing '+(character.name||'character')}</strong><span>{firstCreation?'The class and starting HP are assigned when the server creates the character.':'Unsubmitted changes do not affect the existing character record.'}</span></div><div><button type="button" className="btn secondary" disabled={saving} onClick={cancel}>Cancel</button>{sectionIndex>0&&<button type="button" className="btn secondary" onClick={()=>setSection(SECTIONS[sectionIndex-1][0])}>Previous</button>}{sectionIndex<SECTIONS.length-1&&<button type="button" className="btn secondary" onClick={()=>setSection(SECTIONS[sectionIndex+1][0])}>Next</button>}<button type="submit" className="btn primary" disabled={!canSave}>{saving?'Saving…':firstCreation?'Create character':'Save changes'}</button></div></footer>
 </form>;
}
