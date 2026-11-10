import React,{useState} from 'react';
const show=x=>String(x||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
export default function LogisticsIncidentsPanel({data,request,onRefresh}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const incidents=data.incidents||[],shipments=data.shipments||[];
 async function decide(i,decision){
  setBusy(true);setError('');
  try{await request('/world-admin/logistics/incidents/'+i.id+'/resolve',{method:'POST',body:{decision}});await onRefresh()}
  catch(e){setError(e.message||'Unable to issue convoy orders')}finally{setBusy(false)}
 }
 return <section className="freight-list"><div className="freight-list-head"><div><h3>Convoy incidents & command decisions</h3><small>Interruption reports are linked to real shipments. Cargo remains reserved until it arrives or is recalled.</small></div><span>{incidents.filter(i=>i.disposition==='pending').length} awaiting orders</span></div>
  {error&&<p className="wa-error" role="alert">{error}</p>}
  {incidents.map(i=>{const s=shipments.find(x=>Number(x.id)===Number(i.shipment_id));return <article key={i.id} className="freight-row"><div><span className={'freight-status '+(i.disposition==='pending'?'is-disrupted':'is-arrived')}>{i.disposition==='pending'?'Awaiting orders':show(i.disposition)}</span><strong>{show(i.incident_type)} · {s?.item_name||'Cargo'} × {Number(s?.quantity||0).toLocaleString()}</strong><small>{s?.source_name||'Origin'} → {s?.destination_name||'Destination'} · Severity {i.severity}</small><small>Weather: {i.weather_snapshot||'Unknown'} · {i.created_at?new Date(i.created_at).toLocaleString():''}</small></div>{i.disposition==='pending'&&<div className="freight-row-actions"><button disabled={busy} onClick={()=>decide(i,'wait')} title="Shelter convoy and postpone arrival by three hours"><i className="fa-solid fa-hourglass-half"/> Shelter (3h)</button><button disabled={busy} onClick={()=>decide(i,'escort')} title="Requires an operational garrison at either end of the supply route"><i className="fa-solid fa-shield-halved"/> Request escort (30m)</button></div>}</article>})}
  {!incidents.length&&<p className="freight-empty">No convoy incidents recorded. Snowstorms and blizzards can interrupt shipments when they reach their destination.</p>}
 </section>;
}
