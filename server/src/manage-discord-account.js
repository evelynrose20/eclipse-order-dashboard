// Windows-only administrator recovery for pre-existing accounts after Discord-only cutover.
// Run locally with access to the private database environment, never as a web endpoint.
import {createPool} from 'mysql2/promise';
import {validSnowflake} from './discord-guild.js';

const [operation,identifier,discordId]=process.argv.slice(2);
const valid=['link','owner','inspect','restore-domina'].includes(operation);
if(!valid||!validSnowflake(['owner','inspect'].includes(operation)?identifier:discordId)||(['link','restore-domina'].includes(operation)&&(!identifier||identifier.length>254))){
 console.error('Usage: npm run discord:account -- link account-email discord-user-id');
 console.error('   or: npm run discord:account -- inspect discord-user-id (read only)');
 console.error('   or: npm run discord:account -- restore-domina original-account-email discord-user-id');
 console.error('   or: npm run discord:account -- owner discord-user-id (only if there is no active Domina)');
 process.exitCode=2;
}else if(!process.env.DB_USER||!process.env.DB_PASSWORD){
 console.error('Database credentials are not configured in server/.env');process.exitCode=2;
}else{
 const pool=createPool({host:'127.0.0.1',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME||'eclipse_order',connectionLimit:1});
 const conn=await pool.getConnection();
 try{
  await conn.beginTransaction();
  if(operation==='inspect'){
   const [rows]=await conn.execute(
    'SELECT a.id,a.email,a.display_name,a.account_role,a.is_active,a.approval_status,l.discord_user_id FROM account_discord_links l JOIN accounts a ON a.id=l.account_id WHERE l.discord_user_id=? LIMIT 1',
    [identifier]);
   if(!rows.length)console.log('No Order account is linked to this Discord ID in this database.');
   else{
    const row=rows[0];
    console.log('Linked account:',row.id);
    console.log('Email:',row.email);
    console.log('Display name:',row.display_name);
    console.log('Role:',row.account_role);
    console.log('Active:',Number(row.is_active)===1?'yes':'no');
    console.log('Approval:',row.approval_status);
   }
   const [owners]=await conn.execute("SELECT id,email,is_active,approval_status FROM accounts WHERE account_role='domina' ORDER BY created_at LIMIT 10");
   console.log('Existing Domina records:',owners.map(o=>({id:o.id,email:o.email,active:Number(o.is_active)===1,approval:o.approval_status})));
  }else if(operation==='restore-domina'){
   // Local-only recovery. Require both existing Domina account and exact pre-linked Discord ID.
   // Never elevate an applicant/member or choose a Domina from a supplied Discord ID alone.
   const [accounts]=await conn.execute('SELECT id,account_role,is_active,approval_status FROM accounts WHERE email=? LIMIT 1 FOR UPDATE',[identifier.trim().toLowerCase()]);
   if(accounts.length!==1||accounts[0].account_role!=='domina')
    throw Error('This email is not an existing Domina account in this database. Nothing was changed.');
   const [links]=await conn.execute('SELECT discord_user_id FROM account_discord_links WHERE account_id=? LIMIT 1 FOR UPDATE',[accounts[0].id]);
   if(links.length!==1||links[0].discord_user_id!==discordId)
    throw Error('This Domina is not linked to that Discord ID. Nothing was changed.');
   const [otherOwners]=await conn.execute("SELECT id FROM accounts WHERE account_role='domina' AND id<>? AND is_active=1 AND approval_status='approved' LIMIT 1 FOR UPDATE",[accounts[0].id]);
   if(otherOwners.length)throw Error('Another active approved Domina exists. Nothing was changed.');
   if(Number(accounts[0].is_active)===1&&accounts[0].approval_status==='approved')
    console.log('The existing Domina is already active and approved. Nothing was changed. If the website still shows pending, verify it uses this same database and the updated API.');
   else{
    await conn.execute("UPDATE accounts SET is_active=1,approval_status='approved' WHERE id=? AND account_role='domina'",[accounts[0].id]);
    console.log('Restored the existing Domina account to active and approved. No roles or characters were changed.');
   }
  }else if(operation==='link'){
   const [accounts]=await conn.execute('SELECT id,display_name FROM accounts WHERE email=? LIMIT 1 FOR UPDATE',[identifier.trim().toLowerCase()]);
   if(!accounts.length)throw Error('No existing account has that email.');
   const target=accounts[0].id;
   const [targetLinks]=await conn.execute('SELECT discord_user_id FROM account_discord_links WHERE account_id=? LIMIT 1 FOR UPDATE',[target]);
   if(targetLinks.length){
    if(targetLinks[0].discord_user_id===discordId){
     console.log('This Discord identity already belongs to the selected existing account. Nothing was changed.');
    }else throw Error('The selected existing account is linked to a different Discord identity. Nothing was changed.');
   }else{
    const [linked]=await conn.execute('SELECT account_id FROM account_discord_links WHERE discord_user_id=? LIMIT 1 FOR UPDATE',[discordId]);
    if(!linked.length){
     await conn.execute('INSERT INTO account_discord_links(account_id,discord_user_id,discord_username) VALUES(?,?,?)',[target,discordId,'Linked by local administrator']);
    }else{
     // OAuth may have created a fresh pending applicant for this exact Discord identity.
     // Only that disposable application may be reattached; never steal an established account.
     const source=linked[0].account_id;
     const [applicants]=await conn.execute('SELECT id,email,account_role,is_active,approval_status FROM accounts WHERE id=? LIMIT 1 FOR UPDATE',[source]);
     const applicant=applicants[0];
     if(!applicant||applicant.account_role!=='member'||Number(applicant.is_active)!==0||
        applicant.approval_status!=='pending'||applicant.email!=='discord-'+discordId+'@members.eclipse.invalid')
      throw Error('Discord is linked to an established account. Nothing was changed.');
     const [characterRows]=await conn.execute('SELECT id FROM characters WHERE player_account_id=? OR handler_account_id=? LIMIT 1',[source,source]);
     if(characterRows.length)throw Error('The pending account has characters; manual reconciliation is required. Nothing was changed.');
     await conn.execute('UPDATE account_discord_links SET account_id=?,discord_username=? WHERE account_id=? AND discord_user_id=?',
      [target,'Recovered by local administrator',source,discordId]);
     await conn.execute('DELETE FROM discord_oauth_tickets WHERE account_id=?',[source]);
     await conn.execute('UPDATE account_sessions SET revoked_at=UTC_TIMESTAMP() WHERE account_id=? AND revoked_at IS NULL',[source]);
    }
    console.log('Discord is now connected to the existing Order account. Existing characters and account privileges were preserved.');
   }
  }else{
   const [owners]=await conn.execute("SELECT id FROM accounts WHERE account_role='domina' AND is_active=1 AND approval_status='approved' LIMIT 1 FOR UPDATE");
   if(owners.length)throw Error('An active Domina already exists. Promotion was refused.');
   const [links]=await conn.execute('SELECT account_id FROM account_discord_links WHERE discord_user_id=? LIMIT 1',[identifier]);
   if(!links.length)throw Error('Sign in with Discord once to request membership before assigning the first Domina.');
   await conn.execute("UPDATE accounts SET account_role='domina',syndicate_rank='domina',standing='veteran',is_active=1,approval_status='approved' WHERE id=?",[links[0].account_id]);
   console.log('The first Domina was approved. Discord membership is still required for portal access.');
  }
  await conn.commit();
 }catch(error){await conn.rollback();console.error('No change:',error.message);process.exitCode=1}
 finally{conn.release();await pool.end()}
}
