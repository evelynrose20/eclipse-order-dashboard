import {runOrderCityResidents} from './world-order-city.js';
import {syncWorkshopBuyOrders} from './workshop-exchange.js';
import http from 'node:http';
import {createPool} from 'mysql2/promise';
import {authRoute} from './auth.js';
import {thrallsRoute} from './thralls.js';
import {recruitmentRoute} from './recruitment.js';
import {venueRoute} from './venue.js';
import {loreRoute} from './lore.js';
import {faqRoute} from './faq.js';
import {discordRoute} from './discord-oauth.js';
import {accountRoute} from './accounts.js';
import {firstDominaRoute} from './first-domina.js';
import {characterRoute} from './characters.js';
import {transitionRoute} from './transitions.js';
import {profileRoute} from './profiles.js';
import {encounterRoute} from './encounters.js';
import {eventRoute} from './events.js';
import {eventXpRoute} from './event-xp.js';
import {diceRoute} from './dice.js';
import {POINT_BUDGET,SCORE_COST} from './progression.js';
import {classRoute} from './class-catalog.js';
import {factionRoute} from './factions.js';
import {worldAdministrationRoute} from './world-administration.js';
import {runSettlementSimulation} from './world-settlement-simulation.js';
import {runIndustryAutomation} from './world-industry-engine.js';
import {runLogisticsAutomation,runNpcTradeAutomation} from './world-logistics.js';
import {internalRailRoute} from './internal-rail.js';
import {craftingRoute} from './crafting.js';
import {constructionRoute} from './construction.js';
import {senateRoute} from './senate.js';
import {senatePoliticsRoute} from './senate-politics.js';
import {governanceRoute} from './governance-live.js';
import {commerceRoute} from './commerce.js';
import {frontsRoute,runFrontDailyExpenses} from './fronts.js';
import {treasuryRoute,runDailyPayroll} from './treasury.js';

const host='127.0.0.1'; // Deliberately localhost-only. Never bind 0.0.0.0.
const port=Number(process.env.API_PORT||3182);
const isPublic=process.env.API_PUBLIC_ENABLED==='true';
// Use the exact Vite origin for localhost development when no value was configured.
// Public operation must always specify an explicit HTTPS origin.
const allowedOrigin=process.env.API_ALLOWED_ORIGIN||(!isPublic?'http://localhost:5173':'');
if(isPublic&&!/^https:\/\/[a-z0-9.-]+$/.test(allowedOrigin))throw new Error('Public API requires an explicit HTTPS API_ALLOWED_ORIGIN.');
const publicHost=isPublic?(process.env.API_PUBLIC_HOST||'').toLowerCase():'';
const localOrigin=process.env.API_LOCAL_ORIGIN||'http://localhost:5173';
if(!/^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}$/.test(localOrigin))throw new Error('API_LOCAL_ORIGIN must be a local HTTP origin.');
if(isPublic&&(!publicHost||!/^api[.][a-z0-9.-]+$/.test(publicHost)))throw new Error('Public API requires explicit API_PUBLIC_HOST.');
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
 const hostHeader=(req.headers.host||'').trim().toLowerCase();
 // HTTPS proxies can preserve the default :443 authority in the Host header.
 const publicRequestHost=isPublic&&(hostHeader===publicHost||hostHeader===publicHost+':443');
 const expectedOrigin=publicRequestHost?allowedOrigin:localOrigin;
 // IMPORTANT: Even when a tunnel is Healthy, reject traffic routed under an external Host header.
 // A published Cloudflare route is accepted only after explicit public mode configuration.
 const permittedHosts=new Set(['localhost:'+port,'127.0.0.1:'+port]);
 if(isPublic&&publicHost&&allowedOrigin.startsWith('https://')){
  permittedHosts.add(publicHost);
  permittedHosts.add(publicHost+':443');
 }
 if(!permittedHosts.has(hostHeader)){
  // Log only the rejected hostname and public-mode state; never print cookies or credentials.
  console.warn('[Eclipse Order API] Rejected Host:',hostHeader||'(missing)','public mode:',isPublic?'enabled':'disabled');
  res.writeHead(403,{'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify({error:'local_only'}));return;
 }
 if(origin&&origin!==expectedOrigin){
  res.writeHead(403,{'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify({error:'origin_not_allowed'}));return;
 }
 const cors=origin===expectedOrigin&&origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{};
 // The server intentionally never exposes bootstrap or raw DB status on the public host.
 if(publicRequestHost&&['/auth/setup-status','/auth/setup-domina','/ready'].includes(pathname)){
  res.writeHead(404,{'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify({error:'not_found'}));return;
 }
 if(req.method==='OPTIONS'&&origin===expectedOrigin){
  res.writeHead(204,{...cors,'Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization','Cache-Control':'no-store'});
  res.end();return;
 }
 let result;
 try{
  if(pathname==='/faq'||pathname.startsWith('/faq/'))result=await faqRoute(pool,req,pathname);
  else if(pathname==='/lore'||pathname==='/lore/public'||pathname.startsWith('/lore/'))result=await loreRoute(pool,req,pathname);
  else if(pathname==='/recruitment')result=await recruitmentRoute(pool,req,pathname);
  else if(pathname==='/venue/public'||pathname==='/venue/manage'||pathname==='/venue/upload'||pathname.startsWith('/venue/images/'))result=await venueRoute(pool,req,pathname);
  else if(pathname==='/progression/classes'&&req.method==='GET')result={status:200,body:{point_budget:POINT_BUDGET,score_cost:SCORE_COST}};
  else if(pathname==='/classes'||pathname.startsWith('/classes/'))result=await classRoute(pool,req,pathname);
  else if(pathname==='/auth/setup-domina'||pathname==='/auth/setup-status')result=await firstDominaRoute(pool,req,pathname,{publicEnabled:isPublic,allowedOrigin});
  else if(pathname==='/thralls/chamber'||pathname==='/thralls/chamber/actions'||/^\/thralls\/characters\/[0-9a-f-]{36}\/contributions$/.test(pathname))result=await thrallsRoute(pool,req,pathname);
  else if(pathname==='/fronts'||pathname.startsWith('/fronts/'))result=await frontsRoute(pool,req,pathname);
  else if(pathname==='/treasury'||pathname.startsWith('/treasury/'))result=await treasuryRoute(pool,req,pathname);
  else if(pathname==='/commerce'||pathname.startsWith('/commerce/'))result=await commerceRoute(pool,req,pathname);
  else if(pathname==='/governance/council'||pathname.startsWith('/governance/council/'))result=await governanceRoute(pool,req,pathname);
  else if(pathname==='/governance/senate/politics'||pathname.startsWith('/governance/senate/parties')||pathname.startsWith('/governance/senate/elections')||pathname.startsWith('/governance/senate/coalitions'))result=await senatePoliticsRoute(pool,req,pathname);
  else if(pathname==='/governance/senate'||pathname.startsWith('/governance/senate/'))result=await senateRoute(pool,req,pathname);
  else if(pathname==='/construction'||pathname.startsWith('/construction/'))result=await constructionRoute(pool,req,pathname);
  else if(pathname==='/workshop'||pathname.startsWith('/workshop/'))result=await craftingRoute(pool,req,pathname);
  else if(pathname==='/world-admin'||pathname.startsWith('/world-admin/'))result=await worldAdministrationRoute(pool,req,pathname);
  else if(pathname==='/internal-rail'||pathname.startsWith('/internal-rail/'))result=await internalRailRoute(pool,req,pathname);
  else if(pathname==='/factions'||pathname.startsWith('/factions/'))result=await factionRoute(pool,req,pathname);
  else if(pathname==='/characters'||pathname.startsWith('/characters/'))result=await characterRoute(pool,req,pathname);
  else if(pathname==='/transitions'||pathname.startsWith('/transitions/'))result=await transitionRoute(pool,req,pathname);
  else if(pathname.startsWith('/profile/')||pathname==='/settings')result=await profileRoute(pool,req,pathname);
  else if(/^\/events\/[a-f0-9-]{36}\/xp(?:\/[a-f0-9-]{36})?$/.test(pathname))result=await eventXpRoute(pool,req,pathname);
  else if(pathname.startsWith('/events/')||pathname.startsWith('/signups/'))result=await eventRoute(pool,req,pathname);
  else if(pathname==='/monsters'||pathname.startsWith('/monsters/')||pathname.startsWith('/combatants/')||pathname==='/combatants')result=await encounterRoute(pool,req,pathname);
  else if(pathname.startsWith('/roll-requests/')||pathname.startsWith('/rolls/')||/\/encounters\/[a-f0-9-]{36}\/(rolls|roll-requests)$/.test(pathname))result=await diceRoute(pool,req,pathname);
  else if(pathname==='/encounters'||pathname.startsWith('/encounters/'))result=await encounterRoute(pool,req,pathname);
  else if(pathname==='/auth/register'||pathname.startsWith('/admin/'))result=await accountRoute(pool,req,pathname);
  else if(pathname.startsWith('/auth/discord/'))result=await discordRoute(pool,req,pathname,{query:(req.url||'').split('?').slice(1).join('?')});
  else if(pathname.startsWith('/auth/'))result=await authRoute(pool,req,pathname);
  else if(pathname==='/ready'&&req.method==='GET')result=await readiness();
  else result=buildResponse(pathname,req.method,()=>({status:503,body:{status:'not_ready'}}));
 }catch(error){
  if([400,403,413,503].includes(error?.status))result={status:error.status,body:{error:error.message}};
  else{
   console.error('[Eclipse Order API] Request failed:',req.method,pathname,error?.code||error?.name||'internal_error');
   result={status:500,body:{error:'internal_error'}};
  }
 }
 // Route handlers must always return a response; never crash the process on an unmatched route.
 if(result==null){
  console.warn('[Eclipse Order API] Request did not match a handler:',req.method,pathname);
  result={status:404,body:{error:'not_found'}};
 }
 if(result.redirect){
  res.writeHead(302,{'Location':result.redirect,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'});
  res.end();return;
 }
 if(result.rawBody){
  res.writeHead(result.status,{...cors,'Content-Type':result.contentType||'application/octet-stream','Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'});
  res.end(result.rawBody);return;
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
  console.log('[Eclipse Order API] Listening at http://127.0.0.1:'+port);
  console.log('[Eclipse Order API] /health checks the HTTP server. /ready checks the database.');
  console.log('[Eclipse Order API] Public website origin: '+allowedOrigin);
 console.log('[Eclipse Order API] Local website origin: '+localOrigin);
 console.log('[Eclipse Order API] Public routing '+(isPublic?'ENABLED for '+publicHost:'DISABLED')+'.');
});
// Daily fictional payroll is processed by the Windows API, with a persisted cycle key.
 // A restart cannot create duplicate salary, and a brief downtime catches up at most one reset.
let payrollTickRunning=false;
let settlementTickRunning=false;
const settlementTick=async()=>{
 if(!pool||settlementTickRunning)return;
 settlementTickRunning=true;
 try{
  const result=await runSettlementSimulation(pool,new Date());
  const residential=await runOrderCityResidents(pool,new Date());
  if(residential.arrivals)console.log('[Order cities] New residents:',residential.arrivals);
  const industry=await runIndustryAutomation(pool,new Date());
  const freight=await runLogisticsAutomation(pool);
  const npcRelief=await runNpcTradeAutomation(pool);
  if(npcRelief.dispatched||npcRelief.delivered||npcRelief.held)console.log('[NPC relief] Dispatched:',npcRelief.dispatched,'delivered:',npcRelief.delivered,'held:',npcRelief.held);
  if(freight.arrived||freight.disrupted||freight.dispatched)console.log('[World freight] Dispatched:',freight.dispatched,'arrived:',freight.arrived,'awaiting review:',freight.disrupted);
  if(industry.production||industry.construction)console.log('[P3 Industry] Production cycles:',industry.production,'construction:',industry.construction);
  if(result.processed)console.log('[World simulation] Processed',result.processed,'autonomous settlement cycles');
 }catch(error){console.warn('[World simulation] Check unavailable:',error?.code||error?.name||'database_unavailable')}
 finally{settlementTickRunning=false}
};
const payrollTick=async()=>{
 if(!pool||payrollTickRunning)return;
 payrollTickRunning=true;
 try{
  const now=new Date();
  const r=await runDailyPayroll(pool,now);
  if(r?.body?.status==='paid')console.log('[Eclipse Order API] Daily payroll processed:',r.body.cycle,'distributed:',r.body.paid_total);
  const fronts=await runFrontDailyExpenses(pool,now);
  if(fronts?.processed)console.log('[Eclipse Order API] Front operating costs:',fronts.cycle,'paid:',fronts.paid);
 }
 catch(e){console.warn('[Eclipse Order API] Payroll check unavailable:',e?.code||'database_unavailable')}
 finally{payrollTickRunning=false}
};
let exchangeTickRunning=false;
const exchangeTick=async()=>{
 if(!pool||exchangeTickRunning)return;
 exchangeTickRunning=true;
 try{
  const posted=await syncWorkshopBuyOrders(pool);
  if(posted)console.log('[Merchant Exchange] Posted workshop buy orders:',posted);
 }catch(error){console.warn('[Merchant Exchange] Demand check unavailable:',error?.code||error?.name||'database_unavailable')}
 finally{exchangeTickRunning=false}
};
const exchangeTimer=setInterval(()=>void exchangeTick(),15*60*1000);
exchangeTimer.unref();
const payrollTimer=setInterval(()=>void payrollTick(),60000);
const settlementTimer=setInterval(()=>void settlementTick(),60000);
settlementTimer.unref();
payrollTimer.unref();
if(pool){void payrollTick();void settlementTick();void exchangeTick()}
const close=async()=>{
  clearInterval(exchangeTimer);
  clearInterval(payrollTimer);
  clearInterval(settlementTimer);
  server.close();
  if(pool) await pool.end().catch(()=>{});
};
process.on('SIGINT',()=>void close());
process.on('SIGTERM',()=>void close());
