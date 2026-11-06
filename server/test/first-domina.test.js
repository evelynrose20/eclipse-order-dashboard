import test from 'node:test';
import assert from 'node:assert/strict';
import {firstDominaRoute} from '../src/first-domina.js';
const options={publicEnabled:false,allowedOrigin:'http://localhost:5173'};
const req={method:'POST',headers:{host:'127.0.0.1:3182',origin:'http://localhost:5173'}};
test('password-based first Domina creation is disabled even locally',async()=>{
 const pool={query:async()=>[[{n:0}]]};
 const r=await firstDominaRoute(pool,req,'/auth/setup-domina',options);
 assert.equal(r.status,403);
 assert.equal(r.body.error,'discord_only_registration');
});
test('public bootstrap remains inaccessible and local status remains available',async()=>{
 const pool={query:async()=>[[{n:0}]]};
 const external=await firstDominaRoute(pool,req,'/auth/setup-domina',{...options,publicEnabled:true});
 assert.equal(external.status,404);
 const status=await firstDominaRoute(pool,{...req,method:'GET'},'/auth/setup-status',options);
 assert.equal(status.status,200);
});
