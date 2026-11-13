import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPool} from 'mysql2/promise';

test('adult civilian migration 134 preserves dependent history and reruns on MariaDB',
 {skip:process.env.ECLIPSE_CI_FAMILY_ADULTS_DB!=='1'},async()=>{
 const pool=createPool({host:'127.0.0.1',port:3306,user:'root',
   password:process.env.ECLIPSE_CI_MYSQL_PASSWORD,database:'eclipse_order',
   multipleStatements:true,connectionLimit:1});
 try{
  const [[version]]=await pool.query('SELECT VERSION() AS version');
  assert.match(version.version,/mariadb/i);
  await pool.query('CREATE TABLE schema_migrations(version VARCHAR(150) PRIMARY KEY)');
  await pool.query("CREATE TABLE order_dependents(id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,name VARCHAR(120) NOT NULL)");
  await pool.query("CREATE TABLE world_settlements(id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,name VARCHAR(120) NOT NULL)");
  await pool.query("CREATE TABLE world_industry_facilities(id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,settlement_id BIGINT UNSIGNED)");
  await pool.query("INSERT INTO order_dependents(name) VALUES('Childhood record')");
  await pool.query("INSERT INTO world_settlements(name) VALUES('New Cassia')");
  await pool.query("INSERT INTO world_industry_facilities(settlement_id) VALUES(1)");
  const migration=await readFile(new URL('../sql/134_family_adult_civilians.sql',import.meta.url),'utf8');
  await pool.query(migration);
  await pool.query(migration);
  await pool.query("INSERT INTO world_named_civilians(dependent_id,settlement_id) VALUES(1,1)");
  await assert.rejects(pool.query("INSERT INTO world_named_civilians(dependent_id,settlement_id) VALUES(1,1)"),/Duplicate entry/i);
  await pool.query("UPDATE world_named_civilians SET workplace_facility_id=1,employment_state='employed' WHERE dependent_id=1");
  const [[child]]=await pool.query('SELECT name FROM order_dependents WHERE id=1');
  assert.equal(child.name,'Childhood record');
  const [[adult]]=await pool.query('SELECT employment_state,workplace_facility_id FROM world_named_civilians WHERE dependent_id=1');
  assert.equal(adult.employment_state,'employed');
  assert.equal(Number(adult.workplace_facility_id),1);
  const [[migrationCount]]=await pool.query("SELECT COUNT(*) AS n FROM schema_migrations WHERE version='134_family_adult_civilians'");
  assert.equal(Number(migrationCount.n),1);
 }finally{await pool.end()}
});
