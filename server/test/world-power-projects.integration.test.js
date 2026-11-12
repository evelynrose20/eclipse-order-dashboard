import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPool} from 'mysql2/promise';
import {powerProjectRoute} from '../src/world-power-projects.js';

test('Moonlight generator repair and upgrade require real materials and progress', {skip:process.env.ECLIPSE_CI_MYSQL!=='1'},async()=>{
 const pool=createPool({host:'127.0.0.1',port:3306,user:'root',password:process.env.ECLIPSE_CI_MYSQL_PASSWORD,database:'eclipse_order',multipleStatements:true,connectionLimit:2});
 try{
  // The preceding chamber test has installed the core account and workshop tables.
  await pool.query(`CREATE TABLE IF NOT EXISTS world_settlements (
   id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
   name VARCHAR(140) NOT NULL, region_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
   zone_id BIGINT UNSIGNED NULL, controlling_faction_id VARCHAR(45),
   population INT UNSIGNED NOT NULL DEFAULT 0, workforce INT UNSIGNED NOT NULL DEFAULT 0,
   unrest INT UNSIGNED NOT NULL DEFAULT 0,civil_stability INT UNSIGNED NOT NULL DEFAULT 70
  ) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS world_industry_items (
   id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
   workshop_material_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NULL
  ) ENGINE=InnoDB`);
  await pool.query("INSERT IGNORE INTO world_industry_items(id) VALUES('repair-timbers')");
  await pool.query(`CREATE TABLE IF NOT EXISTS world_industry_facilities(
   id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,settlement_id BIGINT UNSIGNED,
   name VARCHAR(140),owner_faction_id VARCHAR(45)
  ) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS world_industry_stock(
   facility_id BIGINT UNSIGNED NOT NULL,item_id VARCHAR(48) NOT NULL,quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
   PRIMARY KEY(facility_id,item_id)
  ) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS world_industry_ledger(
   id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,facility_id BIGINT UNSIGNED,
   item_id VARCHAR(48),delta DECIMAL(14,3),balance_after DECIMAL(14,3),
   action VARCHAR(45),reference_key VARCHAR(100),actor_id CHAR(36)
  ) ENGINE=InnoDB`);
  const actor='12345678-1234-4234-8234-123456789abc';
  await pool.execute("INSERT IGNORE INTO accounts(id,email,password_hash,display_name,account_role) VALUES(?,'power-test@example.test','unused','Power Test','domina')",[actor]);
  const [site]=await pool.execute("INSERT INTO world_settlements(name,controlling_faction_id,population,workforce) VALUES('Castrum Moonlight','eclipse-order',200,200)");
  for(const file of ['123_world_power_grid.sql','124_power_blueprint_projects.sql']){
   const contents=await readFile(new URL('../sql/'+file,import.meta.url),'utf8');
   await pool.query(contents);
   await pool.query(contents); // Running setup a second time must preserve records.
  }
  const [[itemMapping]]=await pool.execute("SELECT workshop_material_id FROM world_industry_items WHERE id='repair-timbers'");
  assert.equal(itemMapping.workshop_material_id,'repair-timbers');
  const [[plant]]=await pool.execute('SELECT * FROM world_power_plants WHERE settlement_id=?',[site.insertId]);
  assert.equal(Number(plant.condition_pct),32);
  assert.equal(Number(plant.fuel_units),500);
  assert.equal(plant.blueprint_id,'garlean-mk1');
  await pool.execute("INSERT INTO fc_material_stock(material_id,quantity) VALUES('iron-ingot',1000) ON DUPLICATE KEY UPDATE quantity=quantity+1000");
  await pool.execute("INSERT INTO fc_material_stock(material_id,quantity) VALUES('repair-timbers',1000) ON DUPLICATE KEY UPDATE quantity=quantity+1000");
  const staff={id:actor};
  const begin=await powerProjectRoute(pool,'/world-admin/power/projects',{settlement_id:site.insertId,plant_id:plant.id,blueprint_id:'garlean-mk1',action:'repair'},staff);
  assert.equal(begin.status,200,JSON.stringify(begin));
  const id=begin.body.id;
  assert.equal((await powerProjectRoute(pool,'/world-admin/power/projects/'+id+'/advance',{},staff)).body.error,'project_materials_not_funded');
  const [[required]]=await pool.execute('SELECT * FROM world_power_projects WHERE id=?',[id]);
  for(const [materialId,qty] of [['iron-ingot',Number(required.iron_required)],['repair-timbers',Number(required.timber_required)]]){
   const result=await powerProjectRoute(pool,'/world-admin/power/projects/'+id+'/commit',{material_id:materialId,quantity:qty},staff);
   assert.equal(result.status,200,JSON.stringify(result));
  }
  const completed=await powerProjectRoute(pool,'/world-admin/power/projects/'+id+'/advance',{},staff);
  assert.equal(completed.status,200,JSON.stringify(completed));
  assert.equal(completed.body.complete,true);
  const [[repaired]]=await pool.execute('SELECT condition_pct,level,model,fuel_units FROM world_power_plants WHERE id=?',[plant.id]);
  assert.equal(Number(repaired.condition_pct),100);
  assert.equal(Number(repaired.level),1);
  assert.equal(Number(repaired.fuel_units),500);
  const upgrading=await powerProjectRoute(pool,'/world-admin/power/projects',{settlement_id:site.insertId,plant_id:plant.id,blueprint_id:'garlean-mk2',action:'upgrade'},staff);
  assert.equal(upgrading.status,200);
  const upgradeId=upgrading.body.id;
  const [[upgrade]]=await pool.execute('SELECT * FROM world_power_projects WHERE id=?',[upgradeId]);
  await powerProjectRoute(pool,'/world-admin/power/projects/'+upgradeId+'/commit',{material_id:'iron-ingot',quantity:Number(upgrade.iron_required)},staff);
  await powerProjectRoute(pool,'/world-admin/power/projects/'+upgradeId+'/commit',{material_id:'repair-timbers',quantity:Number(upgrade.timber_required)},staff);
  const first=await powerProjectRoute(pool,'/world-admin/power/projects/'+upgradeId+'/advance',{},staff);
  assert.equal(first.body.complete,false);
  const repeat=await powerProjectRoute(pool,'/world-admin/power/projects/'+upgradeId+'/advance',{},staff);
  assert.equal(repeat.body.error,'power_project_already_advanced_today');
  const [[pendingPlant]]=await pool.execute('SELECT level FROM world_power_plants WHERE id=?',[plant.id]);
  assert.equal(Number(pendingPlant.level),1,'level cannot change before funded work completes');
  // Drive the second workforce day without changing the runtime clock.
  await pool.execute('UPDATE world_power_projects SET last_advanced=DATE_SUB(UTC_DATE(),INTERVAL 1 DAY) WHERE id=?',[upgradeId]);
  const second=await powerProjectRoute(pool,'/world-admin/power/projects/'+upgradeId+'/advance',{},staff);
  assert.equal(second.body.complete,true);
  const [[modern]]=await pool.execute('SELECT level,rated_output,fuel_per_day FROM world_power_plants WHERE id=?',[plant.id]);
  assert.equal(Number(modern.level),2);
  assert.equal(Number(modern.rated_output),280);
  assert.equal(Number(modern.fuel_per_day),80);
 }finally{await pool.end()}
});
