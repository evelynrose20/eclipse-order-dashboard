import React,{useMemo,useState} from 'react';
import MaterialPicker from './MaterialPicker.jsx';
import {PlanningModal,Step,Requirement} from './LogisticsPlannerUI.jsx';

const normalize=json=>{try{return Array.isArray(json)?json:JSON.parse(json||'[]')}catch{return []}};
const fmt=n=>Number(n||0).toLocaleString();
const newTemplate=()=>({name:'',description:'',capacity_units:500,requirements:[{item_id:'',quantity:30}]});
export default function WarehouseBlueprintsPanel({data,request,onRefresh}){
 const items=data.items||[],rows=data.warehouse_blueprints||[];
 const groups=useMemo(()=>Object.values(rows.reduce((result,row)=>{
  if(!result[row.id])result[row.id]={id:Number(row.id),name:row.name,description:row.description,icon:row.icon,active:!!row.active,levels:[]};
  result[row.id].levels.push({level_number:Number(row.level_number),capacity_units:Number(row.capacity_units),requirements:normalize(row.requirements)});
  return result;
 },{})),[rows]);
 const [edit,setEdit]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const mat=id=>items.find(i=>i.id===id)?.name||id;
 const startLevel=(blueprint,level)=>{const current=blueprint.levels.find(l=>l.level_number===level);setEdit({mode:'level',id:blueprint.id,name:blueprint.name,level_number:level,capacity_units:current?.capacity_units||((blueprint.levels.find(l=>l.level_number===level-1)?.capacity_units||500)+500),requirements:current?.requirements.map(x=>({...x}))||[{item_id:'',quantity:20}]});setError('')};
 const save=async()=>{
  setBusy(true);setError('');setNotice('');
  try{
   const requirements=edit.requirements.map(x=>({item_id:x.item_id,quantity:Number(x.quantity)}));
   const url=edit.mode==='new'?'/world-admin/logistics/warehouses/blueprints':'/world-admin/logistics/warehouses/blueprints/'+edit.id+'/levels/'+edit.level_number;
   const body=edit.mode==='new'?{name:edit.name,description:edit.description,capacity_units:Number(edit.capacity_units),requirements}:{capacity_units:Number(edit.capacity_units),requirements};
   await request(url,{method:edit.mode==='new'?'POST':'PUT',body});
   await onRefresh();setEdit(null);setNotice('Warehouse design saved. New construction uses the updated requirements.');
  }catch(e){setError(e.message||'Cannot save warehouse design')}finally{setBusy(false)}
 };
 const updateItem=(index,patch)=>setEdit(d=>({...d,requirements:d.requirements.map((item,i)=>i===index?{...item,...patch}:item)}));
 return <section className="wh-blueprints">
  <div className="freight-list-head"><div><span className="lp-eyebrow">ORDER ENGINEERING / CONSTRUCTION PATTERNS</span><h3>Warehouse templates</h3><small>Manage building types, storage levels, and the industrial materials required. Changing a design never adds stock or upgrades an existing warehouse for free.</small></div><button type="button" onClick={()=>{setEdit({mode:'new',...newTemplate()});setError('')}}><i className="fa-solid fa-plus"/> New design</button></div>
  {notice&&<p role="status" className="wa-notice">{notice}</p>}
  <div className="wh-blueprint-grid">{groups.map(b=><article className="wh-blueprint-card" key={b.id}>
   <div className="wh-blueprint-head"><i className={'fa-solid '+(b.icon||'fa-warehouse')} aria-hidden="true"/><div><h4>{b.name}</h4><p>{b.description}</p></div></div>
   <div className="wh-level-list">{b.levels.map(l=><div key={l.level_number} className="wh-level-item"><div><strong>Level {l.level_number}</strong><small>{fmt(l.capacity_units)} storage units</small></div><div className="wh-level-materials">{l.requirements.map((r,i)=><small key={i}>{mat(r.item_id)} × {fmt(r.quantity)}</small>)}</div><button type="button" onClick={()=>startLevel(b,l.level_number)}>Edit</button></div>)}</div>
   {b.levels.length<20&&<button type="button" className="wh-add-level" onClick={()=>startLevel(b,Math.max(...b.levels.map(l=>l.level_number))+1)}><i className="fa-solid fa-arrow-up"/> Add level {Math.max(...b.levels.map(l=>l.level_number))+1}</button>}
  </article>)}</div>
  {!groups.length&&<p className="freight-empty">No warehouse designs available. Create a level 1 design before planning a new building.</p>}
  {edit&&<PlanningModal title={edit.mode==='new'?'Design a new warehouse':edit.name+' · Level '+edit.level_number} kicker="IMPERIAL ENGINEERING / MATERIALS" subtitle="Set real industrial construction costs. Existing warehouses and active cargo records remain untouched." onClose={()=>setEdit(null)} stepValidations={[edit.mode!=='new'||!!edit.name.trim(),Number(edit.capacity_units)>=100&&Number(edit.capacity_units)<=100000,edit.requirements.length>0&&edit.requirements.every(r=>r.item_id&&Number(r.quantity)>0)&&new Set(edit.requirements.map(r=>r.item_id)).size===edit.requirements.length]} footer={<><button onClick={()=>setEdit(null)}>Cancel</button><button className="freight-primary" disabled={busy||Number(edit.capacity_units)<100||edit.requirements.some(r=>!r.item_id||Number(r.quantity)<=0)||!edit.requirements.length} onClick={()=>void save()}>{busy?'Saving…':'Save design'}</button></>}>
   <Step number={1} title="Warehouse identity" subtitle="Give the warehouse type a recognizable name.">{edit.mode==='new'?<div className="lp-field-row"><label>Template name<input maxLength={140} value={edit.name} onChange={e=>setEdit({...edit,name:e.target.value})}/></label><label>Description<textarea maxLength={350} value={edit.description} onChange={e=>setEdit({...edit,description:e.target.value})}/></label></div>:<div className="wh-design-intro"><i className="fa-solid fa-warehouse"/><strong>{edit.name}</strong><small>Level {edit.level_number} construction pattern</small></div>}</Step>
   <Step number={2} title="Storage level" subtitle="Define how much stock can be held at this level."><label className="wh-level-input">Storage capacity (units)<input type="number" min={100} max={100000} value={edit.capacity_units} onChange={e=>setEdit({...edit,capacity_units:e.target.value})}/></label><Requirement icon="fa-warehouse" label="Target storage" value={fmt(edit.capacity_units)+' units'}/></Step>
   <Step number={3} title="Construction material bill" subtitle="Add as many different construction materials as the warehouse requires."><div className="wh-recipe-list">{edit.requirements.map((r,i)=><div className="wh-recipe-row" key={i}><span>{i+1}</span><MaterialPicker options={items} value={r.item_id} onChange={item=>updateItem(i,{item_id:item})} placeholder="Choose construction material"/><label>Units<input type="number" min={0.001} step={0.001} max={100000} value={r.quantity} onChange={e=>updateItem(i,{quantity:e.target.value})}/></label><button type="button" disabled={edit.requirements.length<=1} aria-label="Remove material" onClick={()=>setEdit(d=>({...d,requirements:d.requirements.filter((_,j)=>i!==j)}))}><i className="fa-solid fa-trash"/></button></div>)}</div><button type="button" disabled={edit.requirements.length>=20} onClick={()=>setEdit(d=>({...d,requirements:[...d.requirements,{item_id:'',quantity:10}]}))}>+ Add construction material</button><small>These materials are consumed from a real Order-controlled industrial depot when construction or an upgrade is commissioned.</small>{error&&<p role="alert" className="wa-error">{error}</p>}</Step>
  </PlanningModal>}
 </section>;
}
