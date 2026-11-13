import {findNpcHousing,NAMED_NPC_MAX_AGE,namedNpcAge,namedNpcAlive} from './family-npc-housing.js';
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const staff=a=>['domina','high_command','handler'].includes(a.account_role);
const id=x=>Number.isSafeInteger(Number(x))&&Number(x)>0;
const states=['seeking','employed','between_jobs','retired'];
const conditions=['settled','adjusting','needs_support'];
async function body(req){const parts=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>3000)return null;parts.push(chunk)}try{return JSON.parse(Buffer.concat(parts).toString())}catch{return null}}
const projection=`SELECT nc.id,nc.dependent_id,d.name, d.guardian_account_id,d.lineage_case_id,nc.settlement_id,
 s.name AS settlement_name,nc.workplace_facility_id,f.name AS workplace_name,
 nc.employment_state,nc.wellbeing,nc.public_update,nc.transitioned_at,nc.updated_at,
 d.birth_date,nc.housing_upgrade_id,h.name AS housing_name
 FROM world_named_civilians nc JOIN order_dependents d ON d.id=nc.dependent_id
 JOIN world_settlements s ON s.id=nc.settlement_id
 LEFT JOIN world_industry_facilities f ON f.id=nc.workplace_facility_id
 LEFT JOIN world_settlement_upgrades h ON h.id=nc.housing_upgrade_id`;
const enrich=row=>{
 const age=namedNpcAge(row.birth_date,row.transitioned_at);
 return {...row,age,lifespan_years:NAMED_NPC_MAX_AGE,lifecycle:namedNpcAlive(age)?'living':'deceased',
  residence_status:row.housing_upgrade_id?'housed':'seeking_home'};
};
export async function adultFamilyRoute(pool,req,path,actor){
 if(path==='/family/settlements'&&req.method==='GET'){
  const [rows]=await pool.execute("SELECT id,name,region_id FROM world_settlements ORDER BY name LIMIT 250");
  return ok({settlements:rows});
 }
 if(path==='/family/workplaces'&&req.method==='GET'){
  if(!staff(actor))return fail(403,'staff_required');
  const [rows]=await pool.execute("SELECT id,name,settlement_id,status FROM world_industry_facilities WHERE settlement_id IS NOT NULL AND status='operational' ORDER BY name LIMIT 250");
  return ok({workplaces:rows});
 }
 if(path==='/family/adults/registry'&&req.method==='GET'){
  if(!staff(actor))return fail(403,'staff_required');
  const [rows]=await pool.execute(projection+' ORDER BY nc.id DESC LIMIT 250');
  return ok({adults:rows.map(enrich)});
 }
  if(path==='/family/adults'&&req.method==='GET'){
  // Family members see only the adulthood outcomes for their own dependents.
  // Household assignments expire for access purposes at adulthood.
  const [rows]=await pool.execute(projection+' WHERE d.guardian_account_id=? ORDER BY nc.id DESC',[actor.id]);
  return ok({adults:rows.map(enrich)});
 }
 const graduate=/^\/family\/(\d+)\/adulthood$/.exec(path);
 if(graduate&&req.method==='POST'){
  const b=await body(req),settlementId=Number(b?.settlement_id),dependentId=Number(graduate[1]);
  if(!id(settlementId))return fail(400,'invalid_settlement');
  const db=await pool.getConnection();
  try{
   await db.beginTransaction();
   const [[dependent]]=await db.execute('SELECT id,stage,guardian_account_id FROM order_dependents WHERE id=? FOR UPDATE',[dependentId]);
   if(!dependent){await db.rollback();return fail(404,'dependent_not_found')}
   if(dependent.guardian_account_id!==actor.id){await db.rollback();return fail(403,'guardian_required')}
   if(dependent.stage!=='teen'){await db.rollback();return fail(409,'teen_stage_required')}
   const [[existing]]=await db.execute('SELECT id FROM world_named_civilians WHERE dependent_id=?',[dependentId]);
   if(existing){await db.rollback();return fail(409,'already_adult')}
   const [[settlement]]=await db.execute('SELECT id FROM world_settlements WHERE id=?',[settlementId]);
   if(!settlement){await db.rollback();return fail(404,'settlement_not_found')}
   const [result]=await db.execute('INSERT INTO world_named_civilians(dependent_id,settlement_id) VALUES(?,?)',[dependentId,settlementId]);
   const housing=await findNpcHousing(db,settlementId,result.insertId);
   await db.commit();
   return ok({civilian_id:result.insertId,transitioned:true,housing});
  }catch(e){await db.rollback().catch(()=>{});if(e.code==='ER_DUP_ENTRY')return fail(409,'already_adult');throw e}
  finally{db.release()}
 }
 const homeMatch=/^\/family\/adults\/(\d+)\/seek-home$/.exec(path);
 if(homeMatch&&req.method==='POST'){
  const [[adult]]=await pool.execute(projection+' WHERE nc.id=?',[Number(homeMatch[1])]);
  if(!adult)return fail(404,'civilian_not_found');
  if(adult.guardian_account_id!==actor.id&&!staff(actor))return fail(403,'family_record_private');
  if(!namedNpcAlive(namedNpcAge(adult.birth_date,adult.transitioned_at)))return fail(409,'civilian_deceased');
  if(adult.housing_upgrade_id)return ok({assigned:true,housing_upgrade_id:adult.housing_upgrade_id});
  const db=await pool.getConnection();
  try{await db.beginTransaction();
   const housing=await findNpcHousing(db,adult.settlement_id,adult.id);
   await db.commit();return ok(housing);
  }catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}
 }
  const match=/^\/family\/adults\/(\d+)$/.exec(path);
 if(match){
  const civilianId=Number(match[1]);
  if(!id(civilianId))return fail(404,'civilian_not_found');
  const [[row]]=await pool.execute(projection+' WHERE nc.id=?',[civilianId]);
  if(!row)return fail(404,'civilian_not_found');
  if(row.guardian_account_id!==actor.id&&!staff(actor))return fail(403,'family_record_private');
  if(req.method==='GET')return ok({civilian:enrich(row)});
  if(req.method==='POST'&&path.endsWith('/seek-home')){
   return fail(404,'invalid_action');
  }
  if(req.method==='PUT'){
   if(!staff(actor))return fail(403,'staff_required');
   if(!namedNpcAlive(namedNpcAge(row.birth_date,row.transitioned_at)))return fail(409,'civilian_deceased');
   const b=await body(req);
   const settlementId=Number(b?.settlement_id),facility=b?.workplace_facility_id===null?null:Number(b?.workplace_facility_id);
   if(!id(settlementId)||!states.includes(b?.employment_state)||!conditions.includes(b?.wellbeing)
    ||typeof b?.public_update!=='string'||b.public_update.length>500||(facility!==null&&!id(facility)))
    return fail(400,'invalid_civilian_update');
   const [[settlement]]=await pool.execute('SELECT id FROM world_settlements WHERE id=?',[settlementId]);
   if(!settlement)return fail(404,'settlement_not_found');
   if(facility!==null){
    const [[workplace]]=await pool.execute('SELECT id FROM world_industry_facilities WHERE id=? AND settlement_id=? AND status=?',[facility,settlementId,'operational']);
    if(!workplace)return fail(409,'workplace_not_operational_in_settlement');
   }
   if((b.employment_state==='employed')!== (facility!==null))return fail(400,'workplace_employment_mismatch');
   const db=await pool.getConnection();
   try{
    await db.beginTransaction();
    await db.execute(`UPDATE world_named_civilians SET settlement_id=?,housing_upgrade_id=CASE WHEN settlement_id=? THEN housing_upgrade_id ELSE NULL END,
       workplace_facility_id=?,employment_state=?,wellbeing=?,public_update=? WHERE id=?`,
       [settlementId,settlementId,facility,b.employment_state,b.wellbeing,b.public_update.trim(),civilianId]);
    const housing=await findNpcHousing(db,settlementId,civilianId);
    await db.commit();return ok({updated:true,housing});
   }catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}
  }
 }
 return fail(404,'family_adulthood_action_not_found');
}
