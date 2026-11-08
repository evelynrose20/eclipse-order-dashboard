const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const categories=['housing','defense','clinic','water','food_storage','insulation','public_works'];
const statuses=['planned','building','operational','damaged','destroyed'];
const whole=(x,min,max)=>Number.isInteger(x)&&x>=min&&x<=max;
async function read(req){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>12000)return null;chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}}
async function transact(pool,fn){const db=await pool.getConnection();try{await db.beginTransaction();const result=await fn(db);if(result.status===200)await db.commit();else await db.rollback();return result}catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}}
async function audit(db,actor,action,id,detail=''){await db.execute('INSERT INTO world_administration_audit(actor_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',[actor,action,'upgrade',id,String(detail).slice(0,350)])}
const payload=b=>b&&typeof b.name==='string'&&b.name.trim().length>0&&b.name.length<=120&&categories.includes(b.category)&&statuses.includes(b.status)&&whole(b.condition_pct,0,100)&&whole(b.level,1,20)&&whole(b.housing_bonus,0,10000000)&&whole(b.service_bonus,0,100)&&whole(b.defense_bonus,0,100)&&typeof b.notes==='string'&&b.notes.length<=500&&(b.category==='housing'||b.housing_bonus===0)&&(b.category==='defense'||b.defense_bonus===0)&&(['clinic','water','food_storage','insulation','public_works'].includes(b.category)||b.service_bonus===0);
export function upgradeEffects(upgrades=[]){
 let housing=0,service=0,defense=0;
 const byCategory={},serviceByCategory={};
 for(const u of upgrades){
  const factor=u.status==='operational'?Number(u.condition_pct)/100:u.status==='damaged'?Number(u.condition_pct)/200:0;
  housing+=Math.floor(Number(u.housing_bonus)*factor);
  service+=Math.floor(Number(u.service_bonus)*factor);
  defense+=Math.floor(Number(u.defense_bonus)*factor);
  byCategory[u.category]=(byCategory[u.category]||0)+1;
  serviceByCategory[u.category]=(serviceByCategory[u.category]||0)+Math.floor(Number(u.service_bonus)*factor);
 }
 return {housing_bonus:housing,service_bonus:Math.min(100,service),defense_bonus:Math.min(100,defense),by_category:byCategory,service_by_category:serviceByCategory};
}
export function housingCapacity(settlement,upgrades=[]){return Number(settlement.housing_capacity||0)+upgradeEffects(upgrades).housing_bonus}
export async function getSettlementUpgradeRecords(db,id,lock=false){
 const [rows]=await db.execute('SELECT * FROM world_settlement_upgrades WHERE settlement_id=? ORDER BY id'+(lock?' FOR UPDATE':''),[id]);return rows;
}
export async function handleSettlementUpgrades(pool,req,path,actor){
 const m=/^\/world-admin\/settlements\/(\d+)\/upgrades(?:\/(\d+))?$/.exec(path);
 if(!m)return null;
 if(!['domina','high_command'].includes(actor.account_role))return fail(403,'command_required');
 const id=Number(m[1]),upgradeId=m[2]?Number(m[2]):null;
 if(!Number.isSafeInteger(id)||id<1)return fail(400,'invalid_settlement');
 if(req.method==='GET'&&!upgradeId){
  const [[settlement]]=await pool.execute('SELECT id,population,housing_capacity,security_score,medical_access,housing FROM world_settlements WHERE id=?',[id]);
  if(!settlement)return fail(404,'settlement_not_found');
  const upgrades=await getSettlementUpgradeRecords(pool,id);
  return ok({housing_capacity:housingCapacity(settlement,upgrades),base_capacity:Number(settlement.housing_capacity),residents:Number(settlement.population),effects:upgradeEffects(upgrades),upgrades});
 }
 if(req.method!=='POST'&&req.method!=='PUT'&&req.method!=='DELETE')return fail(404,'not_found');
 if(req.method==='POST'&&upgradeId||req.method!=='POST'&&!upgradeId)return fail(400,'invalid_upgrade_action');
 const b=req.method==='DELETE'?null:await read(req);
 if(req.method!=='DELETE'&&!payload(b))return fail(400,'invalid_upgrade');
 return transact(pool,async db=>{
  const [[settlement]]=await db.execute('SELECT id,population,housing_capacity FROM world_settlements WHERE id=? FOR UPDATE',[id]);
  if(!settlement)return fail(404,'settlement_not_found');
  const upgrades=await getSettlementUpgradeRecords(db,id,true);
  if(upgradeId&&!upgrades.some(u=>Number(u.id)===upgradeId))return fail(404,'upgrade_not_found');
  const next=req.method==='DELETE'?upgrades.filter(x=>Number(x.id)!==upgradeId):req.method==='PUT'?upgrades.map(x=>Number(x.id)===upgradeId?{...x,...b}:x):[...upgrades,b];
  if(housingCapacity(settlement,next)<Number(settlement.population))return fail(409,'upgrade_would_displace_residents');
  const vals=b?[b.name.trim(),b.category,b.status,b.condition_pct,b.level,b.housing_bonus,b.service_bonus,b.defense_bonus,b.notes]:null;
  let newId=upgradeId;
  if(req.method==='POST'){
   const [created]=await db.execute('INSERT INTO world_settlement_upgrades(settlement_id,name,category,status,condition_pct,level,housing_bonus,service_bonus,defense_bonus,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[id,...vals,actor.id]);
   newId=created.insertId;
  }else if(req.method==='PUT')await db.execute('UPDATE world_settlement_upgrades SET name=?,category=?,status=?,condition_pct=?,level=?,housing_bonus=?,service_bonus=?,defense_bonus=?,notes=? WHERE id=? AND settlement_id=?',[...vals,upgradeId,id]);
  else await db.execute('DELETE FROM world_settlement_upgrades WHERE id=? AND settlement_id=?',[upgradeId,id]);
  await audit(db,actor.id,'upgrade_'+req.method.toLowerCase(),id,String(newId));
  return ok({saved:true,id:newId});
 });
}
