import {randomUUID,randomInt} from 'node:crypto';
import {resolveSession} from './auth.js';
import {err,ok,read,gm,getEvent,canParticipate,hasAccess,int,unpack,text,uuid} from './encounters.js';

function roll(formula){
 const f=String(formula||'').toLowerCase().replace(/\s+/g,'');
 const m=/^([1-9]\d?)d(4|6|8|10|12|20|100)(kh1|kl1)?([+-]\d{1,2})?$/.exec(f);
 if(!m)return null;
 const count=Number(m[1]),sides=Number(m[2]),mode=m[3],mod=Number(m[4]||0);
 if(count>20||(mode&&(count!==2||sides!==20)))return null;
 const rolls=Array.from({length:count},()=>randomInt(1,sides+1));
 const sum=mode==='kh1'?Math.max(...rolls):mode==='kl1'?Math.min(...rolls):rolls.reduce((a,b)=>a+b,0);
 return {formula:f,rolls,total:sum+mod};
}
async function createRoll(pool,user,encounterId,b,privateAllowed){
 const r=roll(b?.formula);if(!r)return err(400,'invalid_dice_formula');
 const visibility=b.visibility==='gm_private'?'gm_private':'public';
 if(visibility==='gm_private'&&!privateAllowed)return err(403,'gm_only_roll');
 const kinds=new Set(['custom','attack','damage','healing','ability','saving_throw','skill','contest','concentration']);
 const kind=kinds.has(b.kind)?b.kind:'custom';
 const dc=b.target_dc==null?null:int(b.target_dc,0,99);
 if(b.target_dc!=null&&dc===null)return err(400,'invalid_target_dc');
 let outcome=null;
 if(dc!==null)outcome=r.total>=dc?'success':'failure';
 const [insert]=await pool.execute('INSERT INTO order_encounter_rolls(encounter_id,rolled_by,formula,rolls,total,visibility,kind,target_combatant_id,target_dc,outcome) VALUES(?,?,?,?,?,?,?,?,?,?)',
  [encounterId,user.id,r.formula,JSON.stringify(r.rolls),r.total,visibility,kind,uuid(b.target_id)?b.target_id:null,dc,outcome]);
 return ok({...r,id:insert.insertId,kind,visibility,target_dc:dc,outcome,rolled_by:user.id});
}
async function canRoll(pool,u,e){
 if(!gm(u,e)&&!await canParticipate(pool,u,e))return false;
 if(e.status!=='active')return false;
 const [prefs]=await pool.execute('SELECT adult_declaration,content_preferences FROM order_profile_preferences WHERE user_id=?',[u.id]);
 const categories=prefs[0]?unpack(prefs[0].content_preferences)||{}:{};
 if(!prefs[0]?.adult_declaration||(unpack(e.themes)||[]).some(t=>categories[t]!==true))return false;
 const [paused]=await pool.execute('SELECT 1 FROM order_encounter_pauses WHERE encounter_id=? AND paused=1 LIMIT 1',[e.id]);
 return paused.length===0;
}
export async function diceRoute(pool,req,path){
 if(!pool)return err(503,'database_unavailable');
 const u=await resolveSession(pool,req);
 if(!u)return err(401,'not_authenticated');
 const rolls=/^\/encounters\/([a-f0-9-]{36})\/rolls$/.exec(path);
 if(rolls){
  const e=await getEvent(pool,rolls[1]);
  if(!e||!await hasAccess(pool,u,e))return err(404,'encounter_not_found');
  if(req.method==='GET'){
   const [rows]=gm(u,e)?await pool.execute('SELECT * FROM order_encounter_rolls WHERE encounter_id=? ORDER BY id DESC LIMIT 150',[e.id]):
    await pool.execute('SELECT * FROM order_encounter_rolls WHERE encounter_id=? AND visibility="public" ORDER BY id DESC LIMIT 150',[e.id]);
   return ok(rows.reverse().map(r=>({...r,rolls:unpack(r.rolls)})));
  }
  if(req.method==='POST'){
   if(!await canRoll(pool,u,e))return err(403,'encounter_not_active_or_paused');
   const b=await read(req);
   return createRoll(pool,u,e.id,b,gm(u,e));
  }
 }
 const requests=/^\/encounters\/([a-f0-9-]{36})\/roll-requests$/.exec(path);
 if(requests){
  const e=await getEvent(pool,requests[1]);
  if(!e||!await hasAccess(pool,u,e))return err(404,'encounter_not_found');
  const director=gm(u,e);
  if(req.method==='GET'){
   const [rows]=director?await pool.execute('SELECT r.*,c.character_name AS name,rr.total AS result_total FROM order_roll_requests r JOIN characters c ON c.id=r.character_id LEFT JOIN order_encounter_rolls rr ON rr.id=r.result_roll_id WHERE r.encounter_id=? ORDER BY r.created_at DESC',[e.id]):
    await pool.execute('SELECT r.*,c.character_name AS name,rr.total AS result_total FROM order_roll_requests r JOIN characters c ON c.id=r.character_id LEFT JOIN order_encounter_rolls rr ON rr.id=r.result_roll_id WHERE r.encounter_id=? AND r.player_user_id=? ORDER BY r.created_at DESC',[e.id,u.id]);
   return ok(rows);
  }
  if(req.method==='POST'){
   if(!director||e.status!=='active')return err(403,'active_director_required');
   const b=await read(req),dice=roll(b?.formula),dc=int(b?.dc,0,99),label=text(b?.label,100);
   if(!dice||!label||dc===null||!uuid(b?.character_id))return err(400,'invalid_roll_request');
   const [chars]=await pool.execute('SELECT player_account_id FROM characters WHERE id=?',[b.character_id]);
   if(!chars[0]?.player_account_id)return err(404,'linked_player_required');
   if(chars[0].player_account_id===e.created_by)return err(403,'event_director_cannot_roll_as_player');
   const [party]=await pool.execute('SELECT id FROM order_combatants WHERE encounter_id=? AND character_id=?',[e.id,b.character_id]);
   if(!party.length)return err(403,'character_not_in_party');
   const id=randomUUID();
   await pool.execute('INSERT INTO order_roll_requests(id,encounter_id,character_id,player_user_id,requested_by,label,kind,formula,dc) VALUES(?,?,?,?,?,?,?,?,?)',
    [id,e.id,b.character_id,chars[0].player_account_id,u.id,label,text(b.kind,30)||'custom',dice.formula,dc]);
   return ok(id,201);
  }
 }
 const action=/^\/roll-requests\/([a-f0-9-]{36})\/(resolve|cancel)$/.exec(path);
 if(action&&req.method==='POST'){
  const [,id,task]=action;
  const [rows]=await pool.execute('SELECT r.*,e.status AS event_status,e.created_by FROM order_roll_requests r JOIN order_encounters e ON e.id=r.encounter_id WHERE r.id=?',[id]);
  const r=rows[0];if(!r)return err(404,'roll_request_missing');
  if(r.state!=='pending')return err(409,'request_not_pending');
  const direct=gm(u,r);
  if(task==='cancel'){
   if(!direct&&r.player_user_id!==u.id)return err(403,'forbidden');
   await pool.execute('UPDATE order_roll_requests SET state="cancelled" WHERE id=? AND state="pending"',[id]);
   return ok({status:'cancelled'});
  }
  if(r.player_user_id===r.created_by)return err(403,'event_director_cannot_roll_as_player');
  if(r.player_user_id!==u.id||r.event_status!=='active')return err(403,'player_must_roll_during_active_encounter');
  const [pauses]=await pool.execute('SELECT 1 FROM order_encounter_pauses WHERE encounter_id=? AND paused=1',[r.encounter_id]);
  if(pauses.length)return err(409,'encounter_paused');
  const out=await createRoll(pool,u,r.encounter_id,{formula:r.formula,kind:r.kind,target_dc:r.dc,visibility:'public'},false);
  if(out.status!==200)return out;
  await pool.execute('UPDATE order_roll_requests SET state="resolved",result_roll_id=? WHERE id=? AND state="pending"',[out.body.id,id]);
  return ok({roll:out.body,dc:r.dc,success:out.body.total>=r.dc});
 }
 const apply=/^\/rolls\/(\d+)\/apply-hp$/.exec(path);
 if(apply&&req.method==='POST'){
  const b=await read(req);
  if(!uuid(b?.combatant_id))return err(400,'combatant_required');
  const [rows]=await pool.execute('SELECT r.*,e.created_by FROM order_encounter_rolls r JOIN order_encounters e ON e.id=r.encounter_id WHERE r.id=?',[Number(apply[1])]);
  const r=rows[0];if(!r||!gm(u,r)||!['damage','healing'].includes(r.kind))return err(403,'damage_or_healing_director_required');
  if(r.hp_applied)return err(409,'already_applied');
  const [targets]=await pool.execute('SELECT id FROM order_combatants WHERE id=? AND encounter_id=?',[b.combatant_id,r.encounter_id]);
  if(!targets.length)return err(404,'target_not_found');
  const cn=await pool.getConnection();
  try{
   await cn.beginTransaction();
   const [claim]=await cn.execute('UPDATE order_encounter_rolls SET hp_applied=1 WHERE id=? AND hp_applied=0',[r.id]);
   if(claim.affectedRows!==1){await cn.rollback();return err(409,'already_applied')}
   await cn.execute('UPDATE order_combatants SET hp=LEAST(max_hp,GREATEST(0,hp+?)) WHERE id=?',
    [r.kind==='healing'?r.total:-r.total,b.combatant_id]);
   const [[hp]]=await cn.execute('SELECT hp FROM order_combatants WHERE id=?',[b.combatant_id]);
   await cn.commit();
   return ok(hp.hp);
  }catch(e){await cn.rollback();throw e}finally{cn.release()}
 }
 return err(404,'not_found');
}
