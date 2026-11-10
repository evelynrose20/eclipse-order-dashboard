import React,{useEffect,useState} from 'react';
import './order-city-builder.css';
const format=n=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:1});
export default function OrderCityBuilder({settlement,request,onChanged,onBuild,onSupply,canEdit=true}){
 const [data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function load(){const reply=await request('/world-admin/city/'+settlement.id);setData(reply)}
 useEffect(()=>{setData(null);setError('');load().catch(e=>setError(e.message||'City records unavailable'))},[settlement.id]);
 const switchIntake=async()=>{
  if(!data)return;
  setBusy(true);setError('');setNotice('');
  try{const next=data.intake==='off'?'automatic':'off';await request('/world-admin/city/'+settlement.id+'/intake',{method:'PUT',body:{residential_intake:next}});await load();await onChanged?.();setNotice(next==='off'?'Residential arrivals paused.':'Residential intake opened. Only housed and supplied residents can arrive, at most once per day.')}
  catch(e){setError(e.message||'Unable to change residential intake')}finally{setBusy(false)}
 };
 if(!data)return <section className="order-city-builder"><p>{error||'Loading your city…'}</p></section>;
 const checks=[['Housing','Available completed residential places',data.requirements.housing,'fa-house'],['Food','At least three days of supplies for arriving residents',data.requirements.food,'fa-wheat-awn'],['Water','At least two days of clean water for arriving residents',data.requirements.water,'fa-droplet'],['Security','Settlement is not contested or undergoing restoration',data.requirements.safety,'fa-shield-halved']];
 return <section className="order-city-builder" aria-label={'City building for '+settlement.name}>
  <div className="order-city-hero"><div><span>THE ECLIPSE ORDER / CIVIC DEVELOPMENT</span><h3>{settlement.name}</h3><p>You choose what gets built and funded. Residents can eventually move into completed, supplied housing without creating an autonomous NPC government.</p></div><span className="order-city-mode"><i className="fa-solid fa-crown"/> Player-directed city</span></div>
  {error&&<p className="wa-error" role="alert">{error}</p>}{notice&&<p className="wa-notice" role="status">{notice}</p>}
  <div className="order-city-ledger"><div><small>RESIDENTS</small><strong>{format(data.residents)}</strong><span>Current population</span></div><div><small>HOUSING PLACES</small><strong>{format(data.housing_capacity)}</strong><span>{format(data.vacancies)} vacancies</span></div><div><small>FOOD RESERVES</small><strong>{format(data.food_stock)}</strong><span>Actual civic stock</span></div><div><small>WATER RESERVES</small><strong>{format(data.water_stock)}</strong><span>Actual civic stock</span></div></div>
  <div className="order-city-main">
   <div className="order-city-card"><div className="order-city-card-head"><i className="fa-solid fa-people-group"/><div><h4>Residential districts</h4><p>Population follows available housing and provisions. No need to enter individual civilians.</p></div></div>
    <div className="order-city-popline"><span>Current residents</span><strong>{format(data.residents)} / {format(data.housing_capacity)}</strong></div>
    <div className="order-city-bar"><span style={{width:(data.housing_capacity?Math.min(100,data.residents/data.housing_capacity*100):0)+'%'}}/></div>
    <div className="order-city-requirements">{checks.map(([label,info,ready,icon])=><div key={label}><i className={'fa-solid '+icon}/><span><strong>{label}</strong><small>{info}</small></span><b className={ready?'ready':'blocked'}>{ready?'Ready':'Needed'}</b></div>)}</div>
    <div className="order-city-intake"><div><small>RESIDENT ARRIVALS</small><strong>{data.intake==='automatic'?'Open':'Closed — default'}</strong><span>{data.intake==='off'?'No population changes will occur until you explicitly enable this independent policy.':data.expected_arrivals>0?'Up to '+data.expected_arrivals+' new residents at the next eligible daily check.':'Arrivals blocked until housing, provisions and safety requirements are met.'}</span></div>{canEdit&&<button type="button" disabled={busy} onClick={switchIntake}>{data.intake==='off'?'Open residential intake':'Pause resident arrivals'}</button>}</div>
    <small className="order-city-disclaimer">NPC autonomous simulation remains off. This policy affects resident arrivals only; it never builds structures, spends construction materials, hires workers or changes borders.</small>
   </div>
   <div className="order-city-card"><div className="order-city-card-head"><i className="fa-solid fa-city"/><div><h4>Direct the city</h4><p>Issue the orders; the settlement does not choose its own projects.</p></div></div>
    <div className="order-city-decisions">
     <button type="button" onClick={onBuild}><i className="fa-solid fa-house-chimney"/><span><strong>Build residential quarters</strong><small>Commission housing, waterworks, clinics, schools and fortifications</small></span><i className="fa-solid fa-chevron-right"/></button>
     <button type="button" onClick={onSupply}><i className="fa-solid fa-truck-ramp-box"/><span><strong>Provision settlement</strong><small>Deliver food, fuel, clean water and medicines from actual stores</small></span><i className="fa-solid fa-chevron-right"/></button>
    </div>
    <div className="order-city-demographics"><h5>Estimated civilian composition</h5><div>{[['Children',data.demographics?.children],['Adults',data.demographics?.adults],['Elderly',data.demographics?.elderly],['Eligible workers',data.demographics?.eligible_workers],['Employed',data.demographics?.employed],['Available workers',data.demographics?.unemployed]].map(([label,n])=><span key={label}><small>{label}</small><strong>{format(n)}</strong></span>)}</div><p>Demographics are estimates from total residents. New citizens do not automatically create factory jobs or construction projects.</p></div>
   </div>
  </div>
  <div className="order-city-history"><h4>Recent arrivals</h4>{data.history?.length?<div>{data.history.map((h,i)=><span key={i}>{String(h.cycle_date).slice(0,10)} · {format(h.residents_arrived)} residents settled · {format(h.residents_after)} total</span>)}</div>:<p>No arrivals recorded. Existing residents remain unchanged.</p>}</div>
 </section>;
}
