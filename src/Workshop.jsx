import SearchPicker from './SearchPicker';
import React,{useEffect,useState} from 'react';
import './workshop.css';


const ICON={ore:'⛏',herb:'❧',botanical:'✿',refined:'◆',supply:'▣'};
const RECIPE_ICONS={weapons:'⚔',armor:'⬡',tools:'⚒',accessories:'✧',refining:'◆',alchemy:'☾',tonics:'❦',provisions:'▣',other:'✦'};
const slug=value=>value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 -]/g,'').trim().replace(/\s+/g,'-').slice(0,48);
const CATEGORIES=['ore','herb','botanical','refined','supply'];
const initialMaterial={name:'',category:'herb',description:''};
const initialRecipe={name:'',description:'',category_id:'alchemy',output_material:'',output_quantity:1,minimum_level:1,inputs:[{material_id:'',quantity:1}]};

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
 const [gearCatalog,setGearCatalog]=useState([]);
 const [gearDraft,setGearDraft]=useState(null);
 const [craftCategory,setCraftCategory]=useState('all');
 const [newCategory,setNewCategory]=useState({name:'',description:'',sort_order:100});
 const [recipeCategoryEditor,setRecipeCategoryEditor]=useState(null);
 const [craftQty,setCraftQty]=useState(1);
 const [craftDestination,setCraftDestination]=useState('reserved');
 const [reservedGoods,setReservedGoods]=useState([]);
 const [releaseQty,setReleaseQty]=useState({});
 const [staged,setStaged]=useState([]);
 const [reveal,setReveal]=useState(null);
 const [catalog,setCatalog]=useState(null);
 const [materialDraft,setMaterialDraft]=useState(initialMaterial);
 const [recipeDraft,setRecipeDraft]=useState(initialRecipe);
 const [crop,setCrop]=useState('');
 const [replantPlot,setReplantPlot]=useState(null);
 const [search,setSearch]=useState('');
 const canAct=!!characterId&&!readOnly;
 const command=canManage&&!readOnly;
 async function refresh(){const [workshop,encounters,areas,gear,reserved]=await Promise.all([request('/workshop'),request('/workshop/encounters'),request('/workshop/zones'),request('/commerce'),request('/workshop/reserved')]);setData(workshop);setEncounterData(encounters);setZones(areas.zones||[]);setGearCatalog(gear.templates||[]);setReservedGoods(reserved.goods||[])}
 useEffect(()=>{refresh().catch(e=>setError(e.message))},[]);
 useEffect(()=>{if(!characterId&&characters.length)setCharacterId(characters[0].id)},[characters,characterId]);
 const materials=data?.materials||[];
 const recipes=[...(data?.recipes||[]),...gearCatalog.map(t=>({id:'gear-'+t.id,template_id:t.id,name:t.name,description:t.description,category_id:t.slot==='weapon'?'weapons':t.slot==='armor'?'armor':t.slot==='tool'?'tools':'accessories',minimum_level:t.minimum_level,output_quantity:1,output_material:null,inputs:t.ingredients,attack_bonus:t.attack_bonus,defense_bonus:t.defense_bonus,tool_bonus:t.tool_bonus,slot:t.slot,kind:'equipment'}))];
 const categories=[...(data?.categories||[]),...([{id:'weapons',name:'Weapons'},{id:'armor',name:'Armor'},{id:'tools',name:'Tools'},{id:'accessories',name:'Accessories'}].filter(c=>!(data?.categories||[]).some(d=>d.id===c.id)))];
 const shownRecipes=recipes.filter(r=>craftCategory==='all'||(r.category_id||'other')===craftCategory);
 const gatherables=materials.filter(m=>['ore','herb'].includes(m.category));
 const currentZone=zones.find(z=>z.id===selectedZone)||zones[0];
 const zoneResources=(currentZone?.materials||[]).map(entry=>({...entry,...materials.find(m=>m.id===entry.material_id)}));
 const selected=zoneResources.find(m=>m.material_id===selectedMaterial)||zoneResources[0];
 const characterLevel=Math.max(1,Number(characters.find(c=>c.id===characterId)?.level)||1);
 const canVisit=!!currentZone&&characterLevel>=Number(currentZone.minimum_level);
 const resourceAllowed=!!selected&&canVisit&&characterLevel>=Number(selected.minimum_level);
 const recipe=shownRecipes.find(r=>r.id===selectedRecipe)||shownRecipes[0];
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
 const doCraft=()=>recipe.kind==='equipment'
  ?run('/commerce/craft',{template_id:recipe.template_id,character_id:characterId},
   'Forged equipment has been added to your character sheet.',r=>{setStaged([]);setReveal({type:'craft',name:recipe.name,quantity:1,detail:'Item #'+r.item_id+' is now in your character equipment bag.'})})
  :run('/workshop/craft',{recipe_id:recipe.id,quantity:Number(craftQty),character_id:characterId,destination:craftDestination},
   craftDestination==='reserved'?'Crafted goods secured in your character inventory.':'Finished goods added to FC stores.',
   r=>{setStaged([]);setReveal({type:'craft',name:name(recipe.output_material),quantity:r.produced,detail:r.destination==='reserved'?'Reserved for your character until you release or deliver them.':'Added to FC common stores.'})});
 const canCraft=recipe&&characterLevel>=Number(recipe.minimum_level||1)&&recipe.inputs.every(i=>stock(i.material_id)>=i.quantity*(recipe.kind?1:craftQty)&&staged.includes(i.material_id))&&canAct;
 const createMaterial=()=>{const id=slug(materialDraft.name);run('/workshop/catalog/materials',{id,...materialDraft},'New material added to the Order catalog.',()=>{setMaterialDraft(initialMaterial);setCatalog(null)})};
 const createRecipe=()=>{const id=slug(recipeDraft.name);run('/workshop/catalog/recipes',{id,...recipeDraft,minimum_level:Number(recipeDraft.minimum_level),output_quantity:Number(recipeDraft.output_quantity),inputs:recipeDraft.inputs.map(i=>({...i,quantity:Number(i.quantity)}))},'New recipe added to the Order workshop.',()=>{setRecipeDraft(initialRecipe);setCatalog(null)})};
 const createCategory=()=>{const id=slug(newCategory.name);run('/workshop/catalog/categories',{id,...newCategory,sort_order:Number(newCategory.sort_order)},'New crafting category created.',()=>{setNewCategory({name:'',description:'',sort_order:100});setCraftCategory(id);setCatalog(null)})};
 const changeRecipeCategory=()=>run('/workshop/catalog/recipes/'+recipeCategoryEditor.id+'/category',{category_id:recipeCategoryEditor.category_id},'Recipe moved to its new category.',()=>{setCraftCategory(recipeCategoryEditor.category_id);setSelectedRecipe(recipeCategoryEditor.id);setRecipeCategoryEditor(null)});
 const openCropEditor=plot=>{setCrop(plot?.crop_material||'');setReplantPlot(plot||null);setCatalog('plot')};
 const createPlot=()=>{
  const replacing=!!replantPlot;
  const discard=Number(replantPlot?.growth||0)>0;
  if(replacing&&crop===replantPlot.crop_material){setError('Choose a different crop for this bed.');return}
  if(replacing&&discard&&!window.confirm('Replace this crop? Its current growth will be lost. Harvest it first if you want to keep the yield.'))return;
  run(replacing?'/workshop/garden/'+replantPlot.id+'/replant':'/workshop/catalog/plots',
   replacing?{crop_material:crop,discard_growth:discard}:{crop_material:crop},
   replacing?'Garden bed replanted.':'A new garden plot has been planted.',
   ()=>{setCatalog(null);setReplantPlot(null);setCrop('')});
 };
 const newGear=()=>({name:'',description:'',slot:'weapon',minimum_level:1,attack_bonus:0,defense_bonus:0,tool_bonus:0,ingredients:[{material_id:'',quantity:1}]});
 const createGear=()=>{const b=gearDraft;run('/commerce/templates',{...b,id:slug(b.name),minimum_level:Number(b.minimum_level),attack_bonus:Number(b.attack_bonus),defense_bonus:Number(b.defense_bonus),tool_bonus:Number(b.tool_bonus),ingredients:b.ingredients.map(i=>({...i,quantity:Number(i.quantity)}))},'A new equipment blueprint is ready in the workshop.',()=>{setGearDraft(null);setCatalog(null);setCraftCategory(b.slot==='weapon'?'weapons':b.slot==='armor'?'armor':b.slot==='tool'?'tools':'accessories')})};
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
    <div className="fc-scene-title"><div><span>THE GLASSHOUSE</span><h3>Every hand helps it flourish</h3><p>Select one of your characters to water or tend each bed once per UTC day. Care increases growth immediately, and all members contribute to the same beds. Crops do not grow on their own between care actions; mature harvests go to FC stores.</p></div><div className="fc-garden-badge">✿ <strong>Garden {data.garden.level}</strong></div></div>
    <div className="fc-garden-world">{data.plots.map(plot=><article className="fc-garden-bed" key={plot.id}>
      <div className="fc-bed-sky"><div className="fc-bed-glow"/><div className={'fc-bed-plant '+(plot.crop_material==='hellshade-bloom'?'hellshade ':'')+'stage-'+(plot.growth>=100?'grown':plot.growth>=50?'growing':'seedling')} aria-hidden="true">{plot.growth>=100?'✿':plot.growth>=50?'❀':'♧'}</div><div className="fc-bed-earth"/></div>
      <div className="fc-bed-content"><span>GARDEN BED {plot.id}</span><h4>{name(plot.crop_material)}</h4>
       <div className="fc-bed-meter"><label>Growth <strong>{plot.growth}%</strong></label><div><span style={{width:plot.growth+'%'}}/></div></div>
       <div className="fc-bed-meter healthy"><label>Health <strong>{plot.health}%</strong></label><div><span style={{width:plot.health+'%'}}/></div></div>
       <p>{plot.growth>=100?'Ready to harvest!':plot.cared_today?'You have cared for this bed today. Return after the daily reset for another turn.':plot.growth>=65?'Growing beautifully.':plot.growth>=25?'New shoots are taking root.':'A seedling needs the Order’s care.'}</p><small className="fc-garden-helpers">{plot.helpers_today||0} member{Number(plot.helpers_today)===1?'':'s'} helped today</small>
       <div className="fc-bed-actions"><button type="button" disabled={!canAct||busy||plot.cared_today} onClick={()=>run('/workshop/garden/'+plot.id+'/care',{character_id:characterId,action:'water'},'You watered the garden bed.')}>☂ Water</button><button type="button" disabled={!canAct||busy||plot.cared_today} onClick={()=>run('/workshop/garden/'+plot.id+'/care',{character_id:characterId,action:'tend'},'The garden bed has been tended.')}>❧ Tend</button></div>
       {command&&<button type="button" className="fc-garden-replant" disabled={busy} onClick={()=>openCropEditor(plot)}>Change crop</button>}
       <button className="fc-harvest-button" type="button" disabled={!canAct||busy||plot.growth<100||plot.health<40} onClick={()=>run('/workshop/garden/'+plot.id+'/harvest',{character_id:characterId},'Harvest delivered to the FC stores.',r=>setReveal({type:'harvest',name:name(plot.crop_material),quantity:r.quantity}))}>✿ Gather the harvest</button>
      </div>
     </article>)}
     {Array.from({length:Math.max(0,data.garden.level+1-data.plots.length)},(_,i)=><div className="fc-garden-locked" key={'empty-'+i}><span>◇</span><h4>Open garden bed</h4><p>Ready for a new crop.</p>{command&&<button type="button" onClick={()=>openCropEditor(null)}>Plant a crop</button>}</div>)}
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
   {tab==='craft'&&<div className="fc-scene"><div className="fc-scene-title"><div><span>THE ORDER'S WORKSHOP</span><h3>Crafting & Alchemy</h3><p>All crafts share one workbench and the same FC resources. Consumables return to common stores; equipment belongs to the crafting character.</p></div></div>
    <div className="fc-craft-categories" aria-label="Crafting categories"><button type="button" className={craftCategory==='all'?'chosen':''} aria-pressed={craftCategory==='all'} onClick={()=>{setCraftCategory('all');setSelectedRecipe('');setStaged([])}}>All Crafts <small>{recipes.length}</small></button>{categories.map(category=><button type="button" key={category.id} className={craftCategory===category.id?'chosen':''} aria-pressed={craftCategory===category.id} onClick={()=>{setCraftCategory(category.id);setSelectedRecipe('');setStaged([])}}>{category.name} <small>{recipes.filter(r=>(r.category_id||'other')===category.id).length}</small></button>)}</div>
    <div className="fc-reserved-panel"><div><strong>Character-reserved supplies</strong><p>Only their maker can release these goods to FC stores or deliver them to an authorized front. Other members cannot take them.</p></div>{reservedGoods.filter(g=>g.character_id===characterId).length?reservedGoods.filter(g=>g.character_id===characterId).map(g=><article key={g.material_id}><div><strong>{g.name}</strong><small>{g.quantity} reserved for this character</small></div><input type="number" aria-label={'Quantity to release of '+g.name} min="1" max={g.quantity} value={releaseQty[g.material_id]||1} onChange={e=>setReleaseQty({...releaseQty,[g.material_id]:e.target.value})}/><button type="button" disabled={busy||!canAct||Number(releaseQty[g.material_id]||1)<1||Number(releaseQty[g.material_id]||1)>g.quantity} onClick={()=>run('/workshop/reserved/release',{character_id:characterId,material_id:g.material_id,quantity:Number(releaseQty[g.material_id]||1)},'Reserved items released to FC stores.')}>Release to FC</button></article>):<small>No reserved crafted supplies for this character yet. Set your craft destination to Reserved to keep the next batch.</small>}</div>
    <div className="fc-craft-layout"><div className="fc-recipe-index">{shownRecipes.map(r=><button key={r.id} type="button" className={recipe?.id===r.id?'chosen':''} onClick={()=>{setSelectedRecipe(r.id);setReveal(null);setStaged([])}}><span>{RECIPE_ICONS[r.category_id]||'✦'}</span><strong>{r.name}</strong><small>{r.kind==='equipment'?r.slot.toUpperCase()+' · Character gear':name(r.output_material)+' · FC goods'} · Lv. {r.minimum_level||1}+</small></button>)}{shownRecipes.length===0&&<p className="fc-empty-recipes">No blueprints in this category yet. Order command can create one in the existing workshop catalog.</p>}</div>
     {recipe&&<div className="fc-craft-bench"><span>{recipe.kind==='equipment'?'EQUIPMENT BLUEPRINT':'RECIPE BLUEPRINT'}</span><h4>{recipe.name}</h4><p>{recipe.description}</p>{recipe.kind==='equipment'&&<div className="fc-crafted-gear-bonuses"><span>{recipe.slot?.toUpperCase()} · EQUIPPABLE</span>{Number(recipe.attack_bonus)>0&&<strong>Attack +{recipe.attack_bonus}</strong>}{Number(recipe.defense_bonus)>0&&<strong>Defense +{recipe.defense_bonus}</strong>}{Number(recipe.tool_bonus)>0&&<strong>Tool +{recipe.tool_bonus}</strong>}<small>Goes to your character sheet, not FC storage</small></div>}<p className="fc-craft-level">Requires level {recipe.minimum_level||1} · Your level {characterLevel}{characterLevel<(recipe.minimum_level||1)?' — locked':''}</p>{command&&!recipe.kind&&<div className="fc-recipe-management"><button type="button" className="fc-recipe-level-edit" onClick={()=>setRecipeLevelEditor({id:recipe.id,name:recipe.name,minimum_level:recipe.minimum_level||1})}>Set crafting level</button><button type="button" className="fc-recipe-level-edit" onClick={()=>setRecipeCategoryEditor({id:recipe.id,name:recipe.name,category_id:recipe.category_id||'other'})}>Move to category</button></div>}
      <p className="fc-staging-hint">Prepare your materials: select or drag each ingredient into the workbench.</p>
      <div className="fc-craft-chain">{recipe.inputs.map(i=><button type="button" key={i.material_id} draggable={stock(i.material_id)>=i.quantity*(recipe.kind?1:craftQty)} onDragStart={e=>e.dataTransfer.setData('text/plain',i.material_id)} onClick={()=>setStaged(prev=>prev.includes(i.material_id)?prev.filter(k=>k!==i.material_id):stock(i.material_id)>=i.quantity*(recipe.kind?1:craftQty)?[...prev,i.material_id]:prev)} className={'fc-craft-ingredient '+(stock(i.material_id)>=i.quantity*(recipe.kind?1:craftQty)?'available':'missing')+' '+(staged.includes(i.material_id)?'staged':'')} aria-pressed={staged.includes(i.material_id)}><span>{ICON[materials.find(m=>m.id===i.material_id)?.category]||'◆'}</span><strong>{name(i.material_id)}</strong><small>{stock(i.material_id)} / {i.quantity*(recipe.kind?1:craftQty)}</small><em>{staged.includes(i.material_id)?'✓ Prepared':'Select ingredient'}</em></button>)}<div className="fc-craft-arrow">➜</div><div className="fc-craft-product" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('text/plain');if(recipe.inputs.some(i=>i.material_id===id&&stock(id)>=i.quantity*(recipe.kind?1:craftQty)))setStaged(prev=>prev.includes(id)?prev:[...prev,id])}}><span>✦</span><strong>{recipe.kind==='equipment'?recipe.name:name(recipe.output_material)}</strong><small>× {recipe.kind==='equipment'?1:recipe.output_quantity*craftQty}</small><em>{recipe.inputs.every(i=>staged.includes(i.material_id))?'Ready to create':'Awaiting ingredients'}</em></div></div>
      <div className="fc-craft-footer">{!recipe.kind&&<label className="fc-reserve-choice">Finished goods go to<select value={craftDestination} onChange={e=>setCraftDestination(e.target.value)}><option value="reserved">My character · Reserved</option><option value="shared">FC Stores · Shared</option></select></label>}{!recipe.kind&&<label>Batch size <input type="number" min="1" max="25" value={craftQty} onChange={e=>{setCraftQty(Math.max(1,Math.min(25,Number(e.target.value)||1)));setStaged([])}}/></label>}<button className="fc-start-button" type="button" disabled={!canCraft||busy} onClick={doCraft}>{busy?'Working…':recipe?.kind==='equipment'?'Forge equipment':'Begin crafting'}</button></div>
      {!canCraft&&<p className="fc-scene-hint">Choose a character, make sure the stores have enough, and prepare each ingredient.</p>}
     </div>}</div>
   </div>}
   {tab==='stores'&&<div className="fc-scene"><div className="fc-scene-title"><div><span>THE ORDER'S VAULT</span><h3>One treasury, many contributors</h3><p>Every ore, herb, and finished item belongs to the Free Company.</p></div></div>
    <input type="search" aria-label="Find a material" className="fc-store-search" placeholder="Find a material…" value={search} onChange={e=>setSearch(e.target.value)}/>
    <div className="fc-store-grid">{materials.filter(m=>[m.name,m.category].join(' ').toLowerCase().includes(search.toLowerCase())).map(m=><article className="fc-store-item" key={m.id}><span>{ICON[m.category]||'✦'}</span><div><small>{m.category}</small><strong>{m.name}</strong></div><b>×{m.quantity}</b></article>)}</div>
    <h4 className="fc-ledger-title">Recent contributions</h4><div className="fc-ledger">{data.ledger.map(l=><div key={l.id}><span><strong>{l.name}</strong><small>{l.display_name} · {l.activity.replace('_',' ')} · {new Date(l.created_at).toLocaleDateString()}</small></span><strong className={Number(l.delta)>=0?'gain':'loss'}>{Number(l.delta)>0?'+':''}{l.delta}</strong></div>)}{!data.ledger.length&&<p>The ledger is ready for its first contribution.</p>}</div>
   </div>}
  </>}
  {gearDraft&&command&&<div className="fc-reveal-backdrop"><section className="fc-catalog-dialog" role="dialog" aria-modal="true" aria-label="New equipment recipe"><header><div><span>THE ORDER'S UNIFIED WORKSHOP</span><h3>New equipment blueprint</h3></div><button type="button" onClick={()=>setGearDraft(null)}>×</button></header>{error&&<p className="fc-catalog-error">{error.replaceAll('_',' ')}</p>}<div className="fc-catalog-fields">
  <label>Name<input maxLength={110} value={gearDraft.name} onChange={e=>setGearDraft({...gearDraft,name:e.target.value})}/></label>
  <label>Description<textarea maxLength={600} value={gearDraft.description} onChange={e=>setGearDraft({...gearDraft,description:e.target.value})}/></label>
  <label>Equipment slot<select value={gearDraft.slot} onChange={e=>setGearDraft({...gearDraft,slot:e.target.value})}>{['weapon','armor','tool','accessory'].map(slot=><option key={slot} value={slot}>{slot}</option>)}</select></label>
  <div className="fc-gear-stats-editor">{[['minimum_level','Required level'],['attack_bonus','Attack +'],['defense_bonus','Defense +'],['tool_bonus','Tool +']].map(([k,label])=><label key={k}>{label}<input type="number" min={k==='minimum_level'?1:0} max={k==='minimum_level'?100:20} value={gearDraft[k]} onChange={e=>setGearDraft({...gearDraft,[k]:e.target.value})}/></label>)}</div>
  <h4>Materials used by the existing FC workbench</h4>{gearDraft.ingredients.map((i,index)=><div key={index} className="fc-catalog-input"><SearchPicker value={i.material_id} onChange={value=>setGearDraft({...gearDraft,ingredients:gearDraft.ingredients.map((x,n)=>n===index?{...x,material_id:value}:x)})} options={materials} placeholder="Choose material" ariaLabel="Choose material"/><input aria-label="Quantity" type="number" min="1" max="100" value={i.quantity} onChange={e=>setGearDraft({...gearDraft,ingredients:gearDraft.ingredients.map((x,n)=>n===index?{...x,quantity:e.target.value}:x)})}/><button type="button" aria-label="Remove" onClick={()=>setGearDraft({...gearDraft,ingredients:gearDraft.ingredients.filter((_,n)=>n!==index)})}>×</button></div>)}
  <button type="button" onClick={()=>setGearDraft({...gearDraft,ingredients:[...gearDraft.ingredients,{material_id:'',quantity:1}]})}>+ Ingredient</button><button type="button" disabled={busy||!gearDraft.name.trim()||!gearDraft.ingredients.length||gearDraft.ingredients.some(i=>!i.material_id)} onClick={createGear}>Save equipment blueprint</button>
  </div></section></div>}
  {recipeCategoryEditor&&command&&<div className="fc-reveal-backdrop"><section className="fc-catalog-dialog" role="dialog" aria-modal="true" aria-label="Move recipe category"><header><h3>Organize {recipeCategoryEditor.name}</h3><button type="button" aria-label="Close" onClick={()=>setRecipeCategoryEditor(null)}>×</button></header>{error&&<p className="fc-catalog-error">{error.replaceAll('_',' ')}</p>}<div className="fc-catalog-fields"><label>Crafting category<select value={recipeCategoryEditor.category_id} onChange={e=>setRecipeCategoryEditor({...recipeCategoryEditor,category_id:e.target.value})}>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label><button type="button" disabled={busy} onClick={changeRecipeCategory}>Save category</button></div></section></div>}
  {recipeLevelEditor&&command&&<div className="fc-reveal-backdrop"><section className="fc-catalog-dialog" role="dialog" aria-modal="true" aria-label="Recipe level"><header><h3>{recipeLevelEditor.name}</h3><button type="button" onClick={()=>setRecipeLevelEditor(null)}>×</button></header>{error&&<p className="fc-catalog-error">{error}</p>}<div className="fc-catalog-fields"><label>Required character level<input type="number" min="1" max="100" value={recipeLevelEditor.minimum_level} onChange={e=>setRecipeLevelEditor({...recipeLevelEditor,minimum_level:e.target.value})}/></label><button type="button" disabled={busy} onClick={saveRecipeLevel}>Save level requirement</button></div></section></div>}
  {zoneEditor&&command&&<div className="fc-reveal-backdrop"><section className="fc-catalog-dialog" role="dialog" aria-modal="true" aria-label="Expedition zone editor"><header><div><span>ORDER COMMAND · EXPEDITION ZONES</span><h3>{zoneEditor.id?'Edit expedition zone':'New expedition zone'}</h3></div><button type="button" aria-label="Close" onClick={()=>{setZoneEditor(null);setError('')}}>×</button></header>{error&&<p className="fc-catalog-error">{error.replaceAll('_',' ')}</p>}<div className="fc-catalog-fields">
    <label>Zone name<input maxLength={110} value={zoneEditor.name} onChange={e=>setZoneEditor({...zoneEditor,name:e.target.value})}/></label>
    <label>What is this place?<textarea maxLength={900} value={zoneEditor.description} onChange={e=>setZoneEditor({...zoneEditor,description:e.target.value})}/></label>
    <div className="fc-encounter-settings"><label>Minimum level<input type="number" min="1" max="100" value={zoneEditor.minimum_level} onChange={e=>setZoneEditor({...zoneEditor,minimum_level:e.target.value,materials:zoneEditor.materials.map(m=>({...m,minimum_level:Math.max(Number(m.minimum_level),Number(e.target.value)||1)}))})}/></label>
    <label>Danger<select value={zoneEditor.danger} onChange={e=>setZoneEditor({...zoneEditor,danger:e.target.value})}>{['low','moderate','high','extreme'].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
    <label>Display order<input type="number" min="0" max="999" value={zoneEditor.sort_order} onChange={e=>setZoneEditor({...zoneEditor,sort_order:e.target.value})}/></label></div>
    <label className="fc-encounter-enabled"><input type="checkbox" checked={!!zoneEditor.enabled} onChange={e=>setZoneEditor({...zoneEditor,enabled:e.target.checked})}/> Enabled for expeditions</label>
    <h4>Available resources in this zone</h4>
    {zoneEditor.materials.map((m,i)=><div className="fc-zone-material-edit" key={i}><SearchPicker value={m.material_id} onChange={value=>setZoneEditor({...zoneEditor,materials:zoneEditor.materials.map((v,j)=>j===i?{...v,material_id:value}:v)})} options={gatherables} placeholder="Choose resource" ariaLabel="Choose resource"/><input type="number" min={zoneEditor.minimum_level} max="100" aria-label="Resource level" value={m.minimum_level} onChange={e=>setZoneEditor({...zoneEditor,materials:zoneEditor.materials.map((v,j)=>j===i?{...v,minimum_level:e.target.value}:v)})}/><button type="button" onClick={()=>setZoneEditor({...zoneEditor,materials:zoneEditor.materials.filter((_,j)=>j!==i)})}>×</button></div>)}
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
  {reveal&&<div className="fc-reveal-backdrop" role="presentation"><section className="fc-reveal" role="dialog" aria-modal="true" aria-label="Activity complete"><span>✦</span><p>{reveal.type==='gather'?'EXPEDITION COMPLETE':reveal.type==='craft'?'CRAFTING COMPLETE':'HARVEST COMPLETE'}</p><h3>{reveal.quantity>0?'+ '+reveal.quantity+' '+reveal.name:'An empty-handed return'}</h3><small>{reveal.detail||reveal.encounterText|| (reveal.quantity>0?'Crafted or collected successfully.':'The expedition was recorded; try another route next time.')}</small><button type="button" onClick={()=>setReveal(null)}>Continue</button></section></div>}
  {catalog&&command&&data&&<div className="fc-reveal-backdrop"><section className="fc-catalog-dialog" role="dialog" aria-modal="true" aria-label="Expand workshop catalog">
   <header><div><span>ORDER COMMAND</span><h3>Expand the workshop</h3></div><button type="button" aria-label="Close" onClick={()=>setCatalog(null)}>×</button></header>
   {error&&<p className="fc-catalog-error" role="alert">{error.replaceAll('_',' ')}</p>}
   <div className="fc-catalog-switch">{[['material','Material'],['recipe','Recipe'],['gear','Equipment blueprint'],['category','Crafting category'],['plot','Garden crop']].map(([id,label])=><button type="button" key={id} className={catalog===id?'selected':''} onClick={()=>setCatalog(id)}>{label}</button>)}</div>
   {catalog==='menu'&&<p>Choose what you would like to add. Everything is saved to the FC's shared catalog.</p>}
   {catalog==='material'&&<div className="fc-catalog-fields"><label>Name<input value={materialDraft.name} maxLength={100} onChange={e=>setMaterialDraft({...materialDraft,name:e.target.value})}/></label><label>Category<select value={materialDraft.category} onChange={e=>setMaterialDraft({...materialDraft,category:e.target.value})}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></label><label>Description<textarea value={materialDraft.description} maxLength={500} onChange={e=>setMaterialDraft({...materialDraft,description:e.target.value})}/></label><button disabled={busy||!materialDraft.name.trim()} onClick={createMaterial}>Add material</button></div>}
   {catalog==='gear'&&<div className="fc-catalog-fields"><p>Weapons, armor, tools and accessories use the same workbench and common materials as other recipes. Forged items are placed on the crafting character's sheet.</p><button type="button" onClick={()=>{setGearDraft(newGear());setCatalog(null)}}>Create equipment blueprint</button></div>}
   {catalog==='category'&&<div className="fc-catalog-fields"><label>Category name<input maxLength={90} value={newCategory.name} onChange={e=>setNewCategory({...newCategory,name:e.target.value})}/></label><label>Description<textarea maxLength={240} value={newCategory.description} onChange={e=>setNewCategory({...newCategory,description:e.target.value})}/></label><label>Display order<input type="number" min="0" max="999" value={newCategory.sort_order} onChange={e=>setNewCategory({...newCategory,sort_order:e.target.value})}/></label><button type="button" disabled={busy||!newCategory.name.trim()} onClick={createCategory}>Add category</button></div>}
   {catalog==='recipe'&&<div className="fc-catalog-fields"><label>Crafting category<select value={recipeDraft.category_id} onChange={e=>setRecipeDraft({...recipeDraft,category_id:e.target.value})}>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Recipe name<input value={recipeDraft.name} maxLength={110} onChange={e=>setRecipeDraft({...recipeDraft,name:e.target.value})}/></label><label>Description<textarea maxLength={450} value={recipeDraft.description} onChange={e=>setRecipeDraft({...recipeDraft,description:e.target.value})}/></label><label>Produces<SearchPicker value={recipeDraft.output_material} onChange={value=>setRecipeDraft({...recipeDraft,output_material:value})} options={materials} placeholder="Choose output" ariaLabel="Choose output"/></label><label>Minimum crafting level<input type="number" min="1" max="100" value={recipeDraft.minimum_level} onChange={e=>setRecipeDraft({...recipeDraft,minimum_level:e.target.value})}/></label><label>Output amount<input type="number" min="1" max="100" value={recipeDraft.output_quantity} onChange={e=>setRecipeDraft({...recipeDraft,output_quantity:e.target.value})}/></label><h4>Ingredients</h4>{recipeDraft.inputs.map((i,index)=><div className="fc-catalog-input" key={index}><SearchPicker value={i.material_id} onChange={value=>setRecipeDraft({...recipeDraft,inputs:recipeDraft.inputs.map((v,n)=>n===index?{...v,material_id:value}:v)})} options={materials} placeholder="Choose material" ariaLabel="Choose material"/><input type="number" min="1" max="100" value={i.quantity} onChange={e=>setRecipeDraft({...recipeDraft,inputs:recipeDraft.inputs.map((v,n)=>n===index?{...v,quantity:e.target.value}:v)})}/><button type="button" aria-label="Remove ingredient" onClick={()=>setRecipeDraft({...recipeDraft,inputs:recipeDraft.inputs.filter((_,n)=>n!==index)})}>×</button></div>)}<button type="button" onClick={()=>setRecipeDraft({...recipeDraft,inputs:[...recipeDraft.inputs,{material_id:'',quantity:1}]})}>+ Ingredient</button><button disabled={busy||!recipeDraft.name.trim()||!recipeDraft.output_material||recipeDraft.inputs.some(i=>!i.material_id)} onClick={createRecipe}>Create recipe</button></div>}
   {catalog==='plot'&&<div className="fc-catalog-fields"><p>Choose a herb or botanical crop. You can plant in an open bed or replace an existing crop. Replacing a growing crop discards its progress, but does not affect previous harvests.</p><label>Garden crop<SearchPicker value={crop} onChange={value=>setCrop(value)} options={materials.filter(m=>['herb','botanical'].includes(m.category))} placeholder="Choose crop" ariaLabel="Choose crop"/></label><button disabled={busy||!crop||(replantPlot&&replantPlot.crop_material===crop)} onClick={createPlot}>{replantPlot?'Replace crop in bed '+replantPlot.id:'Plant garden bed'}</button></div>}
  </section></div>}
 </section>;
}
