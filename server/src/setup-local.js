import {createPool} from 'mysql2/promise';
import {readFile} from 'node:fs/promises';
import {askSecret} from './terminal-secret.js';
async function main(){
 if(!process.env.DB_USER||!process.env.DB_PASSWORD)throw new Error('Set DB_USER and DB_PASSWORD in your private server/.env.');
 const adminName=process.env.MIGRATION_DB_USER||'root';
 const adminPassword=await askSecret('Local MySQL administrator password (hidden): ');
 const pool=createPool({host:'127.0.0.1',port:Number(process.env.DB_PORT||3306),
  database:'eclipse_order',user:adminName,password:adminPassword,connectionLimit:1,multipleStatements:true});
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
  // Additive migration is safe for existing accounts and characters; never drops data.
  const features=await readFile(new URL('../sql/005_features.sql',import.meta.url),'utf8');
  await pool.query(features);
  const syndicateRanks=await readFile(new URL('../sql/007_syndicate_ranks.sql',import.meta.url),'utf8');
  await pool.query(syndicateRanks);
  const eventXp=await readFile(new URL('../sql/008_event_xp.sql',import.meta.url),'utf8');
  await pool.query(eventXp);
  const freeMap=await readFile(new URL('../sql/009_free_map_and_statblocks.sql',import.meta.url),'utf8');
  await pool.query(freeMap);
  const homebrew=await readFile(new URL('../sql/010_homebrew_classes.sql',import.meta.url),'utf8');
  await pool.query(homebrew);
  const story=await readFile(new URL('../sql/011_event_story.sql',import.meta.url),'utf8');
  await pool.query(story);
  const archive=await readFile(new URL('../sql/012_encounter_archives.sql',import.meta.url),'utf8');
  await pool.query(archive);
  const npcAllies=await readFile(new URL('../sql/013_npc_allies.sql',import.meta.url),'utf8');
  await pool.query(npcAllies);
  const discord=await readFile(new URL('../sql/014_discord_oauth.sql',import.meta.url),'utf8');
  await pool.query(discord);
  const guildMembership=await readFile(new URL('../sql/015_discord_membership.sql',import.meta.url),'utf8');
  await pool.query(guildMembership);
  const hierarchy=await readFile(new URL('../sql/016_order_hierarchy.sql',import.meta.url),'utf8');
  await pool.query(hierarchy);
  const [[count]]=await pool.query('SELECT COUNT(*) AS n FROM accounts');
  if(Number(count.n)>0){console.log('Schema ready. Existing accounts were not changed.');return;}
  console.log('Database schema ready. First authenticate with Discord and use the local owner promotion command.');
 }finally{await pool.end();}
}
main().catch(e=>{console.error('Setup failed:',e.message);process.exitCode=1;});
