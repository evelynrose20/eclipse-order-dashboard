import React,{useEffect,useRef,useState} from 'react';
import {setEncounterMap,moveEncounterToken,setEncounterMapImage,saveEncounterWaymarks} from './apiBridge.js';
import './battlemap.css';

const MARK_IDS=['A','B','C','D','1','2','3','4'];
const clamp=v=>Math.max(0,Math.min(1,v));
const point=(event,board)=>{
 const bounds=board.getBoundingClientRect();
 return {x:Math.round(clamp((event.clientX-bounds.left)/bounds.width)*100000)/100000,
  y:Math.round(clamp((event.clientY-bounds.top)/bounds.height)*100000)/100000};
};
const tokenPoint=(c,cols,rows)=>{
 if(c.pos_x!==null&&c.pos_x!==undefined&&c.pos_y!==null&&c.pos_y!==undefined)return {x:Number(c.pos_x),y:Number(c.pos_y)};
 if(c.tile_x!==null&&c.tile_x!==undefined&&c.tile_y!==null&&c.tile_y!==undefined)return {x:(Number(c.tile_x)+.5)/cols,y:(Number(c.tile_y)+.5)/rows};
 return null;
};
const locationStyle=p=>({left:(p.x*100)+'%',top:(p.y*100)+'%'});

function Token({combatant,canDirect,selected,position,playerView=false}){
 const hp=Math.max(0,Math.min(100,combatant.hp/Math.max(1,combatant.max_hp)*100));
 return <button type="button" data-token={combatant.id} disabled={!canDirect}
  className={'map-token map-floating '+(combatant.kind==='npc'?'enemy':'ally')+(selected?' selected':'')}
  style={locationStyle(position)}
  title={playerView?combatant.name:combatant.name+' · '+combatant.hp+'/'+combatant.max_hp+' HP · AC '+combatant.ac}
  aria-label={playerView?combatant.name:combatant.name+' '+combatant.hp+' of '+combatant.max_hp+' HP'}>
  <span className="token-symbol">{String(combatant.name||'?').slice(0,2).toUpperCase()}</span>
  {!playerView&&<><span className="token-health"><span style={{width:hp+'%'}}/></span><span className="token-hp">{combatant.hp} HP</span></>}
 </button>;
}
export default function BattleMap({encounter,canDirect,onRefresh,onError,playerView=false}){
 const [selected,setSelected]=useState(null);
 const [placingMark,setPlacingMark]=useState(null);
 const [saving,setSaving]=useState(false);
 const [preview,setPreview]=useState(null);
 const [imageUrl,setImageUrl]=useState(encounter.map_image_url||'');
 const [zoom,setZoom]=useState(1);
 const [pan,setPan]=useState({x:0,y:0});
 const [tool,setTool]=useState(canDirect?'move':'pan');
 const [gridVisible,setGridVisible]=useState(true);
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [measurement,setMeasurement]=useState(null);
 const measureDrag=useRef(null);
 const panDrag=useRef(null);
 const drag=useRef(null),board=useRef(null);
 const cols=encounter.map_columns||16,rows=encounter.map_rows||10,style=encounter.map_style||'dungeon';
 const combatants=encounter.combatants||[];
 const marks=encounter.waymarks||{};
 useEffect(()=>{setSelected(null);setPlacingMark(null);setPreview(null);setImageUrl(encounter.map_image_url||'');setZoom(1);setPan({x:0,y:0});setTool(canDirect?'move':'pan');setMeasurement(null)},[encounter.id]);
 const setMapZoom=next=>setZoom(Math.max(.75,Math.min(2.5,Math.round(next*100)/100)));
 function beginPan(e){if(tool!=='pan'||e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);panDrag.current={id:e.pointerId,x:e.clientX,y:e.clientY,start:pan}}
 function movingPan(e){if(!panDrag.current||panDrag.current.id!==e.pointerId)return;const d=panDrag.current;setPan({x:d.start.x+e.clientX-d.x,y:d.start.y+e.clientY-d.y})}
 function endPan(e){if(panDrag.current?.id===e.pointerId)panDrag.current=null}
 function startMeasurement(e){if(tool!=='measure'||e.button!==0||!board.current)return;e.preventDefault();const p=point(e,board.current);measureDrag.current=e.pointerId;setMeasurement({start:p,end:p});e.currentTarget.setPointerCapture(e.pointerId)}
 function moveMeasurement(e){if(tool==='measure'&&measureDrag.current===e.pointerId&&board.current)setMeasurement(old=>old?{...old,end:point(e,board.current)}:null)}
 function endMeasurement(e){if(measureDrag.current===e.pointerId)measureDrag.current=null}
 const measureDistance=measurement?Math.round(Math.hypot((measurement.end.x-measurement.start.x)*cols,(measurement.end.y-measurement.start.y)*rows)*10)/10:null;
 function wheelZoom(e){if(e.ctrlKey||e.altKey){e.preventDefault();setMapZoom(zoom+(e.deltaY<0?.1:-.1))}}
 const onBoard=combatants.filter(c=>tokenPoint(c,cols,rows));
 const offBoard=combatants.filter(c=>!tokenPoint(c,cols,rows));
 async function placeToken(id,p){
  if(!canDirect||saving)return;
  setSaving(true);
  try{await moveEncounterToken(id,p?.x??null,p?.y??null);setSelected(null);await onRefresh()}
  catch(e){onError(e.message)}finally{setSaving(false);setPreview(null)}
 }
 async function saveMarks(next){
  if(!canDirect||saving)return;
  setSaving(true);
  try{await saveEncounterWaymarks(encounter.id,next);setPlacingMark(null);await onRefresh()}
  catch(e){onError(e.message)}finally{setSaving(false);setPreview(null)}
 }
 async function updateMap(nextStyle){
  setSaving(true);
  try{await setEncounterMap(encounter.id,cols,rows,nextStyle);await onRefresh()}
  catch(e){onError(e.message)}finally{setSaving(false)}
 }
 async function updateImage(e){
  e.preventDefault();setSaving(true);
  try{await setEncounterMapImage(encounter.id,imageUrl);await onRefresh()}
  catch(e){onError(e.message)}finally{setSaving(false)}
 }
 function pointerDown(e){
  if(tool==='pan'||!canDirect||saving||e.button!==0||!board.current)return;
  const token=e.target.closest('[data-token]')?.dataset.token;
  const mark=e.target.closest('[data-waymark]')?.dataset.waymark;
  if(!token&&!mark)return;
  e.preventDefault();
  board.current.setPointerCapture(e.pointerId);
  drag.current={pointerId:e.pointerId,token,mark,startX:e.clientX,startY:e.clientY,pos:point(e,board.current)};
  if(token){setSelected(token);setPlacingMark(null)}
  if(mark){setPlacingMark(mark);setSelected(null)}
 }
 function pointerMove(e){
  if(!drag.current||drag.current.pointerId!==e.pointerId||!board.current)return;
  setPreview({...point(e,board.current),token:drag.current.token,mark:drag.current.mark});
 }
 function pointerUp(e){
  if(tool==='pan'||!canDirect||saving||!board.current)return;
  const d=drag.current;
  if(d&&d.pointerId===e.pointerId){
   drag.current=null;
   const moved=Math.hypot(e.clientX-d.startX,e.clientY-d.startY)>4;
   if(moved){
    const p=point(e,board.current);
    if(d.token)void placeToken(d.token,p);
    else if(d.mark)void saveMarks({...marks,[d.mark]:p});
   }else setPreview(null);
   return;
  }
  if(e.target.closest('[data-token],[data-waymark]'))return;
  const p=point(e,board.current);
  if(placingMark)void saveMarks({...marks,[placingMark]:p});
  else if(selected)void placeToken(selected,p);
 }
 function keyDown(e){
  if(tool==='pan'||!canDirect||saving||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
  const chosen=combatants.find(c=>c.id===selected);
  const current=placingMark?marks[placingMark]:chosen&&tokenPoint(chosen,cols,rows);
  if(!current)return;
  e.preventDefault();
  const step=e.shiftKey?.05:.01;
  const p={x:clamp(Number(current.x)+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0)),
   y:clamp(Number(current.y)+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0))};
  if(placingMark)void saveMarks({...marks,[placingMark]:p});
  else if(chosen)void placeToken(chosen.id,p);
 }
 return <section className={"panel battlemap-panel"+(playerView?" battlemap-player":" battlemap-director")}>
  <div className="map-command-bar">
   <div className="map-tools-primary">
    {canDirect&&<button type="button" className={'map-tool '+(tool==='move'?'active':'')} aria-pressed={tool==='move'} onClick={()=>{setTool('move');setPlacingMark(null)}} title="Move tokens">✥ <span>Move</span></button>}
    <button type="button" className={'map-tool '+(tool==='pan'?'active':'')} aria-pressed={tool==='pan'} onClick={()=>{setTool('pan');setSelected(null);setPlacingMark(null)}} title="Pan the battlefield">✋ <span>Pan</span></button>
    <button type="button" className={'map-tool '+(tool==='measure'?'active':'')} aria-pressed={tool==='measure'} onClick={()=>{setTool('measure');setSelected(null);setPlacingMark(null)}} title="Measure distance">⌁ <span>Ruler</span></button>
    <button type="button" className={'map-tool '+(gridVisible?'active':'')} aria-pressed={gridVisible} onClick={()=>setGridVisible(v=>!v)} title="Show or hide grid">▦ <span>Grid</span></button>
    {canDirect&&<button type="button" className={'map-tool '+(settingsOpen?'active':'')} aria-expanded={settingsOpen} onClick={()=>setSettingsOpen(v=>!v)} title="Map settings and waymarks">⚙ <span>Settings</span></button>}
   </div>
   <div className="map-zoom-tools" aria-label="Map zoom">
    <button type="button" aria-label="Zoom out" disabled={zoom<=.75} onClick={()=>setMapZoom(zoom-.25)}>−</button>
    <output aria-label="Zoom level">{Math.round(zoom*100)}%</output>
    <button type="button" aria-label="Zoom in" disabled={zoom>=2.5} onClick={()=>setMapZoom(zoom+.25)}>+</button>
    <button type="button" aria-label="Reset map view" onClick={()=>{setZoom(1);setPan({x:0,y:0})}}>Reset</button>
   </div>
  </div>
  {canDirect&&settingsOpen&&<div className="map-settings-panel">
    <div className="map-settings-header"><strong>Map settings</strong><label className="field map-style-picker"><span>TERRAIN</span><select disabled={saving} value={style} onChange={e=>updateMap(e.target.value)}><option value="dungeon">Dungeon stone</option><option value="forest">Woodland</option><option value="parchment">Parchment</option></select></label></div>
    <form className="map-image-form" onSubmit={updateImage}><label className="field"><span>BATTLE MAP IMAGE URL</span><input type="url" value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="https://example.com/map.webp"/></label><button className="mini-btn" type="submit" disabled={saving}>Apply image</button></form>
    <div className="waymark-tools"><div><strong>Waymarks</strong><p className="muted">Choose a marker then place it on the map.</p></div><div className="waymark-picker">{MARK_IDS.map(id=><button type="button" key={id} disabled={saving} className={'waymark-choice mark-'+id+(placingMark===id?' active':'')} aria-pressed={placingMark===id} onClick={()=>{setTool('move');setSelected(null);setPlacingMark(placingMark===id?null:id)}}>{id}</button>)}</div>
     <div className="waymark-actions"><button className="mini-btn" disabled={!placingMark||!marks[placingMark]||saving} onClick={()=>{const next={...marks};delete next[placingMark];saveMarks(next)}}>Remove waymark</button><button className="mini-btn" disabled={!Object.keys(marks).length||saving} onClick={()=>{if(window.confirm('Clear all waymarks?'))saveMarks({})}}>Clear all</button></div>
    </div>
  </div>}
  <div className={'map-viewport '+(tool==='pan'?'panning':'')} onPointerDown={beginPan} onPointerMove={movingPan} onPointerUp={endPan} onPointerCancel={endPan} onWheel={wheelZoom} role="group" aria-label="Battlefield viewport">
  <div ref={board} className={'tactical-board terrain-'+style} role="group" aria-label="Free movement battle map"
   tabIndex={canDirect?0:undefined} onPointerDown={e=>{if(tool==='measure')startMeasurement(e);else pointerDown(e)}} onPointerMove={e=>{if(tool==='measure')moveMeasurement(e);else pointerMove(e)}} onPointerUp={e=>{if(tool==='measure')endMeasurement(e);else pointerUp(e)}} onPointerCancel={e=>{drag.current=null;measureDrag.current=null;setPreview(null)}} onKeyDown={keyDown}
   style={{aspectRatio:cols+'/'+rows,transform:'translate('+pan.x+'px,'+pan.y+'px) scale('+zoom+')','--map-cols':cols,'--map-rows':rows,...(encounter.map_image_url?{backgroundImage:'url('+JSON.stringify(encounter.map_image_url)+')',backgroundSize:'cover',backgroundPosition:'center'}:{})}}>
   {gridVisible&&<div className="map-grid-overlay" aria-hidden="true" style={{backgroundSize:(100/cols)+'% '+(100/rows)+'%'}}/>}
   {measurement&&<svg className="map-measurement" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1={measurement.start.x*100} y1={measurement.start.y*100} x2={measurement.end.x*100} y2={measurement.end.y*100} stroke="#f4dc99" strokeWidth=".5" strokeDasharray="1.5 1"/><circle cx={measurement.start.x*100} cy={measurement.start.y*100} r=".85" fill="#f4dc99"/><circle cx={measurement.end.x*100} cy={measurement.end.y*100} r=".85" fill="#f4dc99"/></svg>}
   {MARK_IDS.filter(id=>marks[id]).map(id=><button key={id} type="button" data-waymark={id} className={'waymark-onboard mark-'+id+(placingMark===id?' active':'')}
      disabled={!canDirect} style={locationStyle(preview?.mark===id?preview:marks[id])} title={'Waymark '+id}>{id}</button>)}
   {onBoard.map(c=><Token key={c.id} combatant={c} playerView={playerView} canDirect={canDirect} selected={selected===c.id}
     position={preview?.token===c.id?preview:tokenPoint(c,cols,rows)}/>)}
  </div>
  </div>
  {!playerView&&<div className="map-legend"><span className="map-legend-ally"/> Players <span className="map-legend-enemy"/> Monsters / NPCs <span className="map-legend-hint">{placingMark?'Tap a location to place waymark '+placingMark+'.':selected?'Tap a location to move the selected combatant.':'Select a combatant or drag a token. Use arrow keys to nudge a selection.'}</span></div>}
  {canDirect&&!playerView&&<div className="map-reserve"><div><h3>Off-map combatants <small>({offBoard.length})</small></h3><p className="muted">Choose one below, then tap anywhere on the map to place it.</p></div>
   <div className="map-reserve-items">{offBoard.map(c=><button key={c.id} className={'map-reserve-token '+(selected===c.id?'selected':'')} disabled={!canDirect||saving}
    onClick={()=>{setTool('move');setSelected(c.id);setPlacingMark(null)}}>{c.kind==='npc'?'◆':'●'} {c.name} · {c.hp}/{c.max_hp} HP</button>)}
    {!offBoard.length&&<span className="muted">All combatants are on the map.</span>}
   </div>
   {selected&&canDirect&&<button className="mini-btn" disabled={saving} onClick={()=>placeToken(selected,null)}>Remove selected token from map</button>}
  </div>}
  {measurement&&<div className="map-measure-label" role="status">Distance: {measureDistance} grid squares <button type="button" className="mini-btn" onClick={()=>setMeasurement(null)}>Clear</button></div>}
  {playerView&&<div className="map-player-key"><span><i className="map-legend-ally"/> Allies</span><span><i className="map-legend-enemy"/> Enemies / NPCs</span></div>}

  {saving&&<p className="muted" role="status">Saving map changes…</p>}
 </section>;
}
