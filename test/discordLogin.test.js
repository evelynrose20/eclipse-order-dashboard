import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('only Discord login is rendered by portal and no alternate login application remains',()=>{
 const login=read('src/LocalAccounts.jsx'),app=read('App.jsx');
 assert.match(login,/Continue with Discord/);
 assert.match(login,/Request to join the Order’s Discord/);
 assert.match(login,/Bad End Roleplay Free Company/);
 assert.match(login,/adult_confirmed:true/);
 assert.doesNotMatch(login,/<input[^>]*type="password"|\/auth\/login|\/auth\/register|Password<input/);
 assert.doesNotMatch(app,/Dashboard\/|<Dashboard\/>/);
});
test('Discord server access is verified by bot and opt-in server join is distinct from login',()=>{
 const api=read('server/src/discord-oauth.js'),guild=read('server/src/discord-guild.js'),auth=read('server/src/auth.js');
 assert.match(api,/guilds\.join/);
 assert.match(api,/discord_not_in_server/);
 assert.match(api,/approval_status/);
 assert.match(guild,/https:\/\/discord\.com\/api\/v10\/guilds\//);
 assert.match(guild,/method:'PUT'/);
 assert.match(auth,/checkGuildMember/);
 assert.match(read('server/src/accounts.js'),/discord_only_registration/);
});
test('new migration and public site explain Discord onboarding and Bad End RP',()=>{
 const schema=read('server/sql/015_discord_membership.sql');
 const site=read('src/PublicSite.jsx');
 assert.match(schema,/adult_confirmed/);
 assert.match(schema,/intent ENUM\('login','join'\)/);
 assert.match(site,/id="bad-end"/);
 assert.match(site,/BAD END FC/);
 assert.match(site,/PLAYER CONSENT/);
 assert.match(site,/Discord server membership and approval/);
});

test('Discord rejection renders a standalone, actionable access page rather than only a login error',()=>{
 const view=read('src/DiscordAccessPage.jsx');
 const portal=read('src/LocalAccounts.jsx');
 assert.match(view,/The door is not open yet/);
 assert.match(view,/The Order cannot confirm the server/);
 assert.match(view,/Request to join the Order’s Discord/);
 assert.match(view,/Verify with Discord again/);
 assert.match(view,/Discord server ID and bot configuration/);
 assert.match(portal,/reason=\{reason\}/);
 assert.match(portal,/discord_guild_configuration_error/);
 assert.match(read('src/discord-access-page.css'),/@media\(max-width:540px\)/);
});
