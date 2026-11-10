import {discordOAuthConfig} from './discord-oauth.js';
import {validSnowflake,guildConfiguration} from './discord-guild.js';

export function inspectDiscordConfig(env=process.env){
 const issues=[];
 const origin=env.API_ALLOWED_ORIGIN||'';
 const apiHost=env.API_PUBLIC_HOST||'';
 const callback=env.DISCORD_REDIRECT_URI||'';
 const frontend=env.DISCORD_FRONTEND_URL||'';
 if(!/^https:\/\/[a-z0-9.-]+$/.test(origin))issues.push('API_ALLOWED_ORIGIN must be an HTTPS origin without backslashes, whitespace, path, or trailing slash.');
 if(!/^api\.[a-z0-9.-]+$/.test(apiHost))issues.push('API_PUBLIC_HOST must be the public API hostname, without https://.');
 if(!validSnowflake(env.DISCORD_CLIENT_ID))issues.push('DISCORD_CLIENT_ID is missing or is not a valid Discord application ID.');
 if(!env.DISCORD_CLIENT_SECRET)issues.push('DISCORD_CLIENT_SECRET is missing.');
 if(!/^https:\/\/[^/#?]+\/auth\/discord\/callback$/.test(callback))issues.push('DISCORD_REDIRECT_URI must be the HTTPS API callback, ending in /auth/discord/callback.');
 if(origin==='https://rosefires.com'&&callback!=='https://api.rosefires.com/auth/discord/callback')issues.push('DISCORD_REDIRECT_URI must be https://api.rosefires.com/auth/discord/callback for this deployment.');
 if(!validSnowflake(env.DISCORD_GUILD_ID))issues.push('DISCORD_GUILD_ID is missing or invalid.');
 if(!guildConfiguration(env))issues.push('DISCORD_BOT_TOKEN is missing or too short.');
 if(frontend){
  try{
   const old=['https://evelynrose20.github.io/eclipse-order-dashboard','https://evelynrose20.github.io/eclipse-order-dashboard/'].includes(frontend);
   const url=new URL(frontend);
   if(!old&&url.origin!==origin)issues.push('DISCORD_FRONTEND_URL points to another origin. Use '+origin+'/.');
  }catch{issues.push('DISCORD_FRONTEND_URL is not a valid HTTPS URL.')}
 }
 if(!discordOAuthConfig(env)&&issues.length===0)issues.push('Discord OAuth configuration failed validation; check the exact frontend and API URLs.');
 return {configured:Boolean(discordOAuthConfig(env)),issues,origin,apiHost,callback,frontend};
}
if(import.meta.url===new URL(process.argv[1]||'', 'file://').href){
 const result=inspectDiscordConfig();
 console.log(result.configured?'Discord OAuth settings: VALID':'Discord OAuth settings: INVALID');
 if(result.issues.length)for(const issue of result.issues)console.log(' - '+issue);
 else console.log(' - Configuration can start OAuth. Ensure this callback URL is registered in the Discord Developer Portal: '+result.callback);
 console.log(' - No client secrets or bot tokens were displayed.');
 process.exitCode=result.configured?0:1;
}
