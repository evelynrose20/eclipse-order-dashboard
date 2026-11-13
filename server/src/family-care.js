import {resolveSession} from './auth.js';
import {adultFamilyRoute} from './family-adults.js';
import {schoolRoute,enrollDependentSchool} from './family-school-buildings.js';
import {SCHOOL_ACTIVITIES,DEVELOPMENT_MILESTONES} from '../../src/familyLifeStages.js';
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const positive=x=>Number.isSafeInteger(Number(x))&&Number(x)>0;
const ageStages=['newborn','infant','toddler','child','teen'];
const actions=['nursing','bottle','meal','comfort','hygiene','sleep','play','restock_milk','restock_food',...Object.keys(SCHOOL_ACTIVITIES)];
const clean=(v,max)=>typeof v==='string'&&v.trim().length<=max;
const validDate=x=>!x||typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T00:00:00Z'));
const bool=x=>x===1||x===true;
async function read(req){let size=0,parts=[];for await(const chunk of req){size+=chunk.length;if(size>4000)return null;parts.push(chunk)}try{return JSON.parse(Buffer.concat(parts).toString())}catch{return null}}
async function household(pool,accountId){
 const [r]=await pool.execute("SELECT 1 FROM account_order_ranks WHERE account_id=? AND track='household' LIMIT 1",[accountId]);
 return r.length>0;
}
async function access(pool,actor,id){
 const [[row]]=await pool.execute(`SELECT d.*, EXISTS(SELECT 1 FROM world_named_civilians n WHERE n.dependent_id=d.id) AS graduated,EXISTS(
 SELECT 1 FROM order_dependent_caregivers a WHERE a.dependent_id=d.id AND a.account_id=?
 ) AS assigned FROM order_dependents d WHERE d.id=?`,[actor.id,id]);
 if(!row)return null;
 const guardian=row.guardian_account_id===actor.id;
 const helper=!!row.assigned&&!row.graduated&&await household(pool,actor.id);
 return {row,guardian,helper,canCare:guardian||helper};
}
async function transaction(pool,fn){
 const db=await pool.getConnection();
 try{await db.beginTransaction();const result=await fn(db);if(result.status===200)await db.commit();else await db.rollback();return result}
 catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}
}
export async function familyRoute(pool,req,path){
 const actor=await resolveSession(pool,req);
 if(!actor)return fail(401,'not_authenticated');
 if(path==='/family/schools'||/^\/family\/schools\/\d+$/.test(path))return schoolRoute(pool,req,path,actor);
 if(path==='/family/adults/registry'||path==='/family/adults'||path==='/family/settlements'||path==='/family/workplaces'||/^\/family\/adults\/\d+$/.test(path)||/^\/family\/adults\/\d+\/seek-home$/.test(path)||/^\/family\/\d+\/adulthood$/.test(path))return adultFamilyRoute(pool,req,path,actor);
 if(path==='/family/settings'){
  if(req.method==='GET'){
   const [[row]]=await pool.execute('SELECT nursing_available FROM order_caregiver_settings WHERE account_id=?',[actor.id]);
   return ok({nursing_available:bool(row?.nursing_available)});
  }
  if(req.method==='PUT'){
   const body=await read(req);
   if(typeof body?.nursing_available!=='boolean')return fail(400,'invalid_setting');
   await pool.execute(`INSERT INTO order_caregiver_settings(account_id,nursing_available) VALUES(?,?)
    ON DUPLICATE KEY UPDATE nursing_available=VALUES(nursing_available)`,[actor.id,Number(body.nursing_available)]);
   return ok({nursing_available:body.nursing_available});
  }
  return fail(405,'method_not_allowed');
 }
 if(path==='/family/household'&&req.method==='GET'){
  // Household membership is required for assistance, but enrollment alone grants no access.
  const [r]=await pool.execute(`SELECT a.id,a.display_name FROM accounts a JOIN account_order_ranks r
   ON r.account_id=a.id AND r.track='household'
   WHERE a.approval_status='approved' AND a.is_active=1 ORDER BY a.display_name LIMIT 150`);
  return ok({members:r});
 }
 if(path==='/family'&&req.method==='GET'){
  const [r]=await pool.execute(`SELECT d.*,a.display_name AS guardian_name,
   EXISTS(SELECT 1 FROM world_named_civilians n WHERE n.dependent_id=d.id) AS graduated,
   (d.guardian_account_id=?) AS is_guardian
   FROM order_dependents d JOIN accounts a ON a.id=d.guardian_account_id
   WHERE d.guardian_account_id=? OR EXISTS (SELECT 1 FROM order_dependent_caregivers c
     JOIN account_order_ranks hr ON hr.account_id=c.account_id AND hr.track='household'
     WHERE c.dependent_id=d.id AND c.account_id=?)
   ORDER BY d.id DESC LIMIT 150`,[actor.id,actor.id,actor.id]);
  return ok({dependents:r.map(x=>({...x,is_guardian:bool(x.is_guardian)}))});
 }
 if(path==='/family'&&req.method==='POST'){
  const b=await read(req);
  if(!clean(b?.name,120)||!b.name.trim()||!ageStages.includes(b.stage)||!validDate(b.birth_date)||!clean(b.notes||'',1000))return fail(400,'invalid_dependent');
  const linked=b.lineage_case_id===undefined||b.lineage_case_id===null||b.lineage_case_id===''?null:Number(b.lineage_case_id);
  if(linked!==null){
   if(!positive(linked))return fail(400,'invalid_lineage_link');
   const [[found]]=await pool.execute(`SELECT lc.id FROM order_lineage_cases lc JOIN characters c
    ON c.id=lc.character_id AND c.player_account_id=?
    JOIN character_lineage_permissions p ON p.character_id=c.id AND p.allow_research=1
    WHERE lc.id=? AND lc.offspring_stage='documented'`,[actor.id,linked]);
   if(!found)return fail(403,'lineage_parenthood_not_authorized');
  }
  const [result]=await pool.execute(`INSERT INTO order_dependents
   (guardian_account_id,name,birth_date,stage,lineage_case_id,notes) VALUES(?,?,?,?,?,?)`,
   [actor.id,b.name.trim(),b.birth_date||null,b.stage,linked,(b.notes||'').trim()]);
  return ok({id:result.insertId});
 }
 const m=/^\/family\/(\d+)(?:\/(assign|care|supplies|events|school|milestones))?$/.exec(path);
 if(!m)return fail(404,'family_action_not_found');
 const id=Number(m[1]),sub=m[2];
 const grant=await access(pool,actor,id);
 if(!grant)return fail(404,'dependent_not_found');
 if(!grant.canCare)return fail(403,'caregiver_not_authorized');
 if(grant.row.graduated && req.method!=='GET')return fail(409,'adult_civilian_no_childcare_actions');
 if(!sub&&req.method==='GET'){
  const [caregivers]=await pool.execute(`SELECT c.account_id,a.display_name FROM order_dependent_caregivers c
   JOIN accounts a ON a.id=c.account_id WHERE c.dependent_id=? ORDER BY a.display_name`,[id]);
  return ok({dependent:grant.row,caregivers,is_guardian:grant.guardian});
 }
 if(!sub&&req.method==='PUT'){
  if(!grant.guardian)return fail(403,'guardian_required');
  const b=await read(req);
  if(!ageStages.includes(b?.stage)||!clean(b.notes||'',1000))return fail(400,'invalid_dependent');
  await pool.execute('UPDATE order_dependents SET stage=?,notes=? WHERE id=?',[b.stage,(b.notes||'').trim(),id]);
  return ok({saved:true});
 }
 if(sub==='school'&&req.method==='PUT'){
  if(!grant.guardian)return fail(403,'guardian_required');
  if(!['child','teen'].includes(grant.row.stage))return fail(409,'school_stage_required');
  return enrollDependentSchool(pool,req,actor,id);
 }
 if(sub==='milestones'&&req.method==='GET'){
  const [rows]=await pool.execute('SELECT milestone_id,completed_at FROM order_dependent_milestones WHERE dependent_id=?',[id]);
  return ok({milestones:rows});
 }
 if(sub==='milestones'&&req.method==='POST'){
  if(!grant.guardian)return fail(403,'guardian_required');
  const b=await read(req);
  const milestone=DEVELOPMENT_MILESTONES.find(m=>m.id===b?.milestone_id);
  if(!milestone||!milestone.stages.includes(grant.row.stage))return fail(400,'invalid_milestone');
  if(b.complete===true)await pool.execute('INSERT IGNORE INTO order_dependent_milestones(dependent_id,milestone_id,completed_by) VALUES(?,?,?)',[id,milestone.id,actor.id]);
  else if(b.complete===false)await pool.execute('DELETE FROM order_dependent_milestones WHERE dependent_id=? AND milestone_id=?',[id,milestone.id]);
  else return fail(400,'invalid_milestone_state');
  return ok({saved:true});
 }
  if(sub==='assign'&&req.method==='PUT'){
  if(!grant.guardian)return fail(403,'guardian_required');
  const b=await read(req);
  if(typeof b?.enabled!=='boolean'||typeof b?.account_id!=='string'||!/^[a-f0-9-]{36}$/i.test(b.account_id))return fail(400,'invalid_assignment');
  if(b.enabled){
   if(!await household(pool,b.account_id))return fail(403,'household_membership_required');
   await pool.execute('INSERT IGNORE INTO order_dependent_caregivers(dependent_id,account_id) VALUES(?,?)',[id,b.account_id]);
  }else await pool.execute('DELETE FROM order_dependent_caregivers WHERE dependent_id=? AND account_id=?',[id,b.account_id]);
  return ok({saved:true});
 }
 if(sub==='events'&&req.method==='GET'){
  const [events]=await pool.execute(`SELECT e.id,e.action,e.quantity,e.detail,e.created_at,a.display_name
   FROM order_dependent_care_events e JOIN accounts a ON a.id=e.actor_account_id
   WHERE e.dependent_id=? ORDER BY e.id DESC LIMIT 80`,[id]);
  return ok({events});
 }
 if((sub==='care'||sub==='supplies')&&req.method==='POST'){
  const b=await read(req);
  if(!actions.includes(b?.action)||!clean(b.detail||'',250))return fail(400,'invalid_care');
  const restock=b.action.startsWith('restock_');
  if(restock!== (sub==='supplies'))return fail(400,'invalid_care_action');
  const qty=restock?Number(b.quantity):1;
  if(!Number.isInteger(qty)||qty<1||qty>(restock?100:1))return fail(400,'invalid_quantity');
  if(restock&&!(b.detail||'').trim())return fail(400,'supply_source_required');
  if((b.action==='nursing'||b.action==='bottle')&&!['newborn','infant'].includes(grant.row.stage))return fail(409,'age_inappropriate_feeding');
  if(b.action==='meal'&&!['toddler','child','teen'].includes(grant.row.stage))return fail(409,'age_inappropriate_feeding');
  if(SCHOOL_ACTIVITIES[b.action]&&!SCHOOL_ACTIVITIES[b.action].stages.includes(grant.row.stage))return fail(409,'activity_not_available_for_stage');
  if(['school','homework'].includes(b.action)){
   if(!grant.row.school_upgrade_id)return fail(409,'school_enrollment_required');
   const [[facility]]=await pool.execute(`SELECT u.id,u.category,u.status,u.condition_pct,u.level,u.template_id,u.effect_snapshot,
       COALESCE(t.teachers,0) AS teacher_count FROM world_settlement_upgrades u
       LEFT JOIN world_school_staffing t ON t.upgrade_id=u.id WHERE u.id=?`,[grant.row.school_upgrade_id]);
   if(!facility||facility.category!=='school'||facility.status!=='operational'||Number(facility.teacher_count)<1)
     return fail(409,'school_not_operational_or_staffed');
  }
  if(b.action==='nursing'){
   const [[nursing]]=await pool.execute('SELECT nursing_available FROM order_caregiver_settings WHERE account_id=?',[actor.id]);
   if(!bool(nursing?.nursing_available))return fail(403,'caregiver_nursing_not_enabled');
  }
  return transaction(pool,async db=>{
   const [[child]]=await db.execute('SELECT milk_stock,food_stock FROM order_dependents WHERE id=? FOR UPDATE',[id]);
   if(!child)return fail(404,'dependent_not_found');
   if(b.action==='bottle'&&Number(child.milk_stock)<1)return fail(409,'milk_supplies_needed');
   if(b.action==='meal'&&Number(child.food_stock)<1)return fail(409,'food_supplies_needed');
   const updates={bottle:'milk_stock=milk_stock-1',meal:'food_stock=food_stock-1',
    restock_milk:'milk_stock=milk_stock+?',restock_food:'food_stock=food_stock+?'};
   if(updates[b.action])await db.execute('UPDATE order_dependents SET '+updates[b.action]+' WHERE id=?',
    restock?[qty,id]:[id]);
   await db.execute(`INSERT INTO order_dependent_care_events
    (dependent_id,actor_account_id,action,quantity,detail) VALUES(?,?,?,?,?)`,
    [id,actor.id,b.action,qty,(b.detail||'').trim()]);
   return ok({recorded:true});
  });
 }
 return fail(405,'method_not_allowed');
}
