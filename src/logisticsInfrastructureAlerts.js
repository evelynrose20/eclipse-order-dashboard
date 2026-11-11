// Order supply readiness is independent of automated civilian simulation.
// A holding can house player characters even when its simulated NPC population is zero.
const known=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
const below=(value,minimum)=>known(value)&&Number(value)<minimum;
const shortage=(label)=>label+' shortfall';

export const infrastructureAlerts=site=>{
 if(site?.controlling_faction_id!=='eclipse-order')return [];
 const c=site.civic_summary;
 if(!c)return [];
 const issues=[];
 // Stock and working production are observable without inventing residents or consuming goods.
 if(known(c.food_stock)&&Number(c.food_stock)<=0||below(c.food_days,7))
  issues.push(shortage('Food supplies'));
 if(below(c.heating_coverage,75))
  issues.push(shortage('Heating coverage'));
 if(known(c.fuel_stock)&&Number(c.fuel_stock)<=0||below(c.heat_days,7))
  issues.push(shortage('Heating fuel'));
 if(known(c.water_stock)&&known(c.waterworks_generated)&&Number(c.water_stock)<=0&&Number(c.waterworks_generated)<=0)
  issues.push(shortage('Clean water'));
 if(known(c.medicine_stock)&&Number(c.medicine_stock)<=0)
  issues.push(shortage('Medical supplies'));
 return issues;
};

const descriptions={
 food_reserve_low:'Food supplies shortfall',
 heating_shortfall:'Heating coverage shortfall',
 heating_infrastructure_low:'Heating coverage shortfall',
 water_shortfall:'Clean water shortfall',
 medicine_shortfall:'Medical supplies shortfall',
 limited_diet_variety:'Food variety shortfall'
};
export const supplyAlerts=site=>{
 const warnings=Array.isArray(site?.civic_summary?.warnings)?site.civic_summary.warnings:[];
 const labels=warnings.map(code=>descriptions[code]||String(code).replaceAll('_',' '));
 return [...new Set([...infrastructureAlerts(site),...labels])];
};
export const supplyRisk=site=>{
 const c=site?.civic_summary||{};
 if(['destroyed','abandoned'].includes(site?.strategic_state))return 'lost';
 if(supplyAlerts(site).length||Number(c.unrest_risk||0)>=45)return 'alert';
 return 'stable';
};
