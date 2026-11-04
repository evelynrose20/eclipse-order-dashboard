import React,{useState} from 'react';
import {setEncounterMap,moveEncounterToken} from './supabase.js';
import './battlemap.css';

function Token({combatant,canDirect,onSelect,selected}) {
 const hp=Math.max(0,Math.min(100,combatant.hp/Math.max(1,combatant.max_hp)*100));
 return <button type="button"
  draggable={Boolean(canDirect)}
  onDragStart={e=>{if(!canDirect){e.preventDefault();return}e.dataTransfer.setData('text/plain',combatant.id);e.dataTransfer.effectAllowed='move'}}
  onClick={e=>{e.stopPropagation();if(canDirect)onSelect(combatant.id)}}
  className={'map-token '+(combatant.kind==='npc'?'enemy':'ally')+(selected?' selected':'')}
  title={combatant.name+' · '+combatant.hp+'/'+combatant.max_hp+' HP · AC '+combatant.ac}
  aria-label={combatant.name+' '+combatant.hp+' of '+combatant.max_hp+' HP'}>
  <span className="token-symbol">{String(combatant.name||'?').slice(0,2).toUpperCase()}</span>
  <span className="token-health"><span style={{width:hp+'%'}}/></span>
  <span className="token-hp">{combatant.hp} HP</span>
 </button>;
}
export default function BattleMap({encounter,canDirect,onRefresh,onError}){
 const [selected,setSelected]=useState(null),[saving,setSaving]=useState(false),[mapStyle,setMapStyle]=useState(null);
 const cols=encounter.map_columns||16,rows=encounter.map_rows||10,style=encounter.map_style||'dungeon';
 const combatants=encounter.combatants||[];
 const onBoard=combatants.filter(c=>c.tile_x!=null&&c.tile_y!=null);
 const offBoard=combatants.filter(c=>c.tile_x==null||c.tile_y==null);
 const occupied=new Map(onBoard.map(c=>[c.tile_x+':'+c.tile_y,c]));
 async function drop(id,x,y){
  if(!canDirect||saving||!id)return;
  const c=combatants.find(x=>x.id===id);
  if(!c)return;
  if(x!=null&&occupied.has(x+':'+y)&&occupied.get(x+':'+y).id!==id){onError('That square is occupied.');return}
  setSaving(true);
  try{await moveEncounterToken(id,x,y);setSelected(null);await onRefresh();}
  catch(err){onError(err.message)}
  finally{setSaving(false)}
 }
 async function updateMap(nextStyle){
  setSaving(true);try{await setEncounterMap(encounter.id,cols,rows,nextStyle);setMapStyle(null);await onRefresh()}
  catch(err){onError(err.message)}finally{setSaving(false)}
 }
 const tiles=Array.from({length:cols*rows},(_,i)=>({x:i%cols,y:Math.floor(i/cols)}));
 return <section className="panel battlemap-panel">
  <div className="panel-heading wrap"><div><h2>Encounter battle map</h2><p>Move tokens around the tactical grid. Locations save only when a token is dropped or placed.</p></div>
   {canDirect&&<label className="field map-style-picker"><span>MAP TERRAIN</span><select disabled={saving} value={mapStyle||style} onChange={e=>updateMap(e.target.value)}><option value="dungeon">Dungeon stone</option><option value="forest">Woodland</option><option value="parchment">Parchment</option></select></label>}
  </div>
  <div className={'tactical-board terrain-'+style} style={{gridTemplateColumns:'repeat('+cols+',minmax(0,1fr))','--map-cols':cols}}>
   {tiles.map(({x,y})=>{
    const c=occupied.get(x+':'+y);
    return <div className={'battle-tile '+(selected&&!c?'target-tile':'')} key={x+':'+y}
      onDragOver={e=>{if(canDirect&&!c){e.preventDefault();e.dataTransfer.dropEffect='move'}}}
      onDrop={e=>{e.preventDefault();if(canDirect)drop(e.dataTransfer.getData('text/plain'),x,y)}}
      onClick={()=>{if(selected&&!c)drop(selected,x,y)}}
      aria-label={'Tile '+(x+1)+', '+(y+1)+(c?' occupied by '+c.name:'')}
      role={selected?'button':'presentation'} tabIndex={selected&&!c?0:undefined}
      onKeyDown={e=>{if(selected&&!c&&(e.key==='Enter'||e.key===' ')){e.preventDefault();drop(selected,x,y)}}}>
       {c&&<Token combatant={c} canDirect={canDirect} onSelect={setSelected} selected={selected===c.id}/>}
     </div>;
   })}
  </div>
  <div className="map-legend"><span className="map-legend-ally"/> Players <span className="map-legend-enemy"/> Monsters / NPCs <span className="map-legend-hint">{selected?'Select an empty tile to place the chosen token.':'Drag tokens to a tile, or select one and click its destination.'}</span></div>
  <div className="map-reserve"><div><h3>Off-map combatants <small>({offBoard.length})</small></h3><p className="muted">New characters appear here until placed on the map.</p></div>
   <div className="map-reserve-items">{offBoard.map(c=><button className={'map-reserve-token '+(selected===c.id?'selected':'')} disabled={!canDirect||saving} draggable={Boolean(canDirect)}
     onDragStart={e=>{e.dataTransfer.setData('text/plain',c.id);e.dataTransfer.effectAllowed='move'}}
     onClick={()=>setSelected(c.id)} key={c.id}>{c.kind==='npc'?'◆':'●'} {c.name} · {c.hp}/{c.max_hp} HP</button>)}
    {!offBoard.length&&<span className="muted">All combatants are on the map.</span>}
   </div>
   {selected&&canDirect&&<button className="mini-btn" disabled={saving} onClick={()=>drop(selected,null,null)}>Remove selected token from map</button>}
  </div>
  {saving&&<p className="muted" role="status">Saving token position…</p>}
 </section>;
}
