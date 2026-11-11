import {randomInt} from 'node:crypto';
import {resolveSession} from './auth.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RANKS=Object.freeze({
 unmarked:[1,10,1.05],marked_thrall:[2,20,1.10],bound_serpent:[3,35,1.20],
 eclipse_attendant:[4,45,1.30],silken_thrall:[5,60,1.45],violet_keeper:[6,75,1.60],
 serpents_chosen:[7,90,1.80],eclipsed_consort:[8,100,2]
});
const blank=()=>({cycle_opt_in:false,conception_opt_in:false,cycle_type:'heat',cycle_anchor:null,cycle_days:30,base_chance:20,pregnancy_status:'none',pregnancy_anchor:null,pregnancy_start_day:0,pregnancy_total_days:280,pregnancy_notes:'',shared_with_command:false});
const fail=(status,error)=>({status,body:{error}});
const ok=(body)=>({status:200,body});
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const dateKey=d=>d instanceof Date?d.toISOString().slice(0,10):String(d||'').slice(0,10);
const dayDiff=(from,to)=>Math.floor((Date.parse(dateKey(to)+'T00:00:00Z')-Date.parse(dateKey(from)+'T00:00:00Z'))/86400000);
const intBetween=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const asBool=v=>v===true||v===1||v===0||v===false;
const bool=v=>v===true||v===1;
const readBody=async req=>{
 let length=0;const parts=[];
 for await(const p of req){length+=p.length;if(length>8000)throw Object.assign(new Error('Payload too large'),{status:413});parts.push(p)}
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{throw Object.assign(new Error('Invalid request'),{status:400})}
};
export function cycleStatus(profile,bound,rankCode,today=new Date()){
 const rank=RANKS[rankCode]||null;
 const active=Boolean(bound&&rank);
 if(!active)return {active:false,phase:'inactive',day:null,rank:rank?.[0]||null,resonance:0,multiplier:1,alert:null};
 const days=Math.max(20,Math.min(90,Number(profile.cycle_days)||30));
 const elapsed=dayDiff(profile.cycle_anchor||'2026-01-01',today);
 const day=((elapsed%days)+days)%days+1;
 const fraction=(day-1)/days;
 const phase=fraction<10/30?'dormant':fraction<14/30?'onset':fraction<20/30?'active':fraction<23/30?'peak':'recovery';
 const factor={dormant:0,onset:.3,active:.7,peak:1,recovery:.2}[phase];
 return {active:true,phase,day,days,rank:rank[0],resonance:Math.round(rank[1]*factor),
  multiplier:Number((1+(rank[2]-1)*factor).toFixed(4)),
  alert:phase==='dormant'?null:{onset:'Brand resonance is beginning.',active:'Monthly binding resonance is elevated.',peak:'Monthly binding resonance has reached its peak.',recovery:'Binding resonance is subsiding.'}[phase]};
}
export function pregnancyProgress(profile,today=new Date()){
 if(profile.pregnancy_status!=='active'||!profile.pregnancy_anchor)return null;
 const days=Math.max(0,Number(profile.pregnancy_start_day||0)+dayDiff(profile.pregnancy_anchor,today));
 return {days,week:Math.floor(days/7)+1,total_days:Number(profile.pregnancy_total_days),percent:Math.min(100,Math.round(100*days/Number(profile.pregnancy_total_days))),
  due:days>=Number(profile.pregnancy_total_days)};
}
export function conceptionChance(profile,cycle){
 return Math.max(0,Math.min(100,Math.round(Number(profile.base_chance||0)*cycle.multiplier)));
}
const safeProfile=row=>row?{...blank(),...row,
 cycle_anchor:row.cycle_anchor?dateKey(row.cycle_anchor):null,
 pregnancy_anchor:row.pregnancy_anchor?dateKey(row.pregnancy_anchor):null,
 cycle_opt_in:bool(row.cycle_opt_in),conception_opt_in:bool(row.conception_opt_in),
 shared_with_command:bool(row.shared_with_command)}:blank();
export async function reproductionRoute(pool,req,path){
 const actor=await resolveSession(pool,req);
 if(!actor)return fail(401,'not_authenticated');
 const match=/^\/characters\/([0-9a-f-]{36})\/reproduction(?:\/(settings|pregnancy|complete|roll))?$/.exec(path);
 if(!match||!UUID.test(match[1]))return fail(404,'record_not_found');
 const [,id,action]=match;
 const [rows]=await pool.execute(`SELECT c.id,c.player_account_id,c.collar_bound,c.created_at,cor.rank_code
  FROM characters c LEFT JOIN character_order_ranks cor ON cor.character_id=c.id WHERE c.id=?`,[id]);
 const character=rows[0];
 if(!character)return fail(404,'character_not_found');
 const owner=character.player_account_id===actor.id;
 const command=['domina','high_command'].includes(actor.account_role);
 const [records]=await pool.execute('SELECT * FROM character_reproductive_profiles WHERE character_id=?',[id]);
 const profile=safeProfile(records[0]);
 if(!owner&&!command)return fail(403,'private_character_record');
 // Start legacy bound characters on a stable character date, not today's first visit.
 const cycleProfile={...profile,cycle_anchor:profile.cycle_anchor||dateKey(character.created_at||'2026-01-01')};
 const cycle=cycleStatus(cycleProfile,Boolean(character.collar_bound),character.rank_code);
 if(!action&&req.method==='GET'){
  // Command always sees IC status and stage; sealed notes, rolls and private details
  // require separate affirmative sharing from the character owner.
  const full=owner||Boolean(command&&profile.shared_with_command);
  const [rolls]=full?await pool.execute('SELECT id,event_key,ic_event_date,roll_d100,chance,success,rank_code,cycle_phase,created_at FROM character_conception_rolls WHERE character_id=? ORDER BY id DESC LIMIT 20',[id]):[[]];
  const [history]=full?await pool.execute('SELECT action,summary,created_at FROM character_reproductive_events WHERE character_id=? ORDER BY id DESC LIMIT 20',[id]):[[]];
  const publicIC={cycle_type:profile.cycle_type,cycle_days:profile.cycle_days,
   pregnancy_status:profile.pregnancy_status,pregnancy_anchor:profile.pregnancy_anchor,
   pregnancy_start_day:profile.pregnancy_start_day,pregnancy_total_days:profile.pregnancy_total_days};
  return ok({profile:full?{...profile,cycle_anchor:cycleProfile.cycle_anchor}:publicIC,cycle,pregnancy:pregnancyProgress(profile),rolls,history,
   can_edit:owner,command_view:command&&!owner,details_shared:full,character_bound:Boolean(character.collar_bound)});
 }
 if(!owner)return fail(403,'character_owner_required');
 const b=await readBody(req);
 if(action==='settings'&&req.method==='PUT'){
  if(!asBool(b?.conception_opt_in)||!asBool(b?.shared_with_command)||
   !['heat','rut'].includes(b.cycle_type)||!validDate(b.cycle_anchor)||
   !intBetween(b.cycle_days,20,90)||!intBetween(b.base_chance,0,100))return fail(400,'invalid_cycle_settings');
  await pool.execute(`INSERT INTO character_reproductive_profiles(character_id,cycle_opt_in,conception_opt_in,cycle_type,cycle_anchor,cycle_days,base_chance,shared_with_command)
   VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE conception_opt_in=VALUES(conception_opt_in),
   cycle_type=VALUES(cycle_type),cycle_anchor=VALUES(cycle_anchor),cycle_days=VALUES(cycle_days),base_chance=VALUES(base_chance),shared_with_command=VALUES(shared_with_command)`,
   [id,character.collar_bound?1:0,bool(b.conception_opt_in)?1:0,b.cycle_type,b.cycle_anchor,b.cycle_days,b.base_chance,bool(b.shared_with_command)?1:0]);
  await pool.execute('INSERT INTO character_reproductive_events(character_id,actor_account_id,action,summary) VALUES(?,?,?,?)',
   [id,actor.id,'cycle_settings','Binding calendar and conception preferences updated']);
  return ok({saved:true});
 }
 if(action==='pregnancy'&&req.method==='POST'){
  if(!validDate(b?.anchor)||!intBetween(b?.start_day,0,600)||!intBetween(b?.total_days,20,600)||
   b.start_day>b.total_days||typeof b.notes!=='string'||b.notes.length>1500)return fail(400,'invalid_pregnancy_record');
  const db=await pool.getConnection();
  try{
   await db.beginTransaction();
   const [[current]]=await db.execute('SELECT pregnancy_status FROM character_reproductive_profiles WHERE character_id=? FOR UPDATE',[id]);
   if(current?.pregnancy_status==='active'){await db.rollback();return fail(409,'pregnancy_already_active')}
   await db.execute(`INSERT INTO character_reproductive_profiles(character_id,pregnancy_status,pregnancy_anchor,pregnancy_start_day,pregnancy_total_days,pregnancy_notes)
    VALUES(?,'active',?,?,?,?) ON DUPLICATE KEY UPDATE pregnancy_status='active',pregnancy_anchor=VALUES(pregnancy_anchor),
    pregnancy_start_day=VALUES(pregnancy_start_day),pregnancy_total_days=VALUES(pregnancy_total_days),pregnancy_notes=VALUES(pregnancy_notes)`,
    [id,b.anchor,b.start_day,b.total_days,b.notes.trim()]);
   await db.execute('INSERT INTO character_reproductive_events(character_id,actor_account_id,action,summary) VALUES(?,?,?,?)',
    [id,actor.id,'pregnancy_registered','Pregnancy story record started']);
   await db.commit();return ok({registered:true});
  }catch(error){await db.rollback().catch(()=>{});throw error}finally{db.release()}
 }
 if(action==='complete'&&req.method==='POST'){
  if(!['completed','ended'].includes(b?.status))return fail(400,'invalid_pregnancy_outcome');
  const [changed]=await pool.execute("UPDATE character_reproductive_profiles SET pregnancy_status=? WHERE character_id=? AND pregnancy_status='active'",[b.status,id]);
  if(changed.affectedRows)await pool.execute('INSERT INTO character_reproductive_events(character_id,actor_account_id,action,summary) VALUES(?,?,?,?)',
   [id,actor.id,'pregnancy_'+b.status,b.status==='completed'?'Delivery recorded':'Pregnancy record ended']);
  return changed.affectedRows?ok({status:b.status}):fail(409,'no_active_pregnancy');
 }
 if(action==='roll'&&req.method==='POST'){
  if(!UUID.test(b?.event_key)||!validDate(b?.ic_event_date))return fail(400,'invalid_event');
  const db=await pool.getConnection();
  try{
   await db.beginTransaction();
   const [[existing]]=await db.execute('SELECT * FROM character_conception_rolls WHERE character_id=? AND event_key=?',[id,b.event_key]);
   if(existing){await db.commit();return ok({roll:existing,replayed:true})}
   const [[current]]=await db.execute('SELECT * FROM character_reproductive_profiles WHERE character_id=? FOR UPDATE',[id]);
   const [[afterLock]]=await db.execute('SELECT * FROM character_conception_rolls WHERE character_id=? AND event_key=?',[id,b.event_key]);
   if(afterLock){await db.commit();return ok({roll:afterLock,replayed:true})}
   const [[sameDay]]=await db.execute('SELECT id FROM character_conception_rolls WHERE character_id=? AND ic_event_date=? LIMIT 1',[id,b.ic_event_date]);
   if(sameDay){await db.rollback();return fail(409,'conception_event_already_recorded_today')}
   if(!current?.conception_opt_in){await db.rollback();return fail(403,'conception_roll_not_approved')}
   if(current.pregnancy_status==='active'){await db.rollback();return fail(409,'pregnancy_already_active')}
   const settings=safeProfile(current),status=cycleStatus({...settings,cycle_anchor:settings.cycle_anchor||dateKey(character.created_at)},Boolean(character.collar_bound),character.rank_code);
   const chance=conceptionChance(settings,status),value=randomInt(1,101),success=value<=chance;
   const [insert]=await db.execute(`INSERT INTO character_conception_rolls(character_id,event_key,actor_account_id,ic_event_date,roll_d100,chance,success,rank_code,cycle_phase)
    VALUES(?,?,?,?,?,?,?,?,?)`,[id,b.event_key,actor.id,b.ic_event_date,value,chance,success,character.rank_code||null,status.phase]);
   if(success)await db.execute(`UPDATE character_reproductive_profiles SET pregnancy_status='active',pregnancy_anchor=?,pregnancy_start_day=0,pregnancy_total_days=280,pregnancy_notes='' WHERE character_id=?`,[b.ic_event_date,id]);
   await db.execute('INSERT INTO character_reproductive_events(character_id,actor_account_id,action,summary) VALUES(?,?,?,?)',
    [id,actor.id,'conception_roll',success?'Approved conception event established pregnancy':'Approved conception event recorded']);
   await db.commit();
   return ok({roll:{id:insert.insertId,event_key:b.event_key,roll_d100:value,chance,success,rank_code:character.rank_code||null,cycle_phase:status.phase},replayed:false});
  }catch(error){await db.rollback().catch(()=>{});throw error}finally{db.release()}
 }
 return fail(404,'action_not_found');
}
