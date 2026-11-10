import React,{useEffect,useMemo,useState} from 'react';

/* Position is calculated from persisted departure/arrival times, not a decorative loop.
   Known route segments are followed in recorded order; unmapped routes show direct
   terminal-to-terminal progress, and never move when a shipment is held. */
const valid=p=>p&&Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.y));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const midway=(a,b,p)=>({x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p});
function pointAt(nodes,portion){
 if(nodes.length<2)return nodes[0]||null;
 const lens=nodes.slice(1).map((p,i)=>distance(nodes[i],p));
 const total=lens.reduce((a,b)=>a+b,0);
 if(!total)return nodes[0];
 let remaining=Math.min(1,Math.max(0,portion))*total;
 for(let i=0;i<lens.length;i++){if(remaining<=lens[i])return midway(nodes[i],nodes[i+1],lens[i]?remaining/lens[i]:0);remaining-=lens[i]}
 return nodes[nodes.length-1];
}
export function cargoProgress(start,end,now){
 const a=Date.parse(String(start||'')),b=Date.parse(String(end||''));
 return Number.isFinite(a)&&Number.isFinite(b)&&b>a?Math.max(0,Math.min(1,(now-a)/(b-a))):0;
}
export function cargoTrack(start,end,ids,segments=[],routeNodes=[]){
 if(!valid(start)||!valid(end))return [];
 const track=[start];
 for(const id of ids||[]){
  const seg=segments.find(s=>String(s.id)===String(id));
  if(!seg)continue;
  const nodeA=routeNodes.find(n=>Number(n.id)===Number(seg.from_node_id));
  const nodeB=routeNodes.find(n=>Number(n.id)===Number(seg.to_node_id));
  if(!nodeA||!nodeB||!Number.isFinite(Number(nodeA.map_x))||!Number.isFinite(Number(nodeB.map_x)))continue;
  const a={x:Number(nodeA.map_x),y:Number(nodeA.map_y)},b={x:Number(nodeB.map_x),y:Number(nodeB.map_y)};
  const near=distance(track[track.length-1],a)<=distance(track[track.length-1],b);
  const first=near?a:b,second=near?b:a;
  track.push(first,...(Array.isArray(seg.waypoints)?seg.waypoints.filter(valid):[]),second);
 }
 track.push(end);
 return track;
}
const displayIcon=mode=>mode==='rail'?'fa-train':mode==='air'?'fa-plane':mode==='sea'?'fa-ship':mode==='pack'?'fa-horse':'fa-truck-fast';
export default function LogisticsMovingCargo({freight,sites,segments=[],routeNodes=[],zone,showNpc=true}){
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const interval=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(interval)},[]);
 const settlements=useMemo(()=>new Map((sites||[]).map(s=>[Number(s.id),s])),[sites]);
 const facilities=useMemo(()=>new Map((freight?.facilities||[]).map(f=>[Number(f.id),f])),[freight]);
 const point=id=>{
  const s=settlements.get(Number(id));
  return s&&Number(s.zone_id)===Number(zone?.id)&&s.map_x!=null&&s.map_y!=null?{x:Number(s.map_x),y:Number(s.map_y)}:null;
 };
 const pips=[];
 for(const s of freight?.shipments||[]){
  if(!['in_transit','disrupted'].includes(s.status))continue;
  const source=facilities.get(Number(s.source_facility_id)),dest=facilities.get(Number(s.destination_facility_id));
  const a=point(source?.settlement_id),b=point(dest?.settlement_id);
  if(!a||!b)continue;
  const portion=cargoProgress(s.departed_at,s.due_at,s.status==='disrupted'?Date.parse(s.due_at)-1:now);
  const segmentsUsed=Array.isArray(s.route_segments)?s.route_segments:[];
  const at=pointAt(cargoTrack(a,b,segmentsUsed,segments,routeNodes),portion);
  if(at)pips.push({key:'freight-'+s.id,at,mode:s.mode,name:s.item_name+' × '+s.quantity,status:s.status,detail:source?.name+' → '+dest?.name});
 }
 if(showNpc)for(const s of freight?.npc_trades||[]){
  if(!['in_transit','held'].includes(s.status))continue;
  const a=point(s.source_settlement_id),b=point(s.destination_settlement_id);
  if(!a||!b)continue;
  const at=pointAt(cargoTrack(a,b,typeof s.route_json==='string'?JSON.parse(s.route_json):s.route_json,segments,routeNodes),cargoProgress(s.departed_at,s.due_at,s.status==='held'?Date.parse(s.due_at)-1:now));
  if(at)pips.push({key:'npc-'+s.id,at,mode:'pack',name:s.amount+' food units',status:s.status==='held'?'held':'in_transit',detail:s.origin_name+' → '+s.destination_name,npc:true});
 }
 return <>{pips.map(p=><span key={p.key} className={'supply-map-cargo is-'+p.mode+(p.npc?' is-npc':'')+(p.status==='held'||p.status==='disrupted'?' is-held':'')} style={{left:p.at.x+'%',top:p.at.y+'%'}} title={p.name+' · '+p.detail+' · '+(p.status==='in_transit'?'Moving':'Held')} aria-label={p.name+' moving along '+p.detail}><i className={'fa-solid '+displayIcon(p.mode)}/></span>)}</>;
}
