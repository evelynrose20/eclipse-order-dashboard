import {resolveSession} from './auth.js';

const relationships=new Set(['friendly','rival','watchful_rival','hostile','neutral']);
const factionId=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const factionScopes=new Set(['order_story','world','settlement']);
const repTargets=new Set(['order_view','faction_view','player']);
export const reputationLabel=score=>score<=-75?'Nemesis':score<=-40?'Hostile':score<=-10?'Unfriendly':score<10?'Neutral':score<40?'Cordial':score<75?'Friendly':'Exalted';
const clampScore=value=>Math.min(100,Math.max(-100,value));
const allowedUrl=value=>{
 if(value==='')return true;
 try{
  const u=new URL(value);
  return u.protocol==='https:'&&!u.username&&!u.password&&u.href.length<=1500;
 }catch{return false}
};
const result=(status,body)=>({status,body});
const fail=(status,error)=>result(status,{error});
async function read(req){
 let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>16000)throw Object.assign(new Error('request_too_large'),{status:413})}
 try{return JSON.parse(text)}catch{return null}
}
const validText=(value,max,empty=false)=>typeof value==='string'&&value.trim().length<=(max)&& (empty||value.trim().length>0);
const editFields=(body)=>{
 if(!body||!validText(body.name,100)||!validText(body.leader,100)||
 !relationships.has(body.relationship)||!factionScopes.has(body.faction_scope)||!validText(body.description,4500)||
 !validText(body.notes,6000,true)||typeof body.public_visible!=='boolean'||
 !Number.isInteger(body.sort_order)||body.sort_order<0||body.sort_order>999||
 !validText(body.image_reference_url,1500,true)||!allowedUrl(body.image_reference_url))return null;
 return [body.name.trim(),body.leader.trim(),body.relationship,body.description.trim(),
  body.notes.trim(),body.image_reference_url.trim(),body.public_visible?1:0,body.sort_order,body.faction_scope];
};
export async function factionRoute(pool,req,path){
 if(!pool)return fail(503,'database_unavailable');
 const user=await resolveSession(pool,req);
 if(!user)return fail(401,'not_authenticated');
 const command=['domina','high_command'].includes(user.account_role);
 if(path==='/factions/accounts'&&req.method==='GET'){
  if(!command)return fail(403,'forbidden');
  const [rows]=await pool.query('SELECT a.id,a.display_name,l.discord_username FROM accounts a LEFT JOIN account_discord_links l ON l.account_id=a.id WHERE a.is_active=1 AND a.approval_status="approved" ORDER BY a.display_name LIMIT 1000');
  return result(200,{accounts:rows});
 }
 if(path==='/factions'&&req.method==='GET'){
  const [rows]=await pool.query(
   'SELECT f.id,f.name,f.leader,f.relationship,f.description,f.notes,f.image_reference_url,f.public_visible,f.sort_order,f.faction_scope,f.updated_at,COALESCE(r.order_view,0) AS order_view,COALESCE(r.faction_view,0) AS faction_view,COALESCE(p.reputation,0) AS personal_reputation FROM order_factions f LEFT JOIN order_faction_reputation r ON r.faction_id=f.id LEFT JOIN player_faction_reputation p ON p.faction_id=f.id AND p.account_id=? '+
   (command?'':'WHERE f.public_visible=1 ')+'ORDER BY f.faction_scope,f.sort_order,f.name',[user.id]);
  return result(200,{factions:rows.map(row=>({...row,notes:command?row.notes:'',public_visible:!!row.public_visible}))});
 }
 const match=/^\/factions\/([a-z0-9-]+)(?:\/(events|reputation|history))?$/.exec(path);
 if(!match)return fail(404,'not_found');
 const id=match[1],isEvents=match[2]==='events',isReputation=match[2]==='reputation',isHistory=match[2]==='history';
 if(!factionId.test(id)||id.length>45)return fail(400,'invalid_faction_id');
 if(isEvents&&req.method==='GET'){
  const [visible]=await pool.execute('SELECT public_visible FROM order_factions WHERE id=?',[id]);
  if(!visible.length||(!command&&!visible[0].public_visible))return fail(404,'faction_not_found');
  const [rows]=await pool.execute('SELECT id,title,details,occurred_on,created_at FROM order_faction_events WHERE faction_id=? ORDER BY COALESCE(occurred_on,DATE(created_at)) DESC,id DESC LIMIT 100',[id]);
  return result(200,{events:rows});
 }
 if(isHistory&&req.method==='GET'){
  const [visible]=await pool.execute('SELECT public_visible FROM order_factions WHERE id=?',[id]);
  if(!visible.length||(!command&&!visible[0].public_visible))return fail(404,'faction_not_found');
  const [rows]=await pool.execute(
   'SELECT id,target,account_id,requested_delta,applied_delta,old_value,new_value,event_title,event_details,source_event_id,created_at FROM faction_reputation_changes WHERE faction_id=? '+
   (command?'':'AND (target<>\'player\' OR account_id=?) ')+'ORDER BY id DESC LIMIT 100',
   command?[id]:[id,user.id]);
  return result(200,{changes:rows.map(row=>({...row,account_id:command?row.account_id:null}))});
 }
 if(isReputation&&req.method==='POST'){
  if(!command)return fail(403,'forbidden');
  const body=await read(req);
  const {target,delta,event_title,event_details,account_id,source_event_id}=body||{};
  if(!repTargets.has(target)||!Number.isInteger(delta)||delta===0||delta < -100||delta>100||
   !validText(event_title,140)||!validText(event_details,5000)||
   (target==='player'?!/^[0-9a-f-]{36}$/i.test(account_id||''):account_id!==null&&account_id!==undefined&&account_id!=='')||
   (source_event_id!==undefined&&source_event_id!==null&&source_event_id!==''&&!/^[0-9a-f-]{36}$/i.test(source_event_id)))
    return fail(400,'invalid_reputation_event');
  const conn=await pool.getConnection();
  try{
   await conn.beginTransaction();
   const [factions]=await conn.execute('SELECT id FROM order_factions WHERE id=? FOR UPDATE',[id]);
   if(!factions.length){await conn.rollback();return fail(404,'faction_not_found')}
   if(source_event_id){
    const [events]=await conn.execute('SELECT id FROM order_encounters WHERE id=?',[source_event_id]);
    if(!events.length){await conn.rollback();return fail(400,'invalid_event_reference')}
   }
   if(target==='player'){
    const [accounts]=await conn.execute('SELECT id FROM accounts WHERE id=?',[account_id]);
    if(!accounts.length){await conn.rollback();return fail(404,'account_not_found')}
    await conn.execute('INSERT IGNORE INTO player_faction_reputation(account_id,faction_id,reputation) VALUES(?,?,0)',[account_id,id]);
   }else{
    await conn.execute('INSERT IGNORE INTO order_faction_reputation(faction_id,order_view,faction_view) VALUES(?,0,0)',[id]);
   }
   const column=target==='player'?'reputation':target;
   const table=target==='player'?'player_faction_reputation':'order_faction_reputation';
   const params=target==='player'?[account_id,id]:[id];
   const where=target==='player'?'account_id=? AND faction_id=?':'faction_id=?';
   const [oldRows]=await conn.execute('SELECT '+column+' AS score FROM '+table+' WHERE '+where+' FOR UPDATE',params);
   const before=Number(oldRows[0].score),after=clampScore(before+delta);
   await conn.execute('UPDATE '+table+' SET '+column+'=? WHERE '+where,[after,...params]);
   await conn.execute('INSERT INTO faction_reputation_changes(faction_id,target,account_id,requested_delta,applied_delta,old_value,new_value,event_title,event_details,source_event_id,authored_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
    [id,target,target==='player'?account_id:null,delta,after-before,before,after,event_title.trim(),event_details.trim(),source_event_id||null,user.id]);
   await conn.commit();
   return result(200,{score:after,previous:before,applied_delta:after-before,label:reputationLabel(after)});
  }catch(error){await conn.rollback();throw error}
  finally{conn.release()}
 }
 if(!command)return fail(403,'forbidden');
 if(path==='/factions/'+id&&req.method==='PUT'){
  const body=await read(req),data=editFields(body);
  if(!data)return fail(400,'invalid_faction');
  const [updated]=await pool.execute('UPDATE order_factions SET name=?,leader=?,relationship=?,description=?,notes=?,image_reference_url=?,public_visible=?,sort_order=?,faction_scope=? WHERE id=?',[...data,id]);
  return updated.affectedRows?result(200,{status:'saved'}):fail(404,'faction_not_found');
 }
 if(path==='/factions/'+id&&req.method==='POST'){
  const body=await read(req),data=editFields(body);
  if(!data)return fail(400,'invalid_faction');
  try{await pool.execute('INSERT INTO order_factions(id,name,leader,relationship,description,notes,image_reference_url,public_visible,sort_order,faction_scope) VALUES(?,?,?,?,?,?,?,?,?,?)',[id,...data])}
  catch(error){if(error.code==='ER_DUP_ENTRY')return fail(409,'faction_exists');throw error}
  await pool.execute('INSERT IGNORE INTO order_faction_reputation(faction_id,order_view,faction_view) VALUES(?,0,0)',[id]);
  return result(201,{id});
 }
 if(isEvents&&req.method==='POST'){
  const body=await read(req);
  if(!validText(body?.title,140)||!validText(body?.details,5000)||!(body.occurred_on===null||body.occurred_on===''||typeof body.occurred_on==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(body.occurred_on)))return fail(400,'invalid_faction_event');
  const [found]=await pool.execute('SELECT id FROM order_factions WHERE id=?',[id]);
  if(!found.length)return fail(404,'faction_not_found');
  const [created]=await pool.execute('INSERT INTO order_faction_events(faction_id,title,details,occurred_on,created_by) VALUES(?,?,?,?,?)',[id,body.title.trim(),body.details.trim(),body.occurred_on||null,user.id]);
  return result(201,{id:created.insertId});
 }
 return fail(404,'not_found');
}
