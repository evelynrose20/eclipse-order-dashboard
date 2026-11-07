import {resolveSession} from './auth.js';
const fail=(status,error)=>({status,body:{error}});
const ok=body=>({status:200,body});
const idPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const eras=new Set(['thirteenth','arr','heavensward','stormblood','shadowbringers','endwalker','dawntrail','present']);
const kinds=new Set(['history','place','person','faction']);
const fields='id,title,era,kind,summary,body,sort_order,published,updated_at';
async function payload(req){
 const chunks=[];let total=0;
 for await(const ch of req){total+=ch.length;if(total>25000)throw Object.assign(new Error('request_too_large'),{status:413});chunks.push(ch)}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}
}
function validate(b){
 return b&&typeof b.id==='string'&&b.id.length<=72&&idPattern.test(b.id)
  &&typeof b.title==='string'&&b.title.trim().length>0&&b.title.length<=160
  &&eras.has(b.era)&&kinds.has(b.kind)
  &&typeof b.summary==='string'&&b.summary.length<=420
  &&typeof b.body==='string'&&b.body.length<=16000
  &&Number.isInteger(b.sort_order)&&b.sort_order>=-10000&&b.sort_order<=10000
  &&typeof b.published==='boolean';
}
export async function loreRoute(pool,req,path){
 if(!pool)return fail(503,'database_unavailable');
 if(req.method==='GET'&&path==='/lore/public'){
  const [rows]=await pool.execute('SELECT '+fields+' FROM order_lore_entries WHERE published=1 ORDER BY FIELD(era,"thirteenth","arr","heavensward","stormblood","shadowbringers","endwalker","dawntrail","present"),sort_order,id LIMIT 250');
  return ok({entries:rows.map(r=>({...r,published:Boolean(r.published)}))});
 }
 const actor=await resolveSession(pool,req);
 if(!actor)return fail(401,'not_authenticated');
 const canEdit=actor.account_role==='domina'||actor.account_role==='high_command';
 if(path==='/lore'&&req.method==='GET'){
  const [rows]=await pool.execute('SELECT '+fields+' FROM order_lore_entries '+(canEdit?'':'WHERE published=1 ')+'ORDER BY FIELD(era,"thirteenth","arr","heavensward","stormblood","shadowbringers","endwalker","dawntrail","present"),sort_order,id LIMIT 250');
  return ok({entries:rows.map(r=>({...r,published:Boolean(r.published)})),can_edit:canEdit});
 }
 if(path==='/lore'&&req.method==='POST'){
  if(!canEdit)return fail(403,'command_required');
  const b=await payload(req);
  if(!validate(b))return fail(400,'invalid_lore_entry');
  try{
   await pool.execute('INSERT INTO order_lore_entries(id,title,era,kind,summary,body,sort_order,published,updated_by) VALUES(?,?,?,?,?,?,?,?,?)',[b.id,b.title.trim(),b.era,b.kind,b.summary.trim(),b.body.trim(),b.sort_order,b.published?1:0,actor.id]);
  }catch(e){if(e.code==='ER_DUP_ENTRY')return fail(409,'entry_already_exists');throw e}
  return ok({saved:true,id:b.id});
 }
 const match=/^\/lore\/([a-z0-9-]{1,72})$/.exec(path);
 if(match&&req.method==='PUT'){
  if(!canEdit)return fail(403,'command_required');
  const b=await payload(req);
  if(!validate(b)||b.id!==match[1])return fail(400,'invalid_lore_entry');
  const [result]=await pool.execute('UPDATE order_lore_entries SET title=?,era=?,kind=?,summary=?,body=?,sort_order=?,published=?,updated_by=? WHERE id=?',[b.title.trim(),b.era,b.kind,b.summary.trim(),b.body.trim(),b.sort_order,b.published?1:0,actor.id,b.id]);
  if(!result.affectedRows)return fail(404,'entry_not_found');
  return ok({saved:true,id:b.id});
 }
 return fail(404,'not_found');
}
