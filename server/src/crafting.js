import {resolveSession} from './auth.js';

const fail=(status,error)=>({status,body:{error}});
const ok=(body)=>({status:200,body});
const isCommand=u=>['domina','high_command'].includes(u.account_role);
const validId=s=>typeof s==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)&&s.length<=48;
const validUuid=s=>typeof s==='string'&&/^[0-9a-f-]{36}$/i.test(s);
const amount=n=>Number.isInteger(n)&&n>=1&&n<=100?n:null;
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
  "SELECT c.id,c.player_account_id,c.collar_bound,cor.rank_code AS servitude_rank FROM characters c LEFT JOIN character_order_ranks cor ON cor.character_id=c.id LEFT JOIN order_rank_catalog cat ON cat.code=cor.rank_code AND cat.track='servitude' WHERE c.id=? LIMIT 1",
  [characterId]);
 const c=rows[0];
 if(!c||c.player_account_id!==user.id)return false;
 return !wilderness||wildernessEligible(c);
}
export async function craftingRoute(pool,req,path){
 if(!pool)return fail(503,'database_unavailable');
 const user=await resolveSession(pool,req);
 if(!user)return fail(401,'not_authenticated');
 const command=isCommand(user);
 if(path==='/workshop'&&req.method==='GET'){
  const [[materials],[recipes],[inputs],[plots],[garden],[ledger]] = await Promise.all([
   pool.query('SELECT m.id,m.name,m.category,m.description,COALESCE(s.quantity,0) AS quantity FROM fc_materials m LEFT JOIN fc_material_stock s ON s.material_id=m.id ORDER BY FIELD(m.category,"ore","herb","botanical","refined","supply"),m.name'),
   pool.query('SELECT id,name,description,output_material,output_quantity FROM fc_recipes ORDER BY name'),
   pool.query('SELECT recipe_id,material_id,quantity FROM fc_recipe_inputs ORDER BY recipe_id,material_id'),
   pool.query('SELECT id,crop_material,growth,health,harvests FROM fc_garden_plots ORDER BY id'),
   pool.query('SELECT level FROM fc_garden WHERE id=1'),
   pool.query('SELECT l.id,l.material_id,m.name,l.delta,l.activity,l.note,l.created_at,a.display_name FROM fc_material_ledger l JOIN fc_materials m ON m.id=l.material_id JOIN accounts a ON a.id=l.account_id ORDER BY l.id DESC LIMIT 30')
  ]);
  return ok({materials,recipes:recipes.map(r=>({...r,inputs:inputs.filter(i=>i.recipe_id===r.id)})),plots,garden:garden[0]||{level:1},ledger});
 }
 if(path==='/workshop/gather'&&req.method==='POST'){
  const body=await read(req),qty=amount(body?.quantity);
  if(!validId(body?.material_id)||!qty||!validUuid(body?.character_id))return fail(400,'invalid_gathering');
  return withTransaction(pool,async conn=>{
   if(!await checkCharacter(conn,user,body.character_id,{wilderness:true}))return fail(403,'character_not_eligible_for_wilderness');
   const [material]=await conn.execute("SELECT id FROM fc_materials WHERE id=? AND category IN ('ore','herb')",[body.material_id]);
   if(!material.length)return fail(400,'not_gatherable');
   if(!await stockChange(conn,body.material_id,qty,'gather',user.id,body.character_id,'Wilderness gathering'))return fail(409,'stock_limit');
   return ok({status:'recorded'});
  });
 }
 if(path==='/workshop/craft'&&req.method==='POST'){
  const body=await read(req),qty=amount(body?.quantity);
  if(!validId(body?.recipe_id)||!qty||!validUuid(body?.character_id))return fail(400,'invalid_craft');
  return withTransaction(pool,async conn=>{
   if(!await checkCharacter(conn,user,body.character_id))return fail(403,'character_not_owned');
   const [recipes]=await conn.execute('SELECT output_material,output_quantity FROM fc_recipes WHERE id=?',[body.recipe_id]);
   if(!recipes.length)return fail(404,'recipe_not_found');
   const [inputs]=await conn.execute('SELECT material_id,quantity FROM fc_recipe_inputs WHERE recipe_id=? ORDER BY material_id',[body.recipe_id]);
   for(const i of inputs){
    await conn.execute('INSERT IGNORE INTO fc_material_stock(material_id,quantity) VALUES(?,0)',[i.material_id]);
    const [available]=await conn.execute('SELECT quantity FROM fc_material_stock WHERE material_id=? FOR UPDATE',[i.material_id]);
    if(Number(available[0].quantity)<i.quantity*qty)return fail(409,'insufficient_materials');
   }
   for(const i of inputs)if(!await stockChange(conn,i.material_id,-i.quantity*qty,'craft_input',user.id,body.character_id,body.recipe_id))return fail(409,'insufficient_materials');
   if(!await stockChange(conn,recipes[0].output_material,recipes[0].output_quantity*qty,'craft_output',user.id,body.character_id,body.recipe_id))return fail(409,'stock_limit');
   return ok({status:'crafted',quantity:qty});
  });
 }
 const plotPath=/^\/workshop\/garden\/(\d+)\/(care|harvest)$/.exec(path);
 if(plotPath&&req.method==='POST'){
  const plotId=Number(plotPath[1]),action=plotPath[2],body=await read(req);
  if(!Number.isInteger(plotId)||plotId<1||plotId>255||!validUuid(body?.character_id))return fail(400,'invalid_garden_action');
  return withTransaction(pool,async conn=>{
   if(!await checkCharacter(conn,user,body.character_id))return fail(403,'character_not_owned');
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
   await conn.execute('UPDATE fc_garden_plots SET growth=0,health=GREATEST(40,health-15),harvests=harvests+1 WHERE id=?',[plotId]);
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
   if(level===1)await conn.execute("INSERT IGNORE INTO fc_garden_plots(id,crop_material) VALUES(3,'duskbloom')");
   if(level===2)await conn.execute("INSERT IGNORE INTO fc_garden_plots(id,crop_material) VALUES(4,'silverleaf')");
   return ok({level:level+1,cost});
  });
 }
 return fail(404,'not_found');
}
