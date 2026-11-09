import {atomicIndustry} from './world-industry-engine.js';
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
async function json(req){const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>16000)return null;chunks.push(chunk)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}}
const parse=x=>typeof x==='string'?JSON.parse(x):x;
export function calculateTrainCapacity(loc,cars){
 const engine=parse(loc.specifications);
 const rows=cars.map(x=>({lot_id:Number(x.id),name:x.name||x.template_name,quantity:Number(x.quantity),
  equipment_kind:parse(x.specifications).equipment_kind,
  cargo_capacity:Number(parse(x.specifications).cargo_capacity||0)*Number(x.quantity),
  transport_capacity:Number(parse(x.specifications).transport_capacity||0)*Number(x.quantity)}));
 return {wagon_count:rows.reduce((n,x)=>n+x.quantity,0),
  cargo_capacity:Number(engine.cargo_capacity||0)+rows.reduce((n,x)=>n+x.cargo_capacity,0),
  transport_capacity:Number(engine.transport_capacity||0)+rows.reduce((n,x)=>n+x.transport_capacity,0),
  crew_required:Number(engine.crew_required||0)+cars.reduce((n,x)=>n+Number(parse(x.specifications).crew_required||0)*Number(x.quantity),0),
  fuel_item_id:engine.fuel_item_id||null,
  fuel_per_operation:Number(engine.fuel_per_operation||0),
  locomotive:{lot_id:Number(loc.id),name:loc.name||loc.template_name,specifications:engine},
  cars:rows};
}
export async function trainSummary(db){
 const [trains]=await db.execute(`SELECT c.*,l.quantity AS locomotive_quantity,t.name AS locomotive_name,
 l.specifications AS locomotive_specs
 FROM world_magitek_train_consists c
 JOIN world_magitek_equipment_inventory l ON l.id=c.locomotive_lot_id
 JOIN world_magitek_equipment_templates t ON t.id=l.equipment_template_id
 ORDER BY c.id DESC LIMIT 200`);
 const [cars]=await db.execute(`SELECT j.consist_id,l.id,l.quantity,l.specifications,t.name AS template_name
 FROM world_magitek_train_cars j
 JOIN world_magitek_equipment_inventory l ON l.id=j.car_lot_id
 JOIN world_magitek_equipment_templates t ON t.id=l.equipment_template_id
 ORDER BY j.consist_id,l.id`);
 return trains.map(t=>{
  const locomotive={id:t.locomotive_lot_id,quantity:t.locomotive_quantity,name:t.locomotive_name,specifications:parse(t.locomotive_specs)};
  const details=calculateTrainCapacity(locomotive,cars.filter(x=>Number(x.consist_id)===Number(t.id)));
  return {id:t.id,name:t.name,owner_faction_id:t.owner_faction_id,status:t.status,
   locomotive_lot_id:t.locomotive_lot_id,created_at:t.created_at,disbanded_at:t.disbanded_at,...details};
 });
}
export async function trainRoute(pool,req,path,actor){
 if(!['domina','high_command'].includes(actor?.account_role))return fail(403,'command_required');
 if(path==='/world-admin/industry/trains'&&req.method==='GET')return ok({trains:await trainSummary(pool)});
 if(path==='/world-admin/industry/trains'&&req.method==='POST'){
  const b=await json(req);
  if(!b||typeof b.name!=='string'||!b.name.trim()||b.name.length>140||
   !integer(b.locomotive_lot_id,1,Number.MAX_SAFE_INTEGER)||!Array.isArray(b.car_lot_ids)||
   !b.car_lot_ids.length||b.car_lot_ids.length>24||
   !b.car_lot_ids.every(x=>integer(x,1,Number.MAX_SAFE_INTEGER))||
   new Set([b.locomotive_lot_id,...b.car_lot_ids]).size!==b.car_lot_ids.length+1)
   return fail(400,'invalid_train_composition');
  return atomicIndustry(pool,async db=>{
   const ids=[b.locomotive_lot_id,...b.car_lot_ids].sort((a,b)=>a-b);
   const [lots]=await db.query(`SELECT i.*,t.equipment_kind,t.name AS template_name
     FROM world_magitek_equipment_inventory i
     JOIN world_magitek_equipment_templates t ON t.id=i.equipment_template_id
     WHERE i.id IN (${ids.map(()=>'?').join(',')}) ORDER BY i.id FOR UPDATE`,ids);
   if(lots.length!==ids.length)return fail(404,'train_equipment_not_found');
   const locomotive=lots.find(x=>Number(x.id)===b.locomotive_lot_id);
   if(locomotive.equipment_kind!=='locomotive'||locomotive.quantity!==1&&Number(locomotive.quantity)!==1)
    return fail(409,'train_requires_single_commissioned_locomotive');
   const cars=b.car_lot_ids.map(id=>lots.find(x=>Number(x.id)===id));
   if(cars.some(x=>x.equipment_kind!=='railcar'))return fail(409,'train_requires_railcars');
   if(lots.some(x=>x.status!=='reserve'||x.owner_faction_id!==locomotive.owner_faction_id))
    return fail(409,'train_units_must_share_faction_reserve');
   if(locomotive.owner_faction_id!=='eclipse-order')return fail(409,'order_train_assembly_only');
   const spec=parse(locomotive.specifications);
   const totalCars=cars.reduce((n,x)=>n+Number(x.quantity),0);
   if(totalCars>Math.max(1,Number(spec.max_wagons||8)))return fail(409,'locomotive_haul_limit_exceeded');
   const [occupied]=await db.query(`SELECT c.id FROM world_magitek_train_consists c WHERE c.status='assembled' AND
    (c.locomotive_lot_id IN (${ids.map(()=>'?').join(',')}) OR
    EXISTS(SELECT 1 FROM world_magitek_train_cars j WHERE j.consist_id=c.id AND
    j.car_lot_id IN (${ids.map(()=>'?').join(',')}))) LIMIT 1`,[...ids,...ids]);
   if(occupied.length)return fail(409,'train_equipment_already_assembled');
   const [created]=await db.execute("INSERT INTO world_magitek_train_consists(name,owner_faction_id,locomotive_lot_id,created_by) VALUES(?,?,?,?)",[b.name.trim(),locomotive.owner_faction_id,locomotive.id,actor.id]);
   for(const car of cars)await db.execute('INSERT INTO world_magitek_train_cars(consist_id,car_lot_id) VALUES(?,?)',[created.insertId,car.id]);
   await db.query("UPDATE world_magitek_equipment_inventory SET status='assigned' WHERE id IN ("+ids.map(()=>'?').join(',')+")",ids);
   await db.execute("INSERT INTO world_magitek_train_events(consist_id,action,actor_id,description) VALUES(?,'assemble',?,?)",[created.insertId,actor.id,'Commissioned rail equipment assembled into a train']);
   return ok({id:created.insertId,...calculateTrainCapacity(locomotive,cars)});
  });
 }
 const m=/^\/world-admin\/industry\/trains\/(\d+)\/disband$/.exec(path);
 if(m&&req.method==='POST'){
  return atomicIndustry(pool,async db=>{
   const id=Number(m[1]);
   const [[train]]=await db.execute('SELECT * FROM world_magitek_train_consists WHERE id=? FOR UPDATE',[id]);
   if(!train)return fail(404,'train_not_found');
   if(train.status!=='assembled')return fail(409,'train_already_disbanded');
   const [cars]=await db.execute('SELECT car_lot_id FROM world_magitek_train_cars WHERE consist_id=?',[id]);
   const ids=[Number(train.locomotive_lot_id),...cars.map(x=>Number(x.car_lot_id))].sort((a,b)=>a-b);
   const [units]=await db.query('SELECT id,status FROM world_magitek_equipment_inventory WHERE id IN ('+ids.map(()=>'?').join(',')+') ORDER BY id FOR UPDATE',ids);
   if(units.length!==ids.length||units.some(x=>x.status!=='assigned'))return fail(409,'train_units_changed');
   await db.execute("UPDATE world_magitek_train_consists SET status='disbanded',disbanded_at=UTC_TIMESTAMP() WHERE id=?",[id]);
   await db.query("UPDATE world_magitek_equipment_inventory SET status='reserve' WHERE id IN ("+ids.map(()=>'?').join(',')+")",ids);
   await db.execute("INSERT INTO world_magitek_train_events(consist_id,action,actor_id,description) VALUES(?,'disband',?,?)",[id,actor.id,'Locomotive and railcars returned to fleet reserve']);
   return ok({saved:true,returned_units:ids.length});
  });
 }
 return fail(404,'train_route_not_found');
}
