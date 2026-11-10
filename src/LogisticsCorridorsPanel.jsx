import React,{useState} from 'react';
const pretty=v=>String(v||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const initial=()=>({name:'',origin_settlement_id:'',destination_settlement_id:'',mode:'road',travel_minutes:120,construction_item_id:'',construction_quantity:20});
export default function LogisticsCorridorsPanel({data,request,onRefresh}){
 const [draft,setDraft]=useState(null),[supplies,setSupplies]=useState({}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const corridors=data.corridors||[],locations=[...new Map((data.facilities||[]).filter(f=>f.settlement_id).map(f=>[f.settlement_id,{id:f.settlement_id,name:f.settlement_name}])).values()];
 const items=data.items||[],facilities=data.facilities||[];
 async function run(path,body){
  setBusy(true);setError('');
  try{await request(path,{method:'POST',body});await onRefresh();setDraft(null)}
  catch(e){setError(e.message||'Unable to update the route')}finally{setBusy(false)}
 }
 return <div className="freight-list"><div className="freight-list-head"><div><h3>Regional transport corridors</h3><small>Operational routes connect the real supply network. Construction and repairs consume stored industrial materials.</small></div><button onClick={()=>setDraft(initial())}>+ Plan corridor</button></div>
  {error&&<p className="wa-error" role="alert">{error}</p>}
  {corridors.map(c=><article className="freight-row" key={c.id}><div><span className={'freight-status is-'+c.state}>{pretty(c.state)} · {pretty(c.mode)}</span><strong>{c.name}</strong><small>{c.origin_name} ↔ {c.destination_name} · {c.travel_minutes} minutes</small><small>Commissioning / repair: {c.construction_quantity} {items.find(i=>i.id===c.construction_item_id)?.name||c.construction_item_id}</small></div><div className="freight-row-actions"><label className="freight-depot-select">Supply depot<select value={supplies[c.id]||''} onChange={e=>setSupplies({...supplies,[c.id]:e.target.value})}><option value="">Choose depot</option>{facilities.filter(f=>Number(f.settlement_id)===Number(c.origin_settlement_id)||Number(f.settlement_id)===Number(c.destination_settlement_id)).map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>{c.state!=='operational'&&<button disabled={busy||!supplies[c.id]} onClick={()=>run('/world-admin/logistics/corridors/'+c.id+'/state',{state:'operational',facility_id:Number(supplies[c.id])})}>Commission / repair</button>}{c.state==='operational'&&<button disabled={busy} onClick={()=>run('/world-admin/logistics/corridors/'+c.id+'/state',{state:'damaged'})}>Record damage</button>}{c.state!=='closed'&&<button disabled={busy} onClick={()=>run('/world-admin/logistics/corridors/'+c.id+'/state',{state:'closed'})}>Close route</button>}</div></article>)}
  {!corridors.length&&<p className="freight-empty">No inter-region corridors registered. Existing mapped roads and internal railway services remain in use.</p>}
  {draft&&<div className="freight-overlay"><section className="freight-modal" role="dialog" aria-modal="true" aria-label="Plan regional corridor"><header><h3>Plan transport corridor</h3><button onClick={()=>setDraft(null)}>Close</button></header><div className="freight-form">
   <label>Corridor name<input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} maxLength={140}/></label>
   <label>Route mode<select value={draft.mode} onChange={e=>setDraft({...draft,mode:e.target.value})}>{['road','rail','air','sea','pack'].map(m=><option value={m} key={m}>{pretty(m)}</option>)}</select></label>
   <label>From settlement<select value={draft.origin_settlement_id} onChange={e=>setDraft({...draft,origin_settlement_id:e.target.value})}><option value="">Choose</option>{locations.map(l=><option value={l.id} key={l.id}>{l.name}</option>)}</select></label>
   <label>To settlement<select value={draft.destination_settlement_id} onChange={e=>setDraft({...draft,destination_settlement_id:e.target.value})}><option value="">Choose</option>{locations.filter(l=>String(l.id)!==String(draft.origin_settlement_id)).map(l=><option value={l.id} key={l.id}>{l.name}</option>)}</select></label>
   <label>Journey duration (minutes)<input type="number" min={1} max={10080} value={draft.travel_minutes} onChange={e=>setDraft({...draft,travel_minutes:Number(e.target.value)})}/></label>
   <label>Construction material<select value={draft.construction_item_id} onChange={e=>setDraft({...draft,construction_item_id:e.target.value})}><option value="">Choose</option>{items.map(i=><option value={i.id} key={i.id}>{i.name}</option>)}</select></label>
   <label>Material requirement<input type="number" step=".001" min=".001" value={draft.construction_quantity} onChange={e=>setDraft({...draft,construction_quantity:Number(e.target.value)})}/></label>
   <p className="freight-hint">The corridor begins planned and cannot carry cargo until supplied and commissioned. No free materials are generated.</p>
   <footer><button onClick={()=>setDraft(null)}>Cancel</button><button disabled={busy||!draft.name.trim()||!draft.origin_settlement_id||!draft.destination_settlement_id||!draft.construction_item_id} onClick={()=>run('/world-admin/logistics/corridors',{...draft,origin_settlement_id:Number(draft.origin_settlement_id),destination_settlement_id:Number(draft.destination_settlement_id)})}>Create plan</button></footer>
  </div></section></div>}
 </div>;
}
