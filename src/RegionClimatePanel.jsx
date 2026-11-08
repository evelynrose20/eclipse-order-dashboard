import React,{useEffect,useState} from 'react';
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const date=()=>new Date().toISOString().slice(0,10);
export default function RegionClimatePanel({region,request,canEdit,onChanged}){
 const [data,setData]=useState(null),[draft,setDraft]=useState(null),[weather,setWeather]=useState({title:'',weather:'snow',temperature_f:0,starts_on:date(),ends_on:date()});
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 async function load(){const r=await request('/world-admin/climate/'+region.id);setData(r);setDraft({...r,monthly_f:[...r.monthly_f]})}
 useEffect(()=>{setData(null);setError('');load().catch(e=>setError(e.message))},[region.id]);
 async function save(path,method,body,message){setBusy(true);setError('');try{await request('/world-admin/climate/'+region.id+path,{method,body});await load();await onChanged?.();setNotice(message)}catch(e){setError(e.message||'Climate save failed')}finally{setBusy(false)}}
 return <section className="wa-panel"><div className="wa-panel-title"><strong>{region.name} · Climate and forecasts</strong><span>Fictional Garlean weather</span></div>
 {error&&<p role="alert" className="wa-error">{error}</p>}{notice&&<p role="status" className="wa-notice">{notice}</p>}
 {!data||!draft?<p>Loading regional weather…</p>:<>
 <h3>Next ten days</h3><div className="wa-civic-values">{data.forecast.map(f=><div key={f.date}><span>{f.date} · {f.weather.replaceAll('_',' ')} {f.event_title?' · '+f.event_title:''}</span><strong>{f.temperature_f}°F</strong></div>)}</div>
 <h3>Monthly baseline °F</h3><p className="wa-hint">These represent the fictional climate of this region, not real-world weather. Day-to-day variation is deterministic; named DM events override it during their dates.</p>
 <form className="wa-fields" onSubmit={e=>{e.preventDefault();save('','PUT',{monthly_f:draft.monthly_f.map(Number),daily_variation_f:Number(draft.daily_variation_f),severity_modifier:Number(draft.severity_modifier)},'Regional climate saved.')}}>
  {months.map((m,i)=><label key={m}>{m}<input type="number" required min="-148" max="212" step=".1" disabled={!canEdit||busy} value={draft.monthly_f[i]} onChange={e=>setDraft({...draft,monthly_f:draft.monthly_f.map((v,j)=>i===j?e.target.value:v)})}/></label>)}
  <label>Daily variation ±°F<input type="number" required min="0" max="60" step=".1" disabled={!canEdit||busy} value={draft.daily_variation_f} onChange={e=>setDraft({...draft,daily_variation_f:e.target.value})}/></label>
  <label>Microclimate offset °F<input type="number" required min="-40" max="40" step=".1" disabled={!canEdit||busy} value={draft.severity_modifier} onChange={e=>setDraft({...draft,severity_modifier:e.target.value})}/></label>
  {canEdit&&<button disabled={busy} type="submit">Save seasonal climate</button>}
 </form>
 <h3>DM weather events</h3>{data.events.map(e=><p key={e.id}><strong>{e.title}</strong> · {String(e.starts_on).slice(0,10)} to {String(e.ends_on).slice(0,10)} · {e.weather} · {e.temperature_f}°F</p>)}
 {canEdit&&<form className="wa-fields" onSubmit={e=>{e.preventDefault();save('/events','POST',{...weather,temperature_f:Number(weather.temperature_f)},'Weather event scheduled.')}}><label>Event name<input required maxLength="140" value={weather.title} onChange={e=>setWeather({...weather,title:e.target.value})}/></label><label>Conditions<input required maxLength="80" value={weather.weather} onChange={e=>setWeather({...weather,weather:e.target.value})}/></label><label>Temperature °F<input type="number" min="-148" max="212" step=".1" required value={weather.temperature_f} onChange={e=>setWeather({...weather,temperature_f:e.target.value})}/></label><label>Starts<input type="date" required value={weather.starts_on} onChange={e=>setWeather({...weather,starts_on:e.target.value})}/></label><label>Ends<input type="date" required value={weather.ends_on} onChange={e=>setWeather({...weather,ends_on:e.target.value})}/></label><button type="submit" disabled={busy}>Schedule DM weather</button></form>}
 </>}
 </section>;
}
