import {resolveSession} from './auth.js';

export const RECRUITMENT_STATES=Object.freeze(['open','limited','closed']);
export const normalizeRecruitmentStatus=value=>RECRUITMENT_STATES.includes(value)?value:'open';

export async function getRecruitmentStatus(pool){
 if(!pool)throw Object.assign(new Error('database_unavailable'),{status:503});
 const [rows]=await pool.execute("SELECT content FROM order_settings WHERE setting_key='recruitment_status' LIMIT 1");
 return normalizeRecruitmentStatus(rows[0]?.content);
}

export async function recruitmentRoute(pool,req,path){
 if(path!=='/recruitment'||!pool)return {status:pool?404:503,body:{error:pool?'not_found':'database_unavailable'}};
 if(req.method==='GET')return {status:200,body:{status:await getRecruitmentStatus(pool)}};
 if(req.method!=='PUT')return {status:405,body:{error:'method_not_allowed'}};
 const actor=await resolveSession(pool,req);
 if(!actor)return {status:401,body:{error:'not_authenticated'}};
 if(actor.account_role!=='domina')return {status:403,body:{error:'domina_required'}};
 let size=0,parts=[];
 for await(const chunk of req){size+=chunk.length;if(size>2048)return {status:413,body:{error:'request_too_large'}};parts.push(chunk)}
 let body;
 try{body=JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{return {status:400,body:{error:'invalid_request'}}}
 if(!body||!RECRUITMENT_STATES.includes(body.status))return {status:400,body:{error:'invalid_recruitment_status'}};
 await pool.execute("INSERT INTO order_settings(setting_key,content,updated_by) VALUES('recruitment_status',?,?) ON DUPLICATE KEY UPDATE content=VALUES(content),updated_by=VALUES(updated_by)",[body.status,actor.id]);
 await pool.execute('INSERT INTO audit_log(actor_account_id,action,entity_type,entity_id,details_json) VALUES(?,?,?,?,?)',[actor.id,'recruitment_status_changed','order_settings','recruitment_status',JSON.stringify({status:body.status})]);
 return {status:200,body:{status:body.status}};
}
