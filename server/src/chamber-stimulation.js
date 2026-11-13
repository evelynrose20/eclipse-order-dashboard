import {resolveSession} from './auth.js';
import {mayEnterThralls,availableChamberChannels,dailyBalance,canMixLowerMaterial,canCollectForSource,lowerMaterialForAnatomy,chamberCycleDate,settleChamberProduction} from './thralls.js';
import {chamberPower} from './world-power.js';

const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const INTERVAL=30000,POINTS_PER_ASSEMBLY=2,BONUS=0.5;
export const validStimulationLabel=value=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=64&&!/[\x00-\x1F\x7F]/.test(value);
export function advanceStimulation(points,lastUtc,now,activeChannels){
 const value=Math.max(0,Math.min(100,Number(points)||0));
 const nowMs=new Date(now).getTime(),lastMs=typeof lastUtc==='string'&&lastUtc?Date.parse(lastUtc.replace(' ','T')+'Z'):NaN;
 if(!Number.isFinite(lastMs)||lastMs>nowMs+1000||!activeChannels)return {points:value,lastAt:new Date(now).toISOString().slice(0,23).replace('T',' '),ticks:0};
 const ticks=Math.max(0,Math.floor((nowMs-lastMs)/INTERVAL));
 return {points:Math.min(100,value+ticks*activeChannels*POINTS_PER_ASSEMBLY),
  lastAt:new Date(lastMs+ticks*INTERVAL).toISOString().slice(0,23).replace('T',' '),ticks};
}
const safeLabel=value=>String(value||'').trim();
async function readBody(req){const chunks=[];let n=0;for await(const chunk of req){n+=chunk.length;if(n>3000)return null;chunks.push(chunk)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}}
async function transaction(pool,fn){const db=await pool.getConnection();try{await db.beginTransaction();const response=await fn(db);if(response.status===200)await db.commit();else await db.rollback();return response}catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}}
export async function settleStimulation(pool){
 const power=await chamberPower(pool);
 return transaction(pool,async db=>{
  const [[machine]]=await db.execute('SELECT machine_status,upper_status,lower_status FROM order_thrall_chamber WHERE id=1 FOR UPDATE');
  const [[seat]]=await db.execute("SELECT s.character_id,s.stimulation_points,DATE_FORMAT(s.stimulation_last_at,'%Y-%m-%d %H:%i:%s.%f') AS last_utc FROM order_thrall_seat s WHERE s.id=1 FOR UPDATE");
  if(!seat?.character_id||machine?.machine_status!=='running')return ok({settled:false});
  const [[prefs]]=await db.execute('SELECT allow_seating,lactation_state,lower_anatomy FROM order_thrall_contribution_preferences WHERE character_id=?',[seat.character_id]);
  const available=availableChamberChannels(prefs);
  const active=prefs?.allow_seating&&power.rate.amount>0?['upper','lower'].filter(ch=>machine[ch+'_status']==='active'&&available[ch]).length:0;
  const [[clock]]=await db.execute("SELECT DATE_FORMAT(UTC_TIMESTAMP(3),'%Y-%m-%d %H:%i:%s.%f') AS now_utc");
  const now=new Date(clock.now_utc.replace(' ','T')+'Z');
  const next=advanceStimulation(seat.stimulation_points,seat.last_utc,now,active);
  if(next.ticks||!seat.last_utc||!active){
   await db.execute('UPDATE order_thrall_seat SET stimulation_points=?,stimulation_last_at=? WHERE id=1',[next.points,active?next.lastAt:clock.now_utc]);
  }
  return ok({points:next.points});
 });
}
export async function stimulationRoute(pool,req,path){
 if(!pool)return fail(503,'database_unavailable');
 const actor=await resolveSession(pool,req);
 if(!actor)return fail(401,'not_authenticated');
 if(!await mayEnterThralls(pool,actor))return fail(403,'access_denied');
 const body=await readBody(req);
 if(!body||typeof body!=='object')return fail(400,'invalid_request');
 if(body.action==='set_labels'&&req.method==='POST'){
  if(!['domina','high_command','handler'].includes(actor.account_role))return fail(403,'staff_required');
  const meter=safeLabel(body.meter_label),action=safeLabel(body.action_label);
  if(!validStimulationLabel(meter)||!validStimulationLabel(action))return fail(400,'invalid_stimulation_label');
  return transaction(pool,async db=>{
   await db.execute('UPDATE order_thrall_chamber SET stimulation_meter_label=?,stimulation_action_label=?,revision=revision+1 WHERE id=1',[meter,action]);
   await db.execute('INSERT INTO order_thrall_chamber_log(actor_id,action,detail) VALUES(?,?,?)',[actor.id,'stimulation_labels','Updated stimulation control labels']);
   return ok({saved:true});
  });
 }
 if(body.action!=='trigger'||req.method!=='POST')return fail(404,'not_found');
 await settleChamberProduction(pool);
 await settleStimulation(pool);
 const power=await chamberPower(pool);
 return transaction(pool,async db=>{
  const [[machine]]=await db.execute('SELECT * FROM order_thrall_chamber WHERE id=1 FOR UPDATE');
  const [[seat]]=await db.execute('SELECT * FROM order_thrall_seat WHERE id=1 FOR UPDATE');
  if(!seat?.character_id)return fail(409,'chair_empty');
  const [[owner]]=await db.execute('SELECT player_account_id FROM characters WHERE id=?',[seat.character_id]);
  if(owner?.player_account_id!==actor.id)return fail(403,'seated_character_required');
  if(machine.machine_status!=='running'||Number(seat.stimulation_points)<100)return fail(409,'stimulation_not_ready');
  if(power.rate.amount<=0)return fail(409,'insufficient_power');
  const [[prefs]]=await db.execute('SELECT * FROM order_thrall_contribution_preferences WHERE character_id=? FOR UPDATE',[seat.character_id]);
  if(!prefs?.allow_seating)return fail(403,'collection_not_available');
  const [[clock]]=await db.execute("SELECT DATE_FORMAT(UTC_TIMESTAMP(3),'%Y-%m-%d %H:%i:%s.%f') AS now_utc");
  const day=clock.now_utc.slice(0,10);
  await db.execute('INSERT IGNORE INTO order_thrall_daily_output(character_id,cycle_date) VALUES(?,?)',[seat.character_id,day]);
  const [[usage]]=await db.execute('SELECT upper_used,lower_used FROM order_thrall_daily_output WHERE character_id=? AND cycle_date=? FOR UPDATE',[seat.character_id,day]);
  const results=[];
  for(const ch of ['upper','lower']){
   if(machine[ch+'_status']!=='active'||!availableChamberChannels(prefs)[ch])continue;
   const space=Math.max(0,Number(machine[ch+'_capacity'])-Number(machine[ch+'_volume']));
   const remaining=dailyBalance(prefs,usage)[ch].remaining;
   const type=ch==='lower'?lowerMaterialForAnatomy(prefs.lower_anatomy):null;
   if(ch==='lower'&&!canMixLowerMaterial(machine.lower_volume,machine.lower_material_type,type))continue;
   if(!canCollectForSource(machine[ch+'_volume'],machine[ch+'_source_character_id'],seat.character_id))continue;
   const amount=Math.round(Math.max(0,Math.min(BONUS,remaining,space))*10)/10;
   if(amount<=0)continue;
   const fields=[ch+'_volume='+ch+'_volume+?',ch+'_source_character_id=?'];
   const values=[amount,seat.character_id];
   if(ch==='lower'){fields.push('lower_material_type=?');values.push(type)}
   await db.execute('UPDATE order_thrall_chamber SET '+fields.join(',')+' WHERE id=1',values);
   await db.execute('UPDATE order_thrall_daily_output SET '+ch+'_used='+ch+'_used+? WHERE character_id=? AND cycle_date=?',[amount,seat.character_id,day]);
   await db.execute('UPDATE order_thrall_seat SET '+ch+'_recorded='+ch+'_recorded+? WHERE id=1',[amount]);
   results.push({channel:ch,amount});
  }
  if(!results.length)return fail(409,'stimulation_no_available_output');
  await db.execute('UPDATE order_thrall_seat SET stimulation_points=0,stimulation_last_at=UTC_TIMESTAMP(3) WHERE id=1');
  await db.execute('UPDATE order_thrall_chamber SET revision=revision+1 WHERE id=1');
  await db.execute('INSERT INTO order_thrall_chamber_log(actor_id,action,detail) VALUES(?,?,?)',[actor.id,'stimulation_trigger','Seated character activated manual stimulation; '+results.map(x=>x.channel+': '+x.amount.toFixed(1)).join(', ')]);
  return ok({saved:true,results});
 });
}
