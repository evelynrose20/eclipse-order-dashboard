import React,{useEffect,useMemo,useRef,useState} from 'react';
import './continent-strategy-map.css';
import {simplifyFreehand,insertVertex} from './continent-trace.js';
import IlsabardTerrain from './IlsabardTerrain.jsx';
const W=1000,H=700;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const pretty=s=>String(s||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const palette={peaceful:'#668778',secure:'#548f7f',contested:'#be9b60',occupied:'#a56a65',liberated:'#6b9aa8',rebuilding:'#a8a077',abandoned:'#65707a',destroyed:'#7e4e56'};
const vector=points=>points.map(p=>p.x+','+p.y).join(' ');
const pointCenter=points=>({x:points.reduce((s,p)=>s+p.x,0)/points.length,y:points.reduce((s,p)=>s+p.y,0)/points.length});
export default function ContinentStrategyMap({continent={},zones=[],regions=[],settlements=[],factions=[],canEdit=false,request,onSaved,onOpenZone,onOpenIndustry,provinces=[]}){
 const [selected,setSelected]=useState(''),[tool,setTool]=useState('inspect'),[draft,setDraft]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [provinceId,setProvinceId]=useState(''),[provinceName,setProvinceName]=useState(''),[terrain,setTerrain]=useState('plains');
 const [camera,setCamera]=useState({x:W*.1,y:H*.1,w:W*.8,h:H*.8});
 const [layer,setLayer]=useState('control'),[showTerrain,setShowTerrain]=useState(true),[editSettings,setEditSettings]=useState(false),[settings,setSettings]=useState(null);
 const [referenceDraft,setReferenceDraft]=useState(null),[referenceOpen,setReferenceOpen]=useState(false),[traceSensitivity,setTraceSensitivity]=useState(2);
 const [referencePending,setReferencePending]=useState(undefined),[uploading,setUploading]=useState(false);
 const svgRef=useRef(null),panRef=useRef(null),vertexRef=useRef(null),ignoreClick=useRef(false),traceRef=useRef(null);
 const reference=referenceDraft||continent.reference||{opacity_pct:75,offset_x:0,offset_y:0,width_pct:100,visible:true,original_name:''};
 const overlayImage=referencePending===undefined?reference.image_data:referencePending;
 const artworkGround=!!(reference.use_as_ground&&overlayImage);
 const isTracing=['trace','province-trace'].includes(tool);
 const isReshaping=['reshape','province-reshape'].includes(tool);
 const cameraRef=useRef(camera);
 cameraRef.current=camera;
 const polygons=new Map((continent.territories||[]).map(x=>[Number(x.zone_id),x.polygon]));
 const active=zones.find(z=>String(z.id)===selected)||null;
 const activePoly=active?polygons.get(Number(active.id)):null;
 const province=provinces.find(p=>String(p.id)===provinceId);
 const childProvinces=provinces.filter(p=>String(p.zone_id)===selected);
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
 const selectZone=id=>{setSelected(String(id));setProvinceId('');setProvinceName('');setDraft(null);setTool('inspect');setNotice('');setError('')};
 const selectProvince=p=>{setSelected(String(p.zone_id));setProvinceId(String(p.id));setProvinceName(p.name);setTerrain(p.terrain);setDraft(null);setTool('inspect');setError('')};
 const provincePayload=polygon=>({zone_id:Number(province.zone_id),name:provinceName.trim(),terrain,polygon});
 const createProvince=async()=>{if(!active||!provinceName.trim())return;setBusy(true);setError('');try{const result=await request('/world-admin/provinces',{method:'POST',body:{zone_id:Number(active.id),name:provinceName.trim(),terrain,polygon:null}});await onSaved?.();setProvinceId(String(result.id));setTool('province-draw');setDraft([]);setNotice('Province created. Draw its outline on the continent.')}catch(e){setError(e.message||'Province creation failed')}finally{setBusy(false)}};
 const updateProvince=async(polygon=province?.polygon||null)=>{if(!province||!provinceName.trim())return;setBusy(true);setError('');try{await request('/world-admin/provinces/'+province.id,{method:'PUT',body:provincePayload(polygon)});await onSaved?.();setDraft(null);setTool('inspect');setNotice('Province saved. Existing industry and city projects remain unchanged.')}catch(e){setError(e.message||'Province save failed')}finally{setBusy(false)}};
 const startDraw=()=>{if(!active)return;setDraft([]);setTool('draw');setError('');setNotice('Click the map to mark the territory boundary. Finish with at least three corners.')};
 const startReshape=()=>{if(!activePoly)return;setDraft(activePoly.map(p=>({...p})));setTool('reshape');setError('')};
 const drawProvince=()=>{if(!province)return;setDraft([]);setTool('province-draw');setError('')};
 const beginTrace=type=>{setDraft([]);traceRef.current=null;setTool(type);setError('');setNotice('Hold left mouse and trace the full outline in one stroke. Release to simplify and close it.')};
 const reshapeProvince=()=>{if(!Array.isArray(province?.polygon))return;setDraft(province.polygon.map(p=>({...p})));setTool('province-reshape');setError('')};
 const save=async()=>{
  if(!active||!draft||draft.length<3)return;
  setBusy(true);setError('');
  try{if(tool.startsWith('province-'))await request('/world-admin/provinces/'+province.id,{method:'PUT',body:provincePayload(draft)});else await request('/world-admin/continent/territories/'+active.id,{method:'PUT',body:{polygon:draft}});await onSaved?.();setTool('inspect');setDraft(null);setNotice('Boundary saved. City-building records unchanged.')}
  catch(e){setError(e.message||'Unable to save polygon')}finally{setBusy(false)}
 };
 const clear=async()=>{if(!active||!activePoly)return;setBusy(true);setError('');
  try{await request('/world-admin/continent/territories/'+active.id,{method:'PUT',body:{polygon:null}});await onSaved?.();setDraft(null);setTool('inspect');setNotice('Map outline cleared; zone and settlement records remain.')}
  catch(e){setError(e.message||'Unable to clear boundary')}finally{setBusy(false)}
 };
 const saveSettings=async()=>{setBusy(true);setError('');try{await request('/world-admin/continent/settings',{method:'PUT',body:settings});await onSaved?.();setEditSettings(false);setNotice('Continental map settings saved.')}catch(e){setError(e.message||'Unable to save map settings')}finally{setBusy(false)}};
 const importReference=async file=>{
  if(!file)return;
  if(!file.type.startsWith('image/')){setError('Choose a PNG, JPEG, or WebP image.');return}
  setUploading(true);setError('');
  try{
   const bitmap=await createImageBitmap(file);
   const canvas=document.createElement('canvas'),scale=Math.min(1,2048/bitmap.width);
   canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
   ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
   let result='';
   for(const q of [.76,.65,.52,.38,.26]){result=canvas.toDataURL('image/webp',q);if(result.length<=350000)break;}
   if(!result.startsWith('data:image/webp;base64,')||result.length>350000)throw new Error('Image too large after compression. Try a smaller map image.');
   setReferencePending(result);
   setReferenceDraft(v=>({...continent.reference,...v,original_name:file.name.slice(0,180),visible:true}));
   setNotice('Reference prepared. Align it, then click Save reference.');
  }catch(e){setError(e.message||'Unable to prepare reference')}finally{setUploading(false)}
 };
 const saveReference=async()=>{
  if(busy||uploading)return;
  setBusy(true);setError('');
  const v=referenceDraft||reference;
  try{
   await request('/world-admin/continent/reference',{method:'PUT',body:{original_name:v.original_name||'',opacity_pct:Number(v.opacity_pct),offset_x:Number(v.offset_x),offset_y:Number(v.offset_y),width_pct:Number(v.width_pct),visible:!!v.visible,use_as_ground:!!v.use_as_ground,...(referencePending!==undefined?{image_data:referencePending}:{})}});
   await onSaved?.();setReferencePending(undefined);setReferenceDraft(null);setNotice('Reference map saved for the world.');
  }catch(e){setError(e.message||'Unable to save reference')}finally{setBusy(false)}
 };
 const changeReference=(key,value)=>setReferenceDraft(v=>({...continent.reference,...v,[key]:value}));
 const mouseDown=e=>{
  if(e.button!==0||vertexRef.current)return;
  if(isTracing){
   e.preventDefault();e.stopPropagation();
   const start=toPoint(e);if(!start)return;
   traceRef.current={id:e.pointerId,points:[start]};
   setDraft([start]);
   e.currentTarget.setPointerCapture(e.pointerId);
   return;
  }
  if(tool!=='inspect')return;
  e.preventDefault();
  const v=cameraRef.current;
  panRef.current={id:e.pointerId,x:e.clientX,y:e.clientY,ox:v.x,oy:v.y,w:v.w,h:v.h,moved:false};
  e.currentTarget.setPointerCapture(e.pointerId);
 };
 const mouseMove=e=>{
  if(traceRef.current&&traceRef.current.id===e.pointerId){
   const point=toPoint(e),trace=traceRef.current;
   if(point&&trace.points.length<2500){
    const last=trace.points[trace.points.length-1],min=Math.max(.35,camera.w/350);
    if(Math.hypot(point.x-last.x,point.y-last.y)>=min){
     trace.points.push(point);
     if(trace.points.length%3===0)setDraft([...trace.points]);
    }
   }
   return;
  }
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
  if(traceRef.current?.id===e.pointerId){
   const traced=traceRef.current.points;traceRef.current=null;ignoreClick.current=true;
   const simplified=simplifyFreehand(traced,traceSensitivity,100);
   if(simplified.length<3){setDraft([]);setError('Trace a longer outline before releasing.');}
   else{setDraft(simplified);setError('');setNotice('Freehand outline simplified to '+simplified.length+' corners. Save or refine its vertices.');}
  }
  if(panRef.current?.id===e.pointerId)panRef.current=null;
  vertexRef.current=null;
 };
 const mapClick=e=>{
  if(ignoreClick.current){ignoreClick.current=false;return}
  if(isReshaping&&draft?.length<100){const p=toPoint(e);if(p)setDraft(old=>insertVertex(old,p));return}
  if(!['draw','province-draw'].includes(tool)||!active)return;
  const p=toPoint(e);if(p)setDraft(old=>old.length>=100?old:[...old,p]);
 };
 const refineDraft=()=>{if(!draft||draft.length<3)return;setTool(province?'province-reshape':'reshape');setNotice('Drag gold corner handles, click near an edge to add a point, or Alt-click a handle to remove it.')};
 const geometry=zones.map(z=>({zone:z,points:polygons.get(Number(z.id))})).filter(x=>Array.isArray(x.points)&&x.points.length>=3);
 return <section className="csm-root">
  <header className="csm-head"><div><span className="csm-kicker">STRATEGIC COMMAND / CONTINENTAL THEATER</span><h3>{continent.name||'The Continent'}</h3><p>Continental terrain · {zoneCount} of {zones.length} state outlines · {provinces.length} provinces · {settlements.length} recorded settlements</p></div><div className="csm-controls"><button type="button" onClick={()=>zoom(.8)} aria-label="Zoom in">+</button><button type="button" onClick={()=>zoom(1.25)} aria-label="Zoom out">−</button><button type="button" onClick={()=>setCamera({x:0,y:0,w:W,h:H})}>Fit continent</button>{canEdit&&<button type="button" aria-pressed={referenceOpen} onClick={()=>setReferenceOpen(v=>!v)}>Reference layers</button>}{canEdit&&<button type="button" onClick={()=>{setSettings({name:continent.name||'The Continent',background_url:continent.background_url||''});setEditSettings(x=>!x)}}>Map settings</button>}</div></header>
  {error&&<p className="csm-error" role="alert">{error}</p>}{notice&&<p className="csm-note" role="status">{notice}</p>}
  {referenceOpen&&canEdit&&<section className="csm-reference-editor" aria-label="Reference artwork alignment">
   <div className="csm-reference-intro"><strong>Continent artwork</strong><p>Upload an illustrated map. Use it either as the actual game terrain or as a tracing guide; editable state and province borders always remain above it.</p></div>
   <label className="csm-upload">Image (PNG, JPEG, or WebP)<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading||busy} onChange={e=>{void importReference(e.target.files?.[0]);e.target.value=''}}/>{uploading?'Compressing image…':reference.original_name||'No uploaded map yet'}</label>
   <label>Opacity: {reference.opacity_pct}%<input type="range" min="0" max="100" value={reference.opacity_pct} onChange={e=>changeReference('opacity_pct',Number(e.target.value))}/></label>
   <label>Scale: {reference.width_pct}%<input type="range" min="20" max="350" value={reference.width_pct} onChange={e=>changeReference('width_pct',Number(e.target.value))}/></label>
   <label>X offset<input type="number" min="-1000" max="1000" step="1" value={reference.offset_x} onChange={e=>changeReference('offset_x',Number(e.target.value))}/></label>
   <label>Y offset<input type="number" min="-700" max="700" step="1" value={reference.offset_y} onChange={e=>changeReference('offset_y',Number(e.target.value))}/></label>
   <label className="csm-reference-visible"><input type="checkbox" checked={!!reference.visible} onChange={e=>changeReference('visible',e.target.checked)}/> Show tracing guide</label><label className="csm-reference-visible"><input type="checkbox" checked={!!reference.use_as_ground} onChange={e=>changeReference('use_as_ground',e.target.checked)}/> Use artwork as playable map ground</label>
   <div className="csm-reference-actions"><button type="button" disabled={busy||uploading} className="csm-primary" onClick={saveReference}>Save reference</button><button type="button" onClick={()=>{setReferenceDraft(null);setReferencePending(undefined)}}>Reset preview</button>{(reference.image_data||referencePending)&&<button type="button" onClick={()=>{setReferencePending(null);changeReference('original_name','')}}>Clear artwork</button>}</div>
  </section>}
  {editSettings&&canEdit&&<div className="csm-settings"><label>Continent name<input maxLength="140" value={settings?.name||''} onChange={e=>setSettings(v=>({...v,name:e.target.value}))}/></label><label>Background map image (HTTPS URL)<input value={settings?.background_url||''} onChange={e=>setSettings(v=>({...v,background_url:e.target.value}))} placeholder="https://…/continent-map.jpg"/></label><button disabled={busy||!settings?.name?.trim()} onClick={saveSettings}>Save map</button></div>}
  <div className="csm-body">
   <div className="csm-map-shell">
    <div className="csm-layerbar"><span>MAP MODE</span>{[['control','Political'],['status','Territory status']].map(([id,name])=><button key={id} type="button" aria-pressed={layer===id} className={layer===id?'active':''} onClick={()=>setLayer(id)}>{name}</button>)}<label className="csm-terrain-toggle"><input type="checkbox" checked={showTerrain} onChange={e=>setShowTerrain(e.target.checked)}/> Native atlas</label>{artworkGround&&<span className="csm-ground-mode">Illustrated map active</span>}<span className="csm-zoom">{Math.round(W/camera.w*100)}%</span></div>
    <svg ref={svgRef} className={'csm-map '+(['draw','province-draw','trace','province-trace'].includes(tool)?'csm-drawing':'')} viewBox={viewport} preserveAspectRatio="none" role="img" aria-label="Continent strategy map with editable territory polygons" onPointerDown={mouseDown} onPointerMove={mouseMove} onPointerUp={mouseUp} onPointerCancel={mouseUp} onClick={mapClick}>
     <defs><pattern id="csm-grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#7994a0" strokeWidth=".55" opacity=".18"/></pattern></defs>
     {artworkGround?<rect width={W} height={H} fill="#183b47"/>:showTerrain?<IlsabardTerrain/>:<rect width={W} height={H} fill="#172b37"/>}
     {!artworkGround&&!showTerrain&&continent.background_url&&<image href={continent.background_url} width={W} height={H} preserveAspectRatio="none" opacity=".83" pointerEvents="none"/>}
     {(artworkGround||referenceOpen&&reference.visible)&&overlayImage&&<image href={overlayImage} x={Number(reference.offset_x)} y={Number(reference.offset_y)} width={W*Number(reference.width_pct)/100} height={H*Number(reference.width_pct)/100} preserveAspectRatio="none" opacity={artworkGround?1:Number(reference.opacity_pct)/100} pointerEvents="none"/>}
     {!artworkGround&&!showTerrain&&<rect width={W} height={H} fill="url(#csm-grid)" pointerEvents="none"/>}
     {geometry.map(({zone,points})=>{
      const isSelected=selected===String(zone.id),fill=layer==='status'?palette[zone.strategic_state]||'#62727c':zone.controlling_faction_id==='eclipse-order'?'#a58b62':zone.controlling_faction_id?'#688398':'#6e7980';
      const center=pointCenter(points);
      return <g key={zone.id} className={'csm-territory '+(isSelected?'selected':'')} onClick={e=>{if(tool!=='inspect')return;e.stopPropagation();if(!ignoreClick.current)selectZone(zone.id);else ignoreClick.current=false}}>
       <polygon points={vector(points)} fill={fill} fillOpacity={isSelected ? 0.36 : 0.15} stroke={isSelected?'#f5d69d':'#c5d1d2'} strokeWidth={isSelected?3:1.7} vectorEffect="non-scaling-stroke"/>
       <text x={center.x} y={center.y} textAnchor="middle" fill="#fff4da" stroke="#0c1721" strokeWidth="3" paintOrder="stroke" fontWeight="700" fontSize="12" pointerEvents="none">{zone.is_default?(regions.find(r=>Number(r.id)===Number(zone.region_id))?.name||zone.name):zone.name}</text>
      </g>;
     })}
     {provinces.filter(p=>Array.isArray(p.polygon)&&p.polygon.length>=3).map(p=>{const chosen=String(p.id)===provinceId,c=pointCenter(p.polygon);return <g className={'csm-province '+(chosen?'selected':'')} key={'province'+p.id} onClick={e=>{if(tool!=='inspect')return;e.stopPropagation();if(!ignoreClick.current)selectProvince(p);else ignoreClick.current=false}}><polygon points={vector(p.polygon)} fill={chosen?'#bb9658':'#23394d'} fillOpacity={chosen?.38:.09} stroke={chosen?'#ffda92':'#a5bac8'} strokeWidth={chosen?3:1.4} vectorEffect="non-scaling-stroke"/><text x={c.x} y={c.y} fontSize="9" fill="#eee4d1" stroke="#15232f" strokeWidth="2.5" paintOrder="stroke" textAnchor="middle" pointerEvents="none">{p.name}</text></g>})}
     {draft&&draft.length>0&&<g className="csm-draft" pointerEvents="none"><polyline points={vector(draft)} fill="none" stroke="#f1c77f" strokeWidth="2.8" vectorEffect="non-scaling-stroke"/>{draft.length>=3&&<polygon points={vector(draft)} fill="#dcb67b" fillOpacity=".16" stroke="#f0c789" strokeDasharray="6 5" vectorEffect="non-scaling-stroke"/>}</g>}
     {draft&&isReshaping&&draft.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={clamp(camera.w/100,4,10)} fill="#f9da9f" stroke="#273542" strokeWidth="2" className="csm-handle" onPointerDown={e=>{e.stopPropagation();if(e.altKey&&draft.length>3){setDraft(old=>old.filter((_,j)=>j!==i));return}vertexRef.current={index:i};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerUp={mouseUp} onClick={e=>e.stopPropagation()}/>)}
    </svg>
    {!artworkGround&&!showTerrain&&!continent.background_url&&!overlayImage&&<div className="csm-basemap-hint">Upload the supplied Ilsabard map under Reference layers, then trace territory borders over the artwork.</div>}
    <div className="csm-map-footer"><span>Wheel to zoom · Drag to pan in inspect mode · Hold mouse to trace</span><span>Cartography coordinates: 1000 × 700</span></div>
   </div>
   <aside className="csm-inspector"><div className="csm-aside-heading"><span className="csm-kicker">TERRITORY INDEX</span><strong>{zones.length} territories</strong></div>
    <div className="csm-zone-list">{zones.map(z=><button type="button" key={z.id} className={selected===String(z.id)?'active':''} onClick={()=>selectZone(z.id)}><span className={'csm-zone-indicator '+(polygons.has(Number(z.id))?'mapped':'')}/><span><strong>{z.is_default?(regions.find(r=>Number(r.id)===Number(z.region_id))?.name||z.name):z.name}</strong><small>{factionName(z.controlling_faction_id)} · {pretty(z.strategic_state)}</small></span></button>)}</div>
    {active?<div className="csm-details"><span className="csm-kicker">SELECTED TERRITORY</span><h4>{active.name}</h4><p>{activeRegion?.name||'Unknown region'} · {activeSites.length} settlements · {activePoly?'Border mapped':'Border not drawn'}</p><dl><div><dt>Controller</dt><dd>{factionName(active.controlling_faction_id)}</dd></div><div><dt>Government</dt><dd>{factionName(active.governing_faction_id)}</dd></div><div><dt>Status</dt><dd>{pretty(active.strategic_state)}</dd></div></dl>
      <button type="button" className="csm-primary" onClick={()=>onOpenZone?.(active)}>Open city builder / local map</button>
      <button type="button" onClick={()=>onOpenIndustry?.()}>Industrial Sites & Blueprints</button>
      <div className="csm-province-list"><strong>Provinces · {childProvinces.length}</strong>{childProvinces.map(p=><button className={provinceId===String(p.id)?'active':''} key={p.id} onClick={()=>selectProvince(p)}>{p.name} · {pretty(p.terrain)}</button>)}</div>
      {canEdit&&<div className="csm-editor"><strong>{province?'Province development':'New province'}</strong><label>Province name<input maxLength="140" value={provinceName} onChange={e=>setProvinceName(e.target.value)}/></label><label>Terrain<select value={terrain} onChange={e=>setTerrain(e.target.value)}>{['plains','forest','hills','mountains','urban','coast','marsh','desert','tundra'].map(v=><option value={v} key={v}>{pretty(v)}</option>)}</select></label>{province?<><button disabled={busy||!provinceName.trim()} onClick={()=>updateProvince()}>Save province</button><button onClick={()=>beginTrace('province-trace')}>Trace province (drag)</button><button onClick={drawProvince}>Point-by-point</button>{Array.isArray(province.polygon)&&<button onClick={reshapeProvince}>Move province corners</button>}<button onClick={()=>{setProvinceId('');setProvinceName('');setDraft(null);setTool('inspect')}}>New province</button></>:<button disabled={busy||!provinceName.trim()} onClick={createProvince}>Create province</button>}{province&&<div className="csm-infra-list">{[['roads','Roads'],['rail','Rail readiness'],['fortifications','Fortifications'],['power','Power grid']].map(([k,v])=><div key={k}><span>{v}</span><strong>{province[k]||0} / 5</strong></div>)}<small>NPC investment requires development points earned by existing industry. Industrial Sites blueprints and detailed city building stay available.</small></div>}</div>}
      {canEdit&&(!province||tool.startsWith('province-'))&&<div className="csm-editor"><strong>{province?'Province border':'State territory border'}</strong>{tool==='inspect'?<><button onClick={()=>beginTrace('trace')}>Trace state border (drag)</button><button onClick={startDraw}>Point-by-point</button>{activePoly&&<button onClick={startReshape}>Edit border vertices</button>}{activePoly&&<button disabled={busy} onClick={clear}>Clear outline</button>}</>:<><p>{isTracing?'Hold the mouse button and draw one outline; release to simplify.':isReshaping?'Drag gold corners; click an edge to add one; Alt-click to remove.':'Click corners in order, then save.'} {draft?.length||0} points</p><div className="csm-edit-actions">{['draw','province-draw'].includes(tool)&&<button disabled={!draft?.length} onClick={()=>setDraft(d=>d.slice(0,-1))}>Undo point</button>}{draft?.length>=3&&!isReshaping&&<button type="button" onClick={refineDraft}>Edit corners</button>}{isTracing&&<label className="csm-trace-sensitivity">Smoothing<select value={traceSensitivity} onChange={e=>setTraceSensitivity(Number(e.target.value))}><option value="0.8">Detailed</option><option value="2">Balanced</option><option value="4">Smooth</option></select></label>}<button disabled={busy||!draft||draft.length<3} className="csm-primary" onClick={save}>Save border</button><button onClick={()=>{setTool('inspect');setDraft(null)}}>Cancel</button></div></>}</div>}
    </div>:<div className="csm-details"><h4>Choose a territory</h4><p>Select a zone from the index to draw its border or open its existing local map. Existing simulation records are preserved.</p></div>}
   </aside>
  </div>
 </section>;
}
