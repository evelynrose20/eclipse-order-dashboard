import {createPool} from 'mysql2/promise';
import {randomUUID} from 'node:crypto';
import readline from 'node:readline/promises';
import {askSecret} from './terminal-secret.js';
import {hashPassword,normalizeEmail,validPassword} from './credentials.js';
async function main(){
 if(!process.env.DB_USER||!process.env.DB_PASSWORD)throw new Error('Set DB_USER and DB_PASSWORD in your private server/.env.');
 const adminName=process.env.MIGRATION_DB_USER||'root';
 const adminPassword=await askSecret('Local MySQL administrator password (hidden): ');
 const pool=createPool({host:'127.0.0.1',port:Number(process.env.DB_PORT||3306),
  database:'eclipse_order',user:adminName,password:adminPassword,connectionLimit:1});
 try{
  await pool.query("CREATE TABLE IF NOT EXISTS account_sessions ("+
   "id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,"+
   "account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,"+
   "token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,"+
   "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,"+
   "expires_at DATETIME NOT NULL,revoked_at DATETIME NULL,"+
   "UNIQUE KEY uq_session_hash(token_hash),KEY ix_sessions_account(account_id,expires_at),"+
   "CONSTRAINT fk_sessions_account FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE"+
   ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  const [cols]=await pool.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='eclipse_order' AND TABLE_NAME='accounts' AND COLUMN_NAME='approval_status'");
  if(!cols.length)await pool.query("ALTER TABLE accounts ADD COLUMN approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved'");
  const [indexes]=await pool.query("SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='eclipse_order' AND TABLE_NAME='accounts' AND INDEX_NAME='ix_accounts_approval'");
  if(!indexes.length)await pool.query('CREATE INDEX ix_accounts_approval ON accounts(approval_status,created_at)');
  await pool.query("INSERT INTO schema_migrations(version) VALUES('002_sessions'),('004_registration') ON DUPLICATE KEY UPDATE version=VALUES(version)");
  const [[count]]=await pool.query('SELECT COUNT(*) AS n FROM accounts');
  if(Number(count.n)>0){console.log('Schema ready. Existing accounts were not changed.');return;}
  const rl=readline.createInterface({input:process.stdin,output:process.stdout});
  let email,name;
  try{email=normalizeEmail(await rl.question('First Domina email: '));name=(await rl.question('Domina display name: ')).trim();}
  finally{rl.close();}
  if(!email||name.length<2||name.length>80)throw new Error('Invalid email or display name.');
  const password=await askSecret('New Domina password (16+ characters, hidden): ');
  const repeat=await askSecret('Confirm password (hidden): ');
  if(!validPassword(password)||password!==repeat)throw new Error('Password invalid or confirmation mismatch.');
  await pool.execute("INSERT INTO accounts(id,email,password_hash,display_name,account_role,standing,is_active,approval_status) VALUES(?,?,?,?,'domina','veteran',1,'approved')",
   [randomUUID(),email,await hashPassword(password),name]);
  console.log('Eclipse Order schema and first Domina login created.');
 }finally{await pool.end();}
}
main().catch(e=>{console.error('Setup failed:',e.message);process.exitCode=1;});
