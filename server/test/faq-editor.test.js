import test from 'node:test';
import assert from 'node:assert/strict';
import {faqRoute} from '../src/faq.js';
import {generateToken} from '../src/credentials.js';
import {readFile} from 'node:fs/promises';

const sample={id:1,question:'Who rules the Order?',answer:'The Domina.',sort_order:10,published:1};
function fake(role='domina'){
 const actions=[];
 const pool={execute:async(sql,args=[])=>{
  actions.push(sql);
  if(sql.includes('FROM account_sessions'))return [[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',account_role:role,auth_method:'discord'}]];
  if(sql.startsWith('SELECT')&&sql.includes('FROM order_public_faq'))return [[sample]];
  if(sql.startsWith('INSERT INTO order_public_faq'))return [{insertId:8}];
  return [{affectedRows:1}];
 }};
 return {pool,actions};
}
function req(method='GET',body=null,token=''){
 return {method,headers:token?{authorization:'Bearer '+token}:{},[Symbol.asyncIterator]:async function*(){if(body!==null)yield Buffer.from(JSON.stringify(body))}};
}
const payload={question:'Who rules?',answer:'The Domina.',sort_order:20,published:true};
test('public FAQ contains only published questions',async()=>{
 const {pool,actions}=fake();
 const result=await faqRoute(pool,req(),'/faq/public');
 assert.equal(result.status,200);
 assert.deepEqual(result.body.entries.map(row=>row.question),[sample.question]);
 assert.ok(actions[0].includes('WHERE published=1'));
});
test('FAQ editing requires a signed-in officer',async()=>{
 const {pool}=fake();
 assert.equal((await faqRoute(pool,req('POST',payload),'/faq')).status,401);
 const account=fake('member'),token=generateToken();
 assert.equal((await faqRoute(account.pool,req('POST',payload,token),'/faq')).status,403);
});
test('Domina can publish, update and remove questions',async()=>{
 const {pool,actions}=fake();
 const token=generateToken();
 assert.equal((await faqRoute(pool,req('POST',payload,token),'/faq')).body.id,8);
 assert.equal((await faqRoute(pool,req('PUT',{...payload,sort_order:40,published:false},token),'/faq/1')).status,200);
 assert.equal((await faqRoute(pool,req('DELETE',null,token),'/faq/1')).status,200);
 assert.ok(actions.some(sql=>sql.startsWith('INSERT INTO order_public_faq')));
 assert.ok(actions.some(sql=>sql.startsWith('UPDATE order_public_faq')));
 assert.ok(actions.some(sql=>sql.startsWith('DELETE FROM order_public_faq')));
});
test('FAQ enforces valid text, publication and ordering',async()=>{
 const {pool}=fake(),token=generateToken();
 for(const bad of [{...payload,question:''},{...payload,answer:''},{...payload,published:'yes'},{...payload,sort_order:1.2}]){
  assert.equal((await faqRoute(pool,req('POST',bad,token),'/faq')).status,400);
 }
});
test('Garlean founding migration never deletes or overwrites custom lore',async()=>{
 const sql=await readFile(new URL('../sql/038_garlean_origin_and_faq.sql',import.meta.url),'utf8');
 assert.match(sql,/founded in Garlemald/);
 assert.match(sql,/WHERE id='origins-thirteenth'[\s\S]*?AND title='The House Before the Flood'/);
 assert.match(sql,/NOT EXISTS \(SELECT 1 FROM schema_migrations WHERE version='038_garlean_origin_and_faq'\)/);
 assert.doesNotMatch(sql,/DROP TABLE|TRUNCATE TABLE|DELETE FROM order_lore_entries/i);
});
