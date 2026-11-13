import {resolveSession} from './auth.js';
import {validTraits,LINEAGE_ROLES,LINEAGE_STAGES,OFFSPRING_STAGES} from '../../src/lineageTraits.js';

const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const staff=actor=>['domina','high_command','handler'].includes(actor.account_role);
const name=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=max;
const optional=(v,max)=>typeof v==='string'&&v.length<=max;
const integer=v=>Number.isSafeInteger(Number(v))&&Number(v)>0;
const json=v=>typeof v==='string'?JSON.parse(v):v;
const yes=v=>v===true||v===1;
function lineageFields(body){
 const b=body||{};
 const lineage_type=b.lineage_type||'standard',subject_role=b.subject_role||'carrier',expression_stage=b.expression_stage||'none';
 const offspring_stage=b.offspring_stage||'not_recorded',traits=b.traits||[],offspring_traits=b.offspring_traits||[];
 const participant_note=b.participant_note||'',parenthood_note=b.parenthood_note||'';
 const void_revealed=b.void_revealed===true;
 if(!['standard','voidsent'].includes(lineage_type)||!LINEAGE_ROLES.includes(subject_role)||!LINEAGE_STAGES.includes(expression_stage)
 ||!OFFSPRING_STAGES.includes(offspring_stage)||!validTraits(traits,subject_role)||!validTraits(offspring_traits,'descendant')
 ||!optional(participant_note,1200)||!optional(parenthood_note,1200)|| (b.void_revealed!==undefined&&typeof b.void_revealed!=='boolean'))
 return null;
 return {lineage_type,subject_role,expression_stage,offspring_stage,traits,offspring_traits,participant_note,parenthood_note,void_revealed};
}
async function read(req){
 const parts=[];let total=0;
 for await(const p of req){total+=p.length;if(total>12000)return null;parts.push(p)}
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{return null}
}
async function tx(pool,fn){
 const db=await pool.getConnection();
 try{await db.beginTransaction();const result=await fn(db);if(result.status===200)await db.commit();else await db.rollback();return result}
 catch(error){await db.rollback().catch(()=>{});throw error}finally{db.release()}
}
export async function lineageRoute(pool,req,path){
 const actor=await resolveSession(pool,req);
 if(!actor)return fail(401,'not_authenticated');
 const consent=/^\/characters\/([0-9a-f-]{36})\/lineage-consent$/.exec(path);
 if(consent&&uuid.test(consent[1])){
  const [[character]]=await pool.execute('SELECT id,player_account_id FROM characters WHERE id=?',[consent[1]]);
  if(!character)return fail(404,'character_not_found');
  if(character.player_account_id!==actor.id)return fail(403,'character_owner_required');
  if(req.method==='GET'){
   const [[permission]]=await pool.execute('SELECT allow_research FROM character_lineage_permissions WHERE character_id=?',[consent[1]]);
   return ok({allow_research:Boolean(permission?.allow_research)});
  }
  if(req.method!=='PUT')return fail(405,'method_not_allowed');
  const b=await read(req);
  if(typeof b?.allow_research!=='boolean')return fail(400,'invalid_research_permission');
  return tx(pool,async db=>{
   await db.execute('INSERT INTO character_lineage_permissions(character_id,allow_research) VALUES(?,?) ON DUPLICATE KEY UPDATE allow_research=VALUES(allow_research)',[consent[1],Number(b.allow_research)]);
   if(!b.allow_research)await db.execute('UPDATE order_lineage_cases SET character_id=NULL,pregnancy_linked=0 WHERE character_id=?',[consent[1]]);
   return ok({allow_research:b.allow_research});
  });
 }
 if(!path.startsWith('/thralls/lineage'))return fail(404,'not_found');
 if(path==='/thralls/lineage/my'&&req.method==='GET'){
  // Participants see only their own expressly authorized research cases.
  // Staff method/observations and other members' case records are never returned.
  const [rows]=await pool.execute(`SELECT lc.id,lc.project_id,lc.designation,lc.result,lc.lineage_markers,lc.lineage_type,
    lc.subject_role,lc.expression_stage,lc.traits,lc.offspring_stage,lc.offspring_traits,lc.participant_note,
    lc.parenthood_note,lc.void_revealed,lc.pregnancy_linked,
    CASE WHEN p.lineage_case_id=lc.id THEN 'lineage' WHEN lc.pregnancy_linked=1 THEN 'linked_existing' ELSE 'none' END AS conception_origin,
    c.id AS character_id,c.character_name,
    CASE WHEN lc.pregnancy_linked=1 THEN p.pregnancy_status ELSE NULL END AS pregnancy_status,
    CASE WHEN lc.pregnancy_linked=1 THEN p.pregnancy_anchor ELSE NULL END AS pregnancy_anchor,
    CASE WHEN lc.pregnancy_linked=1 THEN p.pregnancy_start_day ELSE NULL END AS pregnancy_start_day,
    CASE WHEN lc.pregnancy_linked=1 THEN p.pregnancy_total_days ELSE NULL END AS pregnancy_total_days
    FROM order_lineage_cases lc
    JOIN characters c ON c.id=lc.character_id AND c.player_account_id=?
    JOIN character_lineage_permissions perm ON perm.character_id=c.id AND perm.allow_research=1
    LEFT JOIN character_reproductive_profiles p ON p.character_id=c.id
    ORDER BY lc.id DESC LIMIT 150`,[actor.id]);
  return ok({cases:rows.map(row=>({
   id:row.id,project_id:row.project_id,character_id:row.character_id,character_name:row.character_name,
   may_conceive:row.lineage_type==='voidsent'&&row.subject_role==='carrier',
   designation:row.designation,result:row.result,lineage_markers:yes(row.void_revealed)?row.lineage_markers:'',
   lineage_type:yes(row.void_revealed)?row.lineage_type:'undisclosed',
   subject_role:row.subject_role,expression_stage:row.expression_stage,
   traits:yes(row.void_revealed)?(json(row.traits)||[]):(json(row.traits)||[]).filter(id=>['skin_tint','hair_shift','eye_glimmer'].includes(id)),offspring_stage:row.offspring_stage,
   offspring_traits:yes(row.void_revealed)?(json(row.offspring_traits)||[]):[],
   participant_note:row.participant_note,parenthood_note:row.parenthood_note,
   pregnancy_linked:yes(row.pregnancy_linked),conception_origin:row.conception_origin,pregnancy_status:row.pregnancy_status,
   pregnancy_anchor:row.pregnancy_anchor,pregnancy_start_day:row.pregnancy_start_day,
   pregnancy_total_days:row.pregnancy_total_days
  }))});
 }
 if(!staff(actor))return fail(403,'staff_required');
 if(path==='/thralls/lineage'&&req.method==='GET'){
  const [projects]=await pool.execute('SELECT id,title,objective,status,created_at FROM order_lineage_projects ORDER BY id DESC LIMIT 100');
  const [cases]=await pool.execute(`SELECT lc.id,lc.project_id,lc.character_id,lc.designation,lc.method,lc.observations,lc.lineage_markers,lc.result,
    lc.pregnancy_linked,lc.created_at,lc.lineage_type,lc.subject_role,lc.expression_stage,lc.traits,
    lc.offspring_stage,lc.offspring_traits,lc.participant_note,lc.parenthood_note,lc.void_revealed,
    CASE WHEN p.lineage_case_id=lc.id THEN 'lineage' WHEN lc.pregnancy_linked=1 THEN 'linked_existing' ELSE 'none' END AS conception_origin,
    c.character_name AS character_name,
    IF(lc.pregnancy_linked=1 AND p.pregnancy_status='active',p.pregnancy_status,NULL) AS pregnancy_status,
    CASE WHEN lc.pregnancy_linked=1 THEN p.pregnancy_anchor ELSE NULL END AS pregnancy_anchor,
    CASE WHEN lc.pregnancy_linked=1 THEN p.pregnancy_start_day ELSE NULL END AS pregnancy_start_day,
    CASE WHEN lc.pregnancy_linked=1 THEN p.pregnancy_total_days ELSE NULL END AS pregnancy_total_days
    FROM order_lineage_cases lc LEFT JOIN characters c ON c.id=lc.character_id
    LEFT JOIN character_reproductive_profiles p ON p.character_id=lc.character_id
    ORDER BY lc.id DESC LIMIT 250`);
  const [eligible]=await pool.execute(`SELECT c.id,c.character_name FROM characters c
    JOIN character_lineage_permissions perm ON perm.character_id=c.id AND perm.allow_research=1
    ORDER BY c.character_name LIMIT 250`);
  return ok({projects,cases:cases.map(c=>({...c,traits:json(c.traits)||[],offspring_traits:json(c.offspring_traits)||[],
   void_revealed:yes(c.void_revealed)})),eligible});
 }
 if(path==='/thralls/lineage/projects'&&req.method==='POST'){
  const b=await read(req);
  if(!name(b?.title,130)||!optional(b?.objective,900))return fail(400,'invalid_project');
  const [r]=await pool.execute('INSERT INTO order_lineage_projects(title,objective,created_by) VALUES(?,?,?)',[b.title.trim(),b.objective,actor.id]);
  return ok({id:r.insertId});
 }
 const project=/^\/thralls\/lineage\/projects\/(\d+)$/.exec(path);
 if(project&&req.method==='PUT'){
  const b=await read(req);
  if(!name(b?.title,130)||!optional(b?.objective,900)||!['planned','active','paused','completed','archived'].includes(b?.status))return fail(400,'invalid_project');
  const [r]=await pool.execute('UPDATE order_lineage_projects SET title=?,objective=?,status=? WHERE id=?',[b.title.trim(),b.objective,b.status,Number(project[1])]);
  return r.affectedRows?ok({saved:true}):fail(404,'project_not_found');
 }
 const caseRoute=path==='/thralls/lineage/cases'&&req.method==='POST';
 const edit=/^\/thralls\/lineage\/cases\/(\d+)$/.exec(path);
 if(caseRoute||(edit&&req.method==='PUT')){
  const b=await read(req);
  const fields=lineageFields(b);
  if(!fields||!integer(b?.project_id)||!name(b?.designation,130)||!optional(b?.method,900)||
   !optional(b?.observations,8000)||!optional(b?.lineage_markers,600)||
   !['ongoing','inconclusive','promising','unsuccessful','confirmed'].includes(b?.result)||
   !(b?.character_id===null||b?.character_id===''||uuid.test(b?.character_id))||typeof b?.pregnancy_linked!=='boolean')
   return fail(400,'invalid_research_case');
  return tx(pool,async db=>{
   const [[projectRow]]=await db.execute('SELECT id FROM order_lineage_projects WHERE id=?',[Number(b.project_id)]);
   if(!projectRow)return fail(404,'project_not_found');
   let id=b.character_id||null;
   if(id){
    const [[permission]]=await db.execute('SELECT allow_research FROM character_lineage_permissions WHERE character_id=?',[id]);
    if(!permission?.allow_research)return fail(409,'character_research_not_authorized');
    if(b.pregnancy_linked){
     const [[pregnancy]]=await db.execute('SELECT pregnancy_status FROM character_reproductive_profiles WHERE character_id=?',[id]);
     if(pregnancy?.pregnancy_status!=='active'){
      // Historical linked cases must remain editable after pregnancy has concluded.
      const [[linked]]=edit?await db.execute('SELECT pregnancy_linked,character_id FROM order_lineage_cases WHERE id=?',[Number(edit[1])]):[[]];
      if(!linked?.pregnancy_linked||linked.character_id!==id)return fail(409,'active_pregnancy_required');
     }
    }
   }else if(b.pregnancy_linked)return fail(400,'pregnancy_requires_character');
   const args=[Number(b.project_id),id,b.designation.trim(),b.method,b.observations,b.lineage_markers,b.result,Number(b.pregnancy_linked),actor.id,
    fields.lineage_type,fields.subject_role,fields.expression_stage,JSON.stringify(fields.traits),fields.offspring_stage,
    JSON.stringify(fields.offspring_traits),fields.participant_note,fields.parenthood_note,Number(fields.void_revealed)];
   if(caseRoute){
    const [r]=await db.execute(`INSERT INTO order_lineage_cases
      (project_id,character_id,designation,method,observations,lineage_markers,result,pregnancy_linked,updated_by,
       lineage_type,subject_role,expression_stage,traits,offspring_stage,offspring_traits,participant_note,parenthood_note,void_revealed)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,args);
    return ok({id:r.insertId});
   }
   const [r]=await db.execute(`UPDATE order_lineage_cases SET project_id=?,character_id=?,designation=?,method=?,observations=?,
     lineage_markers=?,result=?,pregnancy_linked=?,updated_by=?,lineage_type=?,subject_role=?,expression_stage=?,
     traits=?,offspring_stage=?,offspring_traits=?,participant_note=?,parenthood_note=?,void_revealed=? WHERE id=?`,[...args,Number(edit[1])]);
   return r.affectedRows?ok({saved:true}):fail(404,'case_not_found');
  });
 }
 return fail(404,'lineage_action_not_found');
}
