import {checkGuildMember,guildConfiguration} from './discord-guild.js';
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
export async function resolveSession(pool,request,{allowUnlinked=false}={}){
 const token=authHeader(request);
 if(!token)return null;
 const [rows]=await pool.execute(
  'SELECT a.id,a.email,a.display_name,a.account_role,a.standing,a.syndicate_rank,l.discord_user_id,l.discord_username,s.auth_method FROM account_sessions s JOIN accounts a ON a.id=s.account_id LEFT JOIN account_discord_links l ON l.account_id=a.id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>UTC_TIMESTAMP() AND a.is_active=1 AND a.approval_status="approved" LIMIT 1',
  [hashToken(token)]
 );
 const account=rows[0];
 if(!account)return null;
 if(allowUnlinked)return account;
 if((guildConfiguration(process.env)||process.env.API_PUBLIC_ENABLED==='true')&&account.auth_method!=='discord')return null;
 // Every authenticated API request is gated by Discord membership, with a short bot lookup cache.
 // Production fails closed when guild verification is not configured.
 if(!guildConfiguration(process.env))return process.env.API_PUBLIC_ENABLED==='true'?null:account;
 if(!account.discord_user_id)return null;
 return await checkGuildMember(account.discord_user_id)==='member'?account:null;
}
export async function authRoute(pool,request,path){
 if(!pool)return {status:503,body:{error:'database_not_configured'}};
 if(path==='/auth/login'&&request.method==='POST')return {status:403,body:{error:'discord_only_login'}};
 if(path==='/auth/me'&&request.method==='GET'){
  const session=await resolveSession(pool,request);
  if(!session)return {status:401,body:{error:'not_authenticated'}};
  const [rows]=await pool.execute('SELECT track,rank_code FROM account_order_ranks WHERE account_id=?',[session.id]);
  const order_ranks=Object.fromEntries(rows.map(row=>[row.track,row.rank_code]));
  return {status:200,body:{user:{id:session.id,email:session.email,display_name:session.display_name,discord_username:session.discord_username||null,role:session.account_role,standing:session.standing,syndicate_rank:session.syndicate_rank,order_ranks}}};
 }
 if(path==='/auth/logout'&&request.method==='POST'){
  const token=authHeader(request);
  if(!token)return {status:401,body:{error:'not_authenticated'}};
  await pool.execute('UPDATE account_sessions SET revoked_at=UTC_TIMESTAMP() WHERE token_hash=? AND revoked_at IS NULL',[hashToken(token)]);
  return {status:204,body:null};
 }
 return {status:404,body:{error:'not_found'}};
}
