import test from 'node:test';
import assert from 'node:assert/strict';
import {discordRoute,discordOAuthConfig,discordAuthorizationUrl,fetchDiscordIdentity} from '../src/discord-oauth.js';
import {generateToken,hashToken} from '../src/credentials.js';

const uid='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const did='123456789012345678';
const env={DISCORD_CLIENT_ID:'987654321098765432',DISCORD_CLIENT_SECRET:'private-secret-never-send-to-client',DISCORD_REDIRECT_URI:'https://api.rosefires.com/auth/discord/callback',API_ALLOWED_ORIGIN:'https://evelynrose20.github.io',DISCORD_FRONTEND_URL:'https://evelynrose20.github.io/eclipse-order-dashboard/'};
const loginToken=generateToken();
function request(method='GET',{token,body}={}){
 return {method,headers:token?{authorization:'Bearer '+token}:{},[Symbol.asyncIterator]:async function*(){if(body!==undefined)yield Buffer.from(JSON.stringify(body))}};
}
function memory(){
 const states=new Map(),tickets=new Map(),links=new Map(),sessions=new Map();
 sessions.set(hashToken(loginToken),uid);
 const calls=[];
 const pool={execute:async(sql,args=[])=>{
  calls.push({sql,args});
  if(sql.startsWith('SELECT a.id,a.email')){
   const id=sessions.get(args[0]);return [id?[{id,email:'admin@test.example',account_role:'domina'}]:[]];
  }
  if(sql.startsWith('INSERT INTO discord_oauth_states')){states.set(args[0],{account_id:args[1],used:false});return [{affectedRows:1}]}
  if(sql.startsWith('UPDATE discord_oauth_states')){const row=states.get(args[0]);if(!row||row.used)return [{affectedRows:0}];row.used=true;return [{affectedRows:1}]}
  if(sql.startsWith('SELECT target_account_id')){const row=states.get(args[0]);return [row?[{target_account_id:row.account_id}]:[]]}
  if(sql.startsWith('SELECT discord_user_id,discord_username FROM account_discord_links')){const l=[...links.values()].find(x=>x.account_id===args[0]);return [l?[{discord_user_id:l.discord_user_id,discord_username:l.discord_username}]:[]]}
  if(sql.startsWith('SELECT discord_user_id FROM account_discord_links')){const l=[...links.values()].find(x=>x.account_id===args[0]);return [l?[l]:[]]}
  if(sql.startsWith('SELECT account_id FROM account_discord_links WHERE discord_user_id=? AND account_id=?')){const l=links.get(args[0]);return [l&&l.account_id===args[1]?[l]:[]]}
  if(sql.startsWith('SELECT account_id FROM account_discord_links WHERE discord_user_id')){const l=links.get(args[0]);return [l?[l]:[]]}
  if(sql.startsWith('INSERT INTO discord_oauth_tickets')){tickets.set(args[0],{account_id:args[1],discord_user_id:args[2],discord_username:args[3],intent:args[4],used:false});return [{affectedRows:1}]}
  if(sql.startsWith('UPDATE discord_oauth_tickets')){const row=tickets.get(args[0]);if(!row||row.used)return [{affectedRows:0}];row.used=true;return [{affectedRows:1}]}
  if(sql.startsWith('SELECT account_id,discord_user_id,discord_username,intent FROM discord_oauth_tickets')){const row=tickets.get(args[0]);return [row?[row]:[]]}
  if(sql.startsWith('INSERT INTO account_discord_links')){if(links.has(args[1]))throw Object.assign(new Error('duplicate'),{code:'ER_DUP_ENTRY'});links.set(args[1],{account_id:args[0],discord_user_id:args[1],discord_username:args[2]});return [{affectedRows:1}]}
  if(sql.startsWith('SELECT id,is_active,approval_status FROM accounts'))return [[{id:args[0],is_active:1,approval_status:'approved'}]];
  if(sql.startsWith('INSERT INTO account_sessions')){sessions.set(args[1],args[0]);return [{affectedRows:1}]}
  if(sql.startsWith('DELETE FROM account_discord_links')){for(const [id,item] of links)if(item.account_id===args[0])links.delete(id);return [{affectedRows:1}]}
  throw new Error('Unexpected SQL: '+sql);
 }};
 return {pool,links,calls};
}
const fakeFetch=async url=>{
 if(url.includes('oauth2/token'))return {ok:true,json:async()=>({access_token:'test-discord-token',scope:'identify'})};
 if(url.includes('users/@me'))return {ok:true,json:async()=>({id:did,username:'TestUser',global_name:'Player'})};
 throw Error('Unexpected network URL');
};
const call=(pool,path,req,query='')=>discordRoute(pool,req,path,{env,httpFetch:fakeFetch,query});
function getHash(fragmentUrl,key){const frag=new URL(fragmentUrl).hash.slice(1);return new URLSearchParams(frag).get(key)}
test('OAuth configuration checks allowlisted HTTPS callback and safe frontend destination',()=>{
 const config=discordOAuthConfig(env);assert.ok(config);
 const url=new URL(discordAuthorizationUrl(config,'secure-state'));
 assert.equal(url.origin,'https://discord.com');
 assert.equal(url.searchParams.get('scope'),'identify');
 assert.equal(url.searchParams.get('state'),'secure-state');
 assert.equal(url.searchParams.get('redirect_uri'),env.DISCORD_REDIRECT_URI);
 assert.equal(url.searchParams.has('email'),false);
 assert.equal(discordOAuthConfig({...env,DISCORD_FRONTEND_URL:'https://evil.test/'}),null);
 assert.equal(discordOAuthConfig({...env,DISCORD_REDIRECT_URI:'http://localhost:3182/auth/discord/callback'}),null);
});
test('Discord identity is fetched on the backend only',async()=>{
 assert.deepEqual(await fetchDiscordIdentity(discordOAuthConfig(env),'sample-code',fakeFetch),{id:did,username:'Player'});
});
test('a signed-in member can explicitly link Discord; linked identity signs in to same approved account',async()=>{
 const {pool,links}=memory();
 const start=await call(pool,'/auth/discord/start',request('POST',{token:loginToken}));
 assert.equal(start.status,200);
 const state=new URL(start.body.authorization_url).searchParams.get('state');
 const callback=await call(pool,'/auth/discord/callback',request(),'state='+state+'&code=one-use-auth-code');
 assert.equal(callback.status,302);
 assert.ok(callback.redirect.startsWith(env.DISCORD_FRONTEND_URL));
 const ticket=getHash(callback.redirect,'discord_ticket');assert.ok(ticket);
 const link=await call(pool,'/auth/discord/complete',request('POST',{token:loginToken,body:{ticket}}));
 assert.equal(link.status,200);assert.equal(link.body.status,'linked');
 assert.equal(links.get(did).account_id,uid);
 const duplicate=await call(pool,'/auth/discord/complete',request('POST',{token:loginToken,body:{ticket}}));
 assert.equal(duplicate.status,409);
 const loginStart=await call(pool,'/auth/discord/start',request('POST'));
 const loginState=new URL(loginStart.body.authorization_url).searchParams.get('state');
 const loginCallback=await call(pool,'/auth/discord/callback',request(),'state='+loginState+'&code=second-code');
 assert.equal(loginCallback.status,302);
 const loginTicket=getHash(loginCallback.redirect,'discord_ticket');
 const login=await call(pool,'/auth/discord/complete',request('POST',{body:{ticket:loginTicket}}));
 assert.equal(login.status,200);
 assert.match(login.body.access_token,/^[A-Za-z0-9_-]{40,}$/);
 assert.equal('discord_access_token' in login.body,false);
});
test('unknown Discord identities cannot self-register, take over or match by email',async()=>{
 const {pool}=memory();
 const start=await call(pool,'/auth/discord/start',request('POST'));
 const state=new URL(start.body.authorization_url).searchParams.get('state');
 const callback=await call(pool,'/auth/discord/callback',request(),'state='+state+'&code=one-code');
 assert.equal(getHash(callback.redirect,'discord_error'),'discord_account_not_linked');
});
test('OAuth states are single-use and link redemption requires the original signed-in account',async()=>{
 const {pool,links}=memory();
 const start=await call(pool,'/auth/discord/start',request('POST',{token:loginToken}));
 const state=new URL(start.body.authorization_url).searchParams.get('state');
 const callback=await call(pool,'/auth/discord/callback',request(),'state='+state+'&code=one-code');
 const replay=await call(pool,'/auth/discord/callback',request(),'state='+state+'&code=one-code');
 assert.equal(getHash(replay.redirect,'discord_error'),'discord_expired_request');
 const ticket=getHash(callback.redirect,'discord_ticket');
 const crossAccount=await call(pool,'/auth/discord/complete',request('POST',{body:{ticket}}));
 assert.equal(crossAccount.status,403);
 assert.equal(links.size,0);
});
test('connected member may unlink Discord without deleting their Order account',async()=>{
 const {pool,links}=memory();
 links.set(did,{account_id:uid,discord_user_id:did,discord_username:'Player'});
 const response=await call(pool,'/auth/discord/unlink',request('POST',{token:loginToken}));
 assert.equal(response.body.status,'unlinked');
 assert.equal(links.size,0);
});
