import React,{useEffect,useState} from 'react';
import './homebrew-classes.css';

const ABILITIES=['str','dex','con','int','wis','cha'];
const EMPTY={name:'',description:'',hit_die:8,primary:'str',saves:['str','con'],casting:'none',features:[],spells:[]};
const validId=id=>/^[a-z][a-z0-9_-]{1,39}$/.test(id);
export default function HomebrewClasses({classes,onRefresh,request}){
 const [id,setId]=useState('');
 const [draft,setDraft]=useState({...EMPTY});
 const [newId,setNewId]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const entries=Object.entries(classes||{}).sort((a,b)=>a[1].name.localeCompare(b[1].name));
 const legacyIds=new Set(['warrior','rogue','mage','healer','ranger','bard']);
 const ffxivEntries=entries.filter(([key,c])=>c.origin==='ffxiv_tabletop'||c.built_in&&!legacyIds.has(key));
 const legacyEntries=entries.filter(([key])=>legacyIds.has(key));
 const customEntries=entries.filter(([key,c])=>!legacyIds.has(key)&&!ffxivEntries.some(([id])=>id===key));
 useEffect(()=>{if(id&&classes?.[id])setDraft({...classes[id],features:(classes[id].features||[]).map(f=>({...f})),spells:(classes[id].spells||[]).map(s=>({...s}))})},[id,classes]);
 function selectClass(next){setId(next);setError('');setMessage('');if(next&&classes[next])setDraft({...classes[next],features:classes[next].features.map(f=>({...f})),spells:classes[next].spells.map(s=>({...s}))})}
 function newClass(){const slug=newId.trim().toLowerCase().replace(/\s+/g,'-');if(!validId(slug)||classes[slug]){setError('Enter a unique class ID using 2–40 lowercase letters, numbers, hyphens or underscores.');return}setId(slug);setDraft({...EMPTY,features:[{level:1,name:'Class Training',description:''}]});setNewId('');setError('');setMessage('')}
 const field=(key,val)=>setDraft(d=>({...d,[key]:val}));
 const updateRow=(group,index,key,value)=>setDraft(d=>({...d,[group]:d[group].map((row,i)=>i===index?{...row,[key]:value}:row)}));
 const removeRow=(group,index)=>setDraft(d=>({...d,[group]:d[group].filter((_,i)=>i!==index)}));
 async function save(event){
  event.preventDefault();setBusy(true);setError('');setMessage('');
  try{
   if(draft.casting==='none'&&draft.spells.length)throw Error('Non-caster classes cannot have spell unlocks. Change the casting type or remove their spells.');
   if(new Set(draft.spells.map(s=>s.id)).size!==draft.spells.length)throw Error('Each spell must have a unique ID within its class.');
   await request('/classes/'+id,{method:'PUT',body:draft});
   await onRefresh();setMessage('Class progression and spell unlocks saved.');
  }catch(err){setError(err.message)}finally{setBusy(false)}
 }
 return <div className="homebrew-workspace">
  <section className="panel"><div className="panel-heading"><div><h2>Class Workshop · FFXIV Jobs</h2><p>Adapted FFXIV jobs use 20 character levels, with tabletop techniques and spells. Existing legacy classes remain available for older characters. Saving affects future unlock checks; it does not reset character XP or levels.</p></div></div>
   <div className="class-library-toolbar"><label className="field"><span>EDIT CLASS</span><select value={id} onChange={e=>selectClass(e.target.value)}><option value="">Choose a class</option><optgroup label="FFXIV jobs (levels 1–20)">{ffxivEntries.map(([key,c])=><option value={key} key={key}>{c.name}</option>)}</optgroup><optgroup label="Original legacy classes">{legacyEntries.map(([key,c])=><option value={key} key={key}>{c.name} · Legacy</option>)}</optgroup>{customEntries.length>0&&<optgroup label="Custom classes">{customEntries.map(([key,c])=><option value={key} key={key}>{c.name}</option>)}</optgroup>}</select></label>
    <label className="field"><span>NEW CLASS ID</span><input value={newId} onChange={e=>setNewId(e.target.value)} placeholder="e.g. rune-knight" maxLength={40}/></label>
    <button type="button" className="btn secondary" onClick={newClass}>Create new class</button>
   </div>
   <p className="muted">Includes every standard combat job, including Viper and Pictomancer, plus simplified Blue Mage and Beastmaster options. Each job has its own milestone techniques through level 20. Legacy templates are intentionally preserved for existing characters.</p>
  </section>
  {id&&<form onSubmit={save} className="homebrew-editor">
   <section className="panel"><div className="panel-heading"><div><h2>{draft.name||'New class'} · {id}</h2><p>Define class identity, HP growth, proficiencies and magical resources.</p></div><button className="btn primary" type="submit" disabled={busy}>{busy?'Saving…':'Save class'}</button></div>
    <div className="homebrew-fields">
     <label className="field"><span>CLASS NAME</span><input required maxLength={80} value={draft.name||''} onChange={e=>field('name',e.target.value)}/></label>
     <label className="field"><span>HIT DIE</span><select value={draft.hit_die} onChange={e=>field('hit_die',Number(e.target.value))}>{[6,8,10,12].map(n=><option key={n} value={n}>d{n}</option>)}</select></label>
     <label className="field"><span>PRIMARY ABILITY</span><select value={draft.primary} onChange={e=>field('primary',e.target.value)}>{ABILITIES.map(a=><option key={a} value={a}>{a.toUpperCase()}</option>)}</select></label>
     <label className="field"><span>SAVING THROW 1</span><select value={draft.saves?.[0]||'str'} onChange={e=>field('saves',[e.target.value,draft.saves?.[1]||'con'])}>{ABILITIES.map(a=><option key={a} value={a}>{a.toUpperCase()}</option>)}</select></label>
     <label className="field"><span>SAVING THROW 2</span><select value={draft.saves?.[1]||'con'} onChange={e=>field('saves',[draft.saves?.[0]||'str',e.target.value])}>{ABILITIES.map(a=><option key={a} value={a}>{a.toUpperCase()}</option>)}</select></label>
     <label className="field"><span>CASTING STYLE</span><select value={draft.casting} onChange={e=>field('casting',e.target.value)}><option value="none">No spells</option><option value="half">Half caster</option><option value="full">Full caster</option></select></label>
     <label className="field homebrew-wide"><span>CLASS DESCRIPTION</span><textarea required rows={3} maxLength={900} value={draft.description||''} onChange={e=>field('description',e.target.value)}/></label>
    </div>
   </section>
   <section className="panel"><div className="panel-heading"><div><h3>Class features and abilities</h3><p>Features become available automatically when a character reaches the specified level.</p></div><button type="button" className="mini-btn" onClick={()=>field('features',[...(draft.features||[]),{level:1,name:'',description:''}])}>+ Add feature</button></div>
    <div className="homebrew-rows">{(draft.features||[]).map((feature,i)=><div className="homebrew-row" key={i}>
      <label>LVL<input type="number" min={1} max={20} required value={feature.level} onChange={e=>updateRow('features',i,'level',Number(e.target.value))}/></label>
      <label>FEATURE<input required maxLength={90} value={feature.name} onChange={e=>updateRow('features',i,'name',e.target.value)}/></label>
      <label className="homebrew-row-description">DETAILS<input maxLength={900} value={feature.description||''} onChange={e=>updateRow('features',i,'description',e.target.value)}/></label>
      <button type="button" className="mini-btn danger" onClick={()=>removeRow('features',i)}>Remove</button>
     </div>)}</div>
   </section>
   <section className="panel"><div className="panel-heading"><div><h3>Spells and level unlocks</h3><p>Spells unlock at the listed character level. Casting spends spell points; a long rest restores them. Spell effects remain GM-adjudicated rather than automatically changing HP.</p></div><button type="button" className="mini-btn" disabled={draft.casting==='none'} onClick={()=>field('spells',[...(draft.spells||[]),{id:'',name:'',level:1,cost:1,description:''}])}>+ Add spell</button></div>
    {draft.casting==='none'&&<p className="muted">Select Half caster or Full caster to add spells.</p>}
    <div className="homebrew-rows">{(draft.spells||[]).map((spell,i)=><div className="homebrew-row spell" key={i}>
     <label>LVL<input type="number" min={1} max={20} required value={spell.level} onChange={e=>updateRow('spells',i,'level',Number(e.target.value))}/></label>
     <label>COST<input type="number" min={1} max={12} required value={spell.cost} onChange={e=>updateRow('spells',i,'cost',Number(e.target.value))}/></label>
     <label>SPELL ID<input required pattern="[a-z][a-z0-9_-]{1,39}" title="Lowercase ID, 2–40 characters" value={spell.id} onChange={e=>updateRow('spells',i,'id',e.target.value)}/></label>
     <label>NAME<input required maxLength={90} value={spell.name} onChange={e=>updateRow('spells',i,'name',e.target.value)}/></label>
     <label className="homebrew-row-description">EFFECT<input required maxLength={1200} value={spell.description} onChange={e=>updateRow('spells',i,'description',e.target.value)}/></label>
     <button type="button" className="mini-btn danger" onClick={()=>removeRow('spells',i)}>Remove</button>
    </div>)}</div>
   </section>
   <section className="panel"><h3>Level 1–20 preview</h3><div className="class-level-list">{Array.from({length:20},(_,i)=>i+1).map(level=><div className="class-level-row" key={level}><strong>Level {level}</strong><div>{(draft.features||[]).filter(f=>Number(f.level)===level).map((f,i)=><span key={'f'+i}>{f.name||'Unnamed feature'}</span>)}{(draft.spells||[]).filter(s=>Number(s.level)===level).map((spell,i)=><span key={'s'+i} className="spell-unlock">{spell.name||'Unnamed spell'} · {spell.cost} SP</span>)}{!(draft.features||[]).some(f=>Number(f.level)===level)&&!(draft.spells||[]).some(s=>Number(s.level)===level)&&<em className="muted">No class unlock</em>}</div></div>)}</div>
    <button className="btn primary" type="submit" disabled={busy}>{busy?'Saving…':'Save class progression'}</button>
   </section>
  </form>}
  {error&&<div className="alert" role="alert">{error}</div>}{message&&<div className="alert" role="status">{message}</div>}
 </div>;
}
