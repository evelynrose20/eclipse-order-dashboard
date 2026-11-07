import {resolveSession} from './auth.js';

const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const integer=v=>Number.isSafeInteger(Number(v))&&Number(v)>0;
const valid=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.trim().length<=max;
const hex=s=>typeof s==='string'&&/^#[a-fA-F0-9]{6}$/.test(s);
const key=id=>id===null||id===undefined?'independent':'party:'+String(id);
const groupId=k=>k==='independent'?null:Number(k.slice(6));
async function read(req){
 let size=0;const parts=[];
 for await(const chunk of req){size+=chunk.length;if(size>12000)throw Object.assign(new Error('request_too_large'),{status:413});parts.push(chunk)}
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{return null}
}
async function transaction(pool,callback){
 const db=await pool.getConnection();
 try{await db.beginTransaction();const result=await callback(db);if(result.status===200)await db.commit();else await db.rollback();return result}
 catch(error){await db.rollback().catch(()=>{});throw error}
 finally{db.release()}
}
async function audit(db,actor,action,subject,detail=''){
 await db.execute('INSERT INTO order_senate_audit(account_id,action,subject,detail) VALUES(?,?,?,?)',[actor,action,String(subject).slice(0,90),String(detail).slice(0,350)]);
}

// Hare quota + largest remainders, constrained by actual available candidates.
// A list with insufficient candidates cannot take more seats than it can fill.
// Remaining seats stay vacant when nobody else is available.
export function allocateSeats(ballots,candidates,seatCount=15){
 if(!Number.isInteger(seatCount)||seatCount<1||seatCount>15)throw new Error('invalid_seat_count');
 const lists=new Map();
 for(const c of candidates){
  const k=key(c.party_id);
  if(!lists.has(k))lists.set(k,{key:k,party_id:c.party_id??null,votes:0,candidates:[],seats:0,quota:0});
  lists.get(k).candidates.push(c);
 }
 for(const b of ballots){const l=lists.get(key(b.party_id));if(l)l.votes++}
 const validVotes=[...lists.values()].reduce((n,l)=>n+l.votes,0);
 if(!validVotes)return {distribution:[],winners:[],vacant:seatCount,total_votes:0};
 for(const l of lists.values()){
  l.quota=l.votes*seatCount/validVotes;
  l.seats=Math.min(l.candidates.length,Math.floor(l.quota));
 }
 let remaining=seatCount-[...lists.values()].reduce((n,l)=>n+l.seats,0);
 const rank=[...lists.values()].sort((a,b)=>{
  const remA=a.quota-Math.floor(a.quota),remB=b.quota-Math.floor(b.quota);
  return remB-remA||b.votes-a.votes||a.key.localeCompare(b.key);
 });
 while(remaining>0){
  const eligible=rank.filter(l=>l.seats<l.candidates.length&&l.votes>0);
  if(!eligible.length)break;
  for(const l of eligible){if(!remaining)break;l.seats++;remaining--}
 }
 const preferences=new Map();
 for(const b of ballots)if(b.candidate_id)preferences.set(b.candidate_id,(preferences.get(b.candidate_id)||0)+1);
 const winners=[];
 const distribution=[...lists.values()].filter(l=>l.votes>0).sort((a,b)=>b.seats-a.seats||b.votes-a.votes||a.key.localeCompare(b.key));
 for(const l of distribution){
  l.candidates.sort((a,b)=>(preferences.get(b.account_id)||0)-(preferences.get(a.account_id)||0)||String(a.account_id).localeCompare(String(b.account_id)));
  for(const c of l.candidates.slice(0,l.seats))winners.push({candidate_id:c.account_id,party_id:l.party_id,party_key:l.key});
 }
 return {distribution:distribution.map(l=>({party_id:l.party_id,votes:l.votes,seats:l.seats})),winners,vacant:remaining,total_votes:validVotes};
}

export async function senatePoliticsRoute(pool,req,path){
 if(!pool)return fail(503,'database_unavailable');
 const actor=await resolveSession(pool,req);if(!actor)return fail(401,'not_authenticated');
 const domina=actor.account_role==='domina';
 if(path==='/governance/senate/politics'&&req.method==='GET'){
  const [[settings]]=await pool.execute('SELECT enabled FROM order_senate_settings WHERE id=1');
  const [parties]=await pool.execute('SELECT p.id,p.name,p.abbreviation,p.manifesto,p.color,p.leader_id,p.state,a.display_name AS leader_name,(SELECT COUNT(*) FROM order_senate_party_members m WHERE m.party_id=p.id) AS members FROM order_senate_parties p JOIN accounts a ON a.id=p.leader_id ORDER BY p.state,p.name LIMIT 150');
  const [members]=await pool.execute('SELECT party_id FROM order_senate_party_members WHERE account_id=?',[actor.id]);
  const [seats]=await pool.execute('SELECT s.seat_number,s.account_id,s.party_id,a.display_name AS holder FROM order_senate_seats s LEFT JOIN accounts a ON a.id=s.account_id ORDER BY s.seat_number');
  const [elections]=await pool.execute('SELECT id,title,phase,term_days,created_at,phase_at,completed_at FROM order_senate_elections ORDER BY id DESC LIMIT 30');
  const current=elections.find(e=>!['complete','cancelled'].includes(e.phase));
  const election=current||elections[0]||null;
  let candidates=[],results=[],tallies=[],ballotCount=0,hasVoted=false;
  if(election){
   [candidates]=await pool.execute('SELECT c.election_id,c.account_id,c.party_id,c.statement,a.display_name AS candidate_name FROM order_senate_candidates c JOIN accounts a ON a.id=c.account_id WHERE c.election_id=? ORDER BY c.nominated_at,c.account_id',[election.id]);
   [results]=await pool.execute('SELECT r.seat_number,r.candidate_id,r.party_id,r.state,r.confirmed_at,a.display_name AS candidate_name FROM order_senate_election_results r LEFT JOIN accounts a ON a.id=r.candidate_id WHERE r.election_id=? ORDER BY r.seat_number',[election.id]);
   [tallies]=await pool.execute('SELECT party_id,COUNT(*) AS votes FROM order_senate_election_ballots WHERE election_id=? GROUP BY party_id',[election.id]);
   const [[count]]=await pool.execute('SELECT COUNT(*) AS n FROM order_senate_election_ballots WHERE election_id=?',[election.id]);
   ballotCount=Number(count.n);
   const [mine]=await pool.execute('SELECT 1 FROM order_senate_election_ballots WHERE election_id=? AND voter_id=? LIMIT 1',[election.id,actor.id]);
   hasVoted=mine.length>0;
  }
  const [coalitions]=await pool.execute('SELECT c.id,c.title,c.agreement,c.state,c.formed_by,a.display_name AS founder_name FROM order_senate_coalitions c JOIN accounts a ON a.id=c.formed_by ORDER BY c.id DESC LIMIT 60');
  const [coalitionMembers]=await pool.execute('SELECT coalition_id,party_id,status FROM order_senate_coalition_parties ORDER BY coalition_id,party_id');
  const [bills]=await pool.execute('SELECT b.id,b.title,b.description,b.category,b.state,b.opened_at,b.created_at,a.display_name AS sponsor_name,b.electorate,b.quorum_required FROM order_senate_bills b JOIN accounts a ON a.id=b.sponsor_id ORDER BY b.id DESC LIMIT 100');
  const [votes]=await pool.execute('SELECT bill_id,vote,COUNT(*) AS n FROM order_senate_ballots GROUP BY bill_id,vote');
  const [headRows]=await pool.execute('SELECT h.head_number,h.title,h.account_id,a.display_name AS holder FROM order_senate_heads h LEFT JOIN accounts a ON a.id=h.account_id ORDER BY h.head_number');
  const [chair]=await pool.execute('SELECT display_name FROM accounts WHERE account_role="domina" AND is_active=1 AND approval_status="approved" ORDER BY id LIMIT 1');
  const [auditRows]=domina?await pool.execute('SELECT action,subject,detail,created_at FROM order_senate_audit ORDER BY id DESC LIMIT 80'):[[]];
  // Secret ballots: only aggregate totals are visible; never return voter identities.
  return ok({enabled:!!settings?.enabled,can_manage:domina,actor_id:actor.id,my_party_id:members[0]?.party_id||null,
   parties,seats,elections,election,candidates,results,ballot_count:ballotCount,has_voted:hasVoted,
   tallies:election?.phase==='confirmation'||['complete','cancelled'].includes(election?.phase)?tallies:[],
   coalitions:coalitions.map(c=>({...c,parties:coalitionMembers.filter(m=>m.coalition_id===c.id)})),
   bills:bills.map(b=>({...b,yes:Number(votes.find(v=>Number(v.bill_id)===Number(b.id)&&v.vote==='yes')?.n||0),no:Number(votes.find(v=>Number(v.bill_id)===Number(b.id)&&v.vote==='no')?.n||0),abstain:Number(votes.find(v=>Number(v.bill_id)===Number(b.id)&&v.vote==='abstain')?.n||0)})),
   heads:[{head_number:1,title:'Domina',holder:chair[0]?.display_name||'Vacant'},...headRows.map(h=>({head_number:h.head_number,title:h.title,holder:h.holder||null,account_id:h.account_id}))],
   history:auditRows});
 }
 // No live write action may occur before the Senate is actually convened.
 const [[settings]]=await pool.execute('SELECT enabled FROM order_senate_settings WHERE id=1');
 if(!settings?.enabled)return fail(409,'senate_not_convened');
 const post=path==='/governance/senate/parties'&&req.method==='POST';
 if(post){
  const b=await read(req);
  if(!valid(b?.name,100)||!valid(b?.abbreviation,12)||!valid(b?.manifesto,5000)||!hex(b.color)||!/^[A-Z0-9-]{2,12}$/.test(b.abbreviation))return fail(400,'invalid_party');
  return transaction(pool,async db=>{
   const [existing]=await db.execute('SELECT party_id FROM order_senate_party_members WHERE account_id=? FOR UPDATE',[actor.id]);
   if(existing.length)return fail(409,'already_in_party');
   try{
    const [created]=await db.execute('INSERT INTO order_senate_parties(name,abbreviation,manifesto,color,leader_id) VALUES(?,?,?,?,?)',[b.name.trim(),b.abbreviation,b.manifesto.trim(),b.color,actor.id]);
    await db.execute('INSERT INTO order_senate_party_members(account_id,party_id) VALUES(?,?)',[actor.id,created.insertId]);
    await audit(db,actor.id,'party_found','party:'+created.insertId,b.name);
    return ok({id:created.insertId});
   }catch(e){if(e.code==='ER_DUP_ENTRY')return fail(409,'party_exists');throw e}
  });
 }
 const partyMatch=/^\/governance\/senate\/parties\/(\d+)\/(join|leave|edit)$/.exec(path);
 if(partyMatch&&req.method==='POST'){
  const partyId=Number(partyMatch[1]),action=partyMatch[2];
  return transaction(pool,async db=>{
   const [parties]=await db.execute('SELECT * FROM order_senate_parties WHERE id=? AND state="active" FOR UPDATE',[partyId]);
   if(!parties.length)return fail(404,'party_not_found');
   const party=parties[0];
   const [mine]=await db.execute('SELECT party_id FROM order_senate_party_members WHERE account_id=? FOR UPDATE',[actor.id]);
   if(action==='join'){
    if(mine.length)return fail(409,'already_in_party');
    await db.execute('INSERT INTO order_senate_party_members(account_id,party_id) VALUES(?,?)',[actor.id,partyId]);
    await audit(db,actor.id,'party_join','party:'+partyId);
   }else if(action==='leave'){
    if(!mine.length||Number(mine[0].party_id)!==partyId)return fail(409,'not_party_member');
    if(party.leader_id===actor.id)return fail(409,'leader_cannot_leave');
    await db.execute('DELETE FROM order_senate_party_members WHERE account_id=?',[actor.id]);
    await audit(db,actor.id,'party_leave','party:'+partyId);
   }else{
    if(party.leader_id!==actor.id&&!domina)return fail(403,'party_leader_required');
    const b=await read(req);
    if(!valid(b?.name,100)||!valid(b?.manifesto,5000)||!hex(b.color))return fail(400,'invalid_party');
    await db.execute('UPDATE order_senate_parties SET name=?,manifesto=?,color=? WHERE id=?',[b.name.trim(),b.manifesto.trim(),b.color,partyId]);
    await audit(db,actor.id,'party_edit','party:'+partyId,b.name);
   }
   return ok({saved:true});
  });
 }
 if(path==='/governance/senate/elections'&&req.method==='POST'){
  if(!domina)return fail(403,'domina_required');
  const b=await read(req);
  if(!valid(b?.title,140)||!Number.isInteger(b.term_days)||b.term_days<14||b.term_days>365)return fail(400,'invalid_election');
  return transaction(pool,async db=>{
   // Serialize starts with the Senate setting row to prevent two concurrent elections.
   await db.execute('SELECT enabled FROM order_senate_settings WHERE id=1 FOR UPDATE');
   const [active]=await db.execute('SELECT id FROM order_senate_elections WHERE phase NOT IN ("complete","cancelled") LIMIT 1');
   if(active.length)return fail(409,'election_already_active');
   const [created]=await db.execute('INSERT INTO order_senate_elections(title,term_days,created_by) VALUES(?,?,?)',[b.title.trim(),b.term_days,actor.id]);
   await audit(db,actor.id,'election_created','election:'+created.insertId,b.title);
   return ok({id:created.insertId});
  });
 }
 const match=/^\/governance\/senate\/elections\/(\d+)\/(nominate|vote|advance|confirm|invest)$/.exec(path);
 if(match&&req.method==='POST'){
  const electionId=Number(match[1]),action=match[2];
  return transaction(pool,async db=>{
   const [rows]=await db.execute('SELECT * FROM order_senate_elections WHERE id=? FOR UPDATE',[electionId]);
   if(!rows.length)return fail(404,'election_not_found');
   const election=rows[0];
   const b=await read(req);
   if(action==='nominate'){
    if(election.phase!=='nominations')return fail(409,'nominations_closed');
    if(!valid(b?.statement,1500))return fail(400,'candidate_statement_required');
    const [member]=await db.execute('SELECT party_id FROM order_senate_party_members WHERE account_id=?',[actor.id]);
    const partyId=member[0]?.party_id||null;
    try{await db.execute('INSERT INTO order_senate_candidates(election_id,account_id,party_id,statement) VALUES(?,?,?,?)',[electionId,actor.id,partyId,b.statement.trim()])}
    catch(e){if(e.code==='ER_DUP_ENTRY')return fail(409,'already_nominated');throw e}
    await audit(db,actor.id,'candidate_nominated','election:'+electionId,partyId?'party:'+partyId:'independent');
    return ok({saved:true});
   }
   if(action==='vote'){
    if(election.phase!=='voting')return fail(409,'voting_closed');
    if(!(b?.party_id===null||integer(b.party_id)))return fail(400,'invalid_ballot');
    const partyId=b.party_id===null?null:Number(b.party_id),candidate=b.candidate_id||null;
    const [slate]=await db.execute('SELECT account_id FROM order_senate_candidates WHERE election_id=? AND party_id <=> ?',[electionId,partyId]);
    if(!slate.length)return fail(400,'slate_unavailable');
    if(partyId===null&&!candidate)return fail(400,'independent_preference_required');
    if(candidate&&!slate.some(x=>x.account_id===candidate))return fail(400,'candidate_not_in_slate');
    try{await db.execute('INSERT INTO order_senate_election_ballots(election_id,voter_id,party_id,candidate_id) VALUES(?,?,?,?)',[electionId,actor.id,partyId,candidate]);}
    catch(e){if(e.code==='ER_DUP_ENTRY')return fail(409,'ballot_already_cast');throw e}
    return ok({saved:true});
   }
   if(!domina)return fail(403,'domina_required');
   if(action==='advance'){
    const next={nominations:'campaign',campaign:'voting',voting:'confirmation'}[election.phase];
    if(!next)return fail(409,'phase_cannot_advance');
    if(next==='voting'){
     const [[nominees]]=await db.execute('SELECT COUNT(*) AS n FROM order_senate_candidates WHERE election_id=?',[electionId]);
     if(!Number(nominees.n))return fail(409,'no_candidates');
    }
    if(next==='confirmation'){
     const [ballots]=await db.execute('SELECT party_id,candidate_id FROM order_senate_election_ballots WHERE election_id=?',[electionId]);
     const [candidates]=await db.execute('SELECT party_id,account_id FROM order_senate_candidates WHERE election_id=?',[electionId]);
     if(!ballots.length)return fail(409,'no_ballots');
     const allocation=allocateSeats(ballots,candidates);
     let seat=1;
     for(const w of allocation.winners){
      await db.execute('INSERT INTO order_senate_election_results(election_id,seat_number,candidate_id,party_id) VALUES(?,?,?,?)',[electionId,seat++,w.candidate_id,w.party_id]);
     }
     while(seat<=15){await db.execute('INSERT INTO order_senate_election_results(election_id,seat_number,candidate_id,party_id,state) VALUES(?,?,NULL,NULL,"vacant")',[electionId,seat++])}
    }
    await db.execute('UPDATE order_senate_elections SET phase=?,phase_at=UTC_TIMESTAMP() WHERE id=?',[next,electionId]);
    await audit(db,actor.id,'election_phase','election:'+electionId,next);
    return ok({phase:next});
   }
   if(election.phase!=='confirmation')return fail(409,'election_not_in_confirmation');
   if(action==='confirm'){
    if(!Number.isInteger(b?.seat_number)||b.seat_number<1||b.seat_number>15||!['confirm','reject'].includes(b.decision))return fail(400,'invalid_confirmation');
    const [result]=await db.execute('SELECT * FROM order_senate_election_results WHERE election_id=? AND seat_number=? FOR UPDATE',[electionId,b.seat_number]);
    if(!result.length||result[0].state!=='pending')return fail(409,'seat_not_pending');
    const seat=result[0];
    if(b.decision==='confirm'){
     await db.execute('UPDATE order_senate_election_results SET state="confirmed",confirmed_at=UTC_TIMESTAMP() WHERE election_id=? AND seat_number=?',[electionId,b.seat_number]);
     await audit(db,actor.id,'candidate_confirmed','election:'+electionId,'seat '+b.seat_number);
    }else{
     if(!valid(b.reason,500))return fail(400,'rejection_reason_required');
     await db.execute('INSERT INTO order_senate_election_rejections(election_id,candidate_id,seat_number,reason) VALUES(?,?,?,?)',[electionId,seat.candidate_id,b.seat_number,b.reason.trim()]);
     const [poolCandidates]=await db.execute('SELECT c.account_id,COUNT(v.candidate_id) AS preferences FROM order_senate_candidates c LEFT JOIN order_senate_election_ballots v ON v.election_id=c.election_id AND v.candidate_id=c.account_id WHERE c.election_id=? AND c.party_id <=> ? GROUP BY c.account_id,c.nominated_at ORDER BY preferences DESC,c.nominated_at,c.account_id',[electionId,seat.party_id]);
     const [used]=await db.execute('SELECT candidate_id FROM order_senate_election_results WHERE election_id=? AND candidate_id IS NOT NULL',[electionId]);
     const [rejected]=await db.execute('SELECT candidate_id FROM order_senate_election_rejections WHERE election_id=?',[electionId]);
     const blocked=new Set([...used,...rejected].map(x=>x.candidate_id));
     const replacement=poolCandidates.find(x=>!blocked.has(x.account_id));
     if(replacement)await db.execute('UPDATE order_senate_election_results SET candidate_id=?,state="pending",confirmed_at=NULL WHERE election_id=? AND seat_number=?',[replacement.account_id,electionId,b.seat_number]);
     else await db.execute('UPDATE order_senate_election_results SET candidate_id=NULL,state="vacant",confirmed_at=NULL WHERE election_id=? AND seat_number=?',[electionId,b.seat_number]);
     await audit(db,actor.id,'candidate_rejected','election:'+electionId,'seat '+b.seat_number+' · '+b.reason);
    }
    return ok({saved:true});
   }
   if(action==='invest'){
    const [results]=await db.execute('SELECT * FROM order_senate_election_results WHERE election_id=? ORDER BY seat_number',[electionId]);
    if(results.length!==15||results.some(x=>x.state==='pending'))return fail(409,'confirm_all_seats_first');
    await db.execute('UPDATE order_senate_seats SET account_id=NULL,party_id=NULL,appointed_at=NULL');
    for(const r of results.filter(x=>x.state==='confirmed')){
     await db.execute('UPDATE order_senate_seats SET account_id=?,party_id=?,appointed_at=UTC_TIMESTAMP() WHERE seat_number=?',[r.candidate_id,r.party_id,r.seat_number]);
    }
    await db.execute('UPDATE order_senate_elections SET phase="complete",completed_at=UTC_TIMESTAMP() WHERE id=?',[electionId]);
    await audit(db,actor.id,'election_investiture','election:'+electionId,'15 elected places, Domina-confirmed');
    return ok({invested:true});
   }
  });
 }
 if(path==='/governance/senate/coalitions'&&req.method==='POST'){
  const b=await read(req);
  if(!valid(b?.title,100)||!valid(b?.agreement,6000)||!Array.isArray(b.party_ids)||b.party_ids.length<2||b.party_ids.length>15||!b.party_ids.every(integer))return fail(400,'invalid_coalition');
  const ids=[...new Set(b.party_ids.map(Number))];if(ids.length<2)return fail(400,'invalid_coalition');
  return transaction(pool,async db=>{
   const [leaders]=await db.execute('SELECT id,leader_id FROM order_senate_parties WHERE id IN ('+ids.map(()=>'?').join(',')+') AND state="active"',[...ids]);
   if(leaders.length!==ids.length||(!domina&&!leaders.some(p=>p.leader_id===actor.id)))return fail(403,'party_leader_required');
   const [created]=await db.execute('INSERT INTO order_senate_coalitions(title,agreement,formed_by) VALUES(?,?,?)',[b.title.trim(),b.agreement.trim(),actor.id]);
   for(const p of leaders)await db.execute('INSERT INTO order_senate_coalition_parties(coalition_id,party_id,status) VALUES(?,?,?)',[created.insertId,p.id,domina||p.leader_id===actor.id?'accepted':'invited']);
   await audit(db,actor.id,'coalition_proposed','coalition:'+created.insertId,b.title);
   return ok({id:created.insertId});
  });
 }
 const coalition=/^\/governance\/senate\/coalitions\/(\d+)\/(accept|dissolve)$/.exec(path);
 if(coalition&&req.method==='POST'){
  const coalitionId=Number(coalition[1]);
  return transaction(pool,async db=>{
   const [rows]=await db.execute('SELECT id,state,formed_by FROM order_senate_coalitions WHERE id=? FOR UPDATE',[coalitionId]);
   if(!rows.length||rows[0].state!=='active')return fail(404,'coalition_not_found');
   if(coalition[2]==='dissolve'){
    if(!domina&&rows[0].formed_by!==actor.id)return fail(403,'coalition_owner_required');
    await db.execute('UPDATE order_senate_coalitions SET state="dissolved" WHERE id=?',[coalitionId]);
    await audit(db,actor.id,'coalition_dissolved','coalition:'+coalitionId);
   }else{
    const [myParty]=await db.execute('SELECT p.id FROM order_senate_parties p JOIN order_senate_coalition_parties cp ON cp.party_id=p.id WHERE p.leader_id=? AND cp.coalition_id=? AND cp.status="invited"',[actor.id,coalitionId]);
    if(!myParty.length)return fail(403,'party_leader_required');
    await db.execute('UPDATE order_senate_coalition_parties SET status="accepted" WHERE coalition_id=? AND party_id=?',[coalitionId,myParty[0].id]);
    await audit(db,actor.id,'coalition_joined','coalition:'+coalitionId,'party:'+myParty[0].id);
   }
   return ok({saved:true});
  });
 }
 return fail(404,'not_found');
}
