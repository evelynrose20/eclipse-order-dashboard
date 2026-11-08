import test from 'node:test';
import assert from 'node:assert/strict';
import {mayEnterThralls} from '../src/thralls.js';

test('staff can enter without rank queries',async()=>{
 let calls=0;
 const pool={execute:async()=>{calls++;return [[]]}};
 for(const role of ['domina','high_command','handler'])assert.equal(await mayEnterThralls(pool,{id:'staff',account_role:role}),true);
 assert.equal(calls,0);
});
test('household assignments grant access',async()=>{
 const pool={execute:async(sql)=>[sql.includes("track='household'")?[{yes:1}]:[]]};
 assert.equal(await mayEnterThralls(pool,{id:'h',account_role:'member'}),true);
});
test('bound/thrall character ownership grants access',async()=>{
 const pool={execute:async(sql)=>[sql.includes('FROM characters c')?[{yes:1}]:[]]};
 assert.equal(await mayEnterThralls(pool,{id:'t',account_role:'member'}),true);
});
test('ordinary members are denied',async()=>{
 const pool={execute:async()=>[[]]};
 assert.equal(await mayEnterThralls(pool,{id:'m',account_role:'member'}),false);
});
