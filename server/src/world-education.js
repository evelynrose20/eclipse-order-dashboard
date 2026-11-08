import {settlementDemographics} from './world-demographics.js';

const bounded=n=>Math.min(100,Math.max(0,Math.floor(Number(n)||0)));
/** School places are supplied by completed, maintained civic school structures. */
export function schoolCapacity(upgrades=[]){
 return upgrades.reduce((sum,u)=>{
  if(u.category!=='school'||u.status!=='operational')return sum;
  return sum+Math.floor(25*Math.max(1,Number(u.level)||1)*bounded(u.condition_pct)/100);
 },0);
}
export function educationPreview(settlement,upgrades=[],state={}){
 const d=settlementDemographics(settlement);
 const seats=schoolCapacity(upgrades);
 const schoolAge=d.children+d.youth;
 const enrolled=Math.min(seats,schoolAge);
 const access=schoolAge?Math.round(enrolled/schoolAge*100):100;
 const attainment=bounded(state.attainment??20);
 // Slow progress, only if school-age children actually attend maintained schools.
 const gain=enrolled?Math.min(2,Math.max(0,Math.floor(enrolled/Math.max(1,schoolAge)*3))):0;
 const newAttainment=Math.min(100,attainment+gain);
 const trainedWorkers=Math.min(d.employed,Math.floor(d.employed*newAttainment/100));
 return {school_seats:seats,school_age_residents:schoolAge,enrolled,unplaced:Math.max(0,schoolAge-enrolled),
  school_access_pct:access,attainment:newAttainment,attainment_before:attainment,
  attainment_gained:gain,trained_workers:trainedWorkers,untrained_workers:d.employed-trainedWorkers};
}
export async function advanceEducation(db,settlement,upgrades=[]){
 await db.execute('INSERT IGNORE INTO world_settlement_education(settlement_id,attainment) VALUES(?,20)',[settlement.id]);
 const [[state]]=await db.execute('SELECT attainment FROM world_settlement_education WHERE settlement_id=? FOR UPDATE',[settlement.id]);
 const preview=educationPreview(settlement,upgrades,state);
 await db.execute('UPDATE world_settlement_education SET attainment=? WHERE settlement_id=?',[preview.attainment,settlement.id]);
 return preview;
}
