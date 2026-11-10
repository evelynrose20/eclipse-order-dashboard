import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectDiscordConfig} from '../src/check-discord-config.js';
const valid={
 API_ALLOWED_ORIGIN:'https://rosefires.com',
 API_PUBLIC_HOST:'api.rosefires.com',
 DISCORD_CLIENT_ID:'987654321098765432',
 DISCORD_CLIENT_SECRET:'not-a-real-secret',
 DISCORD_REDIRECT_URI:'https://api.rosefires.com/auth/discord/callback',
 DISCORD_FRONTEND_URL:'https://rosefires.com/',
 DISCORD_GUILD_ID:'123456789012345678',
 DISCORD_BOT_TOKEN:'fake-bot-token-with-enough-length-to-test-xxxx'
};
test('valid rosefires domain and Discord settings pass local configuration diagnostic',()=>{
 const result=inspectDiscordConfig(valid);
 assert.equal(result.configured,true,JSON.stringify(result.issues));
 assert.deepEqual(result.issues,[]);
});
test('normal domain migration catches escaped origin and stale callback, never includes secrets',()=>{
 const result=inspectDiscordConfig({...valid,
  API_ALLOWED_ORIGIN:'https\\://rosefires.com\\',
  DISCORD_REDIRECT_URI:'https://api.old-domain.test/auth/discord/callback'});
 assert.equal(result.configured,false);
 assert.ok(result.issues.some(s=>s.includes('API_ALLOWED_ORIGIN')));
 assert.ok(result.issues.every(s=>!s.includes(valid.DISCORD_CLIENT_SECRET)&&!s.includes(valid.DISCORD_BOT_TOKEN)));
});
test('exact former GitHub Pages return migrates but unknown external origin is still refused',()=>{
 assert.equal(inspectDiscordConfig({...valid,DISCORD_FRONTEND_URL:'https://evelynrose20.github.io/eclipse-order-dashboard/'}).configured,true);
 assert.equal(inspectDiscordConfig({...valid,DISCORD_FRONTEND_URL:'https://foreign.example/'}).configured,false);
});

test('custom-domain legacy project path is identified with the root URL fix',()=>{
 const cfg=inspectDiscordConfig({...valid,DISCORD_FRONTEND_URL:'https://rosefires.com/eclipse-order-dashboard/'});
 assert.equal(cfg.configured,true,'server safely normalizes its callback destination');
 assert.ok(cfg.issues.some(s=>s.includes('old project subpath')));
});
