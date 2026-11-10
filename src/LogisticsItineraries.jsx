import React,{useEffect,useState} from 'react';
import {canLoadAtRailStop} from './rail-journey-selection.js';
const blank=()=>({name:'',item_id:'',quantity:10,legs:[{source_facility_id:'',destination_facility_id:'',mode:'road',transport_template_id:''},{source_facility_id:'',destination_facility_id:'',mode:'rail',transport_template_id:''}]});
const money=x=>Number(x||0).toLocaleString(undefined,{maximumFractionDigits:3});
const validId=x=>Number(x)>0;
export default function LogisticsItineraries({request,freight,onRefresh}){
 const [list,setList]=useState([]),[form,setForm]=useState(blank()),[creating,setCreating]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[dispatchChoices,setDispatchChoices]=useState({});
 const facilities=freight.facilities||[],templates=(freight.templates||[]).filter(t=>['road','rail','air'].includes(t.mode)),items=freight.items||[],vehicles=freight.vehicles||[],trains=freight.rail_journeys||[];
 async function load(){try{const result=await request('/world-admin/logistics/itineraries');setList(result.orders||[]);setError('')}catch(e){setError(e.message||'Transport records unavailable')}}
 useEffect(()=>{void load()},[]);
 const setLeg=(i,key,value)=>setForm(old=>({...old,legs:old.legs.map((leg,j)=>j===i?{...leg,[key]:value,...(key==='mode'?{transport_template_id:''}:{})}:leg).map((leg,j,all)=>j>0&&key==='destination_facility_id'&&j===i+1?{...leg,source_facility_id:value}:leg)}));
 const addLeg=()=>setForm(old=>({...old,legs:[...old.legs,{source_facility_id:old.legs.at(-1).destination_facility_id,destination_facility_id:'',mode:'road',transport_template_id:''}]}));
 const create=async()=>{
  setSaving(true);setError('');setNotice('');
  try{
   const body={name:form.name,item_id:form.item_id,quantity:Number(form.quantity),legs:form.legs.map(leg=>({...leg,source_facility_id:Number(leg.source_facility_id),destination_facility_id:Number(leg.destination_facility_id),transport_template_id:Number(leg.transport_template_id)}))};
   await request('/world-admin/logistics/itineraries',{method:'POST',body});
   setCreating(false);setForm(blank());setNotice('Connected freight itinerary created. Dispatch each leg using real transport and fuel.');
   await load();
  }catch(e){setError(e.message||'Could not create itinerary')}
  finally{setSaving(false)}
 };
 const dispatch=async(order,leg)=>{
  setSaving(true);setError('');setNotice('');
  const choice=dispatchChoices[order.id]||'';
  try{
   await request('/world-admin/logistics/itineraries/'+order.id+'/dispatch',{method:'POST',body:leg.mode==='rail'?{train_journey_id:Number(choice)}:{vehicle_lot_id:Number(choice)}});
   setNotice('Cargo loaded. The next leg can be dispatched after arrival at the transfer depot.');
   await Promise.all([load(),onRefresh?.()]);
  }catch(e){setError(e.message||'Dispatch unsuccessful')}finally{setSaving(false)}
 };
 const release=async order=>{
  if(!window.confirm('Release the reserved cargo to this hub depot and cancel the remaining itinerary?'))return;
  setSaving(true);setError('');try{
   await request('/world-admin/logistics/itineraries/'+order.id+'/release',{method:'POST',body:{}});
   setNotice('Remaining cargo safely released to the hub depot.');await Promise.all([load(),onRefresh?.()]);
  }catch(e){setError(e.message)}finally{setSaving(false)}
 };
 const nameOf=id=>facilities.find(f=>Number(f.id)===Number(id))?.name||'Facility #'+id;
 return <section className="freight-list">
  <div className="freight-list-head"><div><h3>Connected transport itineraries</h3><p>Plan road, rail and airship handoffs. Cargo stays reserved at intermediate depots until the next leg is dispatched.</p></div><div className="freight-actions"><button onClick={()=>void load()}>Refresh</button><button className="freight-primary" onClick={()=>setCreating(v=>!v)}>{creating?'Close planner':'+ Plan itinerary'}</button></div></div>
  {error&&<p className="wa-error" role="alert">{error}</p>}{notice&&<p className="wa-notice" role="status">{notice}</p>}
  {creating&&<div className="freight-itinerary-editor">
   <div className="freight-itinerary-fields"><label>Itinerary name<input maxLength={140} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Cargo item<select value={form.item_id} onChange={e=>setForm({...form,item_id:e.target.value})}><option value="">Select cargo</option>{items.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Quantity<input type="number" step=".001" min=".001" max="100000" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})}/></label></div>
   {form.legs.map((leg,i)=><div className="freight-itinerary-leg" key={i}><strong>Leg {i+1}</strong>
    <label>From<select value={leg.source_facility_id} disabled={i>0} onChange={e=>setLeg(i,'source_facility_id',e.target.value)}><option value="">Choose depot</option>{facilities.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
    <label>To<select value={leg.destination_facility_id} onChange={e=>setLeg(i,'destination_facility_id',e.target.value)}><option value="">Choose depot</option>{facilities.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
    <label>Transport<select value={leg.mode} onChange={e=>setLeg(i,'mode',e.target.value)}><option value="road">Road vehicle</option><option value="rail">Train</option><option value="air">Airship</option></select></label>
    <label>Fleet profile<select value={leg.transport_template_id} onChange={e=>setLeg(i,'transport_template_id',e.target.value)}><option value="">Choose commissioned transport</option>{templates.filter(t=>t.mode===leg.mode).map(t=><option key={t.id} value={t.id}>{t.name} · {money(t.capacity)} cargo</option>)}</select></label>
    {i>=2&&<button type="button" onClick={()=>setForm(old=>({...old,legs:old.legs.filter((_,j)=>j!==i)}))}>Remove leg</button>}
   </div>)}
   <div className="freight-actions"><button disabled={form.legs.length>=6} onClick={addLeg}>+ Add transfer</button><button className="freight-primary" disabled={saving||!form.name.trim()||!form.item_id||!form.legs.every(x=>validId(x.source_facility_id)&&validId(x.destination_facility_id)&&validId(x.transport_template_id))} onClick={()=>void create()}>{saving?'Saving…':'Create itinerary'}</button></div>
  </div>}
  {list.map(order=>{
   const next=order.legs.find(l=>!l.shipment_id);
   const awaiting=['planned','at_hub'].includes(order.state)&&next;
   const start=facilities.find(f=>Number(f.id)===Number(next?.source_facility_id));
   const available=awaiting&&next.mode==='rail'?trains.filter(t=>canLoadAtRailStop(t,start?.settlement_id,facilities.find(f=>Number(f.id)===Number(next.destination_facility_id))?.settlement_id)):[];
   const actual=awaiting&&next.mode!=='rail'?vehicles.filter(v=>v.status==='assigned'&&Number(v.stationed_settlement_id)===Number(start?.settlement_id)&&(next.mode==='air'?['airship','capital_airship'].includes(v.equipment_kind):['transport','armored_vehicle'].includes(v.equipment_kind))):available;
   return <article className="freight-itinerary-card" key={order.id}><div className="freight-itinerary-title"><div><span className={'freight-status is-'+order.state}>{order.state.replaceAll('_',' ')}</span><h4>{order.name}</h4><small>{money(order.quantity)} {items.find(x=>x.id===order.item_id)?.name||order.item_id}</small></div><span>{order.legs.length} planned legs</span></div>
    <div className="freight-itinerary-steps">{order.legs.map(l=><div key={l.leg_number} className={l.shipment_status==='arrived'?'completed':''}><strong>{l.leg_number}. {l.mode==='air'?'Airship':l.mode==='rail'?'Train':'Road convoy'}</strong><span>{nameOf(l.source_facility_id)} → {nameOf(l.destination_facility_id)}</span><small>{l.shipment_status||'Awaiting departure'} {l.due_at?' · ETA '+new Date(l.due_at).toLocaleString():''}</small></div>)}</div>
    {order.state==='at_hub'&&<p className="freight-itinerary-reserved">Cargo secured at {nameOf(order.reservation?.facility_id)} — unavailable for other shipments until this itinerary continues or is cancelled.</p>}
    {awaiting&&<div className="freight-itinerary-dispatch"><label>Assign {next.mode==='rail'?'running assembled train':'stationed commissioned vehicle'}<select value={dispatchChoices[order.id]||''} onChange={e=>setDispatchChoices(old=>({...old,[order.id]:e.target.value}))}><option value="">Select available transport</option>{actual.map(v=><option key={v.id} value={v.id}>{v.name||v.train_name||'Train '+v.id} · #{v.id}</option>)}</select></label><button className="freight-primary" disabled={saving||!dispatchChoices[order.id]} onClick={()=>void dispatch(order,next)}>Dispatch leg {next.leg_number}</button>{order.state==='at_hub'&&<button disabled={saving} onClick={()=>void release(order)}>Release to depot</button>}</div>}
   </article>
  })}
  {!list.length&&!creating&&<div className="freight-empty">No connected itineraries yet. Plan two or more depot-to-depot legs to move freight by road, rail, or airship.</div>}
 </section>
}
