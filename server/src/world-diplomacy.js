// All diplomacy and territorial consequences go through a command review queue.
// No scheduled process is allowed to launch wars, annex sites, or decide plots.
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const command=actor=>['domina','high_command'].includes(actor?.account_role);
const validFaction=id=>typeof id==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)&&id.length<=45;
const str=(s,n,required=false)=>typeof s==='string'&&s.length<=n&&(!required||s.trim().length>0);
const id=x=>Number.isSafeInteger(Number(x))&&Number(x)>0;
const NPC_KINDS=new Set(['border_dispute','raid','siege','war']);
const REVIEW=new Set(['approve','reject','postpone','rp_event']);
const conflictKinds=new Set([...NPC_KINDS,'territory_transfer','peace']);
const pair=(a,b)=>a<b?[a,b]:[b,a];

async function payload(req){
 let size=0,chunks=[];
 for await(const part of req){size+=part.length;if(size>12000)return null;chunks.push(part)}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}
}
async function inTx(pool,fn){
 const db=await pool.getConnection();
 try{
  await db.beginTransaction();
  const result=await fn(db);
  if(result.status===200)await db.commit();else await db.rollback();
  return result;
 }catch(error){await db.rollback().catch(()=>{});throw error}
 finally{db.release()}
}
async function audit(db,actor,proposalId,decision,note=''){
 await db.execute('INSERT INTO world_conflict_decision_log(proposal_id,actor_id,decision,note) VALUES(?,?,?,?)',[proposalId,actor.id,decision,note]);
}
const scopeIsNpc=f=>f&&f.id!=='eclipse-order'&&['order_story','world','settlement'].includes(f.faction_scope);
export function canGenerateNpcProposal({tension,trust,attacker,defender,target,protection}){
 if(!scopeIsNpc(attacker)||!scopeIsNpc(defender)||attacker.id===defender.id)return false;
 if(!target||target.controlling_faction_id!==defender.id)return false;
 if(Number(tension)<70||Number(trust)>35)return false;
 return protection!=='all_conflict';
}
export function canClaimLocation(site,defenderFaction){
 // Preset ruins and neutral sites can be claimed through an authorized conflict;
 // a third-party-held location requires a conflict with that actual controller.
 return Boolean(site)&&(site.controlling_faction_id==null||site.controlling_faction_id===defenderFaction);
}
export function stateAfterCapture(state){return ['destroyed','abandoned','rebuilding'].includes(state)?'rebuilding':'occupied'}
export function protectedOutcomeAllowed(protection,explicitOverride){
 return !protection||explicitOverride===true;
}
export async function worldDiplomacySummary(pool){
 const [relations]=await pool.execute(`SELECT r.faction_a,r.faction_b,r.tension,r.trust,r.last_incident_date,
  a.name AS faction_a_name,b.name AS faction_b_name
  FROM world_faction_relations r JOIN order_factions a ON a.id=r.faction_a
  JOIN order_factions b ON b.id=r.faction_b ORDER BY r.tension DESC,r.faction_a`);
 const [proposals]=await pool.execute(`SELECT p.id,p.attacker_id,p.defender_id,p.target_settlement_id,p.conflict_kind,
  p.status,p.rationale,p.proposed_effect,p.source_kind,p.related_conflict_id,p.review_note,p.created_at,p.reviewed_at,
  a.name AS attacker_name,b.name AS defender_name,s.name AS target_name
  FROM world_conflict_proposals p JOIN order_factions a ON a.id=p.attacker_id
  JOIN order_factions b ON b.id=p.defender_id
  LEFT JOIN world_settlements s ON s.id=p.target_settlement_id
  ORDER BY FIELD(p.status,'pending','postponed','approved','rp_event','rejected','completed','cancelled'),p.created_at DESC,p.id DESC LIMIT 250`);
 const [conflicts]=await pool.execute(`SELECT c.id,c.proposal_id,c.attacker_id,c.defender_id,c.target_settlement_id,
  c.status,c.authorized_at,c.ended_at,a.name AS attacker_name,b.name AS defender_name,s.name AS target_name
  FROM world_authorized_conflicts c JOIN order_factions a ON a.id=c.attacker_id
  JOIN order_factions b ON b.id=c.defender_id
  LEFT JOIN world_settlements s ON s.id=c.target_settlement_id ORDER BY c.id DESC LIMIT 150`);
 const [protectedSites]=await pool.execute(`SELECT p.settlement_id,p.protection,p.explanation,s.name AS settlement_name
  FROM world_plot_protection p JOIN world_settlements s ON s.id=p.settlement_id ORDER BY s.name`);
 return {relations,proposals,conflicts,protected_sites:protectedSites};
}
async function factionPair(db,a,b){
 const [rows]=await db.execute('SELECT id,faction_scope FROM order_factions WHERE id IN (?,?)',[a,b]);
 return rows.length===2?rows:null;
}
async function relationUpdate(pool,req,actor){
 const b=await payload(req);
 if(!b||!validFaction(b.faction_a)||!validFaction(b.faction_b)||b.faction_a===b.faction_b
   ||!Number.isInteger(b.tension)||b.tension<0||b.tension>100
   ||!Number.isInteger(b.trust)||b.trust<0||b.trust>100)return fail(400,'invalid_diplomatic_relationship');
 return inTx(pool,async db=>{
  if(!await factionPair(db,b.faction_a,b.faction_b))return fail(404,'faction_not_found');
  const [a,c]=pair(b.faction_a,b.faction_b);
  await db.execute(`INSERT INTO world_faction_relations(faction_a,faction_b,tension,trust) VALUES(?,?,?,?)
   ON DUPLICATE KEY UPDATE tension=VALUES(tension),trust=VALUES(trust)`,[a,c,b.tension,b.trust]);
  return ok({saved:true});
 });
}
async function proposalCreate(pool,req){
 const b=await payload(req);
 if(!b||!validFaction(b.attacker_id)||!validFaction(b.defender_id)||b.attacker_id===b.defender_id
  ||!NPC_KINDS.has(b.conflict_kind)||!str(b.rationale,1500,true)
  ||!str(b.proposed_effect||'',1000)||b.target_settlement_id!=null&&!id(b.target_settlement_id))
  return fail(400,'invalid_proposal');
 return inTx(pool,async db=>{
  if(!await factionPair(db,b.attacker_id,b.defender_id))return fail(404,'faction_not_found');
  if(b.target_settlement_id){
   const [[site]]=await db.execute('SELECT id,controlling_faction_id,strategic_state FROM world_settlements WHERE id=?',[b.target_settlement_id]);
   if(!site)return fail(404,'target_not_found');
  }
  const [result]=await db.execute(`INSERT INTO world_conflict_proposals(attacker_id,defender_id,target_settlement_id,conflict_kind,rationale,proposed_effect,source_kind)
   VALUES(?,?,?,?,?,?,'staff')`,[b.attacker_id,b.defender_id,b.target_settlement_id||null,b.conflict_kind,b.rationale.trim(),(b.proposed_effect||'').trim()]);
  return ok({id:result.insertId,status:'pending'});
 });
}
export async function assessNpcDiplomaticTensions(pool){
 return inTx(pool,async db=>{
  const [relations]=await db.execute(`SELECT a.id AS a_id,a.faction_scope AS a_scope,b.id AS b_id,b.faction_scope AS b_scope,r.tension,r.trust
    FROM world_faction_relations r JOIN order_factions a ON a.id=r.faction_a
    JOIN order_factions b ON b.id=r.faction_b WHERE r.tension>=70 AND r.trust<=35
    ORDER BY r.tension DESC,r.faction_a LIMIT 80`);
  const [sites]=await db.execute(`SELECT s.id,s.name,s.controlling_faction_id,p.protection
    FROM world_settlements s LEFT JOIN world_plot_protection p ON p.settlement_id=s.id
    WHERE s.controlling_faction_id IS NOT NULL ORDER BY s.id`);
  let created=0;
  for(const rel of relations){
   if(created>=15)break;
   const aa={id:rel.a_id,faction_scope:rel.a_scope},bb={id:rel.b_id,faction_scope:rel.b_scope};
   for(const [attacker,defender] of [[aa,bb],[bb,aa]]){
    if(created>=15)break;
    const target=sites.find(s=>canGenerateNpcProposal({tension:rel.tension,trust:rel.trust,attacker,defender,target:s,protection:s.protection}));
    if(!target)continue;
    const [existing]=await db.execute(`SELECT id FROM world_conflict_proposals
      WHERE attacker_id=? AND defender_id=? AND target_settlement_id=? AND source_kind='npc_assessment'
      AND (status IN ('pending','postponed','approved','rp_event') OR created_at>=DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)) LIMIT 1 FOR UPDATE`,[attacker.id,defender.id,target.id]);
    if(existing.length)continue;
    const reason=`Diplomatic tension ${rel.tension}/100 and trust ${rel.trust}/100. ${attacker.id} considers pressure against ${defender.id} at ${target.name}.`;
    await db.execute(`INSERT INTO world_conflict_proposals(attacker_id,defender_id,target_settlement_id,conflict_kind,rationale,proposed_effect,source_kind)
      VALUES(?,?,?,'border_dispute',?,'No changes unless authorized','npc_assessment')`,[attacker.id,defender.id,target.id,reason]);
    created++;
   }
  }
  return ok({created,review_required:true});
 });
}
async function protectionUpdate(pool,req,actor){
 const b=await payload(req);
 if(!b||!id(b.settlement_id)||!['none','major_changes','all_conflict'].includes(b.protection)||!str(b.explanation||'',500))return fail(400,'invalid_protection');
 return inTx(pool,async db=>{
  const [[site]]=await db.execute('SELECT id FROM world_settlements WHERE id=? FOR UPDATE',[b.settlement_id]);
  if(!site)return fail(404,'settlement_not_found');
  if(b.protection==='none')await db.execute('DELETE FROM world_plot_protection WHERE settlement_id=?',[b.settlement_id]);
  else await db.execute(`INSERT INTO world_plot_protection(settlement_id,protection,explanation,updated_by) VALUES(?,?,?,?)
    ON DUPLICATE KEY UPDATE protection=VALUES(protection),explanation=VALUES(explanation),updated_by=VALUES(updated_by)`,[b.settlement_id,b.protection,(b.explanation||'').trim(),actor.id]);
  return ok({saved:true});
 });
}
async function review(pool,req,actor,proposalId){
 const b=await payload(req);
 if(!b||!REVIEW.has(b.decision)||!str(b.note||'',1500))return fail(400,'invalid_review');
 return inTx(pool,async db=>{
  const [[p]]=await db.execute('SELECT * FROM world_conflict_proposals WHERE id=? FOR UPDATE',[proposalId]);
  if(!p)return fail(404,'proposal_not_found');
  if(!['pending','postponed'].includes(p.status))return fail(409,'proposal_already_reviewed');
  if(p.source_kind==='war_outcome')return fail(409,'outcome_requires_second_stage_review');
  const status={approve:'approved',reject:'rejected',postpone:'postponed',rp_event:'rp_event'}[b.decision];
  if(b.decision==='approve'&&p.target_settlement_id){
   const [[protection]]=await db.execute('SELECT protection FROM world_plot_protection WHERE settlement_id=?',[p.target_settlement_id]);
   if(protection?.protection==='all_conflict')return fail(409,'plot_protected_no_conflict');
  }
  let conflictId=null;
  if(b.decision==='approve'&&NPC_KINDS.has(p.conflict_kind)){
   const [result]=await db.execute(`INSERT INTO world_authorized_conflicts(proposal_id,attacker_id,defender_id,target_settlement_id,authorized_by)
     VALUES(?,?,?,?,?)`,[p.id,p.attacker_id,p.defender_id,p.target_settlement_id,actor.id]);
   conflictId=result.insertId;
  }
  await db.execute('UPDATE world_conflict_proposals SET status=?,review_note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?',
    [status,(b.note||'').trim(),actor.id,p.id]);
  await audit(db,actor,p.id,b.decision,(b.note||'').trim());
  return ok({saved:true,status,authorized_conflict_id:conflictId,ownership_changed:false});
 });
}
// An approved conflict may produce a recommendation, never an automatic annexation.
async function outcomeCreate(pool,req){
 const b=await payload(req);
 if(!b||!id(b.conflict_id)||!str(b.rationale,1500,true)||!['territory_transfer','peace'].includes(b.kind)||(b.kind==='territory_transfer'&&!id(b.target_settlement_id)))return fail(400,'invalid_outcome_proposal');
 return inTx(pool,async db=>{
  const [[conflict]]=await db.execute('SELECT * FROM world_authorized_conflicts WHERE id=? FOR UPDATE',[b.conflict_id]);
  if(!conflict||!['authorized','active'].includes(conflict.status))return fail(409,'conflict_not_active');
  if(b.kind==='territory_transfer'){
   const [[site]]=await db.execute('SELECT id,controlling_faction_id FROM world_settlements WHERE id=?',[b.target_settlement_id]);
   if(!site)return fail(404,'target_not_found');
   if(!canClaimLocation(site,conflict.defender_id))return fail(409,'target_control_changed');
  }
  const [result]=await db.execute(`INSERT INTO world_conflict_proposals
    (attacker_id,defender_id,target_settlement_id,conflict_kind,rationale,proposed_effect,source_kind,related_conflict_id)
    VALUES(?,?,?,?,?,?,'war_outcome',?)`,[conflict.attacker_id,conflict.defender_id,b.kind==='territory_transfer'?b.target_settlement_id:null,b.kind,b.rationale.trim(),b.kind==='territory_transfer'?'Claim preset location after explicit review; destroyed/abandoned sites enter rebuilding':'Conclude authorized conflict after explicit review',conflict.id]);
  return ok({id:result.insertId,status:'pending',ownership_changed:false});
 });
}
async function outcomeReview(pool,req,actor,proposalId){
 const b=await payload(req);
 if(!b||!['approve','reject','postpone'].includes(b.decision)||!str(b.note||'',1500)
   ||(b.override_plot_protection!==undefined&&typeof b.override_plot_protection!=='boolean'))
   return fail(400,'invalid_outcome_review');
 return inTx(pool,async db=>{
  const [[p]]=await db.execute('SELECT * FROM world_conflict_proposals WHERE id=? FOR UPDATE',[proposalId]);
  if(!p||p.source_kind!=='war_outcome')return fail(404,'outcome_not_found');
  if(!['pending','postponed'].includes(p.status))return fail(409,'proposal_already_reviewed');
  const [[conflict]]=await db.execute('SELECT * FROM world_authorized_conflicts WHERE id=? FOR UPDATE',[p.related_conflict_id]);
  if(!conflict||!['authorized','active'].includes(conflict.status))return fail(409,'conflict_not_active');
  if(b.decision==='approve'&&p.conflict_kind==='territory_transfer'){
   const [[site]]=await db.execute('SELECT id,controlling_faction_id,strategic_state FROM world_settlements WHERE id=? FOR UPDATE',[p.target_settlement_id]);
   if(!site)return fail(404,'target_not_found');
   if(!canClaimLocation(site,conflict.defender_id))return fail(409,'target_control_changed');
   const [[prot]]=await db.execute('SELECT protection FROM world_plot_protection WHERE settlement_id=?',[site.id]);
   if(!protectedOutcomeAllowed(prot?.protection,b.override_plot_protection))return fail(409,'plot_protection_requires_explicit_override');
   const nextState=stateAfterCapture(site.strategic_state);
   const [changed]=await db.execute(`UPDATE world_settlements SET controlling_faction_id=?,strategic_state=? WHERE id=? AND controlling_faction_id <=> ?`,
    [conflict.attacker_id,nextState,site.id,site.controlling_faction_id]);
   if(changed.affectedRows!==1)return fail(409,'target_control_changed');
  }
  if(b.decision==='approve'&&p.conflict_kind==='peace')
   await db.execute("UPDATE world_authorized_conflicts SET status='concluded',ended_at=CURRENT_TIMESTAMP WHERE id=?",[conflict.id]);
  const status={approve:'completed',reject:'rejected',postpone:'postponed'}[b.decision];
  await db.execute('UPDATE world_conflict_proposals SET status=?,review_note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?',
   [status,(b.note||'').trim(),actor.id,p.id]);
  await audit(db,actor,p.id,b.decision+(b.override_plot_protection?'_plot_override':''),(b.note||'').trim());
  return ok({saved:true,status,ownership_changed:b.decision==='approve'&&p.conflict_kind==='territory_transfer'});
 });
}
export async function worldDiplomacyRoute(pool,req,path,actor){
 if(!command(actor))return fail(403,'command_required');
 if(path==='/world-admin/diplomacy'&&req.method==='GET')return ok(await worldDiplomacySummary(pool));
 if(path==='/world-admin/diplomacy/relations'&&req.method==='PUT')return relationUpdate(pool,req,actor);
 if(path==='/world-admin/diplomacy/proposals'&&req.method==='POST')return proposalCreate(pool,req);
 if(path==='/world-admin/diplomacy/assess'&&req.method==='POST')return assessNpcDiplomaticTensions(pool);
 if(path==='/world-admin/diplomacy/protection'&&req.method==='PUT')return protectionUpdate(pool,req,actor);
 if(path==='/world-admin/diplomacy/outcomes'&&req.method==='POST')return outcomeCreate(pool,req);
 const reviewMatch=/^\/world-admin\/diplomacy\/proposals\/(\d+)\/review$/.exec(path);
 if(reviewMatch&&req.method==='POST')return review(pool,req,actor,Number(reviewMatch[1]));
 const outcomeMatch=/^\/world-admin\/diplomacy\/outcomes\/(\d+)\/review$/.exec(path);
 if(outcomeMatch&&req.method==='POST')return outcomeReview(pool,req,actor,Number(outcomeMatch[1]));
 return fail(404,'diplomacy_route_not_found');
}
