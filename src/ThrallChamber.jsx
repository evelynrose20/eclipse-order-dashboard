import React,{useEffect,useState} from 'react';
import './thrall-chamber.css';

const channels=[{id:'upper',label:'Lacteal Reservoir',material:'Breast milk',icon:'flask'},{id:'lower',label:'Secondary Reservoir',material:'Biological collection',icon:'vial'}];
const title=s=>String(s||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const stamp=s=>s?new Date(s).toLocaleString():'—';
const lowerTypes={unclassified:'Unclassified',vaginal:'Vaginal collection',seminal:'Seminal collection',mixed:'Mixed collection',other:'Fantasy collection'};
const anatomyLabel={vulva:'Vulva anatomy',penis:'Penis anatomy',mixed:'Mixed anatomy',other:'Fantasy anatomy',unspecified:'Anatomy not specified'};

export default function ThrallChamber({request}){
 const [data,setData]=useState(null);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [view,setView]=useState('console');
 const [amounts,setAmounts]=useState({upper:10,lower:10});
 const [batch,setBatch]=useState({channel:'upper',quantity:10,classification:'Unclassified',notes:''});
 const [showBatch,setShowBatch]=useState(false);
 const [seatChoice,setSeatChoice]=useState('');
 const load=async()=>setData(await request('/thralls/chamber'));
 useEffect(()=>{let active=true;request('/thralls/chamber').then(d=>{if(active)setData(d)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[]);
 const canManage=Boolean(data?.can_manage);
 async function act(action,fields={},message='Updated'){
  if(!canManage)return;
  setBusy(true);setError('');setNotice('');
  try{
   await request('/thralls/chamber/actions',{method:'POST',body:{action,...fields}});
   await load();
   setNotice(message);
   return true;
  }catch(e){setError(e.message||'The operation could not be saved.');return false}
  finally{setBusy(false)}
 }
 const machine=data?.machine;
 const occupant=data?.seat;
 const selectedSeat=seatChoice||data?.roster?.find(c=>c.allow_seating&&(c.allow_upper||c.allow_lower))?.id||'';
 if(!machine&&!error)return <div className="chamber"><div className="chamber-card">Opening the chamber console…</div></div>;
 return <div className="chamber">
  <header className="chamber-hero">
   <div><span className="chamber-kicker"><i className="fa-solid fa-lock"/> LOWER VAULTS / RESTRICTED ACCESS</span><h2>Aetheric Extraction Chamber</h2><p>Permanent magitek installation · dual collection and alchemical records</p></div>
   {machine&&<div className={'chamber-status '+machine.machine_status}><span className="chamber-status-dot"/><div><small>APPARATUS STATUS</small><strong>{title(machine.machine_status)}</strong></div></div>}
  </header>
  {error&&<div className="chamber-alert" role="alert">{error} {!machine&&<button type="button" onClick={()=>{setError('');load().catch(e=>setError(e.message))}}>Retry</button>}</div>}
  {notice&&<div className="chamber-notice" role="status">{notice}</div>}
  {machine&&<>
   <div className="chamber-stats">
    <div><small>UPPER RESERVOIR</small><strong>{machine.upper_volume} <em>/ {machine.upper_capacity}</em></strong><span>Fictional units</span></div>
    <div><small>LOWER RESERVOIR</small><strong>{machine.lower_volume} <em>/ {machine.lower_capacity}</em></strong><span>Fictional units</span></div>
    <div><small>ARCHIVED BATCHES</small><strong>{data.batches.length}</strong><span>Most recent records</span></div>
    <div><small>CHAMBER REVISION</small><strong>{machine.revision}</strong><span>Persisted server state</span></div>
   </div>
   <nav className="chamber-tabs" aria-label="Chamber workspace">
    {[['console','Control room','sliders'],['inventory','Batch inventory','flask-vial'],['history','Activity ledger','clock-rotate-left']].map(([id,label,icon])=><button key={id} type="button" className={view===id?'selected':''} onClick={()=>setView(id)} aria-current={view===id?'page':undefined}><i className={'fa-solid fa-'+icon}/> {label}</button>)}
    <button type="button" className="chamber-refresh" onClick={()=>load().catch(e=>setError(e.message))}><i className="fa-solid fa-arrows-rotate"/> Refresh</button>
   </nav>
   {view==='console'&&<>
    <div className="chamber-layout">
     <section className="chamber-card chamber-machine">
      <div className="chamber-heading"><div><span>01 / MAIN APPARATUS</span><h3>Magitek control station</h3></div><i className="fa-solid fa-gears"/></div>
      <div className="chamber-visual" aria-label="Schematic of the central magitek apparatus">
       <div className="chamber-lightstrip"/>
       <div className="chamber-frame">
        <i className="fa-solid fa-chair"/><span>EXTRACTION THRONE</span><small>{occupant?.character_id?'Occupied: '+occupant.name:'Empty · stationary lower vaults'}</small>
       </div>
       <div className="chamber-feed"><span>UPPER ASSEMBLY</span><span className={'chamber-pill '+machine.upper_status}>{title(machine.upper_status)}</span></div>
       <div className="chamber-feed"><span>LOWER ASSEMBLY</span><span className={'chamber-pill '+machine.lower_status}>{title(machine.lower_status)}</span></div>
      </div>
      <div className="chamber-actions">
       <button disabled={!canManage||busy||machine.machine_status==='running'||!occupant?.character_id} onClick={()=>act('set_status',{status:'running'},'Apparatus activated.')}><i className="fa-solid fa-play"/> Start</button>
       <button disabled={!canManage||busy||machine.machine_status!=='running'} onClick={()=>act('set_status',{status:'standby'},'Apparatus returned to standby.')}><i className="fa-solid fa-stop"/> Stop</button>
       <button disabled={!canManage||busy} className="chamber-danger" onClick={()=>act('set_status',{status:'offline'},'All operations halted.')}><i className="fa-solid fa-power-off"/> Emergency stop</button>
      </div>
      <p className="chamber-helper">A character must occupy the chair before the system can run. The chair must be offline before seating a character. These controls update the fictional in-world machine record. They do not operate any physical equipment.</p>
     </section>
     <section className="chamber-card">
      <div className="chamber-heading"><div><span>02 / SYSTEM MANAGEMENT</span><h3>Assembly states</h3></div><i className="fa-solid fa-gauge-high"/></div>
      {channels.map(c=><div className="chamber-assembly" key={c.id}>
       <div className="chamber-assembly-head"><strong>{c.label}</strong><span className={'chamber-pill '+machine[c.id+'_status']}>{title(machine[c.id+'_status'])}</span></div>
       <div className="chamber-buttons">{['ready','active','maintenance','offline'].map(status=><button type="button" key={status} aria-pressed={machine[c.id+'_status']===status} disabled={!canManage||busy||machine[c.id+'_status']===status} onClick={()=>act('maintenance',{channel:c.id,status},c.label+' marked '+status)}>{title(status)}</button>)}</div>
      </div>)}
      {!canManage&&<p className="chamber-helper">Your rank permits viewing this workspace. Staff and Household ranks can modify chamber controls and records.</p>}
      <div className="chamber-note"><i className="fa-solid fa-shield-heart"/> OOC consent and scene boundaries remain independent of in-character machine settings.</div>
     </section>
    </div>
    <section className="chamber-card">
     <div className="chamber-heading"><div><span>03 / CHAIR OCCUPANCY</span><h3>Character assignment</h3></div><i className="fa-solid fa-user-lock"/></div>
     {occupant?.character_id?<div className="chamber-assembly">
      <div className="chamber-assembly-head"><strong>{occupant.name}</strong><span className="chamber-pill active">Seated</span></div>
      <p className="chamber-helper">Upper recorded: {occupant.upper_recorded} units · Lower recorded: {occupant.lower_recorded} units. Limits are controlled through the player's bound character dossier.</p>
      {data.can_release&&<div className="chamber-actions"><button type="button" disabled={busy} className="chamber-danger" onClick={()=>act('release',{},'Character released and apparatus switched offline.')}>Release character</button></div>}
     </div>:<div className="chamber-assembly">
      <p className="chamber-helper">Eligible bound characters and your own opted-in characters appear as available. The apparatus must be offline to place anyone in the chair.</p>
      {canManage&&<div className="chamber-record">
       <label>Bound character<select value={selectedSeat} onChange={e=>setSeatChoice(e.target.value)}><option value="">Choose a character</option>{(data.roster||[]).filter(c=>c.allow_seating&&(c.allow_upper||c.allow_lower)).map(c=><option value={c.id} key={c.id}>{c.name} · {anatomyLabel[c.lower_anatomy]||'Unspecified'}</option>)}</select></label>
       <button type="button" disabled={busy||machine.machine_status!=='offline'||!selectedSeat} onClick={()=>act('seat',{character_id:selectedSeat},'Character seated in the offline apparatus.')}>Secure character in chair</button>
      </div>}
      {machine.machine_status!=='offline'&&canManage&&<p className="chamber-helper">Set the apparatus to Offline before seating a character.</p>}
     </div>}
    </section>
    <section className="chamber-card">
     <div className="chamber-heading"><div><span>04 / STORAGE VESSELS</span><h3>Collection reservoirs</h3></div><i className="fa-solid fa-flask-vial"/></div>
     <div className="chamber-reservoirs">{channels.map(c=>{
      const volume=Number(machine[c.id+'_volume']),capacity=Number(machine[c.id+'_capacity']),pct=Math.min(100,Math.round(100*volume/capacity));
      return <div className="chamber-reservoir" key={c.id}>
       <div className="chamber-reservoir-top"><strong>{c.label}</strong><span>{volume} / {capacity} units</span></div>
       <div className="chamber-tank" role="progressbar" aria-label={c.label} aria-valuenow={volume} aria-valuemin={0} aria-valuemax={capacity}><div style={{width:pct+'%'}}/></div>
       <small>{c.id==='lower'?(lowerTypes[machine.lower_material_type]||'Unclassified'):c.material} · {pct}% of capacity</small>
       {canManage&&<div className="chamber-record"><label>Record fictional quantity<input type="number" min="1" max="1000" value={amounts[c.id]} onChange={e=>setAmounts(v=>({...v,[c.id]:e.target.value}))}/></label><button type="button" disabled={busy||!occupant?.character_id||machine.machine_status!=='running'||machine[c.id+'_status']!=='active'} onClick={()=>act('record_collection',{channel:c.id,quantity:Number(amounts[c.id])},'Collection added to '+c.label)}>Record units</button><button type="button" disabled={busy||volume<=0} onClick={()=>{setBatch({channel:c.id,quantity:volume,classification:'Unclassified',notes:''});setShowBatch(true)}}>Decant batch</button></div>}
      </div>;
     })}</div>
    </section>
   </>}
   {view==='inventory'&&<section className="chamber-card"><div className="chamber-heading"><div><span>ALCHEMICAL ANNEX</span><h3>Collected batch inventory</h3></div><i className="fa-solid fa-box-archive"/></div>
    {!data.batches.length?<div className="chamber-empty">No batches recorded. Decant a reservoir from the Control room to create a stored batch.</div>:<div className="chamber-table-wrap"><table><thead><tr><th>Batch</th><th>Material</th><th>Quantity</th><th>Classification</th><th>Notes</th><th>Recorded</th></tr></thead><tbody>{data.batches.map(b=><tr key={b.id}><td>#{b.id}</td><td>{b.material==='lacteal'?'Breast milk':(lowerTypes[b.material_type]||'Secondary biological')}</td><td>{b.quantity} units</td><td>{b.classification}</td><td>{b.notes||'—'}</td><td>{stamp(b.created_at)}</td></tr>)}</tbody></table></div>}
   </section>}
   {view==='history'&&<section className="chamber-card"><div className="chamber-heading"><div><span>SECURE RECORDS</span><h3>Activity ledger</h3></div><i className="fa-solid fa-book"/></div>{!data.history.length?<div className="chamber-empty">No recorded activity yet.</div>:<div className="chamber-history">{data.history.map(h=><div key={h.id}><span className="chamber-history-icon"><i className="fa-solid fa-clock-rotate-left"/></span><div><strong>{title(h.action)}</strong><p>{h.detail}</p><small>{h.actor} · {stamp(h.created_at)}</small></div></div>)}</div>}</section>}
   {showBatch&&<div className="chamber-overlay" role="presentation"><form className="chamber-dialog" onSubmit={async e=>{e.preventDefault();if(await act('decant',{...batch,quantity:Number(batch.quantity)},'Batch placed into alchemical inventory.')){setShowBatch(false);setView('inventory')}}}>
    <div className="chamber-heading"><div><span>ALCHEMICAL STORAGE</span><h3>Decant reservoir batch</h3></div><button type="button" onClick={()=>setShowBatch(false)} aria-label="Close">✕</button></div>
    <label>Reservoir<select value={batch.channel} onChange={e=>setBatch(v=>({...v,channel:e.target.value,quantity:Math.min(v.quantity,Number(machine[e.target.value+'_volume']))}))}>{channels.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
    <label>Quantity (fictional units)<input required type="number" min="1" max={machine[batch.channel+'_volume']} value={batch.quantity} onChange={e=>setBatch(v=>({...v,quantity:e.target.value}))}/></label>
    <label>Alchemical classification<input maxLength="80" value={batch.classification} onChange={e=>setBatch(v=>({...v,classification:e.target.value}))}/></label>
    <label>Research notes<textarea maxLength="500" value={batch.notes} onChange={e=>setBatch(v=>({...v,notes:e.target.value}))}/></label>
    <div className="chamber-actions"><button type="button" onClick={()=>setShowBatch(false)}>Cancel</button><button disabled={busy} type="submit">Store batch</button></div>
   </form></div>}
  </>}
 </div>;
}
