import React,{useMemo,useState} from 'react';
const pretty=s=>String(s||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const specs=s=>{try{return typeof s==='string'?JSON.parse(s):s||{}}catch{return {}}};
const fmt=n=>Number(n||0).toLocaleString();
export default function LogisticsFleetRegistration({data,busy,onSubmit}){
 const [chosen,setChosen]=useState('');
 const [filter,setFilter]=useState('all');
 const [search,setSearch]=useState('');
 const fleets=useMemo(()=>{
  const lots=(data.vehicles||[]).map(v=>{const spec=specs(v.specifications);return {key:'lot:'+v.id,id:v.id,kind:'lot',name:v.name,mode:['transport','armored_vehicle'].includes(v.equipment_kind)?'road':['airship','capital_airship'].includes(v.equipment_kind)?'air':null,units:v.quantity,capacity:Number(spec.cargo_capacity||0)*Number(v.quantity),fuel:spec.fuel_item_id,consumption:spec.fuel_per_operation,status:v.status,location:(data.settlements||[]).find(s=>Number(s.id)===Number(v.stationed_settlement_id))?.name||'Fleet reserve'}});
  const trains=(data.assembled_trains||[]).map(v=>({key:'train:'+v.id,id:v.id,kind:'train',name:v.name,mode:'rail',units:v.wagon_count,capacity:v.cargo_capacity,fuel:v.fuel_item_id,consumption:v.fuel_per_operation,status:v.status,location:'Order railway'}));
  return [...lots,...trains].filter(v=>v.mode&&v.capacity>0)
 },[data]);
 const existing=new Set((data.templates||[]).flatMap(t=>[t.source_equipment_lot_id?'lot:'+t.source_equipment_lot_id:null,t.source_train_consist_id?'train:'+t.source_train_consist_id:null].filter(Boolean)));
 const shown=fleets.filter(v=>(filter==='all'||filter===v.mode)&&v.name.toLowerCase().includes(search.trim().toLowerCase()));
 const picked=fleets.find(v=>v.key===chosen);
 return <div className="freight-fleet-workflow">
  <div className="freight-console-intro"><i className="fa-solid fa-truck-ramp-box"/><div><strong>Order Transport Reserve</strong><p>Select an existing manufactured vehicle or an assembled train. Its actual cargo space and fuel requirements determine its logistics profile.</p></div></div>
  <div className="freight-fleet-filters"><input aria-label="Search manufactured fleet" placeholder="Search transport stock…" value={search} onChange={e=>setSearch(e.target.value)}/>{[['all','All fleet'],['road','Road'],['rail','Rail'],['air','Airships']].map(([v,title])=><button type="button" className={filter===v?'active':''} key={v} onClick={()=>setFilter(v)}>{title}</button>)}</div>
  <div className="freight-fleet-grid">{shown.map(v=><button type="button" key={v.key} disabled={existing.has(v.key)||v.status==='damaged'} onClick={()=>setChosen(v.key)} className={'freight-fleet-choice'+(chosen===v.key?' selected':'')}><i className={'fa-solid '+(v.mode==='rail'?'fa-train':v.mode==='air'?'fa-plane':'fa-truck')}/><span><strong>{v.name}</strong><small>{pretty(v.mode)} · {v.location} · {v.units} {v.mode==='rail'?'wagons':'in stock'}</small><small>{fmt(v.capacity)} cargo capacity · {v.consumption||0} {v.fuel||'fuel'} per journey operation</small></span><b>{existing.has(v.key)?'Registered':v.status==='damaged'?'Damaged':chosen===v.key?'Selected':pretty(v.status)}</b></button>)}</div>
  {!shown.length&&<p className="freight-empty">No eligible manufactured transport found. Commission cargo-capable magitek or assemble a train in Industry & Projects first.</p>}
  <div className="freight-console-footer"><div>{picked?<><strong>{picked.name}</strong><small>Fleet capacity: {fmt(picked.capacity)} cargo · {pretty(picked.mode)}</small></>:<small>Choose an existing transport unit to register it for freight operations.</small>}</div><button className="freight-primary" type="button" disabled={!picked||existing.has(chosen)||busy} onClick={()=>onSubmit({fleet_kind:picked.kind,fleet_id:Number(picked.id)})}>Register selected fleet</button></div>
 </div>;
}
