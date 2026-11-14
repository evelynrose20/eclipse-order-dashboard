import {housingCapacity} from './world-settlement-upgrades.js';
// Read-only recovery dossier. Every row links to an existing authoritative project;
// nothing here grants free stock, workforce, levels or territorial control.
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const number=n=>Number(n||0);
export function rebuildingAssessment(report){
 const {settlement,buildings,industry,power,warehouses,civicProjects,industryProjects,powerProjects}=report;
 const active=[...civicProjects,...industryProjects,...powerProjects].filter(p=>['active','paused','planned'].includes(p.status));
 const damagedCivic=buildings.filter(b=>['damaged','destroyed'].includes(b.status)||['operational','damaged'].includes(b.status)&&number(b.condition_pct)<100);
 const damagedIndustry=industry.filter(f=>['damaged','ruined','captured','rebuilding'].includes(f.status)||number(f.equipment_condition)<100);
 const damagedPower=power.filter(p=>number(p.condition_pct)<100||['damaged','destroyed'].includes(p.status));
 const blockedPower=power.filter(p=>number(p.fuel_units)<=0||['paused','destroyed'].includes(p.status));
 const unfinishedWarehouses=warehouses.filter(w=>w.state!=='operational');
 const risks=[
  ...(!settlement.controlling_faction_id?['No controlling faction: recover ownership before Order construction']:settlement.controlling_faction_id!=='eclipse-order'?['Not Order-controlled: Order construction is restricted']:[]),
  ...damagedCivic.length?[damagedCivic.length+' civic buildings require attention']:[],
  ...damagedIndustry.length?[damagedIndustry.length+' industrial facilities require attention']:[],
  ...damagedPower.length?[damagedPower.length+' generators need repair or replacement']:[],
  ...blockedPower.length?[blockedPower.length+' generators have no fuel or cannot operate']:[],
  ...unfinishedWarehouses.length?[unfinishedWarehouses.length+' warehouses are not operational']:[],
  ...active.length?[active.length+' construction projects are unfinished']:[],
  ...(number(settlement.population)>0&&number(report.housingCapacity)<number(settlement.population)?['Residents exceed effective housing capacity']:[])
 ];
 const projectProgress=active.length?Math.round(active.reduce((n,p)=>n+Math.min(1,number(p.progress)/Math.max(1,number(p.labor_required))),0)/active.length*100):100;
 return {activeProjects:active.length,damagedCivic:damagedCivic.length,damagedIndustry:damagedIndustry.length,damagedPower:damagedPower.length,blockedPower:blockedPower.length,unfinishedWarehouses:unfinishedWarehouses.length,projectProgress,risks,
  operationallyReady:risks.length===0,territorialState:settlement.strategic_state,
  // A read-only readiness assessment is not a license to change a settlement's story condition.
  completionMessage:risks.length?'Outstanding recovery work requires attention.':'No tracked blockers found. Command may review territorial status separately.'};
}
export async function rebuildingDossier(pool,id){
 if(!Number.isSafeInteger(id)||id<1)return fail(400,'invalid_settlement');
 const [[settlement]]=await pool.execute('SELECT id,name,region_id,zone_id,controlling_faction_id,strategic_state,population,workforce,unrest,civil_stability,housing_capacity FROM world_settlements WHERE id=?',[id]);
 if(!settlement)return fail(404,'settlement_not_found');
 const [buildings]=await pool.execute('SELECT * FROM world_settlement_upgrades WHERE settlement_id=? ORDER BY category,name,id',[id]);
 const [civicProjects]=await pool.execute("SELECT p.id,p.upgrade_id,p.project_kind,p.status,p.owner_kind,p.progress,p.labor_required,p.materials_paid,p.target_level,b.name AS building_name FROM world_civic_building_projects p LEFT JOIN world_settlement_upgrades b ON b.id=p.upgrade_id WHERE p.settlement_id=? ORDER BY p.id DESC",[id]);
 const [civicNeeds]=await pool.execute('SELECT n.project_id,n.material_id,m.name AS material_name,n.required_qty,n.committed_qty,COALESCE(stock.quantity,0) AS available_qty FROM world_civic_project_needs n JOIN world_civic_building_projects p ON p.id=n.project_id LEFT JOIN fc_materials m ON m.id=n.material_id LEFT JOIN fc_material_stock stock ON stock.material_id=n.material_id WHERE p.settlement_id=? ORDER BY n.project_id,n.material_id',[id]);
 const [industry]=await pool.execute('SELECT id,name,status,equipment_condition,level,workforce,template_id,site_id FROM world_industry_facilities WHERE settlement_id=? ORDER BY name,id',[id]);
 const [industryProjects]=await pool.execute('SELECT p.id,p.facility_id,p.name,p.status,p.labor_done AS progress,p.labor_required,f.name AS facility_name FROM world_industry_projects p JOIN world_industry_facilities f ON f.id=p.facility_id WHERE f.settlement_id=? ORDER BY p.id DESC',[id]);
 const [industryNeeds]=await pool.execute('SELECT n.project_id,n.item_id,i.name AS material_name,n.required_qty,n.committed_qty FROM world_industry_project_needs n JOIN world_industry_projects p ON p.id=n.project_id JOIN world_industry_facilities f ON f.id=p.facility_id LEFT JOIN world_industry_items i ON i.id=n.item_id WHERE f.settlement_id=?',[id]);
 const [power]=await pool.execute('SELECT id,name,model,level,status,condition_pct,fuel_units,fuel_per_day,rated_output FROM world_power_plants WHERE settlement_id=? ORDER BY name,id',[id]);
 const [powerProjects]=await pool.execute("SELECT p.id,p.plant_id,p.action,p.status,p.progress,p.labor_required,p.iron_required,p.iron_committed,p.timber_required,p.timber_committed,b.name AS blueprint_name FROM world_power_projects p JOIN world_power_blueprints b ON b.id=p.blueprint_id WHERE p.settlement_id=? ORDER BY p.id DESC",[id]);
 const [warehouses]=await pool.execute('SELECT id,name,state,tier,capacity_units,construction_item_id,construction_quantity FROM world_logistics_warehouses WHERE settlement_id=? ORDER BY name,id',[id]);
 const effectiveHousing=housingCapacity(settlement,buildings);
 const output={settlement,buildings,industry,power,warehouses,
  civicProjects:civicProjects.map(p=>({...p,needs:civicNeeds.filter(n=>number(n.project_id)===number(p.id))})),
  industryProjects:industryProjects.map(p=>({...p,needs:industryNeeds.filter(n=>number(n.project_id)===number(p.id))})),
  powerProjects,housingCapacity:effectiveHousing};
 return ok({...output,assessment:rebuildingAssessment(output)});
}
export async function worldRebuildingRoute(pool,req,path,actor){
 if(!['domina','high_command'].includes(actor.account_role))return fail(403,'command_required');
 const m=/^\/world-admin\/settlements\/(\d+)\/rebuilding$/.exec(path);
 if(!m)return fail(404,'not_found');
 if(req.method!=='GET')return fail(405,'method_not_allowed');
 return rebuildingDossier(pool,Number(m[1]));
}
