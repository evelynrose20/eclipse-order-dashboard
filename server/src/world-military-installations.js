import {installationReadiness} from './world-military-readiness.js';
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const whole=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const text=(x,max)=>typeof x==='string'&&x.trim().length>0&&x.length<=max;
const kinds=['castrum','fort','outpost','airbase','depot','naval_base','command_post'];
const states=['operational','damaged','disabled','destroyed','rebuilding','abandoned'];
async function read(req){
 const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>16000)return null;chunks.push(c)}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}
}
async function transaction(pool,fn){
 const db=await pool.getConnection();
 try{await db.beginTransaction();const response=await fn(db);if(response.status===200)await db.commit();else await db.rollback();return response}
 catch(error){await db.rollback().catch(()=>{});throw error}finally{db.release()}
}
async function log(db,id,activity,detail,actor){
 await db.execute('INSERT INTO world_military_activity(installation_id,activity,detail,actor_id) VALUES(?,?,?,?)',[id,activity,String(detail).slice(0,500),actor.id]);
}
export async function militaryInstallationsRoute(pool,req,path,actor){
 if(!['domina','high_command'].includes(actor?.account_role))return fail(403,'command_required');
 if(path==='/world-admin/military'&&req.method==='GET'){
  const [installations]=await pool.execute(`SELECT i.*,s.name AS location_name,s.controlling_faction_id,s.strategic_state,
   s.region_id,s.zone_id FROM world_military_installations i JOIN world_settlements s ON s.id=i.settlement_id ORDER BY i.name`);
  const [garrisons]=await pool.execute('SELECT * FROM world_military_garrisons ORDER BY troop_type');
  const [ammo]=await pool.execute('SELECT a.*,w.name AS item_name FROM world_military_ammunition a JOIN world_industry_items w ON w.id=a.item_id ORDER BY w.name');
  const [equipment]=await pool.execute(`SELECT v.id,v.stationed_settlement_id,v.quantity,v.status,v.owner_faction_id,t.name,t.equipment_kind
   FROM world_magitek_equipment_inventory v JOIN world_magitek_equipment_templates t ON t.id=v.equipment_template_id
   WHERE v.stationed_settlement_id IS NOT NULL AND v.status IN ('assigned','damaged')`);
  const [settlements]=await pool.execute('SELECT id,name,controlling_faction_id,strategic_state FROM world_settlements ORDER BY name');
  const [items]=await pool.execute("SELECT id,name,category FROM world_industry_items WHERE category IN ('supply','equipment','refined') ORDER BY name");
  const [facilities]=await pool.execute(`SELECT f.id,f.name,f.settlement_id,f.owner_faction_id,s.item_id,s.quantity
    FROM world_industry_facilities f JOIN world_industry_stock s ON s.facility_id=f.id WHERE s.quantity>0 ORDER BY f.name`);
  const [history]=await pool.execute('SELECT * FROM world_military_activity ORDER BY id DESC LIMIT 150');
  return ok({installations:installations.map(i=>({...i,...installationReadiness(i),garrison:garrisons.filter(g=>g.installation_id===i.id),
   ammunition:ammo.filter(a=>a.installation_id===i.id),
   magitek:equipment.filter(e=>e.stationed_settlement_id===i.settlement_id&&e.owner_faction_id===i.controlling_faction_id),
   history:history.filter(h=>h.installation_id===i.id)})),settlements,items,facilities});
 }
 if(path==='/world-admin/military'&&req.method==='POST'){
  const b=await read(req);
  if(!whole(b?.settlement_id,1,Number.MAX_SAFE_INTEGER)||!text(b?.name,140)||!kinds.includes(b.installation_type)||typeof b.notes!=='string'||b.notes.length>10000||typeof b.defenses!=='string'||b.defenses.length>500)return fail(400,'invalid_military_installation');
  return transaction(pool,async db=>{
   const [[site]]=await db.execute('SELECT id,strategic_state FROM world_settlements WHERE id=? FOR UPDATE',[b.settlement_id]);
   if(!site)return fail(404,'location_not_found');
   const [[exists]]=await db.execute('SELECT id FROM world_military_installations WHERE settlement_id=?',[b.settlement_id]);
   if(exists)return fail(409,'installation_already_exists_at_location');
   const initial=site.strategic_state==='destroyed'?'destroyed':site.strategic_state==='abandoned'?'abandoned':'operational';
   const condition=initial==='destroyed'?0:100;
   const [row]=await db.execute('INSERT INTO world_military_installations(settlement_id,name,installation_type,condition_pct,state,defenses,notes,created_by) VALUES(?,?,?,?,?,?,?,?)',
    [b.settlement_id,b.name.trim(),b.installation_type,condition,initial,b.defenses,b.notes,actor.id]);
   await log(db,row.insertId,'create',b.name,actor);
   return ok({id:row.insertId});
  });
 }
 const m=/^\/world-admin\/military\/(\d+)(?:\/(condition|garrison|ammunition))?$/.exec(path);
 if(!m||!whole(Number(m[1]),1,Number.MAX_SAFE_INTEGER))return fail(404,'not_found');
 const installationId=Number(m[1]),action=m[2]||'';
 if(req.method!=='POST'&&req.method!=='PUT')return fail(405,'method_not_allowed');
 const b=await read(req);
 if(!b)return fail(400,'invalid_request');
 return transaction(pool,async db=>{
  const [[installation]]=await db.execute('SELECT i.*,s.controlling_faction_id,s.strategic_state FROM world_military_installations i JOIN world_settlements s ON s.id=i.settlement_id WHERE i.id=? FOR UPDATE',[installationId]);
  if(!installation)return fail(404,'installation_not_found');
  if(!action&&req.method==='PUT'){
   if(!text(b.name,140)||!kinds.includes(b.installation_type)||typeof b.defenses!=='string'||b.defenses.length>500||typeof b.notes!=='string'||b.notes.length>10000)return fail(400,'invalid_military_installation');
   await db.execute('UPDATE world_military_installations SET name=?,installation_type=?,defenses=?,notes=? WHERE id=?',[b.name.trim(),b.installation_type,b.defenses,b.notes,installationId]);
   await log(db,installationId,'edit','Installation details updated',actor);return ok({saved:true});
  }
  if(action==='condition'&&req.method==='POST'){
   if(!['damage','repair'].includes(b.kind)||!whole(b.amount,1,100))return fail(400,'invalid_condition_change');
   const from=Number(installation.condition_pct),to=b.kind==='damage'?Math.max(0,from-b.amount):Math.min(100,from+b.amount);
   const state=b.kind==='damage'?(to===0?'destroyed':to<25?'disabled':'damaged'):(to===100?'operational':to>0?'rebuilding':'destroyed');
   await db.execute('UPDATE world_military_installations SET condition_pct=?,state=? WHERE id=?',[to,state,installationId]);
   await log(db,installationId,b.kind,from+'% → '+to+'%',actor);
   return ok({condition_pct:to,state});
  }
  if(action==='garrison'&&req.method==='POST'){
   if(!text(b.troop_type,80)||!whole(b.quantity,0,1000000))return fail(400,'invalid_garrison');
   await db.execute('INSERT INTO world_military_garrisons(installation_id,troop_type,quantity) VALUES(?,?,?) ON DUPLICATE KEY UPDATE quantity=VALUES(quantity)',[installationId,b.troop_type.trim(),b.quantity]);
   await log(db,installationId,'garrison',b.troop_type.trim()+': '+b.quantity,actor);
   return ok({saved:true});
  }
  if(action==='ammunition'&&req.method==='POST'){
   if(!['deliver','consume'].includes(b.kind)||typeof b.item_id!=='string'||!/^[a-z0-9-]{1,48}$/.test(b.item_id)||!whole(b.quantity,1,1000000)||b.kind==='deliver'&&!whole(b.facility_id,1,Number.MAX_SAFE_INTEGER))return fail(400,'invalid_ammunition_transfer');
   const [[item]]=await db.execute("SELECT id FROM world_industry_items WHERE id=? AND category IN ('supply','equipment','refined')",[b.item_id]);
   if(!item)return fail(400,'invalid_ammunition_item');
   await db.execute('INSERT IGNORE INTO world_military_ammunition(installation_id,item_id,quantity) VALUES(?,?,0)',[installationId,b.item_id]);
   const [[stock]]=await db.execute('SELECT quantity FROM world_military_ammunition WHERE installation_id=? AND item_id=? FOR UPDATE',[installationId,b.item_id]);
   if(b.kind==='deliver'){
    const [[facility]]=await db.execute('SELECT owner_faction_id FROM world_industry_facilities WHERE id=?',[b.facility_id]);
    if(!facility||!installation.controlling_faction_id||facility.owner_faction_id!==installation.controlling_faction_id)return fail(409,'supply_faction_mismatch');
    const [[available]]=await db.execute('SELECT quantity FROM world_industry_stock WHERE facility_id=? AND item_id=? FOR UPDATE',[b.facility_id,b.item_id]);
    if(!available||Number(available.quantity)<b.quantity)return fail(409,'insufficient_facility_stock');
    const after=Number(available.quantity)-b.quantity;
    await db.execute('UPDATE world_industry_stock SET quantity=? WHERE facility_id=? AND item_id=?',[after,b.facility_id,b.item_id]);
    await db.execute('INSERT INTO world_industry_ledger(facility_id,item_id,delta,balance_after,action,reference_key,actor_id) VALUES(?,?,?,?,?,?,?)',[b.facility_id,b.item_id,-b.quantity,after,'military_supply','installation:'+installationId,actor.id]);
   }else if(Number(stock.quantity)<b.quantity)return fail(409,'insufficient_ammunition');
   await db.execute('UPDATE world_military_ammunition SET quantity=quantity+? WHERE installation_id=? AND item_id=?',[b.kind==='deliver'?b.quantity:-b.quantity,installationId,b.item_id]);
   await log(db,installationId,b.kind==='deliver'?'ammo_in':'ammo_out',b.item_id+' '+b.quantity,actor);
   return ok({saved:true});
  }
  return fail(404,'not_found');
 });
}
