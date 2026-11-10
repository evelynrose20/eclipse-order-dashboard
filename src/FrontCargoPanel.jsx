import React,{useEffect,useState} from 'react';
import './front-cargo.css';
import {canLoadAtRailStop} from './rail-journey-selection.js';
const num=x=>Number(x||0);
export default function FrontCargoPanel({request,freight=null,command=false}){
 const [state,setState]=useState({hubs:[],shipments:[]}),[fronts,setFronts]=useState([]),[materials,setMaterials]=useState([]),[world,setWorld]=useState(freight),[form,setForm]=useState({source_front_id:'',destination_front_id:'',material_id:'',quantity:1,mode:'road'}),[hub,setHub]=useState({front_id:'',settlement_id:''}),[selection,setSelection]=useState({}),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 async function load(){
  try{
   const [cargo,directory,workshop]=await Promise.all([request('/fronts/cargo'),request('/fronts'),request('/workshop')]);
   setState(cargo);setFronts(directory.fronts||[]);setMaterials(workshop.materials||[]);
   if(command&&!freight){const data=await request('/world-admin/logistics');setWorld(data)}
   setError('');
  }catch(e){setError(e.message||'Front cargo unavailable')}
 }
 useEffect(()=>{void load()},[]);
 useEffect(()=>{if(freight)setWorld(freight)},[freight]);
 const hubs=state.hubs||[],shipments=state.shipments||[],profiles=(world?.templates||[]).filter(x=>['road','rail','air'].includes(x.mode));
 const getHub=frontId=>hubs.find(h=>num(h.front_id)===num(frontId));
 const frontName=id=>fronts.find(f=>num(f.id)===num(id))?.name||hubs.find(h=>num(h.front_id)===num(id))?.front_name||'Front #'+id;
 const send=async(path,body,message)=>{
  setBusy(true);setError('');setNotice('');
  try{await request(path,{method:'POST',body});setNotice(message);await load();}catch(e){setError(e.message||'Cargo request failed')}finally{setBusy(false)}
 };
 const requestCargo=()=>send('/fronts/cargo',{...form,source_front_id:num(form.source_front_id),destination_front_id:num(form.destination_front_id),quantity:num(form.quantity)},'Delivery requested. The source-front owner must authorize it before dispatch.');
 const available=fronts.filter(f=>f.status==='active'&&getHub(f.id));
 const availableMaterials=materials.filter(m=>m.id&&String(m.name||'').length);
 return <section className="fc-panel">
  <div className="fc-heading"><div><span>ORDER TRADE NETWORK</span><h3>Private Front Cargo</h3><p>Ship materials between licensed fronts with owner approval and real transport capacity. Goods remain reserved while in transit.</p></div><button onClick={()=>void load()}>Refresh</button></div>
  {error&&<div className="wa-error" role="alert">{error}</div>}{notice&&<div className="wa-notice" role="status">{notice}</div>}
  {command&&<div className="fc-box"><h4>Front depot assignments</h4><p>Attach each active front to its actual Order settlement. No physical shipping can begin without both locations.</p><div className="fc-fields"><label>Front<select value={hub.front_id} onChange={e=>setHub({...hub,front_id:e.target.value})}><option value="">Choose front</option>{fronts.filter(f=>f.status==='active').map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label>Order settlement<select value={hub.settlement_id} onChange={e=>setHub({...hub,settlement_id:e.target.value})}><option value="">Choose settlement</option>{(world?.settlements||[]).filter(s=>s.controlling_faction_id==='eclipse-order').map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><button disabled={busy||!hub.front_id||!hub.settlement_id} onClick={()=>send('/fronts/cargo/hub',{front_id:num(hub.front_id),settlement_id:num(hub.settlement_id)},'Front location saved.')}>Assign hub</button></div><div className="fc-hubs">{hubs.map(h=><span key={h.front_id}>{h.front_name} · {h.settlement_name}</span>)}</div></div>}
  <div className="fc-box"><h4>Request a shipment</h4><div className="fc-fields"><label>Origin front<select value={form.source_front_id} onChange={e=>setForm({...form,source_front_id:e.target.value})}><option value="">Choose origin</option>{available.filter(f=>f.can_manage||command).map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label>Destination front<select value={form.destination_front_id} onChange={e=>setForm({...form,destination_front_id:e.target.value})}><option value="">Choose destination</option>{available.filter(f=>String(f.id)!==String(form.source_front_id)).map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label>Crafted goods<select value={form.material_id} onChange={e=>setForm({...form,material_id:e.target.value})}><option value="">Choose material</option>{availableMaterials.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Quantity<input type="number" min="1" max="100000" step="1" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})}/></label><label>Transport<select value={form.mode} onChange={e=>setForm({...form,mode:e.target.value})}><option value="road">Road convoy</option><option value="rail">Order train</option><option value="air">Airship</option></select></label><button disabled={busy||!form.source_front_id||!form.destination_front_id||!form.material_id||!Number.isInteger(num(form.quantity))||num(form.quantity)<1} onClick={requestCargo}>Request cargo transfer</button></div></div>
  <div className="fc-box"><h4>Delivery orders</h4>{shipments.map(order=>{
   const sourceHub=getHub(order.source_front_id),destHub=getHub(order.destination_front_id),choice=selection[order.id]||{};
   const sourceId=num(sourceHub?.settlement_id),destId=num(destHub?.settlement_id);
   const fleet=(world?.vehicles||[]).filter(v=>v.status==='assigned'&&num(v.stationed_settlement_id)===sourceId&&(order.mode==='road'?['transport','armored_vehicle'].includes(v.equipment_kind):['airship','capital_airship'].includes(v.equipment_kind)));
   const rail=(world?.rail_journeys||[]).filter(j=>canLoadAtRailStop(j,sourceId,destId));
   const depots=(world?.facilities||[]).filter(f=>num(f.settlement_id)===sourceId&&f.owner_faction_id==='eclipse-order');
   return <article className="fc-shipment" key={order.id}><div className="fc-shipment-head"><div><strong>{frontName(order.source_front_id)} → {frontName(order.destination_front_id)}</strong><small>{order.quantity} × {materials.find(m=>m.id===order.material_id)?.name||order.material_id} · {order.mode}</small></div><span className={'freight-status is-'+order.status}>{order.status.replaceAll('_',' ')}</span></div>
    {order.status==='requested'&&<div className="fc-shipment-actions"><button disabled={busy} onClick={()=>send('/fronts/cargo/'+order.id+'/approve',{},'Owner authorized this shipment.')}>Authorize as source owner</button><button disabled={busy} onClick={()=>send('/fronts/cargo/'+order.id+'/cancel',{},'Request cancelled.')}>Cancel request</button></div>}
    {order.status==='approved'&&command&&<div className="fc-shipment-actions">
     <select aria-label="Transport profile" value={choice.transport_template_id||''} onChange={e=>setSelection(old=>({...old,[order.id]:{...choice,transport_template_id:e.target.value}}))}><option value="">Choose fleet profile</option>{profiles.filter(x=>x.mode===order.mode).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
     <select aria-label="Vehicle or train" value={choice.vehicle_lot_id||choice.train_journey_id||''} onChange={e=>setSelection(old=>({...old,[order.id]:{...choice,vehicle_lot_id:order.mode==='rail'?'':e.target.value,train_journey_id:order.mode==='rail'?e.target.value:''}}))}><option value="">Choose {order.mode==='rail'?'running train':'stationed transport'}</option>{(order.mode==='rail'?rail:fleet).map(v=><option key={v.id} value={v.id}>{v.name||v.train_name||'Train'} #{v.id}</option>)}</select>
     <select aria-label="Fuel depot" value={choice.fuel_facility_id||''} onChange={e=>setSelection(old=>({...old,[order.id]:{...choice,fuel_facility_id:e.target.value}}))}><option value="">Fuel source depot</option>{depots.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select>
     <button disabled={busy||!choice.transport_template_id||!(choice.vehicle_lot_id||choice.train_journey_id)} onClick={()=>send('/fronts/cargo/'+order.id+'/dispatch',{transport_template_id:num(choice.transport_template_id),vehicle_lot_id:num(choice.vehicle_lot_id),train_journey_id:num(choice.train_journey_id),fuel_facility_id:num(choice.fuel_facility_id)},'Transport dispatched. Destination stock credits only at arrival.')}>Dispatch</button>
    </div>}
    {['in_transit','held'].includes(order.status)&&<div className="fc-shipment-actions">{command&&order.status==='in_transit'&&<button disabled={busy} onClick={()=>send('/fronts/cargo/'+order.id+'/hold',{},'Shipment held.')}>Hold</button>}{command&&order.status==='held'&&<button disabled={busy} onClick={()=>send('/fronts/cargo/'+order.id+'/resume',{},'Shipment resumed.')}>Resume</button>}<button disabled={busy} onClick={()=>{if(window.confirm('Recall cargo to its origin? Spent fuel is not refunded.'))void send('/fronts/cargo/'+order.id+'/cancel',{},'Cargo returned to the source front.')}}>Recall cargo</button></div>}
   </article>
  })}{!shipments.length&&<p>No front cargo transfers have been requested.</p>}</div>
 </section>;
}
