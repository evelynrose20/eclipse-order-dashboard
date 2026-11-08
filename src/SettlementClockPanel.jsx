import React,{useEffect,useState} from 'react';
export default function SettlementClockPanel({request,settlement,regionMode,profile}){
 const [state,setState]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const ready=regionMode==='managed'&&!!settlement.simulation_enabled&&!profile?.paused&&['managed','detailed'].includes(profile?.enabled_mode);
 async function load(){const data=await request('/world-admin/simulation');setState(data.settlements.find(s=>Number(s.id)===Number(settlement.id))||null)}
 useEffect(()=>{load().catch(e=>setError(e.message||'Simulation clock unavailable'))},[settlement.id]);
 async function save(next){
  setBusy(true);setError('');setNotice('');
  try{await request('/world-admin/simulation/'+settlement.id+'/settings',{method:'PUT',body:next});await load();setNotice('Clock settings updated.')}
  catch(e){setError(e.message||'Unable to update clock')}finally{setBusy(false)}
 }
 if(!state)return <p className="wa-hint">{error||'Loading automatic simulation controls…'}</p>;
 const choice={mode:state.mode,cadence:state.cadence==='fast'?'normal':state.cadence,paused:state.paused};
 return <div className="wa-npc-settings wa-clock-config">
  <div className="wa-npc-section-title"><h4>Automatic settlement clock</h4><span>Order settlements: opt-in</span></div>
  <p className="wa-hint">The Windows API checks once per minute, but applies only one eligible cycle per date. Existing civilian inventories are consumed, never invented. Manual cycles and automatic cycles share the same daily accounting lock.</p>
  {!ready&&<p className="wa-civic-alerts">To enable automatic Order cycles, set the region to Managed, enable this settlement's simulation, and select Managed/Detailed in the civilian policy. All three are required.</p>}
  {error&&<p role="alert" className="wa-error">{error}</p>}{notice&&<p role="status" className="wa-notice">{notice}</p>}
  <div className="wa-npc-settings-row">
   <label>Automatic cycles<select disabled={busy} value={state.mode} onChange={e=>save({...choice,mode:e.target.value})}><option value="off">Off (manual only)</option><option value="automatic">Automatic</option></select></label>
   <label>Speed<select disabled={busy} value={choice.cadence} onChange={e=>save({...choice,cadence:e.target.value})}><option value="slow">Slow (every 3 days)</option><option value="normal">Normal (daily)</option></select></label>
   <label>Clock<select disabled={busy} value={state.paused?'paused':'running'} onChange={e=>save({...choice,paused:e.target.value==='paused'})}><option value="running">Running</option><option value="paused">Paused</option></select></label>
  </div>
  <p className="wa-npc-subtle">Last processed cycle: {state.last_cycle_key||'Never'}. While turned off, settlement conditions remain under staff control.</p>
 </div>;
}
