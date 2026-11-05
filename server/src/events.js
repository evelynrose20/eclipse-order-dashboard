import {randomUUID} from 'node:crypto';
import {resolveSession} from './auth.js';
import {err,ok,read,gm,getEvent,hasAccess,canParticipate,unpack,uuid} from './encounters.js';

export async function eventRoute(pool,req,path){
 if(!pool)return err(503,'database_unavailable');
 const u=await resolveSession(pool,req);if(!u)return err(401,'not_authenticated');
 const byEvent=/^\/events\/([a-f0-9-]{36})\/signups$/.exec(path);
 if(byEvent){
  const e=await getEvent(pool,byEvent[1]);
  if(!e||!await hasAccess(pool,u,e))return err(404,'event_not_found');
  const director=gm(u,e);
  if(req.method==='GET'){
   const [rows]=director?await pool.execute(
    'SELECT s.*,c.character_name AS character_name FROM order_event_signups s JOIN characters c ON c.id=s.character_id WHERE s.encounter_id=? ORDER BY s.created_at DESC',[e.id]
   ):await pool.execute(
    'SELECT s.*,c.character_name AS character_name FROM order_event_signups s JOIN characters c ON c.id=s.character_id WHERE s.encounter_id=? AND s.player_user_id=? ORDER BY s.created_at DESC',[e.id,u.id]);
   return ok(rows.map(r=>({...r,mine:r.player_user_id===u.id})));
  }
  if(req.method==='POST'){
   if(!e.published||e.status!=='draft')return err(409,'event_not_accepting_signups');
   if(e.created_by===u.id)return err(403,'event_director_cannot_join_party');
   const b=await read(req);
   if(!uuid(b?.character_id))return err(400,'character_required');
   const [chars]=await pool.execute('SELECT player_account_id FROM characters WHERE id=?',[b.character_id]);
   if(chars[0]?.player_account_id!==u.id)return err(403,'must_use_own_character');
   const [prefs]=await pool.execute('SELECT adult_declaration,content_preferences FROM order_profile_preferences WHERE user_id=?',[u.id]);
   if(!prefs.length||!prefs[0].adult_declaration)return err(403,'adult_declaration_required');
   const themes=unpack(e.themes)||[],categories=unpack(prefs[0].content_preferences)||{};
   if(themes.some(t=>categories[t]!==true))return err(403,'content_preferences_not_compatible');
   const [existing]=await pool.execute('SELECT id,status FROM order_event_signups WHERE encounter_id=? AND player_user_id=?',[e.id,u.id]);
   if(existing.length)return err(409,'already_signed_up');
   const id=randomUUID();
   await pool.execute('INSERT INTO order_event_signups(id,encounter_id,character_id,player_user_id) VALUES(?,?,?,?)',[id,e.id,b.character_id,u.id]);
   return ok({id},201);
  }
 }
 const action=/^\/signups\/([a-f0-9-]{36})\/(decide|withdraw|add-player)$/.exec(path);
 if(action&&req.method==='POST'){
  const [,id,type]=action;
  const [rows]=await pool.execute('SELECT s.*,e.created_by,e.status AS event_status,e.capacity FROM order_event_signups s JOIN order_encounters e ON e.id=s.encounter_id WHERE s.id=?',[id]);
  const s=rows[0];if(!s)return err(404,'signup_not_found');
  const director=gm(u,s);
  if(type==='withdraw'){
   if(s.player_user_id!==u.id)return err(403,'only_owner_can_withdraw');
   if(!['requested','approved'].includes(s.status))return err(409,'invalid_signup_state');
   await pool.execute('UPDATE order_event_signups SET status="withdrawn" WHERE id=?',[id]);
   return ok({status:'withdrawn'});
  }
  if(!director)return err(403,'director_required');
  if(type==='decide'){
   if(s.status!=='requested')return err(409,'signup_not_pending');
   const b=await read(req);
   if(typeof b?.approved!=='boolean')return err(400,'invalid_decision');
   if(b.approved){
    const [count]=await pool.execute('SELECT COUNT(*) AS n FROM order_event_signups WHERE encounter_id=? AND status="approved"',[s.encounter_id]);
    if(Number(count[0].n)>=Number(s.capacity))return err(409,'event_full');
   }
   await pool.execute('UPDATE order_event_signups SET status=? WHERE id=?',[b.approved?'approved':'declined',id]);
   return ok({status:b.approved?'approved':'declined'});
  }
  if(type==='add-player'){
   if(s.player_user_id===s.created_by)return err(403,'event_director_cannot_join_party');
   if(s.status!=='approved'||s.event_status!=='draft')return err(409,'signup_not_approved_or_event_started');
   const [characters]=await pool.execute('SELECT * FROM characters WHERE id=? AND player_account_id=?',[s.character_id,s.player_user_id]);
   if(!characters.length)return err(409,'character_no_longer_owned');
   const [already]=await pool.execute('SELECT id FROM order_combatants WHERE encounter_id=? AND character_id=?',[s.encounter_id,s.character_id]);
   if(already.length)return err(409,'already_in_party');
   const ch=characters[0],data=unpack(ch.sheet_json)||{};
   const id2=randomUUID(),hp=Math.min(999999,Math.max(1,Number(data.max_hp||data.hp||20))),ac=Math.min(99,Math.max(0,Number(data.armor_class||10)));
   await pool.execute('INSERT INTO order_combatants(id,encounter_id,name,kind,character_id,initiative,hp,max_hp,ac,conditions) VALUES(?,?,?,?,?,?,?,?,?,?)',
    [id2,s.encounter_id,ch.character_name,'player',ch.id,0,hp,hp,ac,'[]']);
   return ok({id:id2});
  }
 }
 return err(404,'not_found');
}
