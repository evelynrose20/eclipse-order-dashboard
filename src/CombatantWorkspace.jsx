import React,{useEffect,useMemo,useState} from 'react';
import {addCombatant,editCombatant,deleteCombatant,adjustCombatantHP,listMonsterTemplates,createMonsterTemplate,updateMonsterTemplate,deleteMonsterTemplate,addMonsterToEncounter} from './apiBridge.js';
import './combatant-workspace.css';

const SIDES=[
 {id:'player',name:'Player characters',short:'Players',symbol:'user'},
 {id:'ally',name:'NPC allies',short:'NPC allies',symbol:'user-shield'},
 {id:'npc',name:'Enemies',short:'Enemies',symbol:'skull'}
];
const CONDITIONS=['Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious','Exhaustion'];
const freshTemplate=()=>({name:'',challenge:'Custom',hit_points:20,armor_class:10,initiative_bonus:0,actions:'',notes:''});
const labelKind=kind=>SIDES.find(x=>x.id===kind)?.name||'Combatant';

function CombatantRow({combatant,active,canDirect,working,action}){
 const [expanded,setExpanded]=useState(false);
 const [amount,setAmount]=useState(5);
 const [draft,setDraft]=useState(combatant);
 const hp=Number(combatant.hp)||0,max=Math.max(1,Number(combatant.max_hp)||1);
 useEffect(()=>{if(!expanded)setDraft(combatant)},[combatant,expanded]);
 async function save(){const result=await action(()=>editCombatant(combatant.id,Number(draft.hp),Number(draft.initiative),Number(draft.ac),draft.conditions||[]));if(result)setExpanded(false)}
 function toggle(condition){setDraft(old=>({...old,conditions:(old.conditions||[]).includes(condition)?old.conditions.filter(c=>c!==condition):[...(old.conditions||[]),condition]}))}
 return <article className={'combat-roster-card side-'+combatant.kind+(active?' acting':'')}>
  <div className="combat-roster-main">
   <div className="combat-roster-init"><span>INIT</span><strong>{combatant.initiative}</strong></div>
   <div className="combat-roster-profile">
    <div className="combat-roster-name"><strong>{combatant.name}</strong>{active&&<span className="combat-now-playing">Acting</span>}</div>
    <span className="combat-roster-side">{labelKind(combatant.kind)}{combatant.kind==='ally'?' · DM controlled':''}</span>
    <div className="combat-roster-life"><span className="combat-roster-life-bar"><span style={{width:Math.max(0,Math.min(100,hp/max*100))+'%'}}/></span><small>{hp} / {max} HP</small><small>AC {combatant.ac}</small></div>
    {combatant.conditions?.length>0&&<div className="combat-roster-condition-list">{combatant.conditions.map(c=><span key={c}>{c}</span>)}</div>}
   </div>
   {canDirect&&<div className="combat-roster-quick"><label className="combat-hp-amount"><span>AMOUNT</span><input type="number" min="1" max="999999" value={amount} onChange={e=>setAmount(Math.max(1,Number(e.target.value)||1))}/></label><button type="button" className="combat-damage" disabled={working} onClick={()=>action(()=>adjustCombatantHP(combatant.id,-amount))}>− Damage</button><button type="button" className="combat-heal" disabled={working} onClick={()=>action(()=>adjustCombatantHP(combatant.id,amount))}>+ Heal</button></div>}
   <button type="button" className="combat-row-expand" aria-expanded={expanded} onClick={()=>setExpanded(x=>!x)}>{expanded?'Close':'Details'} <span aria-hidden="true">{expanded?'⌃':'⌄'}</span></button>
  </div>
  {expanded&&<div className="combat-roster-details">
   {combatant.actions&&<section className="combat-roster-abilities"><h4>Attacks & abilities</h4><p>{combatant.actions}</p></section>}
   {combatant.notes&&canDirect&&<section className="combat-roster-abilities"><h4>GM notes</h4><p>{combatant.notes}</p></section>}
   {canDirect&&<>
    <div className="combat-roster-edit-fields">
     <label>Current HP<input type="number" min="0" max={max} value={draft.hp} onChange={e=>setDraft(v=>({...v,hp:Number(e.target.value)}))}/></label>
     <label>Initiative<input type="number" min="-100" max="100" value={draft.initiative} onChange={e=>setDraft(v=>({...v,initiative:Number(e.target.value)}))}/></label>
     <label>Armor Class<input type="number" min="0" max="99" value={draft.ac} onChange={e=>setDraft(v=>({...v,ac:Number(e.target.value)}))}/></label>
    </div>
    <fieldset className="combat-conditions"><legend>Conditions</legend><div>{CONDITIONS.map(c=><label key={c} className={'combat-condition-chip '+((draft.conditions||[]).includes(c)?'selected':'')}><input type="checkbox" checked={(draft.conditions||[]).includes(c)} onChange={()=>toggle(c)}/>{c}</label>)}</div></fieldset>
    <div className="combat-roster-edit-actions"><button type="button" className="btn primary" disabled={working} onClick={save}>Save changes</button><button type="button" className="btn secondary" onClick={()=>{setDraft(combatant);setExpanded(false)}}>Cancel</button><button type="button" className="combat-remove" disabled={working} onClick={()=>{if(window.confirm('Remove '+combatant.name+' from this encounter?'))action(()=>deleteCombatant(combatant.id))}}>Remove from encounter</button></div>
   </>}
  </div>}
 </article>;
}

export default function CombatantWorkspace({encounter,characters=[],canDirect,working,action}){
 const [filter,setFilter]=useState('all');
 const [adding,setAdding]=useState(false);
 const [kind,setKind]=useState('ally');
 const [name,setName]=useState('');
 const [charId,setCharId]=useState('');
 const [initiative,setInitiative]=useState(10);
 const [hp,setHp]=useState(20);
 const [ac,setAc]=useState(10);
 const [libraryOpen,setLibraryOpen]=useState(false);
 const [templates,setTemplates]=useState([]);
 const [selectedTemplate,setSelectedTemplate]=useState('');
 const [templateSide,setTemplateSide]=useState('ally');
 const [templateEditor,setTemplateEditor]=useState(false);
 const [editingTemplate,setEditingTemplate]=useState(null);
 const [templateForm,setTemplateForm]=useState(freshTemplate);
 const [libraryError,setLibraryError]=useState('');
 const combatants=encounter.combatants||[];
 const counts=useMemo(()=>Object.fromEntries(SIDES.map(x=>[x.id,combatants.filter(c=>c.kind===x.id).length])),[combatants]);
 const filtered=combatants.filter(c=>filter==='all'||c.kind===filter);
 async function loadTemplates(){try{setTemplates(await listMonsterTemplates());setLibraryError('')}catch(e){setLibraryError(e.message)}}
 useEffect(()=>{if(canDirect)loadTemplates()},[canDirect]);
 async function submitCombatant(e){
  e.preventDefault();
  const character=characters.find(c=>c.id===charId);
  if(kind==='player'&&!character)return;
  const id=await action(()=>addCombatant(encounter.id,kind==='player'?character.name:name,kind,kind==='player'?charId:null,Number(initiative),Number(hp),Number(ac)));
  if(id){setName('');setCharId('');setAdding(false)}
 }
 async function useTemplate(){
  if(!selectedTemplate)return;
  const result=await action(()=>addMonsterToEncounter(encounter.id,selectedTemplate,templateSide));
  if(result){setLibraryOpen(false);setAdding(false)}
 }
 async function saveTemplate(e){
  e.preventDefault();
  const result=await action(()=>editingTemplate?updateMonsterTemplate(editingTemplate,templateForm):createMonsterTemplate(templateForm));
  if(result){setTemplateEditor(false);setEditingTemplate(null);setTemplateForm(freshTemplate());await loadTemplates()}
 }
 async function deleteTemplate(){
  if(!selectedTemplate||!window.confirm('Delete this saved stat block? Combatants already in encounters will remain.'))return;
  const result=await action(()=>deleteMonsterTemplate(selectedTemplate));
  if(result){setSelectedTemplate('');await loadTemplates()}
 }
 return <section className="combat-workspace">
  <div className="combat-workspace-header"><div><span className="combat-eyebrow">ENCOUNTER ROSTER</span><h2>Combatants</h2><p>Manage the party, friendly NPCs, and opposition.</p></div>
   {canDirect&&<div className="combat-workspace-actions"><button type="button" className="btn secondary" aria-expanded={libraryOpen} onClick={()=>setLibraryOpen(x=>!x)}>Stat-block library</button><button type="button" className="btn primary" aria-expanded={adding} onClick={()=>{setAdding(x=>!x);setLibraryOpen(false)}}>{adding?'Close':'＋ Add combatant'}</button></div>}
  </div>
  <div className="combat-roster-summary" role="group" aria-label="Combatant sides">
   <button type="button" className={'combat-summary-tile '+(filter==='all'?'active':'')} aria-pressed={filter==='all'} onClick={()=>setFilter('all')}><span>All combatants</span><strong>{combatants.length}</strong></button>
   {SIDES.map(side=><button type="button" key={side.id} className={'combat-summary-tile side-'+side.id+' '+(filter===side.id?'active':'')} aria-pressed={filter===side.id} onClick={()=>setFilter(side.id)}><span><i className={'fa-solid fa-'+side.symbol}/> {side.name}</span><strong>{counts[side.id]}</strong></button>)}
  </div>
  {canDirect&&adding&&<form className="combat-add-panel" onSubmit={submitCombatant}>
   <div className="combat-panel-title"><h3>Add to encounter</h3><span>Controlled by the DM unless linked to a player character</span></div>
   <div className="combat-side-picker" role="group" aria-label="Combatant type">{SIDES.map(side=><button key={side.id} type="button" className={'combat-side-choice side-'+side.id+' '+(kind===side.id?'selected':'')} aria-pressed={kind===side.id} onClick={()=>setKind(side.id)}><span><i className={'fa-solid fa-'+side.symbol}/></span><strong>{side.name}</strong></button>)}</div>
   <div className="combat-add-fields">
    {kind==='player'?<label>Player character<select required value={charId} onChange={e=>{const v=e.target.value;const c=characters.find(x=>x.id===v);setCharId(v);if(c){setHp(c.max_hp||c.hp||20);setAc(c.armor_class||10)}}}><option value="">Select character</option>{characters.filter(c=>c.view_mode!=='bound'&&c.player_user_id).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>:<label>Name<input required maxLength={120} placeholder={kind==='ally'?'e.g. Order Guardian':'e.g. Ashen Marauder'} value={name} onChange={e=>setName(e.target.value)}/></label>}
    <label>Initiative<input required type="number" min="-100" max="100" value={initiative} onChange={e=>setInitiative(e.target.value)}/></label>
    <label>Max HP<input required type="number" min="1" max="999999" value={hp} onChange={e=>setHp(e.target.value)}/></label>
    <label>Armor Class<input required type="number" min="0" max="99" value={ac} onChange={e=>setAc(e.target.value)}/></label>
   </div>
   <div className="combat-add-actions"><button type="submit" className="btn primary" disabled={working||kind==='player'&&!charId}>Add {kind==='ally'?'NPC ally':kind==='npc'?'enemy':'player character'}</button><button type="button" className="btn secondary" onClick={()=>setAdding(false)}>Cancel</button></div>
  </form>}
  {canDirect&&libraryOpen&&<section className="combat-library-panel">
   <div className="combat-panel-title"><h3>Stat-block library</h3><button type="button" className="btn secondary" onClick={()=>{setEditingTemplate(null);setTemplateForm(freshTemplate());setTemplateEditor(x=>!x)}}>{templateEditor?'Close editor':'＋ New stat block'}</button></div>
   {libraryError&&<p role="alert">{libraryError}</p>}
   <div className="combat-library-picker"><label>Saved creature<select value={selectedTemplate} onChange={e=>setSelectedTemplate(e.target.value)}><option value="">Select stat block</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name} · {t.hit_points} HP · AC {t.armor_class}</option>)}</select></label><label>Join as<select value={templateSide} onChange={e=>setTemplateSide(e.target.value)}><option value="ally">NPC ally</option><option value="npc">Enemy</option></select></label><button type="button" className="btn primary" disabled={!selectedTemplate||working} onClick={useTemplate}>Add to encounter</button></div>
   {selectedTemplate&&templates.filter(t=>t.id===selectedTemplate).map(t=><div className="combat-template-preview" key={t.id}><div><strong>{t.name}</strong><small>CR {t.challenge} · HP {t.hit_points} · AC {t.armor_class} · Initiative {t.initiative_bonus}</small></div><p>{t.actions||'No attacks listed.'}</p><div><button type="button" className="btn secondary" onClick={()=>{setEditingTemplate(t.id);setTemplateForm({name:t.name,challenge:t.challenge,hit_points:t.hit_points,armor_class:t.armor_class,initiative_bonus:t.initiative_bonus,actions:t.actions||'',notes:t.notes||''});setTemplateEditor(true)}}>Edit stat block</button><button type="button" className="combat-remove" disabled={working} onClick={deleteTemplate}>Delete stat block</button></div></div>)}
   {templateEditor&&<form className="combat-template-form" onSubmit={saveTemplate}>
    {[['name','Name','text'],['challenge','Challenge','text'],['hit_points','Max HP','number'],['armor_class','Armor Class','number'],['initiative_bonus','Initiative bonus','number']].map(([field,title,type])=><label key={field}>{title}<input required type={type} value={templateForm[field]} onChange={e=>setTemplateForm(v=>({...v,[field]:e.target.value}))}/></label>)}
    <label className="combat-template-wide">Attacks & abilities<textarea rows={3} maxLength={2500} value={templateForm.actions} onChange={e=>setTemplateForm(v=>({...v,actions:e.target.value}))}/></label>
    <label className="combat-template-wide">GM notes<textarea rows={3} maxLength={2500} value={templateForm.notes} onChange={e=>setTemplateForm(v=>({...v,notes:e.target.value}))}/></label>
    <button className="btn primary" disabled={working} type="submit">{editingTemplate?'Save stat block':'Create stat block'}</button>
   </form>}
  </section>}
  <div className="combat-roster-list-heading"><h3>{filter==='all'?'All combatants':labelKind(filter)}</h3><span>{filtered.length} in encounter</span></div>
  <div className="combat-roster-list">{filtered.length?filtered.map((c,i)=><CombatantRow key={c.id} combatant={c} active={encounter.status==='active'&&combatants.findIndex(x=>x.id===c.id)===encounter.turn_index%Math.max(1,combatants.length)} canDirect={canDirect} working={working} action={action}/>):<div className="combat-roster-empty"><strong>No combatants in this group</strong><p>{canDirect?'Add a combatant to prepare the encounter.':'The DM has not added combatants here.'}</p></div>}</div>
 </section>;
}
