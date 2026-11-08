import {upgradeEffects} from './world-settlement-upgrades.js';
import {settlementDemographics} from './world-demographics.js';
import {workerHealthCycle} from './world-worker-hazards.js';
import {educationPreview} from './world-education.js';

export async function workerHealthSnapshot(db,settlementId){
 const [[health]]=await db.execute('SELECT sick_workers,injured_workers FROM world_settlement_worker_health WHERE settlement_id=?',[settlementId]);
 return {sick_workers:Number(health?.sick_workers||0),injured_workers:Number(health?.injured_workers||0)};
}
export async function advanceWorkerHealth(db,settlement,upgrades,education,options){
 const cycleKey=String(options.cycle_key);
 await db.execute('INSERT IGNORE INTO world_settlement_worker_health(settlement_id) VALUES(?)',[settlement.id]);
 const [[prior]]=await db.execute('SELECT * FROM world_settlement_worker_health WHERE settlement_id=? FOR UPDATE',[settlement.id]);
 if(prior.last_care_cycle===cycleKey)return {...await workerHealthSnapshot(db,settlement.id),already_processed:true,medicine_required:0};
 const d=settlementDemographics(settlement);
 const clinics=upgrades.filter(x=>x.category==='clinic'&&x.status==='operational').length;
 // Existing NPC civilian medical service can stand in for a completed hospital.
 const effects=upgradeEffects(upgrades);
 const effectiveMedicalAccess=Math.min(100,Math.max(0,Number(settlement.medical_access||0)+Number(effects.service_by_category.clinic||0)+Number(effects.infrastructure.medical_access||0)));
 const clinic_count=clinics||(effectiveMedicalAccess>=65?1:0);
 const state=education||educationPreview(settlement,upgrades);
 const outcome=workerHealthCycle({
  ...prior,population:settlement.population,employed:d.employed,temperature_f:options.temperature_f,
  heating_coverage:options.heating_coverage??settlement.heating_coverage,
  medical_access:effectiveMedicalAccess,clinic_count,trained_workers:state.trained_workers,
  medicine_units:options.medicine_available,weather:options.weather
 });
 await db.execute('UPDATE world_settlement_worker_health SET sick_workers=?,injured_workers=?,last_care_cycle=?,last_illness_cycle=? WHERE settlement_id=?',[outcome.sick_workers,outcome.injured_workers,cycleKey,cycleKey,settlement.id]);
 return outcome;
}
