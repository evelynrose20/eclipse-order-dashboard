// Template-backed civic infrastructure. Existing legacy upgrades retain their original effects.
export const CIVIC_EFFECT_KEYS={
 housing:'housing_capacity',defense:'defense',clinic:'medical_access',water:'water_daily',
 food_storage:'food_capacity',insulation:'insulation',public_works:'public_works',school:'school_places'
};
const safe=(n)=>Math.max(0,Math.floor(Number(n)||0));
const json=v=>typeof v==='string'?JSON.parse(v):v;
export function validateCivicTemplate(t){
 if(!t||typeof t.name!=='string'||!t.name.trim()||t.name.length>120||
    typeof t.description!=='string'||t.description.length>400||!(t.category in CIVIC_EFFECT_KEYS)||
    t.effect_key!==CIVIC_EFFECT_KEYS[t.category]||
    !Number.isInteger(t.effect_per_level)||t.effect_per_level<1||t.effect_per_level>100000||
    !Number.isInteger(t.material_per_level)||t.material_per_level<1||t.material_per_level>10000||
    !Number.isInteger(t.npc_development_cost)||t.npc_development_cost<1||t.npc_development_cost>10000||
    !Number.isInteger(t.construction_labor)||t.construction_labor<10||t.construction_labor>100000||
    !Number.isInteger(t.max_level)||t.max_level<1||t.max_level>10||
    typeof t.material_id!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(t.material_id)||
    typeof t.enabled!=='boolean')return 'invalid_civic_template';
 return null;
}
export function civicTemplateEffect(upgrade){
 if(!upgrade?.template_id)return null;
 const snap=json(upgrade.effect_snapshot)||{};
 if(!Object.values(CIVIC_EFFECT_KEYS).includes(snap.key)||!Number.isInteger(Number(snap.per_level)))return null;
 const condition=Math.min(100,safe(upgrade.condition_pct));
 const factor=upgrade.status==='operational'?condition/100:upgrade.status==='damaged'?condition/200:0;
 return {key:snap.key,quantity:Math.floor(safe(snap.per_level)*Math.max(1,safe(upgrade.level))*factor)};
}
export function civicInfrastructureEffects(upgrades=[]){
 const result={housing_capacity:0,defense:0,medical_access:0,water_daily:0,food_capacity:0,insulation:0,public_works:0,school_places:0,water_storage:0};
 for(const upgrade of upgrades){
  const effect=civicTemplateEffect(upgrade);
  if(effect)result[effect.key]+=effect.quantity;
 }
 // Waterworks also supply room to store three cycles of their output.
 result.water_storage=result.water_daily*3;
 return result;
}
export function civilianStorageCapacity(settlement,upgrades=[]){
 const population=safe(settlement.population);
 const bonus=civicInfrastructureEffects(upgrades);
 // Existing stores are grandfathered; the caps only constrain new deposits.
 return {food:Math.max(100,population*12)+bonus.food_capacity,
         water:Math.max(100,population*12)+bonus.water_storage};
}
export function npcConstructionPreference(settlement,upgrades=[],stocks={}){
 const effects=civicInfrastructureEffects(upgrades);
 const population=safe(settlement.population);
 const housing=safe(settlement.housing_capacity)+effects.housing_capacity+
   upgrades.filter(u=>!u.template_id&&u.category==='housing'&&u.status==='operational').reduce((n,u)=>n+safe(u.housing_bonus),0);
 const reserve=Number(stocks.food_units||0);
 const capacity=civilianStorageCapacity(settlement,upgrades);
 const built=id=>upgrades.some(u=>u.category===id&&u.status==='operational');
 if(housing<=population+Math.max(2,Math.floor(population*.12)))return 'housing';
 if(reserve>=capacity.food*.75)return 'food_storage';
 if(Number(stocks.water_units||0)<population*5||Number(settlement.water_access??50)<65)return 'water';
 if(Number(settlement.medical_access||50)+effects.medical_access<65)return 'clinic';
 if(!built('school')&&population>=15)return 'school';
 if(Number(settlement.security_score||50)+effects.defense<55)return 'defense';
 if(Number(settlement.insulation||50)+effects.insulation<50)return 'insulation';
 return null;
}
export function civicProjectCost(template,targetLevel){
 const level=Math.max(1,safe(targetLevel));
 return {material_id:template.material_id,material_required:safe(template.material_per_level)*level,
  labor_required:safe(template.construction_labor)*level,
  npc_development_cost:safe(template.npc_development_cost)*level};
}
export function waterworksProduction(upgrades=[],workers=0){
 const capacity=civicInfrastructureEffects(upgrades).water_daily;
 return Math.min(capacity,Math.floor(Math.max(0,workers)*2));
}
