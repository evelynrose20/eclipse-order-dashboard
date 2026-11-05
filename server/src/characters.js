import {randomUUID} from 'node:crypto';
import {resolveSession} from './auth.js';

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
 if(full)return {...record,view_mode:'full'};
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
  const saved={...data,id,name,collar_bound:bound,rank:bound?labels[rank]:'Unbound: Free'};
  await pool.execute(
   'INSERT INTO characters(id,character_name,player_account_id,handler_account_id,collar_bound,bound_rank,sheet_json) VALUES(?,?,?,?,?,?,?)',
   [id,name,owner,handler,bound?1:0,rank,JSON.stringify(saved)]);
  return {status:201,body:{id}};
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
  const blocked=new Set(['id','player_user_id','handler_user_id','collar_bound','rank','view_mode']);
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
