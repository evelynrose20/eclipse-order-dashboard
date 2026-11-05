import {randomUUID} from 'node:crypto';
import {normalizeEmail,hashPassword,validPassword} from './credentials.js';

// First-account setup is deliberately LOCAL-ONLY. It is disabled in public API mode,
// accepts the exact local Vite Origin, and refuses to run if any account exists.
// The endpoint never returns database secrets and never allows selecting a role.
export async function firstDominaRoute(pool,req,path,{publicEnabled,allowedOrigin}){
 const error=(status,reason)=>({status,body:{error:reason}});
 if(publicEnabled)return error(404,'not_found');
 const host=(req.headers.host||'').toLowerCase();
 const expectedHost='127.0.0.1:'+Number(process.env.API_PORT||3182);
 if(host!==expectedHost&&host!=='localhost:'+Number(process.env.API_PORT||3182))return error(403,'local_only');
 if(req.headers.origin!==allowedOrigin||!allowedOrigin.startsWith('http://localhost:'))
  return error(403,'local_setup_origin_required');
 if(!pool)return error(503,'database_unavailable');
 const [existing]=await pool.query('SELECT COUNT(*) AS n FROM accounts');
 if(path==='/auth/setup-status'&&req.method==='GET')
  return {status:200,body:{needs_setup:Number(existing[0].n)===0}};
 if(path!=='/auth/setup-domina'||req.method!=='POST')return error(404,'not_found');
 if(Number(existing[0].n)!==0)return error(409,'first_account_already_created');
 let bytes=0,chunks=[];
 for await(const chunk of req){
  bytes+=chunk.length;
  if(bytes>8192)return error(413,'request_too_large');
  chunks.push(chunk);
 }
 let body;
 try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return error(400,'invalid_request')}
 const email=normalizeEmail(body?.email);
 const displayName=typeof body?.display_name==='string'?body.display_name.trim():'';
 if(!email||displayName.length<2||displayName.length>80||!validPassword(body?.password))
  return error(400,'Use a valid email, display name and password of at least 16 characters.');
 const connection=await pool.getConnection();
 try{
  const [[lock]]=await connection.query("SELECT GET_LOCK('eclipse_order_first_admin', 10) AS acquired");
  if(lock.acquired!==1)return error(503,'setup_busy');
  try{
   const [[count]]=await connection.query('SELECT COUNT(*) AS n FROM accounts');
   if(Number(count.n)!==0)return error(409,'first_account_already_created');
   await connection.execute(
    "INSERT INTO accounts(id,email,password_hash,display_name,account_role,standing,is_active,approval_status) VALUES(?,?,?,?,'domina','veteran',1,'approved')",
    [randomUUID(),email,await hashPassword(body.password),displayName]
   );
   return {status:201,body:{status:'created',message:'Your Domina account is ready. Sign in using the password you just chose.'}};
  }finally{await connection.query("SELECT RELEASE_LOCK('eclipse_order_first_admin')").catch(()=>{});}
 }finally{connection.release();}
}
