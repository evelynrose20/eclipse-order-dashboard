import React,{useEffect,useMemo,useState} from 'react';
import './commerce.css';

const icon={weapon:'⚔',armor:'⬡',tool:'⚒',accessory:'✧'};
const slug=name=>String(name||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9 -]/g,'').trim().replace(/\s+/g,'-').slice(0,48);
const emptyBlueprint=()=>({name:'',description:'',slot:'weapon',minimum_level:1,attack_bonus:0,defense_bonus:0,tool_bonus:0,ingredients:[{material_id:'',quantity:1}]});
const emptyContract=()=>({title:'',description:'',faction_id:'',item_kind:'material',item_id:'',required_quantity:5,rep_per_unit:2});

export default function Commerce({request,characters=[],canManage=false,readOnly=false,materials=[]}){
 const [commerce,setCommerce]=useState(null);
 const [subtab,setSubtab]=useState('contracts');
 const [characterId,setCharacterId]=useState('');
 const [equipment,setEquipment]=useState([]);
 const [blueprint,setBlueprint]=useState(null);
 const [contractDraft,setContractDraft]=useState(null);
 const [selectedItems,setSelectedItems]=useState({});
 const [quantities,setQuantities]=useState({});
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const ownedCharacters=characters.filter(c=>c.player_user_id||c.player_account_id);
 useEffect(()=>{request('/commerce').then(setCommerce).catch(e=>setError(e.message))},[]);
 useEffect(()=>{if(!characterId&&ownedCharacters.length)setCharacterId(ownedCharacters[0].id)},[characters,characterId]);
 useEffect(()=>{if(!characterId){setEquipment([]);return}let mounted=true;request('/commerce/characters/'+characterId+'/equipment').then(data=>{if(mounted)setEquipment(data.items||[])}).catch(e=>{if(mounted)setError(e.message)});return()=>{mounted=false}},[characterId]);
 const character=ownedCharacters.find(c=>c.id===characterId);
 const level=Number(character?.level)||1;
 const canAct=!!characterId&&!readOnly;
 const templates=commerce?.templates||[];
 const contracts=commerce?.contracts||[];
 const factions=commerce?.factions||[];
 const deliveries=commerce?.deliveries||[];
 const matName=id=>materials.find(m=>m.id===id)?.name||id||'Unknown material';
 const remaining=contract=>Math.max(0,Number(contract.required_quantity)-Number(contract.delivered_quantity));
 async function refresh(){
  const refreshed=await request('/commerce');setCommerce(refreshed);
  if(characterId){const e=await request('/commerce/characters/'+characterId+'/equipment');setEquipment(e.items||[])}
 }
 async function action(path,body,onSuccess){
  setBusy(true);setError('');setNotice('');
  try{const result=await request(path,{method:'POST',body});await refresh();onSuccess?.(result)}
  catch(e){setError(e.message||String(e))}
  finally{setBusy(false)}
 }
 const changeContractStatus=async(contract,status)=>{
  setBusy(true);setError('');setNotice('');
  try{await request('/commerce/contracts/'+contract.id+'/status',{method:'POST',body:{status}});await refresh();setNotice(status==='paused'?'Trade contract paused.':'Trade contract reopened.')}
  catch(e){setError(e.message||String(e))}finally{setBusy(false)}
 };
 const craft=template=>action('/commerce/craft',{template_id:template.id,character_id:characterId},r=>setNotice('Crafted '+template.name+'. Item #'+r.item_id+' is now in this character’s equipment bag.'));
 const deliver=contract=>{
  const quantity=contract.item_kind==='equipment'?1:Math.max(1,Math.min(100,Number(quantities[contract.id]||1)));
  action('/commerce/contracts/'+contract.id+'/deliver',{character_id:characterId,quantity,equipment_item_id:contract.item_kind==='equipment'?Number(selectedItems[contract.id]):undefined},r=>setNotice('Delivery accepted: +'+r.reputation_change+' faction standing. '+(r.complete?'Contract fulfilled!':'')));
 };
 const makeBlueprint=()=>{const b=blueprint;action('/commerce/templates',{...b,id:slug(b.name),minimum_level:Number(b.minimum_level),attack_bonus:Number(b.attack_bonus),defense_bonus:Number(b.defense_bonus),tool_bonus:Number(b.tool_bonus),ingredients:b.ingredients.map(i=>({...i,quantity:Number(i.quantity)}))},()=>{setBlueprint(null);setNotice('Equipment blueprint added to the workshop.')})};
 const makeContract=()=>{const b=contractDraft;action('/commerce/contracts',{...b,required_quantity:Number(b.required_quantity),rep_per_unit:Number(b.rep_per_unit)},()=>{setContractDraft(null);setNotice('Trade contract posted for the Order.')})};
 const stock=id=>Number(materials.find(m=>m.id===id)?.quantity||0);
 return <section className="eo-commerce">
  <header className="eo-commerce-hero"><div><span>THE ORDER'S MERCHANT NETWORK</span><h2>Trade Routes & Armory</h2><p>Fulfill orders for factions and settlements, grow their trust in the Order, and equip your own characters with goods forged from shared supplies.</p></div><strong>✦</strong></header>
  {error&&<p className="alert" role="alert">{error.replaceAll('_',' ')}</p>}
  {notice&&<p className="eo-commerce-notice" role="status">{notice}</p>}
  {!commerce?<p>Opening the merchant ledgers…</p>:<>
   <div className="eo-commerce-navigation">
    <button type="button" className={subtab==='contracts'?'selected':''} onClick={()=>setSubtab('contracts')}>Trade contracts <small>{contracts.filter(c=>c.status==='open').length}</small></button>
    <button type="button" className={subtab==='forge'?'selected':''} onClick={()=>setSubtab('forge')}>Forge & tool bench <small>{templates.length}</small></button>
    <button type="button" className={subtab==='ledger'?'selected':''} onClick={()=>setSubtab('ledger')}>Delivery ledger</button>
   </div>
   <div className="eo-commerce-toolbar">
    <label>Working character <select value={characterId} onChange={e=>setCharacterId(e.target.value)}><option value="">Choose a character</option>{ownedCharacters.map(c=><option value={c.id} key={c.id}>{c.name||c.character_name}</option>)}</select></label>
    <span>{character?'Level '+level:'A character sheet is required to craft or deliver'}</span>
    {canManage&&!readOnly&&<button type="button" className="btn secondary" onClick={()=>subtab==='forge'?setBlueprint(emptyBlueprint()):setContractDraft(emptyContract())}>+ {subtab==='forge'?'Equipment blueprint':'Trade contract'}</button>}
   </div>
   {subtab==='contracts'&&<div className="eo-commerce-grid">{contracts.map(contract=><article className="eo-contract-card" key={contract.id}>
    <div className="eo-contract-top"><span>{contract.faction_scope==='settlement'?'SETTLEMENT CONTRACT':'FACTION CONTRACT'}</span><small>{contract.status}</small></div>
    <h3>{contract.title}</h3><p className="eo-contract-destination">{contract.faction_name}</p>
    <p>{contract.description}</p>
    <div className="eo-contract-product"><strong>{contract.item_kind==='material'?'▣ '+contract.material_name:'⚒ '+contract.equipment_name}</strong><span>+{contract.rep_per_unit} standing / item</span></div>
    <div className="eo-contract-progress"><div style={{width:Number(contract.delivered_quantity)/Math.max(1,Number(contract.required_quantity))*100+'%'}}/></div>
    <p className="eo-contract-progress-caption">{contract.delivered_quantity} / {contract.required_quantity} delivered</p>
    {contract.status==='open'&&contract.item_kind==='material'&&<div className="eo-contract-controls"><label>Quantity <input type="number" min="1" max={Math.min(100,remaining(contract))} value={quantities[contract.id]||1} onChange={e=>setQuantities({...quantities,[contract.id]:e.target.value})}/></label><span>{stock(contract.material_id)} in shared stores</span></div>}
    {contract.status==='open'&&contract.item_kind==='equipment'&&<label className="eo-contract-gear">Select unequipped crafted equipment<select value={selectedItems[contract.id]||''} onChange={e=>setSelectedItems({...selectedItems,[contract.id]:e.target.value})}><option value="">Choose an item</option>{equipment.filter(item=>item.template_id===contract.equipment_template_id&&!item.equipped).map(item=><option value={item.id} key={item.id}>{item.name} · #{item.id}</option>)}</select></label>}
    {canManage&&!readOnly&&contract.status!=='complete'&&<button type="button" className="btn secondary" disabled={busy} onClick={()=>changeContractStatus(contract,contract.status==='paused'?'open':'paused')}>{contract.status==='paused'?'Reopen contract':'Pause contract'}</button>}
    <button type="button" className="btn primary" disabled={busy||!canAct||contract.status!=='open'||remaining(contract)===0||(contract.item_kind==='equipment'&&!selectedItems[contract.id])||(contract.item_kind==='material'&&(stock(contract.material_id)<(Number(quantities[contract.id]||1))||Number(quantities[contract.id]||1)>remaining(contract)))} onClick={()=>deliver(contract)}>{contract.status==='complete'?'Contract fulfilled':contract.status==='paused'?'Contract paused':'Deliver to '+contract.faction_name}</button>
   </article>)}
    {!contracts.length&&<div className="eo-commerce-empty"><h3>No contracts posted</h3><p>Order command can create a trade contract to request supplies or crafted equipment for a faction or settlement.</p></div>}
   </div>}
   {subtab==='forge'&&<div className="eo-commerce-grid">{templates.map(t=><article className="eo-contract-card eo-gear-card" key={t.id}>
    <div className="eo-contract-top"><span>{t.slot.toUpperCase()} · LEVEL {t.minimum_level}+</span><span className="eo-gear-symbol">{icon[t.slot]}</span></div>
    <h3>{t.name}</h3><p>{t.description}</p>
    <div className="eo-gear-stats">{Number(t.attack_bonus)>0&&<span>Attack +{t.attack_bonus}</span>}{Number(t.defense_bonus)>0&&<span>Defense +{t.defense_bonus}</span>}{Number(t.tool_bonus)>0&&<span>Tool +{t.tool_bonus}</span>}</div>
    <div className="eo-ingredients">{t.ingredients.map(i=><div key={i.material_id}><span>{matName(i.material_id)}</span><span className={stock(i.material_id)<Number(i.quantity)?'missing':''}>{stock(i.material_id)} / {i.quantity}</span></div>)}</div>
    <button type="button" className="btn primary" disabled={busy||!canAct||!t.enabled||level<Number(t.minimum_level)||t.ingredients.some(i=>stock(i.material_id)<Number(i.quantity))} onClick={()=>craft(t)}>Forge for character</button>
   </article>)}</div>}
   {subtab==='ledger'&&<section className="eo-commerce-history"><h3>Recent trade deliveries</h3>{deliveries.map(d=><div key={d.id}><span>{d.display_name} · Contract #{d.contract_id}<small>{new Date(d.created_at).toLocaleString()}</small></span><strong>{d.quantity} delivered · +{d.reputation_change} standing</strong></div>)}{!deliveries.length&&<p>No contracts have been delivered yet.</p>}</section>}
  </>}
  {blueprint&&<div className="eo-commerce-modal-mask"><section className="eo-commerce-modal" role="dialog" aria-modal="true" aria-label="Create equipment blueprint">
   <header><h3>New equipment blueprint</h3><button onClick={()=>setBlueprint(null)} aria-label="Close">×</button></header>{error&&<p className="alert">{error}</p>}
   <label>Equipment name<input maxLength={110} value={blueprint.name} onChange={e=>setBlueprint({...blueprint,name:e.target.value})}/></label>
   <label>Description<textarea maxLength={600} value={blueprint.description} onChange={e=>setBlueprint({...blueprint,description:e.target.value})}/></label>
   <label>Slot<select value={blueprint.slot} onChange={e=>setBlueprint({...blueprint,slot:e.target.value})}>{['weapon','armor','tool','accessory'].map(slot=><option key={slot} value={slot}>{slot}</option>)}</select></label>
   <div className="eo-commerce-three">{[['minimum_level','Minimum level'],['attack_bonus','Attack bonus'],['defense_bonus','Defense bonus'],['tool_bonus','Tool bonus']].map(([key,title])=><label key={key}>{title}<input type="number" min={key==='minimum_level'?1:0} max={key==='minimum_level'?100:20} value={blueprint[key]} onChange={e=>setBlueprint({...blueprint,[key]:e.target.value})}/></label>)}</div>
   <h4>Required FC materials</h4>{blueprint.ingredients.map((i,index)=><div key={index} className="eo-commerce-ingredient-row"><select value={i.material_id} onChange={e=>setBlueprint({...blueprint,ingredients:blueprint.ingredients.map((row,n)=>n===index?{...row,material_id:e.target.value}:row)})}><option value="">Choose material</option>{materials.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select><input aria-label="Required quantity" type="number" min="1" max="100" value={i.quantity} onChange={e=>setBlueprint({...blueprint,ingredients:blueprint.ingredients.map((row,n)=>n===index?{...row,quantity:e.target.value}:row)})}/><button aria-label="Remove ingredient" onClick={()=>setBlueprint({...blueprint,ingredients:blueprint.ingredients.filter((_,n)=>n!==index)})}>×</button></div>)}
   <button className="btn secondary" onClick={()=>setBlueprint({...blueprint,ingredients:[...blueprint.ingredients,{material_id:'',quantity:1}]})}>+ Add ingredient</button>
   <button className="btn primary" disabled={busy||!blueprint.name.trim()||!blueprint.ingredients.length||blueprint.ingredients.some(i=>!i.material_id)} onClick={makeBlueprint}>Save blueprint</button>
  </section></div>}
  {contractDraft&&<div className="eo-commerce-modal-mask"><section className="eo-commerce-modal" role="dialog" aria-modal="true" aria-label="Post trade contract">
   <header><h3>Post trade contract</h3><button onClick={()=>setContractDraft(null)} aria-label="Close">×</button></header>{error&&<p className="alert">{error}</p>}
   <label>Receiving faction or settlement<select value={contractDraft.faction_id} onChange={e=>setContractDraft({...contractDraft,faction_id:e.target.value})}><option value="">Choose recipient</option>{factions.map(f=><option key={f.id} value={f.id}>{f.name} · {f.faction_scope==='settlement'?'Settlement':'Faction'}</option>)}</select></label>
   <label>Contract name<input maxLength={130} value={contractDraft.title} onChange={e=>setContractDraft({...contractDraft,title:e.target.value})}/></label>
   <label>Description<textarea maxLength={600} value={contractDraft.description} onChange={e=>setContractDraft({...contractDraft,description:e.target.value})}/></label>
   <label>Delivery type<select value={contractDraft.item_kind} onChange={e=>setContractDraft({...contractDraft,item_kind:e.target.value,item_id:''})}><option value="material">Shared FC material / supply</option><option value="equipment">Crafted weapon, armor, or tool</option></select></label>
   <label>Requested good<select value={contractDraft.item_id} onChange={e=>setContractDraft({...contractDraft,item_id:e.target.value})}><option value="">Choose good</option>{(contractDraft.item_kind==='material'?materials:templates).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
   <div className="eo-commerce-three"><label>Quantity requested<input type="number" min="1" max="100000" value={contractDraft.required_quantity} onChange={e=>setContractDraft({...contractDraft,required_quantity:e.target.value})}/></label><label>Reputation per item<input type="number" min="1" max="20" value={contractDraft.rep_per_unit} onChange={e=>setContractDraft({...contractDraft,rep_per_unit:e.target.value})}/></label></div>
   <button className="btn primary" disabled={busy||!contractDraft.faction_id||!contractDraft.item_id||!contractDraft.title.trim()} onClick={makeContract}>Post contract</button>
  </section></div>}
 </section>;
}
