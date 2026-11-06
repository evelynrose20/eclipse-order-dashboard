import test from 'node:test';
import assert from 'node:assert/strict';
import {accountRoute} from '../src/accounts.js';
const request=(method='POST')=>({method,headers:{},socket:{remoteAddress:'127.0.0.1'}});
test('email/password registration is disabled; Discord creates pending membership applications',async()=>{
 const pool={execute:async()=>{throw Error('No DB read expected')}};
 const result=await accountRoute(pool,request(),'/auth/register');
 assert.equal(result.status,403);
 assert.equal(result.body.error,'discord_only_registration');
});
test('unauthenticated callers cannot approve membership applications',async()=>{
 const pool={execute:async()=>[[]]};
 const result=await accountRoute(pool,request('GET'),'/admin/accounts');
 assert.equal(result.status,403);
});
