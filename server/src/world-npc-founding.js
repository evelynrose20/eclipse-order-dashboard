import {settlementDemographics,cappedEmployment} from './world-demographics.js';
import {housingCapacity} from './world-settlement-upgrades.js';

/** Establish the real starting conditions of a newly simulated NPC settlement.
 * It happens at most once per settlement (recorded under a unique primary key),
 * never repeats on pause/resume, and leaves existing infrastructure untouched.
 */
export async function establishNpcSettlement(db,site,state){
 if(!site.controlling_faction_id||site.controlling_faction_id==='eclipse-order')return {founded:false,reason:'not_npc'};
 const [[existing]]=await db.execute('SELECT settlement_id FROM world_npc_settlement_foundings WHERE settlement_id=? FOR UPDATE',[site.id]);
 if(existing)return {founded:false,reason:'already_founded'};
 const [upgrades]=await db.execute('SELECT * FROM world_settlement_upgrades WHERE settlement_id=?',[site.id]);
 const [[facilities]]=await db.execute('SELECT COUNT(*) AS n FROM world_industry_facilities WHERE settlement_id=?',[site.id]);
 const [[past]]=await db.execute('SELECT COUNT(*) AS n FROM world_settlement_sim_history WHERE settlement_id=?',[site.id]);
 const virgin=Number(past.n)===0||(Number(site.population)===0&&Number(facilities.n)===0&&upgrades.length===0);
 let population=Number(site.population)||0;
 let housingId=null,facilityId=null;
 // Only unused or underdeveloped locations receive a founding package.
 if(virgin&&housingCapacity(site,upgrades)<Math.max(10,population)){
  const [[housing]]=await db.execute("SELECT * FROM world_civic_building_templates WHERE category='housing' AND enabled=1 ORDER BY npc_development_cost/effect_per_level,id LIMIT 1");
  if(housing){
   const [placed]=await db.execute("INSERT INTO world_settlement_upgrades(settlement_id,name,category,status,condition_pct,level,housing_bonus,service_bonus,defense_bonus,notes,material_id,material_cost,construction_progress,created_by,template_id,effect_snapshot,template_revision) VALUES(?,?,'housing','operational',100,1,0,0,0,'Founding dwellings; one-time inherited infrastructure',NULL,0,100,NULL,?,?,?)",[site.id,housing.name,housing.id,JSON.stringify({key:housing.effect_key,per_level:Number(housing.effect_per_level)}),housing.revision]);
   housingId=placed.insertId;
  }
 }
 // Farms must be assigned to an existing mapped farm marker by the NPC settlement owner.
 // No invisible or off-map industrial facility is created as a founding grant.
 if(virgin&&population===0&&(housingCapacity(site,upgrades)>0||housingId)){
  population=8;
  const employment=cappedEmployment({...site,population},Math.floor(settlementDemographics({...site,population,workforce:8}).eligible_workers*.8));
  await db.execute('UPDATE world_settlements SET population=?,workforce=? WHERE id=?',[population,employment,site.id]);
  await db.execute('UPDATE world_settlement_autosim SET food_units=GREATEST(food_units,48),water_units=GREATEST(water_units,56),fuel_units=GREATEST(fuel_units,40),medicine_units=GREATEST(medicine_units,3) WHERE settlement_id=?',[site.id]);
 }
 await db.execute('INSERT INTO world_npc_settlement_foundings(settlement_id,founding_population,starter_housing_id,starter_facility_id) VALUES(?,?,?,?)',[site.id,virgin?population:0,housingId,facilityId]);
 return {founded:true,population,starter_housing_id:housingId,starter_facility_id:facilityId};
}
