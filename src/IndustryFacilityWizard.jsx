import React,{useMemo,useState} from 'react';

const labels={farm:'Farm',orchard:'Orchard',ranch:'Ranch',fishery:'Fishery',mine:'Mine',quarry:'Quarry',lumber_yard:'Lumberyard',logging_camp:'Logging camp',sawmill:'Sawmill',refinery:'Refinery',factory:'Factory',ceruleum_plant:'Ceruleum plant',drilling_rig:'Drilling rig',power_plant:'Power plant',workshop:'Workshop',warehouse:'Warehouse',depot:'Depot'};
const preferred={farm:'agriculture',orchard:'agriculture',ranch:'agriculture',fishery:'agriculture',lumber_yard:'extraction',logging_camp:'extraction',mine:'mine',quarry:'mine',refinery:'refinery',ceruleum_plant:'refinery',drilling_rig:'extraction',sawmill:'manufacturing',factory:'manufacturing',workshop:'manufacturing',power_plant:'utilities'};
const pretty=x=>String(x||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
export function industryLocationOptions(data){
 const regions=data?.regions||[],zones=data?.zones||[];
 const annotate=(item,kind)=>({
  ...item,kind,locationKey:kind+':'+item.id,
  marker:kind==='site'?item.kind:item.map_icon||'settlement',
  condition:kind==='site'?'mapped':item.strategic_state||'peaceful',
  regionName:regions.find(x=>Number(x.id)===Number(item.region_id))?.name||'Unknown region',
  zoneName:zones.find(x=>Number(x.id)===Number(item.zone_id))?.name||'Regional overview',
 });
 return [...(data?.settlements||[]).map(x=>annotate(x,'settlement')),...(data?.sites||[]).map(x=>annotate(x,'site'))];
}
export default function IndustryFacilityWizard({data,busy=false,onCancel,onSubmit}){
 const locations=useMemo(()=>industryLocationOptions(data),[data]);
 const templates=(data?.templates||[]).filter(t=>!t.archived);
 const [query,setQuery]=useState(''),[ownership,setOwnership]=useState('all'),[region,setRegion]=useState('all'),[zone,setZone]=useState('all'),[type,setType]=useState('all');
 const [chosen,setChosen]=useState(null),[templateId,setTemplateId]=useState(0),[name,setName]=useState(''),[condition,setCondition]=useState('ruined'),[mode,setMode]=useState('manual'),[cadence,setCadence]=useState('normal'),[notes,setNotes]=useState('');
 const [step,setStep]=useState('location');
 const regionOptions=[...new Set(locations.map(x=>String(x.region_id)))];
 const zoneOptions=[...new Set(locations.filter(x=>region==='all'||String(x.region_id)===region).map(x=>String(x.zone_id)))];
 const typeOptions=[...new Set(locations.map(x=>x.marker))].sort();
 const eligible=locations.filter(loc=>{
  if(ownership==='order'&&loc.controlling_faction_id!=='eclipse-order')return false;
  if(ownership==='npc'&&(!loc.controlling_faction_id||loc.controlling_faction_id==='eclipse-order'))return false;
  if(ownership==='unclaimed'&&loc.controlling_faction_id)return false;
  if(region!=='all'&&String(loc.region_id)!==region)return false;
  if(zone!=='all'&&String(loc.zone_id)!==zone)return false;
  if(type!=='all'&&loc.marker!==type)return false;
  if(query&&!([loc.name,loc.regionName,loc.zoneName,loc.marker,loc.condition].join(' ').toLowerCase().includes(query.trim().toLowerCase())))return false;
  return true;
 });
 const selected=locations.find(x=>x.locationKey===chosen);
 const chosenTemplate=templates.find(t=>Number(t.id)===Number(templateId));
 const applyLocation=loc=>{
  const suggested=templates.find(t=>t.category===preferred[loc.marker])||templates[0];
  setChosen(loc.locationKey);setTemplateId(Number(suggested?.id||0));setName(loc.name+' '+(suggested?.name||'Production'));
  setCondition(['destroyed','abandoned'].includes(loc.condition)?'ruined':'ruined');
 };
 const send=()=>{if(!selected||!chosenTemplate||!name.trim()||busy)return;
  onSubmit({settlement_id:selected.kind==='settlement'?Number(selected.id):null,site_id:selected.kind==='site'?Number(selected.id):null,template_id:Number(chosenTemplate.id),name:name.trim(),status:condition,cycle_mode:mode,cycle_cadence:cadence,notes});
 };
 return <div className="wa-industry-overlay" role="presentation">
  <section className="wa-industry-attach" role="dialog" aria-modal="true" aria-label="Attach production to existing map location">
   <header className="wa-industry-attach-head">
    <div><span className="wa-kicker">TERRITORIAL INDUSTRY</span><h3>Attach production</h3><p>Choose an existing map location. Nothing new is placed on the map.</p></div>
    <button type="button" className="wa-industry-close" aria-label="Close production setup" onClick={onCancel}>×</button>
   </header>
   <div className="wa-industry-steps"><button type="button" className={step==='location'?'active':''} onClick={()=>setStep('location')}><span>01</span> Map location</button><button type="button" className={step==='production'?'active':''} disabled={!selected} onClick={()=>setStep('production')}><span>02</span> Production setup</button></div>
   {step==='location'?<>
    <div className="wa-industry-location-toolbar">
     <label className="wa-industry-search"><span>Find a location</span><input placeholder="Search farms, sites, zones…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
     <label><span>Region</span><select value={region} onChange={e=>{setRegion(e.target.value);setZone('all')}}><option value="all">All regions</option>{regionOptions.map(id=><option key={id} value={id}>{data.regions?.find(x=>String(x.id)===id)?.name||'Region '+id}</option>)}</select></label>
     <label><span>Zone</span><select value={zone} onChange={e=>setZone(e.target.value)}><option value="all">All zones</option>{zoneOptions.map(id=><option key={id} value={id}>{data.zones?.find(x=>String(x.id)===id)?.name||'Zone '+id}</option>)}</select></label>
     <label><span>Type</span><select value={type} onChange={e=>setType(e.target.value)}><option value="all">All location types</option>{typeOptions.map(id=><option value={id} key={id}>{labels[id]||pretty(id)}</option>)}</select></label>
    </div>
    <div className="wa-industry-ownership" role="group" aria-label="Location ownership">{[['all','All locations'],['order','Order'],['npc','NPC factions'],['unclaimed','Unclaimed']].map(([id,label])=><button type="button" key={id} className={ownership===id?'active':''} onClick={()=>setOwnership(id)}>{label}<small>{locations.filter(loc=>id==='all'||id==='order'&&loc.controlling_faction_id==='eclipse-order'||id==='npc'&&loc.controlling_faction_id&&loc.controlling_faction_id!=='eclipse-order'||id==='unclaimed'&&!loc.controlling_faction_id).length}</small></button>)}</div>
    <div className="wa-industry-choice-heading"><strong>Existing mapped locations</strong><span>{eligible.length} matching · {locations.length} total</span></div>
    <div className="wa-industry-location-grid" role="group" aria-label="Choose map location">{eligible.map(loc=><button type="button" key={loc.locationKey} className={'wa-industry-location-card '+(loc.locationKey===chosen?'selected':'')} aria-pressed={loc.locationKey===chosen} onClick={()=>applyLocation(loc)}>
      <div className="wa-industry-location-top"><span className="wa-industry-location-symbol"><i className={'fa-solid '+(['farm','orchard','ranch','fishery'].includes(loc.marker)?'fa-seedling':['mine','quarry','lumber_yard','logging_camp'].includes(loc.marker)?'fa-mountain':'fa-industry')} aria-hidden="true"/></span><span className={'wa-industry-location-status is-'+loc.condition}>{pretty(loc.condition)}</span></div>
      <strong>{loc.name}</strong><span className="wa-industry-location-meta">{labels[loc.marker]||pretty(loc.marker)} · {loc.zoneName}</span><small>{loc.regionName} · {loc.controlling_faction_id==='eclipse-order'?'Eclipse Order':loc.controlling_faction_id?'NPC faction':'Unclaimed'}</small>
      {loc.locationKey===chosen&&<span className="wa-industry-selected-label">Selected <i className="fa-solid fa-check" aria-hidden="true"/></span>}
     </button>)}
     {!eligible.length&&<div className="wa-industry-no-locations"><strong>No locations match these filters.</strong><p>Try All locations or clear your search. Locations are created in the Territory Map, not here.</p><button type="button" onClick={()=>{setQuery('');setRegion('all');setZone('all');setType('all');setOwnership('all')}}>Clear filters</button></div>}
    </div>
    <footer className="wa-industry-attach-foot"><span>{selected?selected.name+' · '+pretty(selected.condition):'Select an existing map location to continue.'}</span><button type="button" disabled={!selected} className="wa-industry-primary" onClick={()=>setStep('production')}>Continue to production <i className="fa-solid fa-chevron-right" aria-hidden="true"/></button></footer>
   </>:<>
    <div className="wa-industry-production-layout">
     <div className="wa-industry-production-main">
      <div className="wa-industry-picked-location"><span className="wa-kicker">SELECTED MAP LOCATION</span><strong>{selected?.name}</strong><small>{selected?.zoneName} · {labels[selected?.marker]||pretty(selected?.marker)} · {pretty(selected?.condition)}</small><button type="button" onClick={()=>setStep('location')}>Change location</button></div>
      {['destroyed','abandoned'].includes(selected?.condition)&&<p className="wa-industry-rebuild-note"><i className="fa-solid fa-hammer" aria-hidden="true"/> This location is {pretty(selected?.condition)}. You may attach a facility now, but it will not produce until a genuine construction project restores the site.</p>}
      <h4>Choose what this location produces</h4><div className="wa-industry-template-choices">{templates.map(t=><button type="button" key={t.id} className={Number(t.id)===Number(templateId)?'selected':''} aria-pressed={Number(t.id)===Number(templateId)} onClick={()=>{setTemplateId(Number(t.id));setName(selected.name+' '+t.name)}}><strong>{t.name}</strong><small>{pretty(t.category)} · {t.configuration?.outputs?.map(x=>data.items?.find(i=>i.id===x.item_id)?.name||x.item_id).join(', ')||'Custom resources'}</small></button>)}</div>
     </div>
     <aside className="wa-industry-configuration"><h4>Facility details</h4><label>Name<input value={name} maxLength="140" onChange={e=>setName(e.target.value)}/></label><label>Starting condition<select value={condition} onChange={e=>setCondition(e.target.value)}><option value="ruined">Ruined — requires rebuilding</option><option value="captured">Captured — requires liberation</option></select></label><label>Production schedule<select value={mode} onChange={e=>setMode(e.target.value)}><option value="manual">Manual</option><option value="automatic">Automatic after restoration</option><option value="off">Off</option></select></label><label>Cycle frequency<select value={cadence} onChange={e=>setCadence(e.target.value)}><option value="slow">Slow</option><option value="normal">Normal</option><option value="fast">Fast</option></select></label><label>Notes<input value={notes} maxLength="500" onChange={e=>setNotes(e.target.value)}/></label>
      <p>Workers, heating, power, output capacity and facility level are simulation-owned. They cannot be assigned here.</p>
      {chosenTemplate&&<div className="wa-industry-requirement-preview"><strong>Required per operation</strong><span>Workers: {chosenTemplate.configuration?.labor||0}</span><span>Heat: {chosenTemplate.configuration?.heat||0}</span><span>Power: {chosenTemplate.configuration?.power||0}</span></div>}
     </aside>
    </div>
    <footer className="wa-industry-attach-foot"><button type="button" onClick={()=>setStep('location')}>Back to locations</button><button type="button" className="wa-industry-primary" disabled={busy||!selected||!chosenTemplate||!name.trim()} onClick={send}>{busy?'Attaching…':'Attach facility to '+(selected?.name||'site')}</button></footer>
   </>}
  </section>
 </div>;
}
