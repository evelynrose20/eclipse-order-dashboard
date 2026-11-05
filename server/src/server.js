import http from 'node:http';
import {createPool} from 'mysql2/promise';

const host='127.0.0.1'; // Deliberately localhost-only. Never bind 0.0.0.0.
const port=Number(process.env.API_PORT||3182);
if (!Number.isInteger(port) || port<1024 || port>65535) throw new Error('Invalid API_PORT.');
const dbReady=Boolean(process.env.DB_USER&&process.env.DB_PASSWORD);
const pool=dbReady?createPool({
  host:'127.0.0.1',
  port:Number(process.env.DB_PORT||3306),
  user:process.env.DB_USER,
  password:process.env.DB_PASSWORD,
  database:process.env.DB_NAME||'eclipse_order',
  waitForConnections:true,
  connectionLimit:2,
  connectTimeout:3500,
  enableKeepAlive:true
}):null;

export function buildResponse(path, method, checkDb) {
  if(method!=='GET') return {status:405,body:{status:'method_not_allowed'}};
  if(path==='/health') return {status:200,body:{status:'ok',service:'eclipse-order-local-api',mode:'bootstrap',database:'not_checked'}};
  if(path==='/ready') return checkDb();
  return {status:404,body:{status:'not_found'}};
}
export async function readiness(){
  if(!pool) return {status:503,body:{status:'not_ready',reason:'database_credentials_not_configured'}};
  try{
    const [rows]=await pool.query('SELECT DATABASE() AS db');
    if(rows[0]?.db!==(process.env.DB_NAME||'eclipse_order')) return {status:503,body:{status:'not_ready',reason:'unexpected_database'}};
    return {status:200,body:{status:'ready',database:'connected'}};
  }catch{
    // Never send database error messages, credentials, server version or SQL details to clients.
    return {status:503,body:{status:'not_ready',reason:'database_unavailable'}};
  }
}

const server=http.createServer(async(req,res)=>{
  const pathname=(req.url||'').split('?')[0];
  const origin=req.headers.origin;
  // This API is for local bootstrap only; do not enable CORS for browsers yet.
  if(origin){res.writeHead(403,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({status:'forbidden'}));return;}
  const result=pathname==='/ready'&&req.method==='GET'?await readiness():buildResponse(pathname,req.method,()=>({status:503,body:{status:'not_ready'}}));
  res.writeHead(result.status,{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff'
  });
  res.end(JSON.stringify(result.body));
});
server.requestTimeout=5000;
server.headersTimeout=5000;
server.listen(port,host,()=>{
  console.log('[Eclipse Order API] Local bootstrap listening at http://127.0.0.1:'+port);
  console.log('[Eclipse Order API] /health checks the HTTP server. /ready checks the database.');
  console.log('[Eclipse Order API] Cloudflare/public routing must remain OFF until auth is implemented.');
});
const close=async()=>{
  server.close();
  if(pool) await pool.end().catch(()=>{});
};
process.on('SIGINT',()=>void close());
process.on('SIGTERM',()=>void close());
