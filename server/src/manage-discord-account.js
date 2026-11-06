// Windows-only administrator recovery for pre-existing accounts after Discord-only cutover.
// Run locally with access to the private database environment, never as a web endpoint.
import {createPool} from 'mysql2/promise';
import {validSnowflake} from './discord-guild.js';

const [operation,identifier,discordId]=process.argv.slice(2);
const valid=operation==='link'||operation==='owner';
if(!valid||!validSnowflake(operation==='owner'?identifier:discordId)||operation==='link'&&(!identifier||identifier.length>254)){
 console.error('Usage: npm run discord:account -- link account-email discord-user-id');
 console.error('   or: npm run discord:account -- owner discord-user-id (only if there is no active Domina)');
 process.exitCode=2;
}else if(!process.env.DB_USER||!process.env.DB_PASSWORD){
 console.error('Database credentials are not configured in server/.env');process.exitCode=2;
}else{
 const pool=createPool({host:'127.0.0.1',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME||'eclipse_order',connectionLimit:1});
 const conn=await pool.getConnection();
 try{
  await conn.beginTransaction();
  if(operation==='link'){
   const [accounts]=await conn.execute('SELECT id,display_name FROM accounts WHERE email=? LIMIT 1 FOR UPDATE',[identifier.trim().toLowerCase()]);
   if(!accounts.length)throw Error('No existing account has that email.');
   const [other]=await conn.execute('SELECT account_id FROM account_discord_links WHERE discord_user_id=? OR account_id=? LIMIT 1',[discordId,accounts[0].id]);
   if(other.length)throw Error('This Discord identity or Order account is already linked. Nothing was changed.');
   await conn.execute('INSERT INTO account_discord_links(account_id,discord_user_id,discord_username) VALUES(?,?,?)',[accounts[0].id,discordId,'Linked by local administrator']);
   console.log('Linked the existing account to its Discord identity. No characters or permissions were modified.');
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
