// World map zones belong to a region. Every region has one permanent overview zone.
const ok=body=>({status:200,body}),fail=(status,error)=>({status,body:{error}});
const validUrl=url=>!url||(()=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}})();
const name=v=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=140;
const description=v=>typeof v==='string'&&v.length<=8000;
const id=v=>Number.isSafeInteger(v)&&v>0;
const states=['peaceful','secure','contested','occupied','liberated','rebuilding','abandoned','destroyed'];
const faction=v=>v==null||v===''||typeof v==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v)&&v.length<=45;
const valid=b=>b&&id(b.region_id)&&name(b.name)&&description(b.description)&&typeof b.map_background_url==='string'&&b.map_background_url.length<=1500&&validUrl(b.map_background_url)&&states.includes(b.strategic_state)&&['governing_faction_id','controlling_faction_id','supporting_faction_id'].every(k=>faction(b[k]));
const data=b=>[b.name.trim(),b.description,b.map_background_url,b.strategic_state,b.governing_faction_id||null,b.controlling_faction_id||null,b.supporting_faction_id||null];
const fields='name=?,description=?,map_background_url=?,strategic_state=?,governing_faction_id=?,controlling_faction_id=?,supporting_faction_id=?';
async function body(req){let len=0,chunks=[];for await(const chunk of req){len+=chunk.length;if(len>16000)return null;chunks.push(chunk)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return null}}
async function tx(pool,fn){const db=await pool.getConnection();try{await db.beginTransaction();const result=await fn(db);if(result.status===200)await db.commit();else await db.rollback();return result}catch(e){await db.rollback().catch(()=>{});throw e}finally{db.release()}}
async function audit(db,actor,action,target){await db.execute('INSERT INTO world_administration_audit(actor_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',[actor.id,action,'zone',target,'Territorial zone updated'])}
export async function defaultZone(db,regionId){
 const [[zone]]=await db.execute("SELECT id FROM world_zones WHERE region_id=? AND slug='overview'",[regionId]);
 return zone?.id||null;
}
export async function zoneFor(db,regionId,zoneId){
 const chosen=zoneId==null?await defaultZone(db,regionId):zoneId;
 if(!id(Number(chosen)))return null;
 const [[zone]]=await db.execute('SELECT id FROM world_zones WHERE id=? AND region_id=?',[chosen,regionId]);
 return zone?.id||null;
}
export async function ensureOverviewZone(db,regionId,actorId){
 const [[region]]=await db.execute('SELECT id,map_background_url,created_by FROM world_regions WHERE id=?',[regionId]);
 if(!region)return null;
 await db.execute("INSERT INTO world_zones(region_id,slug,name,description,map_background_url,is_default,created_by) VALUES(?,'overview','Regional Overview','Original regional territory map',?,1,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)",[regionId,region.map_background_url,region.created_by||actorId]);
 const [[zone]]=await db.execute('SELECT id FROM world_zones WHERE id=LAST_INSERT_ID()');
 return zone.id;
}
export async function handleZones(pool,req,path,actor){
 const match=/^\/world-admin\/zones(?:\/(\d+))?$/.exec(path);
 if(!match)return fail(404,'zone_route_not_found');
 const zoneId=match[1]?Number(match[1]):null;
 if(req.method==='POST'&&!zoneId){
  const b=await body(req);if(!valid(b))return fail(400,'invalid_zone');
  return tx(pool,async db=>{
   const [regions]=await db.execute('SELECT id FROM world_regions WHERE id=?',[b.region_id]);if(!regions.length)return fail(404,'region_not_found');
   const refs=[b.governing_faction_id,b.controlling_faction_id,b.supporting_faction_id].filter(Boolean);
   if(refs.length){const [existing]=await db.query('SELECT id FROM order_factions WHERE id IN ('+refs.map(()=>'?').join(',')+')',refs);if(existing.length!==new Set(refs).size)return fail(400,'invalid_faction_reference')}
   const slug='zone-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
   const [result]=await db.execute('INSERT INTO world_zones(region_id,slug,name,description,map_background_url,strategic_state,governing_faction_id,controlling_faction_id,supporting_faction_id,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)',[b.region_id,slug,...data(b),actor.id]);
   await audit(db,actor,'zone_create',result.insertId);return ok({id:result.insertId});
  });
 }
 if(req.method==='PUT'&&zoneId){
  const b=await body(req);if(!valid(b))return fail(400,'invalid_zone');
  return tx(pool,async db=>{
   const [refs]=await db.execute('SELECT region_id FROM world_zones WHERE id=?',[zoneId]);if(!refs.length)return fail(404,'zone_not_found');
   if(Number(refs[0].region_id)!==b.region_id)return fail(409,'zone_cannot_change_region');
   const ids=[...new Set([b.governing_faction_id,b.controlling_faction_id,b.supporting_faction_id].filter(Boolean))];
   if(ids.length){const [existing]=await db.query('SELECT id FROM order_factions WHERE id IN ('+ids.map(()=>'?').join(',')+')',ids);if(existing.length!==ids.length)return fail(400,'invalid_faction_reference')}
   await db.execute('UPDATE world_zones SET '+fields+' WHERE id=?',[...data(b),zoneId]);await audit(db,actor,'zone_update',zoneId);return ok({saved:true});
  });
 }
 if(req.method==='DELETE'&&zoneId){
  return tx(pool,async db=>{
   const [[zone]]=await db.execute('SELECT id,is_default FROM world_zones WHERE id=? FOR UPDATE',[zoneId]);
   if(!zone)return fail(404,'zone_not_found');
   if(zone.is_default)return fail(409,'overview_zone_cannot_be_deleted');
   for(const table of ['world_settlements','world_map_routes','world_route_nodes','world_route_segments','world_map_mountain_ranges']){
    const [[count]]=await db.execute('SELECT COUNT(*) AS total FROM '+table+' WHERE zone_id=?',[zoneId]);
    if(Number(count.total))return fail(409,'zone_has_map_content');
   }
   await db.execute('DELETE FROM world_zones WHERE id=?',[zoneId]);await audit(db,actor,'zone_delete',zoneId);return ok({saved:true});
  });
 }
 return fail(405,'method_not_allowed');
}
