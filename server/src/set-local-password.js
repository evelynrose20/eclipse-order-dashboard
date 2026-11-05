// Local-only account password reset CLI. No public reset endpoint exists.
// Requires access to server/.env on the same Windows PC hosting the database.
import readline from 'node:readline/promises';
import {createPool} from 'mysql2/promise';
import {askSecret} from './terminal-secret.js';
import {hashPassword,normalizeEmail,validPassword} from './credentials.js';

async function main(){
 if(!process.stdin.isTTY)throw new Error('Run in a local interactive terminal.');
 if(!process.env.DB_USER||!process.env.DB_PASSWORD)throw new Error('Local MySQL credentials are missing in server/.env.');
 const reader=readline.createInterface({input:process.stdin,output:process.stdout});
 let email;
 try{email=normalizeEmail(await reader.question('Existing migrated account email: '));}
 finally{reader.close();}
 if(!email)throw new Error('Invalid email.');
 const password=await askSecret('New local password (hidden, 16+ characters): ');
 const confirm=await askSecret('Confirm password (hidden): ');
 if(!validPassword(password)||password!==confirm)throw new Error('Password invalid or confirmation mismatch.');
 const pool=createPool({
  host:'127.0.0.1',port:Number(process.env.DB_PORT||3306),
  user:process.env.DB_USER,password:process.env.DB_PASSWORD,
  database:process.env.DB_NAME||'eclipse_order',connectionLimit:1
 });
 try{
  const [result]=await pool.execute('UPDATE accounts SET password_hash=? WHERE email=? AND is_active=1',
   [await hashPassword(password),email]);
  if(result.affectedRows!==1)throw new Error('No active local account found for that email.');
  await pool.execute('UPDATE account_sessions SET revoked_at=UTC_TIMESTAMP() WHERE account_id=(SELECT id FROM accounts WHERE email=?) AND revoked_at IS NULL',[email]);
  console.log('Local password updated; all previous sessions for this account were revoked.');
 }finally{await pool.end();}
}
main().catch(error=>{console.error('Local password update failed:',error.message);process.exitCode=1;});
