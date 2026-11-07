import {resolveSession} from './auth.js';

const ok=body=>({status:200,body});
const fail=(status,error)=>({status,body:{error}});
const command=actor=>['domina','high_command'].includes(actor.account_role);
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
const whole=(value,max)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
async function read(req){
 const chunks=[];let bytes=0;
 for await(const c of req){bytes+=c.length;if(bytes>8000)throw Object.assign(new Error('request_too_large'),{status:413});chunks.push(c)}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}
}
async function atomic(pool,callback){
 const conn=await pool.getConnection();
 try{await conn.beginTransaction();const result=await callback(conn);if(result.status===200)await conn.commit();else await conn.rollback();return result}
 catch(e){await conn.rollback().catch(()=>{});throw e}finally{conn.release()}
}
async function treasuryBalance(conn){
 const [[row]]=await conn.execute('SELECT balance FROM order_treasury WHERE id=1 FOR UPDATE');
 return Number(row.balance);
}
async function creditWallet(conn,characterId,amount,kind,source){
 if(!amount)return;
 await conn.execute('INSERT IGNORE INTO character_wallets(character_id,balance) VALUES(?,0)',[characterId]);
 const [[wallet]]=await conn.execute('SELECT balance FROM character_wallets WHERE character_id=? FOR UPDATE',[characterId]);
 const next=Number(wallet.balance)+amount;
 await conn.execute('UPDATE character_wallets SET balance=? WHERE character_id=?',[next,characterId]);
 await conn.execute('INSERT INTO character_wallet_ledger(character_id,kind,amount,balance_after,source_id) VALUES(?,?,?,?,?)',[characterId,kind,amount,next,source]);
}
async function debitTreasury(conn,amount,category,source,actor,character,note){
 const balance=await treasuryBalance(conn);
 if(balance<amount)return false;
 const after=balance-amount;
 await conn.execute('UPDATE order_treasury SET balance=? WHERE id=1',[after]);
 await conn.execute('INSERT INTO order_treasury_ledger(direction,category,amount,balance_after,account_id,character_id,source_id,note) VALUES("expense",?,?,?,?,?,?,?)',
  [category,amount,after,actor,character,source,note.slice(0,250)]);
 return true;
}
export async function creditTradeRevenue(conn,{deliveryId,contractId,saleValuePerUnit,quantity,accountId,characterId}){
 const revenue=Number(saleValuePerUnit)*Number(quantity);
 if(!Number.isSafeInteger(revenue)||revenue<0||revenue>100000000)return fail(400,'invalid_sale_value');
 if(!revenue)return ok({income:0});
 const balance=await treasuryBalance(conn),after=balance+revenue;
 if(!Number.isSafeInteger(after))return fail(409,'treasury_limit');
 await conn.execute('UPDATE order_treasury SET balance=? WHERE id=1',[after]);
 await conn.execute('INSERT INTO order_treasury_ledger(direction,category,amount,balance_after,account_id,character_id,source_id,note) VALUES("income","trade",?,?,?,?,?,?)',
  [revenue,after,accountId,characterId,String(deliveryId),'Contract #'+contractId+' trade proceeds']);
 return ok({income:revenue,treasury:after});
}
export function cycleDate(now,resetHour){
 const stamp=now instanceof Date?now.getTime():new Date(now).getTime();
 return new Date(stamp-resetHour*3600000).toISOString().slice(0,10);
}
export function distributePayroll(people,funds){
 const total=people.reduce((n,p)=>n+p.scheduled,0);
 const budget=Math.min(funds,total);
 if(!total||!budget)return people.map(p=>({...p,paid:0}));
 const allocations=people.map(p=>{const numerator=p.scheduled*budget;return {...p,paid:Math.floor(numerator/total),fraction:numerator%total}});
 let left=budget-allocations.reduce((n,p)=>n+p.paid,0);
 const order=allocations.map((_,index)=>index).sort((a,b)=>allocations[b].fraction-allocations[a].fraction||String(allocations[a].id).localeCompare(String(allocations[b].id)));
 for(let i=0;i<left;i++)allocations[order[i]].paid++;
 return allocations.map(({fraction,...rest})=>rest);
}
export async function runDailyPayroll(pool,now=new Date()){
 if(!pool)return null;
 return atomic(pool,async conn=>{
  const [[settings]]=await conn.execute('SELECT member_daily,bound_daily,reset_hour_utc,enabled FROM order_payroll_settings WHERE id=1');
  if(!settings.enabled)return ok({status:'disabled'});
  const cycle=cycleDate(now,Number(settings.reset_hour_utc));
  const [runs]=await conn.execute('SELECT cycle_date FROM order_payroll_runs WHERE cycle_date=? FOR UPDATE',[cycle]);
  if(runs.length)return ok({status:'already_paid',cycle});
  // Lock treasury first; trade income and mission spending use the same serialization point.
  const before=await treasuryBalance(conn);
  const [characters]=await conn.query('SELECT c.id,c.player_account_id,c.collar_bound FROM characters c JOIN accounts a ON a.id=c.player_account_id WHERE a.is_active=1 AND a.approval_status="approved" ORDER BY c.id');
  const requested=characters.map(c=>({id:c.id,owner:c.player_account_id,payClass:c.collar_bound?'bound':'member',scheduled:c.collar_bound?Number(settings.bound_daily):Number(settings.member_daily)}));
  const requestedTotal=requested.reduce((n,p)=>n+p.scheduled,0);
  const allocations=distributePayroll(requested,before);
  const paidTotal=allocations.reduce((n,p)=>n+p.paid,0);
  await conn.execute('INSERT INTO order_payroll_runs(cycle_date,available_before,requested_total,paid_total,recipients) VALUES(?,?,?,?,?)',[cycle,before,requestedTotal,paidTotal,allocations.length]);
  for(const p of allocations){
   await conn.execute('INSERT INTO order_daily_payroll(cycle_date,character_id,owner_account_id,pay_class,scheduled_amount,paid_amount) VALUES(?,?,?,?,?,?)',[cycle,p.id,p.owner,p.payClass,p.scheduled,p.paid]);
   if(p.paid){
    const source=cycle+':'+p.id;
    if(!await debitTreasury(conn,p.paid,'daily_pay',source,p.owner,p.id,'Order daily pay · '+cycle))return fail(409,'treasury_changed');
    await creditWallet(conn,p.id,p.paid,'daily_pay',source);
   }
  }
  return ok({status:'paid',cycle,available_before:before,requested_total:requestedTotal,paid_total:paidTotal,recipients:allocations.length});
 });
}

export async function treasuryRoute(pool,req,path){
 if(!pool)return fail(503,'database_unavailable');
 const actor=await resolveSession(pool,req);
 if(!actor)return fail(401,'not_authenticated');
 const manage=command(actor);
 if(path==='/treasury'&&req.method==='GET'){
  const [[cash],[settings],[runs],[ledger],[characters]]=await Promise.all([
   pool.query('SELECT balance,updated_at FROM order_treasury WHERE id=1'),
   pool.query('SELECT member_daily,bound_daily,reset_hour_utc,enabled FROM order_payroll_settings WHERE id=1'),
   pool.query('SELECT cycle_date,available_before,requested_total,paid_total,recipients FROM order_payroll_runs ORDER BY cycle_date DESC LIMIT 15'),
   manage?pool.query('SELECT l.id,l.direction,l.category,l.amount,l.balance_after,l.note,l.created_at,c.character_name FROM order_treasury_ledger l LEFT JOIN characters c ON c.id=l.character_id ORDER BY l.id DESC LIMIT 70'):Promise.resolve([[]]),
   pool.execute('SELECT c.id,c.character_name,c.collar_bound,COALESCE(w.balance,0) AS wallet FROM characters c LEFT JOIN character_wallets w ON w.character_id=c.id WHERE c.player_account_id=? ORDER BY c.character_name',[actor.id])
  ]);
  return ok({balance:Number(cash[0].balance),settings:settings[0],runs:manage?runs:[],ledger,characters,latest_run:runs[0]||null});
 }
 const characterWallet=/^\/treasury\/characters\/([0-9a-f-]{36})$/.exec(path);
 if(characterWallet&&req.method==='GET'){
  if(!uuid(characterWallet[1]))return fail(400,'invalid_character');
  const [owner]=await pool.execute('SELECT player_account_id FROM characters WHERE id=?',[characterWallet[1]]);
  if(!owner.length)return fail(404,'character_not_found');
  if(owner[0].player_account_id!==actor.id&&!manage)return fail(403,'character_owner_required');
  const [[balance],[history],[pay]]=await Promise.all([
   pool.execute('SELECT balance FROM character_wallets WHERE character_id=?',[characterWallet[1]]),
   pool.execute('SELECT kind,amount,created_at FROM character_wallet_ledger WHERE character_id=? ORDER BY id DESC LIMIT 40',[characterWallet[1]]),
   pool.execute('SELECT cycle_date,pay_class,scheduled_amount,paid_amount FROM order_daily_payroll WHERE character_id=? ORDER BY cycle_date DESC LIMIT 14',[characterWallet[1]])
  ]);
  return ok({balance:Number(balance[0]?.balance||0),history,pay});
 }
 if(path==='/treasury/settings'&&req.method==='POST'){
  if(!manage)return fail(403,'command_required');
  const b=await read(req);
  if(!whole(b?.member_daily,10000)||!whole(b?.bound_daily,10000)||b.bound_daily>b.member_daily||
   !whole(b.reset_hour_utc,23)||typeof b.enabled!=='boolean')return fail(400,'invalid_payroll_settings');
  await pool.execute('UPDATE order_payroll_settings SET member_daily=?,bound_daily=?,reset_hour_utc=?,enabled=? WHERE id=1',
   [b.member_daily,b.bound_daily,b.reset_hour_utc,b.enabled?1:0]);
  return ok({status:'saved'});
 }
 if(path==='/treasury/missions'&&req.method==='GET'){
  if(!manage)return fail(403,'command_required');
  const [events]=await pool.query('SELECT id,name,starts_at FROM order_encounters WHERE status="completed" ORDER BY updated_at DESC LIMIT 70');
  const [people]=await pool.query('SELECT c.id,c.character_name,c.player_account_id FROM characters c JOIN accounts a ON a.id=c.player_account_id WHERE a.is_active=1 AND a.approval_status="approved" ORDER BY c.character_name LIMIT 500');
  const [paid]=await pool.query('SELECT event_id,character_id,amount FROM order_mission_payments ORDER BY paid_at DESC LIMIT 500');
  return ok({events,characters:people,paid});
 }
 const mission=/^\/treasury\/missions\/([0-9a-f-]{36})\/pay\/([0-9a-f-]{36})$/.exec(path);
 if(mission&&req.method==='POST'){
  if(!manage)return fail(403,'command_required');
  const [eventId,characterId]=mission.slice(1),b=await read(req);
  if(!uuid(eventId)||!uuid(characterId)||!whole(b?.amount,10000)||b.amount===0)return fail(400,'invalid_mission_pay');
  return atomic(pool,async conn=>{
   const [events]=await conn.execute('SELECT id,status,name FROM order_encounters WHERE id=? FOR UPDATE',[eventId]);
   if(!events.length||events[0].status!=='completed')return fail(409,'event_must_be_completed');
   const [characters]=await conn.execute('SELECT c.id FROM characters c JOIN accounts a ON a.id=c.player_account_id WHERE c.id=? AND a.is_active=1 AND a.approval_status="approved" FOR UPDATE',[characterId]);
   if(!characters.length)return fail(404,'character_not_eligible');
   const [attendance]=await conn.execute('SELECT 1 FROM order_event_signups WHERE encounter_id=? AND character_id=? AND status="approved" UNION SELECT 1 FROM order_combatants WHERE encounter_id=? AND character_id=? LIMIT 1',[eventId,characterId,eventId,characterId]);
   if(!attendance.length)return fail(403,'character_not_in_event');
   const [prior]=await conn.execute('SELECT 1 FROM order_mission_payments WHERE event_id=? AND character_id=?',[eventId,characterId]);
   if(prior.length)return fail(409,'mission_already_paid');
   const source=eventId+':'+characterId;
   if(!await debitTreasury(conn,b.amount,'mission',source,actor.id,characterId,'Event reward: '+events[0].name))return fail(409,'treasury_insufficient');
   await conn.execute('INSERT INTO order_mission_payments(event_id,character_id,amount,granted_by) VALUES(?,?,?,?)',[eventId,characterId,b.amount,actor.id]);
   await creditWallet(conn,characterId,b.amount,'mission',source);
   return ok({status:'paid',amount:b.amount});
  });
 }
 return fail(404,'not_found');
}
