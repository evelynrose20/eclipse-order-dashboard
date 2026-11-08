import {resolveSession} from './auth.js';

const forbidden=(status,error)=>({status,body:{error}});

// Both IC Household assignments and IC thrall character ranks are distinct from website staff roles.
export async function mayEnterThralls(pool,actor){
 if(['domina','high_command','handler'].includes(actor.account_role))return true;
 const [ranks]=await pool.execute(
  "SELECT 1 FROM account_order_ranks WHERE account_id=? AND track='household' LIMIT 1",
  [actor.id]
 );
 if(ranks.length)return true;
 const [characters]=await pool.execute(
  "SELECT 1 FROM characters c LEFT JOIN character_order_ranks r ON r.character_id=c.id LEFT JOIN order_rank_catalog cat ON cat.code=r.rank_code WHERE c.player_account_id=? AND (c.collar_bound=1 OR cat.track='servitude') LIMIT 1",
  [actor.id]
 );
 return characters.length>0;
}


const ok=body=>({status:200,body});
async function manager(pool,actor){
 if(['domina','high_command','handler'].includes(actor.account_role))return true;
 const [rows]=await pool.execute("SELECT 1 FROM account_order_ranks WHERE account_id=? AND track='household' LIMIT 1",[actor.id]);
 return rows.length>0;
}
async function readBody(req){
 const chunks=[];let size=0;
 for await(const chunk of req){size+=chunk.length;if(size>4096)return null;chunks.push(chunk)}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}
}
const isAmount=n=>Number.isInteger(n)&&n>=0&&n<=1000;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const defaultPrefs={allow_upper:0,allow_lower:0,upper_limit:0,lower_limit:0,allow_seating:0};
async function seatRoster(pool){
 const [rows]=await pool.execute("SELECT c.id,c.character_name AS name,c.player_account_id,COALESCE(p.allow_seating,0) AS allow_seating,COALESCE(p.allow_upper,0) AS allow_upper,COALESCE(p.allow_lower,0) AS allow_lower,COALESCE(p.upper_limit,0) AS upper_limit,COALESCE(p.lower_limit,0) AS lower_limit FROM characters c LEFT JOIN order_thrall_contribution_preferences p ON p.character_id=c.id LEFT JOIN character_order_ranks cr ON cr.character_id=c.id LEFT JOIN order_rank_catalog cat ON cat.code=cr.rank_code WHERE c.collar_bound=1 OR cat.track='servitude' ORDER BY c.character_name");
 return rows;
}

export async function thrallsRoute(pool,req,path){
 if(!pool)return forbidden(503,'database_unavailable');
 const actor=await resolveSession(pool,req);
 if(!actor)return forbidden(401,'not_authenticated');
 if(!await mayEnterThralls(pool,actor))return forbidden(403,'access_denied');
 const preferencesPath=new RegExp('^/thralls/characters/([0-9a-f-]{36})/contributions$').exec(path);
 if(preferencesPath&&uuid.test(preferencesPath[1])){
  const id=preferencesPath[1];
  const [[character]]=await pool.execute('SELECT id,character_name,player_account_id,collar_bound FROM characters WHERE id=?',[id]);
  if(!character)return forbidden(404,'character_not_found');
  const [rank]=await pool.execute("SELECT 1 FROM character_order_ranks r JOIN order_rank_catalog cat ON cat.code=r.rank_code WHERE r.character_id=? AND cat.track='servitude' LIMIT 1",[id]);
  if(!character.collar_bound&&!rank.length)return forbidden(403,'bound_character_required');
  const owner=character.player_account_id===actor.id;
  if(!owner&&!(await manager(pool,actor)))return forbidden(403,'character_access_denied');
  if(req.method==='GET'){
   const [[prefs]]=await pool.execute('SELECT allow_upper,allow_lower,upper_limit,lower_limit,allow_seating FROM order_thrall_contribution_preferences WHERE character_id=?',[id]);
   return ok({character_id:id,character_name:character.character_name,preferences:prefs||defaultPrefs,can_edit:owner});
  }
  if(req.method!=='PUT')return forbidden(405,'method_not_allowed');
  if(!owner)return forbidden(403,'character_owner_required');
  const body=await readBody(req);
  if(!body||!['allow_upper','allow_lower','allow_seating'].every(k=>typeof body[k]==='boolean')||!isAmount(body.upper_limit)||!isAmount(body.lower_limit))return forbidden(400,'invalid_contribution_preferences');
  const next={allow_upper:body.allow_upper,allow_lower:body.allow_lower,allow_seating:body.allow_seating,upper_limit:body.allow_upper?body.upper_limit:0,lower_limit:body.allow_lower?body.lower_limit:0};
  const cn=await pool.getConnection();
  try{
   await cn.beginTransaction();
   const [[seat]]=await cn.execute('SELECT character_id FROM order_thrall_seat WHERE id=1 FOR UPDATE');
   const [[machine]]=await cn.execute('SELECT machine_status FROM order_thrall_chamber WHERE id=1 FOR UPDATE');
   if(seat.character_id===id&&(!next.allow_seating||(!next.allow_upper&&!next.allow_lower))){
    await cn.execute("UPDATE order_thrall_chamber SET machine_status='offline',upper_status='ready',lower_status='ready',revision=revision+1 WHERE id=1");
    await cn.execute('UPDATE order_thrall_seat SET character_id=NULL,seated_at=NULL,placed_by=NULL,upper_recorded=0,lower_recorded=0 WHERE id=1');
    await cn.execute('INSERT INTO order_thrall_chamber_log(actor_id,action,detail) VALUES(?,?,?)',[actor.id,'release','Player withdrew chair permission; character released']);
   }
   await cn.execute('INSERT INTO order_thrall_contribution_preferences(character_id,allow_upper,allow_lower,upper_limit,lower_limit,allow_seating) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE allow_upper=VALUES(allow_upper),allow_lower=VALUES(allow_lower),upper_limit=VALUES(upper_limit),lower_limit=VALUES(lower_limit),allow_seating=VALUES(allow_seating)',[id,Number(next.allow_upper),Number(next.allow_lower),next.upper_limit,next.lower_limit,Number(next.allow_seating)]);
   await cn.commit();return ok({saved:true});
  }catch(e){await cn.rollback().catch(()=>{});throw e}finally{cn.release()}
 }
 if(path==='/thralls/chamber'&&req.method==='GET'){
  const [[machine]]=await pool.execute('SELECT * FROM order_thrall_chamber WHERE id=1');
  const [batches]=await pool.execute('SELECT id,material,quantity,classification,notes,created_at FROM order_thrall_chamber_batches ORDER BY id DESC LIMIT 80');
  const [history]=await pool.execute('SELECT l.id,l.action,l.detail,l.created_at,a.display_name AS actor FROM order_thrall_chamber_log l JOIN accounts a ON a.id=l.actor_id ORDER BY l.id DESC LIMIT 50');
  const [[seat]]=await pool.execute('SELECT s.character_id,s.seated_at,s.upper_recorded,s.lower_recorded,c.character_name AS name FROM order_thrall_seat s LEFT JOIN characters c ON c.id=s.character_id WHERE s.id=1');
  const can_manage=await manager(pool,actor);
  const roster=can_manage?await seatRoster(pool):[];
  return ok({machine,batches,history,seat,roster,can_manage,can_release:can_manage||(seat?.character_id&&roster.length===0&&(await pool.execute('SELECT 1 FROM characters WHERE id=? AND player_account_id=?',[seat.character_id,actor.id]))[0].length>0)});
 }
 if(path!=='/thralls/chamber/actions'||req.method!=='POST')return forbidden(404,'not_found');
 const canOperate=await manager(pool,actor);
 const data=await readBody(req);
 if(!data||typeof data!=='object')return forbidden(400,'invalid_request');
 const action=data.action;
 if(!['set_status','record_collection','decant','maintenance','reset','seat','release'].includes(action))return forbidden(400,'invalid_chamber_action');
 if(!canOperate&&action!=='release')return forbidden(403,'household_or_staff_required');
 const cn=await pool.getConnection();
 try{
  await cn.beginTransaction();
  const [[machine]]=await cn.execute('SELECT * FROM order_thrall_chamber WHERE id=1 FOR UPDATE');
  if(!machine){await cn.rollback();return forbidden(409,'chamber_not_initialized')}
  const [[seat]]=await cn.execute('SELECT * FROM order_thrall_seat WHERE id=1 FOR UPDATE');
  if(!canOperate){
   const [mine]=seat.character_id?await cn.execute('SELECT 1 FROM characters WHERE id=? AND player_account_id=?',[seat.character_id,actor.id]):[[]];
   if(!mine.length){await cn.rollback();return forbidden(403,'owner_or_staff_required')}
  }
  let updates=[],values=[],detail='';
  if(action==='seat'){
   if(machine.machine_status!=='offline')return await rollback(cn,'chair_must_be_offline');
   if(seat.character_id)return await rollback(cn,'chair_occupied');
   if(!uuid.test(data.character_id||''))return await rollback(cn,'invalid_character');
   const [rows]=await cn.execute("SELECT c.character_name,c.collar_bound,p.allow_seating,p.allow_upper,p.allow_lower FROM characters c JOIN order_thrall_contribution_preferences p ON p.character_id=c.id LEFT JOIN character_order_ranks r ON r.character_id=c.id LEFT JOIN order_rank_catalog cat ON cat.code=r.rank_code WHERE c.id=? AND (c.collar_bound=1 OR cat.track='servitude') FOR UPDATE",[data.character_id]);
   const character=rows[0];
   if(!character||!character.allow_seating||(!character.allow_upper&&!character.allow_lower))return await rollback(cn,'character_has_not_opted_in');
   await cn.execute('UPDATE order_thrall_seat SET character_id=?,seated_at=UTC_TIMESTAMP(),placed_by=?,upper_recorded=0,lower_recorded=0 WHERE id=1',[data.character_id,actor.id]);
   detail='Seated '+character.character_name+' with recorded player permission';
  }else if(action==='release'){
   if(!seat.character_id)return await rollback(cn,'chair_empty');
   await cn.execute("UPDATE order_thrall_chamber SET machine_status='offline',upper_status='ready',lower_status='ready' WHERE id=1");
   await cn.execute('UPDATE order_thrall_seat SET character_id=NULL,seated_at=NULL,placed_by=NULL,upper_recorded=0,lower_recorded=0 WHERE id=1');
   detail='Released the seated character; machine set offline';
  }else if(action==='set_status'){
   const allowed=['offline','standby','running','maintenance'];
   if(!allowed.includes(data.status))return await rollback(cn,'invalid_status');
   if(data.status==='running'&&!seat.character_id)return await rollback(cn,'chair_empty');
   if(data.status==='running'&&(machine.upper_status!=='ready'&&machine.lower_status!=='ready'&&machine.upper_status!=='active'&&machine.lower_status!=='active'))return await rollback(cn,'no_operational_assembly');
   updates=['machine_status=?'];values=[data.status];detail='System status changed to '+data.status;
  }else if(action==='maintenance'){
   const channel=data.channel,status=data.status;
   if(!['upper','lower'].includes(channel)||!['offline','ready','active','maintenance'].includes(status))return await rollback(cn,'invalid_assembly_status');
   if(status==='active'&&machine.machine_status!=='running')return await rollback(cn,'chamber_not_running');
   updates=[channel+'_status=?'];values=[status];detail=channel+' assembly set to '+status;
  }else if(action==='record_collection'){
   const channel=data.channel,amount=data.quantity;
   if(!['upper','lower'].includes(channel)||!isAmount(amount)||amount===0)return await rollback(cn,'invalid_quantity');
   if(machine.machine_status!=='running'||machine[channel+'_status']!=='active'||!seat.character_id)return await rollback(cn,'assembly_not_active');
   const [[prefs]]=await cn.execute('SELECT * FROM order_thrall_contribution_preferences WHERE character_id=? FOR UPDATE',[seat.character_id]);
   if(!prefs||!prefs.allow_seating||!prefs['allow_'+channel]||Number(seat[channel+'_recorded'])+amount>Number(prefs[channel+'_limit']))return await rollback(cn,'character_contribution_limit');
   await cn.execute('UPDATE order_thrall_seat SET '+channel+'_recorded='+channel+'_recorded+? WHERE id=1',[amount]);
   if(Number(machine[channel+'_volume'])+amount>Number(machine[channel+'_capacity']))return await rollback(cn,'reservoir_full');
   updates=[channel+'_volume='+channel+'_volume+?'];values=[amount];detail='Recorded '+amount+' fictional units in '+channel+' reservoir';
  }else if(action==='decant'){
   const channel=data.channel,amount=data.quantity,classification=String(data.classification||'Unclassified').trim(),notes=String(data.notes||'').trim();
   if(!['upper','lower'].includes(channel)||!isAmount(amount)||amount===0||amount>machine[channel+'_volume']||classification.length>80||notes.length>500)return await rollback(cn,'invalid_batch');
   await cn.execute('INSERT INTO order_thrall_chamber_batches(material,quantity,classification,notes,created_by) VALUES(?,?,?,?,?)',[channel==='upper'?'lacteal':'secondary',amount,classification||'Unclassified',notes,actor.id]);
   updates=[channel+'_volume='+channel+'_volume-?'];values=[amount];detail='Decanted '+amount+' fictional units from '+channel+' reservoir';
  }else{
   if(machine.machine_status==='running')return await rollback(cn,'stop_chamber_first');
   if(!['upper','lower'].includes(data.channel))return await rollback(cn,'invalid_channel');
   updates=[data.channel+'_volume=0'];values=[];detail='Cleared '+data.channel+' reservoir (uncollected contents discarded)';
  }
  await cn.execute('UPDATE order_thrall_chamber SET '+[...updates,'revision=revision+1','updated_by=?'].join(',')+' WHERE id=1',[...values,actor.id]);
  await cn.execute('INSERT INTO order_thrall_chamber_log(actor_id,action,detail) VALUES(?,?,?)',[actor.id,action,detail]);
  await cn.commit();return ok({saved:true});
 }catch(e){await cn.rollback().catch(()=>{});throw e}finally{cn.release()}
}
async function rollback(conn,error){await conn.rollback();return forbidden(400,error)}
