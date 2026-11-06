import React,{useEffect,useState} from 'react';
import './workshop.css';

const ICON={ore:'⛏',herb:'❧',botanical:'✿',refined:'◆',supply:'▣'};
const slug=value=>value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 -]/g,'').trim().replace(/\s+/g,'-').slice(0,48);
const CATEGORIES=['ore','herb','botanical','refined','supply'];
const initialMaterial={name:'',category:'herb',description:''};
const initialRecipe={name:'',description:'',output_material:'',output_quantity:1,inputs:[{material_id:'',quantity:1}]};

export default function Workshop({request,characters=[],canManage=false,readOnly=false}){
 const [data,setData]=useState(null);
 const [characterId,setCharacterId]=useState('');
 const [tab,setTab]=useState('garden');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [selectedMaterial,setSelectedMaterial]=useState('');
 const [selectedRecipe,setSelectedRecipe]=useState('');
 const [craftQty,setCraftQty]=useState(1);
 const [reveal,setReveal]=useState(null);
 const [catalog,setCatalog]=useState(null);
 const [materialDraft,setMaterialDraft]=useState(initialMaterial);
 const [recipeDraft,setRecipeDraft]=useState(initialRecipe);
 const [crop,setCrop]=useState('');
 const [search,setSearch]=useState('');
 const canAct=!!characterId&&!readOnly;
 const command=canManage&&!readOnly;
 async function refresh(){setData(await request('/workshop'))}
 useEffect(()=>{refresh().catch(e=>setError(e.message))},[]);
 useEffect(()=>{if(!characterId&&characters.length)setCharacterId(characters[0].id)},[characters,characterId]);
 const materials=data?.materials||[];
 const recipes=data?.recipes||[];
 const gatherables=materials.filter(m=>['ore','herb'].includes(m.category));
 const selected=gatherables.find(m=>m.id===selectedMaterial)||gatherables[0];
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
 const doGather=()=>run('/workshop/gather',{material_id:selected?.id,character_id:characterId},
  'The expedition returned to the Order.',r=>setReveal({type:'gather',name:selected.name,quantity:r.quantity}));
 const doCraft=()=>run('/workshop/craft',{recipe_id:recipe.id,quantity:Number(craftQty),character_id:characterId},
  'The workshop has delivered its finished goods to the shared stores.',r=>setReveal({type:'craft',name:name(recipe.output_material),quantity:r.quantity*recipe.output_quantity}));
 const canCraft=recipe&&recipe.inputs.every(i=>stock(i.material_id)>=i.quantity*craftQty)&&canAct;
 const createMaterial=()=>{const id=slug(materialDraft.name);run('/workshop/catalog/materials',{id,...materialDraft},'New material added to the Order catalog.',()=>{setMaterialDraft(initialMaterial);setCatalog(null)})};
 const createRecipe=()=>{const id=slug(recipeDraft.name);run('/workshop/catalog/recipes',{id,...recipeDraft,output_quantity:Number(recipeDraft.output_quantity),inputs:recipeDraft.inputs.map(i=>({...i,quantity:Number(i.quantity)}))},'New recipe added to the Order workshop.',()=>{setRecipeDraft(initialRecipe);setCatalog(null)})};
 const createPlot=()=>run('/workshop/catalog/plots',{crop_material:crop},'A new garden plot has been planted.',()=>setCatalog(null));
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
   <nav className="fc-play-nav" aria-label="Workshop locations">{nav.map(([id,title,mark])=><button key={id} type="button" className={tab===id?'active':''} aria-current={tab===id?'page':undefined} onClick={()=>{setTab(id);setReveal(null);setError('')}}><span aria-hidden="true">{mark}</span>{title}</button>)}{command&&<button type="button" className="fc-play-manage" onClick={()=>setCatalog('menu')}>✚ Expand catalog</button>}</nav>
   {tab!=='stores'&&<div className="fc-play-actor"><span>ACTIVE CHARACTER</span><select aria-label="Choose character" value={characterId} onChange={e=>setCharacterId(e.target.value)}><option value="">Choose a character</option>{characters.map(c=><option key={c.id} value={c.id}>{c.name||c.character_name}</option>)}</select></div>}
   {tab==='garden'&&<div className="fc-scene">
    <div className="fc-scene-title"><div><span>THE GLASSHOUSE</span><h3>Every hand helps it flourish</h3><p>Water or tend a plot once each day. Growth is shared; when a plant is ready, its harvest goes straight to the FC stores.</p></div><div className="fc-garden-badge">✿ <strong>Garden {data.garden.level}</strong></div></div>
    <div className="fc-garden-world">{data.plots.map(plot=><article className="fc-garden-bed" key={plot.id}>
      <div className="fc-bed-sky"><div className="fc-bed-glow"/><div className={'fc-bed-plant stage-'+(plot.growth>=100?'grown':plot.growth>=50?'growing':'seedling')} aria-hidden="true">{plot.growth>=100?'✿':plot.growth>=50?'❀':'♧'}</div><div className="fc-bed-earth"/></div>
      <div className="fc-bed-content"><span>GARDEN BED {plot.id}</span><h4>{name(plot.crop_material)}</h4>
       <div className="fc-bed-meter"><label>Growth <strong>{plot.growth}%</strong></label><div><span style={{width:plot.growth+'%'}}/></div></div>
       <div className="fc-bed-meter healthy"><label>Health <strong>{plot.health}%</strong></label><div><span style={{width:plot.health+'%'}}/></div></div>
       <p>{plot.growth>=100?'Ready to harvest!':plot.growth>=65?'Growing beautifully.':plot.growth>=25?'New shoots are taking root.':'A seedling needs the Order’s care.'}</p>
       <div className="fc-bed-actions"><button type="button" disabled={!canAct||busy} onClick={()=>run('/workshop/garden/'+plot.id+'/care',{character_id:characterId,action:'water'},'You watered the garden bed.')}>☂ Water</button><button type="button" disabled={!canAct||busy} onClick={()=>run('/workshop/garden/'+plot.id+'/care',{character_id:characterId,action:'tend'},'The garden bed has been tended.')}>❧ Tend</button></div>
       <button className="fc-harvest-button" type="button" disabled={!canAct||busy||plot.growth<100||plot.health<40} onClick={()=>run('/workshop/garden/'+plot.id+'/harvest',{character_id:characterId},'Harvest delivered to the FC stores.',r=>setReveal({type:'harvest',name:name(plot.crop_material),quantity:r.quantity}))}>✿ Gather the harvest</button>
      </div>
     </article>)}
     {Array.from({length:Math.max(0,data.garden.level+1-data.plots.length)},(_,i)=><div className="fc-garden-locked" key={'empty-'+i}><span>◇</span><h4>Open garden bed</h4><p>Ready for a new crop.</p>{command&&<button type="button" onClick={()=>setCatalog('plot')}>Plant a crop</button>}</div>)}
    </div>
    {command&&<div className="fc-garden-upgrade"><div><span>THE GARDEN'S FUTURE</span><strong>Expand the glasshouse</strong><p>Each expansion opens another bed and improves the yield from every harvest. Next expansion: {data.garden.level*5} iron ingots.</p></div><button type="button" disabled={busy||data.garden.level>=4||stock('iron-ingot')<data.garden.level*5} onClick={()=>run('/workshop/garden/upgrade',{},'The glasshouse has been expanded.')}>{data.garden.level>=4?'Fully expanded':'Expand garden'}</button></div>}
   </div>}
   {tab==='gather'&&<div className="fc-scene"><div className="fc-scene-title"><div><span>BEYOND THE ESTATE</span><h3>Choose an expedition</h3><p>Set out to gather herbs or minerals. Each expedition returns a small, server-rolled find. Bound characters require Eclipse Attendant standing or higher.</p></div><strong className="fc-expedition-counter">{gatherLeft} trips left</strong></div>
    <div className="fc-expedition-grid">{gatherables.map(m=><button key={m.id} type="button" className={'fc-expedition-node '+(selected?.id===m.id?'chosen':'')} onClick={()=>{setSelectedMaterial(m.id);setReveal(null)}}><span className="fc-expedition-art">{ICON[m.category]}</span><strong>{m.name}</strong><small>{m.category==='ore'?'Mineral deposits':'Foraging grounds'}</small><span className="fc-expedition-stock">{stock(m.id)} in FC stores</span></button>)}</div>
    <div className="fc-expedition-footer"><div><strong>{selected?.name||'Choose a resource'}</strong><p>{selected?.description||'Select a gathering location above.'}</p></div><button type="button" className="fc-start-button" disabled={!canAct||busy||!selected||gatherLeft===0} onClick={doGather}>{busy?'Exploring…':'Set out on expedition'}</button></div>
    <p className="fc-scene-hint">Five expeditions per member per UTC day. Finds are recorded for the whole FC, never in a private inventory.</p>
   </div>}
   {tab==='craft'&&<div className="fc-scene"><div className="fc-scene-title"><div><span>THE ALCHEMIST'S TABLE</span><h3>Turn common stores into something new</h3><p>Choose a blueprint and prepare its ingredients. Finished goods are returned to the FC's stores.</p></div></div>
    <div className="fc-craft-layout"><div className="fc-recipe-index">{recipes.map(r=><button key={r.id} type="button" className={recipe?.id===r.id?'chosen':''} onClick={()=>{setSelectedRecipe(r.id);setReveal(null)}}><span>⚒</span><strong>{r.name}</strong><small>{name(r.output_material)}</small></button>)}</div>
     {recipe&&<div className="fc-craft-bench"><span>RECIPE BLUEPRINT</span><h4>{recipe.name}</h4><p>{recipe.description}</p>
      <div className="fc-craft-chain">{recipe.inputs.map(i=><div key={i.material_id} className={'fc-craft-ingredient '+(stock(i.material_id)>=i.quantity*craftQty?'available':'missing')}><span>{ICON[materials.find(m=>m.id===i.material_id)?.category]||'◆'}</span><strong>{name(i.material_id)}</strong><small>{stock(i.material_id)} / {i.quantity*craftQty}</small></div>)}<div className="fc-craft-arrow">➜</div><div className="fc-craft-product"><span>✦</span><strong>{name(recipe.output_material)}</strong><small>× {recipe.output_quantity*craftQty}</small></div></div>
      <div className="fc-craft-footer"><label>Batch size <input type="number" min="1" max="25" value={craftQty} onChange={e=>setCraftQty(Math.max(1,Math.min(25,Number(e.target.value)||1)))}/></label><button className="fc-start-button" type="button" disabled={!canCraft||busy} onClick={doCraft}>{busy?'Working…':'Begin crafting'}</button></div>
      {!canCraft&&<p className="fc-scene-hint">Choose a character and ensure the FC has enough ingredients.</p>}
     </div>}</div>
   </div>}
   {tab==='stores'&&<div className="fc-scene"><div className="fc-scene-title"><div><span>THE ORDER'S VAULT</span><h3>One treasury, many contributors</h3><p>Every ore, herb, and finished item belongs to the Free Company.</p></div></div>
    <input type="search" aria-label="Find a material" className="fc-store-search" placeholder="Find a material…" value={search} onChange={e=>setSearch(e.target.value)}/>
    <div className="fc-store-grid">{materials.filter(m=>[m.name,m.category].join(' ').toLowerCase().includes(search.toLowerCase())).map(m=><article className="fc-store-item" key={m.id}><span>{ICON[m.category]||'✦'}</span><div><small>{m.category}</small><strong>{m.name}</strong></div><b>×{m.quantity}</b></article>)}</div>
    <h4 className="fc-ledger-title">Recent contributions</h4><div className="fc-ledger">{data.ledger.map(l=><div key={l.id}><span><strong>{l.name}</strong><small>{l.display_name} · {l.activity.replace('_',' ')} · {new Date(l.created_at).toLocaleDateString()}</small></span><strong className={Number(l.delta)>=0?'gain':'loss'}>{Number(l.delta)>0?'+':''}{l.delta}</strong></div>)}{!data.ledger.length&&<p>The ledger is ready for its first contribution.</p>}</div>
   </div>}
  </>}
  {reveal&&<div className="fc-reveal-backdrop" role="presentation"><section className="fc-reveal" role="dialog" aria-modal="true" aria-label="Activity complete"><span>✦</span><p>{reveal.type==='gather'?'EXPEDITION COMPLETE':reveal.type==='craft'?'CRAFTING COMPLETE':'HARVEST COMPLETE'}</p><h3>+{reveal.quantity} {reveal.name}</h3><small>Added to the shared Order stores</small><button type="button" onClick={()=>setReveal(null)}>Continue</button></section></div>}
  {catalog&&command&&data&&<div className="fc-reveal-backdrop"><section className="fc-catalog-dialog" role="dialog" aria-modal="true" aria-label="Expand workshop catalog">
   <header><div><span>ORDER COMMAND</span><h3>Expand the workshop</h3></div><button type="button" aria-label="Close" onClick={()=>setCatalog(null)}>×</button></header>
   <div className="fc-catalog-switch">{[['material','Material'],['recipe','Recipe'],['plot','Garden crop']].map(([id,label])=><button type="button" key={id} className={catalog===id?'selected':''} onClick={()=>setCatalog(id)}>{label}</button>)}</div>
   {catalog==='menu'&&<p>Choose what you would like to add. Everything is saved to the FC's shared catalog.</p>}
   {catalog==='material'&&<div className="fc-catalog-fields"><label>Name<input value={materialDraft.name} maxLength={100} onChange={e=>setMaterialDraft({...materialDraft,name:e.target.value})}/></label><label>Category<select value={materialDraft.category} onChange={e=>setMaterialDraft({...materialDraft,category:e.target.value})}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></label><label>Description<textarea value={materialDraft.description} maxLength={500} onChange={e=>setMaterialDraft({...materialDraft,description:e.target.value})}/></label><button disabled={busy||!materialDraft.name.trim()} onClick={createMaterial}>Add material</button></div>}
   {catalog==='recipe'&&<div className="fc-catalog-fields"><label>Recipe name<input value={recipeDraft.name} maxLength={110} onChange={e=>setRecipeDraft({...recipeDraft,name:e.target.value})}/></label><label>Description<textarea maxLength={450} value={recipeDraft.description} onChange={e=>setRecipeDraft({...recipeDraft,description:e.target.value})}/></label><label>Produces<select value={recipeDraft.output_material} onChange={e=>setRecipeDraft({...recipeDraft,output_material:e.target.value})}><option value="">Choose output</option>{materials.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Output amount<input type="number" min="1" max="100" value={recipeDraft.output_quantity} onChange={e=>setRecipeDraft({...recipeDraft,output_quantity:e.target.value})}/></label><h4>Ingredients</h4>{recipeDraft.inputs.map((i,index)=><div className="fc-catalog-input" key={index}><select value={i.material_id} onChange={e=>setRecipeDraft({...recipeDraft,inputs:recipeDraft.inputs.map((v,n)=>n===index?{...v,material_id:e.target.value}:v)})}><option value="">Choose material</option>{materials.map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</select><input type="number" min="1" max="100" value={i.quantity} onChange={e=>setRecipeDraft({...recipeDraft,inputs:recipeDraft.inputs.map((v,n)=>n===index?{...v,quantity:e.target.value}:v)})}/><button type="button" aria-label="Remove ingredient" onClick={()=>setRecipeDraft({...recipeDraft,inputs:recipeDraft.inputs.filter((_,n)=>n!==index)})}>×</button></div>)}<button type="button" onClick={()=>setRecipeDraft({...recipeDraft,inputs:[...recipeDraft.inputs,{material_id:'',quantity:1}]})}>+ Ingredient</button><button disabled={busy||!recipeDraft.name.trim()||!recipeDraft.output_material||recipeDraft.inputs.some(i=>!i.material_id)} onClick={createRecipe}>Create recipe</button></div>}
   {catalog==='plot'&&<div className="fc-catalog-fields"><p>Plant one of the Order's cataloged herbs or botanical crops in an unlocked garden bed.</p><label>Garden crop<select value={crop} onChange={e=>setCrop(e.target.value)}><option value="">Choose crop</option>{materials.filter(m=>['herb','botanical'].includes(m.category)).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><button disabled={busy||!crop} onClick={createPlot}>Plant garden bed</button></div>}
  </section></div>}
 </section>;
}
