import {resolveSession} from './auth.js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const fail=(status,error)=>({status,body:{error}});
const ok=body=>({status:200,body});
const ROSTER_KEY='venue_public_roster';
const DEFAULT_ROSTER=new URL('../../public/venue-roster.json',import.meta.url);
const UPLOAD_DIRECTORY=resolve(process.env.VENUE_UPLOAD_DIR||fileURLToPath(new URL('../venue-uploads',import.meta.url)));
const IMAGE_TYPES={jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
const IMAGE_EXTENSIONS={jpeg:'jpg',png:'png',webp:'webp'};
const publicUrl=name=>'/venue/images/'+name;
const photoUrlOk=url=>typeof url==='string'&&url.length<=500&&(url===''||(/^https:\/\/[^\s<>"']+$/i.test(url)&&!url.includes('@'))||/^\/venue\/images\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(url));
async function readInput(req,limit=65536){
 const buffers=[];let total=0;
 for await(const chunk of req){total+=chunk.length;if(total>limit)return null;buffers.push(chunk);}
 try{return JSON.parse(Buffer.concat(buffers).toString('utf8'))}catch{return null}
}
function validateEntry(entry){
 return entry&&typeof entry.id==='string'&&/^[a-z0-9][a-z0-9-]{0,79}$/.test(entry.id)
 &&typeof entry.name==='string'&&entry.name.trim().length>0&&entry.name.length<=120
 &&typeof entry.title==='string'&&entry.title.length<=120
 &&typeof entry.description==='string'&&entry.description.length<=1800
 &&typeof entry.vacancy==='boolean'
 &&typeof entry.image==='string'&&entry.image.length<=500
 &&photoUrlOk(entry.image);
}
export function validateRoster(value){
 if(!value||!Array.isArray(value.staff)||!Array.isArray(value.thralls))return false;
 if(value.staff.length>80||value.thralls.length>80)return false;
 const entries=[...value.staff,...value.thralls];
 return entries.every(validateEntry)&&new Set(entries.map(x=>x.id)).size===entries.length;
}
function publicRoster(data){
 return {staff:data.staff,thralls:data.thralls};
}
async function seedRoster(){
 const source=JSON.parse(await readFile(DEFAULT_ROSTER,'utf8'));
 // The initial public Carrd entries had optional vacancy flags.
 return {staff:source.staff.map(e=>({...e,vacancy:!!e.vacancy})),thralls:source.thralls.map(e=>({...e,vacancy:!!e.vacancy}))};
}
async function readRoster(pool){
 const [rows]=await pool.execute('SELECT content FROM order_settings WHERE setting_key=?',[ROSTER_KEY]);
 if(!rows.length)return {...await seedRoster(),version:0};
 try{
  const data=JSON.parse(rows[0].content);
  if(!validateRoster(data))throw new Error('invalid');
  return {...publicRoster(data),version:Number(data.version)||0};
 }catch{return {...await seedRoster(),version:0}}
}
function detectType(bytes){
 if(bytes.length>3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'jpeg';
 if(bytes.length>8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png';
 if(bytes.length>12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'webp';
 return null;
}
export async function venueRoute(pool,req,path){
 if(path.startsWith('/venue/images/')&&req.method==='GET'){
  const name=path.slice('/venue/images/'.length);
  if(!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(name))return fail(404,'not_found');
  try{
   const data=await readFile(join(UPLOAD_DIRECTORY,name));
   const ext=name.split('.').pop();
   return {status:200,rawBody:data,contentType:ext==='jpg'?'image/jpeg':ext==='png'?'image/png':'image/webp'};
  }catch{return fail(404,'not_found')}
 }
 if(!pool)return fail(503,'database_unavailable');
 if(path==='/venue/public'&&req.method==='GET'){
  return ok(publicRoster(await readRoster(pool)));
 }
 const actor=await resolveSession(pool,req);
 if(!actor)return fail(401,'not_authenticated');
 if(!['domina','high_command'].includes(actor.account_role))return fail(403,'command_required');
 if(path==='/venue/manage'&&req.method==='GET')return ok(await readRoster(pool));
 if(path==='/venue/manage'&&req.method==='PUT'){
  const input=await readInput(req);
  if(!input||!validateRoster(input)||!Number.isInteger(input.version)||input.version<0)return fail(400,'invalid_venue_roster');
  const payload={...publicRoster(input),version:input.version+1};
  const conn=await pool.getConnection();
  try{
   await conn.beginTransaction();
   await conn.execute('INSERT IGNORE INTO order_settings(setting_key,content,updated_by) VALUES(?,?,?)',[ROSTER_KEY,JSON.stringify({...await seedRoster(),version:0}),actor.id]);
   const [current]=await conn.execute('SELECT content FROM order_settings WHERE setting_key=? FOR UPDATE',[ROSTER_KEY]);
   let oldVersion=0;
   try{oldVersion=Number(JSON.parse(current[0].content).version)||0}catch{}
   if(oldVersion!==input.version){await conn.rollback();return fail(409,'venue_roster_changed')}
   await conn.execute('UPDATE order_settings SET content=?,updated_by=? WHERE setting_key=?',[JSON.stringify(payload),actor.id,ROSTER_KEY]);
   await conn.execute('INSERT INTO audit_log(actor_account_id,action,entity_type,entity_id,details_json) VALUES(?,?,?,?,?)',[actor.id,'venue_roster_updated','order_settings',ROSTER_KEY,JSON.stringify({version:payload.version,staff:payload.staff.length,thralls:payload.thralls.length})]);
   await conn.commit();
   return ok(payload);
  }catch(error){await conn.rollback();throw error}finally{conn.release()}
 }
 if(path==='/venue/upload'&&req.method==='POST'){
  const body=await readInput(req,2900000);
  if(!body||typeof body.data!=='string'||body.data.length>2850000||!/^[a-zA-Z0-9+/]+={0,2}$/.test(body.data))return fail(400,'invalid_venue_image');
  const bytes=Buffer.from(body.data,'base64');
  if(bytes.length<100||bytes.length>2000000)return fail(413,'venue_image_too_large');
  const kind=detectType(bytes);
  if(!kind)return fail(400,'venue_image_format');
  const filename=randomUUID()+'.'+IMAGE_EXTENSIONS[kind];
  await mkdir(UPLOAD_DIRECTORY,{recursive:true});
  await writeFile(join(UPLOAD_DIRECTORY,filename),bytes,{flag:'wx',mode:0o600});
  return ok({url:publicUrl(filename)});
 }
 return fail(404,'not_found');
}
