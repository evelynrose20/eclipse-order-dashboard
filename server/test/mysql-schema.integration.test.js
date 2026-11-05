import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPool} from 'mysql2/promise';
import {generateToken,hashToken} from '../src/credentials.js';
import {characterRoute} from '../src/characters.js';
import {accountRoute} from '../src/accounts.js';
import {authRoute} from '../src/auth.js';

test('MySQL 8 schemas install together and retain existing Domina on re-run', {skip:process.env.ECLIPSE_CI_MYSQL!=='1'}, async()=>{
 const admin=createPool({
  host:'127.0.0.1',port:3306,user:'root',password:process.env.ECLIPSE_CI_MYSQL_PASSWORD,
  database:'eclipse_order',multipleStatements:true,connectionLimit:1
 });
 try{
  for(const filename of ['001_core.sql','002_sessions.sql','005_features.sql','007_syndicate_ranks.sql']){
   const sql=await readFile(new URL('../sql/'+filename,import.meta.url),'utf8');
   await admin.query(sql);
  }
  await admin.query("ALTER TABLE accounts ADD COLUMN approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved'");
  const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  await admin.execute("INSERT INTO accounts(id,email,password_hash,display_name,account_role,standing,approval_status) VALUES(?,?,?,?,?,?,?)",
   [id,'admin@example.com','not-a-real-hash','Domina','domina','veteran','approved']);
  for(const filename of ['002_sessions.sql','005_features.sql','007_syndicate_ranks.sql']){
   const sql=await readFile(new URL('../sql/'+filename,import.meta.url),'utf8');
   await admin.query(sql);
  }
  const [tables]=await admin.query('SHOW TABLES');
  const names=new Set(tables.map(r=>Object.values(r)[0]));
  for(const name of ['accounts','characters','character_status_requests','account_sessions',
    'order_profile_preferences','order_member_rp_profiles','order_encounters','order_combatants',
    'order_monster_templates','order_encounter_rolls','order_roll_requests','order_event_signups',
    'order_encounter_pauses','order_settings'])assert.ok(names.has(name),'missing '+name);
  const [[row]]=await admin.execute('SELECT account_role FROM accounts WHERE id=?',[id]);
  assert.equal(row.account_role,'domina');
  const [[rank]]=await admin.execute('SELECT syndicate_rank FROM accounts WHERE id=?',[id]);
  assert.equal(rank.syndicate_rank,'domina');
  // Exercise character creation and syndicate ranks against disposable MySQL.
  const token=generateToken();
  await admin.execute('INSERT INTO account_sessions(account_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR))',[id,hashToken(token)]);
  const request=(method,body)=>({method,headers:{authorization:'Bearer '+token},[Symbol.asyncIterator]:async function*(){if(body!==undefined)yield Buffer.from(JSON.stringify(body))}});
  const recruitId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  await admin.execute("INSERT INTO accounts(id,email,password_hash,display_name,account_role,standing,approval_status) VALUES(?,?,?,?,?,?,?)",
   [recruitId,'recruit@example.com','not-a-real-hash','Recruit','member','initiate','approved']);
  const [[recruitBefore]]=await admin.execute('SELECT syndicate_rank FROM accounts WHERE id=?',[recruitId]);
  assert.equal(recruitBefore.syndicate_rank,'kumi_in');
  const changeRank=await accountRoute(admin,request('POST',{syndicate_rank:'oyabun'}),'/admin/accounts/'+recruitId+'/syndicate-rank');
  assert.equal(changeRank.status,200,JSON.stringify(changeRank.body));
  const [[recruitAfter]]=await admin.execute('SELECT syndicate_rank,account_role FROM accounts WHERE id=?',[recruitId]);
  assert.equal(recruitAfter.syndicate_rank,'oyabun');
  assert.equal(recruitAfter.account_role,'member','syndicate rank must not grant staff access');
  const memberList=await accountRoute(admin,request('GET'),'/admin/accounts');
  assert.equal(memberList.body.find(a=>a.user_id===recruitId)?.syndicate_rank,'oyabun');
  const myProfile=await authRoute(admin,request('GET'),'/auth/me');
  assert.equal(myProfile.body.user.syndicate_rank,'domina');
  const char=await characterRoute(admin,request('POST',{name:'CI Hero',class_id:'warrior',str:15,dex:14,con:13,int:12,wis:10,cha:8}),'/characters');
  assert.equal(char.status,201,JSON.stringify(char.body));

 }finally{await admin.end();}
});
