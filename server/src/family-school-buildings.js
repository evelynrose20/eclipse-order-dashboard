import {schoolCapacity} from './world-education.js';
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const staff=actor=>['domina','high_command'].includes(actor.account_role);
const integer=x=>Number.isSafeInteger(Number(x))&&Number(x)>=0;
async function read(req){let size=0,parts=[];for await(const part of req){size+=part.length;if(size>2000)return null;parts.push(part)}try{return JSON.parse(Buffer.concat(parts).toString())}catch{return null}}
const schoolsSql=`SELECT u.id,u.settlement_id,u.name,u.status,u.condition_pct,u.level,u.template_id,u.effect_snapshot,
 s.name AS settlement_name,s.workforce,s.population,
 COALESCE(t.teachers,0) AS teacher_count,COALESCE(t.support_staff,0) AS support_staff,
 (SELECT COUNT(*) FROM order_dependents d WHERE d.school_upgrade_id=u.id AND d.stage IN ('child','teen')
   AND NOT EXISTS(SELECT 1 FROM world_named_civilians n WHERE n.dependent_id=d.id)) AS enrolled
 FROM world_settlement_upgrades u
 JOIN world_settlements s ON s.id=u.settlement_id
 LEFT JOIN world_school_staffing t ON t.upgrade_id=u.id
 WHERE u.category='school'`;
const describe=row=>({...row,physical_seats:schoolCapacity([row],false),staffed_seats:schoolCapacity([row]),
 available_seats:Math.max(0,schoolCapacity([row])-Number(row.enrolled||0))});
export async function schoolRoute(pool,req,path,actor){
 if(path==='/family/schools'&&req.method==='GET'){
  const [rows]=await pool.execute(schoolsSql+" AND u.status='operational' ORDER BY s.name,u.name LIMIT 500");
  return ok({schools:rows.map(describe)});
 }
 const m=/^\/family\/schools\/(\d+)$/.exec(path);
 if(m){
  if(!staff(actor))return fail(403,'command_required');
  const schoolId=Number(m[1]);
  if(req.method==='GET'){
   const [rows]=await pool.execute(schoolsSql+' AND u.id=?',[schoolId]);
   return rows[0]?ok({school:describe(rows[0])}):fail(404,'school_not_found');
  }
  if(req.method==='PUT'){
   const b=await read(req);
   if(!integer(b?.teachers)||!integer(b?.support_staff)||Number(b.teachers)>10000||Number(b.support_staff)>10000)return fail(400,'invalid_staffing');
   const db=await pool.getConnection();
   try{
    await db.beginTransaction();
    const [[school]]=await db.execute(`SELECT u.id,u.settlement_id,u.name,u.status,u.condition_pct,u.level,u.template_id,u.effect_snapshot,
      s.workforce FROM world_settlement_upgrades u JOIN world_settlements s ON s.id=u.settlement_id
      WHERE u.id=? AND u.category='school' FOR UPDATE`,[schoolId]);
    if(!school){await db.rollback();return fail(404,'school_not_found')}
    const [other]=await db.execute(`SELECT t.teachers,t.support_staff FROM world_school_staffing t
       JOIN world_settlement_upgrades u ON u.id=t.upgrade_id
       WHERE u.settlement_id=? AND u.id<>? FOR UPDATE`,[school.settlement_id,schoolId]);
    const occupied=other.reduce((sum,x)=>sum+Number(x.teachers)+Number(x.support_staff),0);
    if(occupied+Number(b.teachers)+Number(b.support_staff)>Number(school.workforce)){
     await db.rollback();return fail(409,'insufficient_settlement_workers');
    }
    const capacity=schoolCapacity([{...school,teacher_count:Number(b.teachers)}]);
    const [[students]]=await db.execute(`SELECT COUNT(*) AS n FROM order_dependents
       WHERE school_upgrade_id=? AND stage IN ('child','teen')`,[schoolId]);
    if(capacity<Number(students.n)){await db.rollback();return fail(409,'staffing_below_current_enrollment')}
    await db.execute(`INSERT INTO world_school_staffing(upgrade_id,teachers,support_staff)
       VALUES(?,?,?) ON DUPLICATE KEY UPDATE teachers=VALUES(teachers),support_staff=VALUES(support_staff)`,
       [schoolId,Number(b.teachers),Number(b.support_staff)]);
    await db.commit();return ok({saved:true,staffed_seats:capacity});
   }catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}
  }
 }
 return fail(404,'school_action_not_found');
}
export async function enrollDependentSchool(pool,req,actor,dependentId){
 const b=await read(req);
 const schoolId=b?.school_upgrade_id===null?null:Number(b?.school_upgrade_id);
 if(schoolId!==null&&(!integer(schoolId)||schoolId<1))return fail(400,'invalid_school');
 if(typeof b?.school_days!=='string'|| !/^[1-7](,[1-7]){0,6}$/.test(b.school_days)||
   new Set(b.school_days.split(',')).size!==b.school_days.split(',').length)return fail(400,'invalid_school_schedule');
 const db=await pool.getConnection();
 try{
  await db.beginTransaction();
  const [[dependent]]=await db.execute('SELECT id,guardian_account_id,stage FROM order_dependents WHERE id=? FOR UPDATE',[dependentId]);
  if(!dependent){await db.rollback();return fail(404,'dependent_not_found')}
  if(dependent.guardian_account_id!==actor.id){await db.rollback();return fail(403,'guardian_required')}
  if(!['child','teen'].includes(dependent.stage)){await db.rollback();return fail(409,'school_stage_required')}
  if(schoolId===null){
   await db.execute('UPDATE order_dependents SET school_upgrade_id=NULL,school_name=?,school_days=? WHERE id=?',
    ['',b.school_days,dependentId]);await db.commit();return ok({saved:true});
  }
  const [[school]]=await db.execute(schoolsSql+' AND u.id=? FOR UPDATE',[schoolId]);
  if(!school||school.status!=='operational'){await db.rollback();return fail(409,'school_not_operational')}
  const [[full]]=await db.execute(`SELECT COUNT(*) AS n FROM order_dependents
    WHERE school_upgrade_id=? AND id<>? AND stage IN ('child','teen')`,[schoolId,dependentId]);
  if(Number(full.n)>=schoolCapacity([school])){await db.rollback();return fail(409,'school_no_available_seats')}
  await db.execute('UPDATE order_dependents SET school_upgrade_id=?,school_name=?,school_days=? WHERE id=?',
   [schoolId,school.name,b.school_days,dependentId]);await db.commit();
  return ok({saved:true});
 }catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}
}
