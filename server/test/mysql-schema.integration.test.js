import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPool} from 'mysql2/promise';

test('MySQL 8 schemas install together and retain existing Domina on re-run', {skip:process.env.ECLIPSE_CI_MYSQL!=='1'}, async()=>{
 const admin=createPool({
  host:'127.0.0.1',port:3306,user:'root',password:process.env.ECLIPSE_CI_MYSQL_PASSWORD,
  database:'eclipse_order',multipleStatements:true,connectionLimit:1
 });
 try{
  for(const filename of ['001_core.sql','002_sessions.sql','005_features.sql']){
   const sql=await readFile(new URL('../sql/'+filename,import.meta.url),'utf8');
   await admin.query(sql);
  }
  await admin.query("ALTER TABLE accounts ADD COLUMN approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved'");
  const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  await admin.execute("INSERT INTO accounts(id,email,password_hash,display_name,account_role,standing,approval_status) VALUES(?,?,?,?,?,?,?)",
   [id,'admin@example.com','not-a-real-hash','Domina','domina','veteran','approved']);
  for(const filename of ['002_sessions.sql','005_features.sql']){
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
 }finally{await admin.end();}
});
