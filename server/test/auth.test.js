import test from 'node:test';
import assert from 'node:assert/strict';
import {authRoute,resolveSession} from '../src/auth.js';
import {generateToken,hashToken} from '../src/credentials.js';

const token=generateToken();
const request=(method='GET',authorization)=>({method,headers:authorization?{authorization:'Bearer '+authorization}:{}});
test('email/password sign-in is disabled even for previously approved accounts',async()=>{
 const pool={execute:async()=>{throw Error('Password credentials must never be read')}};
 const result=await authRoute(pool,request('POST'),'/auth/login');
 assert.equal(result.status,403);
 assert.equal(result.body.error,'discord_only_login');
});
test('Discord-created sessions remain opaque and logout revokes a session',async()=>{
 let revoked=false;
 const pool={execute:async(sql,args)=>{
  if(sql.startsWith('SELECT a.id,a.email'))return [revoked?[]:[{id:'account-id',email:'discord@members.eclipse.invalid',display_name:'Order Member',account_role:'member',standing:'initiate',discord_user_id:'123456789012345678'}]];
  if(sql.startsWith('UPDATE account_sessions')){assert.equal(args[0],hashToken(token));revoked=true;return [{affectedRows:1}]}
  throw Error('Unexpected query: '+sql);
 }};
 const current=await authRoute(pool,request('GET',token),'/auth/me');
 assert.equal(current.status,200);
 assert.equal(current.body.user.role,'member');
 assert.equal('discord_user_id' in current.body.user,false);
 const logout=await authRoute(pool,request('POST',token),'/auth/logout');
 assert.equal(logout.status,204);
 assert.equal(await resolveSession(pool,request('GET',token)),null);
});
test('anonymous requests never see a member profile',async()=>{
 const pool={execute:async()=>{throw Error('Unexpected DB access')}};
 const result=await authRoute(pool,request(),'/auth/me');
 assert.equal(result.status,401);
});
