import test from 'node:test';
import assert from 'node:assert/strict';
import {recruitmentRoute,normalizeRecruitmentStatus} from '../src/recruitment.js';
import {generateToken,hashToken} from '../src/credentials.js';

test('recruitment state defaults to open for sites without a saved setting',()=>{
 assert.equal(normalizeRecruitmentStatus(undefined),'open');
 assert.equal(normalizeRecruitmentStatus('invalid'),'open');
 for(const s of ['open','limited','closed'])assert.equal(normalizeRecruitmentStatus(s),s);
});
test('public visitors may read recruitment but never alter it',async()=>{
 const pool={execute:async sql=>{
  if(sql.includes('SELECT content FROM order_settings'))return [[{content:'closed'}]];
  return [[]];
 }};
 assert.deepEqual(await recruitmentRoute(pool,{method:'GET'},'/recruitment'),{status:200,body:{status:'closed'}});
 const req={method:'PUT',headers:{},[Symbol.asyncIterator]:async function*(){yield Buffer.from('{"status":"open"}')}};
 assert.equal((await recruitmentRoute(pool,req,'/recruitment')).status,401);
});
test('only Domina can change recruitment and changes are audited',async()=>{
 const token=generateToken();
 const actions=[];
 const pool={execute:async(sql,args=[])=>{
  actions.push(sql);
  if(sql.startsWith('SELECT a.id,a.email'))return [[{id:'11111111-1111-4111-8111-111111111111',account_role:'domina',auth_method:'discord'}]];
  if(sql.includes('SELECT content FROM order_settings'))return [[{content:'open'}]];
  if(sql.startsWith('INSERT INTO'))return [{affectedRows:1}];
  return [[]];
 }};
 const req={method:'PUT',headers:{authorization:'Bearer '+token},[Symbol.asyncIterator]:async function*(){yield Buffer.from(JSON.stringify({status:'limited'}))}};
 const result=await recruitmentRoute(pool,req,'/recruitment');
 assert.equal(result.status,200);
 assert.equal(result.body.status,'limited');
 assert.ok(actions.some(q=>q.includes("INSERT INTO order_settings")));
 assert.ok(actions.some(q=>q.includes('INSERT INTO audit_log')));
});
