import {checkGuildMember,guildConfiguration} from './discord-guild.js';
// Revoke website access without deleting accounts, characters or audit history.
export async function revokeAccountAccess(db,id,{actorId=null,reason='staff_removed'}={}){
 const [[target]]=await db.execute('SELECT id,account_role,is_active,approval_status FROM accounts WHERE id=? FOR UPDATE',[id]);
 if(!target)return {status:404,error:'account_not_found'};
 if(!Number(target.is_active)&&target.approval_status!=='approved')return {status:200,already_revoked:true};
 if(target.account_role==='domina'){
  const [[remaining]]=await db.execute("SELECT COUNT(*) AS total FROM accounts WHERE account_role='domina' AND id<>? AND is_active=1 AND approval_status='approved'",[id]);
  if(!Number(remaining.total))return {status:409,error:'cannot_remove_last_domina'};
 }
 await db.execute("UPDATE accounts SET is_active=0,approval_status='rejected' WHERE id=?",[id]);
 await db.execute('UPDATE account_sessions SET revoked_at=UTC_TIMESTAMP() WHERE account_id=? AND revoked_at IS NULL',[id]);
 await db.execute('INSERT INTO audit_log(actor_account_id,action,entity_type,entity_id,details_json) VALUES(?,?,?,?,?)',[actorId,'account_access_revoked','account',id,JSON.stringify({reason})]);
 return {status:200};
}
export async function revokeMissingDiscordMember(pool,id,{reason='discord_membership_lost'}={}){
 const db=await pool.getConnection();
 try{
  await db.beginTransaction();
  const result=await revokeAccountAccess(db,id,{actorId:null,reason});
  if(result.status===200)await db.commit();else await db.rollback();
  return result;
 }catch(error){await db.rollback().catch(()=>{});throw error}
 finally{db.release()}
}

let reconciliationRunning=false;
// Checks approved accounts even if they never make another API request.
// Discord API failures and temporary screening do not deactivate accounts.
export async function reconcileDiscordAccounts(pool,{checkMembership=checkGuildMember,limit=200}={}){
 if(reconciliationRunning||!guildConfiguration(process.env))return {checked:0,revoked:0,skipped:true};
 reconciliationRunning=true;
 try{
  const [accounts]=await pool.execute("SELECT a.id,l.discord_user_id FROM accounts a JOIN account_discord_links l ON l.account_id=a.id WHERE a.is_active=1 AND a.approval_status='approved' ORDER BY a.created_at DESC LIMIT ?",[limit]);
  let revoked=0;
  for(let i=0;i<accounts.length;i+=5){
   const results=await Promise.all(accounts.slice(i,i+5).map(async account=>{
    const status=await checkMembership(account.discord_user_id);
    if(status!=='not_member')return false;
    const result=await revokeMissingDiscordMember(pool,account.id);
    return result.status===200&&!result.already_revoked;
   }));
   revoked+=results.filter(Boolean).length;
  }
  return {checked:accounts.length,revoked};
 }finally{reconciliationRunning=false}
}
