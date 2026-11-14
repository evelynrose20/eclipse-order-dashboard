import MaterialPicker from './MaterialPicker.jsx';
import React,{useEffect,useState} from 'react';
import './military-installations.css';

const types={castrum:'Castrum',fort:'Fortress',outpost:'Outpost',airbase:'Air base',depot:'Supply depot',naval_base:'Naval base',command_post:'Command post'};
const pretty=value=>String(value||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const number=value=>Number(value||0).toLocaleString();
const blank=()=>({name:'',settlement_id:'',installation_type:'castrum',defenses:'',notes:''});
export default function MilitaryInstallationsPanel({request}){
 const [data,setData]=useState(null),[selected,setSelected]=useState(''),[dialog,setDialog]=useState(null),[form,setForm]=useState(blank());
 const [troops,setTroops]=useState({troop_type:'Imperial infantry',quantity:0}),[ammo,setAmmo]=useState({kind:'deliver',item_id:'',facility_id:'',quantity:1});
 const [condition,setCondition]=useState({kind:'damage',amount:10}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function reload(){
  const result=await request('/world-admin/military');
  setData(result);setSelected(old=>result.installations?.some(x=>String(x.id)===old)?old:String(result.installations?.[0]?.id||''));
 }
 useEffect(()=>{reload().catch(e=>setError(e.message||'Military records unavailable'))},[]);
 async function save(path,body,method='POST'){
  setBusy(true);setError('');setNotice('');
  try{const result=await request(path,{method,body});await reload();setDialog(null);setNotice('Military records updated.');return result}
  catch(e){setError(e.message||'Unable to save changes');return null}
  finally{setBusy(false)}
 }
 const list=data?.installations||[],current=list.find(x=>String(x.id)===selected)||list[0];
 const settlements=data?.settlements||[],items=data?.items||[],facilities=data?.facilities||[];
 const unassigned=settlements.filter(s=>!list.some(i=>Number(i.settlement_id)===Number(s.id)));
 const troopTotal=current?.garrison?.reduce((sum,g)=>sum+Number(g.quantity),0)||0;
 const ammoTotal=current?.ammunition?.reduce((sum,a)=>sum+Number(a.quantity),0)||0;
 const magitekTotal=current?.magitek?.reduce((sum,e)=>sum+Number(e.quantity),0)||0;
 const capable=!!current&&(current.operational_ready??(['operational','damaged'].includes(current.state)&&Number(current.condition_pct)>=25&&!['rebuilding','destroyed','abandoned','contested','occupied'].includes(current.strategic_state)));
 const capabilities=capable?[
  {name:'Garrison defense',ready:troopTotal>0,description:'Troops available for holding the installation'},
  {name:'Artillery & field operations',ready:ammoTotal>0&&troopTotal>0,description:'Garrison and ammunition recorded'},
  {name:'Magitek deployment',ready:magitekTotal>0,description:'Assigned equipment stationed at this settlement'},
  {name:'Logistics',ready:ammoTotal>0,description:'Supplies present at the installation'}
 ]:[];
 const editor=dialog==='edit';
 return <section className="military-panel">
  <header className="military-hero"><div><span>IMPERIUM NOCTIS / STRATEGIC COMMAND</span><h3>Military Installations</h3><p>Oversee castrums, defenses, troops, war stores and stationed magitek.</p></div><button type="button" onClick={()=>{setForm(blank());setDialog('create')}}>+ Establish installation</button></header>
  {error&&<p className="wa-error" role="alert">{error}</p>}{notice&&<p className="wa-notice" role="status">{notice}</p>}
  {!data?<p>Loading installation records…</p>:<>
   <div className="military-metrics"><div><small>Installations</small><strong>{number(list.length)}</strong></div><div><small>Stationed troops</small><strong>{number(list.reduce((n,x)=>n+(x.garrison||[]).reduce((a,b)=>a+Number(b.quantity),0),0))}</strong></div><div><small>Stationed magitek</small><strong>{number(list.reduce((n,x)=>n+(x.magitek||[]).reduce((a,b)=>a+Number(b.quantity),0),0))}</strong></div><div><small>Damaged / lost</small><strong>{list.filter(x=>x.operational_ready===false||x.state!=='operational').length}</strong></div></div>
   <div className="military-layout">
    <aside className="military-directory"><h4>Installations</h4>{list.map(x=><button key={x.id} className={current?.id===x.id?'selected':''} onClick={()=>{setSelected(String(x.id));setAmmo({kind:'deliver',item_id:'',facility_id:'',quantity:1})}}><strong>{x.name}</strong><small>{types[x.installation_type]} · {x.location_name}</small><span>{pretty(x.effective_state||x.state)} · {x.operational_ready===false?'Not operational · ':''}{x.condition_pct}% structural integrity</span></button>)}{!list.length&&<p>No military installations have been established.</p>}</aside>
    <main className="military-detail">{current?<>
     <div className="military-heading"><div><small>{types[current.installation_type]} / {current.location_name}</small><h3>{current.name}</h3><p>{current.notes||'No orders currently recorded.'}</p></div><button type="button" onClick={()=>{setForm({name:current.name,installation_type:current.installation_type,defenses:current.defenses||'',notes:current.notes||''});setDialog('edit')}}>Edit installation</button></div>
     {current.controlling_faction_id==null&&<p className="wa-error">This location has no controlling faction. Check territorial control before stationing equipment.</p>}
     <div className="military-integrity"><div><strong>Structural integrity</strong><span>{current.condition_pct}% structural integrity · {pretty(current.effective_state||current.state)}</span></div><progress max="100" value={current.condition_pct}/><div className="military-actions"><select aria-label="Condition operation" value={condition.kind} onChange={e=>setCondition({...condition,kind:e.target.value})}><option value="damage">Record damage</option><option value="repair">Record repairs</option></select><input aria-label="Integrity points" type="number" min="1" max="100" value={condition.amount} onChange={e=>setCondition({...condition,amount:Number(e.target.value)})}/><button type="button" disabled={busy||!(condition.amount>=1&&condition.amount<=100)} onClick={()=>save('/world-admin/military/'+current.id+'/condition',condition)}>Apply</button></div></div>
     <div className="military-two">
      <section className="military-block"><h4>Garrison</h4><strong className="military-large">{number(troopTotal)} personnel</strong>{current.garrison?.map(t=><div className="military-line" key={t.troop_type}><span>{t.troop_type}</span><strong>{number(t.quantity)}</strong><button type="button" onClick={()=>setTroops({troop_type:t.troop_type,quantity:Number(t.quantity)})}>Edit</button></div>)}<div className="military-editline"><input aria-label="Troop formation" placeholder="Troop formation" value={troops.troop_type} maxLength={80} onChange={e=>setTroops({...troops,troop_type:e.target.value})}/><input aria-label="Troop count" type="number" min="0" max="1000000" value={troops.quantity} onChange={e=>setTroops({...troops,quantity:Number(e.target.value)})}/><button type="button" disabled={busy||!troops.troop_type.trim()} onClick={()=>save('/world-admin/military/'+current.id+'/garrison',troops)}>Set strength</button></div><small>Garrison strength is a staff-maintained roster, not automatically recruited population.</small></section>
      <section className="military-block"><h4>Defense systems</h4><p>{current.defenses||'No defensive installations recorded.'}</p>{current.operational_ready===false&&<p className="military-rebuild-notice"><i className="fa-solid fa-triangle-exclamation"/> Operational readiness unavailable while {pretty(current.strategic_state)}. Structural integrity is recorded separately; restore territorial control/condition before recommissioning this castrum.</p>}<h4>Operational capability</h4>{capabilities.length?capabilities.map(c=><div className="military-line" key={c.name}><span>{c.name}<small>{c.description}</small></span><strong>{c.ready?'Available':'Unavailable'}</strong></div>):<p>Installation is unable to support operations in its current condition.</p>}</section>
     </div>
     <section className="military-block"><h4>Ammunition & war stores</h4>{current.ammunition?.map(a=><div className="military-line" key={a.item_id}><span>{a.item_name}</span><strong>{number(a.quantity)}</strong></div>)}{!current.ammunition?.length&&<p>War stores are empty.</p>}
      <div className="military-editline"><label>Movement<select value={ammo.kind} onChange={e=>setAmmo({...ammo,kind:e.target.value})}><option value="deliver">Deliver from facility</option><option value="consume">Record expenditure</option></select></label><label>Material<MaterialPicker catalog={items} value={ammo.item_id} onChange={e=>setAmmo({...ammo,item_id:e.target.value})}><option value="">Choose material</option>{items.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</MaterialPicker></label>{ammo.kind==='deliver'&&<label>Supplying facility<select value={ammo.facility_id} onChange={e=>setAmmo({...ammo,facility_id:e.target.value})}><option value="">Choose facility</option>{facilities.filter(f=>f.item_id===ammo.item_id&&f.owner_faction_id===current.controlling_faction_id).map(f=><option key={f.id} value={f.id}>{f.name} ({number(f.quantity)})</option>)}</select></label>}<label>Units<input type="number" min="1" max="1000000" value={ammo.quantity} onChange={e=>setAmmo({...ammo,quantity:Number(e.target.value)})}/></label><button type="button" disabled={busy||!ammo.item_id||!(ammo.quantity>0)||(ammo.kind==='deliver'&&!ammo.facility_id)} onClick={()=>save('/world-admin/military/'+current.id+'/ammunition',{...ammo,facility_id:Number(ammo.facility_id)})}>Record movement</button></div>
     </section>
     <section className="military-block"><h4>Magitek stationed at {current.location_name}</h4>{current.magitek?.map(e=><div className="military-line" key={e.id}><span>{e.name}<small>{pretty(e.equipment_kind)} · {pretty(e.status)}</small></span><strong>{number(e.quantity)}</strong></div>)}{!current.magitek?.length&&<p>No commissioned magitek assigned to this location. Use the Magitek & war stores tab to station manufactured equipment.</p>}</section>
     <section className="military-block"><h4>Installation log</h4>{current.history?.slice(0,15).map(h=><div className="military-line" key={h.id}><span>{pretty(h.activity)} · {h.detail}</span><small>{String(h.created_at).slice(0,16).replace('T',' ')}</small></div>)}</section>
    </>:<div className="military-empty"><h3>Establish an installation</h3><p>Choose an existing map settlement to register a castrum, defensive outpost or other military installation.</p><button type="button" onClick={()=>{setForm(blank());setDialog('create')}}>Establish installation</button></div>}</main>
   </div>
  </>}
  {dialog&&<div className="military-overlay" role="presentation"><section className="military-modal" role="dialog" aria-modal="true" aria-label={editor?'Edit military installation':'Establish military installation'}><header><h3>{editor?'Edit installation':'Establish installation'}</h3><button type="button" onClick={()=>setDialog(null)}>Close</button></header><div className="military-form"><label>Installation name<input maxLength={140} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Castrum …"/></label>{!editor&&<label>Map settlement<select value={form.settlement_id} onChange={e=>setForm({...form,settlement_id:e.target.value})}><option value="">Choose settlement</option>{unassigned.map(s=><option key={s.id} value={s.id}>{s.name} · {pretty(s.strategic_state)}</option>)}</select></label>}<label>Installation type<select value={form.installation_type} onChange={e=>setForm({...form,installation_type:e.target.value})}>{Object.entries(types).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label>Defensive emplacements<textarea rows={3} maxLength={500} value={form.defenses} onChange={e=>setForm({...form,defenses:e.target.value})} placeholder="Ramparts, magitek cannons, shield generators…"/></label><label>Command notes<textarea rows={4} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label></div><footer><button type="button" onClick={()=>setDialog(null)}>Cancel</button><button type="button" disabled={busy||!form.name.trim()||(!editor&&!form.settlement_id)} onClick={()=>save(editor?'/world-admin/military/'+current.id:'/world-admin/military',editor?form:{...form,settlement_id:Number(form.settlement_id)},editor?'PUT':'POST')}>Save installation</button></footer></section></div>}
 </section>;
}
