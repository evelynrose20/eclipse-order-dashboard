// Presentation-only faction control classifications. Strategic status is
// independent: a destroyed location may still be owned by a faction.
const PALETTE=['#b88c62','#6fb2a0','#a899d4','#d28d92','#7d9ed0','#c6b46e','#8ab07b','#a5a6b7'];
export function factionColor(id){
 if(!id)return '#8b949e';
 if(id==='eclipse-order')return '#d2af70';
 let h=2166136261;
 for(const char of String(id)){h^=char.charCodeAt(0);h=Math.imul(h,16777619)}
 return PALETTE[(h>>>0)%PALETTE.length];
}
export function ownershipOf(settlement,localGovernmentId,factions=[]){
 const owner=settlement?.controlling_faction_id||null;
 const government=localGovernmentId||null;
 if(!owner)return {kind:'unclaimed',owner:null,label:'Unclaimed',color:'#8b949e'};
 const color=factions.find(f=>f.id===owner)?.map_color||factionColor(owner);
 if(owner==='eclipse-order')return {kind:government===owner?'local':'order',owner,label:'Imperium Noctis',color};
 if(government&&owner===government)return {kind:'local',owner,label:'Local government',color};
 return {kind:government?'foreign':'independent',owner,label:government?'Outside faction':'Independent faction',color};
}
export function mapOwnershipLegend(settlements,localGovernmentId,factions){
 const items=new Map();
 for(const site of settlements||[]){
  const o=ownershipOf(site,localGovernmentId,factions);
  const id=o.owner||'unclaimed';
  if(!items.has(id))items.set(id,{id,name:factions?.find(f=>f.id===id)?.name||(id==='unclaimed'?'Unclaimed':id==='eclipse-order'?'Imperium Noctis':id),color:o.color,kind:o.kind,count:0});
  items.get(id).count++;
 }
 return [...items.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
}
