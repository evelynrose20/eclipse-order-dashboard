import {randomUUID,randomInt} from 'node:crypto';
import {resolveSession} from './auth.js';
import {readEventStory,sanitizeEventStory} from './event-story.js';
import {normalizedPosition,validateWaymarks} from './map-state.js';

export const err=(status,error)=>({status,body:{error}});
export const ok=(body,status=200)=>({status,body});
export const unpack=v=>typeof v==='string'?JSON.parse(v):v;
export const command=u=>['domina','high_command'].includes(u.account_role);
export const gm=(u,e)=>command(u)||(u.account_role==='handler'&&e.created_by===u.id);
export async function read(req){
 let n=0;const chunks=[];
 for await(const c of req){n+=c.length;if(n>24000)throw Object.assign(new Error('request_too_large'),{status:413});chunks.push(c)}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw Object.assign(new Error('invalid_json'),{status:400})}
}
export const uuid=s=>/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(s||'');
export const text=(s,n)=>typeof s==='string'?s.trim().slice(0,n):'';
export const int=(x,min,max)=>Number.isInteger(Number(x))&&Number(x)>=min&&Number(x)<=max?Number(x):null;
export async function getEvent(pool,id){const [rows]=await pool.execute('SELECT * FROM order_encounters WHERE id=?',[id]);return rows[0]||null}
export async function hasAccess(pool,u,event){
 if(!event)return false;
 if(gm(u,event))return true;
 if(event.archived_at)return false;
 if(event.published)return true;
 const [party]=await pool.execute('SELECT 1 FROM order_combatants b JOIN characters c ON c.id=b.character_id WHERE b.encounter_id=? AND c.player_account_id=? LIMIT 1',[event.id,u.id]);
 return party.length>0;
}
export async function canParticipate(pool,u,event){
 const [party]=await pool.execute('SELECT 1 FROM order_combatants b JOIN characters c ON c.id=b.character_id WHERE b.encounter_id=? AND c.player_account_id=? LIMIT 1',[event.id,u.id]);
 return party.length>0;
}
async function shape(pool,u,e){
 const [combatants]=await pool.execute('SELECT * FROM order_combatants WHERE encounter_id=? ORDER BY initiative DESC,created_at ASC',[e.id]);
 const [approved]=await pool.execute('SELECT COUNT(*) AS n FROM order_event_signups WHERE encounter_id=? AND status="approved"',[e.id]);
 const [pending]=gm(u,e)?await pool.execute('SELECT COUNT(*) AS n FROM order_event_signups WHERE encounter_id=? AND status="requested"',[e.id]):[[{n:0}]];
 return {id:e.id,name:e.name,notes:gm(u,e)?e.notes:'',themes:unpack(e.themes),created_by:e.created_by,
  status:e.status,archived_at:e.archived_at||null,turn_index:e.turn_index,round_number:e.round_number,
  map_columns:e.map_columns,map_rows:e.map_rows,map_style:e.map_style,map_image_url:e.map_image_url,waymarks:unpack(e.waymarks)||{},
  starts_at:e.starts_at,location:e.location,description:e.description,capacity:e.capacity,published:Boolean(e.published),
  event_story:e.event_story?readEventStory(e.event_story):null,
  signup_count:Number(approved[0].n),pending_count:Number(pending[0].n),combatants:combatants.map(c=>({...c,conditions:unpack(c.conditions),notes:gm(u,e)?c.notes:null}))};
}
export async function encounterRoute(pool,req,path){
 if(!pool)return err(503,'database_unavailable');
 const u=await resolveSession(pool,req);
 if(!u)return err(401,'not_authenticated');
 if(path==='/encounters'&&req.method==='GET'){
  const [all]=await pool.query('SELECT * FROM order_encounters ORDER BY created_at DESC LIMIT 100');
  const visible=[];
  for(const e of all)if(await hasAccess(pool,u,e))visible.push(await shape(pool,u,e));
  return ok(visible);
 }
 if(path==='/encounters'&&req.method==='POST'){
  if(!['domina','high_command','handler'].includes(u.account_role))return err(403,'director_required');
  const b=await read(req);
  const name=text(b?.name,140);
  if(name.length<2||!Array.isArray(b.themes)||b.themes.length>30)return err(400,'invalid_encounter');
  const id=randomUUID();
  await pool.execute('INSERT INTO order_encounters(id,name,notes,themes,created_by,description) VALUES(?,?,?,?,?,?)',
   [id,name,text(b.notes,5000),JSON.stringify(b.themes.filter(x=>typeof x==='string').slice(0,30)),u.id,text(b.notes,2400)]);
  return ok(id,201);
 }
 const route=/^\/encounters\/([a-f0-9-]{36})(?:\/(turn|map|image|waymarks|plan|state|check|pause|initiative|archive|restore))?$/.exec(path);
 if(route){
  const [,id,action]=route,e=await getEvent(pool,id);
  if(!e||!await hasAccess(pool,u,e))return err(404,'encounter_not_found');
  const director=gm(u,e);
  if(!action&&req.method==='GET')return ok(await shape(pool,u,e));
  if(action==='check'&&req.method==='GET'){
   const [paused]=await pool.execute('SELECT paused FROM order_encounter_pauses WHERE encounter_id=? AND user_id=?',[id,u.id]);
   const [prefs]=await pool.execute('SELECT adult_declaration,content_preferences FROM order_profile_preferences WHERE user_id=?',[u.id]);
   const adult=Boolean(prefs[0]?.adult_declaration),content=prefs[0]?unpack(prefs[0].content_preferences):{};
   const missing=(unpack(e.themes)||[]).filter(theme=>content?.[theme]!==true);
   return ok({adult_declaration:adult,paused:!!paused[0]?.paused,missing_themes:missing,can_direct:director,eligible:await canParticipate(pool,u,e),is_director:e.created_by===u.id});
  }
  if(action==='pause'&&req.method==='POST'){
   if(!await canParticipate(pool,u,e))return err(403,'participant_required');
   const b=await read(req);
   if(typeof b?.paused!=='boolean')return err(400,'invalid_pause');
   await pool.execute('INSERT INTO order_encounter_pauses(encounter_id,user_id,paused) VALUES(?,?,?) ON DUPLICATE KEY UPDATE paused=VALUES(paused)',[id,u.id,b.paused?1:0]);
   return ok({status:'saved'});
  }
  if(!director)return err(403,'director_required');
  if(!action&&req.method==='DELETE'){
   if(!e.archived_at)return err(409,'archive_before_delete');
   const [result]=await pool.execute('DELETE FROM order_encounters WHERE id=? AND archived_at IS NOT NULL',[id]);
   return result.affectedRows?ok({status:'deleted'}):err(409,'scene_changed_retry');
  }
  if(req.method!=='POST')return err(405,'method_not_allowed');
  if(action==='archive'){
   if(e.archived_at)return err(409,'already_archived');
   if(['active','paused'].includes(e.status))return err(409,'finish_encounter_before_archive');
   const [result]=await pool.execute('UPDATE order_encounters SET archived_at=UTC_TIMESTAMP() WHERE id=? AND archived_at IS NULL AND status NOT IN ("active","paused")',[id]);
   return result.affectedRows?ok({status:'archived'}):err(409,'scene_changed_retry');
  }
  if(action==='restore'){
   if(!e.archived_at)return err(409,'scene_not_archived');
   await pool.execute('UPDATE order_encounters SET archived_at=NULL WHERE id=? AND archived_at IS NOT NULL',[id]);
   return ok({status:'restored'});
  }
  if(e.archived_at)return err(409,'encounter_archived');
  const b=await read(req);
  if(action==='plan'){
   const name=text(b?.name,140),description=text(b?.description,2400),location=text(b?.location,160);
   const capacity=int(b?.capacity,1,60);
   const eventStory=sanitizeEventStory(b?.event_story??readEventStory(e.event_story));
   if(!eventStory)return err(400,'invalid_event_story');
   if(name.length<2||capacity===null||!Array.isArray(b?.themes)||b.themes.length>30)return err(400,'invalid_event_details');
   const when=b.starts_at?new Date(b.starts_at):null;
   if(when&&!Number.isFinite(when.getTime()))return err(400,'invalid_event_date');
   await pool.execute('UPDATE order_encounters SET name=?,description=?,location=?,starts_at=?,capacity=?,published=?,themes=?,event_story=? WHERE id=?',
    [name,description,location,when?when.toISOString().slice(0,19).replace('T',' '):null,capacity,b.published?1:0,JSON.stringify(b.themes),JSON.stringify(eventStory),id]);
   return ok({status:'saved'});
  }
  if(action==='state'){
   if(!['draft','active','paused','completed'].includes(b?.state))return err(400,'invalid_state');
   await pool.execute('UPDATE order_encounters SET status=? WHERE id=?',[b.state,id]);
   return ok({status:'saved'});
  }
  if(action==='turn'){
   if(!['next','previous','reset','start','finish'].includes(b?.action))return err(400,'invalid_turn_action');
   if(b.action==='finish'){await pool.execute('UPDATE order_encounters SET status="completed" WHERE id=?',[id]);return ok({status:'completed'});}
   if(b.action==='start'){
    if(e.status!=='draft')return err(409,'already_started');
    const [existing]=await pool.execute('SELECT id FROM order_combatants WHERE encounter_id=? LIMIT 1',[id]);
    if(!existing.length)return err(409,'no_combatants');
    await pool.execute('UPDATE order_encounters SET status="active",turn_index=0,round_number=1 WHERE id=?',[id]);
    return ok({status:'active'});
   }
   const [combatants]=await pool.execute('SELECT id FROM order_combatants WHERE encounter_id=? ORDER BY initiative DESC,created_at ASC',[id]);
   const n=combatants.length;
   if(!n)return err(409,'no_combatants');
   const current=Number(e.turn_index);
   const next=b.action==='reset'?0:b.action==='previous'?(current+n-1)%n:(current+1)%n;
   const round=b.action==='reset'?1:b.action==='next'&&next===0?Number(e.round_number)+1:Math.max(1,Number(e.round_number)-(b.action==='previous'&&current===0?1:0));
   await pool.execute('UPDATE order_encounters SET turn_index=?,round_number=? WHERE id=?',[next,round,id]);
   return ok({turn_index:next,round_number:round});
  }
  if(action==='map'){
   const columns=int(b?.columns,8,30),rows=int(b?.rows,6,20);
   if(columns===null||rows===null||!['dungeon','forest','parchment'].includes(b?.style))return err(400,'invalid_map');
   await pool.execute('UPDATE order_encounters SET map_columns=?,map_rows=?,map_style=? WHERE id=?',[columns,rows,b.style,id]);
   return ok({status:'saved'});
  }
  if(action==='waymarks'){
   const waymarks=validateWaymarks(b?.waymarks);
   if(waymarks===null)return err(400,'invalid_waymarks');
   await pool.execute('UPDATE order_encounters SET waymarks=? WHERE id=?',[JSON.stringify(waymarks),id]);
   return ok({waymarks});
  }
  if(action==='image'){
   const image=text(b?.image_url,1200);
   if(image&&!/^https:\/\/[^\s"'<>]+$/.test(image))return err(400,'https_image_required');
   await pool.execute('UPDATE order_encounters SET map_image_url=? WHERE id=?',[image||null,id]);
   return ok({status:'saved'});
  }
  if(action==='initiative'){
   const [rows]=await pool.execute('SELECT id FROM order_combatants WHERE encounter_id=?',[id]);
   for(const c of rows)await pool.execute('UPDATE order_combatants SET initiative=? WHERE id=?',[randomInt(1,21),c.id]);
   await pool.execute('UPDATE order_encounters SET turn_index=0,round_number=1 WHERE id=?',[id]);
   return ok({status:'rolled'});
  }
 }
 if(path==='/combatants'&&req.method==='POST'){
  const b=await read(req),e=await getEvent(pool,b?.encounter_id);
  if(!e||!gm(u,e))return err(403,'director_required');
  if(e.archived_at)return err(409,'encounter_archived');
  const name=text(b?.name,120),hp=int(b?.hp,1,999999),ac=int(b?.ac,0,99),initiative=int(b?.initiative,-100,100);
  if(!name||hp===null||ac===null||initiative===null||!['npc','player','ally'].includes(b?.kind))return err(400,'invalid_combatant');
  let charId=null;
  if(b.kind==='player'){
   const [characters]=await pool.execute('SELECT id,player_account_id FROM characters WHERE id=?',[b.character_id]);
   if(!characters.length||!characters[0].player_account_id)return err(400,'linked_character_required');
   charId=characters[0].id;
  }
  const id=randomUUID();
  await pool.execute('INSERT INTO order_combatants(id,encounter_id,name,kind,character_id,initiative,hp,max_hp,ac,conditions) VALUES(?,?,?,?,?,?,?,?,?,?)',
   [id,e.id,name,b.kind,charId,initiative,hp,hp,ac,'[]']);
  return ok(id,201);
 }
 const combat=/^\/combatants\/([a-f0-9-]{36})(?:\/(move|hp))?$/.exec(path);
 if(combat){
  const [,id,action]=combat;
  const [rows]=await pool.execute('SELECT c.*,e.created_by,e.archived_at FROM order_combatants c JOIN order_encounters e ON e.id=c.encounter_id WHERE c.id=?',[id]);
  const c=rows[0];if(!c||!gm(u,c))return err(403,'director_required');
  if(c.archived_at)return err(409,'encounter_archived');
  if(req.method!=='POST'&&req.method!=='DELETE')return err(405,'method_not_allowed');
  if(req.method==='DELETE'){await pool.execute('DELETE FROM order_combatants WHERE id=?',[id]);return ok({status:'deleted'})}
  const b=await read(req);
  if(action==='move'){
   const point=normalizedPosition(b?.x,b?.y);
   if(!point)return err(400,'invalid_coordinates');
   await pool.execute('UPDATE order_combatants SET pos_x=?,pos_y=?,tile_x=NULL,tile_y=NULL WHERE id=?',[point.x,point.y,id]);
   return ok({status:'saved'});
  }
  if(action==='hp'){
   const delta=int(b?.delta,-999999,999999);
   if(delta===null)return err(400,'invalid_delta');
   await pool.execute('UPDATE order_combatants SET hp=LEAST(max_hp,GREATEST(0,hp+?)) WHERE id=?',[delta,id]);
   return ok({status:'saved'});
  }
  const hp=int(b?.hp,0,999999),initiative=int(b?.initiative,-100,100),ac=int(b?.ac,0,99);
  if(hp===null||initiative===null||ac===null||!Array.isArray(b?.conditions)||b.conditions.length>30)return err(400,'invalid_combatant');
  await pool.execute('UPDATE order_combatants SET hp=?,initiative=?,ac=?,conditions=? WHERE id=?',
   [hp,initiative,ac,JSON.stringify(b.conditions.filter(x=>typeof x==='string'&&x.length<50)),id]);
  return ok({status:'saved'});
 }
 const monsterEditor=['domina','high_command','handler'].includes(u.account_role);
 if(path==='/monsters'&&req.method==='GET'){
  if(!monsterEditor)return err(403,'director_required');
  const [rows]=await pool.query('SELECT * FROM order_monster_templates ORDER BY name LIMIT 200');
  return ok(rows);
 }
 if(path==='/monsters'&&req.method==='POST'){
  if(!monsterEditor)return err(403,'director_required');
  const b=await read(req);
  const name=text(b?.name,120),hp=int(b?.hit_points,1,999999),ac=int(b?.armor_class,0,99),bonus=int(b?.initiative_bonus,-100,100);
  if(!name||hp===null||ac===null||bonus===null)return err(400,'invalid_monster');
  const id=randomUUID();
  await pool.execute('INSERT INTO order_monster_templates(id,name,challenge,hit_points,armor_class,initiative_bonus,actions,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?)',
   [id,name,text(b.challenge,40)||'Custom',hp,ac,bonus,text(b.actions,5000),text(b.notes,5000),u.id]);
  return ok(id,201);
 }
 const monsterRoute=/^\/monsters\/([a-f0-9-]{36})$/.exec(path);
 if(monsterRoute){
  if(!monsterEditor)return err(403,'director_required');
  const [owned]=await pool.execute('SELECT created_by FROM order_monster_templates WHERE id=?',[monsterRoute[1]]);
  if(!owned.length)return err(404,'monster_not_found');
  if(!command(u)&&owned[0].created_by!==u.id)return err(403,'monster_owner_required');
  if(req.method==='DELETE'){
   await pool.execute('DELETE FROM order_monster_templates WHERE id=?',[monsterRoute[1]]);
   return ok({status:'deleted'});
  }
  if(req.method!=='PUT')return err(405,'method_not_allowed');
  const b=await read(req);
  const name=text(b?.name,120),hp=int(b?.hit_points,1,999999),ac=int(b?.armor_class,0,99),bonus=int(b?.initiative_bonus,-100,100);
  if(!name||hp===null||ac===null||bonus===null)return err(400,'invalid_monster');
  await pool.execute('UPDATE order_monster_templates SET name=?,challenge=?,hit_points=?,armor_class=?,initiative_bonus=?,actions=?,notes=? WHERE id=?',
   [name,text(b.challenge,40)||'Custom',hp,ac,bonus,text(b.actions,5000),text(b.notes,5000),monsterRoute[1]]);
  return ok({status:'saved'});
 }
 const addMonster=/^\/encounters\/([a-f0-9-]{36})\/monsters\/([a-f0-9-]{36})$/.exec(path);
 if(addMonster&&req.method==='POST'){
  const e=await getEvent(pool,addMonster[1]);
  if(!e||!gm(u,e))return err(403,'director_required');
  if(e.archived_at)return err(409,'encounter_archived');
  const b=await read(req);
  const kind=b?.kind==='ally'?'ally':b?.kind==='npc'||b?.kind===undefined?'npc':null;
  if(!kind)return err(400,'invalid_combatant');
  const [monsters]=await pool.execute('SELECT * FROM order_monster_templates WHERE id=?',[addMonster[2]]);
  const m=monsters[0];if(!m)return err(404,'monster_not_found');
  const id=randomUUID();
  await pool.execute('INSERT INTO order_combatants(id,encounter_id,name,kind,initiative,hp,max_hp,ac,conditions,monster_template_id,actions,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
   [id,e.id,m.name,kind,m.initiative_bonus,m.hit_points,m.hit_points,m.armor_class,'[]',m.id,m.actions,m.notes]);
  return ok(id,201);
 }
 return err(404,'not_found');
}
