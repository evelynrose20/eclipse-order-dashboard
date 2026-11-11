// NPC trade bargaining is deterministic, bounded and never changes war/territory.
export function npcTreatyDecision(trust,tension){
 const t=Number(trust),risk=Number(tension);
 if(t>=55&&risk<=40)return {status:'approved',reason:'The partner accepts the proposed commercial terms.'};
 if(t<35||risk>70)return {status:'rejected',reason:'The partner refuses these terms due to distrust or border tension.'};
 return {status:'countered',reason:'The partner requests improved relations or revised terms before signing.'};
}
export function sqlDate(input){
 if(typeof input!=='string'||!input.trim())return null;
 const date=new Date(input);
 return Number.isFinite(date.getTime())?date.toISOString().slice(0,19).replace('T',' '):null;
}
export function validTreatySchedule(body){
 if(!body||!sqlDate(body.starts_at)||!sqlDate(body.ends_at)||!sqlDate(body.response_due_at))return false;
 const now=Date.now(),start=Date.parse(body.starts_at),end=Date.parse(body.ends_at),response=Date.parse(body.response_due_at);
 return start>now+60000&&end>start&&response>=now&&response<start&&end-start<=365*86400000;
}
async function tx(pool,run){const db=await pool.getConnection();try{await db.beginTransaction();const result=await run(db);if(result.status===200)await db.commit();else await db.rollback();return result}catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}}
const ok=body=>({status:200,body});
export async function runTreatyNegotiations(pool){
 if(!pool)return {approved:0,rejected:0,countered:0,activated:0,expired:0};
 const counts={approved:0,rejected:0,countered:0,activated:0,expired:0};
 const [due]=await pool.execute("SELECT id FROM world_logistics_trade_treaties WHERE (status='proposed' AND response_due_at<=UTC_TIMESTAMP()) OR (status='approved' AND starts_at<=UTC_TIMESTAMP()) OR (status IN ('active','approved','suspended') AND ends_at<=UTC_TIMESTAMP()) ORDER BY id LIMIT 40");
 for(const {id} of due){
  const result=await tx(pool,async db=>{
   const [[offer]]=await db.execute('SELECT * FROM world_logistics_trade_treaties WHERE id=? FOR UPDATE',[id]);
   if(!offer)return ok({skipped:true});
   const [[time]]=await db.execute('SELECT UTC_TIMESTAMP() AS now');
   const now=new Date(time.now);
   if(offer.ends_at&&new Date(offer.ends_at)<=now&&['active','approved','suspended'].includes(offer.status)){
    await db.execute("UPDATE world_logistics_trade_treaties SET status='expired',response_reason='Agreement term ended' WHERE id=?",[id]);return ok({expired:true});
   }
   if(offer.status==='approved'&&offer.starts_at&&new Date(offer.starts_at)<=now){
    await db.execute("UPDATE world_logistics_trade_treaties SET status='active' WHERE id=?",[id]);return ok({activated:true});
   }
   if(offer.status!=='proposed'||!offer.response_due_at||new Date(offer.response_due_at)>now)return ok({skipped:true});
   const [[relation]]=await db.execute('SELECT trust,tension FROM world_faction_relations WHERE faction_a=? AND faction_b=?',[offer.faction_a,offer.faction_b]);
   const decision=npcTreatyDecision(relation?.trust??0,relation?.tension??100);
   await db.execute('UPDATE world_logistics_trade_treaties SET status=?,response_reason=?,responded_at=UTC_TIMESTAMP(),approved_at=IF(?="approved",UTC_TIMESTAMP(),approved_at) WHERE id=?',[decision.status,decision.reason,decision.status,id]);
   return ok({[decision.status]:true});
  });
  for(const key of Object.keys(counts))if(result.body[key])counts[key]++;
 }
 return counts;
}
