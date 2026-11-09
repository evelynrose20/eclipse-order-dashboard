/** Only completed, faction-owned and operational industry earns autonomous civic development.
 * The caller supplies one verified production quantity per active facility for the prior day.
 */
export function npcIndustryDevelopment(facilities=[]){
 return facilities.reduce((total,facility)=>{
  const operations=Math.max(0,Math.floor(Number(facility.operations)||0));
  return total+Math.min(10,Math.floor(operations/4));
 },0);
}
export async function npcIndustryDevelopmentForDay(db,site,now){
 const date=new Date(now).toISOString().slice(0,10);
 const [rows]=await db.execute(`
 SELECT f.id,SUM(sh.quantity) AS operations
 FROM world_npc_cargo_shipments sh
 JOIN world_npc_cargo_routes r ON r.id=sh.route_id AND r.settlement_id=sh.settlement_id
 JOIN world_industry_facilities f ON f.id=sh.facility_id AND f.id=r.facility_id
 WHERE sh.settlement_id=? AND f.owner_faction_id=?
 AND f.status='operational' AND f.cycle_mode='automatic'
 AND r.enabled=1 AND sh.status='delivered'
 AND DATE(sh.delivered_at)=DATE_SUB(?,INTERVAL 1 DAY)
 GROUP BY f.id`,[site.id,site.controlling_faction_id,date]);
 return {date,facilities:rows,earned:npcIndustryDevelopment(rows)};
}
