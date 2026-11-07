import {resolveSession} from './auth.js';
const ok=body=>({status:200,body});
const fail=(status,error)=>({status,body:{error}});
const fields='id,question,answer,sort_order,published,updated_at';
async function input(req){
 let size=0,parts=[];
 for await(const part of req){size+=part.length;if(size>14000)return null;parts.push(part)}
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{return null}
}
function valid(body){
 return body&&typeof body.question==='string'&&body.question.trim().length>0&&body.question.length<=240
 &&typeof body.answer==='string'&&body.answer.trim().length>0&&body.answer.length<=8000
 &&Number.isInteger(body.sort_order)&&body.sort_order>=-10000&&body.sort_order<=10000
 &&typeof body.published==='boolean';
}
export async function faqRoute(pool,req,path){
 if(!pool)return fail(503,'database_unavailable');
 if(path==='/faq/public'&&req.method==='GET'){
  const [rows]=await pool.execute('SELECT '+fields+' FROM order_public_faq WHERE published=1 ORDER BY sort_order,id LIMIT 200');
  return ok({entries:rows.map(row=>({...row,published:!!row.published}))});
 }
 const actor=await resolveSession(pool,req);
 if(!actor)return fail(401,'not_authenticated');
 const canEdit=['domina','high_command'].includes(actor.account_role);
 if(path==='/faq'&&req.method==='GET'){
  const [rows]=await pool.execute('SELECT '+fields+' FROM order_public_faq '+(canEdit?'':'WHERE published=1 ')+'ORDER BY sort_order,id LIMIT 200');
  return ok({entries:rows.map(row=>({...row,published:!!row.published})),can_edit:canEdit});
 }
 if(!canEdit)return fail(403,'command_required');
 if(path==='/faq'&&req.method==='POST'){
  const b=await input(req);if(!valid(b))return fail(400,'invalid_faq_entry');
  const [result]=await pool.execute('INSERT INTO order_public_faq(question,answer,sort_order,published,updated_by) VALUES(?,?,?,?,?)',[b.question.trim(),b.answer.trim(),b.sort_order,b.published?1:0,actor.id]);
  return ok({saved:true,id:result.insertId});
 }
 const match=/^\/faq\/(\d+)$/.exec(path);
 if(match&&req.method==='PUT'){
  const b=await input(req);if(!valid(b))return fail(400,'invalid_faq_entry');
  const [result]=await pool.execute('UPDATE order_public_faq SET question=?,answer=?,sort_order=?,published=?,updated_by=? WHERE id=?',[b.question.trim(),b.answer.trim(),b.sort_order,b.published?1:0,actor.id,Number(match[1])]);
  return result.affectedRows?ok({saved:true,id:Number(match[1])}):fail(404,'faq_not_found');
 }
 if(match&&req.method==='DELETE'){
  const [result]=await pool.execute('DELETE FROM order_public_faq WHERE id=?',[Number(match[1])]);
  return result.affectedRows?ok({deleted:true}):fail(404,'faq_not_found');
 }
 return fail(404,'not_found');
}
