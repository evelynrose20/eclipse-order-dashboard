import {resolveSession} from './auth.js';

const themes=new Set(['violence','horror','captivity','mind_control','humiliation','body_horror','romance','sexual_themes','character_death']);
const keys=new Set(['welcome','house_rules','scene_guidelines']);
const result=(status,body)=>({status,body});
const fail=(status,error)=>result(status,{error});
const json=value=>typeof value==='string'?JSON.parse(value):value;
async function read(req){
 const chunks=[];let len=0;
 for await(const x of req){len+=x.length;if(len>16000)throw Object.assign(new Error('request_too_large'),{status:413});chunks.push(x);}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw Object.assign(new Error('invalid_json'),{status:400})}
}
export async function profileRoute(pool,req,path){
 if(!pool)return fail(503,'database_unavailable');
 const user=await resolveSession(pool,req);
 if(!user)return fail(401,'not_authenticated');
 const isCommand=['domina','high_command'].includes(user.account_role);
 if(path==='/profile/preferences'){
  if(req.method==='GET'){
   const [rows]=await pool.execute('SELECT adult_declaration,content_preferences FROM order_profile_preferences WHERE user_id=?',[user.id]);
   return result(200,rows.length?{adult_declaration:Boolean(rows[0].adult_declaration),content_preferences:json(rows[0].content_preferences)}:{adult_declaration:false,content_preferences:{}});
  }
  if(req.method==='PUT'){
   const b=await read(req);
   if(typeof b?.adult_declaration!=='boolean'||!b?.content_preferences||typeof b.content_preferences!=='object'||Array.isArray(b.content_preferences))return fail(400,'invalid_preferences');
   if(Object.keys(b.content_preferences).some(k=>!themes.has(k)||typeof b.content_preferences[k]!=='boolean'))return fail(400,'invalid_preference_category');
   await pool.execute('INSERT INTO order_profile_preferences(user_id,adult_declaration,content_preferences) VALUES(?,?,?) ON DUPLICATE KEY UPDATE adult_declaration=VALUES(adult_declaration),content_preferences=VALUES(content_preferences)',[user.id,b.adult_declaration?1:0,JSON.stringify(b.content_preferences)]);
   return result(200,{status:'saved'});
  }
 }
 if(path==='/profile/rp'){
  if(req.method==='GET'){
   const [rows]=await pool.execute('SELECT display_name,share_content,share_kinks,kink_entries FROM order_member_rp_profiles WHERE user_id=?',[user.id]);
   return result(200,rows.length?{display_name:rows[0].display_name,share_content:Boolean(rows[0].share_content),share_kinks:Boolean(rows[0].share_kinks),kink_entries:json(rows[0].kink_entries)}:{display_name:'',share_content:false,share_kinks:false,kink_entries:[]});
  }
  if(req.method==='PUT'){
   const b=await read(req);
   const name=typeof b?.display_name==='string'?b.display_name.trim():'';
   if(name.length>60||typeof b?.share_content!=='boolean'||typeof b?.share_kinks!=='boolean'||!Array.isArray(b?.kink_entries)||b.kink_entries.length>60)return fail(400,'invalid_rp_profile');
   const valid=['favorite','yes','maybe','no'];
   if(b.kink_entries.some(e=>typeof e?.label!=='string'||e.label.trim().length<1||e.label.length>80||!valid.includes(e.rating))||JSON.stringify(b.kink_entries).length>10000)return fail(400,'invalid_profile_entries');
   if(b.share_content||b.share_kinks){
    const [adult]=await pool.execute('SELECT adult_declaration FROM order_profile_preferences WHERE user_id=?',[user.id]);
    if(!adult[0]?.adult_declaration)return fail(403,'adult_declaration_required_before_sharing');
   }
   await pool.execute('INSERT INTO order_member_rp_profiles(user_id,display_name,share_content,share_kinks,kink_entries) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),share_content=VALUES(share_content),share_kinks=VALUES(share_kinks),kink_entries=VALUES(kink_entries)',[user.id,name,b.share_content?1:0,b.share_kinks?1:0,JSON.stringify(b.kink_entries)]);
   return result(200,{status:'saved'});
  }
 }
 if(path==='/profile/directory'&&req.method==='GET'){
  const [rows]=await pool.query(
   'SELECT p.display_name,p.share_content,p.share_kinks,p.kink_entries,f.content_preferences FROM order_member_rp_profiles p JOIN accounts a ON a.id=p.user_id JOIN order_profile_preferences f ON f.user_id=p.user_id WHERE a.is_active=1 AND a.approval_status="approved" AND f.adult_declaration=1 AND (p.share_content=1 OR p.share_kinks=1) ORDER BY p.display_name'
  );
  return result(200,rows.map(r=>({
   display_name:r.display_name,shares_content:Boolean(r.share_content),shares_kinks:Boolean(r.share_kinks),
   content_preferences:r.share_content?json(r.content_preferences)||{}:null,
   kink_entries:r.share_kinks?json(r.kink_entries):null
  })));
 }
 if(path==='/settings'){
  if(req.method==='GET'){
   const [rows]=await pool.query('SELECT setting_key,content FROM order_settings');
   return result(200,Object.fromEntries(rows.filter(r=>keys.has(r.setting_key)).map(r=>[r.setting_key,r.content])));
  }
  if(req.method==='PUT'){
   if(!isCommand)return fail(403,'command_required');
   const b=await read(req);
   if(!keys.has(b?.key)||typeof b?.content!=='string'||b.content.length>16000)return fail(400,'invalid_setting');
   await pool.execute('INSERT INTO order_settings(setting_key,content,updated_by) VALUES(?,?,?) ON DUPLICATE KEY UPDATE content=VALUES(content),updated_by=VALUES(updated_by)',[b.key,b.content,user.id]);
   return result(200,{status:'saved'});
  }
 }
 return fail(404,'not_found');
}
