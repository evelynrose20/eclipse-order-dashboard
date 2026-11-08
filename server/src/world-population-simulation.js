import {housingCapacity} from './world-settlement-upgrades.js';
const asInt=(v)=>Math.max(0,Math.floor(Number(v)||0));
const clamp=(v)=>Math.max(0,Math.min(100,Math.round(Number(v)||0)));

/**
 * Cohorts are computed from the authoritative settlement population.
 * They are not separately edited, cannot exceed population, and have no independent stock.
 */
export function simulatedPopulationGroups(settlement){
 const population=asInt(settlement.population);
 const employed=Math.min(population,asInt(settlement.workforce));
 return [
  {key:'employed',label:'Employed residents',residents:employed,employed,kind:'simulated'},
  {key:'other',label:'Other residents',residents:population-employed,employed:0,kind:'simulated'}
 ];
}
/**
 * No uncontrolled births or arrivals: population changes only on explicitly committed
 * managed civic cycles. Empty sites need finished housing before residents can arrive.
 */
export function previewPopulationChange(settlement,upgrades=[],risk=0,enabled=false){
 const population=asInt(settlement.population);
 const capacity=housingCapacity(settlement,upgrades);
 const vacancies=Math.max(0,capacity-population);
 // No change in off/narrative modes, without housing, or under severe civic stress.
 const desirable=enabled&&vacancies>0&&clamp(risk)<75;
 // Slow growth; small settlements can gain one resident per approved cycle.
 const arrivals=desirable?Math.min(vacancies,Math.max(1,Math.floor(population*0.01))):0;
 const next=population+arrivals;
 // Preserve the prior employment proportion; don't generate new jobs.
 const employed=Math.min(asInt(settlement.workforce),next);
 return {population_before:population,population_after:next,arrivals,housing_capacity:capacity,vacancies,workforce_after:employed,groups:simulatedPopulationGroups({...settlement,population:next,workforce:employed})};
}
