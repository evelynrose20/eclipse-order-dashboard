import {randomInt} from 'node:crypto';
import {resolveSession} from './auth.js';

const fail=(status,error)=>({status,body:{error}});
const ok=(body)=>({status:200,body});
const isCommand=u=>['domina','high_command'].includes(u.account_role);
const validId=s=>typeof s==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)&&s.length<=48;
const validUuid=s=>typeof s==='string'&&/^[0-9a-f-]{36}$/i.test(s);
const amount=n=>Number.isInteger(n)&&n>=1&&n<=100?n:null;
const label=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=max;
const categories=new Set(['ore','herb','botanical','refined','supply']);
async function read(req){
 let data='',size=0;
 for await(const b of req){size+=b.length;if(size>12000)throw Object.assign(new Error('request_too_large'),{status:413});data+=b}
 try{return JSON.parse(data)}catch{return null}
}
async function stockChange(conn,materialId,delta,activity,actor,characterId=null,note=''){
 await conn.execute('INSERT IGNORE INTO fc_material_stock(material_id,quantity) VALUES(?,0)',[materialId]);
 const [rows]=await conn.execute('SELECT quantity FROM fc_material_stock WHERE material_id=? FOR UPDATE',[materialId]);
 if(!rows.length)return false;
 const previous=Number(rows[0].quantity),next=previous+delta;
 if(next<0||next>100000000)return false;
 await conn.execute('UPDATE fc_material_stock SET quantity=? WHERE material_id=?',[next,materialId]);
 await conn.execute('INSERT INTO fc_material_ledger(material_id,delta,balance_after,activity,account_id,character_id,note) VALUES(?,?,?,?,?,?,?)',
  [materialId,delta,next,activity,actor,characterId,note.slice(0,250)]);
 return true;
}
// Growth advances in durable six-hour UTC intervals, never on the browser clock.
// A single atomic UPDATE prevents refreshes or concurrent gardeners from doubling growth.
export async function advanceGardenGrowth(conn,plotId=null){
 const where=plotId===null?'':' WHERE id=?';
 const sql='UPDATE fc_garden_plots SET growth=LEAST(100,growth+LEAST(100,GREATEST(0,TIMESTAMPDIFF(MINUTE,last_growth_at,UTC_TIMESTAMP()) DIV 360)*5)),last_growth_at=DATE_ADD(last_growth_at,INTERVAL (GREATEST(0,TIMESTAMPDIFF(MINUTE,last_growth_at,UTC_TIMESTAMP())) DIV 360)*360 MINUTE)'+where;
 await conn.execute(sql,plotId===null?[]:[plotId]);
}
const withTransaction=async(pool,fn)=>{
 const conn=await pool.getConnection();
 try{await conn.beginTransaction();const out=await fn(conn);if(out.status!==200){await conn.rollback();return out}await conn.commit();return out}
 catch(e){await conn.rollback();throw e}
 finally{conn.release()}
};
export function wildernessEligible(character){
 if(!character)return false;
 if(!Number(character.collar_bound))return true;
 const ranks=['eclipse_attendant','silken_thrall','violet_keeper','serpents_chosen','eclipsed_consort'];
 return ranks.includes(character.servitude_rank);
}
async function checkCharacter(conn,user,characterId,{wilderness=false}={}){
 if(!validUuid(characterId))return false;
 const [rows]=await conn.execute(
  "SELECT c.id,c.player_account_id,c.collar_bound,cor.rank_code AS servitude_rank FROM characters c LEFT JOIN character_order_ranks cor ON cor.character_id=c.id AND cor.rank_code IN (SELECT code FROM order_rank_catalog WHERE track='servitude') WHERE c.id=? LIMIT 1",
  [characterId]);
 const c=rows[0];
 if(!c||c.player_account_id!==user.id)return false;
 return !wilderness||wildernessEligible(c);
}
async function characterLevel(conn,user,characterId){
 const [rows]=await conn.execute(
  "SELECT COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(sheet_json,'$.level')) AS UNSIGNED),1) AS level FROM characters WHERE id=? AND player_account_id=? LIMIT 1",
  [characterId,user.id]);
 return rows.length?Math.max(1,Number(rows[0].level)||1):null;
}
const zonePayload=b=>{
 if(!b||!validId(b.id)||!label(b.name,110)||typeof b.description!=='string'||b.description.length>900||
 !Number.isInteger(b.minimum_level)||b.minimum_level<1||b.minimum_level>100||
 !['low','moderate','high','extreme'].includes(b.danger)||
 !Number.isInteger(b.sort_order)||b.sort_order<0||b.sort_order>999||
 typeof b.enabled!=='boolean'||!Array.isArray(b.materials)||b.materials.length<1||b.materials.length>60||
 new Set(b.materials.map(x=>x.material_id)).size!==b.materials.length||
 b.materials.some(x=>!validId(x.material_id)||!Number.isInteger(x.minimum_level)||x.minimum_level<b.minimum_level||x.minimum_level>100))return null;
 return b;
};
export async function craftingRoute(pool,req,path){
 if(!pool)return fail(503,'database_unavailable');
 const user=await resolveSession(pool,req);
 if(!user)return fail(401,'not_authenticated');
 const command=isCommand(user);
 if(path==='/workshop/zones'&&req.method==='GET'){
  const [zones]=await pool.query('SELECT id,name,description,minimum_level,danger,enabled,sort_order FROM fc_expedition_zones ORDER BY sort_order,name');
  const [resources]=await pool.query('SELECT zone_id,material_id,minimum_level FROM fc_expedition_zone_materials ORDER BY zone_id,material_id');
  return ok({zones:zones.filter(z=>command||z.enabled).map(z=>({...z,enabled:!!z.enabled,materials:resources.filter(m=>m.zone_id===z.id)}))});
 }
 if(path==='/workshop/zones'&&req.method==='POST'){
  if(!command)return fail(403,'command_required');
  const b=zonePayload(await read(req));if(!b)return fail(400,'invalid_zone');
  return withTransaction(pool,async conn=>{
   const [found]=await conn.execute('SELECT id FROM fc_materials WHERE id IN ('+b.materials.map(()=>'?').join(',')+')',b.materials.map(m=>m.material_id));
   if(found.length!==b.materials.length)return fail(400,'unknown_material');
   try{await conn.execute('INSERT INTO fc_expedition_zones(id,name,description,minimum_level,danger,enabled,sort_order) VALUES(?,?,?,?,?,?,?)',[b.id,b.name.trim(),b.description.trim(),b.minimum_level,b.danger,b.enabled?1:0,b.sort_order])}
   catch(e){if(e.code==='ER_DUP_ENTRY')return fail(409,'zone_exists');throw e}
   for(const material of b.materials)await conn.execute('INSERT INTO fc_expedition_zone_materials(zone_id,material_id,minimum_level) VALUES(?,?,?)',[b.id,material.material_id,material.minimum_level]);
   return ok({status:'created'});
  });
 }
 const zoneEdit=/^\/workshop\/zones\/([a-z0-9-]+)$/.exec(path);
 if(zoneEdit&&req.method==='PUT'){
  if(!command)return fail(403,'command_required');
  const b=zonePayload({...await read(req),id:zoneEdit[1]});
  if(!b)return fail(400,'invalid_zone');
  return withTransaction(pool,async conn=>{
   const [existing]=await conn.execute('SELECT id FROM fc_expedition_zones WHERE id=? FOR UPDATE',[zoneEdit[1]]);
   if(!existing.length)return fail(404,'zone_not_found');
   const [materials]=await conn.execute('SELECT id FROM fc_materials WHERE id IN ('+b.materials.map(()=>'?').join(',')+')',b.materials.map(m=>m.material_id));
   if(materials.length!==b.materials.length)return fail(400,'unknown_material');
   await conn.execute('UPDATE fc_expedition_zones SET name=?,description=?,minimum_level=?,danger=?,enabled=?,sort_order=? WHERE id=?',[b.name.trim(),b.description.trim(),b.minimum_level,b.danger,b.enabled?1:0,b.sort_order,zoneEdit[1]]);
   await conn.execute('DELETE FROM fc_expedition_zone_materials WHERE zone_id=?',[zoneEdit[1]]);
   for(const material of b.materials)await conn.execute('INSERT INTO fc_expedition_zone_materials(zone_id,material_id,minimum_level) VALUES(?,?,?)',[zoneEdit[1],material.material_id,material.minimum_level]);
   return ok({status:'saved'});
  });
 }
 const recipeCategory=/^\/workshop\/catalog\/recipes\/([a-z0-9-]+)\/category$/.exec(path);
 if(recipeCategory&&req.method==='PUT'){
  if(!command)return fail(403,'command_required');
  const b=await read(req);
  if(!validId(b?.category_id))return fail(400,'invalid_recipe_category');
  const [category]=await pool.execute('SELECT id FROM fc_recipe_categories WHERE id=?',[b.category_id]);
  if(!category.length)return fail(400,'invalid_recipe_category');
  const [updated]=await pool.execute('UPDATE fc_recipes SET category_id=? WHERE id=?',[b.category_id,recipeCategory[1]]);
  return updated.affectedRows?ok({status:'saved'}):fail(404,'recipe_not_found');
 }
 const recipeLevel=/^\/workshop\/catalog\/recipes\/([a-z0-9-]+)\/level$/.exec(path);
 if(recipeLevel&&req.method==='PUT'){
  if(!command)return fail(403,'command_required');
  const b=await read(req);
  if(!Number.isInteger(b?.minimum_level)||b.minimum_level<1||b.minimum_level>100)return fail(400,'invalid_level');
  const [update]=await pool.execute('UPDATE fc_recipes SET minimum_level=? WHERE id=?',[b.minimum_level,recipeLevel[1]]);
  return update.affectedRows?ok({status:'saved'}):fail(404,'recipe_not_found');
 }
 if(path==='/workshop/encounters'&&req.method==='GET'){
  const [active]=await pool.execute(
   'SELECT e.id,e.status,e.player_health,e.enemy_health,e.turn_number,s.name,s.kind,s.description,s.outcome_text,s.failure_text,s.retreat_text,s.decline_text,s.enemy_defense,s.enemy_health AS enemy_max_health,r.material_id FROM fc_expedition_encounters e JOIN fc_expedition_scenarios s ON s.id=e.scenario_id JOIN fc_gathering_runs r ON r.id=e.gathering_run_id WHERE e.account_id=? AND e.status="active" ORDER BY e.id DESC LIMIT 1',[user.id]);
  const [scenarios]=command?await pool.query('SELECT id,name,kind,description,outcome_text,failure_text,retreat_text,decline_text,weight,enemy_health,enemy_defense,enabled FROM fc_expedition_scenarios ORDER BY kind,name'):[[]];
  return ok({active:active[0]||null,scenarios:command?scenarios:[]});
 }
 if(path==='/workshop/encounters/scenarios'&&req.method==='POST'){
  if(!command)return fail(403,'command_required');
  const b=await read(req);
  if(!validId(b?.id)||!label(b?.name,110)||!['wildlife','bandits','mystery','mature'].includes(b?.kind)||
    !label(b?.description,1800)||typeof b?.outcome_text!=='string'||b.outcome_text.length>600||
    !label(b?.failure_text,900)||!label(b?.retreat_text,900)||!label(b?.decline_text,900)||
    !Number.isInteger(b.weight)||b.weight<1||b.weight>100||
    !Number.isInteger(b.enemy_health)||b.enemy_health<1||b.enemy_health>100||
    !Number.isInteger(b.enemy_defense)||b.enemy_defense<1||b.enemy_defense>20)return fail(400,'invalid_scenario');
  try{
   await pool.execute('INSERT INTO fc_expedition_scenarios(id,name,kind,description,outcome_text,failure_text,retreat_text,decline_text,weight,enemy_health,enemy_defense,enabled) VALUES(?,?,?,?,?,?,?,?,?,?,?,1)',
    [b.id,b.name.trim(),b.kind,b.description.trim(),b.outcome_text.trim(),b.failure_text.trim(),b.retreat_text.trim(),b.decline_text.trim(),b.weight,b.enemy_health,b.enemy_defense]);
   return ok({status:'created'});
  }catch(e){if(e.code==='ER_DUP_ENTRY')return fail(409,'scenario_exists');throw e}
 }
 const scenarioEdit=/^\/workshop\/encounters\/scenarios\/([a-z0-9-]+)$/.exec(path);
 if(scenarioEdit&&req.method==='PUT'){
  if(!command)return fail(403,'command_required');
  const b=await read(req);
  if(!label(b?.name,110)||!['wildlife','bandits','mystery','mature'].includes(b?.kind)||
   !label(b?.description,1800)||typeof b.outcome_text!=='string'||b.outcome_text.length>600||
   !label(b?.failure_text,900)||!label(b?.retreat_text,900)||!label(b?.decline_text,900)||
   !Number.isInteger(b.weight)||b.weight<1||b.weight>100||!Number.isInteger(b.enemy_health)||b.enemy_health<1||b.enemy_health>100||
   !Number.isInteger(b.enemy_defense)||b.enemy_defense<1||b.enemy_defense>20||typeof b.enabled!=='boolean')return fail(400,'invalid_scenario');
  const [changed]=await pool.execute('UPDATE fc_expedition_scenarios SET name=?,kind=?,description=?,outcome_text=?,failure_text=?,retreat_text=?,decline_text=?,weight=?,enemy_health=?,enemy_defense=?,enabled=? WHERE id=?',
   [b.name.trim(),b.kind,b.description.trim(),b.outcome_text.trim(),b.failure_text.trim(),b.retreat_text.trim(),b.decline_text.trim(),b.weight,b.enemy_health,b.enemy_defense,b.enabled?1:0,scenarioEdit[1]]);
  return changed.affectedRows?ok({status:'saved'}):fail(404,'scenario_not_found');
 }
 const encounterAction=/^\/workshop\/encounters\/(\d+)\/action$/.exec(path);
 if(encounterAction&&req.method==='POST'){
  const b=await read(req);
  if(!['attack','retreat','continue','decline'].includes(b?.action))return fail(400,'invalid_encounter_action');
  return withTransaction(pool,async conn=>{
   const [rows]=await conn.execute(
    'SELECT e.*,s.kind,s.name,s.description,s.outcome_text,s.failure_text,s.retreat_text,s.decline_text,s.enemy_defense,r.material_id,r.character_id FROM fc_expedition_encounters e JOIN fc_expedition_scenarios s ON s.id=e.scenario_id JOIN fc_gathering_runs r ON r.id=e.gathering_run_id WHERE e.id=? AND e.account_id=? FOR UPDATE',
    [Number(encounterAction[1]),user.id]);
   const encounter=rows[0];
   if(!encounter)return fail(404,'encounter_not_found');
   if(encounter.status!=='active')return fail(409,'encounter_already_resolved');
   const battle=['wildlife','bandits'].includes(encounter.kind);
   if((battle&&!['attack','retreat'].includes(b.action))||(!battle&&!['continue','decline'].includes(b.action)))return fail(400,'invalid_encounter_action');
   let hp=Number(encounter.player_health),enemyHp=Number(encounter.enemy_health),round=Number(encounter.turn_number),status='active',message='',quantity=0;
   if(!battle){
    status=b.action==='decline'?'declined':'resolved';
    quantity=randomInt(1,4);
    message=b.action==='decline'?encounter.decline_text:encounter.outcome_text;
   }else if(b.action==='retreat'){
    status='retreated';quantity=0;message=encounter.retreat_text;
   }else{
    round++;
    const attackRoll=randomInt(1,21);
    const hit=attackRoll+3>=Number(encounter.enemy_defense);
    if(hit)enemyHp=Math.max(0,enemyHp+(-randomInt(2,7)));
    message=hit?'Your strike lands.':'Your strike misses.';
    if(enemyHp===0){status='victory';quantity=randomInt(2,6);message+=' '+encounter.outcome_text}
    else{
     const enemyRoll=randomInt(1,21);
     if(enemyRoll+2>=11){hp=Math.max(0,hp-randomInt(1,5));message+=' The opponent strikes back.'}
     else message+=' You evade the counterattack.';
     if(hp===0||round>=6){status='defeat';quantity=0;message+=' '+encounter.failure_text}
    }
   }
   if(status==='active'){
    await conn.execute('UPDATE fc_expedition_encounters SET player_health=?,enemy_health=?,turn_number=?,outcome=? WHERE id=?',
     [hp,enemyHp,round,message,encounter.id]);
   }else{
    if(quantity>0&&!await stockChange(conn,encounter.material_id,quantity,'gather',user.id,encounter.character_id,'Encounter: '+encounter.name))return fail(409,'stock_limit');
    await conn.execute('UPDATE fc_gathering_runs SET quantity=? WHERE id=?',[quantity,encounter.gathering_run_id]);
    await conn.execute('UPDATE fc_expedition_encounters SET status=?,player_health=?,enemy_health=?,turn_number=?,outcome=?,completed_at=UTC_TIMESTAMP() WHERE id=?',
     [status,hp,enemyHp,round,message,encounter.id]);
   }
   return ok({status,message,player_health:hp,enemy_health:enemyHp,turn_number:round,quantity,material_id:encounter.material_id});
  });
 }
 if(path==='/workshop'&&req.method==='GET'){
  await advanceGardenGrowth(pool);
  const [[materials],[recipes],[inputs],[plots],[garden],[ledger],[expeditions],[todayCare],[teamCare],[categories]] = await Promise.all([
   pool.query('SELECT m.id,m.name,m.category,m.description,COALESCE(s.quantity,0) AS quantity FROM fc_materials m LEFT JOIN fc_material_stock s ON s.material_id=m.id ORDER BY FIELD(m.category,"ore","herb","botanical","refined","supply"),m.name'),
   pool.query('SELECT id,name,description,output_material,output_quantity,minimum_level,category_id FROM fc_recipes ORDER BY name'),
   pool.query('SELECT recipe_id,material_id,quantity FROM fc_recipe_inputs ORDER BY recipe_id,material_id'),
   pool.query('SELECT id,crop_material,growth,health,harvests FROM fc_garden_plots ORDER BY id'),
   pool.query('SELECT level FROM fc_garden WHERE id=1'),
   pool.query('SELECT l.id,l.material_id,m.name,l.delta,l.activity,l.note,l.created_at,a.display_name FROM fc_material_ledger l JOIN fc_materials m ON m.id=l.material_id JOIN accounts a ON a.id=l.account_id ORDER BY l.id DESC LIMIT 30'),
   pool.execute('SELECT id,zone_id,material_id,quantity,created_at FROM fc_gathering_runs WHERE account_id=? AND expedition_day=UTC_DATE() ORDER BY id DESC',[user.id]),
   pool.execute('SELECT plot_id,action FROM fc_garden_care WHERE account_id=? AND care_date=UTC_DATE()',[user.id]),
   pool.query('SELECT plot_id,COUNT(*) AS helpers FROM fc_garden_care WHERE care_date=UTC_DATE() GROUP BY plot_id'),
   pool.query('SELECT id,name,description,sort_order FROM fc_recipe_categories ORDER BY sort_order,name')
  ]);
  return ok({materials,categories,recipes:recipes.map(r=>({...r,inputs:inputs.filter(i=>i.recipe_id===r.id)})),plots:plots.map(plot=>({...plot,cared_today:todayCare.some(c=>Number(c.plot_id)===Number(plot.id)),helpers_today:Number(teamCare.find(c=>Number(c.plot_id)===Number(plot.id))?.helpers||0)})),garden:garden[0]||{level:1},ledger,expeditions,expedition_limit:5});
 }
 if(path==='/workshop/gather'&&req.method==='POST'){
  const body=await read(req);
  if(!validId(body?.material_id)||!validId(body?.zone_id)||!validUuid(body?.character_id)||!['steady','daring'].includes(body?.approach||'steady'))return fail(400,'invalid_gathering');
  return withTransaction(pool,async conn=>{
   if(!await checkCharacter(conn,user,body.character_id,{wilderness:true}))return fail(403,'character_not_eligible_for_wilderness');
   const [alreadyActive]=await conn.execute('SELECT id FROM fc_expedition_encounters WHERE account_id=? AND status="active" LIMIT 1',[user.id]);
   if(alreadyActive.length)return fail(409,'finish_previous_expedition');
   const level=await characterLevel(conn,user,body.character_id);
   const [zoneMaterials]=await conn.execute(
    'SELECT z.minimum_level AS zone_level,zm.minimum_level AS material_level FROM fc_expedition_zones z JOIN fc_expedition_zone_materials zm ON zm.zone_id=z.id JOIN fc_materials m ON m.id=zm.material_id WHERE z.id=? AND z.enabled=1 AND zm.material_id=? AND m.category IN ("ore","herb")',
    [body.zone_id,body.material_id]);
   if(!zoneMaterials.length)return fail(400,'resource_not_in_zone');
   if(level===null||level<Math.max(Number(zoneMaterials[0].zone_level),Number(zoneMaterials[0].material_level)))return fail(403,'expedition_level_too_low');


   // Lock member account to serialize daily attempt checks across concurrent requests.
   await conn.execute('SELECT id FROM accounts WHERE id=? FOR UPDATE',[user.id]);
   const [[used]]=await conn.execute('SELECT COUNT(*) AS total FROM fc_gathering_runs WHERE account_id=? AND expedition_day=UTC_DATE()',[user.id]);
   if(Number(used.total)>=5)return fail(409,'daily_expeditions_used');
   const approach=body.approach||'steady';
   if(body.allow_mature!==undefined&&typeof body.allow_mature!=='boolean')return fail(400,'invalid_content_preference');
   const encounterChance=approach==='daring'?45:20;
   const triggered=randomInt(1,101)<=encounterChance;
   let scenario=null;
   if(triggered){
    const [available]=await conn.execute('SELECT id,name,kind,description,outcome_text,failure_text,retreat_text,decline_text,weight,enemy_health,enemy_defense FROM fc_expedition_scenarios WHERE enabled=1 AND (kind<>"mature" OR ?=1)',[body.allow_mature===true?1:0]);
    const total=available.reduce((sum,row)=>sum+Number(row.weight),0);
    if(total>0){let roll=randomInt(1,total+1);for(const row of available){roll-=Number(row.weight);if(roll<=0){scenario=row;break}}}
   }
   if(scenario){
    const [run]=await conn.execute('INSERT INTO fc_gathering_runs(account_id,character_id,material_id,zone_id,quantity,expedition_day) VALUES(?,?,?,?,0,UTC_DATE())',[user.id,body.character_id,body.material_id,body.zone_id]);
    const [created]=await conn.execute('INSERT INTO fc_expedition_encounters(gathering_run_id,scenario_id,account_id,player_health,enemy_health) VALUES(?,?,?,?,?)',[run.insertId,scenario.id,user.id,12,scenario.enemy_health]);
    return ok({status:'encounter',encounter:{id:created.insertId,name:scenario.name,kind:scenario.kind,description:scenario.description,outcome_text:scenario.outcome_text,failure_text:scenario.failure_text,retreat_text:scenario.retreat_text,decline_text:scenario.decline_text,enemy_health:scenario.enemy_health,player_health:12,turn_number:0},remaining:4-Number(used.total)});
   }
   const qty=approach==='daring'?randomInt(0,8):randomInt(1,4);
   if(qty>0&&!await stockChange(conn,body.material_id,qty,'gather',user.id,body.character_id,approach==='daring'?'Deep wilderness expedition':'Careful wilderness expedition'))return fail(409,'stock_limit');
   await conn.execute('INSERT INTO fc_gathering_runs(account_id,character_id,material_id,zone_id,quantity,expedition_day) VALUES(?,?,?,?,?,UTC_DATE())',[user.id,body.character_id,body.material_id,body.zone_id,qty]);
   return ok({status:'recorded',quantity:qty,approach,remaining:4-Number(used.total)});
  });
 }
 if(path==='/workshop/catalog/materials'&&req.method==='POST'){
  if(!command)return fail(403,'command_required');
  const b=await read(req);
  if(!validId(b?.id)||!label(b?.name,100)||!categories.has(b?.category)||typeof b?.description!=='string'||b.description.length>500)return fail(400,'invalid_material');
  try{
   await pool.execute('INSERT INTO fc_materials(id,name,category,description) VALUES(?,?,?,?)',[b.id,b.name.trim(),b.category,b.description.trim()]);
   return ok({status:'created'});
  }catch(e){if(e.code==='ER_DUP_ENTRY')return fail(409,'material_exists');throw e}
 }
 if(path==='/workshop/catalog/categories'&&req.method==='POST'){
  if(!command)return fail(403,'command_required');
  const b=await read(req);
  if(!validId(b?.id)||!label(b?.name,90)||typeof b.description!=='string'||b.description.length>240||
    !Number.isInteger(b.sort_order)||b.sort_order<0||b.sort_order>999)return fail(400,'invalid_recipe_category');
  try{
   await pool.execute('INSERT INTO fc_recipe_categories(id,name,description,sort_order) VALUES(?,?,?,?)',[b.id,b.name.trim(),b.description.trim(),b.sort_order]);
   return ok({status:'created'});
  }catch(e){if(e.code==='ER_DUP_ENTRY')return fail(409,'category_exists');throw e}
 }
 if(path==='/workshop/catalog/recipes'&&req.method==='POST'){
  if(!command)return fail(403,'command_required');
  const b=await read(req);
  if(!validId(b?.id)||!label(b?.name,110)||typeof b?.description!=='string'||b.description.length>450||!validId(b?.output_material)||!validId(b?.category_id)||!amount(b?.output_quantity)||!Number.isInteger(b?.minimum_level)||b.minimum_level<1||b.minimum_level>100||
    !Array.isArray(b?.inputs)||b.inputs.length<1||b.inputs.length>12||
    b.inputs.some(i=>!validId(i.material_id)||!amount(i.quantity))||
    new Set(b.inputs.map(i=>i.material_id)).size!==b.inputs.length||
    b.inputs.some(i=>i.material_id===b.output_material))return fail(400,'invalid_recipe');
  return withTransaction(pool,async conn=>{
   const [category]=await conn.execute('SELECT id FROM fc_recipe_categories WHERE id=?',[b.category_id]);
   if(!category.length)return fail(400,'invalid_recipe_category');
   const [existing]=await conn.execute('SELECT id FROM fc_materials WHERE id IN ('+Array(b.inputs.length+1).fill('?').join(',')+')',[b.output_material,...b.inputs.map(i=>i.material_id)]);
   if(existing.length!==b.inputs.length+1)return fail(400,'unknown_material');
   try{await conn.execute('INSERT INTO fc_recipes(id,name,description,output_material,output_quantity,minimum_level,category_id) VALUES(?,?,?,?,?,?,?)',[b.id,b.name.trim(),b.description.trim(),b.output_material,b.output_quantity,b.minimum_level,b.category_id])}
   catch(e){if(e.code==='ER_DUP_ENTRY')return fail(409,'recipe_exists');throw e}
   for(const i of b.inputs)await conn.execute('INSERT INTO fc_recipe_inputs(recipe_id,material_id,quantity) VALUES(?,?,?)',[b.id,i.material_id,i.quantity]);
   return ok({status:'created'});
  });
 }
 if(path==='/workshop/catalog/plots'&&req.method==='POST'){
  if(!command)return fail(403,'command_required');
  const b=await read(req);
  if(!validId(b?.crop_material))return fail(400,'invalid_crop');
  return withTransaction(pool,async conn=>{
   const [materials]=await conn.execute("SELECT id FROM fc_materials WHERE id=? AND category IN ('herb','botanical')",[b.crop_material]);
   if(!materials.length)return fail(400,'not_a_garden_crop');
   const [garden]=await conn.execute('SELECT level FROM fc_garden WHERE id=1 FOR UPDATE');
   const [plots]=await conn.execute('SELECT id FROM fc_garden_plots ORDER BY id FOR UPDATE');
   const capacity=Number(garden[0].level)+1;
   if(plots.length>=capacity)return fail(409,'garden_capacity_reached');
   const newId=plots.length?Math.max(...plots.map(p=>Number(p.id)))+1:1;
   await conn.execute('INSERT INTO fc_garden_plots(id,crop_material) VALUES(?,?)',[newId,b.crop_material]);
   return ok({status:'planted',plot_id:newId});
  });
 }
 if(path==='/workshop/reserved'&&req.method==='GET'){
  const [rows]=await pool.execute('SELECT r.character_id,r.material_id,m.name,r.quantity FROM character_reserved_materials r JOIN characters c ON c.id=r.character_id JOIN fc_materials m ON m.id=r.material_id WHERE c.player_account_id=? AND r.quantity>0 ORDER BY c.character_name,m.name',[user.id]);
  return ok({goods:rows});
 }
 if(path==='/workshop/reserved/release'&&req.method==='POST'){
  const b=await read(req);
  if(!validUuid(b?.character_id)||!validId(b?.material_id)||!amount(b?.quantity))return fail(400,'invalid_reserved_release');
  return withTransaction(pool,async conn=>{
   if(!await checkCharacter(conn,user,b.character_id))return fail(403,'character_not_owned');
   const [rows]=await conn.execute('SELECT quantity FROM character_reserved_materials WHERE character_id=? AND material_id=? FOR UPDATE',[b.character_id,b.material_id]);
   if(!rows.length||Number(rows[0].quantity)<b.quantity)return fail(409,'reserved_stock_insufficient');
   if(!await stockChange(conn,b.material_id,b.quantity,'craft_output',user.id,b.character_id,'Released reserved goods to FC stores'))return fail(409,'fc_stock_limit');
   const remaining=Number(rows[0].quantity)-b.quantity;
   await conn.execute('UPDATE character_reserved_materials SET quantity=? WHERE character_id=? AND material_id=?',[remaining,b.character_id,b.material_id]);
   await conn.execute('INSERT INTO character_reserved_material_ledger(character_id,material_id,action,quantity,balance_after) VALUES(?,?,"release",?,?)',[b.character_id,b.material_id,b.quantity,remaining]);
   return ok({status:'released',remaining});
  });
 }
 if(path==='/workshop/craft'&&req.method==='POST'){
  const body=await read(req),qty=amount(body?.quantity);
  if(!validId(body?.recipe_id)||!qty||!validUuid(body?.character_id)||!['shared','reserved'].includes(body.destination||'shared'))return fail(400,'invalid_craft');
  return withTransaction(pool,async conn=>{
   if(!await checkCharacter(conn,user,body.character_id))return fail(403,'character_not_owned');
   const [recipes]=await conn.execute('SELECT output_material,output_quantity,minimum_level FROM fc_recipes WHERE id=?',[body.recipe_id]);
   if(!recipes.length)return fail(404,'recipe_not_found');
   const characterCraftLevel=await characterLevel(conn,user,body.character_id);
   if(characterCraftLevel===null||characterCraftLevel<Number(recipes[0].minimum_level))return fail(403,'crafting_level_too_low');
   const [inputs]=await conn.execute('SELECT material_id,quantity FROM fc_recipe_inputs WHERE recipe_id=? ORDER BY material_id',[body.recipe_id]);
   for(const i of inputs){
    await conn.execute('INSERT IGNORE INTO fc_material_stock(material_id,quantity) VALUES(?,0)',[i.material_id]);
    const [available]=await conn.execute('SELECT quantity FROM fc_material_stock WHERE material_id=? FOR UPDATE',[i.material_id]);
    if(Number(available[0].quantity)<i.quantity*qty)return fail(409,'insufficient_materials');
   }
   for(const i of inputs)if(!await stockChange(conn,i.material_id,-i.quantity*qty,'craft_input',user.id,body.character_id,body.recipe_id))return fail(409,'insufficient_materials');
   const produced=recipes[0].output_quantity*qty;
   if((body.destination||'shared')==='reserved'){
    await conn.execute('INSERT IGNORE INTO character_reserved_materials(character_id,material_id,quantity) VALUES(?,?,0)',[body.character_id,recipes[0].output_material]);
    const [[owned]]=await conn.execute('SELECT quantity FROM character_reserved_materials WHERE character_id=? AND material_id=? FOR UPDATE',[body.character_id,recipes[0].output_material]);
    const newQuantity=Number(owned.quantity)+produced;
    if(!Number.isSafeInteger(newQuantity)||newQuantity>100000000)return fail(409,'reserved_stock_limit');
    await conn.execute('UPDATE character_reserved_materials SET quantity=? WHERE character_id=? AND material_id=?',[newQuantity,body.character_id,recipes[0].output_material]);
    await conn.execute('INSERT INTO character_reserved_material_ledger(character_id,material_id,action,quantity,balance_after) VALUES(?,?,"craft",?,?)',[body.character_id,recipes[0].output_material,produced,newQuantity]);
   }else if(!await stockChange(conn,recipes[0].output_material,produced,'craft_output',user.id,body.character_id,body.recipe_id))return fail(409,'stock_limit');
   return ok({status:'crafted',quantity:qty,produced,destination:body.destination||'shared'});
  });
 }
 const replantPath=/^\/workshop\/garden\/(\d+)\/replant$/.exec(path);
 if(replantPath&&req.method==='POST'){
  if(!command)return fail(403,'command_required');
  const plotId=Number(replantPath[1]),b=await read(req);
  if(!Number.isInteger(plotId)||plotId<1||plotId>255||!validId(b?.crop_material)||typeof b?.discard_growth!=='boolean')return fail(400,'invalid_garden_replant');
  return withTransaction(pool,async conn=>{
   const [plots]=await conn.execute('SELECT crop_material,growth FROM fc_garden_plots WHERE id=? FOR UPDATE',[plotId]);
   if(!plots.length)return fail(404,'plot_not_found');
   const [materials]=await conn.execute("SELECT id FROM fc_materials WHERE id=? AND category IN ('herb','botanical')",[b.crop_material]);
   if(!materials.length)return fail(400,'not_a_garden_crop');
   if(plots[0].crop_material===b.crop_material)return fail(409,'already_planted');
   if(Number(plots[0].growth)>0&&!b.discard_growth)return fail(409,'crop_still_growing');
   await conn.execute('UPDATE fc_garden_plots SET crop_material=?,growth=0,health=80,last_growth_at=UTC_TIMESTAMP() WHERE id=?',[b.crop_material,plotId]);
   return ok({status:'replanted',plot_id:plotId,crop_material:b.crop_material});
  });
 }
 const plotPath=/^\/workshop\/garden\/(\d+)\/(care|harvest)$/.exec(path);
 if(plotPath&&req.method==='POST'){
  const plotId=Number(plotPath[1]),action=plotPath[2],body=await read(req);
  if(!Number.isInteger(plotId)||plotId<1||plotId>255)return fail(400,'invalid_garden_action');
  return withTransaction(pool,async conn=>{
   if(!validUuid(body?.character_id))return fail(400,'character_required');
   if(!await checkCharacter(conn,user,body.character_id))return fail(403,'character_not_owned');
   await advanceGardenGrowth(conn,plotId);
   const [plots]=await conn.execute('SELECT id,crop_material,growth,health FROM fc_garden_plots WHERE id=? FOR UPDATE',[plotId]);
   if(!plots.length)return fail(404,'plot_not_found');
   const plot=plots[0];
   if(action==='care'){
    if(!['water','tend'].includes(body.action))return fail(400,'invalid_care');
    const [already]=await conn.execute('SELECT plot_id FROM fc_garden_care WHERE plot_id=? AND account_id=? AND care_date=UTC_DATE()',[plotId,user.id]);
    if(already.length)return fail(409,'already_cared_for_plot_today');
    await conn.execute('INSERT INTO fc_garden_care(plot_id,account_id,care_date,action) VALUES(?,?,UTC_DATE(),?)',[plotId,user.id,body.action]);
    const [garden]=await conn.execute('SELECT level FROM fc_garden WHERE id=1');
    const level=Number(garden[0].level),growth=Math.min(100,Number(plot.growth)+15+level*5),health=Math.min(100,Number(plot.health)+(body.action==='water'?12:18));
    await conn.execute('UPDATE fc_garden_plots SET growth=?,health=? WHERE id=?',[growth,health,plotId]);
    return ok({status:'cared',growth,health});
   }
   if(Number(plot.growth)<100||Number(plot.health)<40)return fail(409,'crop_not_ready');
   const [garden]=await conn.execute('SELECT level FROM fc_garden WHERE id=1');
   const yieldCount=2+Number(garden[0].level)+Math.floor(Number(plot.health)/30);
   if(!await stockChange(conn,plot.crop_material,yieldCount,'harvest',user.id,body.character_id,'Garden plot '+plotId))return fail(409,'stock_limit');
   await conn.execute('UPDATE fc_garden_plots SET growth=0,health=GREATEST(40,health-15),harvests=harvests+1,last_growth_at=UTC_TIMESTAMP() WHERE id=?',[plotId]);
   return ok({status:'harvested',material_id:plot.crop_material,quantity:yieldCount});
  });
 }
 if(path==='/workshop/garden/upgrade'&&req.method==='POST'){
  if(!command)return fail(403,'command_required');
  return withTransaction(pool,async conn=>{
   const [gardens]=await conn.execute('SELECT level FROM fc_garden WHERE id=1 FOR UPDATE');
   const level=Number(gardens[0]?.level||1);
   if(level>=4)return fail(409,'garden_fully_upgraded');
   const cost=level*5;
   if(!await stockChange(conn,'iron-ingot',-cost,'upgrade',user.id,null,'Garden upgrade to '+(level+1)))return fail(409,'insufficient_materials');
   await conn.execute('UPDATE fc_garden SET level=? WHERE id=1',[level+1]);
   // Each upgrade opens another plot slot. Command decides which crop to plant.
   return ok({level:level+1,cost});
  });
 }
 return fail(404,'not_found');
}
