import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('members may sign in with Discord and exchange only a one-use ticket in browser',()=>{
 const login=read('src/LocalAccounts.jsx');
 assert.match(login,/Continue with Discord/);
 assert.match(login,/\/auth\/discord\/start/);
 assert.match(login,/\/auth\/discord\/complete/);
 assert.match(login,/window\.history\.replaceState/);
 assert.match(login,/sessionStorage\.setItem\(storageKey,result\.access_token\)/);
 assert.match(login,/discordCallbackHandled=useRef\(false\)/);
 assert.doesNotMatch(login,/DISCORD_CLIENT_SECRET|oauth2\/token|discord\.com\/api\/v10\/users/);
});
test('Discord connection settings are account-bound and never grant account roles',()=>{
 const view=read('src/DiscordAccountConnection.jsx');
 const workspace=read('src/LocalWorkspace.jsx');
 assert.match(view,/\/auth\/discord\/status/);
 assert.match(view,/\/auth\/discord\/start/);
 assert.match(view,/\/auth\/discord\/unlink/);
 assert.match(view,/Connect Discord/);
 assert.match(workspace,/<DiscordAccountConnection request=\{request\}/);
 assert.doesNotMatch(view,/syndicate_rank|account_role|password_hash/);
});
test('backend installs a one-account-one-discord identity schema and server-only OAuth exchange',()=>{
 const migration=read('server/sql/014_discord_oauth.sql');
 const server=read('server/src/server.js');
 const module=read('server/src/discord-oauth.js');
 assert.match(migration,/UNIQUE KEY uq_discord_user/);
 assert.match(migration,/CREATE TABLE IF NOT EXISTS discord_oauth_states/);
 assert.match(migration,/CREATE TABLE IF NOT EXISTS discord_oauth_tickets/);
 assert.match(server,/discordRoute\(pool,req,pathname/);
 assert.match(server,/if\(result\.redirect\)/);
 assert.match(module,/scope','identify'/);
 assert.match(module,/discord_account_not_linked/);
 assert.doesNotMatch(module,/guilds\.join|email','/);
});
