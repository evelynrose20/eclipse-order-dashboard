import {createPool} from 'mysql2/promise';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';

// Read-only local maintenance command. Never expose this through the public API.
export function trackedMigrationVersions(setupSource,sqlSources) {
 const seen=new Set();
 const expected=[];
 for(const match of setupSource.matchAll(/\.\.\/sql\/([a-z0-9_-]+\.sql)/gi)){
  const name=match[1];
  const version=name.slice(0,-4);
  if(seen.has(version))continue;
  seen.add(version);
  const source=sqlSources[name]||'';
  if(/\bschema_migrations\b/i.test(source) && source.includes("'"+version+"'"))
   expected.push(version);
 }
 return expected;
}
export function compareMigrationVersions(expected,installed) {
 const known=new Set(installed);
 const missing=expected.filter(v=>!known.has(v));
 return {
  status:missing.length?'update_available':'current',
  pending:missing.length,
  missing,
  latest:expected.at(-1)||null,
  checked:expected.length
 };
}
export async function statusWithPool(pool,setupSource,sqlSources){
 const expected=trackedMigrationVersions(setupSource,sqlSources);
 if(!expected.length)throw new Error('No tracked SQL migration records were found.');
 const [rows]=await pool.query('SELECT version FROM schema_migrations');
 return compareMigrationVersions(expected,rows.map(r=>r.version));
}
async function main() {
 const setup=await readFile(new URL('./setup-local.js',import.meta.url),'utf8');
 const dir=fileURLToPath(new URL('../sql/',import.meta.url));
 const sqlSources={};
 for(const name of await readdir(dir)){
  if(/^\d{3}[a-z0-9_-]*\.sql$/i.test(name))
   sqlSources[name]=await readFile(path.join(dir,name),'utf8');
 }
 if(!process.env.DB_USER||!process.env.DB_PASSWORD)throw new Error('Database credentials are not configured.');
 const pool=createPool({
  host:'127.0.0.1',port:Number(process.env.DB_PORT||3306),
  database:process.env.DB_NAME||'eclipse_order',
  user:process.env.DB_USER,password:process.env.DB_PASSWORD,
  connectionLimit:1,connectTimeout:3000
 });
 try{console.log(JSON.stringify(await statusWithPool(pool,setup,sqlSources)))}
 finally{await pool.end()}
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
 main().catch(()=>{console.log(JSON.stringify({status:'unknown',reason:'Database migration status could not be verified.'}));process.exitCode=1;});
