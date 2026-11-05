import http from 'node:http';
import {createPool} from 'mysql2/promise';
import {authRoute} from './auth.js';
import {accountRoute} from './accounts.js';
import {firstDominaRoute} from './first-domina.js';

const host='127.0.0.1'; // Deliberately localhost-only. Never bind 0.0.0.0.
const port=Number(process.env.API_PORT||3182);
const isPublic=process.env.API_PUBLIC_ENABLED==='true';
// Use the exact Vite origin for localhost development when no value was configured.
// Public operation must always specify an explicit HTTPS origin.
const allowedOrigin=process.env.API_ALLOWED_ORIGIN||(!isPublic?'http://localhost:5173':'');
if(isPublic&&!/^https:\/\/[a-z0-9.-]+$/.test(allowedOrigin))throw new Error('Public API requires an explicit HTTPS API_ALLOWED_ORIGIN.');
const publicHost=isPublic?(process.env.API_PUBLIC_HOST||'').toLowerCase():'';
if(publicHost&&!/^api[.][a-z0-9.-]+$/.test(publicHost))throw new Error('Invalid API_PUBLIC_HOST.');
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
 const hostHeader=(req.headers.host||'').toLowerCase();
 // IMPORTANT: Even when a tunnel is Healthy, reject traffic routed under an external Host header.
 // Login is for local PowerShell testing ONLY until the public API is completed and reviewed.
 const permittedHosts=new Set(['localhost:'+port,'127.0.0.1:'+port]);
 if(publicHost&&allowedOrigin.startsWith('https://'))permittedHosts.add(publicHost);
 if(!permittedHosts.has(hostHeader)){
  res.writeHead(403,{'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify({error:'local_only'}));return;
 }
 if(origin&&origin!==allowedOrigin){
  res.writeHead(403,{'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify({error:'origin_not_allowed'}));return;
 }
 const cors=origin===allowedOrigin&&origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{};
 if(req.method==='OPTIONS'&&origin===allowedOrigin){
  res.writeHead(204,{...cors,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization','Cache-Control':'no-store'});
  res.end();return;
 }
 let result;
 try{
  if(pathname==='/auth/setup-domina'||pathname==='/auth/setup-status')result=await firstDominaRoute(pool,req,pathname,{publicEnabled:isPublic,allowedOrigin});
  else if(pathname==='/auth/register'||pathname.startsWith('/admin/'))result=await accountRoute(pool,req,pathname);
  else if(pathname.startsWith('/auth/'))result=await authRoute(pool,req,pathname);
  else if(pathname==='/ready'&&req.method==='GET')result=await readiness();
  else result=buildResponse(pathname,req.method,()=>({status:503,body:{status:'not_ready'}}));
 }catch(error){
  if(error?.status===400||error?.status===413)result={status:error.status,body:{error:error.message}};
  else{
   console.error('[Eclipse Order API] Request failed:',error?.code||'internal_error');
   result={status:500,body:{error:'internal_error'}};
  }
 }
 res.writeHead(result.status,{
  ...cors,
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer',
  'X-Frame-Options':'DENY'
 });
 res.end(result.body===null?'':JSON.stringify(result.body));
});
server.requestTimeout=5000;
server.headersTimeout=5000;
server.listen(port,host,()=>{
  console.log('[Eclipse Order API] Local bootstrap listening at http://127.0.0.1:'+port);
  console.log('[Eclipse Order API] /health checks the HTTP server. /ready checks the database.');
  console.log('[Eclipse Order API] Allowed website origin: '+allowedOrigin);
 console.log('[Eclipse Order API] Local auth test enabled; Cloudflare/public routing must remain OFF.');
});
const close=async()=>{
  server.close();
  if(pool) await pool.end().catch(()=>{});
};
process.on('SIGINT',()=>void close());
process.on('SIGTERM',()=>void close());
