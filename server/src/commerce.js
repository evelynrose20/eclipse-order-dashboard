import {resolveSession} from './auth.js';
import {creditTradeRevenue} from './treasury.js';
import {authorizeFrontTrade,applyFrontTrade} from './fronts.js';

const fail=(status,error)=>({status,body:{error}});
const ok=(body)=>({status:200,body});
const isCommand=user=>['domina','high_command'].includes(user.account_role);
const key=value=>typeof value==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)&&value.length<=48;
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=max;
const positive=(value,max=100)=>Number.isInteger(value)&&value>=1&&value<=max;
async function body(req){
 const chunks=[];let bytes=0;
 for await(const part of req){bytes+=part.length;if(bytes>16000)throw Object.assign(new Error('request_too_large'),{status:413});chunks.push(part)}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}
}
async function transaction(pool,handler){
 const conn=await pool.getConnection();
 try{
  await conn.beginTransaction();
  const output=await handler(conn);
  if(output.status!==200)await conn.rollback();else await conn.commit();
  return output;
 }catch(error){await conn.rollback().catch(()=>{});throw error}finally{conn.release()}
}
async function ownedCharacter(conn,actor,characterId){
 if(!uuid(characterId))return null;
 const [rows]=await conn.execute('SELECT id,player_account_id,sheet_json FROM characters WHERE id=? FOR UPDATE',[characterId]);
 if(!rows.length||rows[0].player_account_id!==actor.id)return null;
 const sheet=typeof rows[0].sheet_json==='string'?JSON.parse(rows[0].sheet_json):rows[0].sheet_json;
 return {id:rows[0].id,level:Math.max(1,Number(sheet?.level)||1)};
}
async function useStock(conn,materialId,quantity,activity,actor,characterId,note){
 await conn.execute('INSERT IGNORE INTO fc_material_stock(material_id,quantity) VALUES(?,0)',[materialId]);
 const [rows]=await conn.execute('SELECT quantity FROM fc_material_stock WHERE material_id=? FOR UPDATE',[materialId]);
 if(!rows.length||Number(rows[0].quantity)<quantity)return false;
 const next=Number(rows[0].quantity)-quantity;
 await conn.execute('UPDATE fc_material_stock SET quantity=? WHERE material_id=?',[next,materialId]);
 await conn.execute('INSERT INTO fc_material_ledger(material_id,delta,balance_after,activity,account_id,character_id,note) VALUES(?,?,?,?,?,?,?)',
  [materialId,-quantity,next,activity,actor,characterId,note.slice(0,250)]);
 return true;
}
const equipmentRecord='SELECT i.id,i.character_id,i.template_id,i.status,i.equipped,i.created_at,t.name,t.description,t.slot,t.minimum_level,t.attack_bonus,t.defense_bonus,t.tool_bonus FROM character_equipment_items i JOIN fc_equipment_templates t ON t.id=i.template_id';

export async function commerceRoute(pool,req,path){
 if(!pool)return fail(503,'database_unavailable');
 const actor=await resolveSession(pool,req);
 if(!actor)return fail(401,'not_authenticated');
 const command=isCommand(actor);
 if(path==='/commerce'&&req.method==='GET'){
  const [[templates],[ingredients],[contracts],[deliveries],[factions]] =await Promise.all([
   pool.query('SELECT id,name,description,slot,minimum_level,attack_bonus,defense_bonus,tool_bonus,enabled FROM fc_equipment_templates ORDER BY slot,name'),
   pool.query('SELECT template_id,material_id,quantity FROM fc_equipment_ingredients ORDER BY template_id,material_id'),
   pool.query('SELECT c.*,f.name AS faction_name,f.faction_scope,m.name AS material_name,t.name AS equipment_name FROM fc_trade_contracts c JOIN order_factions f ON f.id=c.faction_id LEFT JOIN fc_materials m ON m.id=c.material_id LEFT JOIN fc_equipment_templates t ON t.id=c.equipment_template_id '+(command?'':'WHERE c.status<>"paused" ')+'ORDER BY c.status,c.created_at DESC,c.id DESC'),
   pool.query('SELECT d.id,d.contract_id,d.account_id,a.display_name,d.quantity,d.reputation_change,d.front_id,d.created_at FROM fc_trade_deliveries d JOIN accounts a ON a.id=d.account_id ORDER BY d.id DESC LIMIT 60'),
   pool.query('SELECT id,name,faction_scope,public_visible FROM order_factions '+(command?'':'WHERE public_visible=1 ')+'ORDER BY name')
  ]);
  const allowedIds=new Set(contracts.map(x=>Number(x.id)));
  return ok({templates:templates.filter(t=>command||t.enabled).map(t=>({...t,enabled:!!t.enabled,ingredients:ingredients.filter(i=>i.template_id===t.id)})),
   contracts:contracts.filter(c=>command||factions.some(f=>f.id===c.faction_id)),
   deliveries:deliveries.filter(d=>allowedIds.has(Number(d.contract_id))).map(d=>({...d,is_mine:d.account_id===actor.id,account_id:command?d.account_id:null})),
   factions});
 }
 const itemsRoute=/^\/commerce\/characters\/([0-9a-f-]{36})\/equipment$/.exec(path);
 if(itemsRoute&&req.method==='GET'){
  const id=itemsRoute[1];
  const [chars]=await pool.execute('SELECT player_account_id,collar_bound FROM characters WHERE id=?',[id]);
  if(!chars.length)return fail(404,'character_not_found');
  if(chars[0].player_account_id!==actor.id&&!command)return fail(403,'character_owner_required');
  if(chars[0].collar_bound&&!command&&chars[0].player_account_id!==actor.id)return fail(403,'character_owner_required');
  const [items]=await pool.execute(equipmentRecord+' WHERE i.character_id=? AND i.status="owned" ORDER BY t.slot,i.equipped DESC,i.created_at DESC',[id]);
  const bonus=items.filter(item=>item.equipped).reduce((acc,item)=>{
   acc.attack+=Number(item.attack_bonus);acc.defense+=Number(item.defense_bonus);acc.tool+=Number(item.tool_bonus);return acc
  },{attack:0,defense:0,tool:0});
  return ok({items:items.map(item=>({...item,equipped:!!item.equipped})),bonuses:bonus});
 }
 if(path==='/commerce/templates'&&req.method==='POST'){
  if(!command)return fail(403,'command_required');
  const b=await body(req);
  if(!key(b?.id)||!text(b?.name,110)||typeof b.description!=='string'||b.description.length>600||
   !['weapon','armor','tool','accessory'].includes(b.slot)||!positive(b.minimum_level)||
   ![b.attack_bonus,b.defense_bonus,b.tool_bonus].every(n=>Number.isInteger(n)&&n>=0&&n<=20)||
   !Array.isArray(b.ingredients)||!b.ingredients.length||b.ingredients.length>12||
   b.ingredients.some(i=>!key(i.material_id)||!positive(i.quantity))||
   new Set(b.ingredients.map(i=>i.material_id)).size!==b.ingredients.length)return fail(400,'invalid_equipment_blueprint');
  return transaction(pool,async conn=>{
   const [available]=await conn.execute('SELECT id FROM fc_materials WHERE id IN ('+b.ingredients.map(()=>'?').join(',')+')',b.ingredients.map(i=>i.material_id));
   if(available.length!==b.ingredients.length)return fail(400,'unknown_material');
   try{await conn.execute('INSERT INTO fc_equipment_templates(id,name,description,slot,minimum_level,attack_bonus,defense_bonus,tool_bonus) VALUES(?,?,?,?,?,?,?,?)',
    [b.id,b.name.trim(),b.description.trim(),b.slot,b.minimum_level,b.attack_bonus,b.defense_bonus,b.tool_bonus])}
   catch(e){if(e.code==='ER_DUP_ENTRY')return fail(409,'blueprint_exists');throw e}
   for(const ing of b.ingredients)await conn.execute('INSERT INTO fc_equipment_ingredients(template_id,material_id,quantity) VALUES(?,?,?)',[b.id,ing.material_id,ing.quantity]);
   return ok({status:'created',id:b.id});
  });
 }
 if(path==='/commerce/craft'&&req.method==='POST'){
  const b=await body(req);
  if(!key(b?.template_id)||!uuid(b?.character_id))return fail(400,'invalid_equipment_craft');
  return transaction(pool,async conn=>{
   const character=await ownedCharacter(conn,actor,b.character_id);
   if(!character)return fail(403,'character_owner_required');
   const [templates]=await conn.execute('SELECT id,minimum_level FROM fc_equipment_templates WHERE id=? AND enabled=1',[b.template_id]);
   if(!templates.length)return fail(404,'blueprint_not_found');
   if(character.level<Number(templates[0].minimum_level))return fail(403,'crafting_level_too_low');
   const [inputs]=await conn.execute('SELECT material_id,quantity FROM fc_equipment_ingredients WHERE template_id=? ORDER BY material_id',[b.template_id]);
   if(!inputs.length)return fail(409,'blueprint_missing_ingredients');
   for(const i of inputs)if(!await useStock(conn,i.material_id,Number(i.quantity),'craft_input',actor.id,character.id,'Equipment: '+b.template_id))return fail(409,'insufficient_materials');
   const [created]=await conn.execute('INSERT INTO character_equipment_items(character_id,template_id,crafted_by) VALUES(?,?,?)',[character.id,b.template_id,actor.id]);
   return ok({status:'crafted',item_id:created.insertId});
  });
 }
 const equip=/^\/commerce\/characters\/([0-9a-f-]{36})\/equipment\/(\d+)\/equip$/.exec(path);
 if(equip&&req.method==='POST'){
  const b=await body(req);
  if(typeof b?.equipped!=='boolean')return fail(400,'invalid_equip_choice');
  return transaction(pool,async conn=>{
   const character=await ownedCharacter(conn,actor,equip[1]);
   if(!character)return fail(403,'character_owner_required');
   const [items]=await conn.execute(equipmentRecord+' WHERE i.id=? AND i.character_id=? FOR UPDATE',[Number(equip[2]),character.id]);
   const item=items[0];
   if(!item||item.status!=='owned')return fail(404,'equipment_not_owned');
   if(b.equipped&&character.level<Number(item.minimum_level))return fail(403,'equipment_level_too_low');
   if(b.equipped)await conn.execute('UPDATE character_equipment_items i JOIN fc_equipment_templates t ON t.id=i.template_id SET i.equipped=0 WHERE i.character_id=? AND i.status="owned" AND t.slot=?',[character.id,item.slot]);
   await conn.execute('UPDATE character_equipment_items SET equipped=? WHERE id=?',[b.equipped?1:0,item.id]);
   return ok({status:b.equipped?'equipped':'unequipped'});
  });
 }
 if(path==='/commerce/contracts'&&req.method==='POST'){
  if(!command)return fail(403,'command_required');
  const b=await body(req);
  if(!key(b?.faction_id)||!text(b?.title,130)||typeof b.description!=='string'||b.description.length>600||
   !['material','equipment'].includes(b.item_kind)||!positive(b.required_quantity,100000)||
   !positive(b.rep_per_unit,20)||!Number.isInteger(b.sale_value_per_unit??0)||(b.sale_value_per_unit??0)<0||(b.sale_value_per_unit??0)>100000||!key(b.item_id))return fail(400,'invalid_trade_contract');
  const itemColumn=b.item_kind==='material'?'material_id':'equipment_template_id';
  return transaction(pool,async conn=>{
   const [faction]=await conn.execute('SELECT id FROM order_factions WHERE id=?',[b.faction_id]);
   if(!faction.length)return fail(404,'faction_not_found');
   const itemTable=b.item_kind==='material'?'fc_materials':'fc_equipment_templates';
   const [item]=await conn.execute('SELECT id FROM '+itemTable+' WHERE id=?',[b.item_id]);
   if(!item.length)return fail(400,'unknown_trade_item');
   const [created]=await conn.execute('INSERT INTO fc_trade_contracts(faction_id,title,description,item_kind,material_id,equipment_template_id,required_quantity,rep_per_unit,sale_value_per_unit,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)',
    [b.faction_id,b.title.trim(),b.description.trim(),b.item_kind,b.item_kind==='material'?b.item_id:null,b.item_kind==='equipment'?b.item_id:null,b.required_quantity,b.rep_per_unit,b.sale_value_per_unit??0,actor.id]);
   return ok({status:'created',id:created.insertId});
  });
 }
 const priceRoute=/^\/commerce\/contracts\/(\d+)\/price$/.exec(path);
 if(priceRoute&&req.method==='POST'){
  if(!command)return fail(403,'command_required');
  const b=await body(req);
  if(!Number.isInteger(b?.sale_value_per_unit)||b.sale_value_per_unit<0||b.sale_value_per_unit>100000)return fail(400,'invalid_sale_value');
  const [changed]=await pool.execute('UPDATE fc_trade_contracts SET sale_value_per_unit=? WHERE id=? AND status<>"complete"',[b.sale_value_per_unit,Number(priceRoute[1])]);
  return changed.affectedRows?ok({status:'saved'}):fail(409,'contract_not_editable');
 }
 const setStatus=/^\/commerce\/contracts\/(\d+)\/status$/.exec(path);
 if(setStatus&&req.method==='POST'){
  if(!command)return fail(403,'command_required');
  const b=await body(req);
  if(!['open','paused'].includes(b?.status))return fail(400,'invalid_contract_status');
  const [changed]=await pool.execute('UPDATE fc_trade_contracts SET status=? WHERE id=? AND status<>"complete"',[b.status,Number(setStatus[1])]);
  return changed.affectedRows?ok({status:'updated'}):fail(409,'contract_not_editable');
 }
 const deliver=/^\/commerce\/contracts\/(\d+)\/deliver$/.exec(path);
 if(deliver&&req.method==='POST'){
  const b=await body(req);
  if(!uuid(b?.character_id)||!positive(b?.quantity,100)|| (b.equipment_item_id!==undefined&&!positive(b.equipment_item_id,Number.MAX_SAFE_INTEGER))||
   (b.front_id!==undefined&&(!Number.isSafeInteger(Number(b.front_id))||Number(b.front_id)<=0)))return fail(400,'invalid_delivery');
  return transaction(pool,async conn=>{
   const character=await ownedCharacter(conn,actor,b.character_id);
   if(!character)return fail(403,'character_owner_required');
   const [rows]=await conn.execute('SELECT * FROM fc_trade_contracts WHERE id=? FOR UPDATE',[Number(deliver[1])]);
   const contract=rows[0];
   if(!contract)return fail(404,'contract_not_found');
   if(contract.status!=='open')return fail(409,'contract_closed');
   const remaining=Number(contract.required_quantity)-Number(contract.delivered_quantity);
   if(b.quantity>remaining)return fail(409,'delivery_exceeds_contract');
   let equipmentItemId=null;
   const frontId=b.front_id?Number(b.front_id):null;
   if(frontId){
    const authorization=await authorizeFrontTrade(conn,frontId,actor,{materialId:contract.item_kind==='material'?contract.material_id:null,quantity:b.quantity,characterId:character.id});
    if(authorization.status!==200)return authorization;
   }
   if(contract.item_kind==='material'){
    if(!frontId&&!await useStock(conn,contract.material_id,b.quantity,'trade',actor.id,character.id,'Trade contract '+contract.id))return fail(409,'insufficient_materials');
   }else{
    if(b.quantity!==1||!positive(b.equipment_item_id,Number.MAX_SAFE_INTEGER))return fail(400,'equipment_delivery_requires_one_item');
    const [items]=await conn.execute('SELECT id,template_id,status,equipped FROM character_equipment_items WHERE id=? AND character_id=? FOR UPDATE',[b.equipment_item_id,character.id]);
    if(!items.length||items[0].template_id!==contract.equipment_template_id||items[0].status!=='owned'||Number(items[0].equipped)!==0)return fail(409,'equipment_unavailable_or_equipped');
    await conn.execute('UPDATE character_equipment_items SET status="traded" WHERE id=?',[items[0].id]);
    equipmentItemId=items[0].id;
   }
   await conn.execute('INSERT IGNORE INTO order_faction_reputation(faction_id,order_view,faction_view) VALUES(?,0,0)',[contract.faction_id]);
   const [ratings]=await conn.execute('SELECT faction_view FROM order_faction_reputation WHERE faction_id=? FOR UPDATE',[contract.faction_id]);
   const before=Number(ratings[0].faction_view),requested=Math.min(100,b.quantity*Number(contract.rep_per_unit));
   const after=Math.min(100,before+requested),change=after-before;
   await conn.execute('UPDATE order_faction_reputation SET faction_view=? WHERE faction_id=?',[after,contract.faction_id]);
   await conn.execute('INSERT INTO faction_reputation_changes(faction_id,target,account_id,requested_delta,applied_delta,old_value,new_value,event_title,event_details,source_event_id,authored_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
    [contract.faction_id,'faction_view',null,requested,change,before,after,'FC trade: '+contract.title,'Delivered '+b.quantity+' '+contract.item_kind+' to the faction.',null,actor.id]);
   const [delivery]=await conn.execute('INSERT INTO fc_trade_deliveries(contract_id,account_id,character_id,equipment_item_id,quantity,reputation_change,front_id) VALUES(?,?,?,?,?,?,?)',
    [contract.id,actor.id,character.id,equipmentItemId,b.quantity,change,frontId]);
   const income=await creditTradeRevenue(conn,{deliveryId:delivery.insertId,contractId:contract.id,saleValuePerUnit:contract.sale_value_per_unit,quantity:b.quantity,accountId:actor.id,characterId:character.id});
   if(income.status!==200)return income;
   const frontShare=frontId?await applyFrontTrade(conn,{frontId,deliveryId:delivery.insertId,revenue:income.body.income,accountId:actor.id}):ok({retained:0});
   if(frontShare.status!==200)return frontShare;
   const newQuantity=Number(contract.delivered_quantity)+b.quantity;
   await conn.execute('UPDATE fc_trade_contracts SET delivered_quantity=?,status=? WHERE id=?',
    [newQuantity,newQuantity===Number(contract.required_quantity)?'complete':'open',contract.id]);
   return ok({status:'delivered',quantity:b.quantity,reputation_change:change,order_income:income.body.income-frontShare.body.retained,front_earnings:frontShare.body.retained,faction_reputation:after,complete:newQuantity===Number(contract.required_quantity)});
  });
 }
 return fail(404,'not_found');
}
