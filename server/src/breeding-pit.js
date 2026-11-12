import {resolveSession} from './auth.js';
import {mayEnterThralls} from './thralls.js';

const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const whole=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const roles=['scout','assault','support'];
const canCommand=actor=>['domina','high_command'].includes(actor.account_role);
async function canManage(pool,actor){
 if(['domina','high_command','handler'].includes(actor.account_role))return true;
 const [rows]=await pool.execute("SELECT 1 FROM account_order_ranks WHERE account_id=? AND track='household' LIMIT 1",[actor.id]);
 return rows.length>0;
}
async function readBody(req){
 let size=0;const parts=[];
 for await(const chunk of req){size+=chunk.length;if(size>10000)return null;parts.push(chunk)}
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{return null}
}
async function transaction(pool,work){
 const db=await pool.getConnection();
 try{await db.beginTransaction();const result=await work(db);if(result.status===200)await db.commit();else await db.rollback();return result}
 catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}
}
async function log(db,actor,action,detail){
 await db.execute('INSERT INTO order_brood_activity(actor_id,action,detail) VALUES(?,?,?)',[actor.id,action,detail.slice(0,600)]);
}
export const broodStage=(start,ready,now=new Date())=>{
 const from=new Date(start).getTime(),to=new Date(ready).getTime(),clock=new Date(now).getTime();
 return {ready:clock>=to,progress:Math.max(0,Math.min(100,Math.round(100*(clock-from)/Math.max(1,to-from))))};
};

export async function breedingPitRoute(pool,req,path){
 if(!pool)return fail(503,'database_unavailable');
 const actor=await resolveSession(pool,req);
 if(!actor)return fail(401,'not_authenticated');
 const host=/^\/thralls\/breeding-pit\/hosts\/([0-9a-f-]{36})$/.exec(path);
 if(host&&uuid.test(host[1])){
  const id=host[1],[[char]]=await pool.execute('SELECT id,character_name,player_account_id FROM characters WHERE id=?',[id]);
  if(!char)return fail(404,'character_not_found');
  const owner=char.player_account_id===actor.id;
  if(!owner&&!await canManage(pool,actor))return fail(403,'character_access_denied');
  if(req.method==='GET'){
   const [[permission]]=await pool.execute('SELECT allow_incubation FROM order_brood_host_permissions WHERE character_id=?',[id]);
   return ok({character_id:id,name:char.character_name,allow_incubation:Boolean(permission?.allow_incubation),can_edit:owner});
  }
  if(req.method!=='PUT')return fail(405,'method_not_allowed');
  if(!owner)return fail(403,'character_owner_required');
  const body=await readBody(req);
  if(typeof body?.allow_incubation!=='boolean')return fail(400,'invalid_host_permission');
  return transaction(pool,async db=>{
   await db.execute('SELECT id FROM order_brood_facility WHERE id=1 FOR UPDATE');
   await db.execute('INSERT IGNORE INTO order_brood_host_permissions(character_id,allow_incubation) VALUES(?,0)',[id]);
   await db.execute('SELECT allow_incubation FROM order_brood_host_permissions WHERE character_id=? FOR UPDATE',[id]);
   await db.execute('UPDATE order_brood_host_permissions SET allow_incubation=? WHERE character_id=?',[Number(body.allow_incubation),id]);
   if(!body.allow_incubation){
    const [active]=await db.execute("SELECT i.id,i.strain_id FROM order_brood_incubations i WHERE i.host_character_id=? AND i.status='incubating' FOR UPDATE",[id]);
    for(const item of active){
     await db.execute("UPDATE order_brood_incubations SET status='cancelled' WHERE id=?",[item.id]);
     await db.execute('UPDATE order_brood_strains SET egg_stock=egg_stock+1 WHERE id=?',[item.strain_id]);
     await log(db,actor,'cancel','Host incubation #'+item.id+' discontinued');
    }
   }
   return ok({saved:true});
  });
 }
 if(!await mayEnterThralls(pool,actor))return fail(403,'access_denied');
 if(path==='/thralls/breeding-pit'&&req.method==='GET'){
  const [[facility]]=await pool.execute('SELECT incubator_capacity,nursery_capacity FROM order_brood_facility WHERE id=1');
  const [strains]=await pool.execute('SELECT *,DATE_FORMAT(last_cultivation_day,\'%Y-%m-%d\') AS last_cultivation_day FROM order_brood_strains ORDER BY id');
  const [incubations]=await pool.execute("SELECT i.*,s.name AS strain_name,s.role,c.character_name AS host_name FROM order_brood_incubations i JOIN order_brood_strains s ON s.id=i.strain_id LEFT JOIN characters c ON c.id=i.host_character_id ORDER BY i.id DESC LIMIT 150");
  const [cohorts]=await pool.execute('SELECT c.*,s.name AS strain_name,s.role,i.incubation_mode FROM order_brood_cohorts c JOIN order_brood_strains s ON s.id=c.strain_id JOIN order_brood_incubations i ON i.id=c.incubation_id ORDER BY c.id DESC LIMIT 150');
  const [installations]=await pool.execute("SELECT i.id,i.name,i.state,i.condition_pct,s.name AS location_name FROM world_military_installations i JOIN world_settlements s ON s.id=i.settlement_id WHERE i.state IN ('operational','damaged') AND i.condition_pct>=25 ORDER BY i.name");
  const [hosts]=await pool.execute("SELECT c.id,c.character_name AS name FROM order_brood_host_permissions p JOIN characters c ON c.id=p.character_id WHERE p.allow_incubation=1 ORDER BY c.character_name");
  const [history]=await pool.execute('SELECT b.id,b.action,b.detail,b.created_at,a.display_name AS actor FROM order_brood_activity b JOIN accounts a ON a.id=b.actor_id ORDER BY b.id DESC LIMIT 75');
  const now=Date.now();
  const capacity_used=cohorts.filter(c=>c.status!=='deployed').reduce((n,c)=>n+Number(c.quantity),0);
  const incubator_used=incubations.filter(i=>i.status==='incubating').length;
  return ok({strains,incubations,cohorts,installations,hosts,history,capacity:{incubators:Number(facility.incubator_capacity),incubator_used,nursery:Number(facility.nursery_capacity),nursery_used:capacity_used},server_time:new Date(now).toISOString(),can_manage:await canManage(pool,actor),can_deploy:canCommand(actor)});
 }
 if(path!=='/thralls/breeding-pit/actions'||req.method!=='POST')return fail(404,'not_found');
 if(!await canManage(pool,actor))return fail(403,'staff_or_household_required');
 const body=await readBody(req);
 if(!body||typeof body!=='object')return fail(400,'invalid_request');
 const action=body.action;
 if(!['new_strain','cultivate','incubate','hatch','cancel','deploy'].includes(action))return fail(400,'invalid_action');
 if(action==='deploy'&&!canCommand(actor))return fail(403,'command_required');
 return transaction(pool,async db=>{
  const [[facility]]=await db.execute('SELECT incubator_capacity,nursery_capacity FROM order_brood_facility WHERE id=1 FOR UPDATE');
  if(action==='new_strain'){
   if(typeof body.name!=='string'||!body.name.trim()||body.name.length>73||typeof body.description!=='string'||body.description.length>700||!roles.includes(body.role)||!whole(body.incubation_days,1,14)||!whole(body.maturation_days,1,14)||!whole(body.hatch_yield,1,5))return fail(400,'invalid_strain');
   const [existing]=await db.execute('SELECT id FROM order_brood_strains WHERE name=?',[body.name.trim()]);
   if(existing.length)return fail(409,'strain_exists');
   const [added]=await db.execute('INSERT INTO order_brood_strains(name,description,role,incubation_days,maturation_days,hatch_yield,egg_stock,created_by) VALUES(?,?,?,?,?,?,0,?)',[body.name.trim(),body.description,body.role,body.incubation_days,body.maturation_days,body.hatch_yield,actor.id]);
   await log(db,actor,'strain','Registered strain '+body.name.trim());
   return ok({saved:true,id:added.insertId});
  }
  if(action==='cultivate'){
   if(!whole(body.strain_id,1,Number.MAX_SAFE_INTEGER))return fail(400,'invalid_strain_id');
   const [[strain]]=await db.execute('SELECT * FROM order_brood_strains WHERE id=? FOR UPDATE',[body.strain_id]);
   if(!strain)return fail(404,'strain_not_found');
   const [[cultivated]]=await db.execute('SELECT last_cultivation_day=CURDATE() AS used FROM order_brood_strains WHERE id=?',[strain.id]);
   if(cultivated.used)return fail(409,'cultivation_already_used_today');
   if(Number(strain.egg_stock)>=24)return fail(409,'egg_storage_full');
   const added=Math.min(2,24-Number(strain.egg_stock));
   await db.execute('UPDATE order_brood_strains SET egg_stock=egg_stock+?,last_cultivation_day=CURDATE() WHERE id=?',[added,strain.id]);
   await log(db,actor,'cultivate','Cultivated '+added+' '+strain.name+' eggs');
   return ok({saved:true,added});
  }
  if(action==='incubate'){
   if(!whole(body.strain_id,1,Number.MAX_SAFE_INTEGER)||!['vat','host'].includes(body.mode)||typeof body.notes!=='string'||body.notes.length>800)return fail(400,'invalid_incubation');
   const [[strain]]=await db.execute('SELECT * FROM order_brood_strains WHERE id=? FOR UPDATE',[body.strain_id]);
   if(!strain)return fail(404,'strain_not_found');
   if(!Number(strain.egg_stock))return fail(409,'no_eggs_in_stock');
   const [[running]]=await db.execute("SELECT COUNT(*) AS n FROM order_brood_incubations WHERE status='incubating'");
   if(Number(running.n)>=Number(facility.incubator_capacity))return fail(409,'incubators_full');
   let hostId=null;
   if(body.mode==='host'){
    if(!uuid.test(body.host_character_id||''))return fail(400,'choose_host');
    hostId=body.host_character_id;
    const [[permission]]=await db.execute('SELECT allow_incubation FROM order_brood_host_permissions WHERE character_id=? FOR UPDATE',[hostId]);
    if(!permission?.allow_incubation)return fail(403,'host_has_not_enabled_incubation');
    const [[existing]]=await db.execute("SELECT id FROM order_brood_incubations WHERE host_character_id=? AND status='incubating' LIMIT 1",[hostId]);
    if(existing)return fail(409,'host_already_incubating');
   }
   const [row]=await db.execute('INSERT INTO order_brood_incubations(strain_id,host_character_id,incubation_mode,started_at,ready_at,notes,created_by) VALUES(?,?,?,NOW(),DATE_ADD(NOW(),INTERVAL ? DAY),?,?)',[strain.id,hostId,body.mode,strain.incubation_days,body.notes,actor.id]);
   await db.execute('UPDATE order_brood_strains SET egg_stock=egg_stock-1 WHERE id=?',[strain.id]);
   await log(db,actor,'incubate','Started '+strain.name+' '+body.mode+' incubation #'+row.insertId);
   return ok({saved:true,id:row.insertId});
  }
  if(action==='cancel'||action==='hatch'){
   if(!whole(body.incubation_id,1,Number.MAX_SAFE_INTEGER))return fail(400,'invalid_incubation_id');
   const [[inc]]=await db.execute('SELECT * FROM order_brood_incubations WHERE id=? FOR UPDATE',[body.incubation_id]);
   if(!inc)return fail(404,'incubation_not_found');
   if(inc.status!=='incubating')return fail(409,'incubation_already_resolved');
   const [[strain]]=await db.execute('SELECT * FROM order_brood_strains WHERE id=? FOR UPDATE',[inc.strain_id]);
   if(action==='cancel'){
    await db.execute("UPDATE order_brood_incubations SET status='cancelled' WHERE id=?",[inc.id]);
    await db.execute('UPDATE order_brood_strains SET egg_stock=egg_stock+1 WHERE id=?',[inc.strain_id]);
    await log(db,actor,'cancel','Cancelled incubation #'+inc.id+' and returned egg stock');
    return ok({saved:true});
   }
   const [[readiness]]=await db.execute('SELECT ready_at<=NOW() AS ready FROM order_brood_incubations WHERE id=?',[inc.id]);
   if(!readiness.ready)return fail(409,'incubation_not_ready');
   const [[usage]]=await db.execute("SELECT COALESCE(SUM(quantity),0) AS used FROM order_brood_cohorts WHERE status<>'deployed'");
   if(Number(usage.used)+Number(strain.hatch_yield)>Number(facility.nursery_capacity))return fail(409,'nursery_full');
   await db.execute('INSERT INTO order_brood_cohorts(incubation_id,strain_id,quantity,mature_at) VALUES(?,?,?,DATE_ADD(NOW(),INTERVAL ? DAY))',[inc.id,strain.id,strain.hatch_yield,strain.maturation_days]);
   await db.execute("UPDATE order_brood_incubations SET status='hatched' WHERE id=?",[inc.id]);
   await log(db,actor,'hatch','Hatched '+strain.hatch_yield+' '+strain.name+' from incubation #'+inc.id);
   return ok({saved:true});
  }
  if(action==='deploy'){
   if(!whole(body.cohort_id,1,Number.MAX_SAFE_INTEGER)||!whole(body.installation_id,1,Number.MAX_SAFE_INTEGER))return fail(400,'invalid_deployment');
   const [[cohort]]=await db.execute('SELECT * FROM order_brood_cohorts WHERE id=? FOR UPDATE',[body.cohort_id]);
   if(!cohort)return fail(404,'cohort_not_found');
   if(cohort.status==='deployed')return fail(409,'cohort_already_deployed');
   const [[readiness]]=await db.execute('SELECT mature_at<=NOW() AS ready FROM order_brood_cohorts WHERE id=?',[cohort.id]);
   if(!readiness.ready)return fail(409,'cohort_not_mature');
   const [[site]]=await db.execute('SELECT id,name,state,condition_pct FROM world_military_installations WHERE id=?',[body.installation_id]);
   if(!site||!['operational','damaged'].includes(site.state)||Number(site.condition_pct)<25)return fail(409,'installation_not_operational');
   const [[strain]]=await db.execute('SELECT name FROM order_brood_strains WHERE id=?',[cohort.strain_id]);
   const troop='Brood: '+strain.name;
   if(troop.length>80)return fail(409,'strain_name_too_long_for_garrison');
   await db.execute('INSERT INTO world_military_garrisons(installation_id,troop_type,quantity) VALUES(?,?,?) ON DUPLICATE KEY UPDATE quantity=quantity+VALUES(quantity)',[site.id,troop,cohort.quantity]);
   await db.execute("UPDATE order_brood_cohorts SET status='deployed',deployed_installation_id=?,deployed_at=UTC_TIMESTAMP() WHERE id=?",[site.id,cohort.id]);
   await db.execute('INSERT INTO world_military_activity(installation_id,activity,detail,actor_id) VALUES(?,?,?,?)',[site.id,'brood_transfer',cohort.quantity+' '+strain.name+' assigned to the garrison',actor.id]);
   await log(db,actor,'deploy','Transferred '+cohort.quantity+' '+strain.name+' to '+site.name);
   return ok({saved:true});
  }
  return fail(404,'not_found');
 });
}
