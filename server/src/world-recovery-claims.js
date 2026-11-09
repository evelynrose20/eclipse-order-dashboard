// Claims are requests to occupy an existing, unclaimed location. They never
// generate zones, bypass approved wars, or reassign another faction's land.
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const eligibleFaction=f=>f&&f.id!=='eclipse-order'&&['world','settlement','order_story'].includes(f.faction_scope);
const validId=v=>Number.isSafeInteger(Number(v))&&Number(v)>0;
const validText=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n;
async function read(req){const chunks=[];let n=0;for await(const c of req){n+=c.length;if(n>10000)return null;chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}}
async function tx(pool,fn){const db=await pool.getConnection();try{await db.beginTransaction();const r=await fn(db);if(r.status===200)await db.commit();else await db.rollback();return r}catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}}
export function recoveryEligible(site){return !!site&&site.controlling_faction_id==null}
export function recoveryState(state){return ['destroyed','abandoned','rebuilding'].includes(state)?'rebuilding':'secure'}
export function isNearbyHolding(home,target){
 if(!home||!target||!home.zone_id||Number(home.zone_id)!==Number(target.zone_id))return false;
 return Math.hypot(Number(home.map_x)-Number(target.map_x),Number(home.map_y)-Number(target.map_y))<=35;
}
export async function recoveryClaimsSummary(pool){
 const [claims]=await pool.execute(`SELECT c.id,c.claimant_id,c.settlement_id,c.status,c.source_kind,c.rationale,c.review_note,c.created_at,
  s.name AS settlement_name,s.strategic_state,s.controlling_faction_id,f.name AS claimant_name
  FROM world_recovery_claims c JOIN order_factions f ON f.id=c.claimant_id
  JOIN world_settlements s ON s.id=c.settlement_id
  ORDER BY FIELD(c.status,'pending','postponed','approved','rejected','rp_event'),c.created_at DESC,c.id DESC LIMIT 200`);
 return claims;
}
export async function assessNpcRecoveryClaims(pool){
 return tx(pool,async db=>{
  const [sites]=await db.execute(`SELECT s.id,s.name,s.zone_id,s.map_x,s.map_y,s.controlling_faction_id,s.strategic_state,
   p.protection FROM world_settlements s LEFT JOIN world_plot_protection p ON p.settlement_id=s.id
   WHERE s.zone_id IS NOT NULL ORDER BY s.zone_id,s.id`);
  const [factions]=await db.execute('SELECT id,faction_scope FROM order_factions WHERE id<>?',['eclipse-order']);
  const available=sites.filter(s=>recoveryEligible(s)&&['destroyed','abandoned'].includes(s.strategic_state)&&!s.protection);
  let created=0;
  for(const target of available){
   if(created>=12)break;
   const options=factions.filter(eligibleFaction).filter(f=>sites.some(home=>home.controlling_faction_id===f.id&&isNearbyHolding(home,target)));
   if(!options.length)continue;
   const claimant=options[0];
   const [prior]=await db.execute(`SELECT id FROM world_recovery_claims WHERE claimant_id=? AND settlement_id=?
    AND (status IN ('pending','postponed','approved','rp_event') OR created_at>DATE_SUB(UTC_TIMESTAMP(),INTERVAL 30 DAY))
    LIMIT 1 FOR UPDATE`,[claimant.id,target.id]);
   if(prior.length)continue;
   await db.execute(`INSERT INTO world_recovery_claims(claimant_id,settlement_id,source_kind,rationale)
    VALUES(?,?,'npc_assessment',?)`,[claimant.id,target.id,`An established faction holding lies near the abandoned ${target.name}. Its leaders propose claiming the existing site and funding reconstruction, pending command approval.`]);
   created++;
  }
  return ok({created,review_required:true});
 });
}
async function create(pool,req){
 const b=await read(req);
 if(!b||!validId(b.settlement_id)||!validText(b.claimant_id,45)||!validText(b.rationale,1500))return fail(400,'invalid_claim');
 return tx(pool,async db=>{
  const [[faction]]=await db.execute('SELECT id,faction_scope FROM order_factions WHERE id=?',[b.claimant_id]);
  if(!eligibleFaction(faction))return fail(409,'claimant_must_be_npc_faction');
  const [[site]]=await db.execute('SELECT id,controlling_faction_id FROM world_settlements WHERE id=? FOR UPDATE',[b.settlement_id]);
  if(!site)return fail(404,'location_not_found');
  if(!recoveryEligible(site))return fail(409,'location_has_controller_use_conflict_approval');
  const [prior]=await db.execute("SELECT id FROM world_recovery_claims WHERE settlement_id=? AND claimant_id=? AND status IN ('pending','postponed') LIMIT 1",[site.id,b.claimant_id]);
  if(prior.length)return fail(409,'claim_already_pending');
  const [r]=await db.execute("INSERT INTO world_recovery_claims(claimant_id,settlement_id,source_kind,rationale) VALUES(?,?,'staff',?)",[b.claimant_id,site.id,b.rationale.trim()]);
  return ok({id:r.insertId,status:'pending'});
 });
}
async function review(pool,req,actor,claimId){
 const b=await read(req);
 if(!b||!['approve','postpone','reject','rp_event'].includes(b.decision)||typeof(b.note||'')!=='string'||(b.note||'').length>1500||(b.override_plot_protection!==undefined&&typeof b.override_plot_protection!=='boolean'))return fail(400,'invalid_claim_review');
 return tx(pool,async db=>{
  const [[claim]]=await db.execute('SELECT * FROM world_recovery_claims WHERE id=? FOR UPDATE',[claimId]);
  if(!claim)return fail(404,'claim_not_found');
  if(!['pending','postponed'].includes(claim.status))return fail(409,'claim_already_reviewed');
  if(b.decision==='approve'){
   const [[site]]=await db.execute('SELECT id,controlling_faction_id,strategic_state FROM world_settlements WHERE id=? FOR UPDATE',[claim.settlement_id]);
   if(!recoveryEligible(site))return fail(409,'location_has_controller_use_conflict_approval');
   const [[protectedSite]]=await db.execute('SELECT protection FROM world_plot_protection WHERE settlement_id=?',[site.id]);
   if(protectedSite?.protection&&!b.override_plot_protection)return fail(409,'plot_protection_requires_explicit_override');
   const [changed]=await db.execute('UPDATE world_settlements SET controlling_faction_id=?,strategic_state=? WHERE id=? AND controlling_faction_id IS NULL',
    [claim.claimant_id,recoveryState(site.strategic_state),site.id]);
   if(changed.affectedRows!==1)return fail(409,'location_has_controller_use_conflict_approval');
  }
  const state={approve:'approved',reject:'rejected',postpone:'postponed',rp_event:'rp_event'}[b.decision];
  await db.execute('UPDATE world_recovery_claims SET status=?,review_note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?',
   [state,(b.note||'').trim(),actor.id,claim.id]);
  return ok({saved:true,status:state,ownership_changed:b.decision==='approve'});
 });
}
export async function recoveryClaimsRoute(pool,req,path,actor){
 if(!['domina','high_command'].includes(actor?.account_role))return fail(403,'command_required');
 if(path==='/world-admin/recovery'&&req.method==='GET')return ok({claims:await recoveryClaimsSummary(pool)});
 if(path==='/world-admin/recovery/assess'&&req.method==='POST')return assessNpcRecoveryClaims(pool);
 if(path==='/world-admin/recovery/claims'&&req.method==='POST')return create(pool,req);
 const match=/^\/world-admin\/recovery\/claims\/(\d+)\/review$/.exec(path);
 if(match&&req.method==='POST')return review(pool,req,actor,Number(match[1]));
 return fail(404,'recovery_route_not_found');
}
