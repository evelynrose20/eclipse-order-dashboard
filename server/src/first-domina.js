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
 // Discord-only authentication: new Domina ownership is assigned through a local CLI after Discord registration.
 return error(403,'discord_only_registration');
}
