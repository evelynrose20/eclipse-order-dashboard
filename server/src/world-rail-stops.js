// Menu-based internal train stopping: an ordered timetable, not physical track simulation.
const minutes=60_000;
export function planRailStops(durationMinutes,stopIds){
 if(!Number.isInteger(durationMinutes)||durationMinutes<1||!Array.isArray(stopIds)||stopIds.length>8||new Set(stopIds).size!==stopIds.length)return null;
 if(!stopIds.length)return [];
 const dwell=Math.min(15,Math.floor(durationMinutes/(3*stopIds.length)));
 if(dwell<2)return null;
 const drivingSeconds=(durationMinutes-stopIds.length*dwell)*60;
 if(drivingSeconds<(stopIds.length+1)*60)return null;
 const segment=drivingSeconds/(stopIds.length+1);
 return stopIds.map((stationId,i)=>({
  station_id:stationId,
  arrival_seconds:Math.round(segment*(i+1)+dwell*60*i),
  departure_seconds:Math.round(segment*(i+1)+dwell*60*(i+1))
 }));
}
const time=x=>new Date(x).getTime();
export function railCargoWindow(train,stops,fromId,toId,now=new Date()){
 const rows=[...stops].sort((a,b)=>Number(a.stop_number)-Number(b.stop_number));
 const current=time(now),departure=time(train.departed_at),final=time(train.expected_arrival_at);
 if(!Number.isFinite(current)||!Number.isFinite(departure)||!Number.isFinite(final)||current>=final)return null;
 let index=-1;
 if(Number(fromId)===Number(train.from_id)&&current>=departure&&current<=departure+30*minutes)index=-1;
 else index=rows.findIndex(s=>Number(s.settlement_id)===Number(fromId)&&current>=time(s.arrival_at)&&current<=time(s.departure_at));
 if(index===-1&&Number(fromId)!==Number(train.from_id))return null;
 if(index===-1&&!(current>=departure&&current<=departure+30*minutes))return null;
 const destination=rows.findIndex((s,i)=>i>index&&Number(s.settlement_id)===Number(toId));
 if(destination<0&&Number(toId)!==Number(train.to_id))return null;
 const arrival=destination>=0?rows[destination].arrival_at:train.expected_arrival_at;
 if(time(arrival)<=current)return null;
 return {arrival_at:arrival,source_index:index,destination_index:destination,loading_at:fromId,unloading_at:toId};
}
export function trainLocation(train,stops,now=new Date()){
 const current=time(now),start=time(train.departed_at),end=time(train.expected_arrival_at);
 if(train.status==='arrived'||current>=end)return {status:'arrived',at_settlement_id:train.to_id,progress_percent:100};
 if(current<start)return {status:'scheduled',at_settlement_id:train.from_id,progress_percent:0};
 const rows=[...stops].sort((a,b)=>Number(a.stop_number)-Number(b.stop_number));
 const at=rows.find(s=>current>=time(s.arrival_at)&&current<=time(s.departure_at));
 const progress=Math.max(0,Math.min(100,Math.floor((current-start)/(end-start)*100)));
 if(at)return {status:'loading',at_settlement_id:at.settlement_id,stop_number:at.stop_number,progress_percent:progress,departure_at:at.departure_at};
 const upcoming=rows.find(s=>current<time(s.arrival_at));
 return {status:'travelling',at_settlement_id:null,next_settlement_id:upcoming?.settlement_id||train.to_id,eta:upcoming?.arrival_at||train.expected_arrival_at,progress_percent:progress};
}
export async function journeyStops(db,journeyIds){
 if(!journeyIds.length)return [];
 const [rows]=await db.query('SELECT * FROM order_internal_rail_journey_stops WHERE journey_id IN ('+journeyIds.map(()=>'?').join(',')+') ORDER BY journey_id,stop_number',journeyIds);
 return rows;
}
export async function addJourneyStops(db,{journeyId,route,stationIds}){
 if(!Array.isArray(stationIds)||stationIds.length>8||stationIds.some(x=>!Number.isSafeInteger(x)||x<1)||new Set(stationIds).size!==stationIds.length)return false;
 const plan=planRailStops(Number(route.duration_minutes),stationIds);if(plan===null)return false;
 if(!stationIds.length)return true;
 const [stations]=await db.query('SELECT id,stop_id,stop_type,status FROM order_internal_rail_stations WHERE id IN ('+stationIds.map(()=>'?').join(',')+')',stationIds);
 if(stations.length!==stationIds.length)return false;
 if(stations.some(s=>s.stop_type!=='settlement'||s.status!=='operational'||Number(s.id)===Number(route.from_station_id)||Number(s.id)===Number(route.to_station_id)))return false;
 if(new Set(stations.map(s=>Number(s.stop_id))).size!==stations.length)return false;
 const [available]=await db.query("SELECT id FROM world_settlements WHERE controlling_faction_id='eclipse-order' AND id IN ("+stations.map(()=>'?').join(',')+")",stations.map(s=>s.stop_id));
 if(available.length!==stations.length)return false;
 const [[clock]]=await db.execute('SELECT departed_at FROM order_internal_rail_journeys WHERE id=?',[journeyId]);
 if(!clock)return false;
 for(let i=0;i<plan.length;i++){
  const segment=plan[i],station=stations.find(s=>Number(s.id)===Number(segment.station_id));
  await db.execute('INSERT INTO order_internal_rail_journey_stops(journey_id,stop_number,station_id,settlement_id,arrival_at,departure_at) VALUES(?,?,?,?,DATE_ADD(?,INTERVAL ? SECOND),DATE_ADD(?,INTERVAL ? SECOND))',
   [journeyId,i+1,station.id,station.stop_id,clock.departed_at,segment.arrival_seconds,clock.departed_at,segment.departure_seconds]);
 }
 return true;
}
