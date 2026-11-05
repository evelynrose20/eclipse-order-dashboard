import {resolveSession} from './auth.js';

const error=(status,message)=>({status,body:{error:message}});
const ok=(body,status=200)=>({status,body});
const isCommand=user=>['domina','high_command'].includes(user.account_role);
const uuid=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'');
const shares=[100,0,10,25,40];
const rationIds=[null,'basic_ration','stew_ration','rice_ration','feast_ration'];
async function read(req){
 let size=0,parts=[];
 for await(const c of req){size+=c.length;if(size>4096)return null;parts.push(c)}
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{return null}
}
async function character(pool,id,actor){
 const [rows]=await pool.execute('SELECT id,player_account_id,handler_account_id,collar_bound,bound_rank,character_name FROM characters WHERE id=?',[id]);
 const c=rows[0];
 if(!c)return null;
 const canView=isCommand(actor)||c.player_account_id===actor.id||(actor.account_role==='handler'&&c.handler_account_id===actor.id);
 return canView?c:null;
}
function rankIndex(c){return c.collar_bound?({rank_i:1,rank_ii:2,rank_iii:3,rank_iv:4}[c.bound_rank]||1):0}
async function wallet(cn,id){
 await cn.execute('INSERT INTO eo_wallets(character_id,balance) VALUES(?,0) ON DUPLICATE KEY UPDATE character_id=VALUES(character_id)',[id]);
 const [[row]]=await cn.execute('SELECT balance FROM eo_wallets WHERE character_id=? FOR UPDATE',[id]);
 return Number(row.balance);
}
async function addLog(cn,c,actor,type,amount,item,description){
 await cn.execute('INSERT INTO eo_economy_ledger(character_id,actor_id,event_type,amount,item_id,description) VALUES(?,?,?,?,?,?)',
  [c.id,actor.id,type,amount,item,description]);
}
export async function economyRoute(pool,req,path){
 if(!pool)return error(503,'database_unavailable');
 const actor=await resolveSession(pool,req);
 if(!actor)return error(401,'not_authenticated');
 if(path==='/economy/catalog'&&req.method==='GET'){
  const [rows]=await pool.query('SELECT id,name,category,price,description,min_rank FROM eo_item_catalog WHERE active=1 ORDER BY category,name');
  return ok(rows);
 }
 const match=/^\/economy\/characters\/([a-f0-9-]{36})(?:\/(buy|paycheck|ration))?$/.exec(path);
 if(!match)return error(404,'not_found');
 const [,id,action]=match;
 if(!uuid(id))return error(400,'invalid_character');
 const c=await character(pool,id,actor);
 if(!c)return error(404,'character_not_found');
 // The bound player's limited sheet does not expose a wallet or inventory.
 const full=isCommand(actor)||(actor.account_role==='handler'&&c.handler_account_id===actor.id)||(!c.collar_bound&&c.player_account_id===actor.id);
 if(!full)return error(403,'restricted_character_economy');
 if(!action&&req.method==='GET'){
  const [balance]=await pool.execute('SELECT balance FROM eo_wallets WHERE character_id=?',[id]);
  const [items]=await pool.execute('SELECT i.item_id,i.quantity,c.name,c.category,c.description FROM eo_inventory i JOIN eo_item_catalog c ON c.id=i.item_id WHERE i.character_id=? AND i.quantity>0 ORDER BY c.name',[id]);
  const [ledger]=await pool.execute('SELECT id,event_type,amount,item_id,description,created_at FROM eo_economy_ledger WHERE character_id=? ORDER BY id DESC LIMIT 30',[id]);
  const [lastPay]=await pool.execute('SELECT week_start,base_amount,payout FROM eo_paychecks WHERE character_id=? ORDER BY week_start DESC LIMIT 5',[id]);
  return ok({character_id:id,balance:Number(balance[0]?.balance||0),inventory:items,ledger,paychecks:lastPay,rank:rankIndex(c),salary_share:shares[rankIndex(c)]});
 }
 if(req.method!=='POST')return error(405,'method_not_allowed');
 const body=await read(req);
 if(!body||typeof body!=='object')return error(400,'invalid_request');
 if(action==='buy'){
  const qty=Number(body.quantity||1),itemId=body.item_id;
  if(!Number.isSafeInteger(qty)||qty<1||qty>20||typeof itemId!=='string'||itemId.length>48)return error(400,'invalid_item_or_quantity');
  const [items]=await pool.execute('SELECT * FROM eo_item_catalog WHERE id=? AND active=1',[itemId]);
  const item=items[0];
  if(!item||item.category==='ration')return error(404,'item_not_for_sale');
  if(rankIndex(c)<item.min_rank)return error(403,'rank_restricted_item');
  const total=item.price*qty;
  if(!Number.isSafeInteger(total))return error(400,'invalid_total');
  const cn=await pool.getConnection();
  try{
   await cn.beginTransaction();
   const balance=await wallet(cn,id);
   if(balance<total){await cn.rollback();return error(409,'insufficient_gil')}
   await cn.execute('UPDATE eo_wallets SET balance=balance-? WHERE character_id=?',[total,id]);
   await cn.execute('INSERT INTO eo_inventory(character_id,item_id,quantity) VALUES(?,?,?) ON DUPLICATE KEY UPDATE quantity=quantity+VALUES(quantity)',[id,itemId,qty]);
   await addLog(cn,c,actor,'shop_purchase',-total,itemId,item.name+' ×'+qty);
   await cn.commit();return ok({status:'purchased',balance:balance-total});
  }catch(e){await cn.rollback().catch(()=>{});throw e}finally{cn.release()}
 }
 if(action==='paycheck'){
  if(!isCommand(actor))return error(403,'command_required');
  const base=Number(body.base_amount);
  if(!Number.isSafeInteger(base)||base<1||base>1000000)return error(400,'invalid_base_pay');
  const share=shares[rankIndex(c)],payout=Math.floor(base*share/100);
  const cn=await pool.getConnection();
  try{
   await cn.beginTransaction();
   // The DB's UTC date determines the current Monday and prevents client backdating.
   const [[date]]=await cn.query("SELECT DATE_FORMAT(DATE_SUB(UTC_DATE(),INTERVAL WEEKDAY(UTC_DATE()) DAY),'%Y-%m-%d') AS monday");
   const balance=await wallet(cn,id);
   const [previous]=await cn.execute('SELECT id FROM eo_paychecks WHERE character_id=? AND week_start=?',[id,date.monday]);
   if(previous.length){await cn.rollback();return error(409,'paycheck_already_processed_this_week')}
   await cn.execute('INSERT INTO eo_paychecks(character_id,week_start,base_amount,payout,processed_by) VALUES(?,?,?,?,?)',[id,date.monday,base,payout,actor.id]);
   if(payout>0)await cn.execute('UPDATE eo_wallets SET balance=balance+? WHERE character_id=?',[payout,id]);
   await addLog(cn,c,actor,'paycheck',payout,null,'Weekly paycheck '+date.monday+'; '+share+'% retained');
   await cn.commit();return ok({status:'paid',payout,share,week_start:date.monday,balance:balance+payout});
  }catch(e){await cn.rollback().catch(()=>{});if(e.code==='ER_DUP_ENTRY')return error(409,'paycheck_already_processed_this_week');throw e}finally{cn.release()}
 }
 if(action==='ration'){
  if(!c.collar_bound)return error(403,'rations_only_for_bound_characters');
  const itemId=rationIds[rankIndex(c)];
  const cn=await pool.getConnection();
  try{
   await cn.beginTransaction();
   const [[date]]=await cn.query("SELECT DATE_FORMAT(UTC_DATE(),'%Y-%m-%d') AS today");
   await wallet(cn,id);
   const [existing]=await cn.execute('SELECT claim_date FROM eo_ration_claims WHERE character_id=? AND claim_date=?',[id,date.today]);
   if(existing.length){await cn.rollback();return error(409,'ration_already_claimed_today')}
   await cn.execute('INSERT INTO eo_ration_claims(character_id,claim_date,item_id,claimed_by) VALUES(?,?,?,?)',[id,date.today,itemId,actor.id]);
   await cn.execute('INSERT INTO eo_inventory(character_id,item_id,quantity) VALUES(?,?,1) ON DUPLICATE KEY UPDATE quantity=quantity+1',[id,itemId]);
   await addLog(cn,c,actor,'ration_claim',0,itemId,'Daily RP ration '+date.today);
   await cn.commit();return ok({status:'claimed',item_id:itemId,claim_date:date.today});
  }catch(e){await cn.rollback().catch(()=>{});if(e.code==='ER_DUP_ENTRY')return error(409,'ration_already_claimed_today');throw e}finally{cn.release()}
 }
 return error(404,'not_found');
}
