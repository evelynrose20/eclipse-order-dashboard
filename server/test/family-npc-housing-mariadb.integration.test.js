import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPool} from 'mysql2/promise';
test('migration 136 links named NPC homes without changing any adult records and reruns on MariaDB',
 {skip:process.env.ECLIPSE_CI_NPC_HOMES_DB!=='1'},async()=>{
 const pool=createPool({host:'127.0.0.1',port:3306,user:'root',
  password:process.env.ECLIPSE_CI_MYSQL_PASSWORD,database:'eclipse_order',multipleStatements:true,connectionLimit:1});
 try{
  const [[v]]=await pool.query('SELECT VERSION() AS version');
  assert.match(v.version,/mariadb/i);
  await pool.query('CREATE TABLE schema_migrations(version VARCHAR(150) PRIMARY KEY)');
  await pool.query('CREATE TABLE world_settlement_upgrades(id BIGINT UNSIGNED PRIMARY KEY)');
  await pool.query('CREATE TABLE world_named_civilians(id BIGINT UNSIGNED PRIMARY KEY,dependent_id BIGINT UNSIGNED NOT NULL)');
  await pool.query('INSERT INTO world_settlement_upgrades(id) VALUES(12)');
  await pool.query('INSERT INTO world_named_civilians(id,dependent_id) VALUES(9,5)');
  const sql=await readFile(new URL('../sql/136_named_civilian_homes_longevity.sql',import.meta.url),'utf8');
  await pool.query(sql);await pool.query(sql);
  const [[original]]=await pool.query('SELECT dependent_id,housing_upgrade_id FROM world_named_civilians WHERE id=9');
  assert.equal(Number(original.dependent_id),5);assert.equal(original.housing_upgrade_id,null);
  await pool.query('UPDATE world_named_civilians SET housing_upgrade_id=12 WHERE id=9');
  const [[assigned]]=await pool.query('SELECT housing_upgrade_id FROM world_named_civilians WHERE id=9');
  assert.equal(Number(assigned.housing_upgrade_id),12);
  const [[registered]]=await pool.query("SELECT COUNT(*) AS n FROM schema_migrations WHERE version='136_named_civilian_homes_longevity'");
  assert.equal(Number(registered.n),1);
 }finally{await pool.end()}
});
