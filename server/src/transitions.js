import {randomUUID} from 'node:crypto';
import {resolveSession} from './auth.js';

const command=role=>role==='domina'||role==='high_command';
const response=(status,body)=>({status,body});
const fail=(status,error)=>response(status,{error});
const UUID=/^[0-9a-f-]{36}$/i;
async function payload(req){
 const chunks=[];let n=0;
 for await(const x of req){n+=x.length;if(n>4096)return null;chunks.push(x);}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}
}
export async function transitionRoute(pool,req,path){
 if(!pool)return fail(503,'database_unavailable');
 const user=await resolveSession(pool,req);
 if(!user)return fail(401,'not_authenticated');
 if(path==='/transitions'&&req.method==='GET'){
  const elevated=command(user.account_role);
  const [rows]=elevated
   ?await pool.query('SELECT r.*,c.character_name AS name FROM character_status_requests r JOIN characters c ON c.id=r.character_id ORDER BY r.created_at DESC LIMIT 200')
   :await pool.execute('SELECT r.*,c.character_name AS name FROM character_status_requests r JOIN characters c ON c.id=r.character_id WHERE r.player_account_id=? OR r.requested_by=? ORDER BY r.created_at DESC LIMIT 200',[user.id,user.id]);
  return response(200,rows.map(r=>({id:r.id,character_id:r.character_id,name:r.name,player_user_id:r.player_account_id,requested_by:r.requested_by,requested_bound:Boolean(r.target_bound),state:r.state,created_at:r.created_at,decided_at:r.decided_at,applied_at:r.applied_at})));
 }
 if(path==='/transitions'&&req.method==='POST'){
  const b=await payload(req);
  if(!UUID.test(b?.character_id||'')||typeof b?.bound!=='boolean')return fail(400,'invalid_transition_request');
  const [characters]=await pool.execute('SELECT player_account_id,handler_account_id,collar_bound FROM characters WHERE id=?',[b.character_id]);
  const c=characters[0];
  if(!c||!c.player_account_id)return fail(404,'linked_character_required');
  if(!command(user.account_role)&&c.player_account_id!==user.id&&!(user.account_role==='handler'&&c.handler_account_id===user.id))return fail(403,'forbidden');
  if(Boolean(c.collar_bound)===b.bound)return fail(409,'already_in_requested_state');
  const [existing]=await pool.execute("SELECT id FROM character_status_requests WHERE character_id=? AND state IN ('pending','approved') LIMIT 1",[b.character_id]);
  if(existing.length)return fail(409,'existing_transition_request');
  const id=randomUUID();
  await pool.execute('INSERT INTO character_status_requests(id,character_id,player_account_id,requested_by,target_bound) VALUES(?,?,?,?,?)',[id,b.character_id,c.player_account_id,user.id,b.bound?1:0]);
  return response(201,{id});
 }
 const match=/^\/transitions\/([a-f0-9-]{36})\/(decide|cancel|apply)$/.exec(path);
 if(!match||req.method!=='POST')return fail(404,'not_found');
 const [,id,action]=match;
 const b=await payload(req);
 const connection=await pool.getConnection();
 try{
  await connection.beginTransaction();
  const [rows]=await connection.execute('SELECT * FROM character_status_requests WHERE id=? FOR UPDATE',[id]);
  const r=rows[0];
  if(!r){await connection.rollback();return fail(404,'request_not_found');}
  let newState;
  if(action==='decide'){
   if(r.player_account_id!==user.id)return failRollback(connection,403,'only_player_can_approve');
   if(r.state!=='pending')return failRollback(connection,409,'not_pending');
   if(typeof b?.approve!=='boolean')return failRollback(connection,400,'invalid_decision');
   newState=b.approve?'approved':'declined';
  }else if(action==='cancel'){
   if(r.player_account_id!==user.id&&r.requested_by!==user.id)return failRollback(connection,403,'forbidden');
   if(!['pending','approved'].includes(r.state))return failRollback(connection,409,'cannot_cancel');
   newState='cancelled';
  }else{
   if(!command(user.account_role))return failRollback(connection,403,'command_required');
   if(r.state!=='approved')return failRollback(connection,409,'player_approval_required');
   const [chars]=await connection.execute('SELECT * FROM characters WHERE id=? FOR UPDATE',[r.character_id]);
   const ch=chars[0];
   if(!ch||ch.player_account_id!==r.player_account_id||Boolean(ch.collar_bound)===Boolean(r.target_bound))return failRollback(connection,409,'character_changed_since_approval');
   const data=typeof ch.sheet_json==='string'?JSON.parse(ch.sheet_json):ch.sheet_json;
   data.collar_bound=Boolean(r.target_bound);
   data.rank=r.target_bound?'Unmarked':'Unbound: Free';
   await connection.execute('UPDATE characters SET collar_bound=?,bound_rank=?,sheet_json=? WHERE id=?',
    [r.target_bound?1:0,r.target_bound?'rank_i':null,JSON.stringify(data),ch.id]);
   newState='applied';
  }
  await connection.execute('UPDATE character_status_requests SET state=?,decided_at=CASE WHEN ? IN ("approved","declined") THEN UTC_TIMESTAMP() ELSE decided_at END,applied_at=CASE WHEN ?="applied" THEN UTC_TIMESTAMP() ELSE applied_at END WHERE id=?',
   [newState,newState,newState,id]);
  await connection.execute('INSERT INTO audit_log(actor_account_id,action,entity_type,entity_id,details_json) VALUES(?,?,?,?,?)',
   [user.id,'transition_'+action,'character_status_request',id,JSON.stringify({state:newState})]);
  await connection.commit();
  return response(200,{status:newState});
 }catch(error){await connection.rollback().catch(()=>{});throw error}
 finally{connection.release()}
}
async function failRollback(connection,status,error){await connection.rollback();return fail(status,error);}
