import React,{useEffect,useState} from 'react';
import './commerce.css';

const blank=()=>({title:'',description:'',faction_id:'',item_kind:'material',item_id:'',required_quantity:5,rep_per_unit:2});
const fmt=n=>Number(n||0).toLocaleString();
export default function Commerce({request,characters=[],canManage=false,readOnly=false,materials=[]}){
 const [data,setData]=useState(null),[characterId,setCharacterId]=useState('');
 const [focus,setFocus]=useState('all'),[selected,setSelected]=useState(null);
 const [draft,setDraft]=useState(null),[quantities,setQuantities]=useState({}),[items,setItems]=useState({});
 const [gear,setGear]=useState([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const owner=characters.filter(c=>c.player_user_id||c.player_account_id);
 const character=owner.find(c=>c.id===characterId);
 const contracts=data?.contracts||[],factions=data?.factions||[],templates=data?.templates||[];
 const filtered=contracts.filter(c=>focus==='all'||c.faction_scope===focus);
 const active=filtered.find(c=>Number(c.id)===Number(selected))||filtered[0];
 const mat=id=>materials.find(m=>m.id===id),stock=id=>Number(mat(id)?.quantity||0);
 const goods=c=>c.item_kind==='material'?(c.material_name||mat(c.material_id)?.name):(c.equipment_name||templates.find(t=>t.id===c.equipment_template_id)?.name);
 async function refresh(){const d=await request('/commerce');setData(d);if(characterId){const i=await request('/commerce/characters/'+characterId+'/equipment');setGear(i.items||[])}}
 useEffect(()=>{refresh().catch(e=>setError(e.message))},[]);
 useEffect(()=>{if(!characterId&&owner.length)setCharacterId(owner[0].id)},[characters,characterId]);
 useEffect(()=>{if(!characterId)return;request('/commerce/characters/'+characterId+'/equipment').then(d=>setGear(d.items||[])).catch(e=>setError(e.message))},[characterId]);
 const remaining=c=>Math.max(0,Number(c.required_quantity)-Number(c.delivered_quantity));
 const quantity=active?.item_kind==='equipment'?1:Math.max(1,Math.min(100,Number(quantities[active?.id]||1)));
 const eligibleItems=active?.item_kind==='equipment'?gear.filter(i=>i.template_id===active.equipment_template_id&&!i.equipped):[];
 const canDeliver=!!character&&!readOnly&&!busy&&active?.status==='open'&&remaining(active)>=quantity&&(active.item_kind==='material'?stock(active.material_id)>=quantity:eligibleItems.some(i=>String(i.id)===String(items[active.id])));
 async function send(path,body,finish,method='POST'){
  setBusy(true);setError('');setNotice('');
  try{const r=await request(path,{method,body});await refresh();finish(r)}catch(e){setError(e.message||String(e))}finally{setBusy(false)}
 }
 const deliver=()=>send('/commerce/contracts/'+active.id+'/deliver',{character_id:characterId,quantity,equipment_item_id:active.item_kind==='equipment'?Number(items[active.id]):undefined},r=>setNotice('Delivery received. The recipient gained '+r.reputation_change+' standing toward the Order.'));
 const status=s=>send('/commerce/contracts/'+active.id+'/status',{status:s},()=>setNotice('Trade route updated.'));
 const create=()=>send('/commerce/contracts',{...draft,required_quantity:Number(draft.required_quantity),rep_per_unit:Number(draft.rep_per_unit)},()=>{setDraft(null);setNotice('New trade request published.')});
 return <section className="eo-tradeboard">
  <header className="eo-trade-hero"><div><span>THE ORDER · MERCHANT NETWORK</span><h2>Trade Routes</h2><p>Build relationships through real deliveries. Goods come from the shared stores; crafted weapons, armor and tools come from your character's equipment bag.</p></div><div className="eo-trade-heraldry" aria-hidden="true">♜</div></header>
  {error&&<p role="alert" className="alert">{error.replaceAll('_',' ')}</p>}{notice&&<p className="eo-commerce-notice" role="status">{notice}</p>}
  <div className="eo-trade-overview">
   <div><span>OPEN AGREEMENTS</span><strong>{contracts.filter(c=>c.status==='open').length}</strong></div>
   <div><span>DELIVERIES RECORDED</span><strong>{data?.deliveries?.length||0}</strong></div>
   <div><span>TRADE PARTNERS</span><strong>{new Set(contracts.map(c=>c.faction_id)).size}</strong></div>
  </div>
  <div className="eo-trade-controls"><label>Trading as <select value={characterId} onChange={e=>setCharacterId(e.target.value)}><option value="">Select a character sheet</option>{owner.map(c=><option key={c.id} value={c.id}>{c.name||c.character_name} · Lv {c.level||1}</option>)}</select></label>
  {canManage&&!readOnly&&<button className="eo-trade-create" type="button" onClick={()=>setDraft(blank())}>+ Post a trade request</button>}</div>
  <nav className="eo-trade-filters" aria-label="Trade destination"><button className={focus==='all'?'active':''} onClick={()=>{setFocus('all');setSelected(null)}}>All routes</button><button className={focus==='order_story'?'active':''} onClick={()=>{setFocus('order_story');setSelected(null)}}>Order connections</button><button className={focus==='world'?'active':''} onClick={()=>{setFocus('world');setSelected(null)}}>Other factions</button><button className={focus==='settlement'?'active':''} onClick={()=>{setFocus('settlement');setSelected(null)}}>Settlements</button></nav>
  <div className="eo-trade-layout"><div className="eo-trade-route-list">
  {filtered.map(c=><button type="button" className={'eo-trade-route '+(active?.id===c.id?'active':'')} key={c.id} onClick={()=>setSelected(c.id)}>
   <span className="eo-trade-route-marker">{c.faction_scope==='settlement'?'⌂':'✧'}</span>
   <span className="eo-trade-route-summary"><small>{c.faction_name} · {c.status}</small><strong>{c.title}</strong><em>{goods(c)} · {fmt(remaining(c))} needed</em></span>
   <span className="eo-trade-route-reward">+{c.rep_per_unit}<small>/ item</small></span>
  </button>)}
  {!filtered.length&&<div className="eo-trade-empty"><strong>No trade agreements here yet</strong><p>Order command can post a request for goods to any faction or settlement.</p></div>}
  </div>
  {active&&<article className="eo-trade-manifest" key={active.id}>
   <div className="eo-trade-manifest-top"><span>DELIVERY MANIFEST #{active.id}</span><span className={'eo-trade-status '+active.status}>{active.status}</span></div>
   <div className="eo-trade-partner-icon" aria-hidden="true">{active.faction_scope==='settlement'?'⌂':'✦'}</div>
   <small className="eo-trade-destination">{active.faction_name} · {active.faction_scope==='settlement'?'Settlement':'Faction'}</small>
   <h3>{active.title}</h3><p>{active.description||'The Order has been asked to deliver supplies.'}</p>
   <div className="eo-trade-manifest-product"><span aria-hidden="true">{active.item_kind==='equipment'?'⚒':'▣'}</span><div><small>GOODS REQUIRED</small><strong>{goods(active)}</strong><em>{active.item_kind==='equipment'?'One individually crafted item per delivery':'Taken from the FC common stockpile'}</em></div></div>
   <div className="eo-trade-delivery-meta"><strong>{active.delivered_quantity} <span>/ {active.required_quantity}</span></strong><small>delivered to destination</small></div>
   <div className="eo-trade-progress"><span style={{width:(100*Number(active.delivered_quantity)/Math.max(1,Number(active.required_quantity)))+'%'}}/></div>
   <div className="eo-trade-payoff"><strong>+{active.rep_per_unit} standing</strong><span>per accepted item · toward the Order</span></div>
   {active.status==='open'&&<div className="eo-trade-delivery">
    {active.item_kind==='material'?<div className="eo-trade-quantity"><label>Ship quantity<input type="number" min="1" max={Math.min(100,remaining(active))} value={quantities[active.id]||1} onChange={e=>setQuantities({...quantities,[active.id]:e.target.value})}/></label><span>{stock(active.material_id)} in FC stores</span></div>:<label>Choose a crafted item<select value={items[active.id]||''} onChange={e=>setItems({...items,[active.id]:e.target.value})}><option value="">Select an unequipped item</option>{eligibleItems.map(i=><option key={i.id} value={i.id}>{i.name} · #{i.id}</option>)}</select></label>}
    <button type="button" className="eo-trade-dispatch" disabled={!canDeliver} onClick={deliver}>Dispatch goods to {active.faction_name}</button>
    {!character&&<small>Choose a linked character to complete a delivery.</small>}
   </div>}
   {active.status==='complete'&&<div className="eo-trade-complete">✓ Fulfilled · No further deliveries accepted</div>}
   {canManage&&!readOnly&&active.status!=='complete'&&<button className="eo-trade-hold" disabled={busy} onClick={()=>status(active.status==='paused'?'open':'paused')}>{active.status==='paused'?'Reopen this agreement':'Pause this agreement'}</button>}
  </article>}
  </div>
  <section className="eo-trade-records"><div><span>THE MERCHANT LEDGER</span><h3>Recent deliveries</h3></div><div>{(data?.deliveries||[]).slice(0,12).map(d=><article key={d.id}><div><strong>{d.display_name}</strong><small>{new Date(d.created_at).toLocaleDateString()} · Agreement #{d.contract_id}</small></div><span>{d.quantity} items</span><b>+{d.reputation_change} standing</b></article>)}{!data?.deliveries?.length&&<p>No shipments recorded yet.</p>}</div></section>
  {draft&&<div className="eo-commerce-modal-mask"><section className="eo-commerce-modal" role="dialog" aria-modal="true" aria-label="Post trade request"><header><h3>New merchant agreement</h3><button type="button" aria-label="Close" onClick={()=>{setDraft(null);setError('')}}>×</button></header>{error&&<p className="alert">{error}</p>}
   <label>Receiving faction or settlement<select value={draft.faction_id} onChange={e=>setDraft({...draft,faction_id:e.target.value})}><option value="">Choose recipient</option>{factions.map(f=><option key={f.id} value={f.id}>{f.name} · {f.faction_scope==='settlement'?'Settlement':'Faction'}</option>)}</select></label>
   <label>Trade request<input maxLength={130} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
   <label>Details<textarea maxLength={600} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
   <label>Kind of goods<select value={draft.item_kind} onChange={e=>setDraft({...draft,item_kind:e.target.value,item_id:''})}><option value="material">Shared materials / provisions</option><option value="equipment">Crafted weapon, armor or tool</option></select></label>
   <label>Requested item<select value={draft.item_id} onChange={e=>setDraft({...draft,item_id:e.target.value})}><option value="">Choose item</option>{(draft.item_kind==='material'?materials:templates).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
   <div className="eo-commerce-three"><label>Total quantity<input type="number" min="1" max="100000" value={draft.required_quantity} onChange={e=>setDraft({...draft,required_quantity:e.target.value})}/></label><label>Reputation per item<input type="number" min="1" max="20" value={draft.rep_per_unit} onChange={e=>setDraft({...draft,rep_per_unit:e.target.value})}/></label></div>
   <button className="btn primary" type="button" disabled={busy||!draft.faction_id||!draft.item_id||!draft.title.trim()} onClick={create}>Publish trade request</button>
  </section></div>}
 </section>;
}
