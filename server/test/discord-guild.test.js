import test from 'node:test';
import assert from 'node:assert/strict';
import {checkGuildMember,guildConfiguration,joinGuild,invalidateGuildCache} from '../src/discord-guild.js';

const id='123456789012345678';
const env={DISCORD_GUILD_ID:'987654321098765432',DISCORD_BOT_TOKEN:'test-bot-token-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'};
test('guild configuration requires both a valid guild ID and a private bot token',()=>{
 assert.ok(guildConfiguration(env));
 assert.equal(guildConfiguration({...env,DISCORD_GUILD_ID:'bad'}),null);
 assert.equal(guildConfiguration({...env,DISCORD_BOT_TOKEN:''}),null);
});
test('guild verification distinguishes nonmember, screening, full member and Discord outage',async()=>{
 const check=async(response,body)=>checkGuildMember(id,{env,useCache:false,httpFetch:async()=>({status:response,ok:response===200,json:async()=>body})});
 assert.equal(await check(404,null),'not_member');
 assert.equal(await check(200,{pending:true}),'screening');
 assert.equal(await check(200,{pending:false}),'member');
 assert.equal(await check(503,null),'unavailable');
 invalidateGuildCache(id);
});
test('adding a member only uses an expressly provided OAuth token and the server bot token',async()=>{
 const calls=[];
 const httpFetch=async(url,options)=>{
  calls.push({url,options});
  if(options.method==='PUT')return {status:201,ok:true};
  return {status:200,ok:true,json:async()=>({pending:false})};
 };
 const result=await joinGuild(id,'test-access-token',{env,httpFetch});
 assert.equal(result,'member');
 assert.equal(calls[0].options.method,'PUT');
 assert.equal(calls[0].options.headers.Authorization,'Bot '+env.DISCORD_BOT_TOKEN);
 assert.deepEqual(JSON.parse(calls[0].options.body),{access_token:'test-access-token'});
 assert.equal(calls[1].options.method,undefined);
});
test('join is never attempted with an absent OAuth token or unconfigured guild',async()=>{
 const httpFetch=async()=>{throw Error('Must not call Discord')};
 assert.equal(await joinGuild(id,'',{env,httpFetch}),'unavailable');
 assert.equal(await checkGuildMember(id,{env:{},httpFetch}),'unavailable');
});
