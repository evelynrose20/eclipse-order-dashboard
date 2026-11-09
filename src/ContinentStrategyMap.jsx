import React,{useEffect,useMemo,useRef,useState} from 'react';
import './continent-strategy-map.css';
const W=1000,H=700;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const pretty=s=>String(s||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const palette={peaceful:'#668778',secure:'#548f7f',contested:'#be9b60',occupied:'#a56a65',liberated:'#6b9aa8',rebuilding:'#a8a077',abandoned:'#65707a',destroyed:'#7e4e56'};
const vector=points=>points.map(p=>p.x+','+p.y).join(' ');
const pointCenter=points=>({x:points.reduce((s,p)=>s+p.x,0)/points.length,y:points.reduce((s,p)=>s+p.y,0)/points.length});
export default function ContinentStrategyMap({continent={},zones=[],regions=[],settlements=[],factions=[],canEdit=false,request,onSaved,onOpenZone}){
 const [selected,setSelected]=useState(''),[tool,setTool]=useState('inspect'),[draft,setDraft]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [camera,setCamera]=useState({x:0,y:0,w:W,h:H});
 const [layer,setLayer]=useState('control'),[editSettings,setEditSettings]=useState(false),[settings,setSettings]=useState(null);
 const svgRef=useRef(null),panRef=useRef(null),vertexRef=useRef(null),ignoreClick=useRef(false);
 const cameraRef=useRef(camera);
 cameraRef.current=camera;
 const polygons=new Map((continent.territories||[]).map(x=>[Number(x.zone_id),x.polygon]));
 const active=zones.find(z=>String(z.id)===selected)||null;
 const activePoly=active?polygons.get(Number(active.id)):null;
 const activeRegion=regions.find(r=>Number(r.id)===Number(active?.region_id));
 const zoneCount=zones.filter(z=>polygons.has(Number(z.id))).length;
 const activeSites=settlements.filter(s=>Number(s.zone_id)===Number(active?.id));
 const factionName=id=>factions.find(f=>f.id===id)?.name||'Unclaimed';
 const viewport=useMemo(()=>[camera.x,camera.y,camera.w,camera.h].join(' '),[camera]);
 const toPoint=e=>{
  const r=svgRef.current?.getBoundingClientRect();if(!r||!r.width||!r.height)return null;
  return {x:Math.round(clamp(camera.x+(e.clientX-r.left)/r.width*camera.w,0,W)*10)/10,y:Math.round(clamp(camera.y+(e.clientY-r.top)/r.height*camera.h,0,H)*10)/10};
 };
 const zoom=(factor,cx=.5,cy=.5)=>setCamera(v=>{
  const w=clamp(v.w*factor,100,W),h=w*H/W;
  return {x:clamp(v.x+v.w*cx-w*cx,0,W-w),y:clamp(v.y+v.h*cy-h*cy,0,H-h),w,h};
 });
 // Attach a non-passive native wheel listener: React's delegated wheel listener may be passive.
 // Prevent page scrolling only over the actual map surface, not over the rest of the dashboard.
 useEffect(()=>{
  const node=svgRef.current;if(!node)return;
  const handleWheel=e=>{
   if(e.cancelable)e.preventDefault();
   e.stopPropagation();
   const rect=node.getBoundingClientRect();
   if(!rect.width||!rect.height)return;
   const factor=e.deltaY>0?1.13:.885;
   const cx=clamp((e.clientX-rect.left)/rect.width,0,1),cy=clamp((e.clientY-rect.top)/rect.height,0,1);
   setCamera(v=>{
    const w=clamp(v.w*factor,100,W),h=w*H/W;
    return {x:clamp(v.x+v.w*cx-w*cx,0,W-w),y:clamp(v.y+v.h*cy-h*cy,0,H-h),w,h};
   });
  };
  node.addEventListener('wheel',handleWheel,{passive:false});
  return ()=>node.removeEventListener('wheel',handleWheel);
 },[]);
 const selectZone=id=>{setSelected(String(id));setDraft(null);setTool('inspect');setNotice('');setError('')};
 const startDraw=()=>{if(!active)return;setDraft([]);setTool('draw');setError('');setNotice('Click the map to mark the territory boundary. Finish with at least three corners.')};
 const startReshape=()=>{if(!activePoly)return;setDraft(activePoly.map(p=>({...p})));setTool('reshape');setError('')};
 const save=async()=>{
  if(!active||!draft||draft.length<3)return;
  setBusy(true);setError('');
  try{await request('/world-admin/continent/territories/'+active.id,{method:'PUT',body:{polygon:draft}});await onSaved?.();setTool('inspect');setDraft(null);setNotice('Territory boundary saved. Existing simulation records were not changed.')}
  catch(e){setError(e.message||'Unable to save polygon')}finally{setBusy(false)}
 };
 const clear=async()=>{if(!active||!activePoly)return;setBusy(true);setError('');
  try{await request('/world-admin/continent/territories/'+active.id,{method:'PUT',body:{polygon:null}});await onSaved?.();setDraft(null);setTool('inspect');setNotice('Map outline cleared; zone and settlement records remain.')}
  catch(e){setError(e.message||'Unable to clear boundary')}finally{setBusy(false)}
 };
 const saveSettings=async()=>{setBusy(true);setError('');try{await request('/world-admin/continent/settings',{method:'PUT',body:settings});await onSaved?.();setEditSettings(false);setNotice('Continental map settings saved.')}catch(e){setError(e.message||'Unable to save map settings')}finally{setBusy(false)}};
 const mouseDown=e=>{
  if(e.button!==0||vertexRef.current||tool!=='inspect')return;
  e.preventDefault();
  const v=cameraRef.current;
  panRef.current={id:e.pointerId,x:e.clientX,y:e.clientY,ox:v.x,oy:v.y,w:v.w,h:v.h,moved:false};
  e.currentTarget.setPointerCapture(e.pointerId);
 };
 const mouseMove=e=>{
  if(vertexRef.current){const p=toPoint(e);if(p){const i=vertexRef.current.index;setDraft(old=>old?.map((q,j)=>j===i?p:q)||old)}return}
  if(!panRef.current)return;
  const r=svgRef.current?.getBoundingClientRect();if(!r)return;
  const pan=panRef.current;
  if(e.pointerId!==pan.id)return;
  const dx=e.clientX-pan.x,dy=e.clientY-pan.y;
  if(Math.abs(dx)+Math.abs(dy)>4)pan.moved=true;
  if(pan.moved){ignoreClick.current=true;setCamera({x:clamp(pan.ox-dx/r.width*pan.w,0,W-pan.w),y:clamp(pan.oy-dy/r.height*pan.h,0,H-pan.h),w:pan.w,h:pan.h})}
 };
 const mouseUp=e=>{
  if(panRef.current?.id===e.pointerId)panRef.current=null;
  vertexRef.current=null;
 };
 const mapClick=e=>{if(ignoreClick.current){ignoreClick.current=false;return}if(tool!=='draw'||!active)return;const p=toPoint(e);if(p)setDraft(old=>old.length>=100?old:[...old,p])};
 const geometry=zones.map(z=>({zone:z,points:polygons.get(Number(z.id))})).filter(x=>Array.isArray(x.points)&&x.points.length>=3);
 return <section className="csm-root">
  <header className="csm-head"><div><span className="csm-kicker">STRATEGIC COMMAND / CONTINENTAL THEATER</span><h3>{continent.name||'The Continent'}</h3><p>Continuous campaign map · {zoneCount} of {zones.length} territories outlined · {settlements.length} recorded settlements</p></div><div className="csm-controls"><button type="button" onClick={()=>zoom(.8)} aria-label="Zoom in">+</button><button type="button" onClick={()=>zoom(1.25)} aria-label="Zoom out">−</button><button type="button" onClick={()=>setCamera({x:0,y:0,w:W,h:H})}>Fit continent</button>{canEdit&&<button type="button" onClick={()=>{setSettings({name:continent.name||'The Continent',background_url:continent.background_url||''});setEditSettings(x=>!x)}}>Map settings</button>}</div></header>
  {error&&<p className="csm-error" role="alert">{error}</p>}{notice&&<p className="csm-note" role="status">{notice}</p>}
  {editSettings&&canEdit&&<div className="csm-settings"><label>Continent name<input maxLength="140" value={settings?.name||''} onChange={e=>setSettings(v=>({...v,name:e.target.value}))}/></label><label>Background map image (HTTPS URL)<input value={settings?.background_url||''} onChange={e=>setSettings(v=>({...v,background_url:e.target.value}))} placeholder="https://…/continent-map.jpg"/></label><button disabled={busy||!settings?.name?.trim()} onClick={saveSettings}>Save map</button></div>}
  <div className="csm-body">
   <div className="csm-map-shell">
    <div className="csm-layerbar"><span>MAP MODE</span>{[['control','Political'],['status','Territory status']].map(([id,name])=><button key={id} type="button" aria-pressed={layer===id} className={layer===id?'active':''} onClick={()=>setLayer(id)}>{name}</button>)}<span className="csm-zoom">{Math.round(W/camera.w*100)}%</span></div>
    <svg ref={svgRef} className={'csm-map '+(tool==='draw'?'csm-drawing':'')} viewBox={viewport} preserveAspectRatio="none" role="img" aria-label="Continent strategy map with editable territory polygons" onPointerDown={mouseDown} onPointerMove={mouseMove} onPointerUp={mouseUp} onPointerCancel={mouseUp} onClick={mapClick}>
     <defs><pattern id="csm-grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#7994a0" strokeWidth=".55" opacity=".18"/></pattern></defs>
     <rect width={W} height={H} fill="#172b37"/>
     {continent.background_url&&<image href={continent.background_url} width={W} height={H} preserveAspectRatio="none" opacity=".83"/>}
     <rect width={W} height={H} fill="url(#csm-grid)" pointerEvents="none"/>
     {geometry.map(({zone,points})=>{
      const isSelected=selected===String(zone.id),fill=layer==='status'?palette[zone.strategic_state]||'#62727c':zone.controlling_faction_id==='eclipse-order'?'#a58b62':zone.controlling_faction_id?'#688398':'#6e7980';
      const center=pointCenter(points);
      return <g key={zone.id} className={'csm-territory '+(isSelected?'selected':'')} onClick={e=>{if(tool==='draw'){return}e.stopPropagation();if(!ignoreClick.current)selectZone(zone.id);else ignoreClick.current=false}}>
       <polygon points={vector(points)} fill={fill} fillOpacity={isSelected ? 0.65 : 0.4} stroke={isSelected?'#f5d69d':'#c5d1d2'} strokeWidth={isSelected?3:1.7} vectorEffect="non-scaling-stroke"/>
       <text x={center.x} y={center.y} textAnchor="middle" fill="#fff4da" stroke="#0c1721" strokeWidth="3" paintOrder="stroke" fontWeight="700" fontSize="12" pointerEvents="none">{zone.is_default?(regions.find(r=>Number(r.id)===Number(zone.region_id))?.name||zone.name):zone.name}</text>
      </g>;
     })}
     {draft&&draft.length>0&&<g className="csm-draft" pointerEvents="none"><polyline points={vector(draft)} fill="none" stroke="#f1c77f" strokeWidth="2.8" vectorEffect="non-scaling-stroke"/>{draft.length>=3&&<polygon points={vector(draft)} fill="#dcb67b" fillOpacity=".16" stroke="#f0c789" strokeDasharray="6 5" vectorEffect="non-scaling-stroke"/>}</g>}
     {draft&&tool==='reshape'&&draft.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={clamp(camera.w/100,4,10)} fill="#f9da9f" stroke="#273542" strokeWidth="2" className="csm-handle" onPointerDown={e=>{e.stopPropagation();vertexRef.current={index:i};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerUp={mouseUp}/>)}
    </svg>
    {!continent.background_url&&<div className="csm-basemap-hint">Add a continent background image in Map settings. Existing regional images stay untouched.</div>}
    <div className="csm-map-footer"><span>Wheel to zoom · Drag to pan when zoomed in · Click a territory to inspect</span><span>Cartography coordinates: 1000 × 700</span></div>
   </div>
   <aside className="csm-inspector"><div className="csm-aside-heading"><span className="csm-kicker">TERRITORY INDEX</span><strong>{zones.length} territories</strong></div>
    <div className="csm-zone-list">{zones.map(z=><button type="button" key={z.id} className={selected===String(z.id)?'active':''} onClick={()=>selectZone(z.id)}><span className={'csm-zone-indicator '+(polygons.has(Number(z.id))?'mapped':'')}/><span><strong>{z.is_default?(regions.find(r=>Number(r.id)===Number(z.region_id))?.name||z.name):z.name}</strong><small>{factionName(z.controlling_faction_id)} · {pretty(z.strategic_state)}</small></span></button>)}</div>
    {active?<div className="csm-details"><span className="csm-kicker">SELECTED TERRITORY</span><h4>{active.name}</h4><p>{activeRegion?.name||'Unknown region'} · {activeSites.length} settlements · {activePoly?'Border mapped':'Border not drawn'}</p><dl><div><dt>Controller</dt><dd>{factionName(active.controlling_faction_id)}</dd></div><div><dt>Government</dt><dd>{factionName(active.governing_faction_id)}</dd></div><div><dt>Status</dt><dd>{pretty(active.strategic_state)}</dd></div></dl>
      <button type="button" className="csm-primary" onClick={()=>onOpenZone?.(active)}>Open local map & settlements</button>
      {canEdit&&<div className="csm-editor"><strong>Territory borders</strong>{tool==='inspect'?<><button onClick={startDraw}>Draw new border</button>{activePoly&&<button onClick={startReshape}>Edit border vertices</button>}{activePoly&&<button disabled={busy} onClick={clear}>Clear outline</button>}</>:<><p>{tool==='draw'?'Click corners in order to trace this province.':'Drag the corner handles to reshape the boundary.'} {draft?.length||0} points</p><div className="csm-edit-actions">{tool==='draw'&&<button disabled={!draft?.length} onClick={()=>setDraft(d=>d.slice(0,-1))}>Undo point</button>}<button disabled={busy||!draft||draft.length<3} className="csm-primary" onClick={save}>Save border</button><button onClick={()=>{setTool('inspect');setDraft(null)}}>Cancel</button></div></>}</div>}
    </div>:<div className="csm-details"><h4>Choose a territory</h4><p>Select a zone from the index to draw its border or open its existing local map. Existing simulation records are preserved.</p></div>}
   </aside>
  </div>
 </section>;
}
