import {normalizeEmail,hashPassword,verifyPassword,generateToken,hashToken} from './credentials.js';

const failures=new Map();
const ipFailures=new Map();
const WINDOW_MS=15*60*1000;
const MAX_ATTEMPTS=6;
const SESSION_HOURS=12;
const dummyPasswordHash=hashPassword('unused-dummy-password-for-timing-protection');

export function loginThrottle(email,now=Date.now()){
 const row=failures.get(email);
 if(!row)return false;
 if(now-row.since>WINDOW_MS){failures.delete(email);return false;}
 return row.count>=MAX_ATTEMPTS;
}
function noteFailure(email,now=Date.now()){
 const previous=failures.get(email);
 const row=!previous||now-previous.since>WINDOW_MS?{since:now,count:1}:{...previous,count:previous.count+1};
 failures.set(email,row);
 // Prevent unbounded in-memory growth from malicious login attempts.
 if(failures.size>2000)for(const [key,item] of failures){if(now-item.since>WINDOW_MS||failures.size>2000)failures.delete(key);}
}
function authHeader(request){
 const header=request.headers.authorization||'';
 const match=/^Bearer ([A-Za-z0-9_-]{30,200})$/.exec(header);
 return match?.[1]||null;
}
async function readJSON(request){
 const parts=[];let total=0;
 for await(const chunk of request){
  total+=chunk.length;
  if(total>8192)throw Object.assign(new Error('Request too large'),{status:413});
  parts.push(chunk);
 }
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}
 catch{throw Object.assign(new Error('Invalid JSON'),{status:400})}
}
const forbidden=()=>({status:401,body:{error:'invalid_credentials'}});
function clientKey(request){
 const fromTunnel=process.env.API_PUBLIC_ENABLED==='true'&&request.headers.host===process.env.API_PUBLIC_HOST;
 const forwarded=String(request.headers['cf-connecting-ip']||'');
 const ip=fromTunnel&&/^[0-9a-fA-F:.]{3,45}$/.test(forwarded)?forwarded:(request.socket?.remoteAddress||'loopback');
 return 'login:'+ip;
}
function ipBlocked(key){
 const now=Date.now(),row=ipFailures.get(key);
 if(!row)return false;
 if(now-row.since>WINDOW_MS){ipFailures.delete(key);return false}
 return row.count>=30;
}
function failedIP(key){
 const now=Date.now(),row=ipFailures.get(key);
 ipFailures.set(key,!row||now-row.since>WINDOW_MS?{since:now,count:1}:{...row,count:row.count+1});
 if(ipFailures.size>4000)for(const [k,v] of ipFailures){if(now-v.since>WINDOW_MS||ipFailures.size>4000)ipFailures.delete(k)}
}
export async function resolveSession(pool,request){
 const token=authHeader(request);
 if(!token)return null;
 const [rows]=await pool.execute(
  'SELECT a.id,a.email,a.display_name,a.account_role,a.standing,a.syndicate_rank FROM account_sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>UTC_TIMESTAMP() AND a.is_active=1 AND a.approval_status="approved" LIMIT 1',
  [hashToken(token)]
 );
 return rows[0]||null;
}
export async function authRoute(pool,request,path){
 if(!pool)return {status:503,body:{error:'database_not_configured'}};
 if(path==='/auth/login'&&request.method==='POST'){
  const body=await readJSON(request);
  const email=normalizeEmail(body?.email);
  const password=body?.password;
  if(!email||typeof password!=='string'||password.length>1024)return forbidden();
  const ipKey=clientKey(request);
  if(ipBlocked(ipKey)||loginThrottle(email))return {status:429,body:{error:'too_many_attempts'}};
  const [rows]=await pool.execute(
   'SELECT id,password_hash,approval_status FROM accounts WHERE email=? LIMIT 1',[email]
  );
  // For absent users, still perform one expensive hash verification to reduce account enumeration timing.
  const storedHash=rows[0]?.password_hash || await dummyPasswordHash;
  const valid=await verifyPassword(password,storedHash);
  if(!valid){
   // Diagnostic only: no email, password, token, IP or submitted body in logs.
   // Distinguishes missing account vs hash mismatch when tracing local vs tunnel logins.
   console.warn('[Eclipse Order auth] Login rejected:',{
    route:request.headers.host===process.env.API_PUBLIC_HOST?'public':'local',
    account_found:Boolean(rows[0]),
    password_match:false
   });
   noteFailure(email);failedIP(ipKey);return forbidden();
  }
  if(rows[0].approval_status==='pending')return {status:403,body:{error:'account_pending_approval'}};
  if(rows[0].approval_status!=='approved')return {status:403,body:{error:'account_not_approved'}};
  failures.delete(email);
  const token=generateToken();
  await pool.execute('INSERT INTO account_sessions(account_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? HOUR))',
   [rows[0].id,hashToken(token),SESSION_HOURS]);
  return {status:200,body:{access_token:token,token_type:'Bearer',expires_in:SESSION_HOURS*3600}};
 }
 if(path==='/auth/me'&&request.method==='GET'){
  const session=await resolveSession(pool,request);
  if(!session)return {status:401,body:{error:'not_authenticated'}};
  return {status:200,body:{user:{id:session.id,email:session.email,display_name:session.display_name,role:session.account_role,standing:session.standing,syndicate_rank:session.syndicate_rank}}};
 }
 if(path==='/auth/logout'&&request.method==='POST'){
  const token=authHeader(request);
  if(!token)return {status:401,body:{error:'not_authenticated'}};
  await pool.execute('UPDATE account_sessions SET revoked_at=UTC_TIMESTAMP() WHERE token_hash=? AND revoked_at IS NULL',[hashToken(token)]);
  return {status:204,body:null};
 }
 return {status:404,body:{error:'not_found'}};
}
