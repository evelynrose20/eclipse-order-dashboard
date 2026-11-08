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
 SELECT f.id,MAX(c.operations) AS operations
 FROM world_industry_facilities f
 JOIN world_industry_cycles c ON c.facility_id=f.id
 WHERE f.settlement_id=? AND f.owner_faction_id=?
 AND f.status='operational' AND f.cycle_mode<>'off'
 AND c.cycle_date=DATE_SUB(?,INTERVAL 1 DAY)
 AND c.operations>0
 GROUP BY f.id`,[site.id,site.controlling_faction_id,date]);
 return {date,facilities:rows,earned:npcIndustryDevelopment(rows)};
}
