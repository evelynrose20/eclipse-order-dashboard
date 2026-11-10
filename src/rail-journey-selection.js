export function canLoadAtRailStop(journey,sourceSettlement,destinationSettlement,now=Date.now()){
 if(!journey||journey.status!=='running'||journey.from_type!=='settlement'||journey.to_type!=='settlement')return false;
 const rows=[...(journey.stops||[])].sort((a,b)=>Number(a.stop_number)-Number(b.stop_number));
 const stops=[Number(journey.from_id),...rows.map(s=>Number(s.settlement_id)),Number(journey.to_id)];
 const originIndex=stops.indexOf(Number(sourceSettlement)),destinationIndex=stops.indexOf(Number(destinationSettlement));
 if(originIndex<0||destinationIndex<=originIndex)return false;
 const t=Number(now);
 if(originIndex===0)return t>=new Date(journey.departed_at).getTime()&&t<=new Date(journey.departed_at).getTime()+30*60000;
 const station=rows[originIndex-1];
 return station&&t>=new Date(station.arrival_at).getTime()&&t<=new Date(station.departure_at).getTime();
}
