import {validateTerritoryPolygon} from './world-continent.js';

const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const PROVINCE_TERRAINS=['plains','forest','hills','mountains','urban','coast','marsh','desert','tundra'];
export const INFRASTRUCTURE_TYPES=['roads','rail','fortifications','power'];
const id=n=>Number.isSafeInteger(n)&&n>0;
const validProvince=b=>b&&id(Number(b.zone_id))&&typeof b.name==='string'&&b.name.trim().length>0&&b.name.length<=140&&PROVINCE_TERRAINS.includes(b.terrain)&&(b.polygon===null||!validateTerritoryPolygon(b.polygon));
async function body(req){let n=0,parts=[];for await(const chunk of req){n+=chunk.length;if(n>18000)return null;parts.push(chunk)}try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{return null}}
export async function strategicProvinceSummary(pool){
 const [provinces]=await pool.execute(`SELECT p.id,p.zone_id,p.name,p.terrain,p.polygon,
  COALESCE(i.roads,0) AS roads,COALESCE(i.rail,0) AS rail,
  COALESCE(i.fortifications,0) AS fortifications,COALESCE(i.power,0) AS power,
  z.controlling_faction_id,z.governing_faction_id,z.strategic_state,z.region_id
  FROM world_strategic_provinces p JOIN world_zones z ON z.id=p.zone_id
  LEFT JOIN world_strategic_province_infrastructure i ON i.province_id=p.id
  ORDER BY z.region_id,p.zone_id,p.id`);
 return provinces.map(p=>({...p,polygon:typeof p.polygon==='string'?JSON.parse(p.polygon):p.polygon}));
}
export async function strategicProvinceRoute(pool,req,path,actor){
 if(!['domina','high_command'].includes(actor?.account_role))return fail(403,'command_required');
 if(req.method==='POST'&&path==='/world-admin/provinces'){
  const b=await body(req);if(!validProvince(b))return fail(400,'invalid_province');
  const db=await pool.getConnection();
  try{
   await db.beginTransaction();
   const [[zone]]=await db.execute('SELECT id FROM world_zones WHERE id=? FOR UPDATE',[b.zone_id]);
   if(!zone){await db.rollback();return fail(404,'zone_not_found')}
   const [created]=await db.execute('INSERT INTO world_strategic_provinces(zone_id,name,terrain,polygon,created_by) VALUES(?,?,?,?,?)',[b.zone_id,b.name.trim(),b.terrain,b.polygon===null?null:JSON.stringify(b.polygon),actor.id]);
   await db.execute('INSERT INTO world_strategic_province_infrastructure(province_id) VALUES(?)',[created.insertId]);
   await db.execute('INSERT INTO world_administration_audit(actor_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',[actor.id,'province_create','province',created.insertId,b.name.trim().slice(0,140)]);
   await db.commit();return ok({id:created.insertId});
  }catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}
 }
 const m=/^\/world-admin\/provinces\/(\d+)$/.exec(path);
 if(m&&req.method==='PUT'){
  const b=await body(req);if(!validProvince(b))return fail(400,'invalid_province');
  const db=await pool.getConnection();
  try{
   await db.beginTransaction();
   const [[existing]]=await db.execute('SELECT id,zone_id FROM world_strategic_provinces WHERE id=? FOR UPDATE',[Number(m[1])]);
   if(!existing){await db.rollback();return fail(404,'province_not_found')}
   if(Number(existing.zone_id)!==Number(b.zone_id)){await db.rollback();return fail(409,'province_cannot_change_zone')}
   await db.execute('UPDATE world_strategic_provinces SET name=?,terrain=?,polygon=? WHERE id=?',[b.name.trim(),b.terrain,b.polygon===null?null:JSON.stringify(b.polygon),Number(m[1])]);
   await db.execute('INSERT INTO world_administration_audit(actor_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',[actor.id,'province_update','province',Number(m[1]),b.name.trim().slice(0,140)]);
   await db.commit();return ok({saved:true});
  }catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}
 }
 return fail(404,'province_route_not_found');
}

// NPCs buy one provincial infrastructure upgrade using actual development points
// earned by their existing operational, shared-blueprint city/industry economy.
// Nothing is minted and Order-only blueprints are never considered.
export function provinceUpgradeChoice(infra){
 const entries=INFRASTRUCTURE_TYPES.map(type=>({type,level:Number(infra[type]||0)})).filter(x=>x.level<5);
 entries.sort((a,b)=>a.level-b.level||INFRASTRUCTURE_TYPES.indexOf(a.type)-INFRASTRUCTURE_TYPES.indexOf(b.type));
 return entries[0]||null;
}
export const provinceUpgradeCost=(kind,level)=>INFRASTRUCTURE_TYPES.includes(kind)&&Number.isInteger(level)&&level>=0&&level<5?(level+1)*(kind==='rail'?16:kind==='fortifications'?14:kind==='power'?12:10):null;
export async function npcProvinceDevelopment(db,site,key){
 if(!site?.controlling_faction_id||site.controlling_faction_id==='eclipse-order')return null;
 const [[state]]=await db.execute('SELECT development_points FROM world_settlement_autosim WHERE settlement_id=? FOR UPDATE',[site.id]);
 if(!state)return null;
 const [rows]=await db.execute(`SELECT p.id,i.roads,i.rail,i.fortifications,i.power
  FROM world_strategic_provinces p JOIN world_zones z ON z.id=p.zone_id
  JOIN world_strategic_province_infrastructure i ON i.province_id=p.id
  WHERE p.zone_id=? AND z.controlling_faction_id=?
  AND NOT EXISTS(SELECT 1 FROM world_strategic_province_projects j WHERE j.province_id=p.id AND j.cycle_key=?)
  ORDER BY (i.roads+i.rail+i.fortifications+i.power),p.id FOR UPDATE`,[site.zone_id,site.controlling_faction_id,key]);
 const available=Number(state.development_points||0);
 for(const province of rows){
  const choice=provinceUpgradeChoice(province);if(!choice)continue;
  const cost=provinceUpgradeCost(choice.type,choice.level);
  if(available+0.001<cost)continue;
  // Spend the real, locked civic development balance. Do not affect Order stocks.
  const [spent]=await db.execute('UPDATE world_settlement_autosim SET development_points=development_points-? WHERE settlement_id=? AND development_points>=?',[cost,site.id,cost]);
  if(spent.affectedRows!==1)return null;
  await db.execute('UPDATE world_strategic_province_infrastructure SET '+choice.type+'='+choice.type+'+1 WHERE province_id=? AND '+choice.type+'=?',[province.id,choice.level]);
  await db.execute('INSERT INTO world_strategic_province_projects(province_id,sponsor_settlement_id,owner_faction_id,project_type,level_after,development_cost,cycle_key) VALUES(?,?,?,?,?,?,?)',[province.id,site.id,site.controlling_faction_id,choice.type,choice.level+1,cost,key]);
  return {province_id:province.id,project_type:choice.type,level_after:choice.level+1,cost};
 }
 return null;
}
