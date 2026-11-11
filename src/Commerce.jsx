import MaterialPicker from './MaterialPicker.jsx';
import React,{useEffect,useMemo,useState} from 'react';
import './commerce.css';

const goodsId=offer=>offer.item_kind+':'+(offer.item_kind==='material'?offer.material_id:offer.equipment_template_id);
const remain=offer=>Math.max(0,Number(offer.required_quantity)-Number(offer.delivered_quantity));
const fmt=value=>Number(value||0).toLocaleString();
const shortDate=value=>new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
const ICONS={ore:'⛏',herb:'❦',botanical:'✿',refined:'◆',supply:'▣',weapon:'⚔',armor:'⬡',tool:'⚒',accessory:'✧'};
const draftNew=()=>({title:'',description:'',faction_id:'',item_kind:'material',item_id:'',required_quantity:10,rep_per_unit:2,sale_value_per_unit:10});
const classify=(item,materials,templates)=>{
 if(item.item_kind==='material')return materials.find(m=>m.id===item.material_id)?.category||'supply';
 return templates.find(t=>t.id===item.equipment_template_id)?.slot||'tool';
};
const nameOf=(item,materials,templates)=>item.item_kind==='material'
 ?item.material_name||materials.find(m=>m.id===item.material_id)?.name||item.material_id
 :item.equipment_name||templates.find(t=>t.id===item.equipment_template_id)?.name||item.equipment_template_id;

export default function Commerce({request,characters=[],canManage=false,readOnly=false,materials=[],onTradeComplete}){
 const [data,setData]=useState(null);
 const [characterId,setCharacterId]=useState('');
 const [gear,setGear]=useState([]);
 const [fronts,setFronts]=useState([]);
 const [frontId,setFrontId]=useState('');
 const [frontStocks,setFrontStocks]=useState([]);
 const [view,setView]=useState('market');
 const [tradeScope,setTradeScope]=useState('all');
 const [search,setSearch]=useState('');
 const [category,setCategory]=useState('all');
 const [marketScope,setMarketScope]=useState('all');
 const [sort,setSort]=useState('demand');
 const [stockOnly,setStockOnly]=useState(false);
 const [selectedItem,setSelectedItem]=useState('');
 const [selectedOrder,setSelectedOrder]=useState(null);
 const [quantity,setQuantity]=useState(1);
 const [equipmentItemId,setEquipmentItemId]=useState('');
 const [review,setReview]=useState(false);
 const [createDraft,setCreateDraft]=useState(null);
 const [priceEdit,setPriceEdit]=useState(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const owner=characters.filter(c=>c.player_user_id||c.player_account_id);
 const character=owner.find(c=>c.id===characterId);
 const contracts=data?.contracts||[];
 const templates=data?.templates||[];
 const factions=data?.factions||[];
 const transactions=data?.deliveries||[];
 const centralStock=id=>Number(materials.find(m=>m.id===id)?.quantity||0);
 const selectedFront=fronts.find(f=>String(f.id)===String(frontId));
 const availableStock=id=>frontId?Number(frontStocks.find(s=>s.material_id===id)?.quantity||0):centralStock(id);

 async function refresh(){
  const [next,directory]=await Promise.all([request('/commerce'),request('/fronts')]);setData(next);setFronts((directory.fronts||[]).filter(f=>f.can_ship&&f.status==='active'));
  if(frontId){const stock=await request('/fronts/'+frontId+'/stocks');setFrontStocks(stock.stocks||[])}
  if(characterId){const inv=await request('/commerce/characters/'+characterId+'/equipment');setGear(inv.items||[])}
 }
 useEffect(()=>{refresh().catch(e=>setError(e.message))},[]);
 useEffect(()=>{if(!characterId&&owner.length)setCharacterId(owner[0].id)},[characters,characterId]);
 useEffect(()=>{
  if(!frontId){setFrontStocks([]);return}
  let active=true;
  request('/fronts/'+frontId+'/stocks').then(res=>{if(active)setFrontStocks(res.stocks||[])}).catch(e=>{if(active)setError(e.message)});
  return()=>{active=false}
 },[frontId]);

 useEffect(()=>{
  if(!characterId){setGear([]);return}
  let live=true;
  request('/commerce/characters/'+characterId+'/equipment').then(r=>{if(live)setGear(r.items||[])}).catch(e=>{if(live)setError(e.message)});
  return()=>{live=false};
 },[characterId]);
 const open=contracts.filter(c=>c.status==='open'&&remain(c)>0);
 const grouped=useMemo(()=>{
  const map=new Map();
  for(const c of open){
   const key=goodsId(c);
   if(!map.has(key))map.set(key,{id:key,kind:c.item_kind,itemId:c.item_kind==='material'?c.material_id:c.equipment_template_id,name:nameOf(c,materials,templates),category:classify(c,materials,templates),orders:[],demand:0,partners:new Set(),best:0});
   const g=map.get(key);g.orders.push(c);g.demand+=remain(c);g.partners.add(c.faction_id);g.best=Math.max(g.best,Number(c.rep_per_unit));
  }
  return [...map.values()].map(g=>({...g,partners:g.partners.size}));
 },[data,materials]);
 const availableFor=g=>g.kind==='material'?availableStock(g.itemId):gear.filter(i=>i.template_id===g.itemId&&!i.equipped).length;
 const categories=[['all','All goods'],['ore','Ore'],['herb','Herbs'],['botanical','Botanicals'],['refined','Refined'],['supply','Supplies'],['weapon','Weapons'],['armor','Armor'],['tool','Tools'],['accessory','Accessories']];
 const scopeItems=grouped.map(g=>({...g,shownOffers:g.orders.filter(c=>marketScope==='all'||c.faction_scope===marketScope)})).filter(g=>g.shownOffers.length);
 const items=scopeItems.filter(g=>(category==='all'||g.category===category)&&(!stockOnly||availableFor(g)>0)&&
  (g.name.toLowerCase().includes(search.toLowerCase())||g.shownOffers.some(c=>[c.title,c.faction_name].some(s=>String(s||'').toLowerCase().includes(search.toLowerCase())))))
  .sort((a,b)=>sort==='reward'?Math.max(...b.shownOffers.map(c=>Number(c.rep_per_unit)))-Math.max(...a.shownOffers.map(c=>Number(c.rep_per_unit))):
   sort==='name'?a.name.localeCompare(b.name):
   b.shownOffers.reduce((n,c)=>n+remain(c),0)-a.shownOffers.reduce((n,c)=>n+remain(c),0));
 const chosen=items.find(g=>g.id===selectedItem)||items[0];
 const offers=(chosen?.shownOffers||[]).slice().sort((a,b)=>Number(b.rep_per_unit)-Number(a.rep_per_unit)||Number(a.id)-Number(b.id));
 const order=offers.find(c=>String(c.id)===String(selectedOrder))||offers[0];
 const eligible=order?.item_kind==='equipment'?gear.filter(i=>i.template_id===order.equipment_template_id&&!i.equipped):[];
 const desired=order?.item_kind==='equipment'?1:Math.max(1,Math.min(100,Math.floor(Number(quantity)||1)));
 const ownedAmount=order?(order.item_kind==='material'?availableStock(order.material_id):eligible.length):0;
 const maxDeliverable=order?Math.min(100,remain(order),ownedAmount):0;
 const validDeliver=Boolean(character)&&!readOnly&&!busy&&order?.status==='open'&&
  (order.item_kind==='material'?desired<=maxDeliverable:eligible.some(i=>String(i.id)===String(equipmentItemId)));
 const reward=Math.min(100,desired*Number(order?.rep_per_unit||0));
 const saleIncome=desired*Number(order?.sale_value_per_unit||0);
 const demand=open.reduce((n,c)=>n+remain(c),0);
 const routeCount=new Set(open.map(c=>c.faction_id)).size;
 const groupedHistory=transactions.filter(t=>tradeScope==='all'||t.is_mine).slice(0,80);

 const selectOrder=c=>{setSelectedOrder(c.id);setQuantity(1);setEquipmentItemId('');setReview(false);setNotice('')};
 const selectItem=g=>{setSelectedItem(g.id);setSelectedOrder(null);setQuantity(1);setEquipmentItemId('');setReview(false)};
 async function commit(){
  if(!validDeliver||!order)return;
  setBusy(true);setError('');setReview(false);
  try{
   const result=await request('/commerce/contracts/'+order.id+'/deliver',{method:'POST',body:{character_id:characterId,quantity:desired,...(order.item_kind==='equipment'?{equipment_item_id:Number(equipmentItemId)}:{}),...(frontId?{front_id:Number(frontId)}:{})}});
   const updates=await Promise.allSettled([refresh(),onTradeComplete?.()]);
   setNotice('Shipment confirmed: '+fmt(result.quantity)+' '+nameOf(order,materials,templates)+' delivered to '+order.faction_name+'. The Order earned '+fmt(result.order_income)+' gil'+(result.front_earnings?' and the front retained '+fmt(result.front_earnings)+' gil':'')+'; faction standing +'+result.reputation_change+'.'+(updates.some(x=>x.status==='rejected')?' Refresh the exchange to see updated balances.':''));
   setEquipmentItemId('');setQuantity(1);
  }catch(e){setError(e.message||String(e))}
  finally{setBusy(false)}
 }
 async function createOrder(){
  if(!createDraft)return;
  setBusy(true);setError('');
  try{
   const b=createDraft;
   await request('/commerce/contracts',{method:'POST',body:{...b,required_quantity:Number(b.required_quantity),rep_per_unit:Number(b.rep_per_unit),sale_value_per_unit:Number(b.sale_value_per_unit)}});
   await refresh();setCreateDraft(null);setNotice('The new purchase request has been posted to the exchange.');setView('market');
  }catch(e){setError(e.message||String(e))}
  finally{setBusy(false)}
 }
 async function savePrice(){
  if(!priceEdit||!Number.isInteger(Number(priceEdit.value))||Number(priceEdit.value)<0||Number(priceEdit.value)>100000)return;
  setBusy(true);setError('');
  try{await request('/commerce/contracts/'+priceEdit.id+'/price',{method:'POST',body:{sale_value_per_unit:Number(priceEdit.value)}});await refresh();setPriceEdit(null);setNotice('Trade value updated. Future delivered goods will fund Order wages.')}
  catch(e){setError(e.message||String(e))}finally{setBusy(false)}
 }
 async function statusChange(c){
  setBusy(true);setError('');
  try{await request('/commerce/contracts/'+c.id+'/status',{method:'POST',body:{status:c.status==='paused'?'open':'paused'}});await refresh()}
  catch(e){setError(e.message||String(e))}finally{setBusy(false)}
 }
 return <section className="eo-exchange">
  <header className="eo-exchange-head">
   <div className="eo-exchange-brand"><span className="eo-exchange-sigil" aria-hidden="true">✥</span><div><span>THE ECLIPSE ORDER</span><h2>Merchant Exchange</h2><p>Workshop and garden markets · foreign demand · diplomatic standing</p></div></div>
   <div className="eo-exchange-head-actions"><span className="eo-exchange-live"><span/> ORDER NETWORK</span>{canManage&&!readOnly&&<button type="button" onClick={()=>setCreateDraft(draftNew())}>+ Post buy order</button>}</div>
  </header>
  {error&&<p className="alert" role="alert">{error.replaceAll('_',' ')}</p>}
  {notice&&<p className="eo-exchange-confirmation" role="status">{notice}</p>}
  <div className="eo-exchange-metrics">
   <div><span>OPEN BUY ORDERS</span><strong>{fmt(open.length)}</strong><small>Active foreign requests</small></div>
   <div><span>GOODS IN DEMAND</span><strong>{fmt(grouped.length)}</strong><small>Types requested</small></div>
   <div><span>UNFILLED UNITS</span><strong>{fmt(demand)}</strong><small>Remaining order volume</small></div>
   <div><span>BUYING PARTNERS</span><strong>{fmt(routeCount)}</strong><small>Factions and settlements</small></div>
  </div>
  <nav className="eo-exchange-views" aria-label="Exchange sections">
   <button type="button" className={view==='market'?'current':''} onClick={()=>setView('market')}>Market <small>{grouped.length}</small></button>
   <button type="button" className={view==='orders'?'current':''} onClick={()=>setView('orders')}>All orders <small>{contracts.length}</small></button>
   <button type="button" className={view==='trades'?'current':''} onClick={()=>setView('trades')}>Trade history</button>
  </nav>
  <div className="eo-exchange-character"><span>TRADE AS</span><select value={characterId} aria-label="Character to trade as" onChange={e=>{setCharacterId(e.target.value);setEquipmentItemId('')}}><option value="">Select your character</option>{owner.map(c=><option key={c.id} value={c.id}>{c.name||c.character_name} · Level {c.level||1}</option>)}</select><label className="eo-front-trade-source">SHIPMENT SOURCE <select value={frontId} onChange={e=>{setFrontId(e.target.value);setQuantity(1);setNotice('')}}><option value="">FC common stores</option>{fronts.map(front=><option key={front.id} value={front.id}>{front.name} · Licensed front</option>)}</select></label><span className="eo-exchange-store"><span className="eo-exchange-dot"/>{frontId?'Goods must be allocated to '+(selectedFront?.name||'the chosen front')+'; sale proceeds are shared with the Order treasury.':'FC common stores supply material orders; crafted gear comes from your character bag.'}</span></div>
  {view==='market'&&<>
   <div className="eo-exchange-toolbar"><label className="eo-exchange-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search goods, buyers or orders…" value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search exchange"/></label>
    <select aria-label="Buyer type" value={marketScope} onChange={e=>{setMarketScope(e.target.value);setSelectedItem('')}}><option value="all">All buyers</option><option value="order_story">Order connections</option><option value="world">Independent factions</option><option value="settlement">Settlements</option></select>
    <select aria-label="Sort market goods" value={sort} onChange={e=>setSort(e.target.value)}><option value="demand">Most demand</option><option value="reward">Highest standing</option><option value="name">Name A–Z</option></select>
    <label className="eo-exchange-stock-toggle"><input type="checkbox" checked={stockOnly} onChange={e=>setStockOnly(e.target.checked)}/> In our stores</label>
   </div>
   <div className="eo-exchange-categories" aria-label="Goods categories">{categories.map(([id,label])=><button type="button" key={id} className={category===id?'current':''} onClick={()=>{setCategory(id);setSelectedItem('')}}>{label}<small>{id==='all'?scopeItems.length:scopeItems.filter(g=>g.category===id).length}</small></button>)}</div>
   <div className="eo-exchange-layout">
    <section className="eo-exchange-board" aria-label="Goods market"><header><span>GOODS</span><span>STOCK</span><span>DEMAND</span><span>TOP OFFER</span></header>
     <div className="eo-exchange-goods">{items.map(g=><button type="button" className={'eo-exchange-good '+(chosen?.id===g.id?'current':'')} key={g.id} onClick={()=>selectItem(g)} aria-pressed={chosen?.id===g.id}>
      <span className={'eo-exchange-item-icon '+g.category}>{ICONS[g.category]||'▣'}</span><span className="eo-exchange-good-title"><strong>{g.name}</strong><small>{g.shownOffers.length} buy order{g.shownOffers.length!==1?'s':''} · {g.kind==='equipment'?'Equipment':'FC material'}</small></span>
      <span className="eo-exchange-good-num">{fmt(availableFor(g))}</span><span className="eo-exchange-good-num">{fmt(g.shownOffers.reduce((n,c)=>n+remain(c),0))}</span>
      <span className="eo-exchange-good-offer">+{Math.max(...g.shownOffers.map(c=>Number(c.rep_per_unit)))}<small>/ unit</small></span>
     </button>)}
     {!items.length&&<div className="eo-exchange-no-goods"><strong>Nothing matches this market view</strong><p>Try another category or buyer filter. New orders appear here when Order command posts them.</p></div>}</div>
    </section>
    <section className="eo-exchange-book" aria-label="Foreign buy orders">
     {chosen?<><header><span className="eo-exchange-overline">MARKET / {chosen.category.toUpperCase()}</span><h3>{chosen.name}</h3><p>{chosen.kind==='equipment'?'Individually crafted and unequipped gear from a character sheet.':'Material shipments come from the FC-wide common storeroom.'}</p></header>
      <div className="eo-exchange-item-stats"><div><span>AVAILABLE TO SUPPLY</span><strong>{fmt(availableFor(chosen))}</strong></div><div><span>OPEN DEMAND</span><strong>{fmt(chosen.shownOffers.reduce((n,c)=>n+remain(c),0))}</strong></div><div><span>BUYERS</span><strong>{new Set(chosen.shownOffers.map(c=>c.faction_id)).size}</strong></div></div>
      <div className="eo-exchange-order-label"><h4>Buy orders</h4><span>Best standing reward first</span></div>
      <div className="eo-exchange-offers"><div className="eo-exchange-offers-head"><span>BUYER</span><span>REMAINING</span><span>STANDING / UNIT</span></div>
       {offers.map(c=><button type="button" key={c.id} className={'eo-exchange-offer '+(order?.id===c.id?'current':'')} onClick={()=>selectOrder(c)} aria-pressed={order?.id===c.id}><span><strong>{c.faction_name}</strong><small>{c.title}{c.auto_created?' · Market generated':''} · {c.faction_scope==='settlement'?'Settlement':'Faction'}</small></span><span>{fmt(remain(c))} / {fmt(c.required_quantity)}</span><b>+{c.rep_per_unit}</b></button>)}
      </div>
      {order&&<div className="eo-exchange-ticket"><div className="eo-exchange-ticket-heading"><strong>Sell to this buyer</strong><small>ORDER #{order.id}</small></div>
       <p>{order.description||'Deliver the requested goods to improve this partner’s standing toward the Order.'}</p>
       {order.item_kind==='material'?<div className="eo-exchange-ticket-amount"><label>Quantity to deliver<input type="number" min="1" max={Math.min(100,remain(order))} value={quantity} onChange={e=>setQuantity(e.target.value)}/></label><div><span>Available at {frontId?selectedFront?.name||"front":"FC stores"}</span><strong>{fmt(availableStock(order.material_id))}</strong><small>Up to {fmt(maxDeliverable)} can be sent now</small></div><button type="button" disabled={!maxDeliverable} onClick={()=>setQuantity(maxDeliverable)}>Max</button></div>:
        <label className="eo-exchange-equipment-picker">Crafted item<select value={equipmentItemId} onChange={e=>setEquipmentItemId(e.target.value)}><option value="">Select unequipped equipment</option>{eligible.map(i=><option key={i.id} value={i.id}>{i.name} · Item #{i.id}</option>)}</select><small>{eligible.length} eligible item{eligible.length===1?'':'s'} in this character's bag</small></label>}
       <div className="eo-exchange-ticket-summary"><div><span>Offer</span><strong>+{order.rep_per_unit} standing / item</strong></div><div><span>Shipment</span><strong>{desired} item{desired===1?'':'s'}</strong></div><div><span>Estimated standing gain</span><strong className="positive">+{reward}*</strong></div><div><span>Gil paid to the Order treasury</span><strong className="positive">+{fmt(saleIncome)} gil</strong></div></div>
       {Number(order.sale_value_per_unit||0)===0&&<small className="eo-exchange-reward-note">This older trade agreement has no gil sale value yet. Order command can set one below. Reputation still applies.</small>}<small className="eo-exchange-reward-note">*Reputation is capped at +100 for each partner. Actual gain may be lower near that cap.</small>
       <button type="button" className="eo-exchange-sell" disabled={!validDeliver} onClick={()=>setReview(true)}>Review shipment</button>
       {!character&&<p className="eo-exchange-help">Select your character sheet above to trade.</p>}
       {character&&order.item_kind==='material'&&!maxDeliverable&&<p className="eo-exchange-help">The FC stores need more of this material. Gather or craft it in Workshop & Garden.</p>}
       {character&&order.item_kind==='equipment'&&!eligible.length&&<p className="eo-exchange-help">Craft this item in the existing Workshop, then leave it unequipped to trade.</p>}
       {canManage&&!readOnly&&<button type="button" className="eo-exchange-pause" disabled={busy} onClick={()=>setPriceEdit({id:order.id,value:order.sale_value_per_unit||0,title:order.title})}>Set gil / unit</button>}{canManage&&!readOnly&&<button type="button" className="eo-exchange-pause" disabled={busy} onClick={()=>statusChange(order)}>{order.status==='paused'?'Reopen order':'Pause this order'}</button>}
      </div>}
     </>:<div className="eo-exchange-no-goods"><strong>Choose goods to inspect demand</strong><p>Buyers and available shipments appear here.</p></div>}
    </section>
   </div>
  </>}
  {view==='orders'&&<section className="eo-exchange-orders-page"><div><h3>All purchase requests</h3><p>Active and fulfilled orders from the Order's foreign trade partners. Select any open order to trade on the market.</p></div><div className="eo-exchange-orders-scroll"><table><thead><tr><th>Good</th><th>Buyer</th><th>Filled</th><th>Standing / item</th><th>Status</th><th></th></tr></thead><tbody>{contracts.map(c=><tr key={c.id}><td><strong>{nameOf(c,materials,templates)}</strong><small>{c.title}</small></td><td>{c.faction_name}</td><td>{fmt(c.delivered_quantity)} / {fmt(c.required_quantity)}</td><td className="positive">+{c.rep_per_unit}</td><td><span className={'eo-exchange-order-status '+c.status}>{c.status}</span></td><td>{c.status==='open'?<button type="button" onClick={()=>{setView('market');setSearch('');setCategory('all');setMarketScope('all');setStockOnly(false);setSelectedItem(goodsId(c));setSelectedOrder(c.id)}}>Trade</button>:canManage&&!readOnly&&c.status==='paused'?<button type="button" disabled={busy} onClick={()=>statusChange(c)}>Reopen</button>:null}</td></tr>)}</tbody></table>{!contracts.length&&<p className="eo-exchange-help">No purchase requests yet.</p>}</div></section>}
  {view==='trades'&&<section className="eo-exchange-orders-page"><div className="eo-exchange-trades-head"><div><h3>Executed deliveries</h3><p>Actual shipments recorded by the server. These are the completed trades that affected faction standing.</p></div><div className="eo-exchange-trades-filters"><button type="button" className={tradeScope==='all'?'current':''} onClick={()=>setTradeScope('all')}>FC trades</button><button type="button" className={tradeScope==='mine'?'current':''} onClick={()=>setTradeScope('mine')}>My deliveries</button></div></div><div className="eo-exchange-orders-scroll"><table><thead><tr><th>Date</th><th>Delivering member</th><th>Buyer / good</th><th>Quantity</th><th>Standing gained</th></tr></thead><tbody>{groupedHistory.map(t=>{const c=contracts.find(c=>String(c.id)===String(t.contract_id));return <tr key={t.id}><td>{shortDate(t.created_at)}</td><td>{t.display_name}</td><td><strong>{c?.faction_name||'Trade partner'}</strong><small>{c?nameOf(c,materials,templates):'Contract #'+t.contract_id}</small></td><td>{fmt(t.quantity)}</td><td className="positive">+{t.reputation_change}</td></tr>})}</tbody></table>{!groupedHistory.length&&<p className="eo-exchange-help">{tradeScope==='mine'?'You have not delivered goods yet.':'No deliveries have been made yet.'}</p>}</div></section>}
  {review&&order&&<div className="eo-commerce-modal-mask"><section className="eo-exchange-review" role="dialog" aria-modal="true" aria-label="Confirm shipment"><span>CONFIRM DELIVERY</span><h3>Review your shipment</h3><p>This will permanently transfer goods out of the FC stockpile or your character's equipment bag.</p><dl><div><dt>Buyer</dt><dd>{order.faction_name}</dd></div><div><dt>Goods</dt><dd>{nameOf(order,materials,templates)}</dd></div><div><dt>Quantity</dt><dd>{desired}</dd></div><div><dt>Standing reward</dt><dd>Up to +{reward}</dd></div><div><dt>Order treasury revenue</dt><dd>+{fmt(saleIncome)} gil</dd></div></dl><div className="eo-exchange-review-actions"><button type="button" disabled={busy} onClick={()=>setReview(false)}>Cancel</button><button type="button" disabled={!validDeliver} onClick={commit}>{busy?'Sending…':'Confirm and deliver'}</button></div></section></div>}
  {priceEdit&&<div className="eo-commerce-modal-mask"><section className="eo-exchange-review" role="dialog" aria-modal="true" aria-label="Set trade sale value"><span>TRADE PRICING</span><h3>{priceEdit.title}</h3><p>Choose how much gil the buying faction pays into the FC treasury per accepted item. This applies only to future deliveries.</p><label>Gil per item<input type="number" min="0" max="100000" value={priceEdit.value} onChange={e=>setPriceEdit({...priceEdit,value:e.target.value})}/></label><div className="eo-exchange-review-actions"><button type="button" onClick={()=>setPriceEdit(null)}>Cancel</button><button type="button" disabled={busy||Number(priceEdit.value)<0||Number(priceEdit.value)>100000} onClick={savePrice}>Save price</button></div></section></div>}
 {createDraft&&<div className="eo-commerce-modal-mask"><section className="eo-commerce-modal" role="dialog" aria-modal="true" aria-label="Post a buy order"><header><h3>Post a foreign buy order</h3><button type="button" aria-label="Close" onClick={()=>{setCreateDraft(null);setError('')}}>×</button></header>{error&&<p className="alert">{error}</p>}<p className="eo-exchange-help">Specify what a faction or settlement wants to buy. Members can fill this request with FC materials or crafted equipment.</p>
   <label>Buying faction or settlement<select value={createDraft.faction_id} onChange={e=>setCreateDraft({...createDraft,faction_id:e.target.value})}><option value="">Choose buyer</option>{factions.map(f=><option key={f.id} value={f.id}>{f.name} · {f.faction_scope==='settlement'?'Settlement':'Faction'}</option>)}</select></label>
   <label>Order title<input maxLength={130} value={createDraft.title} onChange={e=>setCreateDraft({...createDraft,title:e.target.value})}/></label>
   <label>Order details<textarea maxLength={600} value={createDraft.description} onChange={e=>setCreateDraft({...createDraft,description:e.target.value})}/></label>
   <label>Goods type<select value={createDraft.item_kind} onChange={e=>setCreateDraft({...createDraft,item_kind:e.target.value,item_id:''})}><option value="material">FC shared materials / provisions</option><option value="equipment">Crafted weapon, armor or tool</option></select></label>
   <label>Good requested<MaterialPicker catalog={createDraft.item_kind==='material'?materials:templates} value={createDraft.item_id} onChange={e=>setCreateDraft({...createDraft,item_id:e.target.value})}><option value="">Select goods</option>{(createDraft.item_kind==='material'?materials:templates).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</MaterialPicker></label>
   <div className="eo-commerce-three"><label>Units requested<input type="number" min="1" max="100000" value={createDraft.required_quantity} onChange={e=>setCreateDraft({...createDraft,required_quantity:e.target.value})}/></label><label>Standing per item<input type="number" min="1" max="20" value={createDraft.rep_per_unit} onChange={e=>setCreateDraft({...createDraft,rep_per_unit:e.target.value})}/></label><label>Gil paid to FC per item<input type="number" min="0" max="100000" value={createDraft.sale_value_per_unit} onChange={e=>setCreateDraft({...createDraft,sale_value_per_unit:e.target.value})}/></label></div>
   <button type="button" className="btn primary" disabled={busy||!createDraft.faction_id||!createDraft.item_id||!createDraft.title.trim()} onClick={createOrder}>Publish buy order</button></section></div>}
 </section>;
}
