// War escorts use garrison stock already registered at real military installations.
// They reserve personnel while a transport is moving or awaiting a DM outcome.
// Engagements never invent casualties or silently discard cargo.
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const goodId=v=>Number.isSafeInteger(Number(v))&&Number(v)>0;
const validKind=kind=>kind==='freight'||kind==='supply';
const active=(kind)=>kind==='freight'?'world_logistics_shipments':'world_logistics_supply_line_shipments';
const safeText=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
async function parse(req){let size=0;const chunks=[];for await(const part of req){size+=part.length;if(size>9000)return null;chunks.push(part)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}}
async function transaction(pool,fn){
 const db=await pool.getConnection();
 try{await db.beginTransaction();const result=await fn(db);if(result.status===200)await db.commit();else await db.rollback();return result}
 catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}
}
export async function wartimeEscortSnapshot(db){
 const [escorts]=await db.execute(`SELECT e.*,i.name AS installation_name,
  f.status AS freight_status,sl.status AS supply_status
  FROM world_convoy_escorts e
  JOIN world_military_installations i ON i.id=e.installation_id
  LEFT JOIN world_logistics_shipments f ON e.shipment_kind='freight' AND f.id=e.shipment_id
  LEFT JOIN world_logistics_supply_line_shipments sl ON e.shipment_kind='supply' AND sl.id=e.shipment_id
  ORDER BY e.id DESC LIMIT 200`);
 const [engagements]=await db.execute('SELECT * FROM world_convoy_engagements ORDER BY id DESC LIMIT 100');
 const [garrisons]=await db.execute(`SELECT g.installation_id,g.troop_type,g.quantity,i.name AS installation_name,i.settlement_id,
  i.state,i.condition_pct,s.strategic_state,s.controlling_faction_id
  FROM world_military_garrisons g
  JOIN world_military_installations i ON i.id=g.installation_id
  JOIN world_settlements s ON s.id=i.settlement_id
  WHERE s.controlling_faction_id='eclipse-order' AND g.quantity>0 ORDER BY i.name,g.troop_type`);
 return {escorts,engagements,garrisons};
}
async function shipment(db,kind,id){
 const table=active(kind);
 const [[cargo]]=await db.execute('SELECT * FROM '+table+' WHERE id=? FOR UPDATE',[id]);
 return cargo;
}
export async function warThreatAtArrival(db,kind,cargo){
 // Report one potential wartime engagement when an active Order shipment enters
 // contested territory. The DM decides combat effects; this does not roll losses.
 const [[prior]]=await db.execute('SELECT id FROM world_convoy_engagements WHERE shipment_kind=? AND shipment_id=? LIMIT 1',[kind,cargo.id]);
 if(prior)return false;
 const target=kind==='freight'
  ?(await db.execute(`SELECT s.strategic_state FROM world_industry_facilities f JOIN world_settlements s ON s.id=f.settlement_id WHERE f.id=?`,[cargo.destination_facility_id]))[0][0]
  :await (async()=>{
   const kindValue=cargo.destination_kind;
   let query,params;
   if(kindValue==='warehouse'){query='SELECT s.strategic_state FROM world_logistics_warehouses w JOIN world_settlements s ON s.id=w.settlement_id WHERE w.id=?';params=[cargo.destination_id]}
   else if(kindValue==='installation'){query='SELECT s.strategic_state FROM world_military_installations i JOIN world_settlements s ON s.id=i.settlement_id WHERE i.id=?';params=[cargo.destination_id]}
   else{query='SELECT s.strategic_state FROM world_industry_facilities f JOIN world_settlements s ON s.id=f.settlement_id WHERE f.id=?';params=[cargo.destination_id]}
   const [[result]]=await db.execute(query,params);return result;
  })();
 if(target?.strategic_state!=='contested')return false;
 const [[escort]]=await db.execute('SELECT id FROM world_convoy_escorts WHERE shipment_kind=? AND shipment_id=?',[kind,cargo.id]);
 await db.execute('INSERT INTO world_convoy_engagements(shipment_kind,shipment_id,escort_id,threat,severity,detail) VALUES(?,?,?,?,?,?)',[kind,cargo.id,escort?.id||null,'Contested territory',2,'Convoy entered a contested district. Combat result requires command approval.']);
 await db.execute("UPDATE "+active(kind)+" SET status='disrupted' WHERE id=? AND status='in_transit'",[cargo.id]);
 return true;
}
export async function escortCommandRoute(pool,req,path,actor){
 if(!['domina','high_command'].includes(actor?.account_role))return fail(403,'command_required');
 const assign=/^\/world-admin\/logistics\/escorts\/(freight|supply)\/(\d+)\/assign$/.exec(path);
 if(assign&&req.method==='POST'){
  const kind=assign[1],id=Number(assign[2]),b=await parse(req);
  if(!goodId(b?.installation_id)||!safeText(b?.troop_type,80)||!Number.isSafeInteger(Number(b?.troops))||Number(b.troops)<1||Number(b.troops)>1000000)return fail(400,'invalid_escort_assignment');
  return transaction(pool,async db=>{
   const cargo=await shipment(db,kind,id);
   if(!cargo||cargo.status!=='in_transit')return fail(409,'escort_requires_moving_convoy');
   const [[existing]]=await db.execute('SELECT id FROM world_convoy_escorts WHERE shipment_kind=? AND shipment_id=?',[kind,id]);
   if(existing)return fail(409,'convoy_already_escorted');
   const [[garrison]]=await db.execute(`SELECT g.quantity,i.settlement_id,i.state,i.condition_pct,s.strategic_state,s.controlling_faction_id
    FROM world_military_garrisons g JOIN world_military_installations i ON i.id=g.installation_id
    JOIN world_settlements s ON s.id=i.settlement_id
    WHERE g.installation_id=? AND g.troop_type=? FOR UPDATE`,[Number(b.installation_id),b.troop_type]);
   if(!garrison||garrison.controlling_faction_id!=='eclipse-order'||garrison.state!=='operational'||Number(garrison.condition_pct)<25||['destroyed','abandoned','contested'].includes(garrison.strategic_state))return fail(409,'escort_garrison_not_ready');
   // Only a unit stationed at the dispatching settlement can accompany this convoy.
   const [[origin]]=kind==='freight'
    ?await db.execute('SELECT settlement_id FROM world_industry_facilities WHERE id=?',[cargo.source_facility_id])
    :await db.execute(cargo.source_kind==='warehouse'?'SELECT settlement_id FROM world_logistics_warehouses WHERE id=?':'SELECT settlement_id FROM world_industry_facilities WHERE id=?',[cargo.source_id]);
   if(!origin||Number(origin.settlement_id)!==Number(garrison.settlement_id))return fail(409,'escort_must_depart_with_convoy');
   const [[reserved]]=await db.execute(`SELECT COALESCE(SUM(e.troops),0) AS total
    FROM world_convoy_escorts e
    LEFT JOIN world_logistics_shipments f ON e.shipment_kind='freight' AND f.id=e.shipment_id
    LEFT JOIN world_logistics_supply_line_shipments sl ON e.shipment_kind='supply' AND sl.id=e.shipment_id
    WHERE e.installation_id=? AND e.troop_type=?
    AND (e.shipment_kind='freight' AND f.status IN ('in_transit','disrupted') OR e.shipment_kind='supply' AND sl.status IN ('in_transit','disrupted'))`,[Number(b.installation_id),b.troop_type]);
   if(Number(reserved.total)+Number(b.troops)>Number(garrison.quantity))return fail(409,'escort_troops_already_committed');
   await db.execute('INSERT INTO world_convoy_escorts(shipment_kind,shipment_id,installation_id,troop_type,troops,assigned_by) VALUES(?,?,?,?,?,?)',[kind,id,Number(b.installation_id),b.troop_type,Number(b.troops),actor.id]);
   return ok({assigned:true,shipment_kind:kind,shipment_id:id});
  });
 }
 const attack=/^\/world-admin\/logistics\/escorts\/(freight|supply)\/(\d+)\/report-attack$/.exec(path);
 if(attack&&req.method==='POST'){
  const kind=attack[1],id=Number(attack[2]),b=await parse(req);
  if(!safeText(b?.threat,150)||!Number.isInteger(Number(b?.severity))||Number(b.severity)<1||Number(b.severity)>5)return fail(400,'invalid_convoy_threat');
  return transaction(pool,async db=>{
   const cargo=await shipment(db,kind,id);
   if(!cargo||cargo.status!=='in_transit')return fail(409,'convoy_not_moving');
   const [[prior]]=await db.execute('SELECT id FROM world_convoy_engagements WHERE shipment_kind=? AND shipment_id=? AND status=?',[kind,id,'pending']);
   if(prior)return fail(409,'convoy_attack_already_under_review');
   const [[escort]]=await db.execute('SELECT id FROM world_convoy_escorts WHERE shipment_kind=? AND shipment_id=?',[kind,id]);
   await db.execute('INSERT INTO world_convoy_engagements(shipment_kind,shipment_id,escort_id,threat,severity,detail) VALUES(?,?,?,?,?,?)',[kind,id,escort?.id||null,b.threat.trim(),Number(b.severity),String(b.detail||'').slice(0,500)]);
   await db.execute("UPDATE "+active(kind)+" SET status='disrupted' WHERE id=?",[id]);
   return ok({reported:true});
  });
 }
 const outcome=/^\/world-admin\/logistics\/escorts\/engagements\/(\d+)\/resolve$/.exec(path);
 if(outcome&&req.method==='POST'){
  const b=await parse(req);
  if(!['secured','held'].includes(b?.decision)||!safeText(b?.detail,500))return fail(400,'invalid_war_outcome');
  return transaction(pool,async db=>{
   const [[engagement]]=await db.execute('SELECT * FROM world_convoy_engagements WHERE id=? FOR UPDATE',[Number(outcome[1])]);
   if(!engagement||engagement.status!=='pending')return fail(409,'engagement_not_pending');
   const cargo=await shipment(db,engagement.shipment_kind,engagement.shipment_id);
   if(!cargo||cargo.status!=='disrupted')return fail(409,'engagement_cargo_not_held');
   if(b.decision==='secured'){
    await db.execute("UPDATE "+active(engagement.shipment_kind)+" SET status='in_transit',due_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 MINUTE) WHERE id=?",[engagement.shipment_id]);
   }
   await db.execute('UPDATE world_convoy_engagements SET status=?,detail=?,reviewed_by=?,reviewed_at=UTC_TIMESTAMP() WHERE id=?',[b.decision,b.detail.trim(),actor.id,engagement.id]);
   return ok({status:b.decision});
  });
 }
 return fail(404,'escort_action_not_found');
}
