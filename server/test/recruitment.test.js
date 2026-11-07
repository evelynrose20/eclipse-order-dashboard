import test from 'node:test';
import assert from 'node:assert/strict';
import {recruitmentRoute,normalizeRecruitmentStatus,validReopeningDate} from '../src/recruitment.js';
import {generateToken,hashToken} from '../src/credentials.js';

test('recruitment state defaults to open for sites without a saved setting',()=>{
 assert.equal(normalizeRecruitmentStatus(undefined),'open');
 assert.equal(normalizeRecruitmentStatus('invalid'),'open');
 for(const s of ['open','limited','closed'])assert.equal(normalizeRecruitmentStatus(s),s);
});
test('public visitors may read recruitment but never alter it',async()=>{
 const pool={execute:async sql=>{
  if(sql.includes('SELECT setting_key,content FROM order_settings'))return [[{setting_key:'recruitment_status',content:'closed'},{setting_key:'recruitment_reason',content:'Members are preparing a major event.'},{setting_key:'recruitment_reopens',content:'2026-12-01'},{setting_key:'recruitment_reopening_note',content:'We hope to reopen after the event.'}]];
  return [[]];
 }};
 assert.deepEqual(await recruitmentRoute(pool,{method:'GET'},'/recruitment'),{status:200,body:{status:'closed',reason:'Members are preparing a major event.',reopens_on:'2026-12-01',reopening_note:'We hope to reopen after the event.'}});
 const req={method:'PUT',headers:{},[Symbol.asyncIterator]:async function*(){yield Buffer.from('{"status":"open"}')}};
 assert.equal((await recruitmentRoute(pool,req,'/recruitment')).status,401);
});
test('only Domina can change recruitment and changes are audited',async()=>{
 const token=generateToken();
 const actions=[];
 const pool={execute:async(sql,args=[])=>{
  actions.push(sql);
  if(sql.startsWith('SELECT a.id,a.email'))return [[{id:'11111111-1111-4111-8111-111111111111',account_role:'domina',auth_method:'discord'}]];
  if(sql.includes('SELECT setting_key,content FROM order_settings'))return [[{setting_key:'recruitment_status',content:'open'}]];
  if(sql.startsWith('INSERT INTO'))return [{affectedRows:1}];
  return [[]];
 }};
 const req={method:'PUT',headers:{authorization:'Bearer '+token},[Symbol.asyncIterator]:async function*(){yield Buffer.from(JSON.stringify({status:'closed',reason:'Closed for preparations',reopens_on:'2026-12-01',reopening_note:'After the next event'}))}};
 pool.getConnection=async()=>({execute:(...args)=>pool.execute(...args),beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{}});
 const result=await recruitmentRoute(pool,req,'/recruitment');
 assert.equal(result.status,200);
 assert.equal(result.body.status,'closed');
 assert.equal(result.body.reason,'Closed for preparations');
 assert.equal(result.body.reopens_on,'2026-12-01');
 assert.equal(result.body.reopening_note,'After the next event');
 assert.ok(actions.some(q=>q.includes("INSERT INTO order_settings")));
 assert.ok(actions.some(q=>q.includes('INSERT INTO audit_log')));
});

test('calendar dates must be real and optional reopening predictions never change recruitment automatically',()=>{
 assert.equal(validReopeningDate(null),true);
 assert.equal(validReopeningDate(''),true);
 assert.equal(validReopeningDate('2026-02-29'),false);
 assert.equal(validReopeningDate('2026-12-15'),true);
 assert.equal(validReopeningDate('tomorrow'),false);
});
