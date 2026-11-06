// Discord server access must be verified by the backend bot, not inferred from OAuth login.
// The same membership guard is used for session creation and existing sessions.
export const validSnowflake=value=>typeof value==='string'&&/^\d{15,25}$/.test(value);
export function guildConfiguration(env=process.env){
 if(!validSnowflake(env.DISCORD_GUILD_ID)||typeof env.DISCORD_BOT_TOKEN!=='string'||env.DISCORD_BOT_TOKEN.length<35)return null;
 return {guildId:env.DISCORD_GUILD_ID,botToken:env.DISCORD_BOT_TOKEN};
}
const cache=new Map();
const CACHE_MS=60*1000;
export async function checkGuildMember(discordId,{env=process.env,httpFetch=fetch,useCache=true}={}){
 const config=guildConfiguration(env);
 if(!config||!validSnowflake(discordId))return 'unavailable';
 const cached=cache.get(discordId);
 if(useCache&&cached&&Date.now()-cached.at<CACHE_MS)return cached.status;
 let status='unavailable';
 try{
  const response=await httpFetch('https://discord.com/api/v10/guilds/'+config.guildId+'/members/'+discordId,{
   headers:{Authorization:'Bot '+config.botToken},signal:AbortSignal.timeout(8000)
  });
  if(response.status===404)status='not_member';
  else if(response.ok){const member=await response.json();status=member.pending?'screening':'member'}
 }catch{}
 if(status!=='unavailable'){
  cache.set(discordId,{status,at:Date.now()});
  if(cache.size>3000)for(const [id,v] of cache){if(Date.now()-v.at>CACHE_MS||cache.size>3000)cache.delete(id)}
 }
 return status;
}
export function invalidateGuildCache(discordId){cache.delete(discordId)}
export async function joinGuild(discordId,accessToken,{env=process.env,httpFetch=fetch}={}){
 const config=guildConfiguration(env);
 if(!config||!validSnowflake(discordId)||!accessToken)return 'unavailable';
 try{
  const response=await httpFetch('https://discord.com/api/v10/guilds/'+config.guildId+'/members/'+discordId,{
   method:'PUT',headers:{Authorization:'Bot '+config.botToken,'Content-Type':'application/json'},
   body:JSON.stringify({access_token:accessToken}),signal:AbortSignal.timeout(8000)
  });
  if(![201,204].includes(response.status))return 'unavailable';
  invalidateGuildCache(discordId);
  return checkGuildMember(discordId,{env,httpFetch,useCache:false});
 }catch{return 'unavailable'}
}
