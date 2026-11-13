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
