import test from 'node:test';
import assert from 'node:assert/strict';
import {discordRoute,discordOAuthConfig,discordAuthorizationUrl} from '../src/discord-oauth.js';
import {hashToken,generateToken} from '../src/credentials.js';

const uid='11111111-1111-4111-8111-111111111111';
const discordId='123456789012345678';
const authToken=generateToken();
const env={DISCORD_CLIENT_ID:'987654321098765432',DISCORD_CLIENT_SECRET:'private-test-secret',
 DISCORD_REDIRECT_URI:'https://api.rosefires.com/auth/discord/callback',DISCORD_GUILD_ID:'123456789012345679',
 DISCORD_BOT_TOKEN:'test-bot-token-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
 API_ALLOWED_ORIGIN:'https://evelynrose20.github.io',
 DISCORD_FRONTEND_URL:'https://evelynrose20.github.io/eclipse-order-dashboard/'};
function request(method='GET',{token,body}={}){
 return {method,headers:token?{authorization:'Bearer '+token}:{},[Symbol.asyncIterator]:async function*(){if(body!==undefined)yield Buffer.from(JSON.stringify(body))}};
}
function setup({member=true,screening=false,approved=false,unavailable=false}={}){
 const states=new Map(),tickets=new Map(),links=new Map(),accounts=new Map(),sessions=new Map();
 accounts.set(uid,{id:uid,is_active:1,approval_status:'approved'});
 sessions.set(hashToken(authToken),uid);
 if(approved)links.set(discordId,{account_id:uid,discord_user_id:discordId,discord_username:'Tester'});
 let guildMember=member,memberPending=screening,joinCount=0,lookups=0;
 const calls=[];
 const pool={execute:async(sql,args=[])=>{
  calls.push({sql,args});
  if(sql.startsWith('SELECT a.id,a.email')){const account=sessions.get(args[0]);return [account?[{id:account,account_role:'domina',discord_user_id:discordId}]:[]]}
  if(sql.startsWith('DELETE FROM discord_oauth_states WHERE expires_at')||sql.startsWith('DELETE FROM discord_oauth_tickets WHERE expires_at'))return [{affectedRows:0}];
  if(sql.startsWith('SELECT discord_user_id FROM account_discord_links')){const row=[...links.values()].find(x=>x.account_id===args[0]);return [row?[row]:[]]}
  if(sql.startsWith('SELECT discord_user_id,discord_username FROM account_discord_links')){const row=[...links.values()].find(x=>x.account_id===args[0]);return [row?[row]:[]]}
  if(sql.startsWith('INSERT INTO discord_oauth_states')){states.set(args[0],{target_account_id:args[1],intent:args[2],adult_confirmed:args[3],used:false});return [{affectedRows:1}]}
  if(sql.startsWith('UPDATE discord_oauth_states')){const state=states.get(args[0]);if(!state||state.used)return [{affectedRows:0}];state.used=true;return [{affectedRows:1}]}
  if(sql.startsWith('SELECT target_account_id,intent')){const row=states.get(args[0]);return [row?[row]:[]]}
  if(sql.startsWith('SELECT account_id FROM account_discord_links WHERE discord_user_id=? AND account_id=?')){const row=links.get(args[0]);return [row&&row.account_id===args[1]?[row]:[]]}
  if(sql.startsWith('SELECT account_id FROM account_discord_links WHERE discord_user_id')){const row=links.get(args[0]);return [row?[row]:[]]}
  if(sql.startsWith('INSERT INTO accounts')){accounts.set(args[0],{id:args[0],is_active:0,approval_status:'pending'});return [{affectedRows:1}]}
  if(sql.startsWith('INSERT INTO account_discord_links')){if(links.has(args[1]))throw Object.assign(Error('duplicate'),{code:'ER_DUP_ENTRY'});links.set(args[1],{account_id:args[0],discord_user_id:args[1],discord_username:args[2]});return [{affectedRows:1}]}
  if(sql.startsWith('INSERT INTO discord_oauth_tickets')){tickets.set(args[0],{account_id:args[1],discord_user_id:args[2],discord_username:args[3],intent:'login',used:false});return [{affectedRows:1}]}
  if(sql.startsWith('UPDATE discord_oauth_tickets')){const t=tickets.get(args[0]);if(!t||t.used)return [{affectedRows:0}];t.used=true;return [{affectedRows:1}]}
  if(sql.startsWith('SELECT account_id,discord_user_id,discord_username,intent FROM discord_oauth_tickets')){const t=tickets.get(args[0]);return [t?[t]:[]]}
  if(sql.startsWith('SELECT id,is_active,approval_status FROM accounts')){const a=accounts.get(args[0]);return [a?[a]:[]]}
  if(sql.startsWith('INSERT INTO account_sessions')){sessions.set(args[1],args[0]);return [{affectedRows:1}]}
  throw Error('Unexpected SQL: '+sql);
 }};
 pool.getConnection=async()=>({execute:(sql,args)=>pool.execute(sql,args),beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{}});
 const httpFetch=async(url,options={})=>{
  if(url.includes('/oauth2/token'))return {ok:true,status:200,json:async()=>({access_token:'discord-access-token',scope:'identify guilds.join'})};
  if(url.includes('/users/@me'))return {ok:true,status:200,json:async()=>({id:discordId,username:'Tester'})};
  if(url.includes('/guilds/')){
   if(options.method==='PUT'){joinCount++;guildMember=true;return {ok:true,status:201,json:async()=>({pending:memberPending})}}
   lookups++;if(unavailable)return {ok:false,status:503};
   if(!guildMember)return {ok:false,status:404,json:async()=>({code:10007,message:'Unknown Member'})};
   return {ok:true,status:200,json:async()=>({pending:memberPending})};
  }
  throw Error('Unexpected request: '+url);
 };
 return {pool,httpFetch,links,accounts,calls,metrics:()=>({joinCount,lookups})};
}
const call=(m,path,req,query='')=>discordRoute(m.pool,req,path,{env,httpFetch:m.httpFetch,query});
const frag=(redirect,key)=>new URLSearchParams(new URL(redirect).hash.slice(1)).get(key);
async function authorize(m,{intent='login',token}={}){
 const start=await call(m,'/auth/discord/start',request('POST',{token,body:{intent,adult_confirmed:true}}));
 assert.equal(start.status,200,JSON.stringify(start.body));
 const url=new URL(start.body.authorization_url);
 return {url,state:url.searchParams.get('state')};
}
async function callback(m,state){
 return call(m,'/auth/discord/callback',request(),'state='+encodeURIComponent(state)+'&code=sample-code');
}
test('Discord login uses secure fixed redirects and opt-in join scope only',async()=>{
 const config=discordOAuthConfig(env);
 assert.ok(config);
 const login=new URL(discordAuthorizationUrl(config,'state'));
 const join=new URL(discordAuthorizationUrl(config,'state','join'));
 assert.equal(login.searchParams.get('scope'),'identify');
 assert.equal(join.searchParams.get('scope'),'identify guilds.join');
 assert.equal(discordOAuthConfig({...env,DISCORD_FRONTEND_URL:'https://bad.example/'}),null);
 assert.equal(discordOAuthConfig({...env,DISCORD_GUILD_ID:''}),null);
 assert.equal(discordOAuthConfig({...env,DISCORD_FRONTEND_URL:'https://evelynrose20.github.io/'}).frontendUrl,'https://evelynrose20.github.io/eclipse-order-dashboard/');
 assert.equal(discordOAuthConfig({...env,DISCORD_FRONTEND_URL:''}).frontendUrl,'https://evelynrose20.github.io/eclipse-order-dashboard/');
});
test('adult acknowledgement is mandatory before beginning Discord OAuth',async()=>{
 const m=setup();
 const result=await call(m,'/auth/discord/start',request('POST',{body:{adult_confirmed:false}}));
 assert.equal(result.status,400);assert.equal(result.body.error,'adult_declaration_required');
});
test('a verified Discord member without an account enters pending approval, not the portal',async()=>{
 const m=setup();
 const {state}=await authorize(m);
 const redirect=await callback(m,state);
 assert.equal(redirect.status,302);
 const ticket=frag(redirect.redirect,'discord_ticket');assert.ok(ticket);
 const completed=await call(m,'/auth/discord/complete',request('POST',{body:{ticket}}));
 assert.equal(completed.status,200);
 assert.equal(completed.body.status,'pending');
 assert.equal('access_token' in completed.body,false);
 assert.equal(m.links.get(discordId).account_id!==uid,true);
 assert.equal(m.metrics().joinCount,0);
});
test('linked and approved Discord guild member signs in; tickets cannot be reused',async()=>{
 const m=setup({approved:true});
 const {state}=await authorize(m);
 const redirect=await callback(m,state);
 const ticket=frag(redirect.redirect,'discord_ticket');
 const completed=await call(m,'/auth/discord/complete',request('POST',{body:{ticket}}));
 assert.equal(completed.status,200,JSON.stringify(completed.body));
 assert.match(completed.body.access_token,/^[A-Za-z0-9_-]{40,}$/);
 assert.equal((await call(m,'/auth/discord/complete',request('POST',{body:{ticket}}))).status,409);
});
test('a nonmember is refused and is not joined silently; opt-in OAuth can request joining',async()=>{
 const m=setup({member:false});
 const {state}=await authorize(m);
 const denied=await callback(m,state);
 assert.equal(frag(denied.redirect,'discord_error'),'discord_not_in_server');
 assert.equal(m.metrics().joinCount,0);
 const join=await authorize(m,{intent:'join'});
 assert.equal(join.url.searchParams.get('scope'),'identify guilds.join');
 const redirected=await callback(m,join.state);
 assert.ok(frag(redirected.redirect,'discord_ticket'));
 assert.equal(m.metrics().joinCount,1);
});
test('Discord screening blocks access even after an opt-in join',async()=>{
 const m=setup({member:false,screening:true});
 const {state}=await authorize(m,{intent:'join'});
 const redirect=await callback(m,state);
 assert.equal(frag(redirect.redirect,'discord_error'),'discord_membership_screening');
});
test('Discord check outages fail closed; reused states cannot be redeemed',async()=>{
 const m=setup({approved:true,unavailable:true});
 const {state}=await authorize(m);
 const redirect=await callback(m,state);
 assert.equal(frag(redirect.redirect,'discord_error'),'discord_server_check_unavailable');
 const replay=await callback(m,state);
 assert.equal(frag(replay.redirect,'discord_error'),'discord_expired_request');
});
test('unlinking Discord is disabled because no alternate login method exists',async()=>{
 const m=setup({approved:true});
 const result=await call(m,'/auth/discord/unlink',request('POST',{token:authToken}));
 assert.equal(result.status,409);
 assert.equal(m.links.has(discordId),true);
});
