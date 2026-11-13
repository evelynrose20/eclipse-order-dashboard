import MaterialPicker from './MaterialPicker.jsx';
import SearchPicker from './SearchPicker';
import React,{useEffect,useMemo,useState} from 'react';
import './fronts.css';

const CATEGORIES={tavern:'Tavern & Hospitality',apothecary:'Apothecary',workshop:'Artisan Workshop',merchant:'Merchant House',hospitality:'Guesthouse & Services',other:'Other Enterprise'};
const SYMBOLS={tavern:'mug-hot',apothecary:'flask',workshop:'hammer',merchant:'store',hospitality:'hotel',other:'building'};
const gil=value=>Number(value||0).toLocaleString()+' gil';
const newApplication=()=>({name:'',category:'merchant',location:'',description:'',ownership:'member',owner_character_id:'',license_terms:''});
const newOffer=()=>({offer_type:'goods',material_id:'',name:'',description:'',posted_price:5,restricted:false});
export default function Fronts({request,characters=[],userId='',canManage=false,canApproveSite=false,readOnly=false}){
 const [registry,setRegistry]=useState([]);
 const [selected,setSelected]=useState(null);
 const [detail,setDetail]=useState(null);
 const [materials,setMaterials]=useState([]);
 const [reservedGoods,setReservedGoods]=useState([]);
 const [reservedTransfer,setReservedTransfer]=useState({character_id:'',material_id:'',quantity:1});
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [search,setSearch]=useState('');
 const [filter,setFilter]=useState('all');
 const [tab,setTab]=useState('storefront');
 const [application,setApplication]=useState(null);
 const [offering,setOffering]=useState(null);
 const [staff,setStaff]=useState({character_id:'',staff_role:'employee'});
 const [stock,setStock]=useState({material_id:'',quantity:1,direction:'allocate',character_id:''});
 const [costDraft,setCostDraft]=useState(null);
 const [supplyDraft,setSupplyDraft]=useState({material_id:'',daily_quantity:1});
 const [license,setLicense]=useState(null);
 const [changeDraft,setChangeDraft]=useState(null);
 const command=canManage&&!readOnly;
 const siteCommand=canApproveSite&&!readOnly;
 const ownCharacters=characters.filter(c=>(c.player_user_id||c.player_account_id)===userId);
 async function refresh(preferred=selected){
  const [directory,workshop,reserved]=await Promise.all([request('/fronts'),request('/workshop'),request('/workshop/reserved')]);
  setRegistry(directory.fronts||[]);setMaterials(workshop.materials||[]);setReservedGoods(reserved.goods||[]);
  const next=preferred||(directory.fronts||[])[0]?.id;
  if(next){const f=(directory.fronts||[]).find(x=>String(x.id)===String(next));if(f){
   setSelected(f.id);
   const d=await request('/fronts/'+f.id);setDetail(d);return
  }}
  setSelected(null);setDetail(null);
 }
 useEffect(()=>{refresh().catch(e=>setError(e.message))},[]);
 const fronts=registry.filter(f=>(filter==='all'||(filter==='mine'&&f.can_manage)||(filter==='pending'&&f.status==='pending')||f.category===filter)&&
  [f.name,f.location,f.description,f.owner_name].some(v=>String(v||'').toLowerCase().includes(search.trim().toLowerCase())));
 const chosen=detail?.front;
 const manage=!!chosen?.can_manage&&!readOnly;
 const active=chosen?.status==='active';
 const materialName=id=>materials.find(m=>m.id===id)?.name||id;
 const sharedStock=id=>Number(materials.find(m=>m.id===id)?.quantity||0);
 const localStock=id=>Number(detail?.stocks.find(s=>s.material_id===id)?.quantity||0);
 const ownerCharacter=ownCharacters.find(c=>c.id===application?.owner_character_id);
 const stats={active:registry.filter(f=>f.status==='active').length,pending:registry.filter(f=>f.status==='pending').length,member:registry.filter(f=>f.ownership==='member').length};
 async function act(path,body,message,method='POST'){
  setBusy(true);setError('');setNotice('');
  try{const response=await request(path,{method,body});await refresh(response.id||selected);setNotice(message);return response}
  catch(e){setError(e.message||String(e));return null}
  finally{setBusy(false)}
 }
 async function pick(frontId){
  setSelected(frontId);setTab('storefront');setError('');setNotice('');
  try{setDetail(await request('/fronts/'+frontId))}catch(e){setError(e.message)}
 }
 const submitApplication=async()=>{
  const response=await act('/fronts',application,'Your enterprise application has entered the approval ledger.');
  if(response)setApplication(null);
 };
 const approve=(stage,approved)=>act('/fronts/'+selected+'/approve',{stage,approved},'Approval record updated.');
 const updateStatus=status=>act('/fronts/'+selected+'/status',{status},'Enterprise operating status updated.');
 const saveLicense=async()=>{
  const r=await act('/fronts/'+selected+'/license',{...license,order_share_percent:Number(license.order_share_percent)},'Licensed terms updated.');
  if(r)setLicense(null);
 };
 const requestChange=async()=>{
  const response=await act('/fronts/'+selected+'/changes',changeDraft,'The request has been submitted to Order command for approval.');
  if(response)setChangeDraft(null);
 };
 const reviewChange=(entry,decision)=>act('/fronts/'+selected+'/changes/'+entry.id+'/review',{decision},'License request reviewed.');
 const addOffering=async()=>{
  const r=await act('/fronts/'+selected+'/offerings',{...offering,posted_price:Number(offering.posted_price),material_id:offering.offer_type==='goods'?offering.material_id:null},'Storefront listing published.');
  if(r)setOffering(null);
 };
 const addStaff=()=>act('/fronts/'+selected+'/staff',staff,'Employee roster updated.');
 const moveStock=()=>act('/fronts/'+selected+'/stock',{...stock,quantity:Number(stock.quantity)},'Front stock and shared FC stores reconciled.');
 const deliverReserved=()=>act('/fronts/'+selected+'/reserved-stock',{...reservedTransfer,quantity:Number(reservedTransfer.quantity)},'Your reserved crafted goods have been delivered to this enterprise.');
 const saveSupplies=()=>act('/fronts/'+selected+'/supply-requirements',{material_id:supplyDraft.material_id,daily_quantity:Number(supplyDraft.daily_quantity)},'Daily material requirement updated.');
 const saveCosts=async()=>{
  const b=costDraft;const result=await act('/fronts/'+selected+'/operating-costs',{daily_rent:Number(b.daily_rent),daily_upkeep:Number(b.daily_upkeep)},'Daily operating costs updated for the next reset.');
  if(result)setCostDraft(null);
 };
 return <section className="eo-fronts">
  <header className="eo-fronts-hero">
   <div><span>THE GOLDEN CLAWS · COMMERCIAL NETWORK</span><h2>Order Enterprises</h2><p>Businesses sanctioned by the Order. Two approvals establish a license; the Merchant Exchange funds their books through fulfilled trade.</p></div>
   <div className="eo-fronts-hero-mark" aria-hidden="true"><i className="fa-solid fa-store"/></div>
  </header>
  {error&&<div className="alert" role="alert">{error.replaceAll('_',' ')}</div>}
  {notice&&<div className="eo-fronts-success" role="status">{notice}</div>}
  <div className="eo-fronts-stats"><div><span>LICENSED & ACTIVE</span><strong>{stats.active}</strong></div><div><span>AWAITING APPROVAL</span><strong>{stats.pending}</strong></div><div><span>MEMBER-OWNED</span><strong>{stats.member}</strong></div></div>
  <div className="eo-fronts-actions"><label><span>Search the commercial registry</span><input type="search" value={search} placeholder="Businesses, owners, locations…" onChange={e=>setSearch(e.target.value)}/></label>
   <select aria-label="Filter enterprises" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All enterprises</option><option value="mine">My operations</option><option value="pending">Pending applications</option>{Object.entries(CATEGORIES).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>
   {!readOnly&&<button className="eo-fronts-apply" type="button" onClick={()=>{setApplication(newApplication());setError('')}}>+ Apply for an enterprise</button>}
  </div>
  <div className="eo-fronts-layout">
   <aside className="eo-fronts-directory" aria-label="Order business registry">
    <div className="eo-fronts-directory-head"><strong>LICENSED NETWORK</strong><small>{fronts.length} recorded</small></div>
    {fronts.map(front=><button key={front.id} type="button" className={'eo-fronts-location '+(String(selected)===String(front.id)?'selected':'')} onClick={()=>pick(front.id)}>
      <span className="eo-fronts-location-icon"><i className={"fa-solid fa-"+(SYMBOLS[front.category]||"building")}/></span><span><strong>{front.name}</strong><small>{front.location}</small><em>{CATEGORIES[front.category]||front.category}</em></span><span className={'eo-fronts-status '+front.status}>{front.status}</span>
    </button>)}
    {!fronts.length&&<div className="eo-fronts-empty"><strong>No storefronts found</strong><p>Apply to establish a licensed Order enterprise or try a different filter.</p></div>}
   </aside>
   {chosen?<main className="eo-fronts-detail">
    <div className="eo-fronts-detail-cover">
     <div className="eo-fronts-signage" aria-hidden="true"><i className={"fa-solid fa-"+(SYMBOLS[chosen.category]||"building")}/></div>
     <div><span>{CATEGORIES[chosen.category]||'Order Enterprise'} · {chosen.location}</span><h3>{chosen.name}</h3><p>{chosen.description||'A licensed enterprise supporting the Eclipse Order.'}</p></div>
     <span className={'eo-fronts-status '+chosen.status}>{chosen.status}</span>
    </div>
    <div className="eo-fronts-ownership">
     <div><span>OPERATED BY</span><strong>{chosen.ownership==='order'?'The Eclipse Order':chosen.owner_name||'Member character'}</strong></div>
     {manage&&<div><span>ENTERPRISE CASH RESERVE</span><strong>{gil(chosen.balance)}</strong></div>}
     {manage&&<div><span>ORDER TRADE SHARE</span><strong>{chosen.order_share_percent}%</strong></div>}
    </div>
    <nav className="eo-fronts-tabs" aria-label="Enterprise sections">
     {[['storefront','Storefront'],...(manage?[['stock','Goods & Stock'],['staff','Employees'],['accounts','Enterprise Accounts'],['license','License & Approvals']]:[])].map(([id,label])=><button key={id} type="button" className={tab===id?'selected':''} onClick={()=>setTab(id)}>{label}</button>)}
    </nav>
    {tab==='storefront'&&<div className="eo-fronts-section">
     <div className="eo-fronts-section-head"><div><span>PUBLIC CATALOG</span><h4>Goods & Services</h4></div>{manage&&active&&<button type="button" onClick={()=>setOffering(newOffer())}>+ Add offering</button>}</div>
     <div className="eo-fronts-offers">{(detail.offers||[]).filter(o=>o.is_active||manage).map(o=><article key={o.id}><span className="eo-fronts-offer-icon">{o.offer_type==='service'?'✧':'▣'}</span><div><small>{o.offer_type==='service'?'IN-CHARACTER SERVICE':'STOREFRONT GOODS'}</small><strong>{o.name}</strong><p>{o.description}</p>{o.restricted&&<small>Restricted service · approved</small>}{o.offer_type==='goods'&&manage&&<small>{localStock(o.material_id)} allocated · {materialName(o.material_id)}</small>}</div><div className="eo-fronts-offer-right"><strong>{gil(o.posted_price)}</strong>{manage&&o.is_active&&<button type="button" disabled={busy} onClick={()=>act('/fronts/'+selected+'/offerings/'+o.id,null,'Offering retired.','DELETE')}>Retire</button>}</div></article>)}
      {!detail.offers?.length&&<div className="eo-fronts-empty"><strong>The shelves are not stocked yet.</strong><p>Once approved, the enterprise manager can publish offerings using the Order's existing materials.</p></div>}
     </div>
     <p className="eo-fronts-notice">Posted services and prices are in-character listings, not automatic income. Trade proceeds enter the accounts only after accepted Merchant Exchange deliveries.</p>
    </div>}
    {tab==='stock'&&manage&&<div className="eo-fronts-section"><div className="eo-fronts-section-head"><div><span>PHYSICAL STOCK LEDGER</span><h4>Allocated supplies</h4></div></div>
     <div className="eo-fronts-stock-list">{detail.stocks?.map(row=><div key={row.material_id}><strong>{row.name}</strong><span>{row.quantity} units held at this enterprise</span><small>{sharedStock(row.material_id)} in FC central stores</small></div>)}{!detail.stocks?.length&&<p>There are no goods allocated to this front yet.</p>}</div>
     {active&&<div className="eo-fronts-form"><h5>Move stock between the FC and this front</h5><div className="eo-fronts-fields"><label>Material<MaterialPicker value={stock.material_id} onChange={value=>setStock({...stock,material_id:value})} options={materials} placeholder="Choose material" ariaLabel="Choose material"/></label><label>Direction<select value={stock.direction} onChange={e=>setStock({...stock,direction:e.target.value})}><option value="allocate">FC stores → front</option><option value="return">Front → FC stores</option></select></label><label>Units<input type="number" min="1" max="100000" value={stock.quantity} onChange={e=>setStock({...stock,quantity:e.target.value})}/></label><label>Working character<select value={stock.character_id} onChange={e=>setStock({...stock,character_id:e.target.value})}><option value="">Choose character sheet</option>{ownCharacters.map(c=><option key={c.id} value={c.id}>{c.name||c.character_name}</option>)}</select></label></div><button disabled={busy||!stock.material_id||!stock.character_id} type="button" onClick={moveStock}>Confirm stock transfer</button></div>}
     {active&&<div className="eo-fronts-form eo-front-reserved-transfer"><h5>Deliver your protected crafted goods</h5><p>Goods reserved in the Workshop belong to their maker until delivered here. They do not appear in the FC's general stockpile.</p><div className="eo-fronts-fields"><label>Your character<select value={reservedTransfer.character_id} onChange={e=>setReservedTransfer({...reservedTransfer,character_id:e.target.value,material_id:''})}><option value="">Choose character</option>{ownCharacters.map(c=><option key={c.id} value={c.id}>{c.name||c.character_name}</option>)}</select></label><label>Reserved batch<MaterialPicker value={reservedTransfer.material_id} onChange={value=>setReservedTransfer({...reservedTransfer,material_id:value})} options={reservedGoods.filter(g=>g.character_id===reservedTransfer.character_id).map(g=>({id:g.material_id,name:g.name,description:g.quantity+' held'}))} placeholder="Select reserved material" ariaLabel="Select reserved material"/></label><label>Quantity<input type="number" min="1" max="100" value={reservedTransfer.quantity} onChange={e=>setReservedTransfer({...reservedTransfer,quantity:e.target.value})}/></label></div><button type="button" disabled={busy||!reservedTransfer.character_id||!reservedTransfer.material_id||Number(reservedTransfer.quantity)<1||Number(reservedTransfer.quantity)>Number(reservedGoods.find(g=>g.character_id===reservedTransfer.character_id&&g.material_id===reservedTransfer.material_id)?.quantity||0)} onClick={deliverReserved}>Deliver reserved batch</button></div>}
     <p className="eo-fronts-notice">Allocated stock moves out of the shared FC inventory. Enterprise shipments from the Merchant Exchange consume these allocated units, preventing double-counting.</p>
    </div>}
    {tab==='staff'&&manage&&<div className="eo-fronts-section"><div className="eo-fronts-section-head"><div><span>THE WORKFORCE</span><h4>Employees & Managers</h4></div></div>
     <div className="eo-fronts-staff-list">{detail.staff?.map(p=><article key={p.character_id}><div><strong>{p.character_name}</strong><small>{p.staff_role}</small></div>{active&&<button type="button" disabled={busy} onClick={()=>act('/fronts/'+selected+'/staff/'+p.character_id,null,'Employee removed.','DELETE')}>Remove</button>}</article>)}{!detail.staff?.length&&<p>No employees assigned yet.</p>}</div>
     {active&&<div className="eo-fronts-form"><h5>Appoint a worker</h5><div className="eo-fronts-fields"><label>Character<select value={staff.character_id} onChange={e=>setStaff({...staff,character_id:e.target.value})}><option value="">Choose character</option>{characters.map(c=><option key={c.id} value={c.id}>{c.name||c.character_name}</option>)}</select></label><label>Staff role<select value={staff.staff_role} onChange={e=>setStaff({...staff,staff_role:e.target.value})}><option value="employee">Employee · Can ship goods</option><option value="manager">Manager · Can manage front</option></select></label></div><button type="button" disabled={busy||!staff.character_id} onClick={addStaff}>Assign staff member</button></div>}
    </div>}
    {tab==='accounts'&&manage&&<div className="eo-fronts-section"><div className="eo-fronts-section-head"><div><span>ENTERPRISE FINANCES</span><h4>Revenue & Expenses</h4></div><strong className="eo-fronts-account-balance">{gil(chosen.balance)}</strong></div>
     <p className="eo-fronts-notice">Enterprise funds are retained from real trade deliveries. The Order's contracted share remains in the main treasury and pays for Order obligations.</p>
     <div className="eo-fronts-ledger">{detail.ledger?.map((row,i)=><div key={i}><span>{row.kind==='trade_income'?'TRADE EARNINGS':'OPERATING EXPENSE'}<small>{row.description} · {new Date(row.created_at).toLocaleDateString()}</small></span><strong className={row.kind==='trade_income'?'income':'expense'}>{row.kind==='trade_income'?'+':'−'}{gil(row.amount)}</strong><small>{gil(row.balance_after)} left</small></div>)}{!detail.ledger?.length&&<p>No booked transactions yet.</p>}</div>
     <div className="eo-fronts-form"><div className="eo-fronts-section-head"><div><span>DAILY BUSINESS COSTS</span><h5>Automatic upkeep</h5></div>{command&&<button type="button" onClick={()=>setCostDraft({daily_rent:chosen.daily_rent,daily_upkeep:chosen.daily_upkeep})}>Adjust costs</button>}</div><div className="eo-fronts-cost-summary"><div><span>Rent</span><strong>{gil(chosen.daily_rent)}</strong></div><div><span>Maintenance</span><strong>{gil(chosen.daily_upkeep)}</strong></div><div className="total"><span>Total per reset</span><strong>{gil(Number(chosen.daily_rent||0)+Number(chosen.daily_upkeep||0))}</strong></div></div><div className="eo-fronts-supply-board"><div className="eo-fronts-section-head"><div><span>CRAFTED GOODS · DAILY CONSUMPTION</span><h5>Supply Requirements</h5></div></div><p>These goods must be crafted or gathered through the existing Workshop and allocated from FC Stores to the front. Every reset consumes available supplies; missing units are recorded rather than replaced with gil.</p><div className="eo-fronts-supply-list">{(detail.supply_requirements||[]).map(item=><div key={item.material_id}><div><strong>{item.name}</strong><small>{item.stock_quantity} held · {item.daily_quantity} needed each reset</small></div><span className={Number(item.stock_quantity)<Number(item.daily_quantity)?'missing':'ready'}>{Number(item.stock_quantity)<Number(item.daily_quantity)?'Short '+(item.daily_quantity-item.stock_quantity):'Ready'}</span>{command&&<button type="button" disabled={busy} onClick={()=>act('/fronts/'+selected+'/supply-requirements',{material_id:item.material_id,daily_quantity:0},'Supply requirement removed.')}>Remove</button>}</div>)}{!detail.supply_requirements?.length&&<p>No daily material requirements have been configured yet.</p>}</div>{command&&<div className="eo-fronts-fields"><label>Crafted supply<MaterialPicker value={supplyDraft.material_id} onChange={value=>setSupplyDraft({...supplyDraft,material_id:value})} options={materials} placeholder="Choose a material" ariaLabel="Choose a material"/></label><label>Units each reset<input type="number" min="1" max="100000" value={supplyDraft.daily_quantity} onChange={e=>setSupplyDraft({...supplyDraft,daily_quantity:e.target.value})}/></label><button type="button" disabled={busy||!supplyDraft.material_id||Number(supplyDraft.daily_quantity)<1} onClick={saveSupplies}>Set requirement</button></div>}{detail.daily_supplies?.length>0&&<div className="eo-fronts-cost-history"><h5>Consumed supply history</h5>{detail.daily_supplies.slice(0,12).map((entry,i)=><div key={String(entry.cycle_date)+entry.material_id+i}><span>{String(entry.cycle_date).slice(0,10)} · {entry.name}</span><strong>{entry.consumed_quantity} / {entry.required_quantity} used</strong>{Number(entry.missing_quantity)>0&&<small>Missing: {entry.missing_quantity}</small>}</div>)}</div>}</div><p className="eo-fronts-notice">Rent and maintenance are paid from the front reserve at reset. Supplies are consumed from crafted goods allocated to the front. Members do not pay them. If the reserve is insufficient, only available funds are spent; no character wallet or Order treasury funds are taken.</p>{detail.daily_expenses?.length>0&&<div className="eo-fronts-cost-history"><h5>Daily deductions</h5>{detail.daily_expenses.slice(0,7).map(row=><div key={String(row.cycle_date)}><span>{String(row.cycle_date).slice(0,10)}</span><strong>−{gil(row.paid_total)}</strong>{Number(row.shortfall)>0&&<small>Not covered: {gil(row.shortfall)}</small>}</div>)}</div>}</div>
    </div>}
    {tab==='license'&&manage&&<div className="eo-fronts-section"><div className="eo-fronts-section-head"><div><span>OFFICIAL ORDER AUTHORIZATION</span><h4>License & Approval</h4></div></div>
     <div className="eo-fronts-approvals"><div><strong>In-character approval</strong><p>Order command recognizes the enterprise within the RP organization.</p><span className={chosen.ic_approved?'approved':''}>{chosen.ic_approved?'Approved':'Awaiting approval'}</span>{command&&chosen.status!=='closed'&&<button type="button" disabled={busy} onClick={()=>approve('ic',!chosen.ic_approved)}>{chosen.ic_approved?'Revoke IC approval':'Approve IC application'}</button>}</div><div><strong>Website approval</strong><p>The official front is permitted to operate through the Order portal.</p><span className={chosen.site_approved?'approved':''}>{chosen.site_approved?'Approved':'Awaiting approval'}</span>{siteCommand&&chosen.status!=='closed'&&<button type="button" disabled={busy} onClick={()=>approve('website',!chosen.site_approved)}>{chosen.site_approved?'Revoke website approval':'Approve website application'}</button>}</div></div>
     <p className="eo-fronts-notice">Both approvals are required before listings, inventory allocation, and enterprise trading are enabled.</p>
     <div className="eo-fronts-request-head"><h5>Changes & expansion requests</h5>{manage&&chosen.status!=='closed'&&<button type="button" onClick={()=>setChangeDraft({request_type:'location',requested_value:'',justification:''})}>+ Request a change</button>}</div>
     <div className="eo-fronts-change-list">{(detail.change_requests||[]).map(change=><article key={change.id}><div><strong>{change.request_type.replaceAll('_',' ')}</strong><small>{change.requested_value}</small><p>{change.justification}</p></div><span className={'eo-fronts-status '+change.state}>{change.state}</span>{command&&change.state==='pending'&&<div><button type="button" disabled={busy} onClick={()=>reviewChange(change,'approved')}>Approve</button><button type="button" disabled={busy} onClick={()=>reviewChange(change,'rejected')}>Reject</button></div>}</article>)}{!detail.change_requests?.length&&<p className="eo-fronts-notice">The current license has no change requests.</p>}</div>
     <div className="eo-fronts-license-terms"><strong>Approved operating terms</strong><p>{chosen.license_terms||'No additional terms recorded.'}</p><span>Order share: {chosen.order_share_percent}% of attributable trade revenue</span></div>
     {siteCommand&&<><button type="button" onClick={()=>setLicense({category:chosen.category,location:chosen.location,license_terms:chosen.license_terms||'',order_share_percent:chosen.order_share_percent})}>Edit licensed terms</button><div className="eo-fronts-governance"><button type="button" disabled={busy||chosen.status!=='suspended'} onClick={()=>updateStatus('active')}>Reopen front</button><button type="button" disabled={busy||chosen.status!=='active'} onClick={()=>updateStatus('suspended')}>Suspend operations</button>{siteCommand&&<button type="button" disabled={busy||chosen.status==='closed'} onClick={()=>updateStatus('closed')}>Close front</button>}</div></>}
    </div>}
   </main>:<section className="eo-fronts-detail eo-fronts-empty"><strong>Explore the Order's network</strong><p>Select an enterprise or submit an application to establish a new licensed business.</p></section>}
  </div>
  {application&&<div className="eo-fronts-modal-mask"><section className="eo-fronts-modal" role="dialog" aria-modal="true" aria-label="Apply for an Order enterprise"><header><div><span>THE GOLDEN CLAWS · LICENSE REQUEST</span><h3>Establish an Enterprise</h3></div><button type="button" onClick={()=>setApplication(null)} aria-label="Close">×</button></header>
   <p>All businesses operating under the Order require separate in-character and website approval. Submitting this form does not authorize operations.</p>
   <label>Operating name<input maxLength={110} value={application.name} onChange={e=>setApplication({...application,name:e.target.value})}/></label>
   <div className="eo-fronts-fields"><label>Business category<select value={application.category} onChange={e=>setApplication({...application,category:e.target.value})}>{Object.entries(CATEGORIES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Location<input maxLength={150} value={application.location} placeholder="Ward, district, settlement…" onChange={e=>setApplication({...application,location:e.target.value})}/></label></div>
   <label>Description<textarea maxLength={1200} value={application.description} onChange={e=>setApplication({...application,description:e.target.value})}/></label>
   {command&&<label>Ownership<select value={application.ownership} onChange={e=>setApplication({...application,ownership:e.target.value})}><option value="member">Member-owned</option><option value="order">Order-operated</option></select></label>}
   {application.ownership==='member'&&<label>Owner character sheet<select value={application.owner_character_id} onChange={e=>setApplication({...application,owner_character_id:e.target.value})}><option value="">Select your linked character</option>{ownCharacters.map(c=><option key={c.id} value={c.id}>{c.name||c.character_name}</option>)}</select></label>}
   <button type="button" disabled={busy||!application.name.trim()||!application.location.trim()||(application.ownership==='member'&&!ownerCharacter)} onClick={submitApplication}>Submit application</button>
  </section></div>}
  {offering&&<div className="eo-fronts-modal-mask"><section className="eo-fronts-modal" role="dialog" aria-modal="true" aria-label="Create offering"><header><h3>New Storefront Offering</h3><button type="button" onClick={()=>setOffering(null)} aria-label="Close">×</button></header><label>Listing type<select value={offering.offer_type} onChange={e=>setOffering({...offering,offer_type:e.target.value})}><option value="goods">Material / Good</option><option value="service">Roleplay Service</option></select></label>{offering.offer_type==='goods'&&<label>FC material<MaterialPicker value={offering.material_id} onChange={value=>setOffering({...offering,material_id:value})} options={materials} placeholder="Choose material" ariaLabel="Choose material"/></label>}
    <label>Display name<input maxLength={120} value={offering.name} onChange={e=>setOffering({...offering,name:e.target.value})}/></label><label>What does this enterprise offer?<textarea maxLength={500} value={offering.description} onChange={e=>setOffering({...offering,description:e.target.value})}/></label><label>Posted price in gil<input type="number" min="0" max="100000" value={offering.posted_price} onChange={e=>setOffering({...offering,posted_price:e.target.value})}/></label>{offering.offer_type==='service'&&<label className="eo-fronts-restricted"><input type="checkbox" checked={offering.restricted} onChange={e=>setOffering({...offering,restricted:e.target.checked})}/> Restricted service (requires a previously approved request matching the listing name)</label>}<button type="button" disabled={busy||!offering.name.trim()||(offering.offer_type==='goods'&&!offering.material_id)} onClick={addOffering}>Publish offering</button>
   </section></div>}
  {changeDraft&&<div className="eo-fronts-modal-mask"><section className="eo-fronts-modal" role="dialog" aria-modal="true" aria-label="Request an enterprise change"><header><h3>Request License Change</h3><button type="button" aria-label="Close" onClick={()=>setChangeDraft(null)}>×</button></header><p>Order command must review expansions, relocations, category changes, and restricted services before they take effect.</p>
  <label>Request type<select value={changeDraft.request_type} onChange={e=>setChangeDraft({...changeDraft,request_type:e.target.value,requested_value:''})}><option value="location">Change location</option><option value="category">Change business category</option><option value="expansion">Expand the front</option><option value="restricted_service">Approve a restricted service</option></select></label>
  {changeDraft.request_type==='category'?<label>Requested category<select value={changeDraft.requested_value} onChange={e=>setChangeDraft({...changeDraft,requested_value:e.target.value})}><option value="">Choose category</option>{Object.entries(CATEGORIES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>:<label>{changeDraft.request_type==='restricted_service'?'Exact service listing name':changeDraft.request_type==='location'?'Proposed location':'Expansion details'}<input maxLength={changeDraft.request_type==='location'?150:400} value={changeDraft.requested_value} onChange={e=>setChangeDraft({...changeDraft,requested_value:e.target.value})}/></label>}
  <label>Reason / RP details<textarea maxLength={900} value={changeDraft.justification} onChange={e=>setChangeDraft({...changeDraft,justification:e.target.value})}/></label><button type="button" disabled={busy||!changeDraft.requested_value.trim()} onClick={requestChange}>Submit for approval</button>
 </section></div>}
  {costDraft&&<div className="eo-fronts-modal-mask"><section className="eo-fronts-modal" role="dialog" aria-modal="true" aria-label="Daily operating costs"><header><h3>Enterprise Operating Costs</h3><button type="button" aria-label="Close" onClick={()=>setCostDraft(null)}>×</button></header><p>Rent and maintenance are paid from this front's reserve. Supplies are physical items configured on the finances page, not gil.</p><div className="eo-fronts-fields">{[['daily_rent','Daily rent'],['daily_upkeep','Daily maintenance']].map(([key,label])=><label key={key}>{label} (gil)<input type="number" min="0" max="100000" value={costDraft[key]} onChange={e=>setCostDraft({...costDraft,[key]:e.target.value})}/></label>)}</div><button type="button" disabled={busy||Object.values(costDraft).some(v=>!Number.isInteger(Number(v))||Number(v)<0||Number(v)>100000)} onClick={saveCosts}>Save daily costs</button></section></div>}
  {license&&<div className="eo-fronts-modal-mask"><section className="eo-fronts-modal" role="dialog" aria-modal="true" aria-label="Licensed front terms"><header><h3>Licensed Terms</h3><button type="button" onClick={()=>setLicense(null)} aria-label="Close">×</button></header><label>Approved category<select value={license.category} onChange={e=>setLicense({...license,category:e.target.value})}>{Object.entries(CATEGORIES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Approved location<input maxLength={150} value={license.location} onChange={e=>setLicense({...license,location:e.target.value})}/></label><label>License conditions<textarea maxLength={900} value={license.license_terms} onChange={e=>setLicense({...license,license_terms:e.target.value})}/></label><label>Order share of trade revenue (%)<input type="number" min="0" max="100" value={license.order_share_percent} onChange={e=>setLicense({...license,order_share_percent:e.target.value})}/></label><button disabled={busy} type="button" onClick={saveLicense}>Authorize terms</button></section></div>}
 </section>;
}
