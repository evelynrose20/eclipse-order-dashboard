import React,{useEffect,useState} from 'react';
import './dashboard.css';
import './local-accounts.css';

function fmt(value){return Number(value||0).toLocaleString();}
export default function EconomyPanel({request,characters,canCommand,onRefresh}){
 const [catalog,setCatalog]=useState([]);
 const [chosen,setChosen]=useState('');
 const [details,setDetails]=useState(null);
 const [quantity,setQuantity]=useState(1);
 const [salary,setSalary]=useState(1000);
 const [xp,setXp]=useState(200);
 const [ability,setAbility]=useState('str');
 const [rank,setRank]=useState('rank_i');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const selected=characters.find(c=>c.id===chosen);
 const hasFull=selected?.view_mode==='full';
 const load=async(id=chosen)=>{
  const [items,economy]=await Promise.all([request('/economy/catalog'),
   id?request('/economy/characters/'+id):Promise.resolve(null)]);
  setCatalog(items);setDetails(economy);
 };
 useEffect(()=>{setChosen(previous=>characters.some(c=>c.id===previous)?previous:characters[0]?.id||'')},[characters]);
 useEffect(()=>{if(!chosen){setDetails(null);return}load(chosen).catch(error=>setMessage(error.message))},[chosen]);
 async function perform(action,payload){
  if(!chosen)return;
  setBusy(true);setMessage('');
  try{
   const result=await request('/economy/characters/'+chosen+'/'+action,{method:'POST',body:payload});
   await load(chosen);setMessage(action==='buy'?'Purchase completed.':action==='paycheck'?'Weekly paycheck processed.':'Daily ration added to inventory.');
   return result;
  }catch(error){setMessage(error.message)}
  finally{setBusy(false)}
 }
 async function awardExperience(){
  setBusy(true);setMessage('');
  try{
   const result=await request('/characters/'+chosen+'/experience',{method:'POST',body:{amount:Number(xp)}});
   await onRefresh();setMessage('XP awarded. Character is now level '+result.level+'.');
  }catch(error){setMessage(error.message)}finally{setBusy(false)}
 }
 async function assignAbility(){
  if(!chosen)return;
  setBusy(true);setMessage('');
  try{
   const result=await request('/characters/'+chosen+'/ability',{method:'POST',body:{ability}});
   await onRefresh();setMessage('Ability raised to '+result.score+'. Points remaining: '+result.remaining);
  }catch(error){setMessage(error.message)}finally{setBusy(false)}
 }
 async function promoteRank(){
  setBusy(true);setMessage('');
  try{
   const result=await request('/characters/'+chosen+'/rank',{method:'POST',body:{rank}});
   await onRefresh();await load(chosen);setMessage('Bound rank updated: '+result.rank);
  }catch(error){setMessage(error.message)}finally{setBusy(false)}
 }
 const available=catalog.filter(c=>c.category!=='ration');
 return <div className="rp-profile-stack">
  <section className="panel"><div className="panel-heading"><div><h2>Character wallet & inventory</h2><p>Gil is kept in MySQL, not an editable sheet field. Purchases, payroll and daily rations are recorded.</p></div></div>
  <label className="field"><span>CHARACTER</span><select value={chosen} onChange={e=>{setChosen(e.target.value);setMessage('')}}><option value="">Choose a character</option>{characters.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
  {details&&hasFull?<><div className="eo-summary"><div><strong>{fmt(details.balance)}</strong><span>Gil balance</span></div><div><strong>{details.salary_share}%</strong><span>Weekly paycheck share</span></div><div><strong>{details.inventory.reduce((a,b)=>a+Number(b.quantity),0)}</strong><span>Items held</span></div></div>
   <h3>Inventory</h3>{details.inventory.length?<div className="eo-character-grid">{details.inventory.map(i=><article className="eo-character" key={i.item_id}><strong>{i.name}</strong><span>×{i.quantity} · {i.category}</span><small>{i.description}</small></article>)}</div>:<p className="muted">Your character has no items yet.</p>}
  </>:<p className="muted">Restricted character records keep wallet and possessions sealed. You can still claim the daily ration allowance.</p>}
  </section>
  <section className="panel"><h2>Black Market</h2><p>Buy RP props, equipment and consumables with character gil. No purchase changes a player's OOC consent or collar status.</p>
   <div className="eo-character-grid">{available.map(item=><article className="eo-character" key={item.id}><strong>{item.name}</strong><span>{fmt(item.price)} gil · {item.category}</span><small>{item.description}</small><button className="btn secondary" disabled={busy||!hasFull||Number(details?.balance||0)<item.price*quantity} onClick={()=>perform('buy',{item_id:item.id,quantity:Number(quantity)})}>Buy</button></article>)}</div>
   <label className="field"><span>QUANTITY PER PURCHASE (1–20)</span><input type="number" min={1} max={20} value={quantity} onChange={e=>setQuantity(Math.min(20,Math.max(1,Number(e.target.value)||1)))}/></label>
  </section>
  <section className="panel"><h2>Daily rations</h2><p>Optional RP provisions: one free ration per calendar day (UTC) for bound characters, chosen by collar rank. They are narrative inventory items only.</p><button className="btn secondary" disabled={busy||!selected?.collar_bound} onClick={()=>perform('ration',{})}>Claim today's ration</button></section>
  {selected?.progression_version===1&&hasFull&&<section className="panel"><h2>Ability improvements</h2><p>At levels 4, 8, 12, 16 and 19, characters receive 2 points. Each point raises an ability by 1, to a maximum of 20.</p><p><strong>{selected.ability_points||0}</strong> points available</p><label className="field"><span>ABILITY TO IMPROVE</span><select value={ability} onChange={e=>setAbility(e.target.value)}>{['str','dex','con','int','wis','cha'].map(k=><option value={k} key={k}>{k.toUpperCase()} ({selected[k]})</option>)}</select></label><button className="btn secondary" disabled={busy||!(selected.ability_points>0)||(!canCommand&&selected.collar_bound)} onClick={assignAbility}>Spend one ability point</button></section>}
  {canCommand&&<section className="panel"><h2>Command treasury & progression</h2><p>Approve one paycheck per character each UTC week. A character's share follows their rank; unbound characters retain 100% of base pay.</p>
   <div className="inline-sheet-grid"><label className="field"><span>BASE WEEKLY PAY (GIL)</span><input type="number" min={1} max={1000000} value={salary} onChange={e=>setSalary(Number(e.target.value))}/></label><label className="field"><span>XP AWARD</span><input type="number" min={1} max={5000} value={xp} onChange={e=>setXp(Number(e.target.value))}/></label></div>
   <div className="eo-actions"><button className="btn primary" disabled={busy||!hasFull||salary<1} onClick={()=>perform('paycheck',{base_amount:Number(salary)})}>Issue weekly paycheck</button><button className="btn secondary" disabled={busy||!hasFull||!selected?.progression_version||xp<1||xp>5000} onClick={awardExperience}>Award XP</button></div>
   {selected?.collar_bound&&<div style={{marginTop:20}}><h3>Bound-rank management</h3><p>Ranks determine future paycheck shares and daily ration types. Changing rank never replaces OOC status approval.</p><label className="field"><span>COLLAR RANK</span><select value={rank} onChange={e=>setRank(e.target.value)}><option value="rank_i">Rank I — 0% paycheck share</option><option value="rank_ii">Rank II — 10%</option><option value="rank_iii">Rank III — 25%</option><option value="rank_iv">Rank IV — 40%</option></select></label><button className="btn secondary" disabled={busy} onClick={promoteRank}>Update rank</button></div>}
  </section>}
  {details&&<section className="panel"><h2>Recent activity</h2>{details.ledger.length?details.ledger.map(entry=><div className="eo-member" key={entry.id}><div><strong>{entry.event_type.replaceAll('_',' ')}</strong><small>{entry.description}</small></div><strong>{Number(entry.amount)>0?'+':''}{fmt(entry.amount)} gil</strong></div>):<p className="muted">No transactions recorded.</p>}</section>}
  {message&&<p className="alert" role="status">{message}</p>}
 </div>;
}
