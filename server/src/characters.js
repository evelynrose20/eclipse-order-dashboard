import {randomUUID} from 'node:crypto';
import {resolveSession} from './auth.js';
import {createProgression} from './progression.js';
import {loadClassCatalog,schoolSlots} from './class-catalog.js';

const commands=new Set(['domina','high_command']);
const limit=(s,max)=>typeof s==='string'?s.trim().slice(0,max):'';
const U=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ranks=new Map([
 ['Rank I: Fresh Intake / Unbroken','rank_i'],
 ['Rank II: Initiate / Indentured','rank_ii'],
 ['Rank III: Trusted / Specialized','rank_iii'],
 ['Rank IV: Elite / Favor of the Domina','rank_iv']
]);
const labels=Object.fromEntries([...ranks].map(([name,id])=>[id,name]));
async function payload(req){
 let length=0,parts=[];
 for await(const part of req){length+=part.length;if(length>65536)throw Object.assign(new Error('Request too large'),{status:413});parts.push(part);}
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}
 catch{throw Object.assign(new Error('Invalid JSON'),{status:400})}
}
const err=(status,error)=>({status,body:{error}});
function view(row,account){
 const data=typeof row.sheet_json==='string'?JSON.parse(row.sheet_json):row.sheet_json;
 const record={...data,id:row.id,name:row.character_name,player_user_id:row.player_account_id,
  handler_user_id:row.handler_account_id,collar_bound:Boolean(row.collar_bound),
  rank:row.collar_bound?(labels[row.bound_rank]||labels.rank_i):'Unbound: Free'};
 const full=commands.has(account.account_role)||(account.account_role==='handler'&&row.handler_account_id===account.id)||!row.collar_bound;
 if(full){const {gil,...visible}=record;return {...visible,view_mode:'full'};}
 return {id:record.id,name:record.name,player:record.player||'',owner:record.owner||'',specialty:record.specialty||'',
  rank:record.rank,hp:record.hp,collar_bound:true,player_user_id:row.player_account_id,view_mode:'bound'};
}
export async function characterRoute(pool,req,path){
 if(!pool)return err(503,'database_unavailable');
 const actor=await resolveSession(pool,req);
 if(!actor)return err(401,'not_authenticated');
 if(path==='/characters'&&req.method==='GET'){
  let rows;
  if(commands.has(actor.account_role)) [rows]=await pool.execute('SELECT * FROM characters ORDER BY updated_at DESC');
  else if(actor.account_role==='handler') [rows]=await pool.execute(
   'SELECT * FROM characters WHERE player_account_id=? OR handler_account_id=? ORDER BY updated_at DESC',[actor.id,actor.id]);
  else [rows]=await pool.execute('SELECT * FROM characters WHERE player_account_id=? ORDER BY updated_at DESC',[actor.id]);
  return {status:200,body:rows.map(r=>view(r,actor))};
 }
 if(path==='/characters'&&req.method==='POST'){
  if(!commands.has(actor.account_role))return err(403,'command_required');
  const data=await payload(req);
  const name=limit(data?.name,120);
  if(!name||!data||typeof data!=='object'||Array.isArray(data))return err(400,'invalid_character');
  const owner=typeof data.player_user_id==='string'&&U.test(data.player_user_id)?data.player_user_id:null;
  const handler=typeof data.handler_user_id==='string'&&U.test(data.handler_user_id)?data.handler_user_id:null;
  // Linked players cannot be bound by a direct write; an OOC approval workflow is required.
  const bound=Boolean(data.collar_bound);
  if(bound&&owner)return err(403,'player_approval_required');
  const rank=bound?ranks.get(data.rank)||'rank_i':null;
  const id=randomUUID();
  const catalog=await loadClassCatalog(pool);
  const initial=createProgression(data,catalog[data.class_id]);
  if(initial.error)return err(400,initial.error);
  const {gil:discardedGil,...cleanInitial}=initial;
  const saved={...cleanInitial,id,name,collar_bound:bound,rank:bound?labels[rank]:'Unbound: Free'};
  await pool.execute(
   'INSERT INTO characters(id,character_name,player_account_id,handler_account_id,collar_bound,bound_rank,sheet_json) VALUES(?,?,?,?,?,?,?)',
   [id,name,owner,handler,bound?1:0,rank,JSON.stringify(saved)]);
  return {status:201,body:{id}};
 }
 const spellAction=/^\/characters\/([a-f0-9-]{36})\/(cast|rest)$/.exec(path);
 if(spellAction&&req.method==='POST'){
  const [,id,operation]=spellAction,body=await payload(req);
  const cn=await pool.getConnection();
  try{
   await cn.beginTransaction();
   const [rows]=await cn.execute('SELECT player_account_id,collar_bound,sheet_json FROM characters WHERE id=? FOR UPDATE',[id]);
   const row=rows[0];
   if(!row){await cn.rollback();return err(404,'character_not_found')}
   if(row.collar_bound||row.player_account_id!==actor.id){await cn.rollback();return err(403,'character_owner_required')}
   const sheet=typeof row.sheet_json==='string'?JSON.parse(row.sheet_json):row.sheet_json;
   if(sheet.progression_version!==1){await cn.rollback();return err(409,'character_not_progression_managed')}
   const catalog=await loadClassCatalog(cn),klass=catalog[sheet.class_id];
   if(!klass){await cn.rollback();return err(409,'class_unavailable')}
   const cap=schoolSlots(klass.casting,sheet.level),oldCap=Number.isInteger(sheet.max_spell_points)?sheet.max_spell_points:cap;
   let remaining=Math.min(cap,Number.isInteger(sheet.spell_points)?sheet.spell_points:oldCap);
   let details;
   if(operation==='cast'){
    const spell=klass.spells.find(s=>s.id===body?.spell_id&&s.level<=Number(sheet.level));
    if(!spell){await cn.rollback();return err(403,'spell_not_unlocked')}
    if(remaining<spell.cost){await cn.rollback();return err(409,'insufficient_spell_points')}
    remaining-=spell.cost;
    details={spell_id:spell.id,spell_name:spell.name,cost:spell.cost,remaining};
   }else{
    if(body?.confirm!==true){await cn.rollback();return err(400,'rest_confirmation_required')}
    const [ongoing]=await cn.execute('SELECT 1 FROM order_combatants c JOIN order_encounters e ON e.id=c.encounter_id WHERE c.character_id=? AND e.status IN ("active","paused") LIMIT 1',[id]);
    if(ongoing.length){await cn.rollback();return err(409,'rest_unavailable_during_active_encounter')}
    remaining=cap;
    details={restored_spell_points:cap};
   }
   sheet.spell_points=remaining;sheet.max_spell_points=cap;
   await cn.execute('UPDATE characters SET sheet_json=? WHERE id=?',[JSON.stringify(sheet),id]);
   await cn.execute('INSERT INTO audit_log(actor_account_id,action,entity_type,entity_id,details_json) VALUES(?,?,?,?,?)',
    [actor.id,operation==='cast'?'cast_class_spell':'long_rest','character',id,JSON.stringify(details)]);
   await cn.commit();return {status:200,body:{...details,remaining,max:cap}};
  }catch(error){await cn.rollback().catch(()=>{});throw error}finally{cn.release()}
 }
 const allocation=/^\/characters\/([a-f0-9-]{36})\/ability$/.exec(path);
 if(allocation&&req.method==='POST'){
  const data=await payload(req),ability=data?.ability;
  if(!['str','dex','con','int','wis','cha'].includes(ability))return err(400,'invalid_ability');
  const cn=await pool.getConnection();
  try{
   await cn.beginTransaction();
   const [rows]=await cn.execute('SELECT player_account_id,collar_bound,sheet_json FROM characters WHERE id=? FOR UPDATE',[allocation[1]]);
   const row=rows[0];
   if(!row){await cn.rollback();return err(404,'character_not_found')}
   if(!commands.has(actor.account_role)&&(row.player_account_id!==actor.id||row.collar_bound)){
    await cn.rollback();return err(403,'forbidden');
   }
   const sheet=typeof row.sheet_json==='string'?JSON.parse(row.sheet_json):row.sheet_json;
   if(sheet.progression_version!==1||!Number.isInteger(sheet.ability_points)||sheet.ability_points<1){
    await cn.rollback();return err(409,'no_ability_points_available');
   }
   if(!Number.isInteger(sheet[ability])||sheet[ability]>=20){
    await cn.rollback();return err(409,'ability_at_maximum');
   }
   sheet[ability]+=1;sheet.ability_points-=1;
   await cn.execute('UPDATE characters SET sheet_json=? WHERE id=?',[JSON.stringify(sheet),allocation[1]]);
   await cn.execute('INSERT INTO audit_log(actor_account_id,action,entity_type,entity_id,details_json) VALUES(?,?,?,?,?)',
    [actor.id,'spend_ability_point','character',allocation[1],JSON.stringify({ability,new_value:sheet[ability]})]);
   await cn.commit();return {status:200,body:{ability,score:sheet[ability],remaining:sheet.ability_points}};
  }catch(error){await cn.rollback().catch(()=>{});throw error}finally{cn.release()}
 }
 const promotion=/^\/characters\/([a-f0-9-]{36})\/rank$/.exec(path);
 if(promotion&&req.method==='POST'){
  if(!commands.has(actor.account_role))return err(403,'command_required');
  const data=await payload(req),rankId=data?.rank;
  if(!['rank_i','rank_ii','rank_iii','rank_iv'].includes(rankId))return err(400,'invalid_rank');
  const cn=await pool.getConnection();
  try{
   await cn.beginTransaction();
   const [rows]=await cn.execute('SELECT collar_bound,sheet_json FROM characters WHERE id=? FOR UPDATE',[promotion[1]]);
   if(!rows.length){await cn.rollback();return err(404,'character_not_found')}
   if(!rows[0].collar_bound){await cn.rollback();return err(409,'rank_requires_bound_character')}
   const sheet=typeof rows[0].sheet_json==='string'?JSON.parse(rows[0].sheet_json):rows[0].sheet_json;
   const display=labels[rankId];sheet.rank=display;
   await cn.execute('UPDATE characters SET bound_rank=?,sheet_json=? WHERE id=?',[rankId,JSON.stringify(sheet),promotion[1]]);
   await cn.execute('INSERT INTO audit_log(actor_account_id,action,entity_type,entity_id,details_json) VALUES(?,?,?,?,?)',
    [actor.id,'change_bound_rank','character',promotion[1],JSON.stringify({rank:rankId})]);
   await cn.commit();return {status:200,body:{rank:display}};
  }catch(error){await cn.rollback().catch(()=>{});throw error}finally{cn.release()}
 }
 const assignment=/^\/characters\/([a-f0-9-]{36})\/assign$/.exec(path);
 if(assignment&&req.method==='POST'){
  if(!commands.has(actor.account_role))return err(403,'command_required');
  const data=await payload(req);
  const player=data?.player_user_id||null,handler=data?.handler_user_id||null;
  if((player&&!U.test(player))||(handler&&!U.test(handler)))return err(400,'invalid_account');
  const [characters]=await pool.execute('SELECT player_account_id,collar_bound FROM characters WHERE id=?',[assignment[1]]);
  if(!characters.length)return err(404,'character_not_found');
  if(characters[0].collar_bound&&player!==characters[0].player_account_id)return err(403,'cannot_reassign_bound_character');
  for(const id of [player,handler].filter(Boolean)){
   const [members]=await pool.execute('SELECT id,account_role FROM accounts WHERE id=? AND is_active=1 AND approval_status="approved"',[id]);
   if(!members.length)return err(400,'approved_account_required');
   if(id===handler&&!['domina','high_command','handler'].includes(members[0].account_role))return err(400,'invalid_handler_role');
  }
  await pool.execute('UPDATE characters SET player_account_id=?,handler_account_id=? WHERE id=?',[player,handler,assignment[1]]);
  return {status:200,body:{status:'assigned'}};
 }
 const match=/^\/characters\/([a-f0-9-]{36})$/.exec(path);
 if(match&&req.method==='PUT'){
  const id=match[1];
  const [rows]=await pool.execute('SELECT * FROM characters WHERE id=?',[id]);
  if(rows.length!==1)return err(404,'character_not_found');
  const row=rows[0];
  const full=commands.has(actor.account_role)||(actor.account_role==='handler'&&row.handler_account_id===actor.id)||(!row.collar_bound&&row.player_account_id===actor.id);
  if(!full)return err(403,'forbidden');
  const body=await payload(req);
  if(!body||typeof body!=='object'||Array.isArray(body))return err(400,'invalid_character');
  const old=typeof row.sheet_json==='string'?JSON.parse(row.sheet_json):row.sheet_json;
  // Never accept ownership, handler assignment, collar or bound-rank changes through normal sheet save.
  const blocked=new Set(['id','player_user_id','handler_user_id','collar_bound','rank','view_mode','gil']);
  if(old.progression_version===1){
   for(const key of ['progression_version','class_features','ability_points','level','experience','class_id','class_name','proficiency_bonus','hit_dice','max_hp','gil','saving_throws','spell_points','max_spell_points'])blocked.add(key);
   // Levelled ability growth must be granted by server rules, not arbitrary sheet edits.
   for(const key of ['str','dex','con','int','wis','cha'])blocked.add(key);
  }
  const fields=Object.fromEntries(Object.entries(body).filter(([key])=>!blocked.has(key)));
  const next={...old,...fields};
  const name=limit(next.name,120);
  if(!name)return err(400,'invalid_character_name');
  next.name=name;
  await pool.execute('UPDATE characters SET character_name=?,sheet_json=? WHERE id=?',
   [name,JSON.stringify(next),id]);
  return {status:200,body:{status:'saved'}};
 }
 return err(404,'not_found');
}
