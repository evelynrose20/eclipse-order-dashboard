import React,{useEffect,useMemo,useState} from 'react';
import './logistics-command-overview.css';
import LogisticsTerrain from './LogisticsTerrain.jsx';

const num=x=>Number(x||0).toLocaleString(undefined,{maximumFractionDigits:1});
const kind=x=>String(x||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const validPoint=x=>Number.isFinite(Number(x))&&Number(x)>=0&&Number(x)<=100;
const findById=(items,id)=>items.find(x=>Number(x.id)===Number(id));
const warn=s=>Array.isArray(s?.civic_summary?.warnings)?s.civic_summary.warnings:[];
const risk=s=>{
 const c=s?.civic_summary||{};
 if(['destroyed','abandoned'].includes(s?.strategic_state))return 'lost';
 if(warn(s).length||Number(c.unrest_risk||0)>=45)return 'alert';
 if(c.food_days!=null&&Number(c.food_days)<7||c.heat_days!=null&&Number(c.heat_days)<7)return 'alert';
 return 'stable';
};
const duration=t=>{
 if(!t)return '—';
 const n=Math.max(0,Math.floor((new Date(t).getTime()-Date.now())/60000));
 return n>=60?Math.floor(n/60)+'h '+n%60+'m':n+'m';
};
const fetchOptional=async request=>{
 const endpoints=[['world','/world-admin'],['rail','/internal-rail'],['exchange','/commerce'],['military','/world-admin/military'],['fronts','/fronts']];
 const results=await Promise.allSettled(endpoints.map(async ([,url])=>request(url)));
 return Object.fromEntries(endpoints.map(([name],i)=>[name,results[i].status==='fulfilled'?results[i].value:null]));
};

export default function LogisticsCommandOverview({request,freight,onNavigate,onTab,openShipment,onPlanSupply}){
 const [sources,setSources]=useState({}),[selectedRegion,setSelectedRegion]=useState(''),[selectedZone,setSelectedZone]=useState(''),[selectedSite,setSelectedSite]=useState(''),[view,setView]=useState('network'),[error,setError]=useState('');
 async function reload(){
  const result=await fetchOptional(request);
  setSources(result);
  setError(!result.world?'Territory network is temporarily unavailable. Cargo operations remain accessible.':'');
 }
 useEffect(()=>{let live=true;fetchOptional(request).then(result=>{if(live){setSources(result);setError(!result.world?'Territory network unavailable.':'')}});const timer=setInterval(()=>{if(live)fetchOptional(request).then(result=>{if(live)setSources(result)}).catch(()=>{})},60000);return()=>{live=false;clearInterval(timer)}},[request]);
 const world=sources.world,rails=sources.rail,exchange=sources.exchange,military=sources.military,fronts=sources.fronts;
 const regions=world?.regions||[],zones=world?.zones||[],sites=world?.settlements||[];
 const region=regions.find(x=>String(x.id)===selectedRegion)||regions[0];
 const regionZones=zones.filter(x=>Number(x.region_id)===Number(region?.id));
 const zone=regionZones.find(x=>String(x.id)===selectedZone)||regionZones.find(x=>x.is_default)||regionZones[0];
 const mapSites=sites.filter(s=>Number(s.region_id)===Number(region?.id)&&Number(s.zone_id)===Number(zone?.id)&&validPoint(s.map_x)&&validPoint(s.map_y));
 const focus=sites.find(s=>String(s.id)===selectedSite)||mapSites[0];
 const focusFacilities=(freight.facilities||[]).filter(f=>Number(f.settlement_id)===Number(focus?.id));
 const focusStocks=(freight.stocks||[]).filter(s=>focusFacilities.some(f=>Number(f.id)===Number(s.facility_id)));
 const focusShipments=(freight.shipments||[]).filter(s=>focusFacilities.some(f=>Number(f.id)===Number(s.source_facility_id)||Number(f.id)===Number(s.destination_facility_id)));
 const focusMilitary=(military?.installations||[]).filter(i=>Number(i.settlement_id)===Number(focus?.id));
 const focusRail=(rails?.stations||[]).filter(st=>st.stop_type==='settlement'&&Number(st.stop_id)===Number(focus?.id));
 const focusNeeds=warn(focus);
 const activeFreight=(freight.shipments||[]).filter(s=>['in_transit','disrupted'].includes(s.status));
 const npcRoutes=freight.npc_routes||[],npcShipments=freight.npc_shipments||[],npcWarehouses=freight.npc_warehouse||[];
 const focusNpcRoutes=npcRoutes.filter(r=>Number(r.settlement_id)===Number(focus?.id));
 const focusNpcStock=npcWarehouses.filter(r=>Number(r.settlement_id)===Number(focus?.id));
 const npcActive=npcShipments.filter(s=>s.status==='in_transit');
 const npcRelief=(freight.npc_trades||[]).filter(s=>['in_transit','held'].includes(s.status));
 const blockedCaravans=(freight.npc_trades||[]).filter(s=>s.status==='held'||s.status==='returned'||Number(s.reroute_count)>0);
 const railJourneys=(rails?.journeys||[]).filter(j=>j.status==='running');
 const railServices=rails?.routes||[];
 const marketContracts=(exchange?.contracts||[]).filter(c=>c.status==='open');
 const externalContracts=marketContracts.length;
 const orderStock=freight.stocks||[];
 const shortageSites=sites.filter(s=>risk(s)==='alert').sort((a,b)=>warn(b).length-warn(a).length);
 const militaryAlerts=(military?.installations||[]).filter(i=>i.state!=='operational');
 const position=id=>{
  const x=findById(mapSites,id);
  return x&&validPoint(x.map_x)&&validPoint(x.map_y)?{x:Number(x.map_x),y:Number(x.map_y)}:null;
 };
 const routeNode=world?.network_nodes||[],segments=(world?.network_segments||[]).filter(e=>Number(e.zone_id)===Number(zone?.id));
 const linePoints=(a,b,waypoints=[])=>[a,...(Array.isArray(waypoints)?waypoints.filter(p=>validPoint(p.x)&&validPoint(p.y)).map(p=>({x:Number(p.x),y:Number(p.y)})):[]),b];
 const lines=segments.map(segment=>{
  const a=findById(routeNode,segment.from_node_id),b=findById(routeNode,segment.to_node_id);
  return a&&b&&validPoint(a.map_x)&&validPoint(a.map_y)&&validPoint(b.map_x)&&validPoint(b.map_y)?{id:'network-'+segment.id,type:segment.route_type,from:{x:Number(a.map_x),y:Number(a.map_y)},to:{x:Number(b.map_x),y:Number(b.map_y)},waypoints:segment.waypoints}:null;
 }).filter(Boolean);
 const oldLines=(world?.routes||[]).filter(r=>Number(r.zone_id)===Number(zone?.id)).map(r=>{
  const a=position(r.from_settlement_id),b=position(r.to_settlement_id);return a&&b?{id:'old-'+r.id,type:r.route_type,from:a,to:b,waypoints:r.waypoints}:null
 }).filter(Boolean);
 const serviceLines=railServices.filter(r=>r.from_type==='settlement'&&r.to_type==='settlement'&&r.status==='active').map(r=>{const a=position(r.from_id),b=position(r.to_id);return a&&b?{id:r.id,from:a,to:b,name:r.name}:null}).filter(Boolean);
 const npcReliefLines=npcRelief.map(s=>{const from=position(s.source_settlement_id),to=position(s.destination_settlement_id);return from&&to?{id:s.id,from,to,status:s.status}:null}).filter(Boolean);
 const freightLines=activeFreight.map(s=>{
  const a=freight.facilities.find(f=>Number(f.id)===Number(s.source_facility_id)),b=freight.facilities.find(f=>Number(f.id)===Number(s.destination_facility_id));
  const from=position(a?.settlement_id),to=position(b?.settlement_id);
  return from&&to?{id:s.id,from,to,status:s.status,name:s.item_name,quantity:s.quantity}:null;
 }).filter(Boolean);
 const railAt=focusRail.length?focusRail.map(st=>st.name).join(' · '):'No station recorded';
 const npcLineLabels=npcRoutes.filter(r=>Number(r.settlement_id)===Number(focus?.id)).map(r=>r.source_name).join(' · ');
 const openWorld=()=>onNavigate?.('world');
 const go=(page)=>onNavigate?.(page);
 return <div className="supply-command">
  <div className="supply-statusbar">
   <div><small>SUPPLY COMMAND</small><strong>{activeFreight.length} convoys en route</strong></div>
   <div><small>RAIL NETWORK</small><strong>{railJourneys.length} trains moving</strong></div>
   <div><small>CIVILIAN WATCH</small><strong>{shortageSites.length} settlements flagged</strong></div>
   <div><small>INDUSTRIAL STORES</small><strong>{orderStock.length} stocked material lines</strong></div>
   <div><small>FOREIGN MARKET</small><strong>{exchange?externalContracts+' open contracts':'Unavailable'}</strong></div>
  </div>
  {error&&<p className="supply-notice">{error}</p>}
  <div className="supply-operations">
   <section className="supply-theater">
    <div className="supply-bar"><div><span className="supply-kicker">STRATEGIC THEATER</span><h3>Territorial supply network</h3></div><div className="supply-toolbar"><label>Region <select value={region?.id||''} onChange={e=>{setSelectedRegion(e.target.value);setSelectedZone('');setSelectedSite('')}}>{regions.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label>Zone <select value={zone?.id||''} onChange={e=>{setSelectedZone(e.target.value);setSelectedSite('')}}>{regionZones.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</select></label><button type="button" onClick={openWorld}>Open territory map <i className="fa-solid fa-arrow-up-right-from-square"/></button></div></div>
    {region&&zone?<div className="supply-map" role="group" aria-label={'Supply network for '+zone.name} style={region.map_background_url?{backgroundImage:'linear-gradient(#091a24a8,#091a24a8),url("'+region.map_background_url+'")',backgroundSize:'cover',backgroundPosition:'center'}:{}}>
      <LogisticsTerrain/>
      <div className="supply-map-grid" aria-hidden="true"/>
      <svg className="supply-map-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
       {[...oldLines,...lines].map(l=><polyline key={l.id} points={linePoints(l.from,l.to,l.waypoints).map(p=>p.x+','+p.y).join(' ')} className={'supply-link mode-'+l.type}/>)}
       {serviceLines.map(l=><line key={'service-'+l.id} x1={l.from.x} y1={l.from.y} x2={l.to.x} y2={l.to.y} className="supply-link mode-rail-service"/>)}
       {npcReliefLines.map(l=><line key={'relief-'+l.id} x1={l.from.x} y1={l.from.y} x2={l.to.x} y2={l.to.y} className={'supply-link cargo-npc-relief '+l.status}/>)}
       {freightLines.map(l=><line key={'freight-'+l.id} x1={l.from.x} y1={l.from.y} x2={l.to.x} y2={l.to.y} className={'supply-link cargo-'+l.status}/>)}
      </svg>
      {npcRoutes.filter(r=>r.map_settlement_id).map(r=>{const from=position(r.map_settlement_id),to=position(r.settlement_id);return from&&to?<svg key={'npc-route-'+r.id} className="supply-map-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="supply-link cargo-npc"/></svg>:null})}
      {mapSites.map(s=><button key={s.id} type="button" style={{left:s.map_x+'%',top:s.map_y+'%'}} className={'supply-map-site is-'+risk(s)+(Number(focus?.id)===Number(s.id)?' selected':'')} onClick={()=>setSelectedSite(String(s.id))} title={s.name+' · '+kind(s.strategic_state)} aria-label={'Inspect '+s.name}><i className={'fa-solid fa-'+(['mine','quarry'].includes(s.map_icon)?'mountain':s.map_icon==='farm'?'wheat-awn':'city')}/><span>{s.name}</span></button>)}
      {!mapSites.length&&<div className="supply-map-empty">There are no mapped settlements in this zone. Add locations in World Administration.</div>}
      <div className="supply-map-legend"><span><b className="legend-stable"/> Supplied / no alerts</span><span><b className="legend-alert"/> Needs attention</span><span><b className="legend-lost"/> Destroyed or abandoned</span><span><b className="legend-route"/> Active freight</span><span><b className="legend-rail"/> Internal rail service</span></div>
    </div>:<div className="supply-map-empty">Select a mapped region to view the transport network.</div>}
    <div className="supply-inspector">
     {focus?<><div className="supply-inspector-head"><div><small>SELECTED LOCATION · {kind(focus.strategic_state)}</small><h4>{focus.name}</h4><span>{focus.controlling_faction_id==='eclipse-order'?'Eclipse Order controlled':focus.controlling_faction_id?'Controlled by another faction':'Unclaimed'} · {num(focus.population)} residents</span></div><button type="button" onClick={openWorld}>Manage location</button></div>
      <div className="supply-location-facts"><div><small>INDUSTRY</small><strong>{focusFacilities.length} facilities</strong><span>{focusStocks.length} material lines</span></div><div><small>CIVILIAN SUPPLIES</small><strong>{focusNeeds.length?focusNeeds.length+' alerts':'No active alerts'}</strong><span>{focus.civic_summary?.food_days!=null?num(focus.civic_summary.food_days)+' food days':'Food reserve unreported'} · {focus.civic_summary?.heat_days!=null?num(focus.civic_summary.heat_days)+' heat days':'Heat reserve unreported'}</span></div><div><small>TRANSPORT</small><strong>{focusShipments.length} freight records · {focusNpcRoutes.length} farm routes</strong><span>{railAt}{npcLineLabels?' · Farm: '+npcLineLabels:''}</span></div><div><small>DEFENSE & STORES</small><strong>{focusMilitary.length} installations</strong><span>{focusNpcStock.length?focusNpcStock.length+' NPC cargo warehouse lines':focusMilitary.some(i=>i.state!=='operational')?'Repairs required':'No local warehouse stock recorded'}</span></div></div>
      <div className="supply-inspector-actions"><button disabled={!focusFacilities.length} title={!focusFacilities.length?'Attach a facility at this settlement before receiving freight':'Plan a delivery to this settlement'} onClick={()=>onPlanSupply?.(focusFacilities[0].id)}>Send supplies here</button><button onClick={openWorld}>Industry & settlements</button><button onClick={()=>go('internal-rail')}>Rail services</button></div>
     </>:<div className="supply-map-empty">Select a settlement to review its industrial stores, needs and transport operations.</div>}
    </div>
   </section>
   <aside className="supply-intel">
    <div className="supply-intel-heading"><span className="supply-kicker">OPERATIONS DESK</span><h3>Supply priorities</h3></div>
    {shortageSites.slice(0,6).map(s=><button className="supply-priority" key={s.id} onClick={()=>{setSelectedRegion(String(s.region_id));setSelectedZone(String(s.zone_id));setSelectedSite(String(s.id))}}><span className="supply-priority-icon"><i className="fa-solid fa-triangle-exclamation"/></span><span><strong>{s.name}</strong><small>{warn(s).slice(0,2).map(kind).join(' · ')||'Civilian reserves at risk'}</small></span><i className="fa-solid fa-chevron-right"/></button>)}
    {!shortageSites.length&&<p className="supply-muted">No civilian shortages flagged by the current settlement records.</p>}
    <div className="supply-intel-heading"><h3>Active movements</h3><button onClick={()=>onTab?.('shipments')}>All cargo</button></div>
    {activeFreight.slice(0,5).map(s=><div className="supply-movement" key={s.id}><i className={'fa-solid fa-'+(s.mode==='rail'?'train':s.mode==='air'?'plane':'truck')}/><span><strong>{s.item_name} × {num(s.quantity)}</strong><small>{s.source_name} → {s.destination_name}</small><small>{s.status==='disrupted'?'Movement interrupted':'ETA '+duration(s.due_at)}</small></span></div>)}
    {npcRelief.slice(0,3).map(s=><div className="supply-movement" key={'relief-'+s.id}><i className="fa-solid fa-hand-holding-heart"/><span><strong>NPC food relief · {num(s.amount)} food units</strong><small>{s.origin_name} → {s.destination_name}</small><small>{s.status==='held'?'Awaiting access or storage':'Arriving '+new Date(s.due_at).toLocaleString()}</small></span></div>)}
    {npcActive.slice(0,3).map(s=><div className="supply-movement" key={'npc-'+s.id}><i className="fa-solid fa-tractor"/><span><strong>NPC farm cargo · {s.item_name} × {num(s.quantity)}</strong><small>{npcRoutes.find(r=>Number(r.id)===Number(s.route_id))?.source_name||'Mapped farm'} → {sites.find(x=>Number(x.id)===Number(s.settlement_id))?.name||'NPC settlement'}</small><small>Arriving {new Date(s.arrival_at).toLocaleString()}</small></span></div>)}
    {railJourneys.slice(0,3).map(j=><div className="supply-movement" key={'rail-'+j.id}><i className="fa-solid fa-train"/><span><strong>Rail journey #{j.id}</strong><small>{kind(j.display_status||j.status)} · {duration(j.expected_arrival_at)} remaining</small></span></div>)}
    {!activeFreight.length&&!railJourneys.length&&!npcActive.length&&!npcRelief.length&&<p className="supply-muted">No convoys, farm deliveries or trains currently recorded as moving.</p>}
    {blockedCaravans.length>0&&<div className="supply-intel-heading"><h3>Caravan outcomes</h3><span>{blockedCaravans.length} recorded</span></div>}
    {blockedCaravans.slice(0,3).map(s=><div className="supply-movement" key={'caravan-outcome-'+s.id}><i className="fa-solid fa-route"/><span><strong>{s.status==='returned'?'Cargo returned to origin':s.status==='held'?'Caravan waiting for access':'Relief redirected'}</strong><small>{s.original_destination_name&&s.original_destination_name!==s.destination_name?s.original_destination_name+' → '+s.destination_name:s.origin_name+' → '+s.destination_name}</small><small>{num(s.amount)} food units · {s.status==='returned'?'Returned to existing reserves':s.status==='held'?'Delivery paused':'Continuing toward alternative settlement'}</small></span></div>)}
    {militaryAlerts.length>0&&<div className="supply-alert-note"><i className="fa-solid fa-shield-halved"/> {militaryAlerts.length} military installations need attention.</div>}
    <div className="supply-intel-heading"><h3>Foreign demand</h3><button onClick={()=>go('trade')}>Market</button></div>
    {marketContracts.slice(0,4).map(c=><button key={c.id} className="supply-priority" onClick={()=>go('trade')}><i className="fa-solid fa-coins"/><span><strong>{c.faction_name||'Foreign market'} · {c.material_name||c.equipment_name||'Trade order'}</strong><small>{num(Math.max(0,Number(c.required_quantity||0)-Number(c.delivered_quantity||0)))} units remaining</small></span><i className="fa-solid fa-chevron-right"/></button>)}
    {exchange&&!marketContracts.length&&<p className="supply-muted">No open external exchange contracts.</p>}
   </aside>
  </div>
  <div className="supply-systems">
   <div className="supply-systems-head"><span className="supply-kicker">EXISTING WORLD SYSTEMS</span><h3>Operations across the Order</h3><p>Continue working with the systems already running your world.</p></div>
   <div className="supply-system-grid">
    <button onClick={()=>go('world')}><i className="fa-solid fa-industry"/><strong>Industry & restoration</strong><span>{freight.facilities?.length||0} registered facilities · actual production and construction</span><small>Open World Administration</small></button>
    <button onClick={()=>go('internal-rail')}><i className="fa-solid fa-train"/><strong>Internal rail logistics</strong><span>{rails?railServices.length+' services · '+(rails.stations?.length||0)+' stations':'Rail data unavailable'} · train operations</span><small>Open railway command</small></button>
    <button onClick={()=>go('trade')}><i className="fa-solid fa-scale-balanced"/><strong>Merchant Exchange</strong><span>{exchange?(exchange.contracts?.length||0)+' contracts · '+(exchange.deliveries?.length||0)+' deliveries':'Market data unavailable'} · diplomacy and trade</span><small>Open the market</small></button>
    <button onClick={()=>go('world')}><i className="fa-solid fa-seedling"/><strong>NPC settlements & farms</strong><span>{npcRoutes.length} mapped farm routes · {npcRelief.length} relief convoys</span><small>Open settlement management</small></button>
    <button onClick={()=>go('world')}><i className="fa-solid fa-shield-halved"/><strong>Castrums & military supply</strong><span>{military?(military.installations?.length||0)+' installations':'Military records unavailable'} · garrisons and war stores</span><small>Open military installations</small></button>
    <button onClick={()=>go('fronts')}><i className="fa-solid fa-store"/><strong>Order fronts</strong><span>{fronts?(fronts.fronts?.length||0)+' registered fronts · ':'Existing businesses · '}reserved stock and commercial operations</span><small>Open Order fronts</small></button>
   </div>
  </div>
 </div>;
}
