import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPool} from 'mysql2/promise';

// Runs in its own CI MariaDB job with a minimal isolated schema, including
// the exact original 20-day CHECK to reproduce the reported Windows failure.
test('migration 132 works twice on MariaDB and preserves pregnancy records',
 {skip:process.env.ECLIPSE_CI_GESTATION_DB!=='1'},async()=>{
 const pool=createPool({host:'127.0.0.1',port:3306,user:'root',
  password:process.env.ECLIPSE_CI_MYSQL_PASSWORD,database:'eclipse_order',
  multipleStatements:true,connectionLimit:1});
 try{
  const [[version]]=await pool.query('SELECT VERSION() AS version');
  assert.match(version.version,/mariadb/i,'This CI job must test MariaDB, not just MySQL');
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations(
   version VARCHAR(150) NOT NULL PRIMARY KEY
  ) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE character_reproductive_profiles(
   character_id INT NOT NULL PRIMARY KEY,
   pregnancy_total_days SMALLINT UNSIGNED NOT NULL DEFAULT 90,
   CONSTRAINT chk_pregnancy_term CHECK(pregnancy_total_days BETWEEN 20 AND 600)
  ) ENGINE=InnoDB`);
  await pool.execute('INSERT INTO character_reproductive_profiles(character_id,pregnancy_total_days) VALUES(?,?)',[1,90]);
  const script=await readFile(new URL('../sql/132_voidsent_four_day_gestation.sql',import.meta.url),'utf8');
  await pool.query(script);
  await pool.query(script);
  const [[original]]=await pool.query('SELECT pregnancy_total_days AS days FROM character_reproductive_profiles WHERE character_id=1');
  assert.equal(original.days,90);
  await pool.execute('INSERT INTO character_reproductive_profiles(character_id,pregnancy_total_days) VALUES(?,?)',[2,4]);
  await assert.rejects(pool.execute('INSERT INTO character_reproductive_profiles(character_id,pregnancy_total_days) VALUES(?,?)',[3,3]),/check constraint|constraint.*failed/i);
  const [[migration]]=await pool.query("SELECT COUNT(*) AS n FROM schema_migrations WHERE version='132_voidsent_four_day_gestation'");
  assert.equal(Number(migration.n),1);
 }finally{await pool.end()}
});
