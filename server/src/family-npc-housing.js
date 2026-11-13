import {housingCapacity,upgradeEffects} from './world-settlement-upgrades.js';

// This is a named occupant of the existing population, not a new population unit.
// Reserve only truly vacant settlement housing and an actual operating housing building.
export function selectNpcHome(site,buildings=[],occupied=new Map(),reserved=0){
 const surplus=Math.max(0,housingCapacity(site,buildings)-Number(site.population||0)-reserved);
 if(!surplus)return null;
 const eligible=buildings.filter(b=>b.category==='housing'&&b.status==='operational')
  .map(b=>({id:Number(b.id),slots:upgradeEffects([b]).housing_bonus-Number(occupied.get(Number(b.id))||0)}))
  .filter(b=>b.slots>0).sort((a,b)=>b.slots-a.slots||a.id-b.id);
 return eligible[0]?.id||null;
}
export async function findNpcHousing(db,settlementId,civilianId){
 const [[site]]=await db.execute('SELECT id,population,housing_capacity FROM world_settlements WHERE id=? FOR UPDATE',[settlementId]);
 if(!site)return {assigned:false,reason:'settlement_not_found'};
 const [buildings]=await db.execute("SELECT * FROM world_settlement_upgrades WHERE settlement_id=? AND category='housing' ORDER BY id FOR UPDATE",[settlementId]);
 const [homes]=await db.execute(`SELECT nc.housing_upgrade_id,COUNT(*) AS residents
   FROM world_named_civilians nc JOIN order_dependents d ON d.id=nc.dependent_id
   WHERE nc.settlement_id=? AND nc.housing_upgrade_id IS NOT NULL
   AND (CASE WHEN d.birth_date IS NOT NULL AND d.birth_date<=UTC_DATE()
     THEN TIMESTAMPDIFF(YEAR,d.birth_date,UTC_DATE())
     ELSE 18+TIMESTAMPDIFF(YEAR,DATE(nc.transitioned_at),UTC_DATE()) END)<350
   GROUP BY nc.housing_upgrade_id`,[settlementId]);
 const occupied=new Map(homes.map(h=>[Number(h.housing_upgrade_id),Number(h.residents)]));
 const reserved=homes.reduce((n,h)=>n+Number(h.residents),0);
 const houseId=selectNpcHome(site,buildings,occupied,reserved);
 if(!houseId)return {assigned:false,reason:'no_vacant_housing'};
 const [result]=await db.execute('UPDATE world_named_civilians SET housing_upgrade_id=? WHERE id=? AND settlement_id=? AND housing_upgrade_id IS NULL',[houseId,civilianId,settlementId]);
 return {assigned:result.affectedRows>0,housing_upgrade_id:houseId};
}
export const NAMED_NPC_MAX_AGE=350;
export function namedNpcAge(birthDate,transitioned,at=new Date()){
 const parsed=typeof birthDate==='string'?birthDate.slice(0,10):birthDate instanceof Date?birthDate.toISOString().slice(0,10):null;
 const origin=parsed&&new Date(parsed+'T00:00:00Z')<=at?new Date(parsed+'T00:00:00Z'):null;
 const anchor=origin||new Date(transitioned);
 if(!Number.isFinite(anchor.getTime()))return 18;
 let years=at.getUTCFullYear()-anchor.getUTCFullYear();
 if(at.getUTCMonth()<anchor.getUTCMonth()||(at.getUTCMonth()===anchor.getUTCMonth()&&at.getUTCDate()<anchor.getUTCDate()))years--;
 return Math.max(origin?18:18,years+(origin?0:18));
}
export function namedNpcAlive(age){return age<NAMED_NPC_MAX_AGE}

export async function settleUnhousedNamedCivilians(db,settlementId,limit=20){
 const [pending]=await db.execute(`SELECT nc.id,nc.housing_upgrade_id,nc.employment_state,d.birth_date,nc.transitioned_at FROM world_named_civilians nc
  JOIN order_dependents d ON d.id=nc.dependent_id
  WHERE nc.settlement_id=? AND (nc.housing_upgrade_id IS NULL OR nc.employment_state IN ('seeking','between_jobs'))
  ORDER BY nc.id LIMIT ?`,[settlementId,limit]);
 let assigned=0;
 for(const npc of pending){
  if(!namedNpcAlive(namedNpcAge(npc.birth_date,npc.transitioned_at)))continue;
  if(!npc.housing_upgrade_id){
   const home=await findNpcHousing(db,settlementId,npc.id);
   if(home.assigned)assigned++;
  }
  if(['seeking','between_jobs'].includes(npc.employment_state))await findNpcEmployment(db,settlementId,npc.id);
 }
 return assigned;
}

export async function findNpcEmployment(db,settlementId,civilianId){
 const [[site]]=await db.execute('SELECT id,workforce FROM world_settlements WHERE id=? FOR UPDATE',[settlementId]);
 if(!site||Number(site.workforce)<1)return {employed:false,reason:'no_local_workforce'};
 const [workers]=await db.execute(`SELECT nc.workplace_facility_id,COUNT(*) AS workers
   FROM world_named_civilians nc JOIN order_dependents d ON d.id=nc.dependent_id
   WHERE nc.settlement_id=? AND nc.employment_state='employed'
   AND (CASE WHEN d.birth_date IS NOT NULL AND d.birth_date<=UTC_DATE()
     THEN TIMESTAMPDIFF(YEAR,d.birth_date,UTC_DATE())
     ELSE 18+TIMESTAMPDIFF(YEAR,DATE(nc.transitioned_at),UTC_DATE()) END)<350
   GROUP BY nc.workplace_facility_id`,[settlementId]);
 const total=workers.reduce((n,w)=>n+Number(w.workers),0);
 if(total>=Number(site.workforce))return {employed:false,reason:'no_existing_worker_slots'};
 const employedByFacility=new Map(workers.map(w=>[Number(w.workplace_facility_id),Number(w.workers)]));
 const [facilities]=await db.execute(`SELECT id,workforce FROM world_industry_facilities
   WHERE settlement_id=? AND status='operational' AND workforce>0 ORDER BY id FOR UPDATE`,[settlementId]);
 const match=facilities.find(f=>(employedByFacility.get(Number(f.id))||0)<Number(f.workforce));
 if(!match)return {employed:false,reason:'no_operational_job'};
 const [saved]=await db.execute(`UPDATE world_named_civilians SET employment_state='employed',
  workplace_facility_id=? WHERE id=? AND settlement_id=? AND employment_state IN ('seeking','between_jobs')`,
  [match.id,civilianId,settlementId]);
 return {employed:saved.affectedRows>0,workplace_facility_id:match.id};
}
