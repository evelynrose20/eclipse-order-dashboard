import {civilianStorageCapacity} from './world-civic-building-templates.js';
import {randomUUID} from 'node:crypto';
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const whole=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const label=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=max;
const kinds=['food','fuel','water','medicine'],frequencies=['daily','weekly','monthly'];
const day=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
async function read(req){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>16000)return null;chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}}
async function tx(pool,fn){const db=await pool.getConnection();try{await db.beginTransaction();const r=await fn(db);if(r.status===200)await db.commit();else await db.rollback();return r}catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}}
async function audit(db,actor,action,id,detail=''){await db.execute('INSERT INTO world_administration_audit(actor_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',[actor,action,'civic',id,String(detail).slice(0,350)])}
const cohortValid=b=>b&&label(b.label,120)&&whole(b.residents,0,10000000)&&whole(b.employed,0,b.residents)&&['housing_quality','medical_access','water_access'].every(k=>whole(b[k],0,100));
const contractValid=b=>b&&label(b.name,120)&&typeof b.material_id==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(b.material_id)&&b.material_id.length<=48&&kinds.includes(b.resource_kind)&&frequencies.includes(b.frequency)&&whole(b.quantity,1,1000000)&&(b.resource_kind!=='food'||label(b.food_group,75))&&(b.food_group==null||b.food_group===''||label(b.food_group,75))&&typeof b.active==='boolean';
function dueAllowed(frequency,previous,current){
 if(!previous)return true;
 const a=Date.parse(previous+'T00:00:00Z'),b=Date.parse(current+'T00:00:00Z');
 if(b<=a)return false;
 if(frequency==='daily')return true;
 if(frequency==='weekly')return (b-a)/86400000>=7;
 return current.slice(0,7)!==previous.slice(0,7);
}
export async function handleCivicExtras(pool,req,path,actor){
 const m=/^\/world-admin\/civic\/(\d+)\/(cohorts|aid|heating)(?:\/(\d+))?(?:\/(dispatch))?$/.exec(path);
 if(!m)return null;
 const settlementId=Number(m[1]),kind=m[2],entryId=m[3]?Number(m[3]):null,dispatch=m[4];
 if(!Number.isSafeInteger(settlementId)||settlementId<1)return fail(400,'invalid_settlement');
 if(kind==='cohorts')return fail(409,'population_groups_are_simulated');
 if(kind==='heating'&&['POST','PUT','DELETE'].includes(req.method)){
  const b=req.method==='DELETE'?null:await read(req);
  if(req.method!=='DELETE'&&(!b||!label(b.name,120)||!whole(b.coverage_pct,0,100)||!whole(b.condition_pct,0,100)||!['operational','damaged','offline'].includes(b.status)||typeof b.notes!=='string'||b.notes.length>450))return fail(400,'invalid_heating_asset');
  if(req.method==='POST'&&entryId||req.method!=='POST'&&!entryId)return fail(400,'invalid_heating_asset_request');
  return tx(pool,async db=>{
   const [[site]]=await db.execute('SELECT id FROM world_settlements WHERE id=? FOR UPDATE',[settlementId]);if(!site)return fail(404,'settlement_not_found');
   if(req.method==='DELETE'){
    const [deleted]=await db.execute('DELETE FROM world_civic_heating_assets WHERE id=? AND settlement_id=?',[entryId,settlementId]);
    if(!deleted.affectedRows)return fail(404,'heating_asset_not_found');
   }else if(req.method==='POST'){
    const [created]=await db.execute('INSERT INTO world_civic_heating_assets(settlement_id,name,coverage_pct,condition_pct,status,notes,created_by) VALUES(?,?,?,?,?,?,?)',[settlementId,b.name.trim(),b.coverage_pct,b.condition_pct,b.status,b.notes,actor.id]);
    await audit(db,actor.id,'heating_asset_create',settlementId,b.name);return ok({id:created.insertId});
   }else{
    const [updated]=await db.execute('UPDATE world_civic_heating_assets SET name=?,coverage_pct=?,condition_pct=?,status=?,notes=? WHERE id=? AND settlement_id=?',[b.name.trim(),b.coverage_pct,b.condition_pct,b.status,b.notes,entryId,settlementId]);
    if(!updated.affectedRows)return fail(404,'heating_asset_not_found');
   }
   await audit(db,actor.id,req.method==='DELETE'?'heating_asset_delete':'heating_asset_update',settlementId,String(entryId));
   return ok({saved:true});
  });
 }
 if(kind==='aid'&&req.method==='POST'&&!entryId){
  const b=await read(req);if(!contractValid(b))return fail(400,'invalid_aid_contract');
  return tx(pool,async db=>{
   const [[site]]=await db.execute('SELECT id FROM world_settlements WHERE id=?',[settlementId]);if(!site)return fail(404,'settlement_not_found');
   const [[material]]=await db.execute('SELECT id FROM fc_materials WHERE id=?',[b.material_id]);if(!material)return fail(400,'unknown_material');
   const [r]=await db.execute('INSERT INTO world_civic_aid_contracts(settlement_id,name,material_id,resource_kind,food_group,quantity,frequency,active,created_by) VALUES(?,?,?,?,?,?,?,?,?)',[settlementId,b.name.trim(),b.material_id,b.resource_kind,b.resource_kind==='food'?b.food_group:null,b.quantity,b.frequency,b.active?1:0,actor.id]);
   await audit(db,actor.id,'aid_contract_create',settlementId,b.name);
   return ok({id:r.insertId});
  });
 }
 if(kind==='aid'&&entryId&&req.method==='PUT'&&!dispatch){
  const b=await read(req);if(!contractValid(b))return fail(400,'invalid_aid_contract');
  return tx(pool,async db=>{
   const [[site]]=await db.execute('SELECT id FROM world_settlements WHERE id=? FOR UPDATE',[settlementId]);if(!site)return fail(404,'settlement_not_found');
   const [[material]]=await db.execute('SELECT id FROM fc_materials WHERE id=?',[b.material_id]);if(!material)return fail(400,'unknown_material');
   const [changed]=await db.execute('UPDATE world_civic_aid_contracts SET name=?,material_id=?,resource_kind=?,food_group=?,quantity=?,frequency=?,active=? WHERE id=? AND settlement_id=?',[b.name.trim(),b.material_id,b.resource_kind,b.resource_kind==='food'?b.food_group:null,b.quantity,b.frequency,b.active?1:0,entryId,settlementId]);
   if(!changed.affectedRows)return fail(404,'aid_contract_not_found');
   await audit(db,actor.id,'aid_contract_update',settlementId,b.name);return ok({saved:true});
  });
 }
 if(kind==='aid'&&entryId&&dispatch&&req.method==='POST'){
  const b=await read(req);if(!day(b?.due_date))return fail(400,'invalid_aid_due_date');
  return tx(pool,async db=>{
   // All civilian movements serialize through their settlement row.
   const [[site]]=await db.execute('SELECT id FROM world_settlements WHERE id=? FOR UPDATE',[settlementId]);if(!site)return fail(404,'settlement_not_found');
   const [[contract]]=await db.execute('SELECT * FROM world_civic_aid_contracts WHERE id=? AND settlement_id=? FOR UPDATE',[entryId,settlementId]);
   if(!contract)return fail(404,'aid_contract_not_found');
   if(!contract.active)return fail(409,'aid_contract_paused');
   const [[duplicate]]=await db.execute("SELECT id FROM world_civic_aid_dispatches WHERE contract_id=? AND due_date=?",[entryId,b.due_date]);
   if(duplicate)return ok({saved:true,already_dispatched:true});
   const [[last]]=await db.execute("SELECT DATE_FORMAT(MAX(due_date),'%Y-%m-%d') AS due_date FROM world_civic_aid_dispatches WHERE contract_id=?",[entryId]);
   if(!dueAllowed(contract.frequency,last?.due_date,b.due_date))return fail(409,'aid_delivery_not_due');
   const [[stock]]=await db.execute('SELECT m.name,s.quantity FROM fc_material_stock s JOIN fc_materials m ON m.id=s.material_id WHERE s.material_id=? FOR UPDATE',[contract.material_id]);
   if(!stock||Number(stock.quantity)<Number(contract.quantity))return fail(409,'insufficient_shared_order_stock');
   if(contract.resource_kind==='food'||contract.resource_kind==='water'){
    const [[sitePopulation]]=await db.execute('SELECT population FROM world_settlements WHERE id=?',[settlementId]);
    const [buildings]=await db.execute('SELECT * FROM world_settlement_upgrades WHERE settlement_id=?',[settlementId]);
    const capacity=civilianStorageCapacity(sitePopulation,buildings);
    const [[stored]]=await db.execute('SELECT COALESCE(SUM(quantity),0) AS quantity FROM world_civic_stock WHERE settlement_id=? AND resource_kind=?',[settlementId,contract.resource_kind]);
    if(Number(stored.quantity)+Number(contract.quantity)>capacity[contract.resource_kind]+0.0001)return fail(409,'civilian_storage_capacity_exceeded');
   }
   const [[civilian]]=await db.execute('SELECT resource_kind,food_group FROM world_civic_stock WHERE settlement_id=? AND item_code=? FOR UPDATE',[settlementId,contract.material_id]);
   if(civilian&&(civilian.resource_kind!==contract.resource_kind||String(civilian.food_group||'')!==String(contract.food_group||'')))return fail(409,'stock_item_classification_conflict');
   const [debit]=await db.execute('UPDATE fc_material_stock SET quantity=quantity-? WHERE material_id=? AND quantity>=?',[contract.quantity,contract.material_id,contract.quantity]);
   if(debit.affectedRows!==1)return fail(409,'insufficient_shared_order_stock');
   await db.execute('INSERT INTO world_civic_stock(settlement_id,item_code,item_label,resource_kind,food_group,quantity) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE quantity=quantity+VALUES(quantity),item_label=VALUES(item_label)',[settlementId,contract.material_id,stock.name,contract.resource_kind,contract.food_group||null,contract.quantity]);
   const key=randomUUID();
   const [transfer]=await db.execute('INSERT INTO world_civic_shared_transfers(request_key,settlement_id,material_id,quantity,actor_id) VALUES(?,?,?,?,?)',[key,settlementId,contract.material_id,contract.quantity,actor.id]);
   await db.execute('INSERT INTO world_civic_aid_dispatches(contract_id,due_date,transfer_id,dispatched_by) VALUES(?,?,?,?)',[entryId,b.due_date,transfer.insertId,actor.id]);
   await db.execute('INSERT INTO world_civic_movements(settlement_id,item_code,resource_kind,food_group,quantity_delta,reason,actor_id) VALUES(?,?,?,?,?,?,?)',[settlementId,contract.material_id,contract.resource_kind,contract.food_group||null,contract.quantity,'Aid: '+contract.name,actor.id]);
   await audit(db,actor.id,'aid_dispatch',settlementId,contract.name+' '+b.due_date);
   return ok({saved:true,quantity:Number(contract.quantity)});
  });
 }
 return fail(404,'not_found');
}
