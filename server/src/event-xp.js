import {resolveSession} from './auth.js';
import {applyExperience} from './progression.js';
import {err,ok,read,gm,getEvent,uuid,unpack} from './encounters.js';

// Participation rewards are never tied to currency or the retired shop.
export async function eventXpRoute(pool,req,path){
 if(!pool)return err(503,'database_unavailable');
 const actor=await resolveSession(pool,req);
 if(!actor)return err(401,'not_authenticated');
 const route=/^\/events\/([a-f0-9-]{36})\/xp(?:\/([a-f0-9-]{36}))?$/.exec(path);
 if(!route)return err(404,'not_found');
 const [,eventId,characterId]=route;
 if(!uuid(eventId)||(characterId&&!uuid(characterId)))return err(400,'invalid_identifier');
 const event=await getEvent(pool,eventId);
 if(!event)return err(404,'event_not_found');
 if(!gm(actor,event))return err(403,'director_required');
 if(!characterId&&req.method==='GET'){
  const [rows]=await pool.execute('SELECT character_id,amount,granted_at FROM order_event_xp_awards WHERE event_id=?',[eventId]);
  return ok({awards:rows});
 }
 if(!characterId||req.method!=='POST')return err(405,'method_not_allowed');
 if(event.status!=='completed')return err(409,'finish_event_before_awarding_xp');
 const body=await read(req),amount=body?.amount;
 if(!Number.isSafeInteger(amount)||amount<1||amount>5000)return err(400,'invalid_experience_amount');
 const connection=await pool.getConnection();
 try{
  await connection.beginTransaction();
  const [eventRows]=await connection.execute('SELECT status FROM order_encounters WHERE id=? FOR UPDATE',[eventId]);
  if(!eventRows.length||eventRows[0].status!=='completed'){await connection.rollback();return err(409,'event_not_completed')}
  const [rows]=await connection.execute('SELECT sheet_json FROM characters WHERE id=? FOR UPDATE',[characterId]);
  if(!rows.length){await connection.rollback();return err(404,'character_not_found')}
  const [participation]=await connection.execute(
   'SELECT 1 FROM order_event_signups WHERE encounter_id=? AND character_id=? AND status="approved" UNION SELECT 1 FROM order_combatants WHERE encounter_id=? AND character_id=? LIMIT 1',
   [eventId,characterId,eventId,characterId]);
  if(!participation.length){await connection.rollback();return err(403,'character_not_in_event')}
  const old=unpack(rows[0].sheet_json);
  if(old.progression_version!==1){await connection.rollback();return err(409,'legacy_character_requires_progression_setup')}
  const [prior]=await connection.execute('SELECT 1 FROM order_event_xp_awards WHERE event_id=? AND character_id=?',[eventId,characterId]);
  if(prior.length){await connection.rollback();return err(409,'event_xp_already_awarded')}
  const next=applyExperience(old,amount);
  await connection.execute('INSERT INTO order_event_xp_awards(event_id,character_id,amount,granted_by) VALUES(?,?,?,?)',[eventId,characterId,amount,actor.id]);
  await connection.execute('UPDATE characters SET sheet_json=? WHERE id=?',[JSON.stringify(next),characterId]);
  await connection.execute('INSERT INTO audit_log(actor_account_id,action,entity_type,entity_id,details_json) VALUES(?,?,?,?,?)',
   [actor.id,'award_event_xp','character',characterId,JSON.stringify({event_id:eventId,amount,level:next.level})]);
  await connection.commit();
  return ok({amount,experience:next.experience,level:next.level});
 }catch(error){
  await connection.rollback().catch(()=>{});
  if(error.code==='ER_DUP_ENTRY')return err(409,'event_xp_already_awarded');
  throw error;
 }finally{connection.release()}
}
