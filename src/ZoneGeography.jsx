import React,{useEffect,useMemo,useState} from 'react';
import './zone-geography.css';

const directions=[['north','North','fa-arrow-up'],['west','West','fa-arrow-left'],['east','East','fa-arrow-right'],['south','South','fa-arrow-down']];
const shifts={north:[0,-1],west:[-1,0],east:[1,0],south:[0,1]};
export function adjacentZone(zones,origin,direction){
 if(origin?.grid_x==null||origin?.grid_y==null)return null;
 const [dx,dy]=shifts[direction]||[0,0];
 return zones.find(z=>z.grid_x!=null&&z.grid_y!=null&&Number(z.grid_x)===Number(origin.grid_x)+dx&&Number(z.grid_y)===Number(origin.grid_y)+dy)||null;
}
export default function ZoneGeography({region,zones=[],activeZone,regionAccess=[],canEdit=false,request,onSaved,onNavigate}){
 const [target,setTarget]=useState(''),[anchor,setAnchor]=useState(''),[direction,setDirection]=useState('east'),[access,setAccess]=useState('ground_and_air'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const placeable=useMemo(()=>zones.filter(z=>!z.is_default),[zones]);
 const placed=placeable.filter(z=>z.grid_x!=null&&z.grid_y!=null);
 const unplaced=placeable.filter(z=>z.grid_x==null||z.grid_y==null);
 useEffect(()=>{setTarget(String(unplaced[0]?.id||''));setAnchor(String(placed[0]?.id||''));setAccess(regionAccess.find(r=>Number(r.region_id)===Number(region?.id))?.access_policy||'ground_and_air');setError('');setNotice('')},[region?.id,regionAccess.map(r=>r.region_id+':'+r.access_policy).join(',')]);
 const savePosition=async()=>{
  if(busy||!target)return;
  setBusy(true);setError('');setNotice('');
  try{
   await request('/world-admin/geography/zones/'+target+'/place',{method:'POST',body:placed.length?{anchor_zone_id:Number(anchor),direction}:{anchor_zone_id:null}});
   await onSaved?.();setNotice('Zone position saved. Neighboring maps now have fixed directions.');
  }catch(e){setError(e.message||'Unable to position this zone.')}finally{setBusy(false)}
 };
 const saveAccess=async()=>{
  if(busy||!region)return;
  setBusy(true);setError('');setNotice('');
  try{await request('/world-admin/geography/regions/'+region.id+'/access',{method:'POST',body:{access_policy:access}});await onSaved?.();setNotice('Region access policy saved.')}
  catch(e){setError(e.message||'Unable to change region access.')}finally{setBusy(false)}
 };
 return <details className="wa-geography-layout">
  <summary><i className="fa-solid fa-compass" aria-hidden="true"/> Zone placement & region access <span>{placed.length}/{placeable.length} zones positioned</span></summary>
  <div className="wa-geography-layout-body">
   <section>
    <h3>Connected zone positions</h3>
    <p>Zones are placed on a fixed north, south, east, west grid. A shared border does not automatically create a road: add a matching crossing to enable travel.</p>
    <div className="wa-adjacent-layout" aria-label="Adjacent zone map navigation">
     {directions.map(([dir,label,icon])=>{const nearby=adjacentZone(placeable,activeZone,dir);return <button type="button" key={dir} className={'wa-adjacent-'+dir+(nearby?' available':'')} disabled={!nearby} onClick={()=>nearby&&onNavigate?.(String(nearby.id))}><i className={'fa-solid '+icon} aria-hidden="true"/><span>{label}</span><strong>{nearby?.name||'No adjacent zone'}</strong></button>})}
     <div className="wa-adjacent-center"><strong>{activeZone?.name||'Select a zone'}</strong><small>{activeZone?.is_default?'Regional overview':activeZone?.grid_x==null?'Not positioned':`Grid ${activeZone.grid_x}, ${activeZone.grid_y}`}</small></div>
    </div>
    {unplaced.length>0&&<p>{unplaced.length} zone{unplaced.length===1?' is':'s are'} not positioned yet. Existing settlements and map artwork are unchanged.</p>}
   </section>
   {canEdit&&<section className="wa-geography-layout-controls">
    <h3>Place a zone</h3>
    <label>Unpositioned zone<select value={target} onChange={e=>setTarget(e.target.value)}><option value="">Choose zone</option>{unplaced.map(z=><option value={z.id} key={z.id}>{z.name}</option>)}</select></label>
    {placed.length>0&&<><label>Beside zone<select value={anchor} onChange={e=>setAnchor(e.target.value)}><option value="">Choose anchor</option>{placed.map(z=><option key={z.id} value={z.id}>{z.name} ({z.grid_x},{z.grid_y})</option>)}</select></label>
    <label>Direction<select value={direction} onChange={e=>setDirection(e.target.value)}>{directions.map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label></>}
    <button type="button" disabled={busy||!target||(placed.length>0&&!anchor)} onClick={savePosition}>{placed.length?'Place adjacent zone':'Set first zone at center'}</button>
    <h3>Travel into this region</h3>
    <label>Regional access<select value={access} onChange={e=>setAccess(e.target.value)}><option value="ground_and_air">Ground crossings and airships</option><option value="airship_only">Airship only from other regions</option></select></label>
    <p>Airship-only blocks road and railway crossings entering or leaving this region. Roads and rails inside the region still work. An actual airship service and landing facilities are still required for travel.</p>
    <button type="button" disabled={busy} onClick={saveAccess}>Save region access</button>
   </section>}
  </div>
  {error&&<p className="wa-geography-feedback" role="alert">{error}</p>}
  {notice&&<p className="wa-geography-feedback" role="status">{notice}</p>}
 </details>;
}
