import React,{useEffect,useState} from 'react';
import MapIconPicker from './MapIconPicker.jsx';
import {ICON_OPTIONS} from './WorldTerritoryMap.jsx';
import './settlement-editor.css';

const titles={
 overview:['Overview','Identity, location and condition','fa-house'],
 factions:['Faction control','Government, occupation and support','fa-flag'],
 map:['Map placement','Map position and marker','fa-map-location-dot'],
 civic:['Population & services','Civilian conditions and simulation','fa-users']
};
const groups=[
 ['Population & housing',['population','housing_capacity','workforce','housing']],
 ['Food & provisions',['food_days','food_variety','food_access']],
 ['Heating & environment',['heating_coverage','insulation','weather_exposure']],
 ['Health, safety & stability',['medical_access','security_score','civil_stability','unrest']]
];
const numbers={
 housing_capacity:['Housing places (base capacity)',10000000],
 population:['Residents',10000000],
 workforce:['Employed / available workers',10000000],
 food_days:['Food reserves (days)',99999],
 food_variety:['Food diversity',100],
 heating_coverage:['Heating coverage',100],
 insulation:['Insulation quality',100],
 housing:['Housing adequacy',100],
 medical_access:['Medical access',100],
 food_access:['Food access',100],
 security_score:['Public safety',100],
 civil_stability:['Civic stability',100],
 unrest:['Current unrest',100],
 weather_exposure:['Weather exposure',100]
};
const pretty=value=>String(value||'').replaceAll('_',' ').replace(/\b\w/g,s=>s.toUpperCase());
const pct=value=>Math.max(0,Math.min(100,Number(value)||0));
const fmt=value=>Number(value||0).toLocaleString();
const validCoord=value=>value!==''&&Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=100;
export default function SettlementEditor({editing,setEditing,onSave,onClose,busy=false,error='',regions=[],zones=[],factions=[],states=[],simulatedIds,previewOutlook,activeZoneId}){
 const [tab,setTab]=useState('overview');
 useEffect(()=>setTab('overview'),[editing.id]);
 useEffect(()=>{
  const prior=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const escape=event=>{if(event.key==='Escape'&&!busy)onClose()};
  document.addEventListener('keydown',escape);
  return ()=>{document.removeEventListener('keydown',escape);document.body.style.overflow=prior};
 },[busy,onClose]);
 const set=(key,value)=>setEditing(old=>({...old,[key]:value}));
 const simulated=Boolean(editing.id)&&(simulatedIds?.has(Number(editing.id))||Boolean(editing.controlling_faction_id&&editing.controlling_faction_id!=='eclipse-order'));
 const playerCity=Boolean(editing.id)&&editing.controlling_faction_id==='eclipse-order';
 const isNpc=Boolean(editing.controlling_faction_id&&editing.controlling_faction_id!=='eclipse-order');
 const coordOK=validCoord(editing.map_x)&&validCoord(editing.map_y);
 const marginOK=!isNpc||(Number(editing.map_x)>=3&&Number(editing.map_x)<=97&&Number(editing.map_y)>=3&&Number(editing.map_y)<=97);
 const nameOK=Boolean(editing.name?.trim());
 const zoneOK=Boolean(editing.zone_id||activeZoneId);
 const valid=nameOK&&zoneOK&&coordOK&&marginOK;
 const government=factions.find(f=>f.id===editing.governing_faction_id)?.name||'Unassigned';
 const owner=factions.find(f=>f.id===editing.controlling_faction_id)?.name||'Unclaimed';
 const activeRegion=regions.find(r=>Number(r.id)===Number(editing.region_id));
 const activeZone=zones.find(z=>Number(z.id)===Number(editing.zone_id||activeZoneId));
 const position={left:pct(editing.map_x)+'%',top:pct(editing.map_y)+'%'};
 const jumpToInvalid=()=>{if(!nameOK||!zoneOK)setTab('overview');else setTab('map')};
 const numberField=key=>{
  const [label,max]=numbers[key];
  return <label key={key} className="se-number-field"><span>{label}</span><input type="number" min="0" max={max} step={key==='food_days'?'.1':'1'} disabled={simulated||(playerCity&&['population','workforce','housing_capacity'].includes(key))} value={editing[key]??0} onChange={e=>set(key,e.target.value)}/>{max===100&&<span className="se-meter" aria-hidden="true"><i style={{width:pct(editing[key])+'%'}}/></span>}</label>;
 };
 return <div className="wa-overlay se-overlay" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)onClose()}}>
  <form className="se-window" aria-label={editing.id?'Edit settlement':'Create settlement'} role="dialog" aria-modal="true" onSubmit={onSave}>
   <header className="se-header">
    <div className="se-header-icon"><i className="fa-solid fa-city" aria-hidden="true"/></div>
    <div className="se-header-main"><span>WORLD ADMINISTRATION / SETTLEMENT DOSSIER</span><h2>{editing.id?'Manage settlement':'Establish settlement'}</h2><p>{editing.name?.trim()||'Unnamed settlement'} <span>·</span> {activeRegion?.name||'Region'} / {activeZone?.name||'Zone'}</p></div>
    <span className="se-header-condition">{pretty(editing.strategic_state||'peaceful')}</span>
    <button type="button" className="se-close" title="Close without saving" aria-label="Close settlement editor" disabled={busy} onClick={onClose}><i className="fa-solid fa-xmark" aria-hidden="true"/></button>
   </header>
   <div className="se-workspace">
    <nav className="se-navigation" aria-label="Settlement editing sections">
     <div className="se-nav-title">MANAGEMENT</div>
     {Object.entries(titles).map(([id,[label,description,icon]])=><button key={id} type="button" className={tab===id?'active':''} aria-current={tab===id?'step':undefined} onClick={()=>setTab(id)}><i className={'fa-solid '+icon} aria-hidden="true"/><span><strong>{label}</strong><small>{description}</small></span></button>)}
     <div className="se-nav-summary"><span>LOCATION STATUS</span><strong>{pretty(editing.strategic_state)}</strong><small>Controller: {owner}</small><small>Government: {government}</small><small>Residents: {fmt(editing.population)}</small></div>
    </nav>
    <main className="se-main">
     <div className="se-panel-title"><span>SETTLEMENT MANAGEMENT</span><h3>{titles[tab][0]}</h3><p>{titles[tab][1]}</p></div>
     {tab==='overview'&&<div className="se-panel">
      <div className="se-section-heading"><i className="fa-solid fa-book-open" aria-hidden="true"/><div><h4>Settlement identity</h4><p>Basic information and the location's current condition.</p></div></div>
      <div className="se-grid">
       <label className="se-wide">Settlement name <input required autoFocus maxLength={140} value={editing.name||''} onChange={e=>set('name',e.target.value)} placeholder="Name this location"/></label>
       <label>Region<select value={editing.region_id} onChange={e=>{const newRegion=Number(e.target.value);const zone=zones.find(z=>Number(z.region_id)===newRegion);setEditing(old=>({...old,region_id:newRegion,zone_id:zone?.id||null}))}}>{regions.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
       <label>Zone<select value={editing.zone_id||activeZoneId||''} onChange={e=>set('zone_id',Number(e.target.value))}><option value="">Select a zone</option>{zones.filter(z=>Number(z.region_id)===Number(editing.region_id)).map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</select></label>
       <label>Current condition<select value={editing.strategic_state||'peaceful'} onChange={e=>set('strategic_state',e.target.value)}>{states.map(state=><option key={state} value={state}>{pretty(state)}</option>)}</select></label>
       <label className="se-wide">Description<textarea rows={4} maxLength={3000} value={editing.description||''} onChange={e=>set('description',e.target.value)} placeholder="Lore, purpose, geography, or other relevant details"/></label>
      </div>
      <div className="se-help"><i className="fa-solid fa-circle-info" aria-hidden="true"/>Condition is separate from faction ownership. A destroyed or abandoned location may still have a controller.</div>
     </div>}
     {tab==='factions'&&<div className="se-panel">
      <div className="se-section-heading"><i className="fa-solid fa-chess-rook" aria-hidden="true"/><div><h4>Political authority</h4><p>Government, control, affiliation and support are distinct records.</p></div></div>
      <div className="se-faction-cards">
       {[['governing_faction_id','Government','Civil authority responsible for the settlement','fa-landmark'],['controlling_faction_id','Current controller','Faction currently occupying or operating the location','fa-shield-halved'],['supporting_faction_id','Supporting faction','Faction providing political support','fa-handshake'],['directory_faction_id','Faction directory','Related faction record for this location','fa-address-book']].map(([key,label,description,icon])=><label key={key} className="se-faction-card"><i className={'fa-solid '+icon} aria-hidden="true"/><span><strong>{label}</strong><small>{description}</small><select value={editing[key]||''} onChange={e=>set(key,e.target.value||null)}><option value="">Not assigned / Unclaimed</option>{factions.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></span></label>)}
      </div>
      <div className="se-help"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true"/>Changing settlement control directly is an administrative override. Normal NPC conquests and recovery claims should use Diplomatic Council approvals.</div>
     </div>}
     {tab==='map'&&<div className="se-panel">
      <div className="se-section-heading"><i className="fa-solid fa-map-location-dot" aria-hidden="true"/><div><h4>Location placement</h4><p>Choose the coordinates and marker shown on the local territory map.</p></div></div>
      <div className="se-map-layout"><div className="se-position-preview" aria-label="Map position preview"><div className="se-map-grid"/>{isNpc&&<div className="se-npc-bounds"/>}<span className="se-position-pin" style={position}><i className="fa-solid fa-location-dot" aria-hidden="true"/></span><span className="se-map-corner">0,0</span><span className="se-map-corner se-map-corner-end">100,100</span></div>
       <div className="se-coordinate-fields"><label>Map X (%)<input type="number" min="0" max="100" step=".1" value={editing.map_x} onChange={e=>set('map_x',e.target.value)}/></label><label>Map Y (%)<input type="number" min="0" max="100" step=".1" value={editing.map_y} onChange={e=>set('map_y',e.target.value)}/></label><small>X and Y determine marker position within the selected zone.</small></div>
      </div>
      <MapIconPicker options={ICON_OPTIONS} label="Map marker icon" value={editing.map_icon||'settlement'} onChange={v=>set('map_icon',v)}/>
      <div className={'se-help '+(!coordOK||!marginOK?'se-help-alert':'')}><i className="fa-solid fa-mountain" aria-hidden="true"/><span>Mountains are not buildable terrain. {isNpc?'NPC-controlled locations also require a 3% safety margin on every map edge (X and Y must be 3–97).':'The server checks mountain exclusion when the location is saved.'}{!coordOK?' Enter valid X and Y coordinates.':!marginOK?' Move this NPC location inside the 10% map margin.':''}</span></div>
     </div>}
     {tab==='civic'&&<div className="se-panel">
      <div className="se-section-heading"><i className="fa-solid fa-heart-pulse" aria-hidden="true"/><div><h4>Civilian conditions</h4><p>View or configure base settlement figures and service conditions.</p></div></div>
      {playerCity&&<div className="se-help"><i className="fa-solid fa-city" aria-hidden="true"/>Residents, available workers, and housing capacity are managed through the City Builder and completed construction. Civilian simulation remains off unless deliberately configured elsewhere.</div>}
      {simulated&&<div className="se-help"><i className="fa-solid fa-lock" aria-hidden="true"/>This location's resident counts and civic outcomes are simulation-managed. Fields are read-only here; improve services and resources through actual development.</div>}
      <div className="se-civic-groups">{groups.map(([label,fields])=><section className="se-civic-group" key={label}><h4>{label}</h4><div className="se-grid">{fields.map(numberField)}</div></section>)}</div>
      <label className="se-sim-option"><input type="checkbox" checked={Boolean(editing.simulation_enabled)} onChange={e=>set('simulation_enabled',e.target.checked)}/><span><strong>Enable civilian simulation eligibility</strong><small>Automatic cycles must be configured separately. This checkbox does not start simulation or run a cycle.</small></span></label>
      {previewOutlook&&<div className="se-projection"><strong>Projected civic outlook · read-only</strong><div>{[['Heating demand',previewOutlook.heat_demand+'%'],['Food pressure',previewOutlook.food_pressure],['Diet monotony',previewOutlook.diet_monotony],['Unrest risk',previewOutlook.unrest_risk+'/100']].map(([k,v])=><span key={k}><small>{k}</small><strong>{v}</strong></span>)}</div><small>Estimates only; saving this record does not apply simulation effects.</small></div>}
     </div>}
    </main>
   </div>
   <footer className="se-footer">
    <div className="se-save-status">{error?<span className="se-save-error"><i className="fa-solid fa-triangle-exclamation"/> {error}</span>:!valid?<button type="button" onClick={jumpToInvalid}><i className="fa-solid fa-circle-exclamation"/> {!nameOK?'Enter a settlement name':!zoneOK?'Select a zone':'Correct map placement'}</button>:<span><i className="fa-solid fa-circle-check"/> Changes are applied only when you save</span>}</div>
    <button type="button" className="se-cancel" disabled={busy} onClick={onClose}>Cancel</button>
    <button type="submit" className="se-save" disabled={busy||!valid}><i className="fa-solid fa-floppy-disk" aria-hidden="true"/>{busy?'Saving…':editing.id?'Save changes':'Create settlement'}</button>
   </footer>
  </form>
 </div>;
}
