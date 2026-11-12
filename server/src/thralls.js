import {resolveSession} from './auth.js';

const forbidden=(status,error)=>({status,body:{error}});

// Both IC Household assignments and IC thrall character ranks are distinct from website staff roles.
export async function mayEnterThralls(pool,actor){
 if(['domina','high_command','handler'].includes(actor.account_role))return true;
 const [ranks]=await pool.execute(
  "SELECT 1 FROM account_order_ranks WHERE account_id=? AND track='household' LIMIT 1",
  [actor.id]
 );
 if(ranks.length)return true;
 const [characters]=await pool.execute(
  "SELECT 1 FROM characters c LEFT JOIN character_order_ranks r ON r.character_id=c.id LEFT JOIN order_rank_catalog cat ON cat.code=r.rank_code WHERE c.player_account_id=? AND (c.collar_bound=1 OR cat.track='servitude') LIMIT 1",
  [actor.id]
 );
 return characters.length>0;
}


const ok=body=>({status:200,body});
async function manager(pool,actor){
 if(['domina','high_command','handler'].includes(actor.account_role))return true;
 const [rows]=await pool.execute("SELECT 1 FROM account_order_ranks WHERE account_id=? AND track='household' LIMIT 1",[actor.id]);
 return rows.length>0;
}
async function readBody(req){
 const chunks=[];let size=0;
 for await(const chunk of req){size+=chunk.length;if(size>4096)return null;chunks.push(chunk)}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}
}
const isAmount=n=>Number.isInteger(n)&&n>=0&&n<=1000;
export const canSeatCharacter=(machine,seat,character)=>machine?.machine_status==='offline'&&!seat?.character_id&&Boolean(character?.allow_seating);
export const withinContributionLimit=(prefs,seat,channel,amount)=>['upper','lower'].includes(channel)&&isAmount(amount)&&amount>0&&Boolean(prefs?.allow_seating)&&Boolean(prefs?.['allow_'+channel])&&Number(seat?.[channel+'_recorded']||0)+amount<=Number(prefs?.[channel+'_limit']||0);

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const defaultPrefs={allow_upper:0,allow_lower:0,allow_seating:0,gender_identity:'unspecified',lower_anatomy:'unspecified',lactation_state:'none'};
export const GENDER_IDENTITIES=['unspecified','female','male','nonbinary','other'];
export const LOWER_ANATOMIES=['unspecified','vulva','penis','mixed','other'];
export const LACTATION_STATES=['none','established','variable'];
const CYCLE_MS=5*60*1000;
export const chamberCycleDate=now=>new Date(now).toISOString().slice(0,10);
export const chamberNextReset=now=>new Date(Date.UTC(new Date(now).getUTCFullYear(),new Date(now).getUTCMonth(),new Date(now).getUTCDate()+1)).toISOString();
// Per-day game balance; two independent reserves. No character's balance can go negative.
export function dailyCapacity(channel,prefs){
 if(channel==='upper')return prefs?.lactation_state==='established'?18:prefs?.lactation_state==='variable'?8:0;
 if(channel==='lower')return availableChamberChannels(prefs).lower?6:0;
 return 0;
}
export function dailyBalance(prefs,used={}){
 const consumption=used||{};
 const upperMax=dailyCapacity('upper',prefs),lowerMax=dailyCapacity('lower',prefs);
 return {
  upper:{maximum:upperMax,used:Math.min(upperMax,Number(consumption.upper_used||0)),remaining:Math.max(0,upperMax-Number(consumption.upper_used||0))},
  lower:{maximum:lowerMax,used:Math.min(lowerMax,Number(consumption.lower_used||0)),remaining:Math.max(0,lowerMax-Number(consumption.lower_used||0))}
 };
}
// A deliberately fictional, low-volume game abstraction. Not a model of human physiology.
export function simulatedCycleYield(channel,preferences,random=Math.random()){
 if(channel==='upper'){
  if(preferences.lactation_state==='none')return 0;
  return preferences.lactation_state==='established'?1+Math.floor(random*3):Math.floor(random*3);
 }
 if(channel==='lower')return random<0.55?0:1;
 return 0;
}
export const lowerMaterialForAnatomy=anatomy=>({vulva:'vaginal',penis:'seminal',mixed:'mixed',other:'other'})[anatomy]||'unclassified';
export const availableChamberChannels=prefs=>({
 upper:Boolean(prefs&&prefs.lactation_state&&prefs.lactation_state!=='none'),
 lower:Boolean(prefs&&LOWER_ANATOMIES.includes(prefs.lower_anatomy)&&prefs.lower_anatomy!=='unspecified')
});
async function seatRoster(pool,actor){
 const [rows]=await pool.execute("SELECT c.id,c.character_name AS name,c.player_account_id,COALESCE(p.allow_seating,0) AS allow_seating,CASE WHEN p.lactation_state IS NOT NULL AND p.lactation_state<>'none' THEN 1 ELSE 0 END AS allow_upper,CASE WHEN p.lower_anatomy IS NOT NULL AND p.lower_anatomy<>'unspecified' THEN 1 ELSE 0 END AS allow_lower,COALESCE(p.upper_limit,0) AS upper_limit,COALESCE(p.lower_limit,0) AS lower_limit,COALESCE(p.gender_identity,'unspecified') AS gender_identity,COALESCE(p.lower_anatomy,'unspecified') AS lower_anatomy FROM characters c LEFT JOIN order_thrall_contribution_preferences p ON p.character_id=c.id LEFT JOIN character_order_ranks cr ON cr.character_id=c.id LEFT JOIN order_rank_catalog cat ON cat.code=cr.rank_code WHERE (c.collar_bound=1 OR cat.track='servitude' OR c.player_account_id=?) AND p.allow_seating=1 ORDER BY c.character_name",[actor.id]);
 return rows.map(row=>({...row,is_own:row.player_account_id===actor.id}));
}

// Settle elapsed production on reads; no manual collection action is required.
async function settleChamberProduction(pool){
 const cn=await pool.getConnection();
 try{
  await cn.beginTransaction();
  const [[machine]]=await cn.execute('SELECT * FROM order_thrall_chamber WHERE id=1 FOR UPDATE');
  if(!machine||machine.machine_status!=='running'){await cn.commit();return}
  const [[seat]]=await cn.execute('SELECT * FROM order_thrall_seat WHERE id=1 FOR UPDATE');
  if(!seat?.character_id){await cn.commit();return}
  const [[prefs]]=await cn.execute('SELECT * FROM order_thrall_contribution_preferences WHERE character_id=? FOR UPDATE',[seat.character_id]);
  if(!prefs?.allow_seating){await cn.commit();return}
  const now=new Date(),day=chamberCycleDate(now),midnight=Date.parse(day+'T00:00:00Z');
  await cn.execute('INSERT IGNORE INTO order_thrall_daily_output(character_id,cycle_date) VALUES(?,?)',[seat.character_id,day]);
  const [[usage]]=await cn.execute('SELECT upper_used,lower_used FROM order_thrall_daily_output WHERE character_id=? AND cycle_date=? FOR UPDATE',[seat.character_id,day]);
  const updates=[],values=[];
  for(const channel of ['upper','lower']){
   if(machine[channel+'_status']!=='active'||!availableChamberChannels(prefs)[channel])continue;
   const previous=seat[channel+'_last_cycle_at'];
   const startingAt=previous?new Date(previous).getTime():now.getTime();
   const from=Math.max(Number.isFinite(startingAt)?startingAt:now.getTime(),midnight);
   const ticks=Math.floor((now.getTime()-from)/CYCLE_MS);
   if(ticks<=0){
    if(!previous)await cn.execute('UPDATE order_thrall_seat SET '+channel+'_last_cycle_at=UTC_TIMESTAMP(3) WHERE id=1');
    continue;
   }
   const remaining=dailyBalance(prefs,usage)[channel].remaining;
   const space=Math.max(0,Number(machine[channel+'_capacity'])-Number(machine[channel+'_volume']));
   let amount=0;
   const kind=channel==='lower'?lowerMaterialForAnatomy(prefs.lower_anatomy):null;
   const compatible=channel!=='lower'||Number(machine.lower_volume)===0||machine.lower_material_type===kind;
   if(compatible&&remaining>0&&space>0){
    for(let i=0;i<Math.min(ticks,288)&&amount<remaining&&amount<space;i++)
     amount+=Math.min(remaining-amount,space-amount,simulatedCycleYield(channel,prefs));
   }
   const settledAt=new Date(from+ticks*CYCLE_MS);
   await cn.execute('UPDATE order_thrall_seat SET '+channel+'_last_cycle_at=?,'+channel+'_recorded='+channel+'_recorded+? WHERE id=1',[settledAt,amount]);
   if(amount){
    await cn.execute('UPDATE order_thrall_daily_output SET '+channel+'_used='+channel+'_used+? WHERE character_id=? AND cycle_date=?',[amount,seat.character_id,day]);
    updates.push(channel+'_volume='+channel+'_volume+?');values.push(amount);
    if(channel==='lower'){updates.push('lower_material_type=?');values.push(kind)}
   }
  }
  if(updates.length)await cn.execute('UPDATE order_thrall_chamber SET '+updates.join(',')+',revision=revision+1 WHERE id=1',values);
  await cn.commit();
 }catch(e){await cn.rollback().catch(()=>{});throw e}finally{cn.release()}
}

export async function thrallsRoute(pool,req,path){
 if(!pool)return forbidden(503,'database_unavailable');
 const actor=await resolveSession(pool,req);
 if(!actor)return forbidden(401,'not_authenticated');
 const preferencesPath=new RegExp('^/thralls/characters/([0-9a-f-]{36})/contributions$').exec(path);
 if(preferencesPath&&uuid.test(preferencesPath[1])){
  const id=preferencesPath[1];
  const [[character]]=await pool.execute('SELECT id,character_name,player_account_id,collar_bound FROM characters WHERE id=?',[id]);
  if(!character)return forbidden(404,'character_not_found');
  const owner=character.player_account_id===actor.id;
  if(!owner&&!(await manager(pool,actor)))return forbidden(403,'character_access_denied');
  if(req.method==='GET'){
   const [[prefs]]=await pool.execute('SELECT allow_upper,allow_lower,allow_seating,gender_identity,lower_anatomy,lactation_state FROM order_thrall_contribution_preferences WHERE character_id=?',[id]);
   return ok({character_id:id,character_name:character.character_name,preferences:prefs||defaultPrefs,can_edit:owner});
  }
  if(req.method!=='PUT')return forbidden(405,'method_not_allowed');
  if(!owner)return forbidden(403,'character_owner_required');
  const body=await readBody(req);
  if(!body||typeof body.allow_seating!=='boolean'||!GENDER_IDENTITIES.includes(body.gender_identity)||!LOWER_ANATOMIES.includes(body.lower_anatomy)||!LACTATION_STATES.includes(body.lactation_state))return forbidden(400,'invalid_contribution_preferences');
  const next={allow_upper:body.lactation_state!=='none',allow_lower:body.lower_anatomy!=='unspecified',allow_seating:body.allow_seating,gender_identity:body.gender_identity,lower_anatomy:body.lower_anatomy,lactation_state:body.lactation_state};
  const cn=await pool.getConnection();
  try{
   await cn.beginTransaction();
   await cn.execute('SELECT machine_status FROM order_thrall_chamber WHERE id=1 FOR UPDATE');
   const [[seat]]=await cn.execute('SELECT character_id FROM order_thrall_seat WHERE id=1 FOR UPDATE');
   const [[previous]]=await cn.execute('SELECT lower_anatomy FROM order_thrall_contribution_preferences WHERE character_id=? FOR UPDATE',[id]);
   if(seat.character_id===id&&(!next.allow_seating||(previous&&previous.lower_anatomy!==next.lower_anatomy))){
    await cn.execute("UPDATE order_thrall_chamber SET machine_status='offline',upper_status='offline',lower_status='offline',revision=revision+1 WHERE id=1");
    await cn.execute('UPDATE order_thrall_seat SET character_id=NULL,seated_at=NULL,placed_by=NULL,upper_recorded=0,lower_recorded=0,upper_last_cycle_at=NULL,lower_last_cycle_at=NULL WHERE id=1');
    await cn.execute('INSERT INTO order_thrall_chamber_log(actor_id,action,detail) VALUES(?,?,?)',[actor.id,'release','Player withdrew chair permission; character released']);
   }
   await cn.execute('INSERT INTO order_thrall_contribution_preferences(character_id,allow_upper,allow_lower,allow_seating,gender_identity,lower_anatomy,lactation_state) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE allow_upper=VALUES(allow_upper),allow_lower=VALUES(allow_lower),allow_seating=VALUES(allow_seating),gender_identity=VALUES(gender_identity),lower_anatomy=VALUES(lower_anatomy),lactation_state=VALUES(lactation_state)',[id,Number(next.allow_upper),Number(next.allow_lower),Number(next.allow_seating),next.gender_identity,next.lower_anatomy,next.lactation_state]);
   await cn.commit();return ok({saved:true});
  }catch(e){await cn.rollback().catch(()=>{});throw e}finally{cn.release()}
 }
 if(!await mayEnterThralls(pool,actor))return forbidden(403,'access_denied');
 if(path==='/thralls/chamber'&&req.method==='GET'){
  await settleChamberProduction(pool);
  const [[machine]]=await pool.execute('SELECT * FROM order_thrall_chamber WHERE id=1');
  const [batches]=await pool.execute('SELECT id,material,material_type,quantity,classification,notes,created_at FROM order_thrall_chamber_batches ORDER BY id DESC LIMIT 80');
  const [history]=await pool.execute('SELECT l.id,l.action,l.detail,l.created_at,a.display_name AS actor FROM order_thrall_chamber_log l JOIN accounts a ON a.id=l.actor_id ORDER BY l.id DESC LIMIT 50');
  const [[seat]]=await pool.execute('SELECT s.character_id,s.seated_at,s.upper_recorded,s.lower_recorded,c.character_name AS name FROM order_thrall_seat s LEFT JOIN characters c ON c.id=s.character_id WHERE s.id=1');
  let daily=null;
  const now=new Date(),cycle=chamberCycleDate(now);
  if(seat?.character_id){
   const [[prefs]]=await pool.execute('SELECT lactation_state,lower_anatomy FROM order_thrall_contribution_preferences WHERE character_id=?',[seat.character_id]);
   const [[used]]=await pool.execute('SELECT upper_used,lower_used FROM order_thrall_daily_output WHERE character_id=? AND cycle_date=?',[seat.character_id,cycle]);
   daily={...dailyBalance(prefs,used),cycle_date:cycle,next_reset_at:chamberNextReset(now)};
  }
  const can_manage=await manager(pool,actor);
  const roster=can_manage?await seatRoster(pool,actor):[];
  return ok({machine,batches,history,seat,daily,roster,can_manage,can_release:can_manage||(seat?.character_id&&roster.length===0&&(await pool.execute('SELECT 1 FROM characters WHERE id=? AND player_account_id=?',[seat.character_id,actor.id]))[0].length>0)});
 }
 if(path!=='/thralls/chamber/actions'||req.method!=='POST')return forbidden(404,'not_found');
 const canOperate=await manager(pool,actor);
 const data=await readBody(req);
 if(!data||typeof data!=='object')return forbidden(400,'invalid_request');
 const action=data.action;
 if(!['set_status','run_cycle','decant','maintenance','reset','seat','release'].includes(action))return forbidden(400,'invalid_chamber_action');
 if(!canOperate&&action!=='release')return forbidden(403,'household_or_staff_required');
 const cn=await pool.getConnection();
 try{
  await cn.beginTransaction();
  const [[machine]]=await cn.execute('SELECT * FROM order_thrall_chamber WHERE id=1 FOR UPDATE');
  if(!machine){await cn.rollback();return forbidden(409,'chamber_not_initialized')}
  const [[seat]]=await cn.execute('SELECT * FROM order_thrall_seat WHERE id=1 FOR UPDATE');
  if(!canOperate){
   const [mine]=seat.character_id?await cn.execute('SELECT 1 FROM characters WHERE id=? AND player_account_id=?',[seat.character_id,actor.id]):[[]];
   if(!mine.length){await cn.rollback();return forbidden(403,'owner_or_staff_required')}
  }
  let updates=[],values=[],detail='';
  if(action==='seat'){
   if(machine.machine_status!=='offline')return await rollback(cn,'chair_must_be_offline');
   if(seat.character_id)return await rollback(cn,'chair_occupied');
   if(!uuid.test(data.character_id||''))return await rollback(cn,'invalid_character');
   const [rows]=await cn.execute("SELECT c.character_name,c.collar_bound,p.allow_seating,p.lower_anatomy FROM characters c JOIN order_thrall_contribution_preferences p ON p.character_id=c.id LEFT JOIN character_order_ranks r ON r.character_id=c.id LEFT JOIN order_rank_catalog cat ON cat.code=r.rank_code WHERE c.id=? AND (c.collar_bound=1 OR cat.track='servitude' OR c.player_account_id=?) FOR UPDATE",[data.character_id,actor.id]);
   const character=rows[0];
   if(!canSeatCharacter(machine,seat,character))return await rollback(cn,'character_has_not_opted_in');
   await cn.execute('UPDATE order_thrall_seat SET character_id=?,seated_at=UTC_TIMESTAMP(),placed_by=?,upper_recorded=0,lower_recorded=0,upper_last_cycle_at=NULL,lower_last_cycle_at=NULL WHERE id=1',[data.character_id,actor.id]);
   await cn.execute("UPDATE order_thrall_chamber SET upper_status='offline',lower_status='offline' WHERE id=1");
   detail='Seated '+character.character_name+' with recorded player permission';
  }else if(action==='release'){
   if(!seat.character_id)return await rollback(cn,'chair_empty');
   await cn.execute("UPDATE order_thrall_chamber SET machine_status='offline',upper_status='offline',lower_status='offline' WHERE id=1");
   await cn.execute('UPDATE order_thrall_seat SET character_id=NULL,seated_at=NULL,placed_by=NULL,upper_recorded=0,lower_recorded=0,upper_last_cycle_at=NULL,lower_last_cycle_at=NULL WHERE id=1');
   detail='Released the seated character; machine set offline';
  }else if(action==='set_status'){
   const allowed=['offline','standby','running','maintenance'];
   if(!allowed.includes(data.status))return await rollback(cn,'invalid_status');
   if(data.status==='running'&&!seat.character_id)return await rollback(cn,'chair_empty');
   if(data.status==='running'&&(machine.upper_status!=='ready'||machine.lower_status!=='ready'))return await rollback(cn,'assemblies_must_be_ready');
   updates=['machine_status=?'];values=[data.status];detail='System status changed to '+data.status;
   // Both assemblies must be armed manually with Ready before Start.
   // Start engages the prepared assemblies and begins gradual extraction.
   if(data.status==='running'){
    for(const channel of ['upper','lower']){
     updates.push(channel+'_status=?');values.push('active');
     await cn.execute('UPDATE order_thrall_seat SET '+channel+'_last_cycle_at=UTC_TIMESTAMP(3) WHERE id=1');
    }
   }else{
    for(const channel of ['upper','lower']){
     if(machine[channel+'_status']==='active'){updates.push(channel+'_status=?');values.push(data.status==='offline'?'offline':'ready')}
    }
   }
  }else if(action==='maintenance'){
   const channel=data.channel,status=data.status;
   if(!['upper','lower'].includes(channel)||!['offline','ready','active','maintenance'].includes(status))return await rollback(cn,'invalid_assembly_status');
   if(status==='active')return await rollback(cn,'start_apparatus_to_activate');
   if(machine.machine_status==='running'&&status==='ready')return await rollback(cn,'stop_chamber_first');
   updates=[channel+'_status=?'];values=[status];detail=channel+' assembly set to '+status;
  }else if(action==='run_cycle'){
   const channel=data.channel;
   if(!['upper','lower'].includes(channel))return await rollback(cn,'invalid_channel');
   if(machine.machine_status!=='running'||machine[channel+'_status']!=='active'||!seat.character_id)return await rollback(cn,'assembly_not_active');
   const [[prefs]]=await cn.execute('SELECT * FROM order_thrall_contribution_preferences WHERE character_id=? FOR UPDATE',[seat.character_id]);
   if(!prefs||!prefs.allow_seating||!availableChamberChannels(prefs)[channel])return await rollback(cn,'collection_not_available');
   if(channel==='lower'&&prefs.lower_anatomy==='unspecified')return await rollback(cn,'anatomy_not_configured');
   const last=seat[channel+'_last_cycle_at'];
   if(last&&Date.now()-new Date(last).getTime()<CYCLE_MS)return await rollback(cn,'cycle_not_ready');
   const cycle=chamberCycleDate(new Date());
   await cn.execute('INSERT IGNORE INTO order_thrall_daily_output(character_id,cycle_date) VALUES(?,?)',[seat.character_id,cycle]);
   const [[usage]]=await cn.execute('SELECT upper_used,lower_used FROM order_thrall_daily_output WHERE character_id=? AND cycle_date=? FOR UPDATE',[seat.character_id,cycle]);
   const available=dailyBalance(prefs,usage)[channel].remaining;
   if(available===0)return await rollback(cn,'daily_output_exhausted');
   const amount=Math.min(available,simulatedCycleYield(channel,prefs));
   if(amount&&Number(machine[channel+'_volume'])+amount>Number(machine[channel+'_capacity']))return await rollback(cn,'reservoir_full');
   if(channel==='lower'&&amount){
    const kind=lowerMaterialForAnatomy(prefs.lower_anatomy);
    if(machine.lower_volume>0&&machine.lower_material_type!==kind)return await rollback(cn,'decant_lower_reservoir_first');
    updates.push('lower_material_type=?');values.push(kind);
   }
   await cn.execute('UPDATE order_thrall_seat SET '+channel+'_last_cycle_at=UTC_TIMESTAMP(3),'+channel+'_recorded='+channel+'_recorded+? WHERE id=1',[amount]);
   if(amount)await cn.execute('UPDATE order_thrall_daily_output SET '+channel+'_used='+channel+'_used+? WHERE character_id=? AND cycle_date=?',[amount,seat.character_id,cycle]);
   if(amount){updates.push(channel+'_volume='+channel+'_volume+?');values.push(amount)}
   detail='Completed '+channel+' cycle: '+amount+' units recorded';
  }else if(action==='decant'){
   const channel=data.channel,amount=data.quantity,classification=String(data.classification||'Unclassified').trim(),notes=String(data.notes||'').trim();
   if(!['upper','lower'].includes(channel)||!isAmount(amount)||amount===0||amount>machine[channel+'_volume']||classification.length>80||notes.length>500)return await rollback(cn,'invalid_batch');
   await cn.execute('INSERT INTO order_thrall_chamber_batches(material,material_type,quantity,classification,notes,created_by) VALUES(?,?,?,?,?,?)',[channel==='upper'?'lacteal':'secondary',channel==='upper'?'milk':machine.lower_material_type,amount,classification||'Unclassified',notes,actor.id]);
   updates=[channel+'_volume='+channel+'_volume-?'];values=[amount];detail='Decanted '+amount+' units from '+channel+' reservoir';
  }else{
   if(machine.machine_status==='running')return await rollback(cn,'stop_chamber_first');
   if(!['upper','lower'].includes(data.channel))return await rollback(cn,'invalid_channel');
   updates=[data.channel+'_volume=0'];values=[];detail='Cleared '+data.channel+' reservoir (uncollected contents discarded)';
  }
  await cn.execute('UPDATE order_thrall_chamber SET '+[...updates,'revision=revision+1','updated_by=?'].join(',')+' WHERE id=1',[...values,actor.id]);
  await cn.execute('INSERT INTO order_thrall_chamber_log(actor_id,action,detail) VALUES(?,?,?)',[actor.id,action,detail]);
  await cn.commit();return ok({saved:true});
 }catch(e){await cn.rollback().catch(()=>{});throw e}finally{cn.release()}
}
async function rollback(conn,error){await conn.rollback();return forbidden(400,error)}
