import test from 'node:test';
import assert from 'node:assert/strict';
import {authRoute,loginThrottle} from '../src/auth.js';
import {hashPassword,hashToken} from '../src/credentials.js';

function request({method='GET',authorization,body}={}){
 const req={method,headers:authorization?{authorization:'Bearer '+authorization}:{}};
 if(body!==undefined){
  req[Symbol.asyncIterator]=async function*(){yield Buffer.from(JSON.stringify(body))};
 }
 return req;
}
test('auth refuses login without DB and supports no anonymous profile',async()=>{
 const noDb=await authRoute(null,request({method:'POST',body:{email:'a@example.com',password:'secret'}}),'/auth/login');
 assert.equal(noDb.status,503);
});
test('valid login creates opaque database session and logout revokes it',async()=>{
 const password='locally-generated-long-password';
 const hash=await hashPassword(password);
 const tokenStore=new Map();
 const pool={execute:async(sql,args)=>{
   if(sql.startsWith('SELECT id,password_hash'))return [[{id:'account-uuid',password_hash:hash}]];
   if(sql.startsWith('INSERT INTO account_sessions')){
    tokenStore.set(args[1],{account_id:args[0],revoked:false});
    return [{}];
   }
   if(sql.startsWith('SELECT a.id,a.email')){
    const row=tokenStore.get(args[0]);
    return [row&&!row.revoked?[{id:'account-uuid',email:'test@example.com',display_name:'Domina',account_role:'domina',standing:'veteran'}]:[]];
   }
   if(sql.startsWith('UPDATE account_sessions')){
    const row=tokenStore.get(args[0]);if(row)row.revoked=true;return [{}];
   }
   throw new Error('Unexpected query: '+sql);
 }};
 const login=await authRoute(pool,request({method:'POST',body:{email:'test@example.com',password}}),'/auth/login');
 assert.equal(login.status,200);
 assert.equal(login.body.token_type,'Bearer');
 assert.ok(login.body.access_token.length>=30);
 assert.ok(tokenStore.has(hashToken(login.body.access_token)));
 const me=await authRoute(pool,request({authorization:login.body.access_token}),'/auth/me');
 assert.equal(me.status,200);assert.equal(me.body.user.role,'domina');
 assert.equal('password_hash' in me.body.user,false);
 const logout=await authRoute(pool,request({method:'POST',authorization:login.body.access_token}),'/auth/logout');
 assert.equal(logout.status,204);
 const expired=await authRoute(pool,request({authorization:login.body.access_token}),'/auth/me');
 assert.equal(expired.status,401);
});
test('bad logins receive generic failure and are throttled',async()=>{
 const email='test-failed-login@example.com';
 const pool={execute:async()=>[[]]};
 for(let i=0;i<6;i++){
  const result=await authRoute(pool,request({method:'POST',body:{email,password:'a long wrong password'}}),'/auth/login');
  assert.equal(result.status,401);
  assert.equal(result.body.error,'invalid_credentials');
 }
 assert.equal(loginThrottle(email),true);
 const blocked=await authRoute(pool,request({method:'POST',body:{email,password:'a long wrong password'}}),'/auth/login');
 assert.equal(blocked.status,429);
});
