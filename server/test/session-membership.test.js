import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveSession} from '../src/auth.js';
import {generateToken} from '../src/credentials.js';

const token=generateToken();
const request={headers:{authorization:'Bearer '+token}};
const account={id:'a',auth_method:'discord',discord_user_id:'123456789012345678',account_role:'domina'};
const pool={execute:async()=>[[account]]};
const configuration=()=>({guildId:'123456789012345678',botToken:'test-bot-credential-not-used-by-this-test'});
const revoked=[];
const resolve=status=>resolveSession(pool,request,{configuration,checkMembership:async()=>status,revokeMissingMember:async(_pool,id,details)=>{revoked.push({id,...details});return {status:200}}});

test('Discord server members retain access to protected API routes',async()=>{
 assert.deepEqual(await resolve('member'),account);
});
test('Discord non-members do not pass the session guard',async()=>{
 assert.equal(await resolve('not_member'),null);
 assert.deepEqual(revoked.at(-1),{id:'a',reason:'discord_membership_lost'});
});
test('Discord availability failures do not become expired sessions',async()=>{
 const before=revoked.length;
 await assert.rejects(resolve('unavailable'),error=>error.status===503&&error.message==='discord_server_check_unavailable');
 await assert.rejects(resolve('guild_configuration_error'),error=>error.status===503&&error.message==='discord_guild_configuration_error');
 assert.equal(revoked.length,before,'Discord API failures must not revoke accounts');
});
test('Pending Discord screening cannot access protected records',async()=>{
 await assert.rejects(resolve('screening'),error=>error.status===403&&error.message==='discord_membership_screening');
});
test('Missing or expired database sessions cannot be restored by Discord status',async()=>{
 const empty={execute:async()=>[[]]};
 assert.equal(await resolveSession(empty,request,{configuration,checkMembership:async()=> 'member'}),null);
});
