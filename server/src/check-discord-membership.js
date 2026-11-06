// Run only on the Windows backend to distinguish the wrong server/bot from a missing member.
// No credentials, Discord user names, or OAuth tokens are printed.
import {diagnoseGuildAccess,validSnowflake} from './discord-guild.js';
const id=process.argv[2];
if(!validSnowflake(id)){console.error('Usage: npm run discord:check -- YOUR_DISCORD_USER_ID');process.exitCode=2}
else {
 const result=await diagnoseGuildAccess(id);
 console.log('Discord guild diagnosis:',JSON.stringify(result,null,2));
 if(result.status!=='member')process.exitCode=1;
}
