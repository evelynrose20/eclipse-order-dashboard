import {resolveSession} from './auth.js';

export const RECRUITMENT_STATES=Object.freeze(['open','limited','closed']);
export const normalizeRecruitmentStatus=value=>RECRUITMENT_STATES.includes(value)?value:'open';
const MAX_REASON=600;
export function validReopeningDate(value){
 if(value===null||value==='')return true;
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T00:00:00Z');
 return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export async function getRecruitmentDetails(pool){
 if(!pool)throw Object.assign(new Error('database_unavailable'),{status:503});
 const [rows]=await pool.execute("SELECT setting_key,content FROM order_settings WHERE setting_key IN ('recruitment_status','recruitment_reason','recruitment_reopens','recruitment_reopening_note')");
 const stored=Object.fromEntries(rows.map(r=>[r.setting_key,r.content]));
 const status=normalizeRecruitmentStatus(stored.recruitment_status);
 return {status,reason:status==='closed'?String(stored.recruitment_reason||'').slice(0,MAX_REASON):'',reopens_on:status==='closed'&&validReopeningDate(stored.recruitment_reopens)?stored.recruitment_reopens||null:null,reopening_note:status==='closed'?String(stored.recruitment_reopening_note||'').slice(0,200):''};
}
export async function getRecruitmentStatus(pool){return (await getRecruitmentDetails(pool)).status}
export async function recruitmentRoute(pool,req,path){
 if(path!=='/recruitment'||!pool)return {status:pool?404:503,body:{error:pool?'not_found':'database_unavailable'}};
 if(req.method==='GET')return {status:200,body:await getRecruitmentDetails(pool)};
 if(req.method!=='PUT')return {status:405,body:{error:'method_not_allowed'}};
 const actor=await resolveSession(pool,req);
 if(!actor)return {status:401,body:{error:'not_authenticated'}};
 if(actor.account_role!=='domina')return {status:403,body:{error:'domina_required'}};
 let size=0,parts=[];
 for await(const chunk of req){size+=chunk.length;if(size>4096)return {status:413,body:{error:'request_too_large'}};parts.push(chunk)}
 let body;
 try{body=JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{return {status:400,body:{error:'invalid_request'}}}
 if(!body||!RECRUITMENT_STATES.includes(body.status)||typeof body.reason!=='string'||body.reason.length>MAX_REASON||typeof body.reopening_note!=='string'||body.reopening_note.length>200||!validReopeningDate(body.reopens_on))return {status:400,body:{error:'invalid_recruitment_details'}};
 const status=body.status;
 const reason=status==='closed'?body.reason.trim():'';
 const reopens=status==='closed'?body.reopens_on||'':'';
 const reopeningNote=status==='closed'?body.reopening_note.trim():'';
 // Commit all three fields together so the public announcement can never be half-updated.
 const conn=await pool.getConnection();
 try{
  await conn.beginTransaction();
  for(const [key,content] of [['recruitment_status',status],['recruitment_reason',reason],['recruitment_reopens',reopens],['recruitment_reopening_note',reopeningNote]]){
   await conn.execute('INSERT INTO order_settings(setting_key,content,updated_by) VALUES(?,?,?) ON DUPLICATE KEY UPDATE content=VALUES(content),updated_by=VALUES(updated_by)',[key,content,actor.id]);
  }
  await conn.execute('INSERT INTO audit_log(actor_account_id,action,entity_type,entity_id,details_json) VALUES(?,?,?,?,?)',[actor.id,'recruitment_status_changed','order_settings','recruitment_status',JSON.stringify({status,reason,reopens_on:reopens||null,reopening_note:reopeningNote})]);
  await conn.commit();
 }catch(error){await conn.rollback();throw error}finally{conn.release()}
 return {status:200,body:{status,reason,reopens_on:reopens||null}};
}
