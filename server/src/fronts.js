import {resolveSession} from './auth.js';
import {frontCargoRoute} from './world-front-cargo.js';
import {cycleDate} from './treasury.js';

const ok=body=>({status:200,body});
const fail=(status,error)=>({status,body:{error}});
const command=user=>['domina','high_command'].includes(user.account_role);
async function isClawOfficer(conn,actor){
 if(command(actor))return true;
 const [rows]=await conn.execute('SELECT 1 FROM account_order_ranks WHERE account_id=? AND track="golden_claws" AND rank_code IN ("high_claw","gilded_talon") LIMIT 1',[actor.id]);
 return rows.length>0;
}
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
 if(command(actor)||actor.front_officer||front.owner_account_id===actor.id)return front;
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
// Front expenses are charged from business reserves at the same daily reset as wages.
// A separate cycle record prevents replay after a Windows API restart or overlapping ticks.
export async function runFrontDailyExpenses(pool,now=new Date()){
 if(!pool)return null;
 const [[settings]]=await pool.query('SELECT reset_hour_utc FROM order_payroll_settings WHERE id=1');
 const cycle=cycleDate(now,Number(settings.reset_hour_utc));
 const [fronts]=await pool.query('SELECT id FROM order_fronts WHERE status="active" ORDER BY id');
 const totals={cycle,processed:0,paid:0,shortfall:0,unitsConsumed:0,unitsMissing:0};
 for(const row of fronts){
  const result=await atomic(pool,async conn=>{
   const [rows]=await conn.execute('SELECT id,balance,status,daily_rent,daily_supplies,daily_upkeep FROM order_fronts WHERE id=? FOR UPDATE',[row.id]);
   const front=rows[0];
   if(!front||front.status!=='active')return ok({status:'inactive'});
   const [previous]=await conn.execute('SELECT front_id FROM order_front_daily_expenses WHERE front_id=? AND cycle_date=?',[front.id,cycle]);
   if(previous.length)return ok({status:'already_recorded'});
   const scheduled=Number(front.daily_rent)+Number(front.daily_upkeep);
   const available=Number(front.balance);
   const paid=Math.min(scheduled,available),shortfall=scheduled-paid;
   await conn.execute('INSERT INTO order_front_daily_expenses(front_id,cycle_date,scheduled_total,paid_total,shortfall) VALUES(?,?,?,?,?)',
    [front.id,cycle,scheduled,paid,shortfall]);
   if(paid){
    const balance=available-paid;
    await conn.execute('UPDATE order_fronts SET balance=? WHERE id=?',[balance,front.id]);
    await conn.execute('INSERT INTO order_front_ledger(front_id,kind,amount,balance_after,description,by_account) VALUES(?,"operating_expense",?,?,?,NULL)',
     [front.id,paid,balance,'Automatic daily operating costs · '+cycle]);
   }
   // Physically consume each configured supply from stock already assigned to this front.
   // Row locks serialize consumption with trade shipments and manual allocations.
   const [requirements]=await conn.execute('SELECT material_id,daily_quantity FROM order_front_supply_requirements WHERE front_id=? ORDER BY material_id',[front.id]);
   let unitsConsumed=0,unitsMissing=0;
   for(const requirement of requirements){
    const [stockRows]=await conn.execute('SELECT quantity FROM order_front_stock WHERE front_id=? AND material_id=? FOR UPDATE',[front.id,requirement.material_id]);
    const available=Number(stockRows[0]?.quantity||0),needed=Number(requirement.daily_quantity);
    const consumed=Math.min(needed,available),missing=needed-consumed;
    if(consumed)await conn.execute('UPDATE order_front_stock SET quantity=quantity-? WHERE front_id=? AND material_id=?',[consumed,front.id,requirement.material_id]);
    await conn.execute('INSERT INTO order_front_daily_supplies(front_id,cycle_date,material_id,required_quantity,consumed_quantity,missing_quantity) VALUES(?,?,?,?,?,?)',
     [front.id,cycle,requirement.material_id,needed,consumed,missing]);
    unitsConsumed+=consumed;unitsMissing+=missing;
   }
   return ok({status:'recorded',paid,shortfall,unitsConsumed,unitsMissing});
  });
  if(result.body?.status==='recorded'){
   totals.processed++;
   totals.paid+=result.body.paid;
   totals.shortfall+=result.body.shortfall;
   totals.unitsConsumed+=result.body.unitsConsumed;
   totals.unitsMissing+=result.body.unitsMissing;
  }
 }
 return totals;
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
 const front=await managedFront(conn,frontId,{...actor,front_officer:await isClawOfficer(conn,actor)},{lock:true});
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
 if(path.startsWith('/fronts/cargo'))return frontCargoRoute(pool,req,path);
 if(!pool)return fail(503,'database_unavailable');
 const actor=await resolveSession(pool,req);
 if(!actor)return fail(401,'not_authenticated');
 const isCommand=command(actor);
 const isOfficer=await isClawOfficer(pool,actor);
 actor.front_officer=isOfficer;
 if(path==='/fronts'&&req.method==='GET'){
  const [rows]=await pool.execute('SELECT f.*,c.character_name AS owner_name,c.player_account_id AS owner_account_id, a.display_name AS founder_name FROM order_fronts f LEFT JOIN characters c ON c.id=f.owner_character_id JOIN accounts a ON a.id=f.created_by ORDER BY f.created_at DESC,f.id DESC');
  const [staff]=await pool.execute('SELECT fs.front_id,fs.staff_role FROM order_front_staff fs JOIN characters c ON c.id=fs.character_id WHERE c.player_account_id=?',[actor.id]);
  const permitted=new Set(staff.map(s=>Number(s.front_id)));
  const managers=new Set(staff.filter(s=>s.staff_role==='manager').map(s=>Number(s.front_id)));
  return ok({fronts:rows.filter(f=>isOfficer||f.status==='active'||f.owner_account_id===actor.id||permitted.has(Number(f.id))).map(f=>{
   const manage=isOfficer||f.owner_account_id===actor.id||managers.has(Number(f.id));
   return {id:f.id,name:f.name,category:f.category,location:f.location,description:f.description,ownership:f.ownership,owner_name:f.owner_name,owner_character_id:manage?f.owner_character_id:null,status:f.status,ic_approved:!!f.ic_approved,site_approved:!!f.site_approved,order_share_percent:manage?Number(f.order_share_percent):null,balance:manage?Number(f.balance):null,can_manage:manage,can_ship:isOfficer||f.owner_account_id===actor.id||permitted.has(Number(f.id)),created_at:f.created_at};
  })});
 }
 if(path==='/fronts'&&req.method==='POST'){
  const b=await read(req);
  if(!str(b?.name,110)||!categories.includes(b.category)||!str(b.location,150)||!optional(b.description,1200)||
   !['member','order'].includes(b.ownership)||!optional(b.license_terms||'',900))return fail(400,'invalid_front_application');
  if(b.ownership==='order'&&!isOfficer)return fail(403,'front_officer_required');
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
 if(req.method==='GET'&&action==='stocks'){
  const [[front]]=await pool.execute('SELECT status FROM order_fronts WHERE id=?',[frontId]);
  if(!front||front.status!=='active')return fail(404,'front_not_active');
  const [authorization]=await pool.execute('SELECT 1 FROM order_fronts f LEFT JOIN characters owner ON owner.id=f.owner_character_id WHERE f.id=? AND owner.player_account_id=? UNION SELECT 1 FROM order_front_staff s JOIN characters c ON c.id=s.character_id WHERE s.front_id=? AND c.player_account_id=? LIMIT 1',
   [frontId,actor.id,frontId,actor.id]);
  if(!isOfficer&&!authorization.length)return fail(403,'front_not_authorized');
  const [stocks]=await pool.execute('SELECT material_id,quantity FROM order_front_stock WHERE front_id=? ORDER BY material_id',[frontId]);
  return ok({stocks});
 }
 if(req.method==='GET'&&!action){
  const [rows]=await pool.execute('SELECT f.*,c.character_name AS owner_name,c.player_account_id AS owner_account_id FROM order_fronts f LEFT JOIN characters c ON c.id=f.owner_character_id WHERE f.id=?',[frontId]);
  const front=rows[0];if(!front)return fail(404,'front_not_found');
  const [isStaff]=await pool.execute('SELECT fs.staff_role FROM order_front_staff fs JOIN characters c ON c.id=fs.character_id WHERE fs.front_id=? AND c.player_account_id=? LIMIT 1',[frontId,actor.id]);
  const manage=isOfficer||front.owner_account_id===actor.id||isStaff.some(s=>s.staff_role==='manager');
  if(front.status!=='active'&&!manage)return fail(404,'front_not_found');
  const [[offers],[staff],[stocks],[ledger],[changes],[dailyExpenses],[supplyRequirements],[dailySupplies]] = await Promise.all([
   pool.execute('SELECT o.id,o.offer_type,o.material_id,o.name,o.description,o.posted_price,o.restricted,o.is_active FROM order_front_offerings o WHERE o.front_id=? ORDER BY o.id DESC',[frontId]),
   manage?pool.execute('SELECT s.character_id,c.character_name,s.staff_role FROM order_front_staff s JOIN characters c ON c.id=s.character_id WHERE s.front_id=? ORDER BY s.staff_role,c.character_name',[frontId]):Promise.resolve([[]]),
   manage?pool.execute('SELECT s.material_id,m.name,s.quantity FROM order_front_stock s JOIN fc_materials m ON m.id=s.material_id WHERE s.front_id=? ORDER BY m.name',[frontId]):Promise.resolve([[]]),
   manage?pool.execute('SELECT kind,gross_amount,amount,balance_after,description,created_at FROM order_front_ledger WHERE front_id=? ORDER BY id DESC LIMIT 60',[frontId]):Promise.resolve([[]]),
   manage?pool.execute('SELECT id,request_type,requested_value,justification,state,created_at,reviewed_at FROM order_front_change_requests WHERE front_id=? ORDER BY id DESC LIMIT 50',[frontId]):Promise.resolve([[]]),
   manage?pool.execute('SELECT cycle_date,scheduled_total,paid_total,shortfall FROM order_front_daily_expenses WHERE front_id=? ORDER BY cycle_date DESC LIMIT 30',[frontId]):Promise.resolve([[]]),
   manage?pool.execute('SELECT r.material_id,m.name,r.daily_quantity,COALESCE(s.quantity,0) AS stock_quantity FROM order_front_supply_requirements r JOIN fc_materials m ON m.id=r.material_id LEFT JOIN order_front_stock s ON s.front_id=r.front_id AND s.material_id=r.material_id WHERE r.front_id=? ORDER BY m.name',[frontId]):Promise.resolve([[]]),
   manage?pool.execute('SELECT d.cycle_date,d.material_id,m.name,d.required_quantity,d.consumed_quantity,d.missing_quantity FROM order_front_daily_supplies d JOIN fc_materials m ON m.id=d.material_id WHERE d.front_id=? ORDER BY d.cycle_date DESC,m.name LIMIT 80',[frontId]):Promise.resolve([[]])
  ]);
  return ok({front:{...front,balance:manage?Number(front.balance):null,order_share_percent:manage?Number(front.order_share_percent):null,license_terms:manage?front.license_terms:null,can_manage:manage,ic_approved:!!front.ic_approved,site_approved:!!front.site_approved},offers:offers.filter(o=>manage||o.is_active),staff,stocks,ledger,daily_expenses:dailyExpenses,supply_requirements:supplyRequirements,daily_supplies:dailySupplies,change_requests:changes});
 }
 if(action==='approve'&&req.method==='POST'){
  const b=await read(req);
  if(!['ic','website'].includes(b?.stage)||typeof b?.approved!=='boolean')return fail(400,'invalid_approval');
  if(b.stage==='website'&&!isCommand)return fail(403,'website_command_required');
  if(b.stage==='ic'&&!isOfficer)return fail(403,'front_officer_required');
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
  const b=await read(req);if(!['active','suspended','closed'].includes(b?.status))return fail(400,'invalid_front_status');
  if(!isOfficer||b.status==='closed'&&!isCommand)return fail(403,'front_officer_required');
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
 if(action==='changes'&&req.method==='POST'){
  const b=await read(req);
  if(!['location','category','expansion','restricted_service'].includes(b?.request_type)||
   !str(b.requested_value,400)||!optional(b.justification,900)||
   (b.request_type==='category'&&!categories.includes(b.requested_value))||
   (b.request_type==='location'&&b.requested_value.length>150))return fail(400,'invalid_change_request');
  return atomic(pool,async conn=>{
   const front=await managedFront(conn,frontId,actor,{lock:true});
   if(!front||front.status==='closed')return fail(403,'front_not_authorized');
   const [created]=await conn.execute('INSERT INTO order_front_change_requests(front_id,request_type,requested_value,justification,requested_by) VALUES(?,?,?,?,?)',
    [frontId,b.request_type,b.requested_value.trim(),b.justification.trim(),actor.id]);
   return ok({status:'pending',id:created.insertId});
  });
 }
 const review=/^changes\/(\d+)\/review$/.exec(action);
 if(review&&req.method==='POST'){
  if(!isCommand)return fail(403,'command_required');
  const b=await read(req);
  if(!['approved','rejected'].includes(b?.decision))return fail(400,'invalid_change_decision');
  return atomic(pool,async conn=>{
   const [fronts]=await conn.execute('SELECT status,license_terms FROM order_fronts WHERE id=? FOR UPDATE',[frontId]);
   if(!fronts.length||fronts[0].status==='closed')return fail(409,'front_closed');
   const [changes]=await conn.execute('SELECT * FROM order_front_change_requests WHERE id=? AND front_id=? FOR UPDATE',[Number(review[1]),frontId]);
   const change=changes[0];
   if(!change)return fail(404,'change_request_not_found');
   if(change.state!=='pending')return fail(409,'change_already_reviewed');
   if(b.decision==='approved'){
    if(change.request_type==='location')await conn.execute('UPDATE order_fronts SET location=? WHERE id=?',[change.requested_value,frontId]);
    if(change.request_type==='category')await conn.execute('UPDATE order_fronts SET category=? WHERE id=?',[change.requested_value,frontId]);
    if(change.request_type==='expansion'){
     const note='Approved expansion: '+change.requested_value;
     const terms=[fronts[0].license_terms,note].filter(Boolean).join(' | ');
     if(terms.length>900)return fail(409,'license_terms_full');
     await conn.execute('UPDATE order_fronts SET license_terms=? WHERE id=?',[terms,frontId]);
    }
   }
   await conn.execute('UPDATE order_front_change_requests SET state=?,reviewed_by=?,reviewed_at=UTC_TIMESTAMP() WHERE id=?',
    [b.decision,actor.id,change.id]);
   return ok({status:b.decision});
  });
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
   (b.restricted!==undefined&&typeof b.restricted!=='boolean')||!Number.isInteger(b.posted_price)||b.posted_price<0||b.posted_price>100000||
   (b.offer_type==='goods'&&!(typeof b.material_id==='string'&&b.material_id.length<=48)))return fail(400,'invalid_front_offering');
  return atomic(pool,async conn=>{
   const front=await managedFront(conn,frontId,actor,{lock:true});
   if(!front||front.status!=='active')return fail(403,'front_not_authorized');
   if(b.offer_type==='goods'){
    const [materials]=await conn.execute('SELECT id FROM fc_materials WHERE id=?',[b.material_id]);
    if(!materials.length)return fail(404,'material_not_found');
   }
   if(b.restricted){
    if(b.offer_type!=='service')return fail(400,'restricted_service_only');
    const [permission]=await conn.execute('SELECT id FROM order_front_change_requests WHERE front_id=? AND request_type="restricted_service" AND requested_value=? AND state="approved" LIMIT 1',[frontId,b.name.trim()]);
    if(!permission.length)return fail(403,'restricted_service_approval_required');
   }
   const [created]=await conn.execute('INSERT INTO order_front_offerings(front_id,offer_type,material_id,name,description,posted_price,restricted) VALUES(?,?,?,?,?,?,?)',
    [frontId,b.offer_type,b.offer_type==='goods'?b.material_id:null,b.name.trim(),b.description.trim(),b.posted_price,b.restricted?1:0]);
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
 if(action==='reserved-stock'&&req.method==='POST'){
  const b=await read(req);
  if(!uuid(b?.character_id)||typeof b.material_id!=='string'||b.material_id.length>48||!qty(b.quantity,100))return fail(400,'invalid_reserved_transfer');
  return atomic(pool,async conn=>{
   const front=await managedFront(conn,frontId,actor,{lock:true});
   if(!front||front.status!=='active')return fail(403,'front_not_authorized');
   if(!await characterOwner(conn,b.character_id,actor.id))return fail(403,'character_owner_required');
   const [owned]=await conn.execute('SELECT quantity FROM character_reserved_materials WHERE character_id=? AND material_id=? FOR UPDATE',[b.character_id,b.material_id]);
   if(!owned.length||Number(owned[0].quantity)<b.quantity)return fail(409,'reserved_stock_insufficient');
   await conn.execute('INSERT IGNORE INTO order_front_stock(front_id,material_id,quantity) VALUES(?,?,0)',[frontId,b.material_id]);
   const [[atFront]]=await conn.execute('SELECT quantity FROM order_front_stock WHERE front_id=? AND material_id=? FOR UPDATE',[frontId,b.material_id]);
   const next=Number(atFront.quantity)+b.quantity,remaining=Number(owned[0].quantity)-b.quantity;
   if(!Number.isSafeInteger(next)||next>4294967295)return fail(409,'front_stock_limit');
   await conn.execute('UPDATE character_reserved_materials SET quantity=? WHERE character_id=? AND material_id=?',[remaining,b.character_id,b.material_id]);
   await conn.execute('UPDATE order_front_stock SET quantity=? WHERE front_id=? AND material_id=?',[next,frontId,b.material_id]);
   await conn.execute('INSERT INTO character_reserved_material_ledger(character_id,material_id,action,quantity,balance_after,front_id) VALUES(?,?,"front_delivery",?,?,?)',
    [b.character_id,b.material_id,b.quantity,remaining,frontId]);
   return ok({status:'delivered',quantity:b.quantity,remaining});
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
   const [materials]=await conn.execute('SELECT id FROM fc_materials WHERE id=?',[b.material_id]);
   if(!materials.length)return fail(404,'material_not_found');
   await conn.execute('INSERT IGNORE INTO order_front_stock(front_id,material_id,quantity) VALUES(?,?,0)',[frontId,b.material_id]);
   const [[frontStock]]=await conn.execute('SELECT quantity FROM order_front_stock WHERE front_id=? AND material_id=? FOR UPDATE',[frontId,b.material_id]);
   if(b.direction==='return'&&Number(frontStock.quantity)<b.quantity)return fail(409,'front_stock_insufficient');
   if(!await logStock(conn,b.material_id,b.direction==='allocate'?-b.quantity:b.quantity,actor.id,b.character_id,b.direction==='allocate'?'front_transfer':'front_return',frontId))return fail(409,'fc_stock_insufficient');
   await conn.execute('UPDATE order_front_stock SET quantity=quantity+? WHERE front_id=? AND material_id=?',
    [b.direction==='allocate'?b.quantity:-b.quantity,frontId,b.material_id]);
   return ok({status:'transferred',quantity:b.quantity});
  });
 }
 if(action==='supply-requirements'&&req.method==='POST'){
  if(!isCommand)return fail(403,'command_required');
  const b=await read(req);
  if(typeof b?.material_id!=='string'||b.material_id.length>48||
   !Number.isInteger(b?.daily_quantity)||b.daily_quantity<0||b.daily_quantity>100000)return fail(400,'invalid_supply_requirement');
  return atomic(pool,async conn=>{
   const [front]=await conn.execute('SELECT id,status FROM order_fronts WHERE id=? FOR UPDATE',[frontId]);
   if(!front.length||front[0].status==='closed')return fail(404,'front_not_editable');
   const [material]=await conn.execute('SELECT id FROM fc_materials WHERE id=?',[b.material_id]);
   if(!material.length)return fail(404,'material_not_found');
   if(b.daily_quantity===0)await conn.execute('DELETE FROM order_front_supply_requirements WHERE front_id=? AND material_id=?',[frontId,b.material_id]);
   else await conn.execute('INSERT INTO order_front_supply_requirements(front_id,material_id,daily_quantity) VALUES(?,?,?) ON DUPLICATE KEY UPDATE daily_quantity=VALUES(daily_quantity)',
    [frontId,b.material_id,b.daily_quantity]);
   return ok({status:'saved'});
  });
 }
 if(action==='operating-costs'&&req.method==='POST'){
  if(!isCommand)return fail(403,'command_required');
  const b=await read(req);
  if(![b?.daily_rent,b?.daily_upkeep].every(v=>Number.isInteger(v)&&v>=0&&v<=100000))return fail(400,'invalid_operating_costs');
  const [updated]=await pool.execute('UPDATE order_fronts SET daily_rent=?,daily_upkeep=? WHERE id=? AND status<>"closed"',
   [b.daily_rent,b.daily_upkeep,frontId]);
  return updated.affectedRows?ok({status:'saved'}):fail(404,'front_not_editable');
 }
 return fail(404,'not_found');
}
