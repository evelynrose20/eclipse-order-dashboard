import test from 'node:test';
import assert from 'node:assert/strict';
import {firstDominaRoute} from '../src/first-domina.js';
import {verifyPassword} from '../src/credentials.js';

const path='/auth/setup-domina';
const options={publicEnabled:false,allowedOrigin:'http://localhost:5173'};
function request(data,origin='http://localhost:5173'){
 return {method:'POST',headers:{host:'127.0.0.1:3182',origin},
 [Symbol.asyncIterator]:async function*(){yield Buffer.from(JSON.stringify(data))}};
}
test('first Domina setup uses browser password, stores a hash and only works once',async()=>{
 let count=0,insert;
 const connection={
  query:async(sql)=>{
   if(sql.includes('GET_LOCK'))return [[{acquired:1}]];
   if(sql.includes('RELEASE_LOCK'))return [[{released:1}]];
   if(sql.includes('COUNT(*)'))return [[{n:count}]];
   throw Error('unexpected query');
  },
  execute:async(sql,values)=>{insert=values;count=1;return [{affectedRows:1}]},
  release:()=>{}
 };
 const pool={query:async()=>[[{n:count}]],getConnection:async()=>connection};
 const data={email:'admin@example.com',display_name:'Domina',password:'an example long password 123'};
 const created=await firstDominaRoute(pool,request(data),path,options);
 assert.equal(created.status,201);
 assert.equal(insert[1],'admin@example.com');
 assert.ok(await verifyPassword(data.password,insert[2]));
 assert.equal(insert[2].includes(data.password),false);
 const again=await firstDominaRoute(pool,request(data),path,options);
 assert.equal(again.status,409);
});
test('first Domina setup is unavailable publicly or from unrelated origins',async()=>{
 const pool={query:async()=>[[{n:0}]]};
 const data={email:'admin@example.com',display_name:'Domina',password:'an example long password 123'};
 assert.equal((await firstDominaRoute(pool,request(data),path,{...options,publicEnabled:true})).status,404);
 assert.equal((await firstDominaRoute(pool,request(data,'https://attacker.example'),path,options)).status,403);
});
