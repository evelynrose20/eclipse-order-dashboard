import React,{useEffect,useState} from 'react';
import './inline-sheet.css';

const ABILITIES=[['str','Strength'],['dex','Dexterity'],['con','Constitution'],['int','Intelligence'],['wis','Wisdom'],['cha','Charisma']];
const SKILLS=['Acrobatics','Animal Handling','Arcana','Athletics','Deception','History','Insight','Intimidation','Investigation','Medicine','Nature','Perception','Performance','Persuasion','Religion','Sleight of Hand','Stealth','Survival'];
const SECTIONS=[
 ['Identity & story',[['name','Character name'],['player','Player handle'],['owner','Assigned to'],['specialty','Specialty'],['class_name','Class / job'],['species','Species / race'],['background','Background'],['alignment','Alignment']]],
 ['Combat & progression',[['level','Level'],['experience','Experience'],['hp','Current HP'],['max_hp','Maximum HP'],['temp_hp','Temporary HP'],['armor_class','Armor class'],['speed','Speed'],['proficiency_bonus','Proficiency bonus'],['hit_dice','Hit dice'],['gil','Gil balance']]],
 ['Traits & equipment',[['features','Features & traits'],['proficiencies','Proficiencies & languages'],['spells','Spells & magic'],['inventory','Inventory & equipment'],['conditions','Conditions']]],
 ['Roleplay details',[['personality','Personality'],['ideals','Ideals'],['bonds','Bonds'],['flaws','Flaws'],['notes','Ledger notes']]]
];
const NUMERIC=new Set(['level','experience','hp','max_hp','temp_hp','armor_class','speed','proficiency_bonus','gil']);
const LONG=new Set(['features','proficiencies','spells','inventory','conditions','personality','ideals','bonds','flaws','notes']);
function EditorField({name,label,form,set,disabled}){
 const value=form[name]??'';
 return <label className={'inline-field '+(LONG.has(name)?'long':'')}><span>{label}</span>
 {LONG.has(name)?<textarea rows={4} maxLength={name==='notes'?4000:12000} disabled={disabled} value={value} onChange={e=>set(name,e.target.value)}/>:<input disabled={disabled} type={NUMERIC.has(name)?'number':'text'} min={NUMERIC.has(name)?0:undefined} maxLength={NUMERIC.has(name)?undefined:160} value={value} onChange={e=>set(name,NUMERIC.has(name)?Number(e.target.value):e.target.value)}/>}
 </label>;
}
export default function InlineSheetEditor({character,canCommand,members,onSave,onCancel,saving}){
 const [form,setForm]=useState(()=>({...character}));
 useEffect(()=>setForm({...character}),[character.id]);
 const [section,setSection]=useState('Identity & story');
 function set(name,value){setForm(old=>({...old,[name]:value}))}
 async function submit(e){e.preventDefault();await onSave(form)}
 return <form className="inline-sheet-editor" onSubmit={submit}>
  <div className="inline-sheet-top"><div><small>CHARACTER SHEET EDITOR</small><h2>{form.name||'Character'}</h2><p>Edit the sheet directly. Nothing changes until you save.</p></div><div className="inline-sheet-actions"><button className="btn secondary" type="button" onClick={onCancel} disabled={saving}>Discard edits</button><button className="btn primary" type="submit" disabled={saving||!String(form.name||'').trim()}>{saving?'Saving…':'Save character sheet'}</button></div></div>
  <div className="inline-sheet-nav" role="tablist" aria-label="Character sheet sections">
   {[...SECTIONS.map(s=>s[0]),'Abilities & proficiency'].map(label=><button type="button" key={label} role="tab" aria-selected={section===label} className={section===label?'active':''} onClick={()=>setSection(label)}>{label}</button>)}
  </div>
  {SECTIONS.filter(([key])=>section===key).map(([name,fields])=><section className="panel" key={name}><h3>{name}</h3><div className="inline-sheet-grid">{fields.map(([key,label])=><EditorField key={key} name={key} label={label} form={form} set={set} disabled={!canCommand&&['player','owner','gil'].includes(key)}/>)}</div>
   {name==='Identity & story'&&<div className="inline-sheet-linked">
    <h3>FC assignments</h3><p>Collar status is changed through the separate player-approved Binding requests system, not here.</p>
    <div className="inline-sheet-grid">
     <label className="inline-field"><span>Character status</span><input readOnly value={form.collar_bound?'Bound · '+form.rank:'Free / Unbound'}/></label>
     {canCommand&&<label className="inline-field"><span>Linked player account</span><select value={form.player_user_id||''} onChange={e=>set('player_user_id',e.target.value)}><option value="">Unlinked</option>{members.map(m=><option value={m.user_id} key={m.user_id}>{m.email}</option>)}</select></label>}
     {canCommand&&<label className="inline-field"><span>Assigned Master / Mistress</span><select value={form.handler_user_id||''} onChange={e=>set('handler_user_id',e.target.value)}><option value="">None</option>{members.filter(m=>['domina','high_command','handler'].includes(m.role)).map(m=><option key={m.user_id} value={m.user_id}>{m.email}</option>)}</select></label>}
    </div>
   </div>}
  </section>)}
  {section==='Abilities & proficiency'&&<section className="panel"><h3>Ability scores</h3><div className="inline-abilities">{ABILITIES.map(([key,label])=><label key={key}><span>{label}</span><input type="number" min={1} max={30} value={form[key]??10} onChange={e=>set(key,Number(e.target.value))}/><small>{Math.floor((Number(form[key]||10)-10)/2)>=0?'+':''}{Math.floor((Number(form[key]||10)-10)/2)} modifier</small></label>)}</div><h3>Saving throw proficiency</h3><div className="inline-checkboxes">{ABILITIES.map(([key,label])=><label key={key}><input type="checkbox" checked={Boolean(form.saving_throws?.[key])} onChange={e=>set('saving_throws',{...form.saving_throws,[key]:e.target.checked})}/>{label}</label>)}</div><h3>Skill proficiency</h3><div className="inline-checkboxes">{SKILLS.map(skill=><label key={skill}><input type="checkbox" checked={Boolean(form.skills?.[skill])} onChange={e=>set('skills',{...form.skills,[skill]:e.target.checked})}/>{skill}</label>)}</div></section>}
  <div className="inline-sheet-footer"><span>Edits are saved to the shared character record, subject to account permissions.</span><div><button type="button" className="btn secondary" onClick={onCancel}>Cancel</button><button className="btn primary" disabled={saving} type="submit">{saving?'Saving…':'Save all changes'}</button></div></div>
 </form>;
}
