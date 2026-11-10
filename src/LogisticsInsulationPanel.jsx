import React,{useState} from 'react';
export default function LogisticsInsulationPanel({data,request,onRefresh}){
 const [selected,setSelected]=useState({}),[qty,setQty]=useState({}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const needs=data.insulation_needs||[],facilities=data.facilities||[],stocks=data.stocks||[];
 async function deliver(n){
  setBusy(true);setError('');
  try{await request('/world-admin/logistics/insulation/'+n.project_id+'/commit',{method:'POST',body:{facility_id:Number(selected[n.project_id]),quantity:Number(qty[n.project_id]||1)}});await onRefresh()}catch(e){setError(e.message||'Winterization supplies unavailable')}finally{setBusy(false)}
 }
 return <section className="freight-list"><div className="freight-list-head"><div><h3>Winterization construction supply</h3><small>Industrial insulation panels must be delivered before work can advance. Transport supplies through the freight network first.</small></div></div>
 {error&&<p className="wa-error" role="alert">{error}</p>}
 {needs.map(n=>{const remaining=Math.max(0,Number(n.required_qty)-Number(n.committed_qty)),available=facilities.filter(f=>Number(f.settlement_id)===Number(n.settlement_id)&&f.owner_faction_id==='eclipse-order').map(f=>({...f,quantity:Number(stocks.find(s=>Number(s.facility_id)===Number(f.id)&&s.item_id===n.item_id)?.quantity||0)}));return <article className="freight-row" key={n.project_id}><div><span className="freight-status">ORDER CIVIC PROJECT · #{n.project_id}</span><strong>{n.project_name} · {n.settlement_name}</strong><small>{n.committed_qty} of {n.required_qty} insulation panels delivered · {remaining} remaining</small><progress max={Number(n.required_qty)} value={Number(n.committed_qty)} style={{width:'100%',accentColor:'#c6ae81'}}/></div>{remaining>0&&<div className="freight-row-actions"><label className="freight-depot-select">Supplying depot<select value={selected[n.project_id]||''} onChange={e=>setSelected({...selected,[n.project_id]:e.target.value})}><option value="">Choose depot</option>{available.map(f=><option key={f.id} value={f.id}>{f.name} · {f.quantity} panels</option>)}</select></label><label className="freight-depot-select">Units<input type="number" step=".001" min=".001" max={remaining} value={qty[n.project_id]||1} onChange={e=>setQty({...qty,[n.project_id]:e.target.value})}/></label><button disabled={busy||!selected[n.project_id]||Number(qty[n.project_id]||1)>remaining} onClick={()=>deliver(n)}>Commit panels</button></div>}</article>})}
 {!needs.length&&<p className="freight-empty">No active Order winterization projects currently require insulation deliveries.</p>}
 </section>;
}
