import React,{useState} from 'react';
import './logistics-escorts.css';

const title=s=>String(s||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
export default function LogisticsEscortsPanel({data,request,onRefresh}){
 const [selection,setSelection]=useState({}),[counts,setCounts]=useState({}),[details,setDetails]=useState({}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const escorts=data.escorts||[],engagements=data.engagements||[];
 const sources=data.facilities||[],warehouses=data.warehouses||[];
 const freight=(data.shipments||[]).filter(s=>['in_transit','disrupted'].includes(s.status)).map(s=>({...s,kind:'freight',label:s.source_name+' → '+s.destination_name,sourceSettlement:sources.find(f=>Number(f.id)===Number(s.source_facility_id))?.settlement_id}));
 const supply=(data.supply_line_shipments||[]).filter(s=>['in_transit','disrupted'].includes(s.status)).map(s=>{
  const source=s.source_kind==='warehouse'?warehouses.find(w=>Number(w.id)===Number(s.source_id)):sources.find(f=>Number(f.id)===Number(s.source_id));
  return {...s,kind:'supply',label:(source?.name||'Supply source')+' → '+((data.military_installations||[]).find(i=>s.destination_kind==='installation'&&Number(i.id)===Number(s.destination_id))?.name||(s.destination_kind==='warehouse'?warehouses.find(w=>Number(w.id)===Number(s.destination_id))?.name:sources.find(f=>Number(f.id)===Number(s.destination_id))?.name)||'Destination'),sourceSettlement:source?.settlement_id};
 });
 const convoys=[...freight,...supply];
 const assigned=(kind,id)=>escorts.find(e=>e.shipment_kind===kind&&Number(e.shipment_id)===Number(id));
 const pending=(kind,id)=>engagements.find(e=>e.shipment_kind===kind&&Number(e.shipment_id)===Number(id)&&e.status==='pending');
 async function command(path,body,success){
  setBusy(true);setError('');setMessage('');
  try{await request(path,{method:'POST',body});await onRefresh();setMessage(success)}
  catch(e){setError(e.message||'Convoy order not accepted')}finally{setBusy(false)}
 }
 const eligible=settlement=> (data.garrisons||[]).filter(g=>g.state==='operational'&&Number(g.condition_pct)>=25&&g.controlling_faction_id==='eclipse-order'&&Number(g.settlement_id)===Number(settlement)&&Number(g.quantity)>0);
 const garrisonChoice=g=>g.installation_id+':'+g.troop_type;
 const selections=convoys.filter(c=>c.status==='in_transit'&&!assigned(c.kind,c.id));
 return <section className="freight-list escort-command">
  <header className="freight-list-head"><div><h3>Convoy escort command</h3><small>Assign existing garrisons to road, railway and air movements. Contested destinations require a command decision before cargo can arrive.</small></div><span>{convoys.length} movements · {engagements.filter(e=>e.status==='pending').length} battles awaiting orders</span></header>
  {error&&<p className="wa-error" role="alert">{error}</p>}{message&&<p className="wa-notice" role="status">{message}</p>}
  <div className="escort-command-grid">
   {convoys.map(c=>{
    const key=c.kind+':'+c.id,e=assigned(c.kind,c.id),battle=pending(c.kind,c.id),guards=eligible(c.sourceSettlement),choice=selection[key]||'',unit=guards.find(g=>garrisonChoice(g)===choice);
    return <article className="escort-command-card" key={key}>
     <div className="escort-command-head"><span className={'freight-status is-'+c.status}>{title(c.status)}</span><strong>{c.label}</strong><span className="escort-command-kind">{c.kind==='freight'?'Dispatched freight':'Standing supply'}</span></div>
     <p>{c.item_name||c.item_id} · {Number(c.quantity||0).toLocaleString()} units</p>
     <div className="escort-command-readiness">{e?<span><i className="fa-solid fa-shield-halved"/> Escorted: {e.troops} {e.troop_type} · {e.installation_name}</span>:<span><i className="fa-solid fa-shield"/> No escort assigned</span>}</div>
     {battle&&<p className="escort-command-threat"><i className="fa-solid fa-triangle-exclamation"/> {battle.threat} · Severity {battle.severity} · Awaiting DM outcome</p>}
     {!e&&c.status==='in_transit'&&<div className="escort-command-assignment"><label>Assign departure garrison<select value={choice} onChange={ev=>setSelection(v=>({...v,[key]:ev.target.value}))}><option value="">Choose available unit</option>{guards.map(g=><option key={garrisonChoice(g)} value={garrisonChoice(g)}>{g.installation_name} · {g.troop_type} ({g.quantity} stationed)</option>)}</select></label><label>Troops<input type="number" min="1" max={unit?.quantity||1} step="1" value={counts[key]||1} onChange={ev=>setCounts(v=>({...v,[key]:ev.target.value}))}/></label><button type="button" disabled={busy||!unit||Number(counts[key]||1)<1||Number(counts[key]||1)>Number(unit.quantity)} onClick={()=>command('/world-admin/logistics/escorts/'+c.kind+'/'+c.id+'/assign',{installation_id:unit.installation_id,troop_type:unit.troop_type,troops:Number(counts[key]||1)},'Escort assigned to '+c.label)}>Assign escort</button>{!guards.length&&<small className="escort-command-hint">Station an operational garrison at the departure settlement to provide protection.</small>}</div>}
     {!battle&&c.status==='in_transit'&&<button type="button" className="escort-command-report" disabled={busy} onClick={()=>{const threat=window.prompt('Hostile force or threat reported','Hostile patrol');if(!threat)return;const severity=window.prompt('Threat severity (1–5)','2');if(!severity)return;void command('/world-admin/logistics/escorts/'+c.kind+'/'+c.id+'/report-attack',{threat,severity:Number(severity),detail:'Hostile contact reported for command review'},'War engagement reported; cargo held pending DM decision.')}}>Report hostile contact</button>}
     {battle&&<div className="escort-command-decision"><label>DM battle report<textarea rows={2} placeholder="Record the encounter and approved result" value={details[battle.id]||''} onChange={ev=>setDetails(v=>({...v,[battle.id]:ev.target.value}))}/></label><div><button type="button" disabled={busy||!details[battle.id]?.trim()} onClick={()=>command('/world-admin/logistics/escorts/engagements/'+battle.id+'/resolve',{decision:'secured',detail:details[battle.id]},'Route secured. Convoy continuing in 30 minutes.')}>Route secured · Resume</button><button type="button" disabled={busy||!details[battle.id]?.trim()} onClick={()=>command('/world-admin/logistics/escorts/engagements/'+battle.id+'/resolve',{decision:'held',detail:details[battle.id]},'Convoy holding position for further orders.')}>Hold position</button></div></div>}
    </article>;
   })}
  </div>
  {!convoys.length&&<p className="freight-empty">No convoys currently on the road, rail, or air routes. Dispatch freight or create a standing supply line to assign guards.</p>}
  {engagements.filter(e=>e.status!=='pending').length>0&&<details className="escort-command-history"><summary>Recent engagement decisions</summary>{engagements.filter(e=>e.status!=='pending').slice(0,20).map(e=><p key={e.id}>{title(e.shipment_kind)} #{e.shipment_id} · {e.threat} · {title(e.status)} · {e.detail}</p>)}</details>}
 </section>;
}
