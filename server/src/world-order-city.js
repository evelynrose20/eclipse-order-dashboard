import {housingCapacity} from './world-settlement-upgrades.js';
import {previewPopulationChange} from './world-population-simulation.js';
import {settlementDemographics} from './world-demographics.js';

const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const day=now=>new Date(now).toISOString().slice(0,10);
const round=n=>Math.round(Math.max(0,Number(n)||0)*1000)/1000;

/**
 * Order city-builder policy is NOT the NPC simulation:
 * population arrives slowly to staffed, supplied, built housing; this never
 * authorizes buildings, industrial projects, diplomacy, logistics, or jobs.
 * Everything is OFF by default. The independent NPC simulation remains unchanged.
 */
export function orderCityForecast(settlement,upgrades=[],stock=[],intake='off'){
 const capacity=housingCapacity(settlement,upgrades);
 const residents=Math.max(0,Math.floor(Number(settlement.population)||0));
 const food=round(stock.filter(s=>s.resource_kind==='food').reduce((v,s)=>v+Number(s.quantity),0));
 const water=round(stock.filter(s=>s.resource_kind==='water').reduce((v,s)=>v+Number(s.quantity),0));
 const vacant=Math.max(0,capacity-residents);
 const proposed=previewPopulationChange(settlement,upgrades,0,true).arrivals;
 const requirements={housing:vacant>0,food:food>=Math.max(4,(residents+proposed)*3),water:water>=Math.max(4,(residents+proposed)*2),safety:!['contested','occupied','destroyed','abandoned','rebuilding'].includes(settlement.strategic_state)};
 const arrivals=Object.values(requirements).every(Boolean)?proposed:0;
 return {intake,residents,housing_capacity:capacity,vacancies:vacant,food_stock:food,water_stock:water,
  expected_arrivals:arrivals,requirements,demographics:settlementDemographics(settlement),
  npc_construction:false,industry_autonomy:false,regional_simulation_required:false};
}
async function tx(pool,fn){
 const db=await pool.getConnection();
 try{await db.beginTransaction();const response=await fn(db);if(response.status===200)await db.commit();else await db.rollback();return response}
 catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}
}
async function state(db,id,lock=false){
 const [[settlement]]=await db.execute('SELECT * FROM world_settlements WHERE id=?'+(lock?' FOR UPDATE':''),[id]);
 if(!settlement)return null;
 const [[policy]]=await db.execute('SELECT * FROM world_order_city_policies WHERE settlement_id=?'+(lock?' FOR UPDATE':''),[id]);
 const [upgrades]=await db.execute('SELECT * FROM world_settlement_upgrades WHERE settlement_id=?',[id]);
 const [stock]=await db.execute('SELECT resource_kind,quantity FROM world_civic_stock WHERE settlement_id=?'+(lock?' FOR UPDATE':''),[id]);
 return {settlement,policy,forecast:orderCityForecast(settlement,upgrades,stock,policy?.residential_intake||'off')};
}
export async function orderCityRoute(pool,req,path,actor){
 if(!['domina','high_command'].includes(actor?.account_role))return fail(403,'command_required');
 const match=/^\/world-admin\/city\/(\d+)(?:\/intake)?$/.exec(path);
 if(!match)return fail(404,'not_found');
 const id=Number(match[1]);
 if(!Number.isSafeInteger(id)||id<1)return fail(400,'invalid_settlement');
 if(req.method==='GET'&&!path.endsWith('/intake')){
  const info=await state(pool,id);
  if(!info)return fail(404,'settlement_not_found');
  if(info.settlement.controlling_faction_id!=='eclipse-order')return fail(409,'not_order_controlled');
  const [history]=await pool.execute('SELECT cycle_date,residents_before,residents_arrived,residents_after FROM world_order_city_arrivals WHERE settlement_id=? ORDER BY cycle_date DESC LIMIT 14',[id]);
  return ok({...info.forecast,last_intake_date:info.policy?.last_intake_date||null,history});
 }
 if(req.method==='PUT'&&path.endsWith('/intake')){
  const chunks=[];for await(const chunk of req){chunks.push(chunk);if(Buffer.concat(chunks).length>1000)return fail(413,'invalid_payload')}
  let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return fail(400,'invalid_payload')}
  if(!['off','automatic'].includes(body?.residential_intake))return fail(400,'invalid_residential_policy');
  return tx(pool,async db=>{
   const info=await state(db,id,true);
   if(!info)return fail(404,'settlement_not_found');
   if(info.settlement.controlling_faction_id!=='eclipse-order')return fail(409,'not_order_controlled');
   await db.execute('INSERT INTO world_order_city_policies(settlement_id,residential_intake) VALUES(?,?) ON DUPLICATE KEY UPDATE residential_intake=VALUES(residential_intake)',[id,body.residential_intake]);
   return ok({saved:true,residential_intake:body.residential_intake});
  });
 }
 return fail(405,'method_not_allowed');
}
export async function runOrderCityResidents(pool,now=new Date()){
 if(!pool)return {processed:0,arrivals:0};
 const cycle=day(now);
 const [eligible]=await pool.execute("SELECT p.settlement_id FROM world_order_city_policies p JOIN world_settlements s ON s.id=p.settlement_id WHERE p.residential_intake='automatic' AND s.controlling_faction_id='eclipse-order' AND (p.last_intake_date IS NULL OR p.last_intake_date<?) ORDER BY p.settlement_id LIMIT 80",[cycle]);
 let processed=0,arrivals=0;
 for(const row of eligible){
  const result=await tx(pool,async db=>{
   const info=await state(db,row.settlement_id,true);
   if(!info||info.settlement.controlling_faction_id!=='eclipse-order'||info.policy?.residential_intake!=='automatic')return ok({skipped:true});
   if(info.policy.last_intake_date&&day(info.policy.last_intake_date)>=cycle)return ok({skipped:true});
   const {forecast}=info;
   // One check per UTC calendar day. No accumulating fictitious offline growth.
   await db.execute('UPDATE world_order_city_policies SET last_intake_date=? WHERE settlement_id=?',[cycle,row.settlement_id]);
   if(forecast.expected_arrivals<=0)return ok({blocked:true});
   const next=forecast.residents+forecast.expected_arrivals;
   await db.execute("UPDATE world_settlements SET population=? WHERE id=? AND controlling_faction_id='eclipse-order' AND population=?",[next,row.settlement_id,forecast.residents]);
   await db.execute('INSERT INTO world_order_city_arrivals(settlement_id,cycle_date,residents_before,residents_arrived,residents_after,housing_capacity,food_stock,water_stock) VALUES(?,?,?,?,?,?,?,?)',[row.settlement_id,cycle,forecast.residents,forecast.expected_arrivals,next,forecast.housing_capacity,forecast.food_stock,forecast.water_stock]);
   return ok({arrivals:forecast.expected_arrivals});
  });
  if(result.body.arrivals){processed++;arrivals+=result.body.arrivals}
 }
 return {processed,arrivals};
}
