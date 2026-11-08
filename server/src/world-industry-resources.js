// Authoritative staffing and utility calculation for production. No staff-supplied
// facility workforce, heat or power number can become production capacity.
export const industryNeed=config=>({
 workforce:Math.max(0,Math.ceil(Number(config.labor)||0)),
 power:Math.max(0,Math.ceil(Number(config.power)||0)),
 heat:Math.max(0,Math.ceil(Number(config.heat)||0))
});
export function allocateLabor(workforce,facilities){
 let remaining=Math.max(0,Math.floor(Number(workforce)||0));
 const grants=new Map();
 for(const f of [...facilities].sort((a,b)=>Number(a.id)-Number(b.id))){
  const needed=Math.min(1000,Math.max(1,Math.ceil(Number(f.labor)||0))*Math.max(1,Math.floor(Number(f.capacity)||1)));
  const workers=Math.min(remaining,needed);
  grants.set(Number(f.id),workers);
  remaining-=workers;
 }
 return grants;
}
export function derivedFacilityResources(facility,configuration,labor,power,heat){
 const needs=industryNeed(configuration);
 return {
  ...facility,
  workforce:Math.max(0,Math.floor(Number(labor)||0)),
  power_available:Math.max(0,Number(power)||0),
  heat_available:Math.max(0,Number(heat)||0),
  requirements:needs
 };
}
