import {resolveSession} from './auth.js';

const ok=body=>({status:200,body});
const fail=(status,error)=>({status,body:{error}});
const command=user=>['domina','high_command'].includes(user.account_role);
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
const str=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=max;
const optional=(value,max)=>typeof value==='string'&&value.length<=max;
const qty=(value,max=1000)=>Number.isSafeInteger(value)&&value>0&&value<=max;
const id=value=>Number.isSafeInteger(Number(value))&&Number(value)>0&&Number(value)<=Number.MAX_SAFE_INTEGER;
const categories=['tavern','apothecary','workshop','merchant','hospitality','other'];
async function read(req){
 const parts=[];let bytes=0;for await(const part of req){bytes+=part.length;if(bytes>16000)throw Object.assign(new Error('request_too_large'),{status:413});parts.push(part)}
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{return null}
}
async function atomic(pool,fn){
 const conn=await pool.getConnection();
 try{await conn.beginTransaction();const result=await fn(conn);if(result.status===200)await conn.commit();else await conn.rollback();return result}
 catch(error){await conn.rollback().catch(()=>{});throw error}finally{conn.release()}
}
async function characterOwner(conn,characterId,actorId){
 if(!uuid(characterId))return null;
 const [rows]=await conn.execute('SELECT id,player_account_id,collar_bound FROM characters WHERE id=?',[characterId]);
 return rows[0]?.player_account_id===actorId?rows[0]:null;
}
async function managedFront(conn,frontId,actor,{lock=false}={}){
 const [rows]=await conn.execute('SELECT f.*,c.player_account_id AS owner_account_id FROM order_fronts f LEFT JOIN characters c ON c.id=f.owner_character_id WHERE f.id=?'+(lock?' FOR UPDATE':''),[frontId]);
 const front=rows[0];if(!front)return null;
 if(command(actor)||front.owner_account_id===actor.id)return front;
 const [members]=await conn.execute('SELECT 1 FROM order_front_staff fs JOIN characters c ON c.id=fs.character_id WHERE fs.front_id=? AND c.player_account_id=? AND fs.staff_role="manager" LIMIT 1',[frontId,actor.id]);
 return members.length?front:null;
}
async function logStock(conn,materialId,delta,accountId,characterId,activity,frontId){
 await conn.execute('INSERT IGNORE INTO fc_material_stock(material_id,quantity) VALUES(?,0)',[materialId]);
 const [[stock]]=await conn.execute('SELECT quantity FROM fc_material_stock WHERE material_id=? FOR UPDATE',[materialId]);
 const balance=Number(stock.quantity)+delta;
 if(balance<0||balance>4294967295)return false;
 await conn.execute('UPDATE fc_material_stock SET quantity=? WHERE material_id=?',[balance,materialId]);
 await conn.execute('INSERT INTO fc_material_ledger(material_id,delta,balance_after,activity,account_id,character_id,note) VALUES(?,?,?,?,?,?,?)',
  [materialId,delta,balance,activity,accountId,characterId,'Front #'+frontId+' stock '+(delta>0?'return':'allocation')]);
 return true;
}
export async function applyFrontTrade(conn,{frontId,deliveryId,revenue,accountId}){
 if(!frontId||!revenue)return ok({retained:0});
 const [[front]]=await conn.execute('SELECT status,order_share_percent,balance,name FROM order_fronts WHERE id=? FOR UPDATE',[frontId]);
 if(!front||front.status!=='active')return fail(409,'front_not_active');
 const retained=Math.floor(revenue*(100-Number(front.order_share_percent))/100);
 if(!retained)return ok({retained:0});
 const [[treasury]]=await conn.execute('SELECT balance FROM order_treasury WHERE id=1 FOR UPDATE');
 const next=Number(treasury.balance)-retained,frontNext=Number(front.balance)+retained;
 if(next<0||!Number.isSafeInteger(frontNext))return fail(409,'front_allocation_failed');
 await conn.execute('UPDATE order_treasury SET balance=? WHERE id=1',[next]);
 await conn.execute('UPDATE order_fronts SET balance=? WHERE id=?',[frontNext,frontId]);
 await conn.execute('INSERT INTO order_treasury_ledger(direction,category,amount,balance_after,account_id,character_id,source_id,note) VALUES("expense","front_share",?,?,?,?,?,?)',
  [retained,next,accountId,null,'front:'+deliveryId,'Front #'+frontId+' retained trade earnings']);
 await conn.execute('INSERT INTO order_front_ledger(front_id,kind,gross_amount,amount,balance_after,source_delivery_id,description,by_account) VALUES(?,"trade_income",?,?,?,?,?,?)',
  [frontId,revenue,retained,frontNext,deliveryId,'Trade commission for '+front.name,accountId]);
 return ok({retained});
}
export async function authorizeFrontTrade(conn,frontId,actor,{materialId,quantity,characterId}){
 const front=await managedFront(conn,frontId,actor,{lock:true});
 if(!front||front.status!=='active'){
  const [workers]=await conn.execute('SELECT 1 FROM order_fronts f JOIN order_front_staff fs ON fs.front_id=f.id JOIN characters c ON c.id=fs.character_id WHERE f.id=? AND f.status="active" AND c.player_account_id=? LIMIT 1',[frontId,actor.id]);
  if(!workers.length)return fail(403,'front_not_authorized');
 }
 if(materialId){
  await conn.execute('INSERT IGNORE INTO order_front_stock(front_id,material_id,quantity) VALUES(?,?,0)',[frontId,materialId]);
  const [[stock]]=await conn.execute('SELECT quantity FROM order_front_stock WHERE front_id=? AND material_id=? FOR UPDATE',[frontId,materialId]);
  if(Number(stock.quantity)<quantity)return fail(409,'front_stock_insufficient');
  await conn.execute('UPDATE order_front_stock SET quantity=quantity-? WHERE front_id=? AND material_id=?',[quantity,frontId,materialId]);
 }
 return ok({front_id:Number(frontId)});
}

export async function frontsRoute(pool,req,path){
 if(!pool)return fail(503,'database_unavailable');
 const actor=await resolveSession(pool,req);
 if(!actor)return fail(401,'not_authenticated');
 const isCommand=command(actor);
 if(path==='/fronts'&&req.method==='GET'){
  const [rows]=await pool.execute('SELECT f.*,c.character_name AS owner_name,c.player_account_id AS owner_account_id, a.display_name AS founder_name FROM order_fronts f LEFT JOIN characters c ON c.id=f.owner_character_id JOIN accounts a ON a.id=f.created_by ORDER BY f.created_at DESC,f.id DESC');
  const [staff]=await pool.execute('SELECT fs.front_id,c.player_account_id FROM order_front_staff fs JOIN characters c ON c.id=fs.character_id WHERE c.player_account_id=?',[actor.id]);
  const permitted=new Set(staff.map(s=>Number(s.front_id)));
  return ok({fronts:rows.filter(f=>isCommand||f.status==='active'||f.owner_account_id===actor.id||permitted.has(Number(f.id))).map(f=>{
   const manage=isCommand||f.owner_account_id===actor.id||permitted.has(Number(f.id));
   return {id:f.id,name:f.name,category:f.category,location:f.location,description:f.description,ownership:f.ownership,owner_name:f.owner_name,owner_character_id:manage?f.owner_character_id:null,status:f.status,ic_approved:!!f.ic_approved,site_approved:!!f.site_approved,order_share_percent:manage?Number(f.order_share_percent):null,balance:manage?Number(f.balance):null,can_manage:manage,created_at:f.created_at};
  })});
 }
 if(path==='/fronts'&&req.method==='POST'){
  const b=await read(req);
  if(!str(b?.name,110)||!categories.includes(b.category)||!str(b.location,150)||!optional(b.description,1200)||
   !['member','order'].includes(b.ownership)||!optional(b.license_terms||'',900))return fail(400,'invalid_front_application');
  if(b.ownership==='order'&&!isCommand)return fail(403,'command_required');
  return atomic(pool,async conn=>{
   let ownerId=null;
   if(b.ownership==='member'){
    const ch=await characterOwner(conn,b.owner_character_id,actor.id);
    if(!ch||ch.collar_bound)return fail(403,'eligible_character_sheet_required');
    ownerId=ch.id;
   }
   const [created]=await conn.execute('INSERT INTO order_fronts(name,category,location,description,ownership,owner_character_id,created_by,license_terms) VALUES(?,?,?,?,?,?,?,?)',
    [b.name.trim(),b.category,b.location.trim(),b.description.trim(),b.ownership,ownerId,actor.id,b.license_terms||'']);
   return ok({status:'submitted',id:created.insertId});
  });
 }
 const route=/^\/fronts\/(\d+)(?:\/(.+))?$/.exec(path);
 if(!route)return fail(404,'not_found');
 const frontId=Number(route[1]),action=route[2]||'';
 if(!id(frontId))return fail(400,'invalid_front');
 if(req.method==='GET'&&!action){
  const [rows]=await pool.execute('SELECT f.*,c.character_name AS owner_name,c.player_account_id AS owner_account_id FROM order_fronts f LEFT JOIN characters c ON c.id=f.owner_character_id WHERE f.id=?',[frontId]);
  const front=rows[0];if(!front)return fail(404,'front_not_found');
  const [isStaff]=await pool.execute('SELECT fs.staff_role FROM order_front_staff fs JOIN characters c ON c.id=fs.character_id WHERE fs.front_id=? AND c.player_account_id=? LIMIT 1',[frontId,actor.id]);
  const manage=isCommand||front.owner_account_id===actor.id||isStaff.length>0;
  if(front.status!=='active'&&!manage)return fail(404,'front_not_found');
  const [[offers],[staff],[stocks],[ledger]] = await Promise.all([
   pool.execute('SELECT o.id,o.offer_type,o.material_id,o.name,o.description,o.posted_price,o.is_active FROM order_front_offerings o WHERE o.front_id=? ORDER BY o.id DESC',[frontId]),
   manage?pool.execute('SELECT s.character_id,c.character_name,s.staff_role FROM order_front_staff s JOIN characters c ON c.id=s.character_id WHERE s.front_id=? ORDER BY s.staff_role,c.character_name',[frontId]):Promise.resolve([[]]),
   manage?pool.execute('SELECT s.material_id,m.name,s.quantity FROM order_front_stock s JOIN fc_materials m ON m.id=s.material_id WHERE s.front_id=? ORDER BY m.name',[frontId]):Promise.resolve([[]]),
   manage?pool.execute('SELECT kind,gross_amount,amount,balance_after,description,created_at FROM order_front_ledger WHERE front_id=? ORDER BY id DESC LIMIT 60',[frontId]):Promise.resolve([[]])
  ]);
  return ok({front:{...front,balance:manage?Number(front.balance):null,order_share_percent:manage?Number(front.order_share_percent):null,license_terms:manage?front.license_terms:null,can_manage:manage,ic_approved:!!front.ic_approved,site_approved:!!front.site_approved},offers:offers.filter(o=>manage||o.is_active),staff,stocks,ledger});
 }
 if(action==='approve'&&req.method==='POST'){
  if(!isCommand)return fail(403,'command_required');
  const b=await read(req);
  if(!['ic','website'].includes(b?.stage)||typeof b?.approved!=='boolean')return fail(400,'invalid_approval');
  return atomic(pool,async conn=>{
   const [rows]=await conn.execute('SELECT id,status,ic_approved,site_approved FROM order_fronts WHERE id=? FOR UPDATE',[frontId]);
   if(!rows.length)return fail(404,'front_not_found');
   if(rows[0].status==='closed')return fail(409,'front_closed');
   const ic=b.stage==='ic'?Number(b.approved):Number(rows[0].ic_approved);
   const site=b.stage==='website'?Number(b.approved):Number(rows[0].site_approved);
   const status=ic&&site&&rows[0].status!=='suspended'?'active':'pending';
   await conn.execute('UPDATE order_fronts SET ic_approved=?,site_approved=?,status=? WHERE id=?',[ic,site,status,frontId]);
   return ok({status,ic_approved:!!ic,site_approved:!!site});
  });
 }
 if(action==='status'&&req.method==='POST'){
  if(!isCommand)return fail(403,'command_required');
  const b=await read(req);if(!['active','suspended','closed'].includes(b?.status))return fail(400,'invalid_front_status');
  return atomic(pool,async conn=>{
   const [[f]]=await conn.execute('SELECT ic_approved,site_approved,status FROM order_fronts WHERE id=? FOR UPDATE',[frontId]);
   if(!f)return fail(404,'front_not_found');
   if(f.status==='closed')return fail(409,'front_closed');
   if(b.status==='active'&&(!f.ic_approved||!f.site_approved))return fail(409,'both_approvals_required');
   await conn.execute('UPDATE order_fronts SET status=? WHERE id=?',[b.status,frontId]);
   return ok({status:b.status});
  });
 }
 if(action==='license'&&req.method==='POST'){
  if(!isCommand)return fail(403,'command_required');
  const b=await read(req);
  if(!categories.includes(b?.category)||!str(b.location,150)||!optional(b.license_terms,900)||!Number.isInteger(b.order_share_percent)||b.order_share_percent<0||b.order_share_percent>100)return fail(400,'invalid_license');
  await pool.execute('UPDATE order_fronts SET category=?,location=?,license_terms=?,order_share_percent=? WHERE id=?',
   [b.category,b.location.trim(),b.license_terms,b.order_share_percent,frontId]);
  return ok({status:'saved'});
 }
 if(action==='staff'&&req.method==='POST'){
  const b=await read(req);
  if(!uuid(b?.character_id)||!['manager','employee'].includes(b.staff_role))return fail(400,'invalid_staff');
  return atomic(pool,async conn=>{
   const front=await managedFront(conn,frontId,actor,{lock:true});
   if(!front||front.status!=='active')return fail(403,'front_not_authorized');
   const [characters]=await conn.execute('SELECT c.id FROM characters c JOIN accounts a ON a.id=c.player_account_id WHERE c.id=? AND a.is_active=1 AND a.approval_status="approved"',[b.character_id]);
   if(!characters.length)return fail(404,'character_not_eligible');
   await conn.execute('INSERT INTO order_front_staff(front_id,character_id,staff_role,assigned_by) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE staff_role=VALUES(staff_role),assigned_by=VALUES(assigned_by)',
    [frontId,b.character_id,b.staff_role,actor.id]);
   return ok({status:'assigned'});
  });
 }
 const removeStaff=/^staff\/([0-9a-f-]{36})$/.exec(action);
 if(removeStaff&&req.method==='DELETE'){
  return atomic(pool,async conn=>{
   const front=await managedFront(conn,frontId,actor,{lock:true});
   if(!front)return fail(403,'front_not_authorized');
   await conn.execute('DELETE FROM order_front_staff WHERE front_id=? AND character_id=?',[frontId,removeStaff[1]]);
   return ok({status:'removed'});
  });
 }
 if(action==='offerings'&&req.method==='POST'){
  const b=await read(req);
  if(!['goods','service'].includes(b?.offer_type)||!str(b.name,120)||!optional(b.description,500)||
   !Number.isInteger(b.posted_price)||b.posted_price<0||b.posted_price>100000||
   (b.offer_type==='goods'&&!(typeof b.material_id==='string'&&b.material_id.length<=48)))return fail(400,'invalid_front_offering');
  return atomic(pool,async conn=>{
   const front=await managedFront(conn,frontId,actor,{lock:true});
   if(!front||front.status!=='active')return fail(403,'front_not_authorized');
   if(b.offer_type==='goods'){
    const [materials]=await conn.execute('SELECT id FROM fc_materials WHERE id=?',[b.material_id]);
    if(!materials.length)return fail(404,'material_not_found');
   }
   const [created]=await conn.execute('INSERT INTO order_front_offerings(front_id,offer_type,material_id,name,description,posted_price) VALUES(?,?,?,?,?,?)',
    [frontId,b.offer_type,b.offer_type==='goods'?b.material_id:null,b.name.trim(),b.description.trim(),b.posted_price]);
   return ok({status:'posted',id:created.insertId});
  });
 }
 const offering=/^offerings\/(\d+)$/.exec(action);
 if(offering&&req.method==='DELETE'){
  return atomic(pool,async conn=>{
   const front=await managedFront(conn,frontId,actor,{lock:true});
   if(!front)return fail(403,'front_not_authorized');
   const [done]=await conn.execute('UPDATE order_front_offerings SET is_active=0 WHERE id=? AND front_id=?',[Number(offering[1]),frontId]);
   return done.affectedRows?ok({status:'retired'}):fail(404,'offering_not_found');
  });
 }
 if(action==='stock'&&req.method==='POST'){
  const b=await read(req);
  if(!['allocate','return'].includes(b?.direction)||!qty(b.quantity,100000)||!uuid(b.character_id)||
   typeof b.material_id!=='string'||b.material_id.length>48)return fail(400,'invalid_stock_transfer');
  return atomic(pool,async conn=>{
   const front=await managedFront(conn,frontId,actor,{lock:true});
   if(!front||front.status!=='active')return fail(403,'front_not_authorized');
   if(!await characterOwner(conn,b.character_id,actor.id))return fail(403,'character_owner_required');
   await conn.execute('INSERT IGNORE INTO order_front_stock(front_id,material_id,quantity) VALUES(?,?,0)',[frontId,b.material_id]);
   const [[frontStock]]=await conn.execute('SELECT quantity FROM order_front_stock WHERE front_id=? AND material_id=? FOR UPDATE',[frontId,b.material_id]);
   if(b.direction==='return'&&Number(frontStock.quantity)<b.quantity)return fail(409,'front_stock_insufficient');
   if(!await logStock(conn,b.material_id,b.direction==='allocate'?-b.quantity:b.quantity,actor.id,b.character_id,b.direction==='allocate'?'front_transfer':'front_return',frontId))return fail(409,'fc_stock_insufficient');
   await conn.execute('UPDATE order_front_stock SET quantity=quantity+? WHERE front_id=? AND material_id=?',
    [b.direction==='allocate'?b.quantity:-b.quantity,frontId,b.material_id]);
   return ok({status:'transferred',quantity:b.quantity});
  });
 }
 if(action==='expenses'&&req.method==='POST'){
  const b=await read(req);
  if(!qty(b?.amount,1000000)||!str(b.description,250))return fail(400,'invalid_front_expense');
  return atomic(pool,async conn=>{
   const front=await managedFront(conn,frontId,actor,{lock:true});
   if(!front||front.status!=='active')return fail(403,'front_not_authorized');
   if(Number(front.balance)<b.amount)return fail(409,'front_funds_insufficient');
   const next=Number(front.balance)-b.amount;
   await conn.execute('UPDATE order_fronts SET balance=? WHERE id=?',[next,frontId]);
   await conn.execute('INSERT INTO order_front_ledger(front_id,kind,amount,balance_after,description,by_account) VALUES(?,"operating_expense",?,?,?,?)',
    [frontId,b.amount,next,b.description.trim(),actor.id]);
   return ok({status:'recorded',balance:next});
  });
 }
 return fail(404,'not_found');
}
