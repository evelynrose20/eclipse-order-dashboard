import {resolveSession} from './auth.js';
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const valid=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.trim().length<=max;
const numeric=n=>/^\d+$/.test(String(n))&&Number.isSafeInteger(Number(n))&&Number(n)>0;
const council=['domina','operations','commerce','faction','internal'];
const permittedVote=new Set(['yes','no','abstain']);
async function body(req){const parts=[];let size=0;for await(const p of req){size+=p.length;if(size>24000)throw Object.assign(new Error('request_too_large'),{status:413});parts.push(p)}try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{return null}}
async function transaction(pool,fn){const conn=await pool.getConnection();try{await conn.beginTransaction();const r=await fn(conn);if(r.status===200)await conn.commit();else await conn.rollback();return r}catch(e){await conn.rollback().catch(()=>{});throw e}finally{conn.release()}}
async function audit(conn,actor,action,subject,details=''){await conn.execute('INSERT INTO order_governance_audit(actor_id,action,subject,details) VALUES(?,?,?,?)',[actor,action,String(subject).slice(0,96),details.slice(0,500)])}
export function calculateCouncilOutcome(kind,votes,quorum,majorYes){
 const yes=votes.filter(v=>v==='yes').length,no=votes.filter(v=>v==='no').length,abstain=votes.filter(v=>v==='abstain').length,participated=votes.length;
 return {yes,no,abstain,participated,passed:participated>=quorum&&(kind==='ordinary'?yes>no:yes>=majorYes)};
}
async function getState(pool,actor){
 const [[charter]]=await pool.execute('SELECT * FROM order_governance_charter WHERE id=1');
 const [offices]=await pool.execute('SELECT o.*,a.display_name AS holder,c.character_name AS character_name FROM order_council_offices o LEFT JOIN accounts a ON a.id=o.account_id LEFT JOIN characters c ON c.id=o.character_id ORDER BY o.seat_number');
 const [motions]=await pool.execute('SELECT m.*,a.display_name AS sponsor FROM order_council_motions m JOIN accounts a ON a.id=m.sponsor_id ORDER BY m.id DESC LIMIT 150');
 const [votes]=await pool.execute('SELECT v.motion_id,v.account_id,v.vote FROM order_council_votes v JOIN order_council_motions m ON m.id=v.motion_id ORDER BY m.id DESC LIMIT 1000');
 const [electorate]=await pool.execute('SELECT e.motion_id,e.office_code,e.account_id FROM order_council_electorate e JOIN order_council_motions m ON m.id=e.motion_id ORDER BY m.id DESC LIMIT 1000');
 const [[me]]=await pool.execute('SELECT id,display_name FROM accounts WHERE id=?',[actor.id]);
 const [dominas]=await pool.execute('SELECT id,display_name FROM accounts WHERE account_role="domina" AND is_active=1 AND approval_status="approved" ORDER BY display_name');
 const holder=dominas[0]||null;
 const isDomina=actor.account_role==='domina';
 const [characterRows]=isDomina?await pool.execute('SELECT c.id,c.character_name AS name,c.player_account_id,c.sheet_json,a.account_role,a.is_active,a.approval_status FROM characters c LEFT JOIN accounts a ON a.id=c.player_account_id ORDER BY c.character_name,c.id'):[[]];
 // Only expose in-character, non-sensitive sheet metadata to the appointment picker.
 // Never return raw sheet_json, RP preferences, sealed notes, account names or OOC identity.
 const characters=characterRows.map(c=>{
  let sheet={};
  try{sheet=typeof c.sheet_json==='string'?JSON.parse(c.sheet_json):c.sheet_json||{}}catch{}
  return {id:c.id,name:c.name,player_account_id:c.player_account_id||null,
   eligible:!!(c.player_account_id&&c.is_active&&c.approval_status==='approved'),
   is_domina:c.account_role==='domina',
   species:String(sheet.species||sheet.race||'').slice(0,100),
   class_name:String(sheet.class_name||sheet.className||sheet.class_id||'').slice(0,100),
   level:Math.max(1,Math.min(20,Number(sheet.level)||1)),
   specialty:String(sheet.specialty||'').slice(0,100)};
 });
 const councilMembers=new Set(offices.filter(o=>o.code!=='domina').map(o=>o.account_id).filter(Boolean));
 if(holder)councilMembers.add(holder.id);
 const canWrite=isDomina||councilMembers.has(actor.id);
 const [history]=isDomina?await pool.execute('SELECT a.id,a.action,a.subject,a.details,a.created_at,u.display_name AS actor FROM order_governance_audit a JOIN accounts u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 100'):[[]];
 const [revisions]=await pool.execute('SELECT h.revision,h.changed_at,a.display_name AS editor FROM order_governance_charter_history h JOIN accounts a ON a.id=h.changed_by ORDER BY h.revision DESC LIMIT 30');
 return {charter,characters,offices:offices.map(o=>({...o,account_id:o.code==='domina'?holder?.id||null:o.account_id,holder:o.character_name||null,locked:Boolean(o.character_id),legacy_unlinked:Boolean(o.code!=='domina'&&o.account_id&&!o.character_id),seat_occupied:Boolean(o.character_id||o.account_id||o.code==='domina'&&holder)})),motions:motions.map(m=>{
   const entries=votes.filter(v=>Number(v.motion_id)===Number(m.id));
   const result=calculateCouncilOutcome(m.kind,entries.map(e=>e.vote),m.quorum_required,m.major_yes_required);
   const eligibility=electorate.filter(e=>Number(e.motion_id)===Number(m.id));
   const meEligible=eligibility.some(e=>e.account_id===actor.id);
   const effectiveState=m.state==='awaiting_ratification'&&m.ratification_deadline&&new Date(m.ratification_deadline).getTime()<=Date.now()?'returned':m.state;
   return {...m,state:effectiveState,...result,can_vote:m.state==='open'&&meEligible&&councilMembers.has(actor.id),my_vote:entries.find(e=>e.account_id===actor.id)?.vote||null,ballots:eligibility.map(e=>({office_code:e.office_code,holder:e.account_id,vote:entries.find(v=>v.account_id===e.account_id)?.vote||null}))};
 }),history,revisions,can_manage:isDomina,can_propose:canWrite,me:me?.display_name||''};
}
export async function governanceRoute(pool,req,path){
 if(!pool)return fail(503,'database_unavailable');
 const actor=await resolveSession(pool,req);if(!actor)return fail(401,'not_authenticated');
 const domina=actor.account_role==='domina';
 const [[senateMode]]=await pool.execute('SELECT enabled FROM order_senate_settings WHERE id=1');
 if(senateMode?.enabled){
  if(path==='/governance/council'&&req.method==='GET'){
   const [[charter]]=await pool.execute('SELECT * FROM order_governance_charter WHERE id=1');
   const [revisions]=await pool.execute('SELECT h.revision,h.changed_at,a.display_name AS editor FROM order_governance_charter_history h JOIN accounts a ON a.id=h.changed_by ORDER BY h.revision DESC LIMIT 30');
   return ok({replaced_by_senate:true,can_manage:domina,charter,revisions,history:[],offices:[],motions:[]});
  }
  if(!(path==='/governance/council/charter'&&req.method==='PUT'))return fail(409,'senate_is_governing_chamber');
 }
 if(path==='/governance/council'&&req.method==='GET')return ok(await getState(pool,actor));
 if(path==='/governance/council/charter'&&req.method==='PUT'){
  if(!domina)return fail(403,'domina_required');
  const b=await body(req);
  if(!valid(b?.title,160)||!valid(b?.charter_text,12000)||!Number.isInteger(b?.revision)||
    !Number.isInteger(b?.quorum)||b.quorum<2||b.quorum>5||
    !Number.isInteger(b?.major_yes)||b.major_yes<3||b.major_yes>5||
    !Number.isInteger(b?.ratification_days)||b.ratification_days<1||b.ratification_days>90)return fail(400,'invalid_charter');
  return transaction(pool,async conn=>{
   const [[prev]]=await conn.execute('SELECT * FROM order_governance_charter WHERE id=1 FOR UPDATE');
   if(prev.revision!==b.revision)return fail(409,'charter_changed_refresh');
   const revision=prev.revision+1;
   await conn.execute('INSERT INTO order_governance_charter_history(revision,title,charter_text,quorum,major_yes,ratification_days,changed_by) VALUES(?,?,?,?,?,?,?)',[prev.revision,prev.title,prev.charter_text,prev.quorum,prev.major_yes,prev.ratification_days,actor.id]);
   await conn.execute('UPDATE order_governance_charter SET revision=?,title=?,charter_text=?,quorum=?,major_yes=?,ratification_days=?,updated_by=? WHERE id=1',[revision,b.title.trim(),b.charter_text.trim(),b.quorum,b.major_yes,b.ratification_days,actor.id]);
   await audit(conn,actor.id,'charter_update','revision:'+revision,'Updated charter text and voting rules');
   return ok({revision});
  });
 }
 if(path==='/governance/council/offices'&&req.method==='PUT'){
  if(!domina)return fail(403,'domina_required');
  const b=await body(req);
  if(!council.includes(b?.code)||typeof b?.character_id!=='string'||!/^[a-f0-9-]{36}$/i.test(b.character_id))return fail(400,'invalid_character_appointment');
  return transaction(pool,async conn=>{
   const [[office]]=await conn.execute('SELECT code,account_id,character_id FROM order_council_offices WHERE code=? FOR UPDATE',[b.code]);
   if(!office)return fail(404,'council_office_not_found');
   if(office.character_id)return fail(409,'office_locked_removal_vote_required');
   const legacyLink=office.code!=='domina'&&Boolean(office.account_id);
   const [[character]]=await conn.execute('SELECT c.id,c.character_name,c.player_account_id,a.account_role FROM characters c JOIN accounts a ON a.id=c.player_account_id WHERE c.id=? AND a.is_active=1 AND a.approval_status="approved" FOR UPDATE',[b.character_id]);
   if(!character||!character.player_account_id)return fail(404,'character_not_eligible');
   if(legacyLink&&office.account_id!==character.player_account_id)return fail(409,'legacy_officer_account_cannot_change');
   if(b.code==='domina'&&(character.account_role!=='domina'||character.player_account_id!==actor.id))return fail(409,'domina_character_required');
   if(b.code!=='domina'&&character.account_role==='domina')return fail(409,'domina_holds_reserved_seat');
   const [assigned]=await conn.execute('SELECT code FROM order_council_offices WHERE code<>? AND (character_id=? OR account_id=?)',[b.code,b.character_id,character.player_account_id]);
   if(assigned.length)return fail(409,'character_or_owner_already_holds_seat');
   await conn.execute('UPDATE order_council_offices SET character_id=?,account_id=?,appointed_at=COALESCE(appointed_at,UTC_TIMESTAMP()) WHERE code=?',[character.id,b.code==='domina'?null:character.player_account_id,b.code]);
   await audit(conn,actor.id,legacyLink?'link_character':'lock_appointment','office:'+b.code,character.character_name+' ['+character.id+']');
   return ok({locked:true});
  });
 }
 const state=await getState(pool,actor);
 const removal=/^\/governance\/council\/offices\/(operations|commerce|faction|internal)\/request-removal$/.exec(path);
 if(removal&&req.method==='POST'){
  if(!state.can_propose)return fail(403,'council_required');
  const b=await body(req);
  if(!valid(b?.reason,12000))return fail(400,'removal_reason_required');
  return transaction(pool,async conn=>{
   const [[office]]=await conn.execute('SELECT code,title,account_id,character_id FROM order_council_offices WHERE code=? FOR UPDATE',[removal[1]]);
   if(!office||!office.account_id)return fail(409,'office_vacant');
   const [[other]]=await conn.execute("SELECT id FROM order_council_motions WHERE removal_office_code=? AND state IN ('draft','open','awaiting_ratification') LIMIT 1",[office.code]);
   if(other)return fail(409,'removal_motion_already_active');
   const [result]=await conn.execute('INSERT INTO order_council_motions(title,detail,kind,sponsor_id,removal_office_code,removal_character_id,removal_account_id) VALUES(?,?,"major",?,?,?,?)',
    ['Dismiss '+office.title,b.reason.trim(),actor.id,office.code,office.character_id,office.account_id]);
   await audit(conn,actor.id,'propose_removal','motion:'+result.insertId,office.code);
   return ok({id:result.insertId});
  });
 }
 if(path==='/governance/council/motions'&&req.method==='POST'){
  if(!state.can_propose)return fail(403,'council_required');
  const b=await body(req);
  if(!valid(b?.title,160)||!valid(b?.detail,12000)||!['ordinary','major','reserved'].includes(b.kind))return fail(400,'invalid_motion');
  return transaction(pool,async conn=>{
   const [r]=await conn.execute('INSERT INTO order_council_motions(title,detail,kind,sponsor_id) VALUES(?,?,?,?)',[b.title.trim(),b.detail.trim(),b.kind,actor.id]);
   await audit(conn,actor.id,'create_motion','motion:'+r.insertId,b.title.trim());
   return ok({id:r.insertId});
  });
 }
 const match=/^\/governance\/council\/motions\/(\d+)\/(open|vote|close|withdraw|ratify)$/.exec(path);
 if(match&&req.method==='POST'&&numeric(match[1])){
  const motionId=Number(match[1]),action=match[2];
  return transaction(pool,async conn=>{
   const [[m]]=await conn.execute('SELECT * FROM order_council_motions WHERE id=? FOR UPDATE',[motionId]);
   if(!m)return fail(404,'motion_not_found');
   if(action==='open'){
    if(!domina||m.state!=='draft')return fail(403,'cannot_open_motion');
    const [[rules]]=await conn.execute('SELECT quorum,major_yes,ratification_days FROM order_governance_charter WHERE id=1');
    const [seats]=await conn.execute('SELECT o.code,o.account_id FROM order_council_offices o JOIN accounts a ON a.id=o.account_id WHERE o.code<>"domina" AND a.is_active=1 AND a.approval_status="approved"');
    const [chair]=await conn.execute('SELECT id FROM accounts WHERE account_role="domina" AND is_active=1 AND approval_status="approved" ORDER BY id LIMIT 1');
    if(chair.length)seats.push({code:'domina',account_id:chair[0].id});
    if(seats.length<rules.quorum)return fail(409,'insufficient_occupied_seats');
    for(const seat of seats)await conn.execute('INSERT INTO order_council_electorate(motion_id,office_code,account_id) VALUES(?,?,?)',[motionId,seat.code,seat.account_id]);
    await conn.execute('UPDATE order_council_motions SET state="open",quorum_required=?,major_yes_required=?,ratification_days=?,opened_at=UTC_TIMESTAMP() WHERE id=?',[rules.quorum,rules.major_yes,rules.ratification_days,motionId]);
    await audit(conn,actor.id,'open_motion','motion:'+motionId);return ok({opened:true});
   }
   if(action==='withdraw'){
    if(!domina&&m.sponsor_id!==actor.id)return fail(403,'sponsor_required');
    if(!['draft','open'].includes(m.state))return fail(409,'motion_already_closed');
    await conn.execute('UPDATE order_council_motions SET state="withdrawn",closed_at=UTC_TIMESTAMP() WHERE id=?',[motionId]);
    await audit(conn,actor.id,'withdraw_motion','motion:'+motionId);return ok({withdrawn:true});
   }
   if(action==='ratify'){
    if(!domina||m.state!=='awaiting_ratification')return fail(403,'cannot_ratify');
    const b=await body(req);if(typeof b?.approve!=='boolean')return fail(400,'invalid_ratification');
    const within=new Date(m.ratification_deadline).getTime()>Date.now();
    const next=b.approve&&within?'ratified':'returned';
    await conn.execute('UPDATE order_council_motions SET state=? WHERE id=?',[next,motionId]);
    await audit(conn,actor.id,next,'motion:'+motionId);return ok({state:next});
   }
   if(m.state!=='open')return fail(409,'motion_not_open');
   if(action==='vote'){
    const [eligible]=await conn.execute('SELECT 1 FROM order_council_electorate WHERE motion_id=? AND account_id=?',[motionId,actor.id]);
    const presently=state.offices.some(o=>o.account_id===actor.id);
    if(!eligible.length||!presently)return fail(403,'not_eligible_to_vote');
    const b=await body(req);if(!permittedVote.has(b?.vote))return fail(400,'invalid_vote');
    await conn.execute('INSERT INTO order_council_votes(motion_id,account_id,vote) VALUES(?,?,?) ON DUPLICATE KEY UPDATE vote=VALUES(vote)',[motionId,actor.id,b.vote]);
    await audit(conn,actor.id,'cast_vote','motion:'+motionId,b.vote);return ok({vote:b.vote});
   }
   if(!domina)return fail(403,'domina_required');
   const [votes]=await conn.execute('SELECT vote FROM order_council_votes WHERE motion_id=?',[motionId]);
   const outcome=calculateCouncilOutcome(m.kind,votes.map(v=>v.vote),m.quorum_required,m.major_yes_required);
   if(outcome.participated<m.quorum_required)return fail(409,'quorum_not_met');
   if(outcome.passed&&m.removal_office_code){
    const [change]=await conn.execute('UPDATE order_council_offices SET account_id=NULL,character_id=NULL,appointed_at=NULL WHERE code=? AND account_id <=> ? AND character_id <=> ?',
     [m.removal_office_code,m.removal_account_id,m.removal_character_id]);
    if(change.affectedRows!==1)return fail(409,'seat_changed_since_removal_motion');
    await audit(conn,actor.id,'voted_removal','office:'+m.removal_office_code,'motion:'+motionId);
   }
   const next=!outcome.passed?'rejected':m.kind==='reserved'?'awaiting_ratification':'passed';
   await conn.execute('UPDATE order_council_motions SET state=?,closed_at=UTC_TIMESTAMP(),ratification_deadline=IF(?="awaiting_ratification",DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? DAY),NULL) WHERE id=?',[next,next,m.ratification_days,motionId]);
   await audit(conn,actor.id,'close_motion','motion:'+motionId,next);return ok({...outcome,state:next});
  });
 }
 return fail(404,'not_found');
}
