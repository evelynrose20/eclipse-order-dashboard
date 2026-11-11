// Command-level readiness is independent of resident simulation.
// Never use zero simulated NPCs as proof that an Order holding needs no services.
export const infrastructureAlerts=site=>{
 if(site?.controlling_faction_id!=='eclipse-order')return [];
 const c=site.civic_summary;
 if(!c)return [];
 const issues=[];
 if(c.heating_coverage!=null&&Number(c.heating_coverage)<75)
  issues.push('Heating infrastructure below 75%');
 if(c.water_stock!=null&&c.waterworks_generated!=null&&Number(c.water_stock)<=0&&Number(c.waterworks_generated)<=0)
  issues.push('No clean water in storage or production');
 return issues;
};
export const supplyAlerts=site=>[...(Array.isArray(site?.civic_summary?.warnings)?site.civic_summary.warnings.map(s=>String(s).replaceAll('_',' ')):[]),...infrastructureAlerts(site)];
export const supplyRisk=site=>{
 const c=site?.civic_summary||{};
 if(['destroyed','abandoned'].includes(site?.strategic_state))return 'lost';
 if(supplyAlerts(site).length||Number(c.unrest_risk||0)>=45)return 'alert';
 if(c.food_days!=null&&Number(c.food_days)<7||c.heat_days!=null&&Number(c.heat_days)<7)return 'alert';
 return 'stable';
};
