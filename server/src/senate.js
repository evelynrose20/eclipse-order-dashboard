import {resolveSession} from './auth.js';
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const id=n=>Number.isSafeInteger(Number(n))&&Number(n)>0;
const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(s);
const valid=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.trim().length<=max;
async function read(req){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>12000)throw Object.assign(new Error('request_too_large'),{status:413});chunks.push(chunk)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}}
async function tx(pool,fn){const c=await pool.getConnection();try{await c.beginTransaction();const r=await fn(c);if(r.status===200)await c.commit();else await c.rollback();return r}catch(e){await c.rollback().catch(()=>{});throw e}finally{c.release()}}
async function audit(c,actor,action,subject,detail=''){await c.execute('INSERT INTO order_senate_audit(account_id,action,subject,detail) VALUES(?,?,?,?)',[actor,action,String(subject).slice(0,90),detail.slice(0,350)])}
export function senateResult(votes,electorate,quorumRequired){const yes=votes.filter(v=>v==='yes').length,no=votes.filter(v=>v==='no').length,abstain=votes.filter(v=>v==='abstain').length;const participated=votes.length;return {yes,no,abstain,participated,electorate,quorum_required:quorumRequired,quorum_met:participated>=quorumRequired,passed:participated>=quorumRequired&&yes>no}}
export async function senateRoute(pool,req,path){
 if(!pool)return fail(503,'database_unavailable');
 const actor=await resolveSession(pool,req);if(!actor)return fail(401,'not_authenticated');
 const domina=actor.account_role==='domina';
 const [[settings]]=await pool.execute('SELECT enabled,quorum_percent,updated_at FROM order_senate_settings WHERE id=1');
 if(!settings)return fail(503,'senate_setup_required');
 const enabled=!!settings.enabled;
 if(path==='/governance/senate'&&req.method==='GET'){
  const [senators]=await pool.execute('SELECT s.account_id,a.display_name,s.active,s.joined_at,s.removed_at FROM order_senators s JOIN accounts a ON a.id=s.account_id ORDER BY s.active DESC,a.display_name');
  const [bills]=await pool.execute('SELECT b.*,a.display_name AS sponsor_name FROM order_senate_bills b JOIN accounts a ON a.id=b.sponsor_id ORDER BY b.id DESC LIMIT 120');
  const [ballots]=await pool.execute('SELECT v.bill_id,v.account_id,v.vote FROM order_senate_ballots v JOIN order_senate_bills b ON b.id=v.bill_id ORDER BY b.id DESC LIMIT 5000');
  const [electorate]=await pool.execute('SELECT e.bill_id,e.account_id FROM order_senate_electorate e JOIN order_senate_bills b ON b.id=e.bill_id ORDER BY b.id DESC LIMIT 5000');
  const member=senators.some(s=>s.account_id===actor.id&&s.active);
  const [history]=domina?await pool.execute('SELECT l.id,l.action,l.subject,l.detail,l.created_at,a.display_name AS actor_name FROM order_senate_audit l JOIN accounts a ON a.id=l.account_id ORDER BY l.id DESC LIMIT 100'):[[]];
  return ok({enabled,quorum_percent:Number(settings.quorum_percent),can_manage:domina,is_senator:member,senators:enabled||domina?senators:[],bills:enabled||domina?bills.map(b=>{const entries=ballots.filter(v=>Number(v.bill_id)===Number(b.id));const r=senateResult(entries.map(v=>v.vote),b.electorate,b.quorum_required);return {...b,...r,can_vote:b.state==='open'&&electorate.some(v=>Number(v.bill_id)===Number(b.id)&&v.account_id===actor.id),my_vote:entries.find(v=>v.account_id===actor.id)?.vote||null,ballots:domina?entries.map(v=>({account_id:v.account_id,vote:v.vote})):undefined}}):[],history:domina?history:[]});
 }
 if(path==='/governance/senate/settings'&&req.method==='PUT'){
  if(!domina)return fail(403,'domina_required');
  const b=await read(req);if(typeof b?.enabled!=='boolean'||!Number.isInteger(b.quorum_percent)||b.quorum_percent<25||b.quorum_percent>100)return fail(400,'invalid_senate_settings');
  return tx(pool,async c=>{
   const [[current]]=await c.execute('SELECT enabled FROM order_senate_settings WHERE id=1 FOR UPDATE');
   await c.execute('UPDATE order_senate_settings SET enabled=?,quorum_percent=?,updated_by=? WHERE id=1',[b.enabled?1:0,b.quorum_percent,actor.id]);
   await audit(c,actor.id,'settings','senate',JSON.stringify({enabled:b.enabled,quorum_percent:b.quorum_percent,previous_enabled:!!current.enabled}));
   return ok({enabled:b.enabled,quorum_percent:b.quorum_percent});
  });
 }
 if(!enabled)return fail(409,'senate_disabled');
 if(path==='/governance/senate/senators'&&req.method==='PUT'){
  if(!domina)return fail(403,'domina_required');
  const b=await read(req);if(!uuid(b?.account_id)||typeof b.active!=='boolean')return fail(400,'invalid_senator');
  return tx(pool,async c=>{
   const [a]=await c.execute('SELECT id FROM accounts WHERE id=? AND is_active=1 AND approval_status="approved"',[b.account_id]);
   if(!a.length)return fail(404,'account_not_eligible');
   await c.execute('INSERT INTO order_senators(account_id,appointed_by,active,removed_at) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE active=VALUES(active),removed_at=VALUES(removed_at),appointed_by=VALUES(appointed_by)',[b.account_id,actor.id,b.active?1:0,b.active?null:new Date()]);
   await audit(c,actor.id,b.active?'appoint':'remove','senator:'+b.account_id);
   return ok({saved:true});
  });
 }
 const [mySeats]=await pool.execute('SELECT 1 FROM order_senators WHERE account_id=? AND active=1',[actor.id]);
 const senator=mySeats.length>0;
 if(path==='/governance/senate/bills'&&req.method==='POST'){
  if(!senator&&!domina)return fail(403,'senator_required');
  const b=await read(req);if(!valid(b?.title,160)||!valid(b.description,6000)||!['general','commerce','diplomacy','operations','charter'].includes(b.category))return fail(400,'invalid_bill');
  return tx(pool,async c=>{
   const [made]=await c.execute('INSERT INTO order_senate_bills(title,description,category,sponsor_id) VALUES(?,?,?,?)',[b.title.trim(),b.description.trim(),b.category,actor.id]);
   await audit(c,actor.id,'create_bill','bill:'+made.insertId,b.title.trim());
   return ok({id:made.insertId});
  });
 }
 const m=path.match(/^\/governance\/senate\/bills\/(\d+)\/(open|vote|close|withdraw)$/);
 if(m&&req.method==='POST'&&id(m[1])){
  const billId=Number(m[1]),action=m[2];
  return tx(pool,async c=>{
   const [[current]]=await c.execute('SELECT * FROM order_senate_bills WHERE id=? FOR UPDATE',[billId]);
   if(!current)return fail(404,'bill_not_found');
   if(action==='open'){
    if(!domina||current.state!=='draft')return fail(403,'cannot_open_bill');
    const [eligible]=await c.execute('SELECT s.account_id FROM order_senators s JOIN accounts a ON a.id=s.account_id WHERE s.active=1 AND a.is_active=1 AND a.approval_status="approved"');
    if(eligible.length<2)return fail(409,'at_least_two_senators_required');
    const quorum=Math.max(2,Math.ceil(eligible.length*Number(settings.quorum_percent)/100));
    for(const s of eligible)await c.execute('INSERT INTO order_senate_electorate(bill_id,account_id) VALUES(?,?)',[billId,s.account_id]);
    await c.execute('UPDATE order_senate_bills SET state="open",electorate=?,quorum_required=?,opened_at=UTC_TIMESTAMP() WHERE id=?',[eligible.length,quorum,billId]);
    await audit(c,actor.id,'open_bill','bill:'+billId,'Electorate '+eligible.length+', quorum '+quorum);
    return ok({opened:true});
   }
   if(action==='withdraw'){
    if(!domina&&current.sponsor_id!==actor.id)return fail(403,'sponsor_required');
    if(!['draft','open'].includes(current.state))return fail(409,'bill_closed');
    await c.execute('UPDATE order_senate_bills SET state="withdrawn",closed_at=UTC_TIMESTAMP() WHERE id=?',[billId]);
    await audit(c,actor.id,'withdraw_bill','bill:'+billId);return ok({withdrawn:true});
   }
   if(current.state!=='open')return fail(409,'bill_not_open');
   if(action==='vote'){
    const [eligible]=await c.execute('SELECT 1 FROM order_senate_electorate WHERE bill_id=? AND account_id=?',[billId,actor.id]);
    if(!eligible.length||!senator)return fail(403,'not_eligible_to_vote');
    const b=await read(req);if(!['yes','no','abstain'].includes(b?.vote))return fail(400,'invalid_vote');
    await c.execute('INSERT INTO order_senate_ballots(bill_id,account_id,vote) VALUES(?,?,?) ON DUPLICATE KEY UPDATE vote=VALUES(vote)',[billId,actor.id,b.vote]);
    await audit(c,actor.id,'cast_vote','bill:'+billId,b.vote);return ok({vote:b.vote});
   }
   if(!domina)return fail(403,'domina_required');
   const [votes]=await c.execute('SELECT vote FROM order_senate_ballots WHERE bill_id=?',[billId]);
   const result=senateResult(votes.map(v=>v.vote),current.electorate,current.quorum_required);
   if(!result.quorum_met)return fail(409,'quorum_not_met');
   await c.execute('UPDATE order_senate_bills SET state=?,closed_at=UTC_TIMESTAMP() WHERE id=?',[result.passed?'passed':'rejected',billId]);
   await audit(c,actor.id,'close_bill','bill:'+billId,result.passed?'passed':'rejected');
   return ok(result);
  });
 }
 return fail(404,'not_found');
}
