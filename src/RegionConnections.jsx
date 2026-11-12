import React,{useMemo,useState} from 'react';
import './zone-geography.css';

const cardinal=[['north','North'],['east','East'],['south','South'],['west','West']];
export default function RegionConnections({region,zones=[],regions=[],connections=[],canEdit=false,request,onSaved,onNavigate}){
 const [source,setSource]=useState(''),[destinationRegion,setDestinationRegion]=useState(''),[destinationZone,setDestinationZone]=useState(''),[name,setName]=useState(''),[direction,setDirection]=useState('east'),[kind,setKind]=useState('ground'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const local=zones.filter(z=>Number(z.region_id)===Number(region?.id));
 const others=regions.filter(r=>Number(r.id)!==Number(region?.id));
 const remote=zones.filter(z=>Number(z.region_id)===Number(destinationRegion));
 const active=connections.filter(c=>Number(c.from_region_id)===Number(region?.id)||Number(c.to_region_id)===Number(region?.id));
 const selectedSource=local.some(z=>String(z.id)===source)?source:String(local.find(z=>!z.is_default)?.id||local[0]?.id||'');
 const selectedRegion=others.some(r=>String(r.id)===destinationRegion)?destinationRegion:String(others[0]?.id||'');
 const selectedRemote=zones.filter(z=>String(z.region_id)===selectedRegion);
 const selectedDestination=selectedRemote.some(z=>String(z.id)===destinationZone)?destinationZone:String(selectedRemote.find(z=>!z.is_default)?.id||selectedRemote[0]?.id||'');
 const create=async()=>{
  if(busy||!selectedSource||!selectedDestination||!name.trim())return;
  setBusy(true);setError('');setNotice('');
  try{
   await request('/world-admin/region-connections',{method:'POST',body:{name:name.trim(),from_region_id:Number(region.id),from_zone_id:Number(selectedSource),to_region_id:Number(selectedRegion),to_zone_id:Number(selectedDestination),connection_kind:kind,direction:kind==='ground'?direction:null}});
   await onSaved?.();setName('');setNotice('Regional connection saved. Ground travel still requires a paired road or rail crossing.');
  }catch(e){setError(e.message||'Unable to create regional connection.')}finally{setBusy(false)}
 };
 const remove=async c=>{
  if(busy||!window.confirm('Remove regional connection '+c.name+'?'))return;
  setBusy(true);setError('');setNotice('');
  try{await request('/world-admin/region-connections/'+c.id,{method:'DELETE'});await onSaved?.();setNotice('Regional connection removed.')}
  catch(e){setError(e.message||'Connection could not be removed. Remove any linked road/rail crossings first.')}finally{setBusy(false)}
 };
 const names=id=>zones.find(z=>Number(z.id)===Number(id))?.name||'Unknown zone';
 const rnames=id=>regions.find(r=>Number(r.id)===Number(id))?.name||'Unknown region';
 const reverse={north:'south',south:'north',east:'west',west:'east'};
 return <section className="wa-region-links">
  <h3>Region connections</h3>
  <p>Choose exactly which zones touch across regional borders. Ground borders have facing edges; airship connections require no shared edge. A connection defines geography, not an automatic transport route.</p>
  <div className="wa-region-link-list">{active.length?active.map(c=>{
   const forward=Number(c.from_region_id)===Number(region.id);
   const otherRegion=forward?c.to_region_id:c.from_region_id,otherZone=forward?c.to_zone_id:c.from_zone_id;
   const oriented=forward?c.direction:reverse[c.direction];
   return <div className="wa-region-link-row" key={c.id}><div><strong>{c.name}</strong><small>{c.connection_kind==='ground'?('Ground · '+(oriented||'')+' border'):'Airship connection'} · {rnames(otherRegion)} / {names(otherZone)}</small></div><button type="button" onClick={()=>onNavigate?.(otherRegion,otherZone)}>View zone</button>{canEdit&&<button type="button" disabled={busy} onClick={()=>remove(c)} aria-label={'Remove '+c.name}><i className="fa-solid fa-trash-can" aria-hidden="true"/></button>}</div>;
  }):<p>No connections to other regions defined yet.</p>}</div>
  {canEdit&&<div className="wa-region-link-form">
   <label>Connection name<input value={name} maxLength={120} placeholder="Northern Imperial Pass" onChange={e=>setName(e.target.value)}/></label>
   <label>From zone<select value={selectedSource} onChange={e=>setSource(e.target.value)}>{local.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</select></label>
   <label>Neighboring region<select value={selectedRegion} onChange={e=>{setDestinationRegion(e.target.value);setDestinationZone('')}}>{others.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
   <label>Connected zone<select value={selectedDestination} onChange={e=>setDestinationZone(e.target.value)}>{selectedRemote.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</select></label>
   <label>Connection type<select value={kind} onChange={e=>setKind(e.target.value)}><option value="ground">Ground border</option><option value="airship">Airship connection</option></select></label>
   {kind==='ground'&&<label>Direction from this zone<select value={direction} onChange={e=>setDirection(e.target.value)}>{cardinal.map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>}
   <button type="button" disabled={busy||!name.trim()||!selectedSource||!selectedDestination} onClick={create}>Save region connection</button>
  </div>}
  {error&&<p role="alert" className="wa-geography-feedback">{error}</p>}
  {notice&&<p role="status" className="wa-geography-feedback">{notice}</p>}
 </section>;
}
