import React,{useState} from 'react';
const labels={transport:'Ground transport',locomotive:'Magitek locomotive',railcar:'Rail carriage',armored_vehicle:'Armored vehicle / tank',airship:'Airship',field_equipment:'Field equipment',siege_equipment:'Siege equipment',other:'Other magitek equipment'};
const blank=()=>({item_id:'',name:'',description:'',equipment_kind:'transport',transport_capacity:0,cargo_capacity:0,crew_required:1,fuel_item_id:null,fuel_per_operation:0,enabled:true});
const number=x=>Number(x||0).toLocaleString(undefined,{maximumFractionDigits:3});
export default function MagitekEquipmentPanel({data,request,reload,onBuildRecipe}){
 const templates=data?.equipment?.templates||[],inventory=data?.equipment?.inventory||[];
 const [editing,setEditing]=useState(null),[draft,setDraft]=useState(blank());
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [commission,setCommission]=useState({facility_id:0,equipment_template_id:0,quantity:1});
 const [assign,setAssign]=useState(null);
 const [assignment,setAssignment]=useState({status:'reserve',stationed_settlement_id:'',notes:'',quantity:1});
 const items=data?.items||[],facilities=data?.facilities||[],settlements=data?.settlements||[];
 const namedItem=id=>items.find(x=>x.id===id)?.name||id;
 const make=()=>{setDraft(blank());setEditing('new');setError('');};
 const edit=t=>{setDraft({...t,enabled:!!t.enabled,fuel_item_id:t.fuel_item_id||null});setEditing(t.id);setError('');};
 const submit=async(path,method,body,done)=>{
  setBusy(true);setError('');setMessage('');
  try{await request(path,{method,body});await reload();setMessage(done);setEditing(null);setAssign(null);}
  catch(e){setError(e.message||'Equipment operation failed')}
  finally{setBusy(false)}
 };
 const allManufacturing=facilities.filter(f=>f.owner_faction_id==='eclipse-order'&&f.controlling_faction_id==='eclipse-order'&&f.status==='operational');
 const selectedFactory=facilities.find(f=>f.id===Number(commission.facility_id));
 const available=Number(selectedFactory?.stocks?.find(s=>s.item_id===templates.find(t=>t.id===Number(commission.equipment_template_id))?.item_id)?.quantity||0);
 const openAssignment=lot=>{setAssign(lot);setAssignment({status:lot.status,stationed_settlement_id:lot.stationed_settlement_id||'',notes:lot.notes||'',quantity:Number(lot.quantity)});};
 return <div className="wa-industry-workspace">
  <div className="wa-industry-blockhead"><div><h3>Magitek manufacturing & war readiness</h3><p>Production designs, finished transports, rolling stock and military reserves. Every commissioned unit must first be manufactured.</p></div><button type="button" onClick={make}>+ Equipment template</button></div>
  {error&&<p role="alert" className="wa-error">{error}</p>}{message&&<p className="wa-notice">{message}</p>}
  <div className="wa-industry-summary"><div><small>Equipment designs</small><strong>{templates.length}</strong></div><div><small>Commissioned units</small><strong>{number(inventory.filter(x=>x.status!=='retired').reduce((n,x)=>n+Number(x.quantity),0))}</strong></div><div><small>Reserves</small><strong>{number(inventory.filter(x=>x.status==='reserve').reduce((n,x)=>n+Number(x.quantity),0))}</strong></div><div><small>Assigned units</small><strong>{number(inventory.filter(x=>x.status==='assigned').reduce((n,x)=>n+Number(x.quantity),0))}</strong></div></div>
  <section className="wa-industry-block"><div className="wa-industry-blockhead"><div><h4>Equipment design templates</h4><p>Designs are reusable output items for your existing magitek factory recipes.</p></div></div>
   <div className="wa-industry-cards">{templates.map(t=><article key={t.id}><small>{labels[t.equipment_kind]} · Revision {t.revision} · {t.enabled?'Available':'Disabled'}</small><strong>{t.name}</strong><p>{t.description||'Custom equipment design'}</p><div className="wa-upgrade-details"><span>Crew {number(t.crew_required)}</span><span>Passengers {number(t.transport_capacity)}</span><span>Cargo {number(t.cargo_capacity)}</span><span>Fuel {number(t.fuel_per_operation)} {t.fuel_item_id?namedItem(t.fuel_item_id):'units'}</span></div><div className="wa-industry-buttons"><button type="button" onClick={()=>edit(t)}>Edit specifications</button><button type="button" onClick={()=>onBuildRecipe?.(t.item_id)}>Build factory recipe</button></div></article>)}{!templates.length&&<p className="wa-npc-subtle">Create a transport, locomotive, carriage, tank or other equipment design, then use it as an output of a Manufacturing facility template.</p>}</div>
  </section>
  <section className="wa-industry-block"><div className="wa-industry-blockhead"><h4>Commission finished equipment</h4><span>Consumes actual factory stock</span></div><p className="wa-npc-subtle">A design alone creates no units. Your manufacturing template must consume real materials and operate at an Order-controlled factory. Commissioning moves completed items out of factory stock into a trackable reserve.</p>
   <div className="wa-industry-form"><label>Factory<select value={commission.facility_id} onChange={e=>setCommission({...commission,facility_id:Number(e.target.value)})}><option value="0">Select active factory</option>{allManufacturing.map(f=><option value={f.id} key={f.id}>{f.name} · {f.settlement_name}</option>)}</select></label>
    <label>Equipment design<select value={commission.equipment_template_id} onChange={e=>setCommission({...commission,equipment_template_id:Number(e.target.value)})}><option value="0">Select finished equipment</option>{templates.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label>
    <label>Quantity<input type="number" min="1" max="100000" step="1" value={commission.quantity} onChange={e=>setCommission({...commission,quantity:Number(e.target.value)})}/></label><div><small>Finished units at factory</small><strong>{number(available)}</strong></div>
    <button type="button" disabled={busy||!commission.facility_id||!commission.equipment_template_id||!Number.isInteger(commission.quantity)||commission.quantity<1||commission.quantity>available} onClick={()=>submit('/world-admin/industry/equipment/facilities/'+commission.facility_id+'/commission','POST',{equipment_template_id:commission.equipment_template_id,quantity:commission.quantity},'Finished units moved into faction reserve.')}>Commission from factory</button>
   </div>
  </section>
  <section className="wa-industry-block"><div className="wa-industry-blockhead"><h4>Fleet, rolling stock & war reserves</h4><span>Tracked commissioned equipment</span></div>
   <div className="wa-industry-projects">{inventory.map(lot=><article key={lot.id}><div className="wa-industry-blockhead"><div><small>{labels[lot.equipment_kind]} · {lot.status}</small><strong>{lot.template_name} × {number(lot.quantity)}</strong><p>{lot.origin_name} · {lot.stationed_name||'Faction reserve'} · Spec revision {lot.specifications?.revision}</p></div><button type="button" disabled={busy||lot.status==='retired'} onClick={()=>openAssignment(lot)}>Manage</button></div>
    <div className="wa-upgrade-details"><span>Capacity {number(lot.specifications?.cargo_capacity)}</span><span>Personnel {number(lot.specifications?.transport_capacity)}</span><span>Crew {number(lot.specifications?.crew_required)}</span></div></article>)}{!inventory.length&&<p className="wa-npc-subtle">No commissioned equipment. Manufactured units remain in each factory's stores until you commission them.</p>}</div>
  </section>
  {editing&&<div className="wa-industry-overlay"><section className="wa-industry-attach wa-civic-attach" role="dialog" aria-modal="true" aria-label="Magitek equipment design">
   <header className="wa-industry-attach-head"><div><span className="wa-kicker">MAGITEK INDUSTRY / EQUIPMENT BLUEPRINT</span><h3>{editing==='new'?'Create equipment design':'Edit equipment specifications'}</h3><p>Give the factory an output item and define the characteristics of each produced vehicle or carriage.</p></div><button className="wa-industry-close" type="button" onClick={()=>setEditing(null)}>×</button></header>
   <div className="wa-civic-build-fields" style={{padding:20,maxHeight:'65vh',overflow:'auto'}}>
    <label>Equipment item ID<input value={draft.item_id} disabled={editing!=='new'} placeholder="magitek-freight-wagon" onChange={e=>setDraft({...draft,item_id:e.target.value.toLowerCase().replace(/\s+/g,'-')})}/></label>
    <label>Name<input value={draft.name} maxLength="120" onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
    <label>Equipment category<select disabled={editing!=='new'} value={draft.equipment_kind} onChange={e=>setDraft({...draft,equipment_kind:e.target.value})}>{Object.entries(labels).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
    <label>Available for new recipes<select value={draft.enabled?'on':'off'} onChange={e=>setDraft({...draft,enabled:e.target.value==='on'})}><option value="on">Available</option><option value="off">Disabled</option></select></label>
    <label>Passenger / troop capacity<input type="number" min="0" max="10000" value={draft.transport_capacity} onChange={e=>setDraft({...draft,transport_capacity:Number(e.target.value)})}/></label>
    <label>Cargo capacity (units)<input type="number" min="0" max="100000" value={draft.cargo_capacity} onChange={e=>setDraft({...draft,cargo_capacity:Number(e.target.value)})}/></label>
    <label>Required crew<input type="number" min="0" max="1000" value={draft.crew_required} onChange={e=>setDraft({...draft,crew_required:Number(e.target.value)})}/></label>
    <label>Operating fuel<select value={draft.fuel_item_id||''} onChange={e=>setDraft({...draft,fuel_item_id:e.target.value||null})}><option value="">No operating fuel</option>{items.filter(i=>i.category==='fuel').map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
    <label>Fuel per operation<input type="number" min="0" max="10000" step=".001" value={draft.fuel_per_operation} onChange={e=>setDraft({...draft,fuel_per_operation:Number(e.target.value)})}/></label>
    <label className="wide">Description<input value={draft.description} maxLength="500" onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
   </div><p className="wa-npc-subtle" style={{padding:'0 20px'}}>Specifications are pinned when equipment is commissioned. Editing a template does not retroactively upgrade existing vehicles. Production still requires an actual factory recipe and consumed components.</p>
   <footer className="wa-industry-attach-foot"><button type="button" onClick={()=>setEditing(null)}>Cancel</button><button className="wa-industry-primary" type="button" disabled={busy||!draft.item_id||!draft.name.trim()} onClick={()=>submit('/world-admin/industry/equipment/templates'+(editing==='new'?'':'/'+editing),editing==='new'?'POST':'PUT',draft,'Equipment design saved. It can now be used as a manufacturing recipe output.')}>{busy?'Saving…':'Save equipment design'}</button></footer>
  </section></div>}
  {assign&&<div className="wa-industry-overlay"><section className="wa-industry-attach wa-civic-attach" role="dialog" aria-modal="true" aria-label="Equipment reserve and stationing">
   <header className="wa-industry-attach-head"><div><span className="wa-kicker">FLEET INVENTORY</span><h3>{assign.template_name} × {number(assign.quantity)}</h3><p>Commissioned from {assign.origin_name}; you can allocate part of a reserve lot without duplicating equipment. Stationing here is a readiness assignment, not a physical cargo delivery.</p></div><button className="wa-industry-close" type="button" onClick={()=>setAssign(null)}>×</button></header>
   <div className="wa-civic-build-fields" style={{padding:20}}>
    <label>Fleet condition<select value={assignment.status} onChange={e=>setAssignment({...assignment,status:e.target.value})}>{['reserve','assigned','damaged','retired'].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
    {assignment.status==='assigned'&&<label>Stationed at<select value={assignment.stationed_settlement_id} onChange={e=>setAssignment({...assignment,stationed_settlement_id:e.target.value})}><option value="">Choose settlement</option>{settlements.filter(x=>x.controlling_faction_id===assign.owner_faction_id).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
    <label>Units to assign<input type="number" min="1" max={assign.quantity} step="1" value={assignment.quantity} onChange={e=>setAssignment({...assignment,quantity:Number(e.target.value)})}/></label>
    <label className="wide">Operational notes<input maxLength="300" value={assignment.notes} onChange={e=>setAssignment({...assignment,notes:e.target.value})}/></label>
   </div><footer className="wa-industry-attach-foot"><button type="button" onClick={()=>setAssign(null)}>Cancel</button><button type="button" className="wa-industry-primary" disabled={busy||!Number.isInteger(assignment.quantity)||assignment.quantity<1||assignment.quantity>Number(assign.quantity)||assignment.status==='assigned'&&!assignment.stationed_settlement_id} onClick={()=>submit('/world-admin/industry/equipment/inventory/'+assign.id+'/state','POST',{...assignment,stationed_settlement_id:assignment.status==='assigned'?Number(assignment.stationed_settlement_id):null},'Equipment status updated.')}>Save fleet status</button></footer>
  </section></div>}
 </div>;
}
