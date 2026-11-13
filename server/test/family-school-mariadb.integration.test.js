import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPool} from 'mysql2/promise';

test('family school migration 133 is repeatable on MariaDB and preserves child records',{skip:process.env.ECLIPSE_CI_FAMILY_SCHOOL_DB!=='1'},async()=>{
 const pool=createPool({host:'127.0.0.1',port:3306,user:'root',
  password:process.env.ECLIPSE_CI_MYSQL_PASSWORD,database:'eclipse_order',multipleStatements:true,connectionLimit:1});
 try{
  const [[v]]=await pool.query('SELECT VERSION() AS version');
  assert.match(v.version,/mariadb/i);
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations(version VARCHAR(150) PRIMARY KEY)`);
  await pool.query(`CREATE TABLE accounts(id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY)`);
  await pool.query(`CREATE TABLE order_dependents(id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    stage ENUM('newborn','infant','toddler','child') NOT NULL DEFAULT 'newborn')`);
  await pool.query(`CREATE TABLE order_dependent_care_events(id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    action ENUM('nursing','bottle','meal','comfort','hygiene','sleep','play','restock_milk','restock_food') NOT NULL)`);
  await pool.execute("INSERT INTO order_dependents(stage) VALUES('child')");
  await pool.execute("INSERT INTO order_dependent_care_events(action) VALUES('meal')");
  const script=await readFile(new URL('../sql/133_dependent_school_life_stages.sql',import.meta.url),'utf8');
  await pool.query(script);
  await pool.query(script);
  const [[oldChild]]=await pool.query('SELECT stage,school_days FROM order_dependents WHERE id=1');
  assert.equal(oldChild.stage,'child');
  assert.equal(oldChild.school_days,'1,2,3,4,5');
  const [[oldCare]]=await pool.query('SELECT action FROM order_dependent_care_events WHERE id=1');
  assert.equal(oldCare.action,'meal');
  await pool.execute("INSERT INTO order_dependent_care_events(action) VALUES('homework')");
  await pool.execute("UPDATE order_dependents SET stage='teen' WHERE id=1");
  const [[teen]]=await pool.query('SELECT stage FROM order_dependents WHERE id=1');
  assert.equal(teen.stage,'teen');
  const [[registered]]=await pool.query("SELECT COUNT(*) AS n FROM schema_migrations WHERE version='133_dependent_school_life_stages'");
  assert.equal(Number(registered.n),1);
 }finally{await pool.end()}
});
