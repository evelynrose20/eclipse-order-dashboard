import React,{useEffect,useState} from 'react';
import './workshop.css';

const ICON={ore:'⛏',herb:'❧',botanical:'✿',refined:'◆',supply:'▣'};
const slug=value=>value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 -]/g,'').trim().replace(/\s+/g,'-').slice(0,48);
const CATEGORIES=['ore','herb','botanical','refined','supply'];
const initialMaterial={name:'',category:'herb',description:''};
const initialRecipe={name:'',description:'',output_material:'',output_quantity:1,minimum_level:1,inputs:[{material_id:'',quantity:1}]};

export default function Workshop({request,characters=[],canManage=false,readOnly=false}){
 const [data,setData]=useState(null);
 const [characterId,setCharacterId]=useState('');
 const [tab,setTab]=useState('garden');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [selectedMaterial,setSelectedMaterial]=useState('');
 const [zones,setZones]=useState([]);
 const [selectedZone,setSelectedZone]=useState('');
 const [zoneEditor,setZoneEditor]=useState(null);
 const [recipeLevelEditor,setRecipeLevelEditor]=useState(null);
 const [expeditionApproach,setExpeditionApproach]=useState('steady');
 const [allowMature,setAllowMature]=useState(false);
 const [encounterData,setEncounterData]=useState({active:null,scenarios:[]});
 const [encounterMessage,setEncounterMessage]=useState('');
 const [encounterEditor,setEncounterEditor]=useState(null);
 const [selectedRecipe,setSelectedRecipe]=useState('');
 const [craftQty,setCraftQty]=useState(1);
 const [staged,setStaged]=useState([]);
 const [reveal,setReveal]=useState(null);
 const [catalog,setCatalog]=useState(null);
 const [materialDraft,setMaterialDraft]=useState(initialMaterial);
 const [recipeDraft,setRecipeDraft]=useState(initialRecipe);
 const [crop,setCrop]=useState('');
 const [search,setSearch]=useState('');
 const canAct=!!characterId&&!readOnly;
 const command=canManage&&!readOnly;
 async function refresh(){const [workshop,encounters,areas]=await Promise.all([request('/workshop'),request('/workshop/encounters'),request('/workshop/zones')]);setData(workshop);setEncounterData(encounters);setZones(areas.zones||[])}
 useEffect(()=>{refresh().catch(e=>setError(e.message))},[]);
 useEffect(()=>{if(!characterId&&characters.length)setCharacterId(characters[0].id)},[characters,characterId]);
 const materials=data?.materials||[];
 const recipes=data?.recipes||[];
 const gatherables=materials.filter(m=>['ore','herb'].includes(m.category));
 const currentZone=zones.find(z=>z.id===selectedZone)||zones[0];
 const zoneResources=(currentZone?.materials||[]).map(entry=>({...entry,...materials.find(m=>m.id===entry.material_id)}));
 const selected=zoneResources.find(m=>m.material_id===selectedMaterial)||zoneResources[0];
 const characterLevel=Math.max(1,Number(characters.find(c=>c.id===characterId)?.level)||1);
 const canVisit=!!currentZone&&characterLevel>=Number(currentZone.minimum_level);
 const resourceAllowed=!!selected&&canVisit&&characterLevel>=Number(selected.minimum_level);
 const recipe=recipes.find(r=>r.id===selectedRecipe)||recipes[0];
 const stock=id=>Number(materials.find(m=>m.id===id)?.quantity||0);
 const name=id=>materials.find(m=>m.id===id)?.name||id;
 const gatherLeft=Math.max(0,Number(data?.expedition_limit||5)-(data?.expeditions?.length||0));
 async function run(path,body,label,onSuccess){
  setBusy(true);setError('');setNotice('');
  try{
   const result=await request(path,{method:'POST',body});
   await refresh();
   setNotice(label);
   onSuccess?.(result);
  }catch(e){setError(String(e.message||e))}
  finally{setBusy(false)}
 }
 const doGather=()=>run('/workshop/gather',{zone_id:currentZone?.id,material_id:selected?.material_id,character_id:characterId,approach:expeditionApproach,allow_mature:allowMature},
  'The expedition has begun.',r=>{setEncounterMessage('');if(r.status!=='encounter')setReveal({type:'gather',name:selected.name,quantity:r.quantity})});
 const resolveEncounter=action=>run('/workshop/encounters/'+encounterData.active.id+'/action',{action},'',r=>{setEncounterMessage(r.message);if(r.status!=='active')setReveal({type:'gather',name:name(r.material_id),quantity:r.quantity,encounterText:r.message})});
 const scenarioEmpty=()=>({name:'',kind:'wildlife',description:'',outcome_text:'',failure_text:'You are defeated and return to the estate.',retreat_text:'You retreat and leave the supplies behind.',decline_text:'You politely decline and continue safely.',weight:10,enemy_health:8,enemy_defense:10,enabled:true});
 const saveScenario=async()=>{if(!encounterEditor)return;const id=encounterEditor.id||slug(encounterEditor.name);const editing=Boolean(encounterEditor.id);const body={...encounterEditor,weight:Number(encounterEditor.weight),enemy_health:Number(encounterEditor.enemy_health),enemy_defense:Number(encounterEditor.enemy_defense)};setBusy(true);setError('');try{await request('/workshop/encounters/scenarios'+(editing?'/'+id:''),{method:editing?'PUT':'POST',body:editing?body:{...body,id}});await refresh();setEncounterEditor(null);setNotice('Encounter scenario saved.')}catch(e){setError(e.message)}finally{setBusy(false)}};
 const doCraft=()=>run('/workshop/craft',{recipe_id:recipe.id,quantity:Number(craftQty),character_id:characterId},
  'The workshop has delivered its finished goods to the shared stores.',r=>{setStaged([]);setReveal({type:'craft',name:name(recipe.output_material),quantity:r.quantity*recipe.output_quantity})});
 const canCraft=recipe&&characterLevel>=Number(recipe.minimum_level||1)&&recipe.inputs.every(i=>stock(i.material_id)>=i.quantity*craftQty&&staged.includes(i.material_id))&&canAct;
 const createMaterial=()=>{const id=slug(materialDraft.name);run('/workshop/catalog/materials',{id,...materialDraft},'New material added to the Order catalog.',()=>{setMaterialDraft(initialMaterial);setCatalog(null)})};
 const createRecipe=()=>{const id=slug(recipeDraft.name);run('/workshop/catalog/recipes',{id,...recipeDraft,minimum_level:Number(recipeDraft.minimum_level),output_quantity:Number(recipeDraft.output_quantity),inputs:recipeDraft.inputs.map(i=>({...i,quantity:Number(i.quantity)}))},'New recipe added to the Order workshop.',()=>{setRecipeDraft(initialRecipe);setCatalog(null)})};
 const createPlot=()=>run('/workshop/catalog/plots',{crop_material:crop},'A new garden plot has been planted.',()=>setCatalog(null));
 const newZone=()=>({name:'',description:'',minimum_level:1,danger:'low',enabled:true,sort_order:100,materials:[]});
 const saveZone=async()=>{
  if(!zoneEditor)return;
  const editing=!!zoneEditor.id,id=editing?zoneEditor.id:slug(zoneEditor.name);
  const body={...zoneEditor,id,minimum_level:Number(zoneEditor.minimum_level),sort_order:Number(zoneEditor.sort_order),
   materials:zoneEditor.materials.map(m=>({...m,minimum_level:Number(m.minimum_level)}))};
  setBusy(true);setError('');
  try{
   await request('/workshop/zones'+(editing?'/'+id:''),{method:editing?'PUT':'POST',body});
   await refresh();setSelectedZone(id);setZoneEditor(null);setNotice('Expedition zone saved.');
  }catch(e){setError(e.message)}finally{setBusy(false)}
 };
 const saveRecipeLevel=async()=>{
  if(!recipeLevelEditor)return;
  setBusy(true);setError('');
  try{await request('/workshop/catalog/recipes/'+recipeLevelEditor.id+'/level',{method:'PUT',body:{minimum_level:Number(recipeLevelEditor.minimum_level)}});
   await refresh();setRecipeLevelEditor(null);setNotice('Crafting level requirement saved.');
  }catch(e){setError(e.message)}finally{setBusy(false)}
 };
 const nav=[['garden','The Garden','✿'],['gather','Expeditions','⛏'],['craft','The Workshop','⚒'],['stores','FC Stores','▣']];
 return <section className="fc-workshop fc-play">
  <header className="fc-play-banner">
   <div><span className="fc-play-eyebrow">THE ECLIPSE ORDER · ESTATE GROUNDS</span><h2>The Order's Living Workshop</h2><p>Raise the garden together. Venture into the wilds. Bring every resource home to the same storeroom.</p></div>
   <div className="fc-play-seal" aria-hidden="true">✦<small>EO</small></div>
  </header>
  {error&&<p className="alert" role="alert">{error.replaceAll('_',' ')}</p>}
  {notice&&<p className="fc-workshop-notice" role="status">✦ {notice}</p>}
  {!data?<div className="fc-scene">Opening the estate workshop…</div>:<>
   <div className="fc-play-overview">
    <div><span>COMMON STORES</span><strong>{materials.reduce((n,m)=>n+Number(m.quantity),0)}</strong><small>shared supplies</small></div>
    <div><span>GARDEN</span><strong>Lv. {data.garden.level}</strong><small>{data.plots.length} planted plots</small></div>
    <div><span>WILDERNESS</span><strong>{gatherLeft} / {data.expedition_limit}</strong><small>expeditions remaining today</small></div>
   </div>
   <nav className="fc-play-nav" aria-label="Workshop locations">{nav.map(([id,title,mark])=><button key={id} type="button" className={tab===id?'active':''} aria-current={tab===id?'page':undefined} onClick={()=>{setTab(id);setReveal(null);setError('')}}><span aria-hidden="true">{mark}</span>{title}</button>)}{command&&<><button type="button" className="fc-play-manage" onClick={()=>setZoneEditor(newZone())}>✦ Expedition zones</button><button type="button" className="fc-play-manage" onClick={()=>setCatalog('menu')}>✚ Expand catalog</button><button type="button" className="fc-play-manage" onClick={()=>setEncounterEditor(scenarioEmpty())}>⚔ Encounters</button></>}</nav>
   {tab!=='stores'&&<div className="fc-play-actor"><span>ACTIVE CHARACTER · LEVEL {characterLevel}</span><select aria-label="Choose character" value={characterId} onChange={e=>setCharacterId(e.target.value)}><option value="">Choose a character</option>{characters.map(c=><option key={c.id} value={c.id}>{c.name||c.character_name}</option>)}</select></div>}
   {tab==='garden'&&<div className="fc-scene">
    <div className="fc-scene-title"><div><span>THE GLASSHOUSE</span><h3>Every hand helps it flourish</h3><p>Each member needs an assigned character sheet to water or tend a plot once per day. Growth is shared; mature harvests go straight to FC stores.</p></div><div className="fc-garden-badge">✿ <strong>Garden {data.garden.level}</strong></div></div>
    <div className="fc-garden-world">{data.plots.map(plot=><article className="fc-garden-bed" key={plot.id}>
      <div className="fc-bed-sky"><div className="fc-bed-glow"/><div className={'fc-bed-plant '+(plot.crop_material==='hellshade-bloom'?'hellshade ':'')+'stage-'+(plot.growth>=100?'grown':plot.growth>=50?'growing':'seedling')} aria-hidden="true">{plot.growth>=100?'✿':plot.growth>=50?'❀':'♧'}</div><div className="fc-bed-earth"/></div>
      <div className="fc-bed-content"><span>GARDEN BED {plot.id}</span><h4>{name(plot.crop_material)}</h4>
       <div className="fc-bed-meter"><label>Growth <strong>{plot.growth}%</strong></label><div><span style={{width:plot.growth+'%'}}/></div></div>
       <div className="fc-bed-meter healthy"><label>Health <strong>{plot.health}%</strong></label><div><span style={{width:plot.health+'%'}}/></div></div>
       <p>{plot.cared_today?'You have cared for this bed today. Return tomorrow to help it grow again.':plot.growth>=100?'Ready to harvest!':plot.growth>=65?'Growing beautifully.':plot.growth>=25?'New shoots are taking root.':'A seedling needs the Order’s care.'}</p><small className="fc-garden-helpers">{plot.helpers_today||0} member{Number(plot.helpers_today)===1?'':'s'} helped today</small>
       <div className="fc-bed-actions"><button type="button" disabled={!canAct||busy||plot.cared_today} onClick={()=>run('/workshop/garden/'+plot.id+'/care',{character_id:characterId,action:'water'},'You watered the garden bed.')}>☂ Water</button><button type="button" disabled={!canAct||busy||plot.cared_today} onClick={()=>run('/workshop/garden/'+plot.id+'/care',{character_id:characterId,action:'tend'},'The garden bed has been tended.')}>❧ Tend</button></div>
       <button className="fc-harvest-button" type="button" disabled={!canAct||busy||plot.growth<100||plot.health<40} onClick={()=>run('/workshop/garden/'+plot.id+'/harvest',{character_id:characterId},'Harvest delivered to the FC stores.',r=>setReveal({type:'harvest',name:name(plot.crop_material),quantity:r.quantity}))}>✿ Gather the harvest</button>
      </div>
     </article>)}
     {Array.from({length:Math.max(0,data.garden.level+1-data.plots.length)},(_,i)=><div className="fc-garden-locked" key={'empty-'+i}><span>◇</span><h4>Open garden bed</h4><p>Ready for a new crop.</p>{command&&<button type="button" onClick={()=>setCatalog('plot')}>Plant a crop</button>}</div>)}
    </div>
    {command&&<div className="fc-garden-upgrade"><div><span>THE GARDEN'S FUTURE</span><strong>Expand the glasshouse</strong><p>Each expansion opens another bed and improves the yield from every harvest. Next expansion: {data.garden.level*5} iron ingots.</p></div><button type="button" disabled={busy||data.garden.level>=4||stock('iron-ingot')<data.garden.level*5} onClick={()=>run('/workshop/garden/upgrade',{},'The glasshouse has been expanded.')}>{data.garden.level>=4?'Fully expanded':'Expand garden'}</button></div>}
   </div>}
   {tab==='gather'&&<div className="fc-scene"><div className="fc-scene-title"><div><span>BEYOND THE ESTATE</span><h3>Choose an expedition</h3><p>Set out to gather herbs or minerals. Each expedition returns a small, server-rolled find. Bound characters require Eclipse Attendant standing or higher.</p></div><strong className="fc-expedition-counter">{gatherLeft} trips left</strong></div>
    <div className="fc-zone-grid">{zones.map(zone=><button key={zone.id} type="button" className={'fc-zone-card '+(currentZone?.id===zone.id?'chosen':'')} onClick={()=>{setSelectedZone(zone.id);setSelectedMaterial('');setReveal(null)}} aria-pressed={currentZone?.id===zone.id}><span>{zone.danger.toUpperCase()} · LEVEL {zone.minimum_level}+</span><strong>{zone.name}</strong><small>{zone.description}</small><em>{characterLevel>=zone.minimum_level?'Available':'Level too low'}</em></button>)}</div>
    {currentZone&&<div className="fc-zone-resources"><div className="fc-zone-resources-title"><strong>{currentZone.name} · Resources</strong>{command&&<button type="button" onClick={()=>setZoneEditor({...currentZone,materials:currentZone.materials.map(m=>({...m}))})}>Edit zone</button>}</div><div className="fc-expedition-grid">{zoneResources.map(m=><button key={m.material_id} type="button" disabled={!canVisit||characterLevel<m.minimum_level} className={'fc-expedition-node '+(selected?.material_id===m.material_id?'chosen':'')} onClick={()=>{setSelectedMaterial(m.material_id);setReveal(null)}}><span className="fc-expedition-art">{ICON[m.category]}</span><strong>{m.name}</strong><small>Level {Math.max(Number(currentZone.minimum_level),Number(m.minimum_level))}+ required</small><span className="fc-expedition-stock">{stock(m.material_id)} in FC stores</span></button>)}</div>{!canVisit&&<p className="fc-encounter-continue">Your character must reach level {currentZone.minimum_level} to enter this zone.</p>}</div>}
    <div className="fc-expedition-approaches" aria-label="Choose expedition approach">
      <button type="button" className={expeditionApproach==='steady'?'chosen':''} aria-pressed={expeditionApproach==='steady'} onClick={()=>setExpeditionApproach('steady')}><span>❧</span><strong>Careful trail</strong><small>A reliable find: 1–3 materials</small></button>
      <button type="button" className={expeditionApproach==='daring'?'chosen':''} aria-pressed={expeditionApproach==='daring'} onClick={()=>setExpeditionApproach('daring')}><span>⚡</span><strong>Deep wilderness</strong><small>Risk coming back empty for a chance at 7</small></button>
    </div>
    <label className="fc-mature-opt"><input type="checkbox" checked={allowMature} onChange={e=>setAllowMature(e.target.checked)}/><span>Include optional adult-themed narrative encounters (18+). These may be declined without an additional penalty.</span></label>
    <div className="fc-expedition-footer"><div><strong>{selected?.name||'Choose a resource in this zone'}</strong><p>{selected?.description||'Select a gathering location above.'}</p></div><button type="button" className="fc-start-button" disabled={!canAct||busy||!resourceAllowed||gatherLeft===0||!!encounterData.active} onClick={doGather}>{busy?'Exploring…':'Set out on expedition'}</button></div>
    {encounterData.active&&<p className="fc-encounter-continue">An expedition encounter is still underway. Resolve it before leaving again.</p>}
    <p className="fc-scene-hint">Five expeditions per member per UTC day. Finds are recorded for the whole FC, never in a private inventory.</p>
   </div>}
   {tab==='craft'&&<div className="fc-scene"><div className="fc-scene-title"><div><span>THE ALCHEMIST'S TABLE</span><h3>Turn common stores into something new</h3><p>Choose a blueprint and prepare its ingredients. Finished goods are returned to the FC's stores.</p></div></div>
    <div className="fc-craft-layout"><div className="fc-recipe-index">{recipes.map(r=><button key={r.id} type="button" className={recipe?.id===r.id?'chosen':''} onClick={()=>{setSelectedRecipe(r.id);setReveal(null);setStaged([])}}><span>⚒</span><strong>{r.name}</strong><small>{name(r.output_material)} · Lv. {r.minimum_level||1}+</small></button>)}</div>
     {recipe&&<div className="fc-craft-bench"><span>RECIPE BLUEPRINT</span><h4>{recipe.name}</h4><p>{recipe.description}</p><p className="fc-craft-level">Requires level {recipe.minimum_level||1} · Your level {characterLevel}{characterLevel<(recipe.minimum_level||1)?' — locked':''}</p>{command&&<button type="button" className="fc-recipe-level-edit" onClick={()=>setRecipeLevelEditor({id:recipe.id,name:recipe.name,minimum_level:recipe.minimum_level||1})}>Set crafting level</button>}
      <p className="fc-staging-hint">Prepare your materials: select or drag each ingredient into the workbench.</p>
      <div className="fc-craft-chain">{recipe.inputs.map(i=><button type="button" key={i.material_id} draggable={stock(i.material_id)>=i.quantity*craftQty} onDragStart={e=>e.dataTransfer.setData('text/plain',i.material_id)} onClick={()=>setStaged(prev=>prev.includes(i.material_id)?prev.filter(k=>k!==i.material_id):stock(i.material_id)>=i.quantity*craftQty?[...prev,i.material_id]:prev)} className={'fc-craft-ingredient '+(stock(i.material_id)>=i.quantity*craftQty?'available':'missing')+' '+(staged.includes(i.material_id)?'staged':'')} aria-pressed={staged.includes(i.material_id)}><span>{ICON[materials.find(m=>m.id===i.material_id)?.category]||'◆'}</span><strong>{name(i.material_id)}</strong><small>{stock(i.material_id)} / {i.quantity*craftQty}</small><em>{staged.includes(i.material_id)?'✓ Prepared':'Select ingredient'}</em></button>)}<div className="fc-craft-arrow">➜</div><div className="fc-craft-product" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('text/plain');if(recipe.inputs.some(i=>i.material_id===id&&stock(id)>=i.quantity*craftQty))setStaged(prev=>prev.includes(id)?prev:[...prev,id])}}><span>✦</span><strong>{name(recipe.output_material)}</strong><small>× {recipe.output_quantity*craftQty}</small><em>{recipe.inputs.every(i=>staged.includes(i.material_id))?'Ready to create':'Awaiting ingredients'}</em></div></div>
      <div className="fc-craft-footer"><label>Batch size <input type="number" min="1" max="25" value={craftQty} onChange={e=>{setCraftQty(Math.max(1,Math.min(25,Number(e.target.value)||1)));setStaged([])}}/></label><button className="fc-start-button" type="button" disabled={!canCraft||busy} onClick={doCraft}>{busy?'Working…':'Begin crafting'}</button></div>
      {!canCraft&&<p className="fc-scene-hint">Choose a character, make sure the stores have enough, and prepare each ingredient.</p>}
     </div>}</div>
   </div>}
   {tab==='stores'&&<div className="fc-scene"><div className="fc-scene-title"><div><span>THE ORDER'S VAULT</span><h3>One treasury, many contributors</h3><p>Every ore, herb, and finished item belongs to the Free Company.</p></div></div>
    <input type="search" aria-label="Find a material" className="fc-store-search" placeholder="Find a material…" value={search} onChange={e=>setSearch(e.target.value)}/>
    <div className="fc-store-grid">{materials.filter(m=>[m.name,m.category].join(' ').toLowerCase().includes(search.toLowerCase())).map(m=><article className="fc-store-item" key={m.id}><span>{ICON[m.category]||'✦'}</span><div><small>{m.category}</small><strong>{m.name}</strong></div><b>×{m.quantity}</b></article>)}</div>
    <h4 className="fc-ledger-title">Recent contributions</h4><div className="fc-ledger">{data.ledger.map(l=><div key={l.id}><span><strong>{l.name}</strong><small>{l.display_name} · {l.activity.replace('_',' ')} · {new Date(l.created_at).toLocaleDateString()}</small></span><strong className={Number(l.delta)>=0?'gain':'loss'}>{Number(l.delta)>0?'+':''}{l.delta}</strong></div>)}{!data.ledger.length&&<p>The ledger is ready for its first contribution.</p>}</div>
   </div>}
  </>}
  {recipeLevelEditor&&command&&<div className="fc-reveal-backdrop"><section className="fc-catalog-dialog" role="dialog" aria-modal="true" aria-label="Recipe level"><header><h3>{recipeLevelEditor.name}</h3><button type="button" onClick={()=>setRecipeLevelEditor(null)}>×</button></header>{error&&<p className="fc-catalog-error">{error}</p>}<div className="fc-catalog-fields"><label>Required character level<input type="number" min="1" max="100" value={recipeLevelEditor.minimum_level} onChange={e=>setRecipeLevelEditor({...recipeLevelEditor,minimum_level:e.target.value})}/></label><button type="button" disabled={busy} onClick={saveRecipeLevel}>Save level requirement</button></div></section></div>}
  {zoneEditor&&command&&<div className="fc-reveal-backdrop"><section className="fc-catalog-dialog" role="dialog" aria-modal="true" aria-label="Expedition zone editor"><header><div><span>ORDER COMMAND · EXPEDITION ZONES</span><h3>{zoneEditor.id?'Edit expedition zone':'New expedition zone'}</h3></div><button type="button" aria-label="Close" onClick={()=>{setZoneEditor(null);setError('')}}>×</button></header>{error&&<p className="fc-catalog-error">{error.replaceAll('_',' ')}</p>}<div className="fc-catalog-fields">
    <label>Zone name<input maxLength={110} value={zoneEditor.name} onChange={e=>setZoneEditor({...zoneEditor,name:e.target.value})}/></label>
    <label>What is this place?<textarea maxLength={900} value={zoneEditor.description} onChange={e=>setZoneEditor({...zoneEditor,description:e.target.value})}/></label>
    <div className="fc-encounter-settings"><label>Minimum level<input type="number" min="1" max="100" value={zoneEditor.minimum_level} onChange={e=>setZoneEditor({...zoneEditor,minimum_level:e.target.value,materials:zoneEditor.materials.map(m=>({...m,minimum_level:Math.max(Number(m.minimum_level),Number(e.target.value)||1)}))})}/></label>
    <label>Danger<select value={zoneEditor.danger} onChange={e=>setZoneEditor({...zoneEditor,danger:e.target.value})}>{['low','moderate','high','extreme'].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
    <label>Display order<input type="number" min="0" max="999" value={zoneEditor.sort_order} onChange={e=>setZoneEditor({...zoneEditor,sort_order:e.target.value})}/></label></div>
    <label className="fc-encounter-enabled"><input type="checkbox" checked={!!zoneEditor.enabled} onChange={e=>setZoneEditor({...zoneEditor,enabled:e.target.checked})}/> Enabled for expeditions</label>
    <h4>Available resources in this zone</h4>
    {zoneEditor.materials.map((m,i)=><div className="fc-zone-material-edit" key={i}><select value={m.material_id} onChange={e=>setZoneEditor({...zoneEditor,materials:zoneEditor.materials.map((v,j)=>j===i?{...v,material_id:e.target.value}:v)})}><option value="">Choose resource</option>{gatherables.map(mat=><option key={mat.id} value={mat.id}>{mat.name}</option>)}</select><input type="number" min={zoneEditor.minimum_level} max="100" aria-label="Resource level" value={m.minimum_level} onChange={e=>setZoneEditor({...zoneEditor,materials:zoneEditor.materials.map((v,j)=>j===i?{...v,minimum_level:e.target.value}:v)})}/><button type="button" onClick={()=>setZoneEditor({...zoneEditor,materials:zoneEditor.materials.filter((_,j)=>j!==i)})}>×</button></div>)}
    <button type="button" onClick={()=>setZoneEditor({...zoneEditor,materials:[...zoneEditor.materials,{material_id:'',minimum_level:Number(zoneEditor.minimum_level)||1}]})}>+ Add resource to zone</button>
    <button type="button" disabled={busy||!zoneEditor.name.trim()||!zoneEditor.materials.length||zoneEditor.materials.some(m=>!m.material_id)} onClick={saveZone}>Save expedition zone</button>
   </div></section></div>}
  {encounterData.active&&<div className="fc-reveal-backdrop"><section className="fc-encounter-dialog" role="dialog" aria-modal="true" aria-label="Wilderness encounter">
   <span className="fc-encounter-category">{encounterData.active.kind==='mature'?'OPTIONAL ADULT ROLEPLAY':encounterData.active.kind==='wildlife'?'WILDLIFE ENCOUNTER':encounterData.active.kind==='bandits'?'HOSTILE ENCOUNTER':'UNUSUAL DISCOVERY'}</span>
   <div className="fc-encounter-emblem" aria-hidden="true">{encounterData.active.kind==='wildlife'?'♞':encounterData.active.kind==='bandits'?'⚔':encounterData.active.kind==='mature'?'☾':'✧'}</div>
   <h3>{encounterData.active.name}</h3><p>{encounterData.active.description}</p>
   {['wildlife','bandits'].includes(encounterData.active.kind)&&<div className="fc-encounter-health">
    <label>Your stamina <strong>{encounterData.active.player_health}/12</strong></label><div className="fc-healthbar"><span style={{width:Math.max(0,Number(encounterData.active.player_health)/12*100)+'%'}}/></div>
    <label>Opponent <strong>{encounterData.active.enemy_health}</strong></label><div className="fc-healthbar hostile"><span style={{width:Math.min(100,Number(encounterData.active.enemy_health)/Math.max(1,Number(encounterData.active.enemy_max_health)||8)*100)+'%'}}/></div>
    <small>Turn {encounterData.active.turn_number} of 6 · Attack uses a d20 roll</small>
   </div>}
   {encounterMessage&&<p className="fc-encounter-feedback" role="status">{encounterMessage}</p>}
   <div className="fc-encounter-actions">
    {['wildlife','bandits'].includes(encounterData.active.kind)?<><button type="button" disabled={busy} onClick={()=>resolveEncounter('attack')}>⚔ Attack (d20)</button><button type="button" className="secondary" disabled={busy} onClick={()=>resolveEncounter('retreat')}>Withdraw safely</button></>:<><button type="button" disabled={busy} onClick={()=>resolveEncounter('continue')}>{encounterData.active.kind==='mature'?'Participate (fade to black)':'Investigate'}</button><button className="secondary" type="button" disabled={busy} onClick={()=>resolveEncounter('decline')}>Decline and continue</button></>}
   </div>
  </section></div>}
  {encounterEditor&&command&&<div className="fc-reveal-backdrop"><section className="fc-catalog-dialog" role="dialog" aria-modal="true" aria-label="Manage expedition encounters">
   <header><div><span>ORDER COMMAND · EXPEDITIONS</span><h3>Encounter library</h3></div><button type="button" aria-label="Close encounter editor" onClick={()=>{setEncounterEditor(null);setError('')}}>×</button></header>
   {error&&<p className="fc-catalog-error" role="alert">{error.replaceAll('_',' ')}</p>}
   <div className="fc-encounter-library"><button type="button" className={!encounterEditor.id?'selected':''} onClick={()=>setEncounterEditor(scenarioEmpty())}>+ New encounter</button>{encounterData.scenarios.map(item=><button type="button" key={item.id} className={encounterEditor.id===item.id?'selected':''} onClick={()=>setEncounterEditor({...item,enabled:!!item.enabled})}>{item.name}{!item.enabled?' (inactive)':''}</button>)}</div>
   <div className="fc-catalog-fields">
    <label>Encounter name<input maxLength={110} value={encounterEditor.name} onChange={e=>setEncounterEditor({...encounterEditor,name:e.target.value})}/></label>
    <label>Type<select value={encounterEditor.kind} onChange={e=>setEncounterEditor({...encounterEditor,kind:e.target.value})}><option value="wildlife">Wild animal</option><option value="bandits">Hostile NPC</option><option value="mystery">Mystery / discovery</option><option value="mature">Optional adult RP (18+)</option></select></label>
    <label>Scene description<textarea maxLength={1800} value={encounterEditor.description} onChange={e=>setEncounterEditor({...encounterEditor,description:e.target.value})}/></label>
    <label>Victory / success outcome<textarea maxLength={600} value={encounterEditor.outcome_text} onChange={e=>setEncounterEditor({...encounterEditor,outcome_text:e.target.value})}/></label>
    <label>Defeat / failure outcome<textarea maxLength={900} value={encounterEditor.failure_text||''} onChange={e=>setEncounterEditor({...encounterEditor,failure_text:e.target.value})}/></label>
    <label>Retreat outcome<textarea maxLength={900} value={encounterEditor.retreat_text||''} onChange={e=>setEncounterEditor({...encounterEditor,retreat_text:e.target.value})}/></label>
    <label>Declined encounter outcome<textarea maxLength={900} value={encounterEditor.decline_text||''} onChange={e=>setEncounterEditor({...encounterEditor,decline_text:e.target.value})}/></label>
    <div className="fc-encounter-settings"><label>Spawn weight<input type="number" min="1" max="100" value={encounterEditor.weight} onChange={e=>setEncounterEditor({...encounterEditor,weight:e.target.value})}/></label><label>NPC HP<input type="number" min="1" max="100" value={encounterEditor.enemy_health} onChange={e=>setEncounterEditor({...encounterEditor,enemy_health:e.target.value})}/></label><label>NPC defense<input type="number" min="1" max="20" value={encounterEditor.enemy_defense} onChange={e=>setEncounterEditor({...encounterEditor,enemy_defense:e.target.value})}/></label></div>
    {encounterEditor.id&&<label className="fc-encounter-enabled"><input type="checkbox" checked={!!encounterEditor.enabled} onChange={e=>setEncounterEditor({...encounterEditor,enabled:e.target.checked})}/> Enabled for expeditions</label>}
    <button type="button" disabled={busy||!encounterEditor.name.trim()||!encounterEditor.description.trim()} onClick={saveScenario}>Save encounter</button>
   </div>
  </section></div>}
  {reveal&&<div className="fc-reveal-backdrop" role="presentation"><section className="fc-reveal" role="dialog" aria-modal="true" aria-label="Activity complete"><span>✦</span><p>{reveal.type==='gather'?'EXPEDITION COMPLETE':reveal.type==='craft'?'CRAFTING COMPLETE':'HARVEST COMPLETE'}</p><h3>{reveal.quantity>0?'+ '+reveal.quantity+' '+reveal.name:'An empty-handed return'}</h3><small>{reveal.encounterText|| (reveal.quantity>0?'Added to the shared Order stores':'The expedition was recorded; try another route next time.')}</small><button type="button" onClick={()=>setReveal(null)}>Continue</button></section></div>}
  {catalog&&command&&data&&<div className="fc-reveal-backdrop"><section className="fc-catalog-dialog" role="dialog" aria-modal="true" aria-label="Expand workshop catalog">
   <header><div><span>ORDER COMMAND</span><h3>Expand the workshop</h3></div><button type="button" aria-label="Close" onClick={()=>setCatalog(null)}>×</button></header>
   {error&&<p className="fc-catalog-error" role="alert">{error.replaceAll('_',' ')}</p>}
   <div className="fc-catalog-switch">{[['material','Material'],['recipe','Recipe'],['plot','Garden crop']].map(([id,label])=><button type="button" key={id} className={catalog===id?'selected':''} onClick={()=>setCatalog(id)}>{label}</button>)}</div>
   {catalog==='menu'&&<p>Choose what you would like to add. Everything is saved to the FC's shared catalog.</p>}
   {catalog==='material'&&<div className="fc-catalog-fields"><label>Name<input value={materialDraft.name} maxLength={100} onChange={e=>setMaterialDraft({...materialDraft,name:e.target.value})}/></label><label>Category<select value={materialDraft.category} onChange={e=>setMaterialDraft({...materialDraft,category:e.target.value})}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></label><label>Description<textarea value={materialDraft.description} maxLength={500} onChange={e=>setMaterialDraft({...materialDraft,description:e.target.value})}/></label><button disabled={busy||!materialDraft.name.trim()} onClick={createMaterial}>Add material</button></div>}
   {catalog==='recipe'&&<div className="fc-catalog-fields"><label>Recipe name<input value={recipeDraft.name} maxLength={110} onChange={e=>setRecipeDraft({...recipeDraft,name:e.target.value})}/></label><label>Description<textarea maxLength={450} value={recipeDraft.description} onChange={e=>setRecipeDraft({...recipeDraft,description:e.target.value})}/></label><label>Produces<select value={recipeDraft.output_material} onChange={e=>setRecipeDraft({...recipeDraft,output_material:e.target.value})}><option value="">Choose output</option>{materials.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Minimum crafting level<input type="number" min="1" max="100" value={recipeDraft.minimum_level} onChange={e=>setRecipeDraft({...recipeDraft,minimum_level:e.target.value})}/></label><label>Output amount<input type="number" min="1" max="100" value={recipeDraft.output_quantity} onChange={e=>setRecipeDraft({...recipeDraft,output_quantity:e.target.value})}/></label><h4>Ingredients</h4>{recipeDraft.inputs.map((i,index)=><div className="fc-catalog-input" key={index}><select value={i.material_id} onChange={e=>setRecipeDraft({...recipeDraft,inputs:recipeDraft.inputs.map((v,n)=>n===index?{...v,material_id:e.target.value}:v)})}><option value="">Choose material</option>{materials.map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</select><input type="number" min="1" max="100" value={i.quantity} onChange={e=>setRecipeDraft({...recipeDraft,inputs:recipeDraft.inputs.map((v,n)=>n===index?{...v,quantity:e.target.value}:v)})}/><button type="button" aria-label="Remove ingredient" onClick={()=>setRecipeDraft({...recipeDraft,inputs:recipeDraft.inputs.filter((_,n)=>n!==index)})}>×</button></div>)}<button type="button" onClick={()=>setRecipeDraft({...recipeDraft,inputs:[...recipeDraft.inputs,{material_id:'',quantity:1}]})}>+ Ingredient</button><button disabled={busy||!recipeDraft.name.trim()||!recipeDraft.output_material||recipeDraft.inputs.some(i=>!i.material_id)} onClick={createRecipe}>Create recipe</button></div>}
   {catalog==='plot'&&<div className="fc-catalog-fields"><p>Plant one of the Order's cataloged herbs or botanical crops in an unlocked garden bed.</p><label>Garden crop<select value={crop} onChange={e=>setCrop(e.target.value)}><option value="">Choose crop</option>{materials.filter(m=>['herb','botanical'].includes(m.category)).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><button disabled={busy||!crop} onClick={createPlot}>Plant garden bed</button></div>}
  </section></div>}
 </section>;
}
