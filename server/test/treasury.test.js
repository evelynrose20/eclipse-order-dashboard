import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cycleDate,distributePayroll,treasuryRoute} from '../src/treasury.js';
const schema=readFileSync(new URL('../sql/027_order_treasury_payroll.sql',import.meta.url),'utf8');
const account='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const req=(method,body)=>({method,headers:{authorization:'Bearer '+ 'x'.repeat(48)},[Symbol.asyncIterator]:async function*(){if(body)yield Buffer.from(JSON.stringify(body))}});
const pool=role=>({execute:async sql=>{if(sql.startsWith('SELECT a.id,a.email'))return [[{id:account,account_role:role,auth_method:'discord',discord_user_id:'123456789012345678'}]];throw Error('Unexpected SQL '+sql)}});
test('daily reset is anchored to configurable UTC hour',()=>{
 assert.equal(cycleDate(new Date('2026-11-07T14:59:00Z'),15),'2026-11-06');
 assert.equal(cycleDate(new Date('2026-11-07T15:00:00Z'),15),'2026-11-07');
});
test('daily payroll conserves cash and keeps lower bound rates',()=>{
 const people=[{id:'a',scheduled:5},{id:'b',scheduled:1}];
 const partial=distributePayroll(people,3);
 assert.equal(partial.reduce((n,p)=>n+p.paid,0),3);
 assert.ok(partial[0].paid>=partial[1].paid);
 assert.equal(distributePayroll(people,100).reduce((n,p)=>n+p.paid,0),6);
 assert.equal(distributePayroll(people,0).reduce((n,p)=>n+p.paid,0),0);
});
test('treasury schema preserves records and prevents duplicate daily and mission payouts',()=>{
 for(const table of ['order_treasury','order_payroll_settings','character_wallets','order_payroll_runs','order_treasury_ledger','character_wallet_ledger','order_daily_payroll','order_mission_payments'])assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS '+table));
 assert.match(schema,/PRIMARY KEY\(cycle_date,character_id\)/);
 assert.match(schema,/PRIMARY KEY\(event_id,character_id\)/);
 assert.doesNotMatch(schema,/\bDROP TABLE\b|\bTRUNCATE\b/i);
});
test('members cannot change wage policy or pay missions',async()=>{
 assert.equal((await treasuryRoute(pool('member'),req('POST',{}),'/treasury/settings')).status,403);
 assert.equal((await treasuryRoute(pool('member'),req('POST',{amount:5}),'/treasury/missions/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/pay/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')).status,403);
});
