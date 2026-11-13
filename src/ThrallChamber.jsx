import React,{useEffect,useState} from 'react';
import './thrall-chamber.css';

const channels=[{id:'upper',label:'Lacteal Reservoir',material:'Breast milk',icon:'flask'},{id:'lower',label:'Secondary Reservoir',material:'Biological collection',icon:'vial'}];
const title=s=>String(s||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const stamp=s=>s?new Date(s).toLocaleString():'—';
const fluid=n=>Number(n||0).toFixed(1);
const lowerTypes={unclassified:'Unclassified',vaginal:'Vaginal collection',seminal:'Seminal collection',mixed:'Mixed collection',other:'Fantasy collection'};
const anatomyLabel={vulva:'Vulva anatomy',penis:'Penis anatomy',mixed:'Mixed anatomy',other:'Fantasy anatomy',unspecified:'Anatomy not specified'};

export default function ThrallChamber({request}){
 const [data,setData]=useState(null);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [view,setView]=useState('console');
 const [batch,setBatch]=useState({channel:'upper',quantity:10,classification:'Unclassified',notes:''});
 const [showBatch,setShowBatch]=useState(false);
 const [inventoryFluid,setInventoryFluid]=useState('lacteal');
 const [drain,setDrain]=useState(null);
 const [showFluidNames,setShowFluidNames]=useState(false);
 const [showMeterLabels,setShowMeterLabels]=useState(false);
 const [meterLabels,setMeterLabels]=useState({meter_label:'Stimulation',action_label:'Activate'});
 const [fluidNames,setFluidNames]=useState({upper_fluid_name:'Breast Milk',lower_fluid_name:'Secondary Fluid'});
 const [seatChoice,setSeatChoice]=useState('');
 const load=async()=>{const next=await request('/thralls/chamber');setData(next);setError('');};
 useEffect(()=>{let active=true;request('/thralls/chamber').then(d=>{if(active)setData(d)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[]);
 useEffect(()=>{let active=true;const tick=setInterval(()=>{request('/thralls/chamber').then(d=>{if(active){setData(d);setError('')}}).catch(e=>{if(active)setError('Chamber refresh failed: '+(e.message||'API unavailable')+'. Check the Windows API and run npm run setup:local.')})},10000);return()=>{active=false;clearInterval(tick)}},[]);
 const canManage=Boolean(data?.can_manage);
 const canConfigureFluids=Boolean(data?.can_configure_fluids);
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
 const meter=data?.meter;
 async function meterAction(action,fields={},success='Meter updated'){
  setBusy(true);setError('');setNotice('');
  try{await request('/thralls/chamber/stimulation',{method:'POST',body:{action,...fields}});await load();setNotice(success);return true}
  catch(e){setError(e.message||'Unable to update stimulation controls');return false}
  finally{setBusy(false)}
 }
 const occupant=data?.seat;
 const eligibleRoster=(data?.roster||[]).filter(c=>Boolean(c.allow_seating));
 const selectedSeat=eligibleRoster.some(c=>c.id===seatChoice)?seatChoice:'';
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
    <div><small>UPPER RESERVOIR</small><strong>{fluid(machine.upper_volume)} <em>/ {fluid(machine.upper_capacity)}</em></strong><span>Fluid units</span></div>
    <div><small>LOWER RESERVOIR</small><strong>{fluid(machine.lower_volume)} <em>/ {fluid(machine.lower_capacity)}</em></strong><span>Fluid units</span></div>
    <div><small>ARCHIVED BATCHES</small><strong>{data.batches.length}</strong><span>Most recent records</span></div>
   </div>
   <nav className="chamber-tabs" aria-label="Chamber workspace">
    {[['console','Control room','sliders'],['inventory','Batch inventory','flask-vial'],['history','Activity ledger','clock-rotate-left']].map(([id,label,icon])=><button key={id} type="button" className={view===id?'selected':''} onClick={()=>setView(id)} aria-current={view===id?'page':undefined}><i className={'fa-solid fa-'+icon}/> {label}</button>)}
    <button type="button" className="chamber-refresh" onClick={()=>load().catch(e=>setError(e.message))}><i className="fa-solid fa-arrows-rotate"/> Refresh</button>
   </nav>
   {view==='console'&&<>
    <div className="chamber-layout">
     <section className="chamber-card chamber-machine">
      <div className="chamber-heading"><div><span>01 / MAIN APPARATUS</span><h3>Magitek control station</h3></div><i className="fa-solid fa-gears"/></div>
      <div className="chamber-power-readout" role="status"><i className="fa-solid fa-bolt"/> Power flow: <strong>{(data.power?.grade||'legacy').toUpperCase()}</strong> · {Number(data.power?.rate?.amount??0.1).toFixed(1)} fluid units / {Number(data.power?.rate?.interval_ms??30000)/1000}s{Number(data.power?.rate?.amount)===0?' · Extraction paused until power improves':''}</div>
      <div className="chamber-visual" aria-label="Schematic of the central magitek apparatus">
       <div className="chamber-lightstrip"/>
       <div className="chamber-apparatus-layout">
        {channels.map(c=>{
         const volume=Math.max(0,Number(machine[c.id+'_volume'])||0);
         const capacity=Math.max(0,Number(machine[c.id+'_capacity'])||0);
         const pct=capacity?Math.min(100,100*volume/capacity):0;
         const extracting=machine.machine_status==='running'&&machine[c.id+'_status']==='active'&&Boolean(occupant?.character_id);
         const fluidName=machine[c.id+'_fluid_name']||c.material;
         return <div key={c.id} className={'chamber-visual-vessel '+(extracting?'extracting':'idle')}>
          <div className="chamber-vessel-heading"><span>{c.id==='upper'?'LACTEAL':'SECONDARY'}</span><span className={'chamber-pill '+machine[c.id+'_status']}>{title(machine[c.id+'_status'])}</span></div>
          <div className="chamber-glass-shell" role="progressbar" aria-label={fluidName+' collection vessel'} aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={volume} aria-valuetext={fluid(volume)+' of '+fluid(capacity)+' fluid units'}>
           <div className="chamber-glass-markings" aria-hidden="true"/>
           <div className="chamber-white-fluid" style={{height:volume>0?'max(3px, '+pct+'%)':'0%'}} aria-hidden="true">
            <div className="chamber-fluid-wave"/>
            <span className="chamber-fluid-bubble bubble-one"/>
            <span className="chamber-fluid-bubble bubble-two"/>
            <span className="chamber-fluid-bubble bubble-three"/>
           </div>
           <div className="chamber-glass-shine" aria-hidden="true"/>
          </div>
          <div className="chamber-vessel-readout"><strong>{fluid(volume)}</strong><small>/ {fluid(capacity)} units</small></div>
          <span className="chamber-vessel-material" title={fluidName}>{fluidName}</span>
          <span className="chamber-vessel-percent">{pct.toFixed(1)}% full</span>
         </div>;
        }).slice(0,1)}
        <div className="chamber-center-throne">
         <div className="chamber-frame">
          <i className="fa-solid fa-chair"/><span>EXTRACTION THRONE</span><small>{occupant?.character_id?'Occupied: '+occupant.name:'Empty · stationary lower vaults'}</small>
         </div>
         <div className="chamber-feed"><span>UPPER ASSEMBLY</span><span className={'chamber-pill '+machine.upper_status}>{title(machine.upper_status)}</span></div>
         <div className="chamber-feed"><span>LOWER ASSEMBLY</span><span className={'chamber-pill '+machine.lower_status}>{title(machine.lower_status)}</span></div>
        </div>
        {channels.map(c=>{
         const volume=Math.max(0,Number(machine[c.id+'_volume'])||0);
         const capacity=Math.max(0,Number(machine[c.id+'_capacity'])||0);
         const pct=capacity?Math.min(100,100*volume/capacity):0;
         const extracting=machine.machine_status==='running'&&machine[c.id+'_status']==='active'&&Boolean(occupant?.character_id);
         const fluidName=machine[c.id+'_fluid_name']||c.material;
         return <div key={c.id} className={'chamber-visual-vessel '+(extracting?'extracting':'idle')}>
          <div className="chamber-vessel-heading"><span>{c.id==='upper'?'LACTEAL':'SECONDARY'}</span><span className={'chamber-pill '+machine[c.id+'_status']}>{title(machine[c.id+'_status'])}</span></div>
          <div className="chamber-glass-shell" role="progressbar" aria-label={fluidName+' collection vessel'} aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={volume} aria-valuetext={fluid(volume)+' of '+fluid(capacity)+' fluid units'}>
           <div className="chamber-glass-markings" aria-hidden="true"/>
           <div className="chamber-white-fluid" style={{height:volume>0?'max(3px, '+pct+'%)':'0%'}} aria-hidden="true">
            <div className="chamber-fluid-wave"/>
            <span className="chamber-fluid-bubble bubble-one"/>
            <span className="chamber-fluid-bubble bubble-two"/>
            <span className="chamber-fluid-bubble bubble-three"/>
           </div>
           <div className="chamber-glass-shine" aria-hidden="true"/>
          </div>
          <div className="chamber-vessel-readout"><strong>{fluid(volume)}</strong><small>/ {fluid(capacity)} units</small></div>
          <span className="chamber-vessel-material" title={fluidName}>{fluidName}</span>
          <span className="chamber-vessel-percent">{pct.toFixed(1)}% full</span>
         </div>;
        }).slice(1)}
       </div>
      </div>
      <div className="chamber-stimulation">
       <div className="chamber-stimulation-head"><div><small>CHARACTER-OPERATED CONTROL</small><h4>{machine.stimulation_meter_label||'Stimulation'}</h4></div><div className="chamber-stimulation-value"><strong>{Math.min(100,Math.max(0,Math.floor(Number(meter?.points||0))))}</strong><span>/ 100</span></div></div>
       <div className="chamber-stimulation-track" role="progressbar" aria-valuenow={Math.min(100,Math.max(0,Number(meter?.points||0)))} aria-valuemin={0} aria-valuemax={100} aria-label={machine.stimulation_meter_label||'Stimulation'}><span style={{width:Math.min(100,Math.max(0,Number(meter?.points||0)))+'%'}}/></div>
       <div className="chamber-stimulation-foot"><span>{meter?.ready?'Ready for seated character':meter?.rate_per_30_seconds?'+'+meter.rate_per_30_seconds+' points / 30s while assemblies run':'Activates while a configured assembly is running with power'}</span><span>{(meter?.active_channels||[]).length} connected assembly{meter?.active_channels?.length===1?'':'s'}</span></div>
       <div className="chamber-stimulation-controls">
        <button type="button" className="chamber-stimulation-trigger" disabled={busy||!meter?.ready||!meter?.can_trigger||machine.machine_status!=='running'||!(meter?.active_channels?.length)} onClick={()=>meterAction('trigger',{},'Manual stimulation activated and collection balances updated.')}>{machine.stimulation_action_label||'Activate'}</button>
        {canConfigureFluids&&<button type="button" className="chamber-admin-config" disabled={busy} onClick={()=>{setMeterLabels({meter_label:machine.stimulation_meter_label||'Stimulation',action_label:machine.stimulation_action_label||'Activate'});setShowMeterLabels(true)}}><i className="fa-solid fa-pen-to-square"/> Edit control labels</button>}
       </div>
       <small className="chamber-helper">{meter?.can_trigger?'Only your button press activates this control; reaching 100 does not trigger it automatically.':'Only the player of the seated character can activate this control.'} Output is limited by available daily production and reservoir space.</small>
      </div>
      <div className="chamber-actions">
       <button disabled={!canManage||busy||machine.machine_status==='running'||!occupant?.character_id||!['upper','lower'].some(channel=>machine[channel+'_status']==='ready')} onClick={()=>act('set_status',{status:'running'},'Apparatus activated.')}><i className="fa-solid fa-play"/> Start</button>
       <button disabled={!canManage||busy||machine.machine_status!=='running'} onClick={()=>act('set_status',{status:'standby'},'Apparatus returned to standby.')}><i className="fa-solid fa-stop"/> Stop</button>
       <button disabled={!canManage||busy} className="chamber-danger" onClick={()=>act('set_status',{status:'offline'},'All operations halted.')}><i className="fa-solid fa-power-off"/> Emergency stop</button>
      </div>
      <p className="chamber-helper">A character must occupy the chair before the system can run. Both reservoirs begin Offline. Set either reservoir to Ready, then press Start to extract from that one. Prepare both if you want both running. Each assembly can be operated independently. Daily output and reservoir capacity still apply. The chair must be offline before seating a character.</p>
     </section>
     <section className="chamber-card">
      <div className="chamber-heading"><div><span>02 / SYSTEM MANAGEMENT</span><h3>Assembly states</h3></div>{canConfigureFluids&&<button type="button" className="chamber-admin-config" disabled={busy} onClick={()=>{setFluidNames({upper_fluid_name:machine.upper_fluid_name||'Breast Milk',lower_fluid_name:machine.lower_fluid_name||'Secondary Fluid'});setShowFluidNames(true)}}><i className="fa-solid fa-pen-to-square"/> Edit fluid names</button>}</div>
      <p className="chamber-helper">Select Ready on either or both reservoirs. Start activates only prepared assemblies. You can prepare or switch off the other independently while running.</p>
      {occupant?.character_id&&machine.machine_status!=='running'&&(!['upper','lower'].some(channel=>machine[channel+'_status']==='ready'))&&<p className="chamber-helper" role="status">Start locked: set at least one reservoir to Ready first.</p>}
      {channels.map(c=><div className="chamber-assembly" key={c.id}>
       <div className="chamber-assembly-head"><strong>{c.label}</strong><span className={'chamber-pill '+machine[c.id+'_status']}>{title(machine[c.id+'_status'])}</span></div>
       {machine[c.id+'_status']==='active'&&occupant?.character_id&&data.daily&&<div className="chamber-daily-balance">
        <div><span>{(machine[c.id+'_fluid_name']||(c.id==='upper'?'Breast Milk':'Secondary Fluid')).toLocaleUpperCase()} AVAILABLE TODAY</span><strong>{fluid(data.daily[c.id].remaining)} <small>/ {fluid(data.daily[c.id].maximum)} fluid units</small></strong></div>
        <div className="chamber-daily-meter" role="progressbar" aria-label={c.label+' daily availability'} aria-valuemin={0} aria-valuemax={data.daily[c.id].maximum} aria-valuenow={data.daily[c.id].remaining}><span style={{width:(data.daily[c.id].maximum?100*data.daily[c.id].remaining/data.daily[c.id].maximum:0)+'%'}}/></div>
        <small>Power-adjusted extraction rate shown in the control station · Replenishes at 00:00 UTC · Stored fluid is retained.</small>
        {data.collection_health?.[c.id]&&<small role="status">Collection status: {data.collection_health[c.id]}</small>}
       </div>}
       <div className="chamber-buttons">{['offline','ready','maintenance'].map(status=><button type="button" key={status} aria-pressed={machine[c.id+'_status']===status} disabled={!canManage||busy||machine[c.id+'_status']===status} onClick={()=>act('maintenance',{channel:c.id,status},c.label+' marked '+status)}>{title(status)}</button>)}</div>
      </div>)}
      {!canManage&&<p className="chamber-helper">Your rank permits viewing this workspace. Staff and Household ranks can modify chamber controls and records.</p>}
     </section>
    </div>
    <section className="chamber-card">
     <div className="chamber-heading"><div><span>03 / CHAIR OCCUPANCY</span><h3>Character assignment</h3></div><i className="fa-solid fa-user-lock"/></div>
     {occupant?.character_id?<div className="chamber-assembly">
      <div className="chamber-assembly-head"><strong>{occupant.name}</strong><span className="chamber-pill active">Seated</span></div>
      <p className="chamber-helper">Upper recorded: {fluid(occupant.upper_recorded)} fluid units · Lower recorded: {fluid(occupant.lower_recorded)} fluid units. Output is simulated from recorded character physiology and machine cycles.</p>
      {data.can_release&&<div className="chamber-actions"><button type="button" disabled={busy} className="chamber-danger" onClick={()=>act('release',{},'Character released and apparatus switched offline.')}>Release character</button></div>}
     </div>:<div className="chamber-assembly">
      <p className="chamber-helper">Eligible bound characters and your own registered characters appear here. The apparatus must be offline to place anyone in the chair.</p>
      {canManage&&<div className="chamber-record">
       <label>Character<select value={selectedSeat} onChange={e=>setSeatChoice(e.target.value)}><option value="">Choose a character</option>{eligibleRoster.map(c=><option value={c.id} key={c.id}>{c.name}{c.is_own?' (My character)':''} · {anatomyLabel[c.lower_anatomy]||'Unspecified'}</option>)}</select></label>
       <button type="button" disabled={busy||machine.machine_status!=='offline'||!selectedSeat} onClick={()=>act('seat',{character_id:selectedSeat},'Character seated in the offline apparatus.')}>Secure character in chair</button>
      </div>}
      {canManage&&eligibleRoster.length===0&&<p className="chamber-helper" role="status">No characters are available for seating. Enable chamber seating in the character dossier, save, then refresh this page.</p>}
      {machine.machine_status!=='offline'&&canManage&&<p className="chamber-helper">Set the apparatus to Offline before seating a character.</p>}
     </div>}
    </section>
    <section className="chamber-card">
     <div className="chamber-heading"><div><span>04 / STORAGE VESSELS</span><h3>Collection reservoirs</h3></div><i className="fa-solid fa-flask-vial"/></div>
     <div className="chamber-reservoirs">{channels.map(c=>{
      const volume=Number(machine[c.id+'_volume']),capacity=Number(machine[c.id+'_capacity']),pct=Math.min(100,Math.round(100*volume/capacity));
      return <div className="chamber-reservoir" key={c.id}>
       <div className="chamber-reservoir-top"><strong>{c.label}</strong><span>{fluid(volume)} / {fluid(capacity)} fluid units</span></div>
       <div className="chamber-tank" role="progressbar" aria-label={c.label} aria-valuenow={volume} aria-valuemin={0} aria-valuemax={capacity}><div style={{width:pct+'%'}}/></div>
       <small>{c.id==='lower'?(lowerTypes[machine.lower_material_type]||'Unclassified'):c.material} · {pct}% of capacity</small>
       {canManage&&<div className="chamber-record">
        <button type="button" disabled={busy||volume<=0} onClick={()=>{setBatch({channel:c.id,quantity:volume,classification:'Unclassified',notes:''});setShowBatch(true)}}>Decant batch</button>
       </div>}
      </div>;
     })}</div>
    </section>
   </>}
   {view==='inventory'&&<section className="chamber-card">
    <div className="chamber-heading"><div><span>ALCHEMICAL ANNEX</span><h3>Collected batch inventory</h3><p className="chamber-helper">Character-attributed fluid tanks. Add more by transferring liquid from the matching collection reservoir, or drain whole units into Workshop and Garden stock for Demon Dust.</p></div><i className="fa-solid fa-flasks"/></div>
    <div className="chamber-inventory-switch" role="group" aria-label="Batch inventory fluid">
     <button type="button" aria-pressed={inventoryFluid==='lacteal'} onClick={()=>setInventoryFluid('lacteal')}><i className="fa-solid fa-droplet"/> {machine.upper_fluid_name||'Breast Milk'} Tanks</button>
     <button type="button" aria-pressed={inventoryFluid==='secondary'} onClick={()=>setInventoryFluid('secondary')}><i className="fa-solid fa-flask"/> {machine.lower_fluid_name||'Secondary Fluid'} Tanks</button>
    </div>
    {(()=>{
     const currentBatches=(data.batches||[]).filter(b=>b.material===inventoryFluid);
     const channel=inventoryFluid==='lacteal'?'upper':'lower',reservoirVolume=Number(machine[channel+'_volume']||0);
     return <>
      <div className="chamber-inventory-actions">
       <span>{currentBatches.length} tank{currentBatches.length===1?'':'s'} · {fluid(currentBatches.reduce((sum,b)=>sum+Number(b.quantity),0))} fluid units stored</span>
       {canManage&&<button type="button" disabled={busy||reservoirVolume<=0} onClick={()=>{setBatch({channel,quantity:reservoirVolume,classification:'Unclassified',notes:''});setShowBatch(true)}}><i className="fa-solid fa-plus"/> Add fluid from reservoir ({fluid(reservoirVolume)})</button>}
      </div>
      {!currentBatches.length?<div className="chamber-empty">No {inventoryFluid==='lacteal'?'breast milk':'secondary fluid'} tanks yet. Collect fluid in the chamber, then add it from the corresponding reservoir.</div>:
       <div className="chamber-batch-tank-grid">{currentBatches.map(b=>{
        const quantity=Number(b.quantity)||0;
        const capacity=Math.max(10,Math.ceil((quantity+Number(b.drained_total||0))/10)*10);
        const pct=Math.min(100,capacity?quantity/capacity*100:0);
        const canAddFromReservoir=reservoirVolume>0&&String(machine[channel+'_source_character_id']||'')===String(b.source_character_id||'')&&(channel==='upper'||machine.lower_material_type===b.material_type);
        return <div className="chamber-batch-tank-card" key={b.id}>
         <div className="chamber-batch-tank-heading"><div><span>BATCH TANK #{b.id}</span><strong>{b.source_name||'Unattributed / legacy'}</strong></div><span className="chamber-batch-kind">{inventoryFluid==='lacteal'?'Lacteal':(lowerTypes[b.material_type]||'Secondary')}</span></div>
         <div className="chamber-batch-tank-body">
          <div className="chamber-batch-glass" role="progressbar" aria-label={'Tank '+b.id+' stored fluid'} aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={quantity}>
           <div className="chamber-batch-white-fluid" style={{height:quantity>0?'max(3px, '+pct+'%)':'0%'}}><div className="chamber-fluid-wave"/></div>
           <div className="chamber-glass-shine"/>
          </div>
          <div className="chamber-batch-tank-metrics"><strong>{fluid(quantity)} <small>fluid units available</small></strong><span>{fluid(b.drained_total||0)} units transferred to Workshop</span><span>From: {b.source_name||'Unattributed / legacy'}</span><span>{stamp(b.created_at)}</span><small>{b.classification||'Unclassified'}</small></div>
         </div>
         {canManage&&<div className="chamber-batch-tank-controls">
          <button type="button" disabled={busy||!canAddFromReservoir} title={canAddFromReservoir?'Add from the matching live collection reservoir':'Requires matching source and material in the collection reservoir'} onClick={()=>{setBatch({channel,quantity:reservoirVolume,classification:b.classification||'Unclassified',notes:''});setShowBatch(true)}}><i className="fa-solid fa-plus"/> Add more</button>
          <button type="button" disabled={busy||Math.floor(quantity)<1} onClick={()=>setDrain({batch_id:b.id,quantity:Math.floor(quantity),available:quantity,source_name:b.source_name||'Unattributed / legacy',channel})}><i className="fa-solid fa-faucet-drip"/> Drain to Workshop</button>
         </div>}
        </div>;
       })}</div>}
     </>;
    })()}
   </section>}
   {view==='history'&&<section className="chamber-card"><div className="chamber-heading"><div><span>SECURE RECORDS</span><h3>Activity ledger</h3></div><i className="fa-solid fa-book"/></div>{!data.history.length?<div className="chamber-empty">No recorded activity yet.</div>:<div className="chamber-history">{data.history.map(h=><div key={h.id}><span className="chamber-history-icon"><i className="fa-solid fa-clock-rotate-left"/></span><div><strong>{title(h.action)}</strong><p>{h.detail}</p><small>{h.actor} · {stamp(h.created_at)}</small></div></div>)}</div>}</section>}
   {showMeterLabels&&canConfigureFluids&&<div className="chamber-overlay" role="presentation"><form className="chamber-dialog" aria-label="Edit stimulation labels" onSubmit={async e=>{e.preventDefault();if(await meterAction('set_labels',meterLabels,'Control labels updated.'))setShowMeterLabels(false)}}>
    <div className="chamber-heading"><div><span>ADMIN / DISPLAY SETTINGS</span><h3>Stimulation control labels</h3></div><button type="button" onClick={()=>setShowMeterLabels(false)} aria-label="Close">✕</button></div>
    <p className="chamber-helper">Change the name shown above the meter and on the character-operated button. Labels don't change the underlying meter or production rules.</p>
    <label>Meter heading<input required maxLength="64" value={meterLabels.meter_label} onChange={e=>setMeterLabels(v=>({...v,meter_label:e.target.value}))}/></label>
    <label>Action button<input required maxLength="64" value={meterLabels.action_label} onChange={e=>setMeterLabels(v=>({...v,action_label:e.target.value}))}/></label>
    <div className="chamber-actions"><button type="button" onClick={()=>setShowMeterLabels(false)}>Cancel</button><button type="submit" disabled={busy||!meterLabels.meter_label.trim()||!meterLabels.action_label.trim()}>Save labels</button></div>
   </form></div>}
   {showFluidNames&&canConfigureFluids&&<div className="chamber-overlay" role="presentation"><form className="chamber-dialog" aria-label="Edit collection fluid names" onSubmit={async e=>{e.preventDefault();if(await act('set_fluid_names',fluidNames,'Fluid names updated.'))setShowFluidNames(false)}}>
    <div className="chamber-heading"><div><span>ADMIN / CHAMBER SETTINGS</span><h3>Collection fluid names</h3></div><button type="button" onClick={()=>setShowFluidNames(false)} aria-label="Close">✕</button></div>
    <p className="chamber-helper">Names appear above each character's available fluid balance. Changing a name does not change existing quantities or extraction behavior.</p>
    <label>Lacteal Reservoir fluid name<input required maxLength="80" value={fluidNames.upper_fluid_name} onChange={e=>setFluidNames(v=>({...v,upper_fluid_name:e.target.value}))} placeholder="Breast Milk"/></label>
    <label>Secondary Reservoir fluid name<input required maxLength="80" value={fluidNames.lower_fluid_name} onChange={e=>setFluidNames(v=>({...v,lower_fluid_name:e.target.value}))} placeholder="Secondary Fluid"/></label>
    <div className="chamber-actions"><button type="button" onClick={()=>setShowFluidNames(false)}>Cancel</button><button type="submit" disabled={busy||!fluidNames.upper_fluid_name.trim()||!fluidNames.lower_fluid_name.trim()}>Save fluid names</button></div>
   </form></div>}
   {drain&&<div className="chamber-overlay" role="presentation"><form className="chamber-dialog" aria-label="Drain batch tank to workshop stock" onSubmit={async e=>{e.preventDefault();if(await act('drain_batch',{batch_id:drain.batch_id,quantity:Number(drain.quantity)},'Fluid transferred to Workshop and Garden common stock.'))setDrain(null)}}>
    <div className="chamber-heading"><div><span>WORKSHOP STOCK TRANSFER</span><h3>Drain batch tank #{drain.batch_id}</h3></div><button type="button" onClick={()=>setDrain(null)} aria-label="Close">✕</button></div>
    <p className="chamber-helper">Source: {drain.source_name}. Each 1.0 fluid unit transferred becomes 1 whole crafting-stock unit in the shared Workshop and Garden stores. Fractional amounts stay in the tank. Transfers are recorded and cannot be reversed.</p>
    <label>Quantity to drain (whole units)<input required type="number" min="1" step="1" max={Math.floor(drain.available)} value={drain.quantity} onChange={e=>setDrain(v=>({...v,quantity:e.target.value}))}/></label>
    <div className="chamber-actions"><button type="button" onClick={()=>setDrain(null)}>Cancel</button><button type="submit" disabled={busy||!Number.isInteger(Number(drain.quantity))||Number(drain.quantity)<1||Number(drain.quantity)>Math.floor(drain.available)}>Transfer to Workshop</button></div>
   </form></div>}
   {showBatch&&<div className="chamber-overlay" role="presentation"><form className="chamber-dialog" onSubmit={async e=>{e.preventDefault();if(await act('decant',{...batch,quantity:Number(batch.quantity)},'Fluid added to its character batch tank.')){setShowBatch(false);setInventoryFluid(batch.channel==='upper'?'lacteal':'secondary');setView('inventory')}}}>
    <div className="chamber-heading"><div><span>ALCHEMICAL STORAGE</span><h3>Add fluid to batch tank</h3></div><button type="button" onClick={()=>setShowBatch(false)} aria-label="Close">✕</button></div>
    <label>Reservoir<select value={batch.channel} onChange={e=>setBatch(v=>({...v,channel:e.target.value,quantity:Math.min(v.quantity,Number(machine[e.target.value+'_volume']))}))}>{channels.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
    <label>Quantity (fluid units)<input required type="number" min="0.1" step="0.1" max={machine[batch.channel+'_volume']} value={batch.quantity} onChange={e=>setBatch(v=>({...v,quantity:e.target.value}))}/></label>
    <label>Alchemical classification<input maxLength="80" value={batch.classification} onChange={e=>setBatch(v=>({...v,classification:e.target.value}))}/></label>
    <label>Research notes<textarea maxLength="500" value={batch.notes} onChange={e=>setBatch(v=>({...v,notes:e.target.value}))}/></label>
    <div className="chamber-actions"><button type="button" onClick={()=>setShowBatch(false)}>Cancel</button><button disabled={busy} type="submit">Add to tank</button></div>
   </form></div>}
  </>}
 </div>;
}
