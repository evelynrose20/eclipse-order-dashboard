/**
 * Deterministic demographic estimates for settlements without individual resident records.
 * Buckets always sum to the authoritative population. They are estimates, not editable
 * population stocks, and do not generate people or jobs.
 */
const nonnegative=x=>Math.max(0,Math.floor(Number(x)||0));
export function settlementDemographics(settlement){
 const population=nonnegative(settlement.population);
 const children=Math.floor(population*.18);
 const youth=Math.floor(population*.05);
 const elderly=Math.floor(population*.13);
 const adults=population-children-youth-elderly;
 const unableToWork=Math.floor(adults*.08);
 // Youth apprenticeships are deliberately excluded from industrial labor;
 // elderly participation is similarly opt-in only in a future job system.
 const eligibleWorkers=adults-unableToWork;
 const employed=Math.min(eligibleWorkers,nonnegative(settlement.workforce));
 return {population,children,youth,adults,elderly,unable_to_work:unableToWork,
  eligible_workers:eligibleWorkers,employed,unemployed:eligibleWorkers-employed,
  dependents:population-eligibleWorkers,participation_basis:'estimated'};
}
export function cappedEmployment(settlement,proposed){
 return Math.min(settlementDemographics(settlement).eligible_workers,nonnegative(proposed));
}
