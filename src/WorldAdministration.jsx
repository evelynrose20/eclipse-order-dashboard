import React,{useEffect,useMemo,useState} from 'react';
import WorldTerritoryMap,{ICON_OPTIONS} from './WorldTerritoryMap.jsx';
import MapIconPicker from './MapIconPicker.jsx';
import './world-administration.css';

const regionBlank={name:'',description:'',climate:'Garlean highlands',weather:'clear',temperature_c:-5,temperature_f:23,weather_mode:'garlean_seasonal',simulation_mode:'off',map_background_url:''};
const cToF=c=>Math.round((Number(c)*9/5+32)*10)/10;
const fToC=f=>Math.round((Number(f)-32)*5/9*100)/100;
const settlementBlank=(regionId,zoneId)=>({region_id:regionId||0,zone_id:zoneId||null,name:'',description:'',directory_faction_id:null,governing_faction_id:null,controlling_faction_id:null,supporting_faction_id:null,map_x:50,map_y:50,map_icon:'settlement',strategic_state:'peaceful',population:0,workforce:0,food_days:0,food_variety:50,heating_coverage:50,insulation:50,housing:50,medical_access:50,food_access:50,security_score:50,civil_stability:70,unrest:0,weather_exposure:50,simulation_enabled:false});
const zoneBlank=regionId=>({region_id:Number(regionId),name:'',description:'',map_background_url:'',strategic_state:'peaceful',governing_faction_id:null,controlling_faction_id:null,supporting_faction_id:null});
const civicFields=[['population','Residents',10000000],['workforce','Employed / available workers',10000000],['food_days','Food reserves (days)',99999],['food_variety','Food diversity',100],['heating_coverage','Heating coverage',100],['insulation','Insulation quality',100],['housing','Housing adequacy',100],['medical_access','Medical access',100],['food_access','Food access',100],['security_score','Public safety',100],['civil_stability','Civic stability',100],['unrest','Current unrest',100],['weather_exposure','Weather exposure',100]];
const states=['peaceful','secure','contested','occupied','liberated','rebuilding','abandoned','destroyed'];
const pretty=x=>String(x||'').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase());
export default function WorldAdministration({request,readOnly=false}){
 const [data,setData]=useState(null),[section,setSection]=useState('map'),[region,setRegion]=useState(''),[zone,setZone]=useState(''),[selected,setSelected]=useState('');
 const [editing,setEditing]=useState(null),[editType,setEditType]=useState(''),[preview,setPreview]=useState(true);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const load=async()=>{const result=await request('/world-admin');setData(result);const currentRegion=result.regions.some(r=>String(r.id)===region)?region:String(result.regions[0]?.id||'');setRegion(currentRegion);setZone(old=>result.zones?.some(z=>String(z.id)===old&&String(z.region_id)===currentRegion)?old:String(result.zones?.find(z=>String(z.region_id)===currentRegion&&z.is_default)?.id||result.zones?.find(z=>String(z.region_id)===currentRegion)?.id||''));setSelected(old=>result.settlements.some(s=>String(s.id)===old)?old:String(result.settlements[0]?.id||''));return result};
 useEffect(()=>{load().catch(e=>setError(e.message||'Unable to open world records.'))},[]);
 const canEdit=!!data?.can_edit&&!readOnly;
 const regions=data?.regions||[],zones=data?.zones||[],settlements=data?.settlements||[],factions=data?.factions||[],routes=data?.routes||[],networkNodes=data?.network_nodes||[],networkSegments=data?.network_segments||[],mountains=data?.mountains||[];
 const activeRegion=regions.find(r=>String(r.id)===region);
 const activeZone=zones.find(z=>String(z.id)===zone&&String(z.region_id)===region)||zones.find(z=>String(z.region_id)===region&&z.is_default)||zones.find(z=>String(z.region_id)===region);
 const activeZoneId=String(activeZone?.id||'');
 const zoneList=zones.filter(z=>String(z.region_id)===region);
 const local=settlements.filter(s=>String(s.region_id)===region&&String(s.zone_id)===activeZoneId);
 const current=local.find(s=>String(s.id)===selected);
 const changeRegion=id=>{setRegion(id);const next=zones.find(z=>String(z.region_id)===id&&z.is_default)||zones.find(z=>String(z.region_id)===id);setZone(String(next?.id||''));setSelected('')};
 const changeZone=id=>{setZone(id);setSelected('');setEditing(null)};
 const factionName=id=>factions.find(f=>f.id===id)?.name||'Not assigned';
 const previewOutlook=useMemo(()=>{if(!editing||editType!=='settlement')return null;
  const climate=regions.find(r=>Number(r.id)===Number(editing.region_id))||activeRegion;
  const demand=Math.min(100,Math.round(Math.max(0,12-Number(climate?.effective_weather?.temperature_c??climate?.temperature_c??15))*7*(1+Math.max(0,100-Number(editing.insulation))/120)));
  const cold=Math.max(0,demand-Number(editing.heating_coverage));
  const food=Math.max(0,14-Number(editing.food_days))*4;
  const variety=Math.max(0,55-Number(editing.food_variety))*.5;
  const unmet=Math.min(100,Math.round(food+cold*.45+variety+(100-Number(editing.food_access))*.14+(100-Number(editing.medical_access))*.08));
  const risk=Math.max(0,Math.min(100,Math.round(unmet*.6+Number(editing.unrest)*.4)));
  return {heat_demand:demand,food_pressure:Math.round(food),diet_monotony:Math.round(variety),unrest_risk:risk};
 },[editing,editType,regions,region]);
 async function save(e){
  e.preventDefault();if(!canEdit)return;
  const endpoint=editType==='region'?'regions':editType==='zone'?'zones':'settlements';
  const body=editType==='settlement'?{...editing,region_id:Number(editing.region_id),zone_id:Number(editing.zone_id||activeZoneId),map_x:Number(editing.map_x),map_y:Number(editing.map_y),population:Number(editing.population),workforce:Number(editing.workforce),food_days:Number(editing.food_days),...Object.fromEntries(civicFields.filter(([k])=>!['population','workforce','food_days'].includes(k)).map(([k])=>[k,Number(editing[k])])),simulation_enabled:Boolean(editing.simulation_enabled)}:editType==='region'?{...editing,temperature_c:fToC(editing.temperature_f)}:{...editing,region_id:Number(editing.region_id)};
  setBusy(true);setError('');setNotice('');
  try{
   const response=await request('/world-admin/'+endpoint+(editing.id?'/'+editing.id:''),{method:editing.id?'PUT':'POST',body});
   await load();
   if(editType==='region'){const next=String(editing.id||response.id);setRegion(next);const parent=next===region?activeZone:null;setZone(String(parent?.id||response.zone_id||''));setSelected('')}
   if(editType==='zone'){setRegion(String(body.region_id));setZone(String(editing.id||response.id));setSelected('')}
   if(editType==='settlement'){setRegion(String(body.region_id));setZone(String(body.zone_id));setSelected(String(editing.id||response.id))}
   setEditing(null);setNotice('World record saved. No automatic simulation was run.');
  }catch(e){setError(e.message||'Save failed.')}finally{setBusy(false)}
 }
 async function deleteZone(){
  if(!canEdit||!activeZone||activeZone.is_default||busy)return;
  if(!window.confirm('Delete the empty zone "'+activeZone.name+'"? Zones containing settlements, roads, junctions or mountains cannot be deleted.'))return;
  setBusy(true);setError('');setNotice('');
  try{await request('/world-admin/zones/'+activeZone.id,{method:'DELETE'});changeZone(String(zoneList.find(z=>z.is_default)?.id||''));await load();setNotice('Empty zone deleted.')}
  catch(e){setError(e.message||'Unable to delete zone.')}finally{setBusy(false)}
 }
 const newSettlement=()=>{if(!region||!activeZone)return;setEditType('settlement');setEditing(settlementBlank(Number(region),Number(activeZone.id)))};
 const editSettlement=s=>{setEditType('settlement');setEditing({...s})};
 const editZone=z=>{if(!activeRegion)return;setEditType('zone');setEditing(z?{...z}:zoneBlank(activeRegion.id))};
 const editRegion=r=>{setEditType('region');setEditing(r?{...r,temperature_f:cToF(r.temperature_c),weather_mode:r.weather_mode||'garlean_seasonal'}:{...regionBlank})};
 return <section className="wa-root">
  <header className="wa-heading"><div><span>IMPERIAL ADMINISTRATION · NEW CASSIA & THE REALM</span><h2>World Administration</h2><p>Territories, civilian welfare, weather, heating, food variety and political relationships.</p></div>{canEdit&&<button className="wa-accent" onClick={()=>editRegion(null)}>+ New region</button>}</header>
  {error&&<p role="alert" className="wa-error">{error}</p>}{notice&&<p role="status" className="wa-notice">{notice}</p>}
  {!data?<p className="wa-empty">Opening world records…</p>:<>
   <nav className="wa-tabs" aria-label="World administration sections">
    {[['map','Territorial Map'],['settlements','Settlements'],['civil','Civilian Welfare'],['reference','Simulation Rules']].map(([id,name])=><button key={id} aria-current={section===id?'page':undefined} className={section===id?'active':''} onClick={()=>setSection(id)}>{name}</button>)}
   </nav>
   <div className="wa-controls"><label>Region <select value={region} onChange={e=>changeRegion(e.target.value)}><option value="">Choose region</option>{regions.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>{activeRegion&&<label>Zone <select aria-label="Territory zone" value={activeZoneId} onChange={e=>changeZone(e.target.value)}>{zoneList.map(z=><option key={z.id} value={z.id}>{z.name}{z.is_default?' · Overview':''}</option>)}</select></label>}
    {canEdit&&activeRegion&&<button onClick={()=>editRegion(activeRegion)}>Edit region / weather</button>}
    {canEdit&&activeRegion&&<button onClick={()=>editZone(null)}><i className="fa-solid fa-plus"/> New zone</button>}
    {canEdit&&activeZone&&<button onClick={()=>editZone(activeZone)}><i className="fa-solid fa-pen"/> Edit zone</button>}
    {canEdit&&activeZone&&!activeZone.is_default&&<button onClick={deleteZone}><i className="fa-solid fa-trash-can"/> Delete zone</button>}{canEdit&&activeRegion&&<button className="wa-accent" onClick={newSettlement}>+ Add settlement</button>}</div>
   {activeZone&&<div className="wa-zone-summary" aria-label="Selected zone territorial control">
    <strong><i className="fa-solid fa-map-location-dot" aria-hidden="true"/> {activeZone.name}</strong>
    <span>{pretty(activeZone.strategic_state)}</span>
    <span>Government: {factionName(activeZone.governing_faction_id)}</span>
    <span>Control: {factionName(activeZone.controlling_faction_id)}</span>
    <span>Support: {factionName(activeZone.supporting_faction_id)}</span>
   </div>}
   {!regions.length&&<div className="wa-empty"><h3>No regions yet</h3><p>Begin by creating New Cassia's first region, then place settlements on its territory map. Nothing has been automatically populated.</p>{canEdit&&<button className="wa-accent" onClick={()=>editRegion(null)}>Create first region</button>}</div>}
   {canEdit&&activeRegion&&section==='map'&&Number(data?.rail_api_revision||0)<3&&<div role="alert" className="wa-notice wa-api-version-warning">
    <strong>Windows railway API needs updating.</strong> This dashboard has the newer railway forms, but the connected Windows service is running an older API version. Pull the latest main branch, restart the Windows API service, then refresh the page. Creating platforms may still return invalid_rail_platform until both are updated.
   </div>}
   {activeRegion&&section==='map'&&<div className="wa-columns"><section className="wa-panel"><div className="wa-panel-title"><strong>ZONE TERRITORY MAP</strong><span>{activeRegion.name} / {activeZone?.name}</span></div><WorldTerritoryMap key={activeZoneId} zoneId={Number(activeZoneId)} region={{...activeRegion,name:activeRegion.name+' / '+(activeZone?.name||''),map_background_url:activeZone?.map_background_url||''}} settlements={local} routes={routes.filter(r=>r.route_type!=='rail'&&String(r.region_id)===region&&String(r.zone_id)===activeZoneId)} networkNodes={networkNodes.filter(n=>n.node_kind!=='rail_switch'&&String(n.region_id)===region&&String(n.zone_id)===activeZoneId)} networkSegments={networkSegments.filter(e=>e.route_type!=='rail'&&String(e.region_id)===region&&String(e.zone_id)===activeZoneId)} mountains={mountains.filter(m=>String(m.region_id)===region&&String(m.zone_id)===activeZoneId)} canEdit={canEdit} selected={selected} onSelect={setSelected} request={request} onSaved={load}/></section>
     <section className="wa-panel"><div className="wa-panel-title"><strong>SELECTED SETTLEMENT</strong><span>{local.length} locations</span></div>{current&&String(current.region_id)===region?<div className="wa-inspector"><h3>{current.name}</h3><p>{current.description||'No description yet.'}</p><div><span>Control</span><strong>{factionName(current.controlling_faction_id)}</strong></div><div><span>Government</span><strong>{factionName(current.governing_faction_id)}</strong></div><div><span>Supporting faction</span><strong>{factionName(current.supporting_faction_id)}</strong></div><div><span>Territorial state</span><strong>{pretty(current.strategic_state)}</strong></div><div><span>Residents</span><strong>{Number(current.population).toLocaleString()}</strong></div>{canEdit&&<button className="wa-accent" onClick={()=>editSettlement(current)}>Edit settlement</button>}</div>:<p className="wa-empty">Select a mapped settlement.</p>}</section></div>}
   {activeRegion&&section==='settlements'&&<section className="wa-panel"><div className="wa-panel-title"><strong>SETTLEMENT REGISTRY</strong><span>{local.length} locations</span></div><div className="wa-settlement-list">{local.map(s=><button key={s.id} onClick={()=>{setSelected(String(s.id));setSection('map')}}><strong>{s.name}</strong><span>{pretty(s.strategic_state)} · {factionName(s.governing_faction_id)}</span><small>{Number(s.population).toLocaleString()} residents</small></button>)}{!local.length&&<p className="wa-empty">No settlements in this region yet.</p>}</div></section>}
   {activeRegion&&section==='civil'&&<><div className="wa-weather"><div><span>REGIONAL WEATHER</span><strong>{pretty(activeRegion.effective_weather?.weather||activeRegion.weather)}</strong><small>{activeRegion.effective_weather?.season?pretty(activeRegion.effective_weather.season)+" · Seasonal Garlean climate":activeRegion.climate+" · DM manual"}</small></div><div><span>OUTDOOR TEMPERATURE</span><strong>{Number(activeRegion.effective_weather?.temperature_f??cToF(activeRegion.temperature_c)).toFixed(0)}°F</strong><small>Real-calendar fictional Garlean weather · {activeRegion.effective_weather?.date||"current"}</small></div><div><span>SIMULATION MODE</span><strong>{pretty(activeRegion.simulation_mode)}</strong><small>No automated ticks in this phase</small></div></div><div className="wa-civil-grid">{local.map(s=><article className="wa-panel wa-civil-card" key={s.id}><div className="wa-panel-title"><strong>{s.name}</strong><span>{s.simulation_enabled?'Armed for future simulation':'Simulation off'}</span></div><div className="wa-civic-values">{[['Food reserves',Number(s.food_days).toFixed(1)+' days'],['Food diversity',s.food_variety+' / 100'],['Heating coverage',s.heating_coverage+'%'],['Insulation',s.insulation+'%'],['Current unrest',s.unrest+'%'],['Unrest warning',pretty(s.outlook.warning)]].map(([k,v])=><div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div><p className="wa-hint">{s.outlook.warning==='elevated'?'Elevated needs pressure. DM review recommended; no automatic events.':s.outlook.warning==='watch'?'Monitor housing, food and heating.':'No urgent warning according to the current illustrative outlook.'}</p>{canEdit&&<button onClick={()=>editSettlement(s)}>Review civilian conditions</button>}</article>)}{!local.length&&<p className="wa-empty">Create settlements to begin tracking residents and civic needs.</p>}</div></>}
   {section==='reference'&&<section className="wa-panel wa-reference"><div className="wa-panel-title"><strong>CIVIC SIMULATION POLICY</strong><span>FOUNDATION 1</span></div><h3>Warnings, not punishment</h3><p>Food quantity and diet variety are separate. Repeating the same rations over long periods may cause dissatisfaction even when calories remain available. Cold weather raises heating demand; insulation and heating coverage offset exposure. Low services and existing unrest contribute to a projected unrest risk.</p><p>Garlean weather follows the real-world date and season while retaining a DM manual override. The climate is simulated, not observed weather at a real-world location. No automatic production, food consumption, riots, civilian harm or military action occurs in this release. Editing a region or settlement saves its state only. Future simulation phases must be enabled and tested deliberately.</p><p>Faction references come from <strong>Factions of the Realm</strong>. Government, military control and government support are independently assigned. Friendly relationships never automatically award land.</p><p>Further work is preserved in the GitHub document <code>docs/LIVING-WORLD-WAR-COMMAND-MASTER-PLAN.md</code>.</p></section>}
   {editing&&canEdit&&<div className="wa-overlay"><form className="wa-dialog" onSubmit={save} aria-label={editType==='region'?'Edit region':editType==='zone'?'Edit zone':'Edit settlement'}><div className="wa-dialog-head"><h3>{editing.id?'Edit':'Create'} {editType==='region'?'region':editType==='zone'?'zone':'settlement'}</h3><button type="button" onClick={()=>setEditing(null)} aria-label="Close editor">×</button></div><div className="wa-fields">
    <label>Name<input required maxLength={editType==='region'?120:140} value={editing.name||''} onChange={e=>setEditing({...editing,name:e.target.value})}/></label>
    <label className="wide">Description<textarea rows="3" value={editing.description||''} onChange={e=>setEditing({...editing,description:e.target.value})}/></label>
    {editType==='region'?<><label>Climate<input required maxLength={80} value={editing.climate} onChange={e=>setEditing({...editing,climate:e.target.value})}/></label><label>Manual weather<input required maxLength={80} disabled={editing.weather_mode==='garlean_seasonal'} value={editing.weather} onChange={e=>setEditing({...editing,weather:e.target.value})}/></label><label>Weather source<select value={editing.weather_mode||'garlean_seasonal'} onChange={e=>setEditing({...editing,weather_mode:e.target.value})}><option value="garlean_seasonal">Garlean seasons (real calendar)</option><option value="manual">Manual / event weather</option></select></label><label>Manual temperature °F<input required type="number" min="-148" max="212" step=".1" disabled={editing.weather_mode==='garlean_seasonal'} value={editing.temperature_f} onChange={e=>setEditing({...editing,temperature_f:e.target.value})}/></label><label>Simulation<select value={editing.simulation_mode} onChange={e=>setEditing({...editing,simulation_mode:e.target.value})}><option value="off">Off</option><option value="narrative">Narrative</option><option value="managed">Managed (future)</option></select></label></>:editType==='zone'?<>
     <label>Region<select value={editing.region_id} disabled><option value={editing.region_id}>{regions.find(r=>Number(r.id)===Number(editing.region_id))?.name||'Region'}</option></select></label>
     <label>Territorial state<select value={editing.strategic_state} onChange={e=>setEditing({...editing,strategic_state:e.target.value})}>{states.map(x=><option value={x} key={x}>{pretty(x)}</option>)}</select></label>
     {[['governing_faction_id','Government'],['controlling_faction_id','Control'],['supporting_faction_id','Supporting faction']].map(([key,title])=><label key={key}>{title}<select value={editing[key]||''} onChange={e=>setEditing({...editing,[key]:e.target.value||null})}><option value="">Not assigned</option>{factions.map(f=><option value={f.id} key={f.id}>{f.name}</option>)}</select></label>)}
     <label className="wide">HTTPS zone map background image URL<input type="url" maxLength={1500} value={editing.map_background_url||''} onChange={e=>setEditing({...editing,map_background_url:e.target.value})}/></label>
   </>:<>
     <label>Region<select value={editing.region_id} onChange={e=>setEditing({...editing,region_id:Number(e.target.value)})}>{regions.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
     <label>Zone<select value={editing.zone_id||activeZoneId} onChange={e=>setEditing({...editing,zone_id:Number(e.target.value)})}>{zones.filter(z=>Number(z.region_id)===Number(editing.region_id)).map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</select></label>
     <label>Territory state<select value={editing.strategic_state} onChange={e=>setEditing({...editing,strategic_state:e.target.value})}>{states.map(x=><option key={x} value={x}>{pretty(x)}</option>)}</select></label>
     {[['directory_faction_id','Faction directory record'],['governing_faction_id','Government'],['controlling_faction_id','Control'],['supporting_faction_id','Supporting faction']].map(([key,title])=><label key={key}>{title}<select value={editing[key]||''} onChange={e=>setEditing({...editing,[key]:e.target.value||null})}><option value="">Not assigned</option>{factions.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>)}
     <label>Map X (0–100%)<input type="number" min="0" max="100" step=".1" value={editing.map_x} onChange={e=>setEditing({...editing,map_x:e.target.value})}/></label>
     <label>Map Y (0–100%)<input type="number" min="0" max="100" step=".1" value={editing.map_y} onChange={e=>setEditing({...editing,map_y:e.target.value})}/></label><MapIconPicker options={ICON_OPTIONS} label="Map marker icon" value={editing.map_icon||'settlement'} onChange={v=>setEditing({...editing,map_icon:v})}/>
     {civicFields.map(([key,title,max])=><label key={key}>{title}<input type="number" min="0" max={max} step={key==='food_days'?'.1':'1'} value={editing[key]??0} onChange={e=>setEditing({...editing,[key]:e.target.value})}/></label>)}
     <label className="wide wa-checkbox"><input type="checkbox" checked={Boolean(editing.simulation_enabled)} onChange={e=>setEditing({...editing,simulation_enabled:e.target.checked})}/> Enable for future simulation (no automatic processing in foundation release)</label>
     {previewOutlook&&<div className="wide wa-projection"><strong>Projected civic outlook — read-only</strong><span>Heating demand {previewOutlook.heat_demand}% · Food pressure {previewOutlook.food_pressure} · Diet monotony {previewOutlook.diet_monotony} · Unrest risk {previewOutlook.unrest_risk}/100</span><small>Estimated only; no effects are applied.</small></div>}
    </>}
   </div><div className="wa-dialog-actions"><button type="button" onClick={()=>setEditing(null)}>Cancel</button><button className="wa-accent" disabled={busy} type="submit">{busy?'Saving…':'Save record'}</button></div></form></div>}
  </>}
 </section>;
}
