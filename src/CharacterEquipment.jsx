import React,{useEffect,useState} from 'react';
import './commerce.css';
import './treasury.css';

const SLOT_LABELS={weapon:'Weapon',armor:'Armor',tool:'Tool',accessory:'Accessory'};
export default function CharacterEquipment({character,request,canEquip=false}){
 const [data,setData]=useState(null);
 const [wallet,setWallet]=useState(null);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 async function reload(){setData(await request('/commerce/characters/'+character.id+'/equipment'))}
 useEffect(()=>{setData(null);setWallet(null);setError('');reload().catch(e=>setError(e.message));request('/treasury/characters/'+character.id).then(setWallet).catch(()=>{})},[character.id]);
 async function toggle(item){
  setBusy(true);setError('');
  try{await request('/commerce/characters/'+character.id+'/equipment/'+item.id+'/equip',{method:'POST',body:{equipped:!item.equipped}});await reload()}
  catch(e){setError(e.message||String(e))}
  finally{setBusy(false)}
 }
 const items=data?.items||[];
 const bonuses=data?.bonuses||{attack:0,defense:0,tool:0};
 return <section className="eo-equipment-sheet">
  <div className="eo-equipment-heading"><div><span>CRAFTED FOR THIS CHARACTER</span><h4>Equipment & Armory</h4></div><small>Individual items · one per slot</small></div>
  <div className="eo-character-wallet"><div><strong>Personal gil purse</strong><strong className="eo-character-wallet-balance">{Number(wallet?.balance||0).toLocaleString()} gil</strong></div><p>Daily wages and approved mission rewards are deposited here from the Order treasury.</p>{wallet?.history?.[0]&&<small>Last payment: +{wallet.history[0].amount} gil · {wallet.history[0].kind.replaceAll('_',' ')}</small>}</div>
  {error&&<p className="alert" role="alert">{error.replaceAll('_',' ')}</p>}
  {!data&&!error&&<p>Opening equipment inventory…</p>}
  {data&&<>
   <div className="eo-equipped-bonuses"><span>Gear attack <strong>+{bonuses.attack}</strong></span><span>Gear defense <strong>+{bonuses.defense}</strong></span><span>Tool skill <strong>+{bonuses.tool}</strong></span></div>
   <div className="eo-equipped-slots">{Object.entries(SLOT_LABELS).map(([slot,label])=>{
    const equipped=items.find(i=>i.slot===slot&&i.equipped);
    return <div key={slot} className={'eo-equipped-slot '+(equipped?'filled':'')}><span>{label}</span><strong>{equipped?.name||'Not equipped'}</strong>{equipped&&<small>{[equipped.attack_bonus&&'Attack +'+equipped.attack_bonus,equipped.defense_bonus&&'Defense +'+equipped.defense_bonus,equipped.tool_bonus&&'Tool +'+equipped.tool_bonus].filter(Boolean).join(' · ')||'Character equipment'}</small>}</div>
   })}</div>
   <h5>Equipment bag</h5>
   <div className="eo-equipment-items">{items.length?items.map(i=><article key={i.id}><div><strong>{i.name}</strong><small>{i.slot} · Level {i.minimum_level}+ · Item #{i.id}</small></div><span>{i.equipped?'Equipped':'In bag'}</span>{canEquip&&<button type="button" className="btn secondary" disabled={busy||(!i.equipped&&Number(character.level||1)<Number(i.minimum_level))} onClick={()=>toggle(i)}>{i.equipped?'Unequip':'Equip'}</button>}</article>):<p>No crafted gear yet. Use the Order Workshop's Forge & tool bench to make equipment using FC materials.</p>}</div>
   <p className="eo-equipment-note">Your equipped bonuses are tracked separately from the character's base class statistics. The Order's combat balancing can incorporate them without overwriting the original sheet.</p>
  </>}
 </section>;
}
