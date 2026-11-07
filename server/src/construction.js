import {resolveSession} from './auth.js';

const ok=body=>({status:200,body});
const fail=(status,error)=>({status,body:{error}});
const command=u=>['domina','high_command'].includes(u.account_role);
const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(s);
const id=x=>Number.isSafeInteger(Number(x))&&Number(x)>0&&Number(x)<Number.MAX_SAFE_INTEGER;
const label=(value,n)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=n;
const optional=(value,n)=>typeof value==='string'&&value.length<=n;
const count=x=>Number.isInteger(x)&&x>0&&x<=100000;
async function read(req){
 const chunks=[];let size=0;
 for await(const chunk of req){size+=chunk.length;if(size>25000)throw Object.assign(new Error('request_too_large'),{status:413});chunks.push(chunk)}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}
}
async function tx(pool,callback){
 const conn=await pool.getConnection();
 try{await conn.beginTransaction();const result=await callback(conn);if(result.status===200)await conn.commit();else await conn.rollback();return result}
 catch(e){await conn.rollback().catch(()=>{});throw e}finally{conn.release()}
}
const owns=u=>command(u)||u.account_role==='handler';
async function projectDetail(pool,projectId,user){
 const [[rows],[stages],[requirements]] = await Promise.all([
  pool.execute('SELECT p.*,e.name AS event_name FROM order_construction_projects p LEFT JOIN order_encounters e ON e.id=p.event_id WHERE p.id=?',[projectId]),
  pool.execute('SELECT id,project_id,position,name,description,status,completed_at FROM order_construction_stages WHERE project_id=? ORDER BY position,id',[projectId]),
  pool.execute('SELECT r.id,r.stage_id,r.material_id,m.name AS material_name,r.required_quantity,r.contributed_quantity FROM order_construction_requirements r JOIN fc_materials m ON m.id=r.material_id JOIN order_construction_stages s ON s.id=r.stage_id WHERE s.project_id=? ORDER BY s.position,m.name',[projectId])
 ]);
 const p=rows[0];if(!p)return null;
 const canEdit=command(user)||(user.account_role==='handler'&&p.created_by===user.id);
 if(['draft','archived'].includes(p.state)&&!canEdit)return null;
 const [history]=await pool.execute('SELECT h.id,h.stage_id,h.character_id,ch.character_name,h.quantity,h.source,h.created_at,r.material_id,m.name AS material_name FROM order_construction_contributions h JOIN characters ch ON ch.id=h.character_id JOIN order_construction_requirements r ON r.id=h.requirement_id JOIN fc_materials m ON m.id=r.material_id WHERE h.project_id=? ORDER BY h.id DESC LIMIT 60',[projectId]);
 return {id:p.id,name:p.name,description:p.description,location:p.location,event_id:p.event_id,event_name:p.event_name,state:p.state,created_by:canEdit?p.created_by:null,can_edit:canEdit,stages:stages.map(s=>({...s,requirements:requirements.filter(r=>Number(r.stage_id)===Number(s.id))})),history};
}
export async function constructionRoute(pool,req,path){
 if(!pool)return fail(503,'database_unavailable');
 const user=await resolveSession(pool,req);
 if(!user)return fail(401,'not_authenticated');
 const canCreate=owns(user);
 if(path==='/construction'&&req.method==='GET'){
  const [rows]=await pool.execute('SELECT p.id,p.name,p.description,p.location,p.event_id,e.name AS event_name,p.created_by,p.state,COUNT(DISTINCT s.id) AS stage_count FROM order_construction_projects p LEFT JOIN order_encounters e ON e.id=p.event_id LEFT JOIN order_construction_stages s ON s.project_id=p.id WHERE p.state NOT IN ("draft","archived") OR p.created_by=? OR ?=1 GROUP BY p.id ORDER BY p.updated_at DESC,p.id DESC LIMIT 200',[user.id,command(user)?1:0]);
  return ok({projects:rows.filter(p=>p.state!=='archived'||command(user)||p.created_by===user.id).map(p=>({...p,can_edit:command(user)||(user.account_role==='handler'&&p.created_by===user.id)}))});
 }
 if(path==='/construction/events'&&req.method==='GET'){
  if(!canCreate)return fail(403,'event_staff_required');
  const [events]=await pool.execute('SELECT id,name,published,status FROM order_encounters WHERE archived_at IS NULL AND (created_by=? OR ?=1) ORDER BY created_at DESC LIMIT 120',[user.id,command(user)?1:0]);
  return ok({events});
 }
 if(path==='/construction'&&req.method==='POST'){
  if(!canCreate)return fail(403,'event_staff_required');
  const b=await read(req);
  if(!label(b?.name,150)||!optional(b.description,12000)||!optional(b.location,160)||
   (b.event_id!==null&&b.event_id!==undefined&&!uuid(b.event_id))||
   !Array.isArray(b.stages)||b.stages.length<1||b.stages.length>20||
   b.stages.some(s=>!label(s.name,130)||!optional(s.description,1400)||!Array.isArray(s.requirements)||s.requirements.length<1||s.requirements.length>20||
    s.requirements.some(r=>typeof r.material_id!=='string'||!count(r.quantity))||
    new Set(s.requirements.map(r=>r.material_id)).size!==s.requirements.length))return fail(400,'invalid_construction_plan');
  return tx(pool,async conn=>{
   if(b.event_id){
    const [events]=await conn.execute('SELECT created_by FROM order_encounters WHERE id=? AND archived_at IS NULL',[b.event_id]);
    if(!events.length||(!command(user)&&events[0].created_by!==user.id))return fail(403,'event_director_required');
   }
   const unique=[...new Set(b.stages.flatMap(s=>s.requirements.map(r=>r.material_id)))];
   const [valid]=await conn.query('SELECT id FROM fc_materials WHERE id IN ('+unique.map(()=>'?').join(',')+')',unique);
   if(valid.length!==unique.length)return fail(400,'unknown_material');
   const [made]=await conn.execute('INSERT INTO order_construction_projects(name,description,location,event_id,created_by) VALUES(?,?,?,?,?)',
    [b.name.trim(),b.description.trim(),b.location.trim(),b.event_id||null,user.id]);
   for(let i=0;i<b.stages.length;i++){
    const stage=b.stages[i];
    const [entry]=await conn.execute('INSERT INTO order_construction_stages(project_id,position,name,description,status) VALUES(?,?,?,?,"locked")',
     [made.insertId,i+1,stage.name.trim(),stage.description.trim()]);
    for(const r of stage.requirements)await conn.execute('INSERT INTO order_construction_requirements(stage_id,material_id,required_quantity) VALUES(?,?,?)',
     [entry.insertId,r.material_id,r.quantity]);
   }
   return ok({id:made.insertId,status:'draft'});
  });
 }
 const match=/^\/construction\/(\d+)(?:\/(activate|pause|resume|archive|stages\/(\d+)\/complete|contribute))?$/.exec(path);
 if(!match||!id(match[1]))return fail(404,'not_found');
 const projectId=Number(match[1]),action=match[2]||'';
 if(req.method==='GET'&&!action){
  const project=await projectDetail(pool,projectId,user);
  return project?ok({project}):fail(404,'project_not_found');
 }
 if(action==='contribute'&&req.method==='POST'){
  const b=await read(req);
  if(!id(b?.requirement_id)||!uuid(b?.character_id)||!count(b?.quantity)||
   !['reserved','shared'].includes(b.source))return fail(400,'invalid_contribution');
  return tx(pool,async conn=>{
   const [projects]=await conn.execute('SELECT id,state FROM order_construction_projects WHERE id=? FOR UPDATE',[projectId]);
   if(!projects.length)return fail(404,'project_not_found');
   if(projects[0].state!=='open')return fail(409,'project_not_accepting_contributions');
   const [characters]=await conn.execute('SELECT player_account_id FROM characters WHERE id=?',[b.character_id]);
   if(!characters.length||characters[0].player_account_id!==user.id)return fail(403,'character_owner_required');
   const [requirements]=await conn.execute('SELECT r.id,r.stage_id,r.material_id,r.required_quantity,r.contributed_quantity,s.status FROM order_construction_requirements r JOIN order_construction_stages s ON s.id=r.stage_id WHERE r.id=? AND s.project_id=? FOR UPDATE',[Number(b.requirement_id),projectId]);
   const r=requirements[0];
   if(!r||r.status!=='active')return fail(409,'stage_not_active');
   if(Number(r.contributed_quantity)+b.quantity>Number(r.required_quantity))return fail(409,'requirement_would_be_overfilled');
   if(b.source==='reserved'){
    const [stock]=await conn.execute('SELECT quantity FROM character_reserved_materials WHERE character_id=? AND material_id=? FOR UPDATE',[b.character_id,r.material_id]);
    if(!stock.length||Number(stock[0].quantity)<b.quantity)return fail(409,'reserved_goods_insufficient');
    const remaining=Number(stock[0].quantity)-b.quantity;
    await conn.execute('UPDATE character_reserved_materials SET quantity=? WHERE character_id=? AND material_id=?',[remaining,b.character_id,r.material_id]);
    await conn.execute('INSERT INTO character_reserved_material_ledger(character_id,material_id,action,quantity,balance_after) VALUES(?,?,"project",?,?)',
     [b.character_id,r.material_id,b.quantity,remaining]);
   }else{
    await conn.execute('INSERT IGNORE INTO fc_material_stock(material_id,quantity) VALUES(?,0)',[r.material_id]);
    const [[stock]]=await conn.execute('SELECT quantity FROM fc_material_stock WHERE material_id=? FOR UPDATE',[r.material_id]);
    if(Number(stock.quantity)<b.quantity)return fail(409,'shared_goods_insufficient');
    const remaining=Number(stock.quantity)-b.quantity;
    await conn.execute('UPDATE fc_material_stock SET quantity=? WHERE material_id=?',[remaining,r.material_id]);
    await conn.execute('INSERT INTO fc_material_ledger(material_id,delta,balance_after,activity,account_id,character_id,note) VALUES(?,?,?,?,?,?,?)',
     [r.material_id,-b.quantity,remaining,'project',user.id,b.character_id,'Construction project #'+projectId]);
   }
   await conn.execute('UPDATE order_construction_requirements SET contributed_quantity=contributed_quantity+? WHERE id=?',[b.quantity,r.id]);
   const [posted]=await conn.execute('INSERT INTO order_construction_contributions(project_id,stage_id,requirement_id,character_id,account_id,quantity,source) VALUES(?,?,?,?,?,?,?)',
    [projectId,r.stage_id,r.id,b.character_id,user.id,b.quantity,b.source]);
   return ok({status:'contributed',id:posted.insertId,quantity:b.quantity});
  });
 }
 if(!canCreate)return fail(403,'event_staff_required');
 return tx(pool,async conn=>{
  const [projects]=await conn.execute('SELECT id,state,created_by FROM order_construction_projects WHERE id=? FOR UPDATE',[projectId]);
  const p=projects[0];if(!p)return fail(404,'project_not_found');
  if(!command(user)&&p.created_by!==user.id)return fail(403,'project_director_required');
  if(action==='activate'){
   if(p.state!=='draft')return fail(409,'project_not_draft');
   const [stage]=await conn.execute('SELECT id FROM order_construction_stages WHERE project_id=? ORDER BY position LIMIT 1',[projectId]);
   if(!stage.length)return fail(409,'project_needs_stages');
   await conn.execute('UPDATE order_construction_stages SET status="active" WHERE id=?',[stage[0].id]);
   await conn.execute('UPDATE order_construction_projects SET state="open" WHERE id=?',[projectId]);
   return ok({state:'open'});
  }
  if(action==='pause'||action==='resume'){
   if(action==='pause'&&p.state!=='open'||action==='resume'&&p.state!=='paused')return fail(409,'invalid_project_state');
   await conn.execute('UPDATE order_construction_projects SET state=? WHERE id=?',[action==='pause'?'paused':'open',projectId]);
   return ok({state:action==='pause'?'paused':'open'});
  }
  if(action==='archive'){
   if(p.state==='archived')return fail(409,'already_archived');
   await conn.execute('UPDATE order_construction_projects SET state="archived" WHERE id=?',[projectId]);
   return ok({state:'archived'});
  }
  const stageId=Number(match[3]);
  if(action.startsWith('stages/')&&id(stageId)){
   if(p.state!=='open')return fail(409,'project_not_active');
   const [stageRows]=await conn.execute('SELECT id,position,status FROM order_construction_stages WHERE project_id=? AND id=? FOR UPDATE',[projectId,stageId]);
   if(!stageRows.length||stageRows[0].status!=='active')return fail(409,'stage_not_active');
   const [[missing]]=await conn.execute('SELECT COUNT(*) AS remaining FROM order_construction_requirements WHERE stage_id=? AND contributed_quantity<required_quantity',[stageId]);
   if(Number(missing.remaining)>0)return fail(409,'stage_materials_incomplete');
   await conn.execute('UPDATE order_construction_stages SET status="complete",completed_at=UTC_TIMESTAMP() WHERE id=?',[stageId]);
   const [next]=await conn.execute('SELECT id FROM order_construction_stages WHERE project_id=? AND position>? ORDER BY position LIMIT 1',[projectId,stageRows[0].position]);
   if(next.length)await conn.execute('UPDATE order_construction_stages SET status="active" WHERE id=?',[next[0].id]);
   else await conn.execute('UPDATE order_construction_projects SET state="completed" WHERE id=?',[projectId]);
   return ok({state:next.length?'next_stage':'completed'});
  }
  return fail(404,'not_found');
 });
}
