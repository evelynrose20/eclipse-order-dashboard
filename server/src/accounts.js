import {randomUUID} from 'node:crypto';
import {normalizeEmail,hashPassword,validPassword} from './credentials.js';
import {resolveSession} from './auth.js';
import {checkGuildMember,invalidateGuildCache} from './discord-guild.js';

const attempts=new Map();
const WINDOW=60*60*1000;
function throttle(key,max=5){
 const now=Date.now();const r=attempts.get(key);
 if(!r||now-r.start>WINDOW){attempts.set(key,{start:now,count:1});return false;}
 r.count++;
 if(attempts.size>5000)attempts.clear();
 return r.count>max;
}
async function bodyJSON(request){
 let data='';for await(const chunk of request){data+=chunk.toString('utf8');if(Buffer.byteLength(data)>8192)return null;}
 try{return JSON.parse(data);}catch{return null;}
}
const error=(status,reason)=>({status,body:{error:reason}});
const allowedRoles=new Set(['domina','high_command','handler','member']);
const allowedStanding=new Set(['initiate','associate','established','veteran']);
const syndicateRanks=new Set(['domina','oyabun','kusushi','operative','kumi_in']);
export async function revokeAccountAccess(db,id,{actorId=null,reason='staff_removed'}={}){
 const [[target]]=await db.execute('SELECT id,account_role,is_active,approval_status FROM accounts WHERE id=? FOR UPDATE',[id]);
 if(!target)return {status:404,error:'account_not_found'};
 if(target.account_role==='domina'){
  const [[remaining]]=await db.execute("SELECT COUNT(*) AS total FROM accounts WHERE account_role='domina' AND id<>? AND is_active=1 AND approval_status='approved'",[id]);
  if(!Number(remaining.total))return {status:409,error:'cannot_remove_last_domina'};
 }
 await db.execute("UPDATE accounts SET is_active=0,approval_status='rejected' WHERE id=?",[id]);
 await db.execute('UPDATE account_sessions SET revoked_at=UTC_TIMESTAMP() WHERE account_id=? AND revoked_at IS NULL',[id]);
 await db.execute('INSERT INTO audit_log(actor_account_id,action,entity_type,entity_id,details_json) VALUES(?,?,?,?,?)',[actorId,'account_access_revoked','account',id,JSON.stringify({reason})]);
 return {status:200};
}


export async function accountRoute(pool,req,path){
 if(!pool)return error(503,'database_unavailable');
 if(path==='/auth/register'&&req.method==='POST')return error(403,'discord_only_registration');
 if(!path.startsWith('/admin/'))return error(404,'not_found');
 const actor=await resolveSession(pool,req);
 if(!actor||actor.account_role!=='domina')return error(403,'forbidden');
 if(path==='/admin/accounts'&&req.method==='GET'){
  const [rows]=await pool.query(
   'SELECT a.id AS user_id,a.email,a.display_name,l.discord_username,a.account_role AS role,a.standing,a.syndicate_rank,a.is_active,a.approval_status,a.created_at FROM accounts a LEFT JOIN account_discord_links l ON l.account_id=a.id ORDER BY (a.approval_status="pending") DESC,a.created_at DESC'
  );
  const [rankRows]=await pool.query('SELECT account_id,track,rank_code FROM account_order_ranks');
  const assigned=new Map();
  for(const item of rankRows){if(!assigned.has(item.account_id))assigned.set(item.account_id,{});assigned.get(item.account_id)[item.track]=item.rank_code}
  return {status:200,body:rows.map(row=>({...row,order_ranks:assigned.get(row.user_id)||{}}))};
 }
 if(path==='/admin/order-ranks'&&req.method==='GET'){
  const [ranks]=await pool.query('SELECT code,track,title,sort_order FROM order_rank_catalog ORDER BY FIELD(track,"leadership","membership","snakes","fangs","golden_claws","household","servitude"),sort_order');
  return {status:200,body:{ranks}};
 }
 const accessChange=/^\/admin\/accounts\/([0-9a-f-]{36})\/(remove-access|restore-access)$/.exec(path);
 if(accessChange&&req.method==='POST'){
  const [,id,operation]=accessChange;
  if(id===actor.id)return error(403,'cannot_change_own_access');
  const db=await pool.getConnection();
  try{
   await db.beginTransaction();
   if(operation==='remove-access'){
    const result=await revokeAccountAccess(db,id,{actorId:actor.id,reason:'staff_removed'});
    if(result.status!==200){await db.rollback();return error(result.status,result.error)}
   }else{
    const [[target]]=await db.execute('SELECT id,account_role,approval_status FROM accounts WHERE id=? FOR UPDATE',[id]);
    if(!target){await db.rollback();return error(404,'account_not_found')}
    const [[link]]=await db.execute('SELECT discord_user_id FROM account_discord_links WHERE account_id=?',[id]);
    if(!link){await db.rollback();return error(409,'discord_account_not_linked')}
    invalidateGuildCache(link.discord_user_id);
    const member=await checkGuildMember(link.discord_user_id,{useCache:false});
    if(member!=='member'){
     await db.rollback();
     return error(member==='not_member'?409:503,member==='not_member'?'discord_not_in_server':'discord_server_check_unavailable');
    }
    await db.execute("UPDATE accounts SET is_active=1,approval_status='approved' WHERE id=?",[id]);
    await db.execute('INSERT INTO audit_log(actor_account_id,action,entity_type,entity_id,details_json) VALUES(?,?,?,?,?)',[actor.id,'account_access_restored','account',id,JSON.stringify({reason:'staff_restore'})]);
   }
   await db.commit();
   return {status:200,body:{status:'ok'}};
  }catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}
 }
 const rankChange=/^\/admin\/accounts\/([0-9a-f-]{36})\/order-rank$/.exec(path);
 if(rankChange&&req.method==='POST'){
  const id=rankChange[1];
  const body=await bodyJSON(req);
  const track=body?.track,code=body?.code;
  const tracks=new Set(['leadership','membership','snakes','fangs','golden_claws','household']);
  if(!tracks.has(track)||typeof code!=='string')return error(400,'invalid_order_rank');
  const [accounts]=await pool.execute('SELECT id,account_role FROM accounts WHERE id=? LIMIT 1',[id]);
  if(accounts.length!==1)return error(404,'account_not_found');
  if(id===actor.id)return error(403,'cannot_change_own_order_rank');
  if(track==='leadership'&&code==='domina'&&accounts[0].account_role!=='domina')return error(403,'domina_rank_requires_domina_permission');
  if(code===''){
   if(track==='leadership'&&accounts[0].account_role==='domina')return error(403,'cannot_remove_domina_rank');
   await pool.execute('DELETE FROM account_order_ranks WHERE account_id=? AND track=?',[id,track]);
  }else{
   const [ranks]=await pool.execute('SELECT code FROM order_rank_catalog WHERE code=? AND track=? LIMIT 1',[code,track]);
   if(!ranks.length)return error(400,'invalid_order_rank');
   if(track==='leadership'&&accounts[0].account_role==='domina'&&code!=='domina')return error(403,'cannot_change_domina_rank');
   await pool.execute('INSERT INTO account_order_ranks(account_id,track,rank_code) VALUES(?,?,?) ON DUPLICATE KEY UPDATE rank_code=VALUES(rank_code),assigned_at=CURRENT_TIMESTAMP',[id,track,code]);
  }
  await pool.execute('INSERT INTO audit_log(actor_account_id,action,entity_type,entity_id,details_json) VALUES(?,?,?,?,?)',
   [actor.id,'order_rank_changed','account',id,JSON.stringify({track,rank_code:code||null})]);
  return {status:200,body:{status:'ok'}};
 }
 const match=/^\/admin\/accounts\/([0-9a-f-]{36})\/(approve|reject|role|standing|syndicate-rank)$/.exec(path);
 if(match&&req.method==='POST'){
  const [,id,action]=match;
  if(id===actor.id&&action!=='standing')return error(400,'You cannot modify your own role, approval, or syndicate rank.');
  const body=await bodyJSON(req);
  if(!body||typeof body!=='object')return error(400,'invalid_request');
  const [accounts]=await pool.execute('SELECT approval_status,account_role,syndicate_rank FROM accounts WHERE id=? LIMIT 1',[id]);
  if(accounts.length!==1)return error(404,'account_not_found');
  if(action==='approve'||action==='reject'){
   if(accounts[0].approval_status!=='pending')return error(409,'This request is no longer pending.');
   const status=action==='approve'?'approved':'rejected',active=action==='approve'?1:0;
   await pool.execute('UPDATE accounts SET approval_status=?,is_active=? WHERE id=? AND approval_status="pending"',[status,active,id]);
  }else if(action==='role'){
   if(accounts[0].approval_status!=='approved')return error(409,'Approve the account first.');
   if(!allowedRoles.has(body.role))return error(400,'invalid_role');
   if(accounts[0].account_role==='domina'&&body.role!=='domina'){
    const [[others]]=await pool.execute("SELECT COUNT(*) AS count FROM accounts WHERE account_role='domina' AND id<>? AND is_active=1 AND approval_status='approved'",[id]);
    if(!Number(others.count))return error(409,'cannot_remove_last_domina');
   }
   await pool.execute("UPDATE accounts SET account_role=?,syndicate_rank=CASE WHEN ?='domina' THEN 'domina' WHEN syndicate_rank='domina' THEN 'kumi_in' ELSE syndicate_rank END WHERE id=?",[body.role,body.role,id]);
   if(body.role==='domina')await pool.execute("INSERT INTO account_order_ranks(account_id,track,rank_code) VALUES(?,'leadership','domina') ON DUPLICATE KEY UPDATE rank_code='domina'",[id]);
   else if(accounts[0].account_role==='domina')await pool.execute("DELETE FROM account_order_ranks WHERE account_id=? AND track='leadership' AND rank_code='domina'",[id]);
  }else if(action==='syndicate-rank'){
   if(accounts[0].approval_status!=='approved')return error(409,'Approve the account first.');
   if(!syndicateRanks.has(body.syndicate_rank))return error(400,'invalid_syndicate_rank');
   if(body.syndicate_rank==='domina'&&accounts[0].account_role!=='domina')return error(409,'domina_rank_requires_domina_permission');
   await pool.execute('UPDATE accounts SET syndicate_rank=? WHERE id=?',[body.syndicate_rank,id]);
  }else{
   if(!allowedStanding.has(body.standing))return error(400,'invalid_standing');
   await pool.execute('UPDATE accounts SET standing=? WHERE id=?',[body.standing,id]);
  }
  if(action==='reject'||action==='role'){
   await pool.execute('UPDATE account_sessions SET revoked_at=UTC_TIMESTAMP() WHERE account_id=? AND revoked_at IS NULL',[id]);
  }
  await pool.execute('INSERT INTO audit_log(actor_account_id,action,entity_type,entity_id,details_json) VALUES(?,?,?,?,?)',
   [actor.id,'account_'+action,'account',id,JSON.stringify({action,role:action==='role'?body.role:null,standing:action==='standing'?body.standing:null,syndicate_rank:action==='syndicate-rank'?body.syndicate_rank:null})]);
  return {status:200,body:{status:'ok'}};
 }
 return error(404,'not_found');
}
