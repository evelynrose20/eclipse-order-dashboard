import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPool} from 'mysql2/promise';
test('school staffing migration 135 is repeatable and preserves school upgrades and pupil records',
 {skip:process.env.ECLIPSE_CI_SCHOOL_BUILDINGS_DB!=='1'},async()=>{
 const pool=createPool({host:'127.0.0.1',port:3306,user:'root',
  password:process.env.ECLIPSE_CI_MYSQL_PASSWORD,database:'eclipse_order',multipleStatements:true,connectionLimit:1});
 try{
  const [[version]]=await pool.query('SELECT VERSION() AS version');
  assert.match(version.version,/mariadb/i);
  await pool.query('CREATE TABLE schema_migrations(version VARCHAR(150) PRIMARY KEY)');
  await pool.query('CREATE TABLE world_settlements(id BIGINT UNSIGNED PRIMARY KEY, name VARCHAR(120),workforce INT UNSIGNED NOT NULL DEFAULT 0)');
  await pool.query('CREATE TABLE world_settlement_upgrades(id BIGINT UNSIGNED PRIMARY KEY,settlement_id BIGINT UNSIGNED NOT NULL,category VARCHAR(30) NOT NULL)');
  await pool.query("CREATE TABLE order_dependents(id BIGINT UNSIGNED PRIMARY KEY,stage ENUM('newborn','infant','toddler','child','teen') NOT NULL DEFAULT 'child',school_name VARCHAR(120) NOT NULL DEFAULT '')");
  await pool.query("INSERT INTO world_settlements VALUES(1,'Cassia',20)");
  await pool.query("INSERT INTO world_settlement_upgrades VALUES(5,1,'school')");
  await pool.query("INSERT INTO order_dependents(id,stage,school_name) VALUES(7,'child','Old school note')");
  const sql=await readFile(new URL('../sql/135_civic_school_staffing_and_enrollment.sql',import.meta.url),'utf8');
  await pool.query(sql);await pool.query(sql);
  await pool.query('INSERT INTO world_school_staffing(upgrade_id,teachers,support_staff) VALUES(5,2,1)');
  await pool.query('UPDATE order_dependents SET school_upgrade_id=5 WHERE id=7');
  const [[child]]=await pool.query('SELECT school_name,school_upgrade_id FROM order_dependents WHERE id=7');
  assert.equal(child.school_name,'Old school note');
  assert.equal(Number(child.school_upgrade_id),5);
  const [[staff]]=await pool.query('SELECT teachers,support_staff FROM world_school_staffing WHERE upgrade_id=5');
  assert.deepEqual([staff.teachers,staff.support_staff],[2,1]);
  const [[state]]=await pool.query("SELECT COUNT(*) AS n FROM schema_migrations WHERE version='135_civic_school_staffing_and_enrollment'");
  assert.equal(Number(state.n),1);
 }finally{await pool.end()}
});
