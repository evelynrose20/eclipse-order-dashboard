import test from 'node:test';
import assert from 'node:assert/strict';
import {accountRoute} from '../src/accounts.js';
import {hashToken} from '../src/credentials.js';
function req(body,token,method='POST'){
 const r={method,headers:token?{authorization:'Bearer '+token}:{},socket:{remoteAddress:'127.0.0.1'}};
 r[Symbol.asyncIterator]=async function*(){yield Buffer.from(JSON.stringify(body))};
 return r;
}
test('new registration is pending, inactive and always a member',async()=>{
 let inserted=null;
 const pool={execute:async(query,args)=>{
  if(query.startsWith('SELECT id FROM accounts'))return [[]];
  if(query.startsWith('INSERT INTO accounts')){inserted={query,args};return [{affectedRows:1}]}
  throw Error('Unexpected SQL: '+query);
 }};
 const r=await accountRoute(pool,req({email:'new@rosefires.com',display_name:'New Member',password:'a unique very long password!',adult_declaration:true}),'/auth/register');
 assert.equal(r.status,201);
 assert.equal(r.body.status,'pending');
 assert.ok(inserted.query.includes("'member','initiate',0,'pending'"));
 assert.equal(inserted.args[1],'new@rosefires.com');
 assert.ok(!inserted.args[2].includes('a unique'));
});
test('registration requires adult declaration and a robust password',async()=>{
 const pool={execute:async()=>{throw Error('No database reads should happen')}};
 const r=await accountRoute(pool,req({email:'new2@rosefires.com',display_name:'New Member',password:'notstrong',adult_declaration:false}),'/auth/register');
 assert.equal(r.status,400);
});
test('unauthenticated callers cannot access pending-account list',async()=>{
 const pool={execute:async()=>[[]]};
 const r=await accountRoute(pool,req({},undefined,'GET'),'/admin/accounts');
 assert.equal(r.status,403);
});
test('member sessions cannot approve another account',async()=>{
 const pool={execute:async(query,args)=>{
  if(query.startsWith('SELECT a.id'))return [[{id:'member',email:'member@example.com',account_role:'member'}]];
  throw Error('Member request must not write to database');
 }};
 const r=await accountRoute(pool,req({},'member-token-test-token-12345678909876543210'),'/admin/accounts/11111111-1111-4111-8111-111111111111/approve');
 assert.equal(r.status,403);
});
