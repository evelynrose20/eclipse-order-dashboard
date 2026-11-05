// Non-destructive Eclipse Order Supabase -> local MySQL snapshot.
// All sensitive account passwords must be reset locally; Auth password hashes are NOT copied.
// Source database is opened READ ONLY. Raw feature records remain private in MySQL.
import fs from 'node:fs/promises';
import readline from 'node:readline/promises';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import pg from 'pg';
import {createPool} from 'mysql2/promise';
import {askSecret} from './terminal-secret.js';
import {hashPassword} from './credentials.js';

const {Client}=pg;
if(!process.env.DB_USER||!process.env.DB_PASSWORD)
 throw new Error('Configure DB_USER and DB_PASSWORD in your private server/.env.');
const dbName=process.env.DB_NAME||'eclipse_order';
if(dbName!=='eclipse_order')throw new Error('Migration only supports eclipse_order target.');
const adminName=process.env.MIGRATION_DB_USER||'root';
if(!/^[A-Za-z0-9_]{1,32}$/.test(adminName))throw new Error('Invalid migration admin username.');
const qname=name=>{if(!/^[a-z][a-z0-9_]{0,62}$/.test(name))throw new Error('Invalid source table name.');return '"'+name+'"';};
function charId(source){
 const bytes=Buffer.from(createHash('sha256').update('eclipse-order-character:'+source).digest().subarray(0,16));
 bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
 const s=bytes.toString('hex');return [s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-');
}
const sourceRole=role=>['domina','high_command','handler','member'].includes(role)?role:role==='admin'?'high_command':'member';
const sourceStanding=s=>['initiate','associate','established','veteran'].includes(String(s).toLowerCase())?String(s).toLowerCase():'initiate';
const rank=s=>String(s).toLowerCase().includes('rank iv')?'rank_iv':String(s).toLowerCase().includes('rank iii')?'rank_iii':String(s).toLowerCase().includes('rank ii')?'rank_ii':'rank_i';
const unpack=value=>typeof value==='string'?JSON.parse(value):value;
async function main(){
 const sourceUrl=process.env.SUPABASE_DATABASE_URL || await askSecret('Supabase PostgreSQL connection URI (hidden, not saved): ');
 let url;
 try{url=new URL(sourceUrl);}catch{throw new Error('Invalid PostgreSQL connection URI.');}
 if(!['postgres:','postgresql:'].includes(url.protocol)||! /(^|\.)(supabase\.co|supabase\.com)$/.test(url.hostname))
  throw new Error('Source must be a Supabase PostgreSQL host.');
 const adminPassword=await askSecret('Local MySQL administrator password (hidden): ');
 const source=new Client({connectionString:sourceUrl,application_name:'eclipse_order_migration'});
 const options={host:'127.0.0.1',port:Number(process.env.DB_PORT||3306),database:dbName};
 const admin=createPool({...options,user:adminName,password:adminPassword,connectionLimit:1,multipleStatements:true});
 const local=createPool({...options,user:process.env.DB_USER,password:process.env.DB_PASSWORD,connectionLimit:2});
 let started=false,runId=null;
 try{
  // Fixed, committed schema files: creates session table and lossless snapshot tables.
  for(const file of ['002_sessions.sql','003_supabase_snapshot.sql']){
   await admin.query(await fs.readFile(new URL('../sql/'+file,import.meta.url),'utf8'));
  }
  await source.connect();
  await source.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  started=true;
  const result=await source.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND (table_name='characters' OR table_name LIKE 'order_%') ORDER BY table_name");
  const tables=result.rows.map(r=>r.table_name).filter(name=>/^(characters|order_[a-z0-9_]+)$/.test(name));
  if(!tables.includes('characters')||!tables.includes('order_members'))throw new Error('Wrong source: mandatory Eclipse Order tables missing.');
  const [a]=await local.query('SELECT COUNT(*) AS n FROM accounts');
  const [c]=await local.query('SELECT COUNT(*) AS n FROM characters');
  if(Number(a[0].n)!==0||Number(c[0].n)!==0)
   throw new Error('Local accounts or characters already exist. Aborted to prevent collisions; no existing data deleted.');
  const counts=[];let total=0;
  for(const name of tables){
   const n=Number((await source.query('SELECT COUNT(*)::bigint AS n FROM public.'+qname(name))).rows[0].n);
   counts.push({name,n});total+=n;
  }
  console.log('Supabase: '+tables.length+' Eclipse Order tables; '+total+' rows.');
  if(process.env.MIGRATION_CONFIRM!=='YES'){
   const rl=readline.createInterface({input:process.stdin,output:process.stdout});
   let answer;
   try{answer=await rl.question('Type MIGRATE to copy this snapshot to local MySQL (anything else cancels): ');}
   finally{rl.close();}
   if(answer.trim()!=='MIGRATE')throw new Error('Cancelled before copying; Supabase data was not changed.');
  }
  runId=randomUUID();
  await local.execute('INSERT INTO migration_runs(id,source_tables,source_rows) VALUES(?,?,?)',[runId,tables.length,total]);
  for(const {name,n} of counts){
   let offset=0;
   while(offset<n){
    const page=(await source.query('SELECT * FROM public.'+qname(name)+' ORDER BY ctid LIMIT $1 OFFSET $2',[100,offset])).rows;
    if(!page.length)throw new Error('Source count changed while copying '+name);
    const values=page.map((r,i)=>[runId,name,offset+i+1,JSON.stringify(r)]);
    await local.query('INSERT INTO migration_source_rows(run_id,source_table,row_number,payload_json) VALUES '+values.map(()=>'(?,?,?,?)').join(','),values.flat());
    offset+=page.length;
   }
   await local.execute('INSERT INTO migration_source_counts(run_id,source_table,expected_rows,imported_rows) VALUES(?,?,?,?)',[runId,name,n,offset]);
   if(offset!==n)throw new Error('Count mismatch '+name);
   console.log('Copied '+name+': '+offset+'/'+n);
  }
  // Copy approved member identities, but no Supabase Auth password hashes or sessions.
  const members=(await source.query('SELECT m.user_id,m.role,m.standing,u.email FROM public.order_members m JOIN auth.users u ON u.id=m.user_id ORDER BY m.user_id')).rows;
  const approved=new Set(members.map(m=>m.user_id));
  for(const m of members){
   const email=String(m.email||'').trim().toLowerCase();
   if(!email||email.length>254)throw new Error('Missing email for approved user.');
   const disabledPasswordHash=await hashPassword(randomBytes(48).toString('base64url'));
   await local.execute('INSERT INTO accounts(id,email,password_hash,display_name,account_role,standing) VALUES(?,?,?,?,?,?)',
    [m.user_id,email,disabledPasswordHash,email.split('@')[0].slice(0,80),sourceRole(m.role),sourceStanding(m.standing)]);
  }
  const [characters]=await local.execute("SELECT payload_json FROM migration_source_rows WHERE run_id=? AND source_table='characters' ORDER BY row_number",[runId]);
  for(const raw of characters){
   const c=unpack(raw.payload_json),data=unpack(c.data)||{};
   if(typeof c.id!=='string'||c.id.length>255)throw new Error('Invalid source character ID.');
   const id=charId(c.id),bound=Boolean(c.collar_bound);
   await local.execute('INSERT INTO migration_character_ids(source_character_id,local_character_id) VALUES(?,?)',[c.id,id]);
   await local.execute('INSERT INTO characters(id,character_name,player_account_id,handler_account_id,collar_bound,bound_rank,sheet_json) VALUES(?,?,?,?,?,?,?)',
    [id,String(data.name||c.id).slice(0,120),approved.has(c.player_user_id)?c.player_user_id:null,approved.has(c.handler_user_id)?c.handler_user_id:null,bound?1:0,bound?rank(data.rank):null,JSON.stringify(data)]);
  }
  const [[verification]]=await local.execute('SELECT COUNT(*) AS n FROM migration_source_rows WHERE run_id=?',[runId]);
  if(Number(verification.n)!==total)throw new Error('Imported source row count does not match the source.');
  const [[records]]=await local.query('SELECT (SELECT COUNT(*) FROM accounts) AS members, (SELECT COUNT(*) FROM characters) AS characters');
  if(Number(records.members)!==members.length||Number(records.characters)!==characters.length)throw new Error('Core mapping row counts mismatch.');
  await local.execute("UPDATE migration_runs SET status='complete',completed_at=UTC_TIMESTAMP() WHERE id=?",[runId]);
  await source.query('COMMIT');started=false;
  console.log('Snapshot verification passed: '+total+' rows across '+tables.length+' tables.');
  console.log('Mapped '+records.members+' accounts and '+records.characters+' characters.');
  console.log('Account passwords require a new local password. Supabase and production site remain unchanged.');
  console.log('Do NOT enable Cloudflare routing: remaining feature APIs and permissions still need porting.');
 }catch(error){
  if(runId)await local.execute("UPDATE migration_runs SET status='failed',note=? WHERE id=?",[String(error.message).slice(0,255),runId]).catch(()=>{});
  if(started)await source.query('ROLLBACK').catch(()=>{});
  throw error;
 }finally{
  await source.end().catch(()=>{});
  await local.end().catch(()=>{});
  await admin.end().catch(()=>{});
 }
}
main().catch(err=>{console.error('Migration stopped:',err.message);process.exitCode=1;});
