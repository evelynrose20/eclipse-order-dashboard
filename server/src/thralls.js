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
export async function thrallsRoute(pool,req,path){
 if(!pool)return forbidden(503,'database_unavailable');
 const actor=await resolveSession(pool,req);
 if(!actor)return forbidden(401,'not_authenticated');
 if(!await mayEnterThralls(pool,actor))return forbidden(403,'access_denied');
 if(path==='/thralls/chamber'&&req.method==='GET'){
  const [[machine]]=await pool.execute('SELECT * FROM order_thrall_chamber WHERE id=1');
  const [batches]=await pool.execute('SELECT id,material,quantity,classification,notes,created_at FROM order_thrall_chamber_batches ORDER BY id DESC LIMIT 80');
  const [history]=await pool.execute('SELECT l.id,l.action,l.detail,l.created_at,a.display_name AS actor FROM order_thrall_chamber_log l JOIN accounts a ON a.id=l.actor_id ORDER BY l.id DESC LIMIT 50');
  return ok({machine,batches,history,can_manage:await manager(pool,actor)});
 }
 if(path!=='/thralls/chamber/actions'||req.method!=='POST')return forbidden(404,'not_found');
 if(!await manager(pool,actor))return forbidden(403,'household_or_staff_required');
 const data=await readBody(req);
 if(!data||typeof data!=='object')return forbidden(400,'invalid_request');
 const action=data.action;
 if(!['set_status','record_collection','decant','maintenance','reset'].includes(action))return forbidden(400,'invalid_chamber_action');
 const cn=await pool.getConnection();
 try{
  await cn.beginTransaction();
  const [[machine]]=await cn.execute('SELECT * FROM order_thrall_chamber WHERE id=1 FOR UPDATE');
  if(!machine){await cn.rollback();return forbidden(409,'chamber_not_initialized')}
  let updates=[],values=[],detail='';
  if(action==='set_status'){
   const allowed=['offline','standby','running','maintenance'];
   if(!allowed.includes(data.status))return await rollback(cn,'invalid_status');
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
   if(machine.machine_status!=='running'||machine[channel+'_status']!=='active')return await rollback(cn,'assembly_not_active');
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
  await cn.execute('UPDATE order_thrall_chamber SET '+updates.join(',')+',revision=revision+1,updated_by=? WHERE id=1',[...values,actor.id]);
  await cn.execute('INSERT INTO order_thrall_chamber_log(actor_id,action,detail) VALUES(?,?,?)',[actor.id,action,detail]);
  await cn.commit();return ok({saved:true});
 }catch(e){await cn.rollback().catch(()=>{});throw e}finally{cn.release()}
}
async function rollback(conn,error){await conn.rollback();return forbidden(400,error)}
