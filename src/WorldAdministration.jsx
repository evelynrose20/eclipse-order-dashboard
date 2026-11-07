import React,{useEffect,useMemo,useState} from 'react';
import './world-administration.css';

const regionBlank={name:'',description:'',climate:'cold highland',weather:'clear',temperature_c:5,simulation_mode:'off',map_background_url:''};
const settlementBlank=regionId=>({region_id:regionId||0,name:'',description:'',directory_faction_id:null,governing_faction_id:null,controlling_faction_id:null,supporting_faction_id:null,map_x:50,map_y:50,strategic_state:'peaceful',population:0,workforce:0,food_days:0,food_variety:50,heating_coverage:50,insulation:50,housing:50,medical_access:50,food_access:50,security_score:50,civil_stability:70,unrest:0,weather_exposure:50,simulation_enabled:false});
const civicFields=[['population','NPC population',10000000],['workforce','Employed / available workers',10000000],['food_days','Food reserves (days)',99999],['food_variety','Food diversity',100],['heating_coverage','Heating coverage',100],['insulation','Insulation quality',100],['housing','Housing adequacy',100],['medical_access','Medical access',100],['food_access','Food access',100],['security_score','Public safety',100],['civil_stability','Civic stability',100],['unrest','Current unrest',100],['weather_exposure','Weather exposure',100]];
const states=['peaceful','contested','occupied','liberated','rebuilding'];
const pretty=x=>String(x||'').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase());
export default function WorldAdministration({request,readOnly=false}){
 const [data,setData]=useState(null),[section,setSection]=useState('map'),[region,setRegion]=useState(''),[selected,setSelected]=useState('');
 const [editing,setEditing]=useState(null),[editType,setEditType]=useState(''),[preview,setPreview]=useState(true);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const load=async()=>{const result=await request('/world-admin');setData(result);setRegion(old=>result.regions.some(r=>String(r.id)===old)?old:String(result.regions[0]?.id||''));setSelected(old=>result.settlements.some(s=>String(s.id)===old)?old:String(result.settlements[0]?.id||''));return result};
 useEffect(()=>{load().catch(e=>setError(e.message||'Unable to open world records.'))},[]);
 const canEdit=!!data?.can_edit&&!readOnly;
 const regions=data?.regions||[],settlements=data?.settlements||[],factions=data?.factions||[];
 const activeRegion=regions.find(r=>String(r.id)===region);
 const local=settlements.filter(s=>String(s.region_id)===region);
 const current=settlements.find(s=>String(s.id)===selected);
 const factionName=id=>factions.find(f=>f.id===id)?.name||'Not assigned';
 const previewOutlook=useMemo(()=>{if(!editing||editType!=='settlement')return null;
  const climate=regions.find(r=>Number(r.id)===Number(editing.region_id))||activeRegion;
  const demand=Math.min(100,Math.round(Math.max(0,12-Number(climate?.temperature_c??15))*7*(1+Math.max(0,100-Number(editing.insulation))/120)));
  const cold=Math.max(0,demand-Number(editing.heating_coverage));
  const food=Math.max(0,14-Number(editing.food_days))*4;
  const variety=Math.max(0,55-Number(editing.food_variety))*.5;
  const unmet=Math.min(100,Math.round(food+cold*.45+variety+(100-Number(editing.food_access))*.14+(100-Number(editing.medical_access))*.08));
  const risk=Math.max(0,Math.min(100,Math.round(unmet*.6+Number(editing.unrest)*.4)));
  return {heat_demand:demand,food_pressure:Math.round(food),diet_monotony:Math.round(variety),unrest_risk:risk};
 },[editing,editType,regions,region]);
 async function save(e){
  e.preventDefault();if(!canEdit)return;
  const endpoint=editType==='region'?'regions':'settlements';
  const body=editType==='settlement'?{...editing,region_id:Number(editing.region_id),map_x:Number(editing.map_x),map_y:Number(editing.map_y),population:Number(editing.population),workforce:Number(editing.workforce),food_days:Number(editing.food_days),...Object.fromEntries(civicFields.filter(([k])=>!['population','workforce','food_days'].includes(k)).map(([k])=>[k,Number(editing[k])])),simulation_enabled:Boolean(editing.simulation_enabled)}:{...editing,temperature_c:Number(editing.temperature_c)};
  setBusy(true);setError('');setNotice('');
  try{
   const response=await request('/world-admin/'+endpoint+(editing.id?'/'+editing.id:''),{method:editing.id?'PUT':'POST',body});
   await load();
   if(editType==='region')setRegion(String(editing.id||response.id));
   if(editType==='settlement'){setRegion(String(body.region_id));setSelected(String(editing.id||response.id))}
   setEditing(null);setNotice('World record saved. No automatic simulation was run.');
  }catch(e){setError(e.message||'Save failed.')}finally{setBusy(false)}
 }
 const newSettlement=()=>{if(!region)return;setEditType('settlement');setEditing(settlementBlank(Number(region)))};
 const editSettlement=s=>{setEditType('settlement');setEditing({...s})};
 const editRegion=r=>{setEditType('region');setEditing(r?{...r}:regionBlank)};
 return <section className="wa-root">
  <header className="wa-heading"><div><span>IMPERIAL ADMINISTRATION · NEW CASSIA & THE REALM</span><h2>World Administration</h2><p>Territories, civilian welfare, weather, heating, food variety and political relationships.</p></div>{canEdit&&<button className="wa-accent" onClick={()=>editRegion(null)}>+ New region</button>}</header>
  {error&&<p role="alert" className="wa-error">{error}</p>}{notice&&<p role="status" className="wa-notice">{notice}</p>}
  {!data?<p className="wa-empty">Opening world records…</p>:<>
   <nav className="wa-tabs" aria-label="World administration sections">
    {[['map','Territorial Map'],['settlements','Settlements'],['civil','Civilian Welfare'],['reference','Simulation Rules']].map(([id,name])=><button key={id} aria-current={section===id?'page':undefined} className={section===id?'active':''} onClick={()=>setSection(id)}>{name}</button>)}
   </nav>
   <div className="wa-controls"><label>Region <select value={region} onChange={e=>setRegion(e.target.value)}><option value="">Choose region</option>{regions.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>{canEdit&&activeRegion&&<button onClick={()=>editRegion(activeRegion)}>Edit region / weather</button>}{canEdit&&activeRegion&&<button className="wa-accent" onClick={newSettlement}>+ Add settlement</button>}</div>
   {!regions.length&&<div className="wa-empty"><h3>No regions yet</h3><p>Begin by creating New Cassia's first region, then place settlements on its territory map. Nothing has been automatically populated.</p>{canEdit&&<button className="wa-accent" onClick={()=>editRegion(null)}>Create first region</button>}</div>}
   {activeRegion&&section==='map'&&<div className="wa-columns"><section className="wa-panel"><div className="wa-panel-title"><strong>REGIONAL TERRITORY MAP</strong><span>{activeRegion.name}</span></div><div className="wa-map" style={activeRegion.map_background_url?{backgroundImage:'linear-gradient(#101b25a9,#101b25a9),url("'+activeRegion.map_background_url+'")'}:{}}>
      <div className="wa-map-crosshair" aria-hidden="true"/>
      {local.map(s=><button type="button" key={s.id} className={'wa-map-pin '+(String(s.id)===selected?'active':'')} style={{left:s.map_x+'%',top:s.map_y+'%'}} title={s.name} aria-label={'View '+s.name} onClick={()=>{setSelected(String(s.id));setPreview(true)}}><span className="wa-map-dot"/><span className="wa-map-label">{s.name}</span></button>)}
      {!local.length&&<div className="wa-map-empty">No locations mapped in this region</div>}
     </div><p className="wa-hint">Markers represent saved settlements. Edit a settlement to change its map position (0–100%). Territory borders and routes are scheduled for the next phase.</p></section>
     <section className="wa-panel"><div className="wa-panel-title"><strong>SELECTED SETTLEMENT</strong><span>{local.length} locations</span></div>{current&&String(current.region_id)===region?<div className="wa-inspector"><h3>{current.name}</h3><p>{current.description||'No description yet.'}</p><div><span>Control</span><strong>{factionName(current.controlling_faction_id)}</strong></div><div><span>Government</span><strong>{factionName(current.governing_faction_id)}</strong></div><div><span>Supporting faction</span><strong>{factionName(current.supporting_faction_id)}</strong></div><div><span>Territorial state</span><strong>{pretty(current.strategic_state)}</strong></div><div><span>NPC residents</span><strong>{Number(current.population).toLocaleString()}</strong></div>{canEdit&&<button className="wa-accent" onClick={()=>editSettlement(current)}>Edit settlement</button>}</div>:<p className="wa-empty">Select a mapped settlement.</p>}</section></div>}
   {activeRegion&&section==='settlements'&&<section className="wa-panel"><div className="wa-panel-title"><strong>SETTLEMENT REGISTRY</strong><span>{local.length} locations</span></div><div className="wa-settlement-list">{local.map(s=><button key={s.id} onClick={()=>{setSelected(String(s.id));setSection('map')}}><strong>{s.name}</strong><span>{pretty(s.strategic_state)} · {factionName(s.governing_faction_id)}</span><small>{Number(s.population).toLocaleString()} NPCs</small></button>)}{!local.length&&<p className="wa-empty">No settlements in this region yet.</p>}</div></section>}
   {activeRegion&&section==='civil'&&<><div className="wa-weather"><div><span>REGIONAL WEATHER</span><strong>{pretty(activeRegion.weather)}</strong><small>{activeRegion.climate}</small></div><div><span>OUTDOOR TEMPERATURE</span><strong>{Number(activeRegion.temperature_c).toFixed(1)}°C</strong><small>DM-defined, not live weather</small></div><div><span>SIMULATION MODE</span><strong>{pretty(activeRegion.simulation_mode)}</strong><small>No automated ticks in this phase</small></div></div><div className="wa-civil-grid">{local.map(s=><article className="wa-panel wa-civil-card" key={s.id}><div className="wa-panel-title"><strong>{s.name}</strong><span>{s.simulation_enabled?'Armed for future simulation':'Simulation off'}</span></div><div className="wa-civic-values">{[['Food reserves',Number(s.food_days).toFixed(1)+' days'],['Food diversity',s.food_variety+' / 100'],['Heating coverage',s.heating_coverage+'%'],['Insulation',s.insulation+'%'],['Current unrest',s.unrest+'%'],['Unrest warning',pretty(s.outlook.warning)]].map(([k,v])=><div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div><p className="wa-hint">{s.outlook.warning==='elevated'?'Elevated needs pressure. DM review recommended; no automatic events.':s.outlook.warning==='watch'?'Monitor housing, food and heating.':'No urgent warning according to the current illustrative outlook.'}</p>{canEdit&&<button onClick={()=>editSettlement(s)}>Review civilian conditions</button>}</article>)}{!local.length&&<p className="wa-empty">Create settlements to begin tracking residents and civic needs.</p>}</div></>}
   {section==='reference'&&<section className="wa-panel wa-reference"><div className="wa-panel-title"><strong>CIVIC SIMULATION POLICY</strong><span>FOUNDATION 1</span></div><h3>Warnings, not punishment</h3><p>Food quantity and diet variety are separate. Repeating the same rations over long periods may cause dissatisfaction even when calories remain available. Cold weather raises heating demand; insulation and heating coverage offset exposure. Low services and existing unrest contribute to a projected unrest risk.</p><p>No automatic production, food consumption, riots, civilian harm, weather transition or military action occurs in this release. Editing a region or settlement saves its state only. Future simulation phases must be enabled and tested deliberately.</p><p>Faction references come from <strong>Factions of the Realm</strong>. Government, military control and government support are independently assigned. Friendly relationships never automatically award land.</p><p>Further work is preserved in the GitHub document <code>docs/LIVING-WORLD-WAR-COMMAND-MASTER-PLAN.md</code>.</p></section>}
   {editing&&canEdit&&<div className="wa-overlay"><form className="wa-dialog" onSubmit={save} aria-label={editType==='region'?'Edit region':'Edit settlement'}><div className="wa-dialog-head"><h3>{editing.id?'Edit':'Create'} {editType==='region'?'region':'settlement'}</h3><button type="button" onClick={()=>setEditing(null)} aria-label="Close editor">×</button></div><div className="wa-fields">
    <label>Name<input required maxLength={editType==='region'?120:140} value={editing.name||''} onChange={e=>setEditing({...editing,name:e.target.value})}/></label>
    <label className="wide">Description<textarea rows="3" value={editing.description||''} onChange={e=>setEditing({...editing,description:e.target.value})}/></label>
    {editType==='region'?<><label>Climate<input required maxLength={80} value={editing.climate} onChange={e=>setEditing({...editing,climate:e.target.value})}/></label><label>Current weather<input required maxLength={80} value={editing.weather} onChange={e=>setEditing({...editing,weather:e.target.value})}/></label><label>Temperature °C<input required type="number" min="-100" max="100" step=".1" value={editing.temperature_c} onChange={e=>setEditing({...editing,temperature_c:e.target.value})}/></label><label>Simulation<select value={editing.simulation_mode} onChange={e=>setEditing({...editing,simulation_mode:e.target.value})}><option value="off">Off</option><option value="narrative">Narrative</option><option value="managed">Managed (future)</option></select></label><label className="wide">HTTPS map background image URL<input type="url" value={editing.map_background_url||''} onChange={e=>setEditing({...editing,map_background_url:e.target.value})}/></label></>:<>
     <label>Region<select value={editing.region_id} onChange={e=>setEditing({...editing,region_id:Number(e.target.value)})}>{regions.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
     <label>Territory state<select value={editing.strategic_state} onChange={e=>setEditing({...editing,strategic_state:e.target.value})}>{states.map(x=><option key={x} value={x}>{pretty(x)}</option>)}</select></label>
     {[['directory_faction_id','Faction directory record'],['governing_faction_id','Governing authority'],['controlling_faction_id','Territorial controller'],['supporting_faction_id','Supporting government / faction']].map(([key,title])=><label key={key}>{title}<select value={editing[key]||''} onChange={e=>setEditing({...editing,[key]:e.target.value||null})}><option value="">Not assigned</option>{factions.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>)}
     <label>Map X (0–100%)<input type="number" min="0" max="100" step=".1" value={editing.map_x} onChange={e=>setEditing({...editing,map_x:e.target.value})}/></label>
     <label>Map Y (0–100%)<input type="number" min="0" max="100" step=".1" value={editing.map_y} onChange={e=>setEditing({...editing,map_y:e.target.value})}/></label>
     {civicFields.map(([key,title,max])=><label key={key}>{title}<input type="number" min="0" max={max} step={key==='food_days'?'.1':'1'} value={editing[key]??0} onChange={e=>setEditing({...editing,[key]:e.target.value})}/></label>)}
     <label className="wide wa-checkbox"><input type="checkbox" checked={Boolean(editing.simulation_enabled)} onChange={e=>setEditing({...editing,simulation_enabled:e.target.checked})}/> Enable for future simulation (no automatic processing in foundation release)</label>
     {previewOutlook&&<div className="wide wa-projection"><strong>Projected civic outlook — read-only</strong><span>Heating demand {previewOutlook.heat_demand}% · Food pressure {previewOutlook.food_pressure} · Diet monotony {previewOutlook.diet_monotony} · Unrest risk {previewOutlook.unrest_risk}/100</span><small>Estimated only; no effects are applied.</small></div>}
    </>}
   </div><div className="wa-dialog-actions"><button type="button" onClick={()=>setEditing(null)}>Cancel</button><button className="wa-accent" disabled={busy} type="submit">{busy?'Saving…':'Save record'}</button></div></form></div>}
  </>}
 </section>;
}
