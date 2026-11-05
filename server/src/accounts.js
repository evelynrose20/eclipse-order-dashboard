import {randomUUID} from 'node:crypto';
import {normalizeEmail,hashPassword,validPassword} from './credentials.js';
import {resolveSession} from './auth.js';

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

export async function accountRoute(pool,req,path){
 if(!pool)return error(503,'database_unavailable');
 if(path==='/auth/register'&&req.method==='POST'){
  // Cloudflare Tunnel connects from loopback. For a public, allowlisted hostname,
  // use its per-visitor IP header instead of limiting all visitors as one person.
  const fromTunnel=process.env.API_PUBLIC_ENABLED==='true'&&req.headers.host===process.env.API_PUBLIC_HOST;
  const forwarded=String(req.headers['cf-connecting-ip']||'');
  const address=fromTunnel&&/^[0-9a-fA-F:.]{3,45}$/.test(forwarded)?forwarded:(req.socket?.remoteAddress||'unknown');
  if(throttle('register-ip:'+address,12))return error(429,'too_many_requests');
  const body=await bodyJSON(req);
  const email=normalizeEmail(body?.email);
  const name=typeof body?.display_name==='string'?body.display_name.trim():'';
  const password=body?.password;
  if(!email||name.length<2||name.length>80||!validPassword(password))
   return error(400,'Enter a valid email, display name (2–80 characters), and password (16+ characters).');
  if(body?.adult_declaration!==true) return error(400,'An adult-only membership declaration is required.');
  const [existing]=await pool.execute('SELECT id FROM accounts WHERE email=? LIMIT 1',[email]);
  if(existing.length)return error(409,'This email is already registered. Contact an administrator if you need help.');
  const id=randomUUID();
  const passwordHash=await hashPassword(password);
  try{
   await pool.execute(
    "INSERT INTO accounts(id,email,password_hash,display_name,account_role,standing,syndicate_rank,is_active,approval_status) VALUES(?,?,?,?, 'member','initiate','kumi_in',0,'pending')",
    [id,email,passwordHash,name]
   );
  }catch(e){if(e.code==='ER_DUP_ENTRY')return error(409,'This email is already registered.');throw e;}
  return {status:201,body:{status:'pending',message:'Registration received. You can sign in after the Domina approves your account.'}};
 }
 if(!path.startsWith('/admin/'))return error(404,'not_found');
 const actor=await resolveSession(pool,req);
 if(!actor||actor.account_role!=='domina')return error(403,'forbidden');
 if(path==='/admin/accounts'&&req.method==='GET'){
  const [rows]=await pool.query(
   'SELECT id AS user_id,email,display_name,account_role AS role,standing,syndicate_rank,is_active,approval_status,created_at FROM accounts ORDER BY (approval_status="pending") DESC,created_at DESC'
  );
  return {status:200,body:rows};
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
