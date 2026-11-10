import {logMovement} from './world-front-cargo.js';
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const id=x=>Number.isSafeInteger(Number(x))&&Number(x)>0;
async function json(req){let total=0,parts=[];for await(const chunk of req){total+=chunk.length;if(total>12000)return null;parts.push(chunk)}try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{return null}}
async function tx(pool,fn){const db=await pool.getConnection();try{await db.beginTransaction();const r=await fn(db);if(r.status===200)await db.commit();else await db.rollback();return r}catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}}
export function priceNpcFood({sellerStock,sellerPopulation,buyerStock,buyerPopulation,trust=50,tension=50}){
 const shortage=Math.min(1,Math.max(0,(Math.max(1,buyerPopulation)*4-buyerStock)/(Math.max(1,buyerPopulation)*4)));
 const surplus=Math.min(1,Math.max(0,(sellerStock-Math.max(20,sellerPopulation*4))/(Math.max(1,sellerPopulation)*4)));
 const risk=1+Math.max(0,Math.min(100,tension))/250;
 const relations=1-Math.max(0,Math.min(100,trust))/400;
 return Math.max(10,Math.round(100*(1+shortage*.65-surplus*.2)*risk*relations));
}
async function settlement(db,id){
 const [[s]]=await db.execute('SELECT s.id,s.name,s.population,s.controlling_faction_id,s.strategic_state,a.food_units FROM world_settlements s JOIN world_settlement_autosim a ON a.settlement_id=s.id WHERE s.id=?',[id]);
 return s||null;
}
async function relation(db,a,b){
 if(a===b)return {trust:100,tension:0};
 const pair=[a,b].sort();
 const [[r]]=await db.execute('SELECT trust,tension FROM world_faction_relations WHERE faction_a=? AND faction_b=?',[pair[0],pair[1]]);
 const [[treaty]]=await db.execute("SELECT id FROM world_logistics_trade_treaties WHERE faction_a=? AND faction_b=? AND status='active' AND purpose IN ('trade','relief') LIMIT 1",pair);
 return treaty?{trust:Number(r?.trust??50),tension:Number(r?.tension??50)}:null;
}
async function quote(db,sellerId,buyerId,quantity){
 const seller=await settlement(db,sellerId),buyer=await settlement(db,buyerId);
 if(!seller||!buyer||!seller.controlling_faction_id||!buyer.controlling_faction_id||seller.controlling_faction_id==='eclipse-order'||buyer.controlling_faction_id==='eclipse-order'||['destroyed','abandoned'].includes(seller.strategic_state)||['destroyed','abandoned'].includes(buyer.strategic_state))return null;
 const rel=await relation(db,seller.controlling_faction_id,buyer.controlling_faction_id);
 if(!rel)return null;
 if(Number(seller.food_units)-quantity<Math.max(20,Number(seller.population)*4))return null;
 const price=priceNpcFood({sellerStock:Number(seller.food_units),sellerPopulation:Number(seller.population),buyerStock:Number(buyer.food_units),buyerPopulation:Number(buyer.population),...rel});
 return {seller,buyer,price,relation:rel};
}
export async function npcBargainRoute(pool,req,path,actor,route){
 if(!['domina','high_command'].includes(actor?.account_role))return fail(403,'command_required');
 if(path==='/world-admin/logistics/npc-bargains'&&req.method==='GET'){
  const [offers]=await pool.execute('SELECT b.*,seller.name AS seller_name,buyer.name AS buyer_name FROM world_logistics_npc_bargains b JOIN world_settlements seller ON seller.id=b.seller_settlement_id JOIN world_settlements buyer ON buyer.id=b.buyer_settlement_id ORDER BY b.id DESC LIMIT 100');
  const [settlements]=await pool.execute("SELECT s.id,s.name,s.controlling_faction_id,s.population,a.food_units FROM world_settlements s JOIN world_settlement_autosim a ON a.settlement_id=s.id WHERE s.controlling_faction_id IS NOT NULL AND s.controlling_faction_id<>'eclipse-order' ORDER BY s.name");
  return ok({offers,settlements});
 }
 if(path==='/world-admin/logistics/npc-bargains/quote'&&req.method==='POST'){
  const b=await json(req);
  if(!id(b?.seller_settlement_id)||!id(b?.buyer_settlement_id)||Number(b.seller_settlement_id)===Number(b.buyer_settlement_id)||!Number.isInteger(b.quantity)||b.quantity<1||b.quantity>10000)return fail(400,'npc_trade_quote_invalid');
  const q=await quote(pool,b.seller_settlement_id,b.buyer_settlement_id,b.quantity);
  if(!q)return fail(409,'npc_trade_requires_surplus_and_treaty');
  return ok({quote_per_unit:q.price,total_value:q.price*b.quantity,trust:q.relation.trust,tension:q.relation.tension,quantity:b.quantity,settlements:[q.seller.name,q.buyer.name],payment_state:'unsettled'});
 }
 if(path==='/world-admin/logistics/npc-bargains'&&req.method==='POST'){
  const b=await json(req);
  if(!id(b?.seller_settlement_id)||!id(b?.buyer_settlement_id)||Number(b.seller_settlement_id)===Number(b.buyer_settlement_id)||!Number.isInteger(b.quantity)||b.quantity<1||b.quantity>10000)return fail(400,'npc_trade_offer_invalid');
  return tx(pool,async db=>{
   const q=await quote(db,b.seller_settlement_id,b.buyer_settlement_id,b.quantity);
   if(!q)return fail(409,'npc_trade_requires_surplus_and_treaty');
   const [created]=await db.execute('INSERT INTO world_logistics_npc_bargains(seller_settlement_id,buyer_settlement_id,origin_faction_id,destination_faction_id,quantity,quote_per_unit,offer_per_unit,requested_by) VALUES(?,?,?,?,?,?,?,?)',[q.seller.id,q.buyer.id,q.seller.controlling_faction_id,q.buyer.controlling_faction_id,b.quantity,q.price,q.price,actor.id]);
   return ok({id:created.insertId,quote_per_unit:q.price,status:'proposed'});
  });
 }
 const match=/^\/world-admin\/logistics\/npc-bargains\/(\d+)\/(counter|accept|reject)$/.exec(path);
 if(!match||req.method!=='POST')return fail(404,'npc_bargain_not_found');
 const b=await json(req);
 return tx(pool,async db=>{
  const [[offer]]=await db.execute('SELECT * FROM world_logistics_npc_bargains WHERE id=? FOR UPDATE',[Number(match[1])]);
  if(!offer)return fail(404,'npc_bargain_not_found');
  if(!['proposed','countered'].includes(offer.status))return fail(409,'npc_bargain_already_resolved');
  if(match[2]==='counter'){
   if(!Number.isInteger(b?.offer_per_unit)||b.offer_per_unit<1||b.offer_per_unit>offer.quote_per_unit*3)return fail(400,'npc_bargain_price_invalid');
   await db.execute("UPDATE world_logistics_npc_bargains SET status='countered',offer_per_unit=? WHERE id=?",[b.offer_per_unit,offer.id]);
   return ok({status:'countered',offer_per_unit:b.offer_per_unit});
  }
  if(match[2]==='reject'){
   await db.execute("UPDATE world_logistics_npc_bargains SET status='rejected',resolved_by=?,decided_at=UTC_TIMESTAMP() WHERE id=?",[actor.id,offer.id]);
   return ok({status:'rejected'});
  }
  const q=await quote(db,offer.seller_settlement_id,offer.buyer_settlement_id,Number(offer.quantity));
  if(!q||q.seller.controlling_faction_id!==offer.origin_faction_id||q.buyer.controlling_faction_id!==offer.destination_faction_id)return fail(409,'npc_trade_terms_no_longer_valid');
  const path=await route(db,q.seller.id,q.buyer.id,'pack'); // Existing NPC road/trail caravan; no player pack fleet.
  if(!path)return fail(409,'npc_trade_road_not_connected');
  const [duplicate]=await db.execute('SELECT id FROM world_npc_trade_shipments WHERE source_settlement_id=? AND destination_settlement_id=? AND departed_on=UTC_DATE()',[q.seller.id,q.buyer.id]);
  if(duplicate.length)return fail(409,'npc_caravan_already_dispatched_today');
  const [updated]=await db.execute('UPDATE world_settlement_autosim SET food_units=food_units-? WHERE settlement_id=? AND food_units>=?',[offer.quantity,q.seller.id,offer.quantity]);
  if(!updated.affectedRows)return fail(409,'npc_trade_stock_insufficient');
  const travel=Math.max(10,Number(path.duration_minutes??path.legs*120));
  const [[clock]]=await db.execute('SELECT DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? MINUTE) AS due_at',[travel]);
  const [created]=await db.execute('INSERT INTO world_npc_trade_shipments(source_settlement_id,destination_settlement_id,amount,origin_faction_id,destination_faction_id,route_json,departed_on,due_at) VALUES(?,?,?,?,?,?,UTC_DATE(),?)',[q.seller.id,q.buyer.id,offer.quantity,q.seller.controlling_faction_id,q.buyer.controlling_faction_id,JSON.stringify(path.segment_ids),clock.due_at]);
  await db.execute("UPDATE world_logistics_npc_bargains SET status='accepted',shipment_id=?,resolved_by=?,decided_at=UTC_TIMESTAMP() WHERE id=?",[created.insertId,actor.id,offer.id]);
  await logMovement(db,{system:'npc',reference:created.insertId,action:'dispatch',item:'food-units',quantity:offer.quantity,source:'settlement:'+q.seller.id,destination:'settlement:'+q.buyer.id});
  return ok({status:'accepted',shipment_id:created.insertId,quoted_total:offer.offer_per_unit*offer.quantity,payment_state:'unsettled'});
 });
}
