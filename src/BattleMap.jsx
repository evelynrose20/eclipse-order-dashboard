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
 const drag=useRef(null),board=useRef(null);
 const cols=encounter.map_columns||16,rows=encounter.map_rows||10,style=encounter.map_style||'dungeon';
 const combatants=encounter.combatants||[];
 const marks=encounter.waymarks||{};
 useEffect(()=>{setSelected(null);setPlacingMark(null);setPreview(null);setImageUrl(encounter.map_image_url||'')},[encounter.id]);
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
  if(!canDirect||saving||e.button!==0||!board.current)return;
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
  if(!canDirect||saving||!board.current)return;
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
  if(!canDirect||saving||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
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
  {!playerView&&<div className="panel-heading wrap"><div><h2>Battlefield</h2><p>Drag tokens to position them. Select a token to move it precisely with the arrow keys.</p></div>
   {canDirect&&<label className="field map-style-picker"><span>MAP TERRAIN</span><select disabled={saving} value={style} onChange={e=>updateMap(e.target.value)}><option value="dungeon">Dungeon stone</option><option value="forest">Woodland</option><option value="parchment">Parchment</option></select></label>}
  </div>}
  {canDirect&&!playerView&&<form className="map-image-form" onSubmit={updateImage}><label className="field"><span>OPTIONAL BATTLEMAP IMAGE URL</span><input type="url" value={imageUrl} placeholder="https://example.com/my-battlemap.webp" onChange={e=>setImageUrl(e.target.value)}/></label><button className="mini-btn" type="submit" disabled={saving}>Apply image</button><span className="muted">Use a trusted HTTPS image link.</span></form>}
  {!playerView&&<div className="waymark-tools"><div><strong>FFXIV waymarks</strong><p className="muted">Choose a marker, then click or tap its location. Drag an existing marker to reposition it.</p></div><div className="waymark-picker">{MARK_IDS.map(id=><button type="button" key={id} disabled={!canDirect||saving} className={'waymark-choice mark-'+id+(placingMark===id?' active':'')} aria-pressed={placingMark===id} onClick={()=>{setSelected(null);setPlacingMark(placingMark===id?null:id)}}>{id}</button>)}</div>
   {canDirect&&<div className="waymark-actions"><button className="mini-btn" type="button" disabled={!placingMark||!marks[placingMark]||saving} onClick={()=>{const next={...marks};delete next[placingMark];saveMarks(next)}}>Remove selected waymark</button><button className="mini-btn" type="button" disabled={!Object.keys(marks).length||saving} onClick={()=>{if(window.confirm('Clear all eight waymarks from this event?'))saveMarks({})}}>Clear waymarks</button></div>}
  </div>}
  <div ref={board} className={'tactical-board terrain-'+style} role="group" aria-label="Free movement battle map"
   tabIndex={canDirect?0:undefined} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={()=>{drag.current=null;setPreview(null)}} onKeyDown={keyDown}
   style={{aspectRatio:cols+'/'+rows,'--map-cols':cols,'--map-rows':rows,...(encounter.map_image_url?{backgroundImage:'url('+JSON.stringify(encounter.map_image_url)+')',backgroundSize:'cover',backgroundPosition:'center'}:{})}}>
   <div className="map-grid-overlay" aria-hidden="true" style={{backgroundSize:(100/cols)+'% '+(100/rows)+'%'}}/>
   {MARK_IDS.filter(id=>marks[id]).map(id=><button key={id} type="button" data-waymark={id} className={'waymark-onboard mark-'+id+(placingMark===id?' active':'')}
      disabled={!canDirect} style={locationStyle(preview?.mark===id?preview:marks[id])} title={'Waymark '+id}>{id}</button>)}
   {onBoard.map(c=><Token key={c.id} combatant={c} playerView={playerView} canDirect={canDirect} selected={selected===c.id}
     position={preview?.token===c.id?preview:tokenPoint(c,cols,rows)}/>)}
  </div>
  {!playerView&&<div className="map-legend"><span className="map-legend-ally"/> Players <span className="map-legend-enemy"/> Monsters / NPCs <span className="map-legend-hint">{placingMark?'Tap a location to place waymark '+placingMark+'.':selected?'Tap a location to move the selected combatant.':'Select a combatant or drag a token. Use arrow keys to nudge a selection.'}</span></div>}
  {canDirect&&!playerView&&<div className="map-reserve"><div><h3>Off-map combatants <small>({offBoard.length})</small></h3><p className="muted">Choose one below, then tap anywhere on the map to place it.</p></div>
   <div className="map-reserve-items">{offBoard.map(c=><button key={c.id} className={'map-reserve-token '+(selected===c.id?'selected':'')} disabled={!canDirect||saving}
    onClick={()=>{setSelected(c.id);setPlacingMark(null)}}>{c.kind==='npc'?'◆':'●'} {c.name} · {c.hp}/{c.max_hp} HP</button>)}
    {!offBoard.length&&<span className="muted">All combatants are on the map.</span>}
   </div>
   {selected&&canDirect&&<button className="mini-btn" disabled={saving} onClick={()=>placeToken(selected,null)}>Remove selected token from map</button>}
  </div>}
  {playerView&&<div className="map-player-key"><span><i className="map-legend-ally"/> Allies</span><span><i className="map-legend-enemy"/> Enemies / NPCs</span></div>}

  {saving&&<p className="muted" role="status">Saving map changes…</p>}
 </section>;
}
