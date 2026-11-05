import readline from 'node:readline/promises';
import {randomUUID} from 'node:crypto';
import {createPool} from 'mysql2/promise';
import {hashPassword,normalizeEmail,validPassword} from './credentials.js';
import {askSecret} from './terminal-secret.js';

async function main(){
 if(!process.env.DB_USER||!process.env.DB_PASSWORD)throw new Error('Configure DB_USER and DB_PASSWORD in server/.env first.');
 const rl=readline.createInterface({input:process.stdin,output:process.stdout});
 const email=normalizeEmail(await rl.question('Domina login email: '));
 const displayName=(await rl.question('Domina display name (2–80 characters): ')).trim();
 rl.close();
 if(!email)throw new Error('Enter a valid email address.');
 if(displayName.length<2||displayName.length>80)throw new Error('Invalid display name.');
 const password=await askSecret('Password (16+ characters, hidden): ');
 const confirmation=await askSecret('Confirm password (hidden): ');
 if(!validPassword(password)||password!==confirmation)throw new Error('Password invalid or confirmation did not match.');
 const hash=await hashPassword(password);
 const pool=createPool({
  host:'127.0.0.1',port:Number(process.env.DB_PORT||3306),
  user:process.env.DB_USER,password:process.env.DB_PASSWORD,
  database:process.env.DB_NAME||'eclipse_order',connectionLimit:1
 });
 let connection;
 try{
  connection=await pool.getConnection();
  const [versions]=await connection.query("SELECT version FROM schema_migrations WHERE version IN ('001_core','002_sessions')");
  if(versions.length!==2)throw new Error('Apply SQL migrations 001_core.sql and 002_sessions.sql before creating an account.');
  const [lock]=await connection.query("SELECT GET_LOCK('eclipse_order_first_admin', 10) AS acquired");
  if(lock[0]?.acquired!==1)throw new Error('Could not acquire account bootstrap lock. Try again.');
  try{
   const [counts]=await connection.query('SELECT COUNT(*) AS total FROM accounts');
   if(Number(counts[0].total)!==0)throw new Error('Bootstrap refused: database already contains accounts. This command is only for the very first Domina.');
   await connection.execute('INSERT INTO accounts (id,email,password_hash,display_name,account_role,standing) VALUES (?,?,?,?,?,?)',
    [randomUUID(),email,hash,displayName,'domina','veteran']);
   console.log('First Domina account created successfully. Credentials were not printed or saved to Git.');
  }finally{await connection.query("SELECT RELEASE_LOCK('eclipse_order_first_admin')").catch(()=>{});}
 }finally{if(connection)connection.release();await pool.end();}
}
main().catch(error=>{console.error('Account setup failed:',error.message);process.exitCode=1;});
