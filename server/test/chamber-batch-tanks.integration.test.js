import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPool} from 'mysql2/promise';
import {transferChamberBatchToWorkshop} from '../src/thralls.js';

test('chamber batch tank migration installs alongside real workshop materials and recipes', {skip:process.env.ECLIPSE_CI_MYSQL!=='1'},async()=>{
 const pool=createPool({
  host:'127.0.0.1',port:3306,user:'root',password:process.env.ECLIPSE_CI_MYSQL_PASSWORD,
  database:'eclipse_order',multipleStatements:true,connectionLimit:1
 });
 try{
  const migrations=[
   '001_core.sql','020_fc_crafting_garden.sql','061_thrall_chamber.sql',
   '062_thrall_seating.sql','063_chamber_character_profiles.sql','064_chamber_simulation.sql',
   '065_chamber_daily_output.sql','117_chamber_fractional_fluids.sql',
   '118_chamber_fluid_labels.sql','119_chamber_batch_tanks_workshop.sql'
  ];
  for(const filename of migrations){
   const sql=await readFile(new URL('../sql/'+filename,import.meta.url),'utf8');
   await pool.query(sql);
  }
  const sql=await readFile(new URL('../sql/119_chamber_batch_tanks_workshop.sql',import.meta.url),'utf8');
  await pool.query(sql); // idempotent on repeat setup:local runs
  const [columns]=await pool.execute("SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='eclipse_order' AND ((TABLE_NAME='order_thrall_chamber' AND COLUMN_NAME IN ('upper_source_character_id','lower_source_character_id')) OR (TABLE_NAME='order_thrall_chamber_batches' AND COLUMN_NAME IN ('source_character_id','source_name','drained_total')))");
  assert.equal(columns.length,5);
  const [materials]=await pool.query("SELECT id FROM fc_materials WHERE id IN ('chamber-breast-milk','chamber-secondary-fluid','demon-dust')");
  assert.equal(materials.length,3);
  const [recipe]=await pool.query("SELECT r.id,r.output_material,COUNT(i.material_id) AS ingredients FROM fc_recipes r JOIN fc_recipe_inputs i ON i.recipe_id=r.id WHERE r.id='demon-dust' GROUP BY r.id,r.output_material");
  assert.equal(recipe[0].output_material,'demon-dust');
  assert.equal(Number(recipe[0].ingredients),3);
  const [applied]=await pool.query("SELECT version FROM schema_migrations WHERE version='119_chamber_batch_tanks_workshop'");
  assert.equal(applied.length,1);
  // Exercise the real atomic transfer helper against both fluid types.
  const conn=await pool.getConnection();
  try{
   await conn.beginTransaction();
   const actor='11111111-1111-4111-8111-111111111111';
   const character='22222222-2222-4222-8222-222222222222';
   await conn.execute('INSERT INTO accounts(id,email,password_hash,display_name) VALUES(?,?,?,?)',[actor,'batch-smoke@example.test','unused','Batch Smoke']);
   await conn.execute('INSERT INTO characters(id,character_name,player_account_id,sheet_json) VALUES(?,?,?,?)',[character,'Test Character',actor,'{}']);
   const [milk]=await conn.execute("INSERT INTO order_thrall_chamber_batches(material,material_type,quantity,classification,notes,created_by,source_character_id,source_name) VALUES('lacteal','milk',3.5,'Unclassified','',?,?,?)",[actor,character,'Test Character']);
   const [secondary]=await conn.execute("INSERT INTO order_thrall_chamber_batches(material,material_type,quantity,classification,notes,created_by,source_character_id,source_name) VALUES('secondary','vaginal',2.2,'Unclassified','',?,?,?)",[actor,character,'Test Character']);
   assert.equal((await transferChamberBatchToWorkshop(conn,milk.insertId,2,actor)).material_id,'chamber-breast-milk');
   assert.equal((await transferChamberBatchToWorkshop(conn,secondary.insertId,1,actor)).material_id,'chamber-secondary-fluid');
   assert.equal((await transferChamberBatchToWorkshop(conn,milk.insertId,2,actor)).error,'insufficient_batch_fluid','cannot drain the same stock twice');
   const [tanks]=await conn.execute('SELECT id,quantity,drained_total,source_character_id FROM order_thrall_chamber_batches WHERE id IN (?,?) ORDER BY id',[milk.insertId,secondary.insertId]);
   assert.deepEqual(tanks.map(b=>Number(b.quantity)),[1.5,1.2]);
   assert.deepEqual(tanks.map(b=>Number(b.drained_total)),[2,1]);
   assert.ok(tanks.every(b=>b.source_character_id===character));
   const [stock]=await conn.execute("SELECT material_id,quantity FROM fc_material_stock WHERE material_id IN ('chamber-breast-milk','chamber-secondary-fluid') ORDER BY material_id");
   assert.deepEqual(stock.map(b=>Number(b.quantity)),[2,1]);
   const [transfers]=await conn.execute('SELECT batch_id,quantity,source_character_id FROM order_thrall_batch_transfers WHERE batch_id IN (?,?)',[milk.insertId,secondary.insertId]);
   assert.equal(transfers.length,2);
   assert.ok(transfers.every(b=>b.source_character_id===character));
  }finally{
   await conn.rollback();
   conn.release();
  }

 }finally{await pool.end()}
});
