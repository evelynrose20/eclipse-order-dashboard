import React,{useEffect,useMemo,useState} from 'react';
import WorldTerritoryMap,{ICON_OPTIONS} from './WorldTerritoryMap.jsx';
import MapIconPicker from './MapIconPicker.jsx';
import CivicNeedsPanel from './CivicNeedsPanel.jsx';
import RegionClimatePanel from './RegionClimatePanel.jsx';
import NpcSettlementsPanel from './NpcSettlementsPanel.jsx';
import IndustrySitesPanel from './IndustrySitesPanel.jsx';
import './world-administration.css';

const regionBlank={name:'',description:'',climate:'Garlean highlands',weather:'clear',temperature_c:-5,temperature_f:23,weather_mode:'garlean_seasonal',simulation_mode:'off',map_background_url:''};
const cToF=c=>Math.round((Number(c)*9/5+32)*10)/10;
const fToC=f=>Math.round((Number(f)-32)*5/9*100)/100;
const settlementBlank=(regionId,zoneId)=>({region_id:regionId||0,zone_id:zoneId||null,name:'',description:'',directory_faction_id:null,governing_faction_id:null,controlling_faction_id:null,supporting_faction_id:null,map_x:50,map_y:50,map_icon:'settlement',strategic_state:'peaceful',population:0,housing_capacity:0,workforce:0,food_days:0,food_variety:50,heating_coverage:50,insulation:50,housing:50,medical_access:50,food_access:50,security_score:50,civil_stability:70,unrest:0,weather_exposure:50,simulation_enabled:false});
const zoneBlank=regionId=>({region_id:Number(regionId),name:'',description:'',map_background_url:'',strategic_state:'peaceful',governing_faction_id:null,controlling_faction_id:null,supporting_faction_id:null});
const civicFields=[['housing_capacity','Housing places (base capacity)',10000000],['population','Residents',10000000],['workforce','Employed / available workers',10000000],['food_days','Food reserves (days)',99999],['food_variety','Food diversity',100],['heating_coverage','Heating coverage',100],['insulation','Insulation quality',100],['housing','Housing adequacy',100],['medical_access','Medical access',100],['food_access','Food access',100],['security_score','Public safety',100],['civil_stability','Civic stability',100],['unrest','Current unrest',100],['weather_exposure','Weather exposure',100]];
const states=['peaceful','secure','contested','occupied','liberated','rebuilding','abandoned','destroyed'];
const pretty=x=>String(x||'').replaceAll('_',' ').replace(/\\b\\w/g,m=>m.toUpperCase());
const civicStatus=(s,r)=>{const c=s?.civic_summary;if(!c)return 'Not configured';if(c.paused)return 'Paused';if(!c.enabled||c.mode==='off')return 'Off';if(c.mode==='narrative')return 'Narrative · warnings only';return (c.mode==='managed'?'Managed':'Detailed')+' · staff-run cycles';};
const civicValue=(value,suffix='')=>value===null||value===undefined?'—':Number(value).toLocaleString(undefined,{maximumFractionDigits:1})+suffix;
class WorldPanelBoundary extends React.Component{
 constructor(props){super(props);this.state={failed:false}}
 static getDerivedStateFromError(){return {failed:true}}
 componentDidCatch(error,info){console.error('[World Administration] Panel error:',error,info.componentStack)}
 render(){if(this.state.failed)return <section className="wa-panel wa-panel-recovery" role="alert"><h3>Unable to display this workspace</h3><p>The panel encountered a rendering error. Your settlement and industry records have not been changed. Reload this panel to try again.</p><button type="button" onClick={()=>this.setState({failed:false})}>Retry panel</button></section>;return this.props.children}
}
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
 const local=settlements.filter(s=>String(s.region_id)===region&&String(s.zone_id)===activeZoneId&&(!canEdit||section==='map'||(section==='unclaimed'?!s.controlling_faction_id:s.controlling_faction_id==='eclipse-order')));
 const npcCount=settlements.filter(s=>s.controlling_faction_id&&s.controlling_faction_id!=='eclipse-order').length;
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
  const body=editType==='settlement'?{...editing,region_id:Number(editing.region_id),zone_id:Number(editing.zone_id||activeZoneId),map_x:Number(editing.map_x),map_y:Number(editing.map_y),population:Number(editing.population),housing_capacity:Number(editing.housing_capacity??0),workforce:Number(editing.workforce),food_days:Number(editing.food_days),...Object.fromEntries(civicFields.filter(([k])=>!['population','workforce','food_days'].includes(k)).map(([k])=>[k,Number(editing[k])])),simulation_enabled:Boolean(editing.simulation_enabled)}:editType==='region'?{...editing,temperature_c:fToC(editing.temperature_f)}:{...editing,region_id:Number(editing.region_id)};
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
 const newSettlement=()=>{if(!region||!activeZone)return;setEditType('settlement');setEditing({...settlementBlank(Number(region),Number(activeZone.id)),controlling_faction_id:['settlements','civil'].includes(section)?'eclipse-order':null})};
 const editSettlement=s=>{setEditType('settlement');setEditing({...s})};
 const editZone=z=>{if(!activeRegion)return;setEditType('zone');setEditing(z?{...z}:zoneBlank(activeRegion.id))};
 const editRegion=r=>{setEditType('region');setEditing(r?{...r,temperature_f:cToF(r.temperature_c),weather_mode:r.weather_mode||'garlean_seasonal'}:{...regionBlank})};
 return <section className="wa-root">
  <header className="wa-heading"><div><span>IMPERIAL ADMINISTRATION · NEW CASSIA & THE REALM</span><h2>World Administration</h2><p>Territories, NPC communities, civilian welfare, industrial sites and construction projects.</p></div></header>
  {error&&<p role="alert" className="wa-error">{error}</p>}{notice&&<p role="status" className="wa-notice">{notice}</p>}
  {!data?<p className="wa-empty">Opening world records…</p>:<>
   <nav className="wa-tabs" aria-label="World administration sections">
    {(canEdit?[['map','Territorial Map'],['settlements','Order Settlements'],['npc','NPC Settlements'],['unclaimed','Unclaimed'],['industry','Industry & Projects'],['civil','Civilian Welfare'],['reference','Simulation Rules']]:[['map','Territorial Map'],['settlements','Settlements'],['civil','Civilian Welfare']]).map(([id,name])=><button key={id} aria-current={section===id?'page':undefined} className={section===id?'active':''} onClick={()=>setSection(id)}>{name}</button>)}
   </nav>
   {section!=='npc'&&section!=='industry'&&<div className="wa-geography-picker" aria-label="Territorial geography">
    <div className="wa-geography-line">
     <span className="wa-geography-label">Region</span>
     <div className="wa-geography-tabs" role="group" aria-label="Select region">
      {regions.map(r=><button type="button" key={r.id} className={String(r.id)===region?'active':''} aria-pressed={String(r.id)===region} onClick={()=>changeRegion(String(r.id))}>{r.name}</button>)}
      {canEdit&&<button type="button" className="wa-geography-add" onClick={()=>editRegion(null)}><i className="fa-solid fa-plus" aria-hidden="true"/> New region</button>}
     </div>
     {canEdit&&activeRegion&&<button type="button" className="wa-geography-tool" onClick={()=>editRegion(activeRegion)} title="Edit selected region and its weather"><i className="fa-solid fa-pen" aria-hidden="true"/> Edit region / weather</button>}
    </div>
    {activeRegion&&<div className="wa-geography-line">
     <span className="wa-geography-label">Zone</span>
     <div className="wa-geography-tabs" role="group" aria-label="Select zone">
      {zoneList.map(z=><button type="button" key={z.id} className={String(z.id)===activeZoneId?'active':''} aria-pressed={String(z.id)===activeZoneId} title={z.is_default?z.name:z.description||z.name} onClick={()=>changeZone(String(z.id))}>{z.is_default?(activeRegion.name.replace(/^New\s+/i,'')||z.name):z.name}</button>)}
      {canEdit&&<button type="button" className="wa-geography-add" onClick={()=>editZone(null)}><i className="fa-solid fa-plus" aria-hidden="true"/> New zone</button>}
     </div>
     {canEdit&&activeZone&&<button type="button" className="wa-geography-tool" onClick={()=>editZone(activeZone)}><i className="fa-solid fa-pen" aria-hidden="true"/> Edit zone</button>}
     {canEdit&&activeZone&&!activeZone.is_default&&<button type="button" className="wa-geography-tool wa-geography-delete" onClick={deleteZone} disabled={busy}><i className="fa-solid fa-trash-can" aria-hidden="true"/> Delete zone</button>}
     {canEdit&&activeRegion&&<button type="button" className="wa-accent wa-geography-create" onClick={newSettlement}><i className="fa-solid fa-plus" aria-hidden="true"/> Add settlement</button>}
    </div>}
   </div>}
   {section!=='npc'&&section!=='industry'&&activeZone&&<div className="wa-zone-summary" aria-label="Selected zone territorial control">
    <strong><i className="fa-solid fa-map-location-dot" aria-hidden="true"/> {activeZone.name}</strong>
    <span>{pretty(activeZone.strategic_state)}</span>
    <span>Government: {factionName(activeZone.governing_faction_id)}</span>
    <span>Control: {factionName(activeZone.controlling_faction_id)}</span>
    <span>Support: {factionName(activeZone.supporting_faction_id)}</span>
   </div>}
   {!regions.length&&<div className="wa-empty"><h3>No regions yet</h3><p>Begin by creating New Cassia's first region, then place settlements on its territory map. Nothing has been automatically populated.</p>{canEdit&&<button className="wa-accent" onClick={()=>editRegion(null)}>Create first region</button>}</div>}

   {canEdit&&section==='npc'&&<NpcSettlementsPanel request={request} factions={factions} onChanged={load}/>}
   {canEdit&&section==='industry'&&<WorldPanelBoundary><IndustrySitesPanel request={request} onChanged={load}/></WorldPanelBoundary>}
   {activeRegion&&section==='map'&&<div className="wa-map-workspace"><section className="wa-panel wa-map-main-panel"><div className="wa-panel-title"><strong>ZONE TERRITORY MAP</strong><span>{activeRegion.name} / {activeZone?.name}</span></div><WorldTerritoryMap key={activeZoneId} zoneId={Number(activeZoneId)} region={{...activeRegion,name:activeRegion.name+' / '+(activeZone?.name||''),map_background_url:activeZone?.map_background_url||''}} settlements={local} routes={routes.filter(r=>String(r.region_id)===region&&String(r.zone_id)===activeZoneId)} networkNodes={networkNodes.filter(n=>String(n.region_id)===region&&String(n.zone_id)===activeZoneId)} networkSegments={networkSegments.filter(e=>String(e.region_id)===region&&String(e.zone_id)===activeZoneId)} mountains={mountains.filter(m=>String(m.region_id)===region&&String(m.zone_id)===activeZoneId)} canEdit={canEdit} selected={selected} onSelect={setSelected} request={request} onSaved={load}/></section>
     <section className="wa-panel wa-map-selection-panel"><div className="wa-panel-title"><strong>SELECTED SETTLEMENT</strong><span>{local.length} locations</span></div>{current&&String(current.region_id)===region?<div className="wa-inspector"><h3>{current.name}</h3><p>{current.description||'No description yet.'}</p><div><span>Control</span><strong>{factionName(current.controlling_faction_id)}</strong></div><div><span>Government</span><strong>{factionName(current.governing_faction_id)}</strong></div><div><span>Supporting faction</span><strong>{factionName(current.supporting_faction_id)}</strong></div><div><span>Territorial state</span><strong>{pretty(current.strategic_state)}</strong></div><div><span>Residents</span><strong>{Number(current.population).toLocaleString()}</strong></div><section className="wa-inspector-civic"><h4>Civilian welfare</h4>
   {canEdit&&<div><span>Simulation</span><strong>{civicStatus(current,activeRegion)}</strong></div>}
   <div><span>Housing</span><strong>{civicValue(current.civic_summary?.housing_capacity)} places</strong></div><div><span>Defenses</span><strong>+{civicValue(current.civic_summary?.upgrade_effects?.defense_bonus)} protection</strong></div><div><span>Food reserves</span><strong>{current.civic_summary?.has_stock?civicValue(current.civic_summary.food_days,' days'):'No supplies recorded'}</strong></div>
   <div><span>Heating coverage</span><strong>{civicValue(current.civic_summary?.heating_coverage,'%')}</strong></div>
   <div><span>Water stock</span><strong>{civicValue(current.civic_summary?.water_stock)}</strong></div>
   <div><span>Medical supplies</span><strong>{civicValue(current.civic_summary?.medicine_stock)}</strong></div>
   <div><span>Unrest risk</span><strong>{civicValue(current.civic_summary?.unrest_risk,' / 100')}</strong></div>
   {current.civic_summary?.warnings?.length>0&&<p className="wa-civic-alerts">{current.civic_summary.warnings.slice(0,3).map(pretty).join(' · ')}</p>}
   <button className="wa-accent" onClick={()=>{setSection('civil');setSelected(String(current.id))}}>Open civilian welfare</button>
  </section>{canEdit&&<button className="wa-accent" onClick={()=>editSettlement(current)}>Edit settlement</button>}</div>:<p className="wa-empty">Select a mapped settlement.</p>}</section></div>}
   {activeRegion&&(section==='settlements'||section==='unclaimed')&&<section className="wa-panel"><div className="wa-panel-title"><strong>{section==='unclaimed'?'UNCLAIMED SETTLEMENTS':'ORDER SETTLEMENTS'}</strong><span>{local.length} locations</span></div><div className="wa-settlement-list">{local.map(s=><button key={s.id} onClick={()=>{setSelected(String(s.id));setSection('map')}}><strong>{s.name}</strong><span>{pretty(s.strategic_state)} · {factionName(s.governing_faction_id)}</span><small>{Number(s.population).toLocaleString()} residents</small></button>)}{!local.length&&<p className="wa-empty">No settlements in this category for the selected region and zone.</p>}</div></section>}
   {activeRegion&&section==='civil'&&<>{canEdit&&<details className="wa-civic-form wa-climate-settings"><summary><i className="fa-solid fa-cloud-sun" aria-hidden="true"/> Regional weather administration · edit baseline & DM events</summary><RegionClimatePanel key={activeRegion.id} region={activeRegion} request={request} canEdit={canEdit} onChanged={load}/></details>}<div className="wa-weather"><div><span>REGIONAL WEATHER</span><strong>{pretty(activeRegion.effective_weather?.weather||activeRegion.weather)}</strong><small>{activeRegion.effective_weather?.season?pretty(activeRegion.effective_weather.season)+" · Seasonal Garlean climate":activeRegion.climate+" · DM manual"}</small></div><div><span>OUTDOOR TEMPERATURE</span><strong>{Number(activeRegion.effective_weather?.temperature_f??cToF(activeRegion.temperature_c)).toFixed(0)}°F</strong><small>Real-calendar fictional Garlean weather · {activeRegion.effective_weather?.date||"current"}</small></div>{canEdit&&<div><span>SIMULATION MODE</span><strong>{pretty(activeRegion.simulation_mode)}</strong><small>Manual, staff-approved cycles only</small></div>}</div>{canEdit&&local.length>0&&<><div className="wa-controls"><label>Manage civilians at <select value={local.some(s=>String(s.id)===selected)?selected:String(local[0].id)} onChange={e=>setSelected(e.target.value)}>{local.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div><CivicNeedsPanel key={local.some(s=>String(s.id)===selected)?selected:local[0].id} settlement={local.find(s=>String(s.id)===selected)||local[0]} regionMode={activeRegion.simulation_mode} request={request} canEdit={canEdit} onChanged={load}/></>}<details open={!canEdit} className="wa-civic-form wa-settlement-browser"><summary><i className="fa-solid fa-list" aria-hidden="true"/> Browse other settlements · {local.length} locations</summary><div className="wa-civil-grid">{local.map(s=><article className="wa-panel wa-civil-card" key={s.id}><div className="wa-panel-title"><strong>{s.name}</strong>{canEdit&&<span>{civicStatus(s,activeRegion)}</span>}</div><div className="wa-civic-values">{[['Housing',civicValue(s.civic_summary?.housing_capacity)+' places'],['Food reserves',Number(s.population)===0?'Not required':s.civic_summary?.has_stock?civicValue(s.civic_summary.food_days,' days'):'No supplies recorded'],['Water supplies',Number(s.population)===0?'Not required':civicValue(s.civic_summary?.water_stock)],['Heating coverage',civicValue(s.civic_summary?.heating_coverage,'%')],['Medical supplies',Number(s.population)===0?'Not required':civicValue(s.civic_summary?.medicine_stock)],['Unrest risk',Number(s.population)===0?'Not applicable':civicValue(s.civic_summary?.unrest_risk,' / 100')],['Unrest warning',pretty(s.civic_summary?.warnings?.length?'needs attention':'stable')]].map(([k,v])=><div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div><p className="wa-hint">{Number(s.population)===0?'Uninhabited settlement. Build housing to support new residents; no civilian provisions are required.':s.civic_summary?.warnings?.length?('Current alerts: '+s.civic_summary.warnings.slice(0,3).map(pretty).join(' · ')):'No current alerts from recorded civilian stock and services.'}</p>{canEdit&&<button onClick={()=>{setSelected(String(s.id));document.querySelector('.wa-civic-detail')?.scrollIntoView({behavior:'smooth',block:'start'})}}>Review civilian conditions</button>}</article>)}{!local.length&&<p className="wa-empty">Create settlements to begin tracking residents and civic needs.</p>}</div></details></>}
   {canEdit&&section==='reference'&&<section className="wa-panel wa-reference"><div className="wa-panel-title"><strong>CIVIC SIMULATION POLICY</strong><span>FOUNDATION 1</span></div><h3>Warnings, not punishment</h3><p>Food quantity and diet variety are separate. Repeating the same rations over long periods may cause dissatisfaction even when calories remain available. Cold weather raises heating demand; insulation and heating coverage offset exposure. Low services and existing unrest contribute to a projected unrest risk.</p><p>Garlean weather follows the real-world date and season while retaining a DM manual override. The climate is simulated, not observed weather at a real-world location. Civilian food, water, medicine and fuel may be consumed only through a staff-confirmed cycle when region, settlement and civic profile have explicitly enabled simulation. Off and narrative modes remain read-only. Autonomous NPC settlement cycles and optional Order-managed civic cycles operate on a persisted clock; riots, civilian harm, and military action never occur automatically. Every committed cycle is audited and duplicate dates are rejected.</p><p>Faction references come from <strong>Factions of the Realm</strong>. Government, military control and government support are independently assigned. Friendly relationships never automatically award land.</p><p>Further work is preserved in the GitHub document <code>docs/LIVING-WORLD-WAR-COMMAND-MASTER-PLAN.md</code>.</p></section>}
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
     <label className="wide wa-checkbox"><input type="checkbox" checked={Boolean(editing.simulation_enabled)} onChange={e=>setEditing({...editing,simulation_enabled:e.target.checked})}/> Allow staff-controlled civic simulation (never runs automatically)</label>
     {previewOutlook&&<div className="wide wa-projection"><strong>Projected civic outlook — read-only</strong><span>Heating demand {previewOutlook.heat_demand}% · Food pressure {previewOutlook.food_pressure} · Diet monotony {previewOutlook.diet_monotony} · Unrest risk {previewOutlook.unrest_risk}/100</span><small>Estimated only; no effects are applied.</small></div>}
    </>}
   </div><div className="wa-dialog-actions"><button type="button" onClick={()=>setEditing(null)}>Cancel</button><button className="wa-accent" disabled={busy} type="submit">{busy?'Saving…':'Save record'}</button></div></form></div>}
  </>}
 </section>;
}
