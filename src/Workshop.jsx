import React,{useEffect,useState} from 'react';
import './workshop.css';

export default function Workshop({request,characters=[],canManage=false,readOnly=false}){
 const [data,setData]=useState(null);
 const [characterId,setCharacterId]=useState('');
 const [material,setMaterial]=useState('iron-ore');
 const [quantity,setQuantity]=useState(1);
 const [recipe,setRecipe]=useState('smelt-iron');
 const [batch,setBatch]=useState(1);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const [tab,setTab]=useState('stores');
 const own=characters.filter(c=>c.player_user_id||c.player_account_id);
 const chosen=characters.find(c=>c.id===characterId);
 const gatherables=(data?.materials||[]).filter(x=>['ore','herb'].includes(x.category));
 const canAct=Boolean(characterId)&&!readOnly;
 async function refresh(){
  const next=await request('/workshop');
  setData(next);
 }
 useEffect(()=>{refresh().catch(e=>setError(e.message))},[]);
 useEffect(()=>{if(!characterId&&characters.length)setCharacterId(characters[0].id)},[characters,characterId]);
 async function run(path,body,description){
  setBusy(true);setError('');setNotice('');
  try{const result=await request(path,{method:'POST',body});await refresh();setNotice(description+(result.quantity?' ('+result.quantity+' obtained)':''))}
  catch(e){setError(e.message)}
  finally{setBusy(false)}
 }
 const amount=(v)=>Math.max(1,Math.min(100,Number(v)||1));
 const stock=id=>Number(data?.materials?.find(m=>m.id===id)?.quantity||0);
 return <section className="fc-workshop">
  <header className="fc-workshop-heading"><div><span className="eyebrow">THE ORDER'S RESOURCES</span><h2>Workshop & Garden</h2><p>One common stockpile, maintained by the whole Order.</p></div></header>
  {error&&<p className="alert" role="alert">{error}</p>}
  {notice&&<p className="fc-workshop-notice" role="status">{notice}</p>}
  {!data?<section className="panel">Loading the Order’s stores…</section>:<>
   <div className="fc-workshop-stats">
    <div><strong>{data.materials.length}</strong><span>Material types</span></div>
    <div><strong>{data.materials.reduce((a,m)=>a+Number(m.quantity),0)}</strong><span>Materials in shared stores</span></div>
    <div><strong>Level {data.garden.level}</strong><span>FC garden</span></div>
   </div>
   <div className="fc-workshop-tabs" role="tablist" aria-label="Workshop areas">
    {[['stores','Shared Stores'],['gather','Gathering'],['craft','Crafting'],['garden','FC Garden']].map(([id,label])=><button type="button" key={id} role="tab" aria-selected={tab===id} className={tab===id?'selected':''} onClick={()=>setTab(id)}>{label}</button>)}
   </div>
   {tab!=='stores'&&<label className="fc-workshop-character">Your character
    <select value={characterId} onChange={e=>setCharacterId(e.target.value)}><option value="">Select character</option>{characters.map(c=><option key={c.id} value={c.id}>{c.name||c.character_name}</option>)}</select>
   </label>}
   {tab==='stores'&&<><div className="fc-workshop-grid">{data.materials.map(m=><article className="fc-stock-card" key={m.id}><div><small>{m.category}</small><h3>{m.name}</h3><p>{m.description}</p></div><strong>{m.quantity}</strong></article>)}</div>
    <h3 className="fc-workshop-subtitle">Recent contributions and use</h3>
    <div className="fc-ledger">{data.ledger.map(l=><div key={l.id}><span><strong>{l.name}</strong><small>{l.display_name} · {l.activity.replace('_',' ')} · {new Date(l.created_at).toLocaleDateString()}</small></span><strong className={Number(l.delta)>=0?'gain':'loss'}>{Number(l.delta)>0?'+':''}{l.delta}</strong></div>)}{!data.ledger.length&&<p>No materials have been recorded yet.</p>}</div>
   </>}
   {tab==='gather'&&<section className="fc-action-card"><div className="eyebrow">WILDERNESS EXPEDITIONS</div><h3>Bring resources home</h3><p>All gathered ore and herbs enter the shared FC stores. Bound characters must have reached Eclipse Attendant or higher to gather beyond the estate.</p>
    <div className="fc-action-fields"><label>Resource<select value={material} onChange={e=>setMaterial(e.target.value)}>{gatherables.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Quantity<input type="number" min="1" max="100" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label></div>
    <button type="button" className="btn primary" disabled={!canAct||busy} onClick={()=>run('/workshop/gather',{character_id:characterId,material_id:material,quantity:amount(quantity)},'Resources added to the FC stores.')}>Record gathering</button>
   </section>}
   {tab==='craft'&&<div className="fc-recipe-grid">{data.recipes.map(r=><article key={r.id} className="fc-action-card"><small className="eyebrow">ORDER WORKSHOP</small><h3>{r.name}</h3><p>{r.description}</p><p className="fc-recipe-output">Produces {r.output_quantity} × {data.materials.find(m=>m.id===r.output_material)?.name}</p>
    <div className="fc-ingredients">{r.inputs.map(i=><div key={i.material_id}><span>{data.materials.find(m=>m.id===i.material_id)?.name}</span><span>{i.quantity} required · {stock(i.material_id)} stored</span></div>)}</div>
    <button className="btn primary" type="button" disabled={!canAct||busy||r.inputs.some(i=>stock(i.material_id)<i.quantity)} onClick={()=>run('/workshop/craft',{character_id:characterId,recipe_id:r.id,quantity:1},'Workshop recipe completed.')}>Craft one</button>
   </article>)}</div>}
   {tab==='garden'&&<><div className="fc-garden-intro"><div><span className="eyebrow">THE FC GARDEN</span><h3>One garden. Many hands.</h3><p>Each member can care for a plot once per day. Watering and tending help the plants mature, and completed harvests feed the FC stockpile.</p></div><div className="fc-garden-level">Level <strong>{data.garden.level}</strong><small>Maximum level 4</small></div></div>
    <div className="fc-garden-grid">{data.plots.map(plot=><article key={plot.id} className="fc-action-card fc-plot"><span className="eyebrow">PLOT {plot.id}</span><h3>{data.materials.find(m=>m.id===plot.crop_material)?.name}</h3>
     <div className="fc-progress-head"><span>Growth</span><strong>{plot.growth}%</strong></div><div className="fc-progress"><span style={{width:plot.growth+'%'}}/></div>
     <div className="fc-progress-head"><span>Health</span><strong>{plot.health}%</strong></div><div className="fc-progress health"><span style={{width:plot.health+'%'}}/></div>
     <div className="fc-garden-actions"><button type="button" className="btn secondary" disabled={!canAct||busy} onClick={()=>run('/workshop/garden/'+plot.id+'/care',{character_id:characterId,action:'water'},'Garden watered.')}>Water</button><button type="button" className="btn secondary" disabled={!canAct||busy} onClick={()=>run('/workshop/garden/'+plot.id+'/care',{character_id:characterId,action:'tend'},'Garden tended.')}>Tend</button><button type="button" className="btn primary" disabled={!canAct||busy||plot.growth<100||plot.health<40} onClick={()=>run('/workshop/garden/'+plot.id+'/harvest',{character_id:characterId},'Harvest placed in shared stores.')}>Harvest</button></div>
    </article>)}</div>
    {canManage&&!readOnly&&<section className="fc-upgrade"><div><strong>Improve the garden</strong><p>Expand plots and increase the yield and care bonus. Next upgrade costs {data.garden.level*5} iron ingots from shared stores.</p></div><button className="btn primary" type="button" disabled={busy||data.garden.level>=4||stock('iron-ingot')<data.garden.level*5} onClick={()=>run('/workshop/garden/upgrade',{},'Garden upgraded.')}>{data.garden.level>=4?'Fully upgraded':'Upgrade garden'}</button></section>}
   </>}
  </>}
 </section>;
}
