import {generateToken,hashToken} from './credentials.js';
import {resolveSession} from './auth.js';

const SESSION_HOURS=12;
const STATE_MINUTES=10;
const TICKET_MINUTES=3;
const startAttempts=new Map();
const WINDOW_MS=15*60*1000;
function throttleStart(request,env,now=Date.now()){
 const publicRequest=env.API_PUBLIC_ENABLED==='true'&&request.headers.host===env.API_PUBLIC_HOST;
 const forwarded=String(request.headers['cf-connecting-ip']||'');
 const source=publicRequest&&/^[0-9a-fA-F:.]{3,45}$/.test(forwarded)?forwarded:request.socket?.remoteAddress||'local';
 const previous=startAttempts.get(source);
 const count=previous&&now-previous.since<WINDOW_MS?previous.count+1:1;
 startAttempts.set(source,{count,since:count===1?now:previous.since});
 if(startAttempts.size>3000)for(const [key,item] of startAttempts){if(now-item.since>WINDOW_MS||startAttempts.size>3000)startAttempts.delete(key)}
 return count>15;
}
const fail=(status,error)=>({status,body:{error}});
const good=body=>({status:200,body});
const discordUserId=id=>typeof id==='string'&&/^\d{15,25}$/.test(id);
const hash=hashToken;
const configured=env=>Boolean(/^\d{15,25}$/.test(env.DISCORD_CLIENT_ID||'')&&env.DISCORD_CLIENT_SECRET&&/^https:\/\/[^/#?]+\/auth\/discord\/callback$/.test(env.DISCORD_REDIRECT_URI||'')&&/^https:\/\/[^/#?]+$/.test(env.API_ALLOWED_ORIGIN||''));
// Never trust request-supplied URLs, identities, or scopes; use server configuration only.
export function discordOAuthConfig(env=process.env){
 if(!configured(env))return null;
 const site=env.DISCORD_FRONTEND_URL||env.API_ALLOWED_ORIGIN+'/';
 let siteUrl;
 try{siteUrl=new URL(site)}catch{return null}
 if(siteUrl.origin!==env.API_ALLOWED_ORIGIN||siteUrl.protocol!=='https:'||siteUrl.username||siteUrl.password||siteUrl.hash)return null;
 return {clientId:env.DISCORD_CLIENT_ID,secret:env.DISCORD_CLIENT_SECRET,redirectUri:env.DISCORD_REDIRECT_URI,frontendOrigin:env.API_ALLOWED_ORIGIN,frontendUrl:siteUrl.href};
}
export function discordAuthorizationUrl(config,state){
 const url=new URL('https://discord.com/oauth2/authorize');
 url.searchParams.set('response_type','code');
 url.searchParams.set('client_id',config.clientId);
 url.searchParams.set('redirect_uri',config.redirectUri);
 url.searchParams.set('scope','identify');
 url.searchParams.set('state',state);
 url.searchParams.set('prompt','consent');
 return url.toString();
}
function returnUrl(config,params){
 const url=new URL(config.frontendUrl||config.frontendOrigin+'/');
 url.searchParams.set('portal','');
 url.hash=new URLSearchParams(params).toString();
 return url.toString();
}
function redirect(config,params){
 return {status:302,redirect:returnUrl(config,params),body:null};
}
export async function fetchDiscordIdentity(config,code,httpFetch=fetch){
 const response=await httpFetch('https://discord.com/api/oauth2/token',{
  method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({client_id:config.clientId,client_secret:config.secret,grant_type:'authorization_code',code,redirect_uri:config.redirectUri}),
  signal:AbortSignal.timeout(8000)
 });
 if(!response.ok)throw new Error('discord_token_exchange_failed');
 const token=await response.json();
 if(typeof token.access_token!=='string'||!token.access_token||!String(token.scope||'').split(' ').includes('identify'))throw new Error('discord_bad_token');
 const who=await httpFetch('https://discord.com/api/v10/users/@me',{
  headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(8000)
 });
 if(!who.ok)throw new Error('discord_identity_unavailable');
 const user=await who.json();
 if(!discordUserId(user.id))throw new Error('discord_invalid_identity');
 return {id:user.id,username:String(user.global_name||user.username||'Discord user').slice(0,100)};
}
async function bodyJSON(request){
 const chunks=[];let length=0;
 for await(const chunk of request){length+=chunk.length;if(length>2048)throw Object.assign(new Error('request_too_large'),{status:413});chunks.push(chunk)}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}
}
function ticketValid(value){return typeof value==='string'&&/^[A-Za-z0-9_-]{40,100}$/.test(value)}
export async function discordRoute(pool,request,path,{env=process.env,httpFetch=fetch,query=''}={}){
 if(!pool)return fail(503,'database_unavailable');
 if(path==='/auth/discord/status'&&request.method==='GET'){
  const session=await resolveSession(pool,request);
  if(!session)return fail(401,'not_authenticated');
  const [links]=await pool.execute('SELECT discord_user_id,discord_username FROM account_discord_links WHERE account_id=? LIMIT 1',[session.id]);
  return good({enabled:!!discordOAuthConfig(env),linked:!!links.length,username:links[0]?.discord_username||null});
 }
 const config=discordOAuthConfig(env);
 if(!config)return fail(503,'discord_login_not_configured');
 if(path==='/auth/discord/start'&&request.method==='POST'){
  if(throttleStart(request,env))return fail(429,'too_many_attempts');
  const session=await resolveSession(pool,request);
  if(request.headers.authorization&&!session)return fail(401,'not_authenticated');
  const target=session?.id||null;
  if(target){
   const [linked]=await pool.execute('SELECT discord_user_id FROM account_discord_links WHERE account_id=? LIMIT 1',[target]);
   if(linked.length)return fail(409,'discord_already_linked');
  }
  // Expired handoffs are safe to remove; limit cleanup work per request.
  await pool.execute('DELETE FROM discord_oauth_states WHERE expires_at<UTC_TIMESTAMP() LIMIT 100');
  await pool.execute('DELETE FROM discord_oauth_tickets WHERE expires_at<UTC_TIMESTAMP() LIMIT 100');
  const state=generateToken();
  await pool.execute('INSERT INTO discord_oauth_states(state_hash,target_account_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? MINUTE))',[hash(state),target,STATE_MINUTES]);
  return good({authorization_url:discordAuthorizationUrl(config,state)});
 }
 if(path==='/auth/discord/callback'&&request.method==='GET'){
  const qs=new URLSearchParams(query);
  const state=qs.get('state'),code=qs.get('code');
  if(qs.has('error'))return redirect(config,{discord_error:'discord_denied'});
  if(!ticketValid(state)||!code||code.length>2048)return redirect(config,{discord_error:'discord_invalid_callback'});
  // Consume state atomically before calling Discord, preventing replay and parallel callbacks.
  const [claimed]=await pool.execute('UPDATE discord_oauth_states SET consumed_at=UTC_TIMESTAMP() WHERE state_hash=? AND consumed_at IS NULL AND expires_at>UTC_TIMESTAMP()',[hash(state)]);
  if(claimed.affectedRows!==1)return redirect(config,{discord_error:'discord_expired_request'});
  const [rows]=await pool.execute('SELECT target_account_id FROM discord_oauth_states WHERE state_hash=? LIMIT 1',[hash(state)]);
  if(!rows.length)return redirect(config,{discord_error:'discord_expired_request'});
  let identity;
  try{identity=await fetchDiscordIdentity(config,code,httpFetch)}catch{return redirect(config,{discord_error:'discord_unavailable'})}
  const target=rows[0].target_account_id;
  const [linked]=await pool.execute('SELECT account_id FROM account_discord_links WHERE discord_user_id=? LIMIT 1',[identity.id]);
  if(target){
   if(linked.length)return redirect(config,{discord_error:linked[0].account_id===target?'discord_already_linked':'discord_identity_taken'});
  }else if(!linked.length){
   return redirect(config,{discord_error:'discord_account_not_linked'});
  }
  const ticket=generateToken();
  await pool.execute('INSERT INTO discord_oauth_tickets(ticket_hash,account_id,discord_user_id,discord_username,intent,expires_at) VALUES(?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? MINUTE))',
   [hash(ticket),target||linked[0].account_id,identity.id,identity.username,target?'link':'login',TICKET_MINUTES]);
  return redirect(config,{discord_ticket:ticket});
 }
 if(path==='/auth/discord/complete'&&request.method==='POST'){
  const body=await bodyJSON(request);
  if(!ticketValid(body?.ticket))return fail(400,'discord_invalid_ticket');
  const [claimed]=await pool.execute('UPDATE discord_oauth_tickets SET redeemed_at=UTC_TIMESTAMP() WHERE ticket_hash=? AND redeemed_at IS NULL AND expires_at>UTC_TIMESTAMP()',[hash(body.ticket)]);
  if(claimed.affectedRows!==1)return fail(409,'discord_ticket_expired');
  const [rows]=await pool.execute('SELECT account_id,discord_user_id,discord_username,intent FROM discord_oauth_tickets WHERE ticket_hash=? LIMIT 1',[hash(body.ticket)]);
  if(!rows.length)return fail(409,'discord_ticket_expired');
  const item=rows[0];
  if(item.intent==='link'){
   const session=await resolveSession(pool,request);
   if(!session||session.id!==item.account_id)return fail(403,'discord_link_session_required');
   try{await pool.execute('INSERT INTO account_discord_links(account_id,discord_user_id,discord_username) VALUES(?,?,?)',[item.account_id,item.discord_user_id,item.discord_username])}
   catch(error){if(error.code==='ER_DUP_ENTRY')return fail(409,'discord_identity_taken');throw error}
   return good({status:'linked',discord_username:item.discord_username});
  }
  const [links]=await pool.execute('SELECT account_id FROM account_discord_links WHERE discord_user_id=? AND account_id=? LIMIT 1',[item.discord_user_id,item.account_id]);
  if(!links.length)return fail(403,'discord_account_not_linked');
  const [accounts]=await pool.execute('SELECT id,is_active,approval_status FROM accounts WHERE id=? LIMIT 1',[item.account_id]);
  if(!accounts.length||!accounts[0].is_active||accounts[0].approval_status!=='approved')return fail(403,'account_not_approved');
  const token=generateToken();
  await pool.execute('INSERT INTO account_sessions(account_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? HOUR))',[item.account_id,hash(token),SESSION_HOURS]);
  return good({access_token:token,token_type:'Bearer',expires_in:SESSION_HOURS*3600});
 }
 if(path==='/auth/discord/unlink'&&request.method==='POST'){
  const session=await resolveSession(pool,request);
  if(!session)return fail(401,'not_authenticated');
  await pool.execute('DELETE FROM account_discord_links WHERE account_id=?',[session.id]);
  return good({status:'unlinked'});
 }
 return fail(404,'not_found');
}
