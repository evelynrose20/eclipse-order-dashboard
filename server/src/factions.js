import {resolveSession} from './auth.js';

const relationships=new Set(['friendly','rival','watchful_rival','hostile','neutral']);
const factionId=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
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
 !relationships.has(body.relationship)||!validText(body.description,4500)||
 !validText(body.notes,6000,true)||typeof body.public_visible!=='boolean'||
 !Number.isInteger(body.sort_order)||body.sort_order<0||body.sort_order>999||
 !validText(body.image_reference_url,1500,true)||!allowedUrl(body.image_reference_url))return null;
 return [body.name.trim(),body.leader.trim(),body.relationship,body.description.trim(),
  body.notes.trim(),body.image_reference_url.trim(),body.public_visible?1:0,body.sort_order];
};
export async function factionRoute(pool,req,path){
 if(!pool)return fail(503,'database_unavailable');
 const user=await resolveSession(pool,req);
 if(!user)return fail(401,'not_authenticated');
 const command=['domina','high_command'].includes(user.account_role);
 if(path==='/factions'&&req.method==='GET'){
  const [rows]=await pool.query('SELECT id,name,leader,relationship,description,notes,image_reference_url,public_visible,sort_order,updated_at FROM order_factions '+(command?'':'WHERE public_visible=1 ')+'ORDER BY sort_order,name');
  return result(200,{factions:rows.map(row=>({...row,notes:command?row.notes:'',public_visible:!!row.public_visible}))});
 }
 const match=/^\/factions\/([a-z0-9-]+)(?:\/(events))?$/.exec(path);
 if(!match)return fail(404,'not_found');
 const id=match[1],isEvents=match[2]==='events';
 if(!factionId.test(id)||id.length>45)return fail(400,'invalid_faction_id');
 if(isEvents&&req.method==='GET'){
  const [visible]=await pool.execute('SELECT public_visible FROM order_factions WHERE id=?',[id]);
  if(!visible.length||(!command&&!visible[0].public_visible))return fail(404,'faction_not_found');
  const [rows]=await pool.execute('SELECT id,title,details,occurred_on,created_at FROM order_faction_events WHERE faction_id=? ORDER BY COALESCE(occurred_on,DATE(created_at)) DESC,id DESC LIMIT 100',[id]);
  return result(200,{events:rows});
 }
 if(!command)return fail(403,'forbidden');
 if(path==='/factions/'+id&&req.method==='PUT'){
  const body=await read(req),data=editFields(body);
  if(!data)return fail(400,'invalid_faction');
  const [updated]=await pool.execute('UPDATE order_factions SET name=?,leader=?,relationship=?,description=?,notes=?,image_reference_url=?,public_visible=?,sort_order=? WHERE id=?',[...data,id]);
  return updated.affectedRows?result(200,{status:'saved'}):fail(404,'faction_not_found');
 }
 if(path==='/factions/'+id&&req.method==='POST'){
  const body=await read(req),data=editFields(body);
  if(!data)return fail(400,'invalid_faction');
  try{await pool.execute('INSERT INTO order_factions(id,name,leader,relationship,description,notes,image_reference_url,public_visible,sort_order) VALUES(?,?,?,?,?,?,?,?,?)',[id,...data])}
  catch(error){if(error.code==='ER_DUP_ENTRY')return fail(409,'faction_exists');throw error}
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
