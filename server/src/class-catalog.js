import {resolveSession} from './auth.js';
import {CLASSES,ABILITIES} from './progression.js';
import {ffxivJobCatalog} from './ffxiv-job-catalog.js';

const DEFAULT_SPELLS={
 mage:[
  ['arcane-bolt','Arcane Bolt',1,1,'A focused arcane projectile. Resolve its attack and damage using encounter dice.'],
  ['flicker-ward','Flicker Ward',2,1,'Raise a brief magical shield against an incoming threat.'],
  ['glimmer-step','Glimmer Step',3,2,'Move a short distance through a flash of light.'],
  ['binding-sigil','Binding Sigil',5,3,'Create a temporary magical restraint; the GM decides the save DC.'],
  ['echo-lance','Echo Lance',7,3,'Strike a target with a second pulse of force.'],
  ['astral-veil','Astral Veil',9,4,'Conceal allies in a shimmering protective field.'],
  ['starfall','Starfall',13,5,'Call down concentrated arcane energy in an area.'],
  ['grand-invocation','Grand Invocation',17,6,'Release a powerful ritual surge with GM-adjudicated effects.']
 ],
 healer:[
  ['mend','Mend',1,1,'Restore a small amount of HP using encounter healing dice.'],
  ['gentle-light','Gentle Light',2,1,'Provide short-lived protection to one ally.'],
  ['cleansing-touch','Cleansing Touch',3,2,'Remove one minor condition at GM discretion.'],
  ['renewal','Renewal',5,2,'Restore health over a brief period.'],
  ['group-mend','Group Mend',7,3,'Restore health to several allies.'],
  ['sanctuary','Sanctuary',9,4,'Create a warded refuge around a chosen point.'],
  ['revitalizing-prayer','Revitalizing Prayer',13,5,'Powerfully restore and steady an injured ally.'],
  ['miracle','Miracle',17,6,'Perform an extraordinary act of healing with GM approval.']
 ],
 ranger:[
  ['guiding-arrow','Guiding Arrow',2,1,'Enchant the next ranged strike to reveal a target.'],
  ['thorn-snare','Thorn Snare',5,2,'Create a temporary snare in the terrain.'],
  ['windstride','Windstride',9,2,'Empower movement and evasive positioning.'],
  ['storm-volley','Storm Volley',13,3,'Rain empowered missiles across an area.'],
  ['wild-ward','Wild Ward',17,4,'Shield nearby allies with primal energy.']
 ],
 bard:[
  ['soothing-verse','Soothing Verse',1,1,'Sing to restore an ally with healing dice.'],
  ['stirring-chorus','Stirring Chorus',2,1,'Grant an ally a brief morale boost.'],
  ['discordant-chord','Discordant Chord',3,2,'Disorient an enemy with disruptive sound.'],
  ['echoing-song','Echoing Song',5,2,'Carry an enchantment across nearby allies.'],
  ['heroic-chorus','Heroic Chorus',7,3,'Bolster a group before a difficult challenge.'],
  ['silencing-refrain','Silencing Refrain',11,4,'Suppress sound in a small area briefly.'],
  ['legendary-ballad','Legendary Ballad',17,5,'Perform a powerful support song with GM adjudication.']
 ]
};
const CASTING={mage:'full',healer:'full',bard:'full',ranger:'half'};
export const schoolSlots=(casting,level)=>{
 const lvl=Math.min(20,Math.max(1,Math.floor(Number(level)||1)));
 if(casting==='full')return 2+2*lvl;
 if(casting==='half')return lvl<2?0:1+Math.floor(lvl/2);
 return 0;
};
export function builtinClassCatalog(){
 return {...Object.fromEntries(Object.entries(CLASSES).map(([id,c])=>[id,{
  id,name:c.name,description:c.description,hit_die:c.hit_die,primary:c.primary,saves:c.saves,
  casting:CASTING[id]||'none',
  features:[...c.features.map(name=>({level:1,name,description:''})),...Object.entries(c.unlocks||{}).map(([level,name])=>({level:Number(level),name,description:''}))],
  spells:(DEFAULT_SPELLS[id]||[]).map(([spellId,name,level,cost,description])=>({id:spellId,name,level,cost,description})),
  built_in:true
 }])),...ffxivJobCatalog()};
}
const asText=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
const RETIRED_JOB_IDS=new Set(['blue-mage','beastmaster']);
const validId=s=>typeof s==='string'&&/^[a-z][a-z0-9_-]{1,39}$/.test(s)&&!RETIRED_JOB_IDS.has(s);
export function validateClass(id,body){
 if(!validId(id)||!body||typeof body!=='object'||Array.isArray(body))return null;
 const name=asText(body.name,80),description=asText(body.description,900);
 const hit_die=Number(body.hit_die),primary=body.primary,casting=body.casting;
 const saves=body.saves;
 if(!name||!description||![6,8,10,12].includes(hit_die)||!ABILITIES.includes(primary)||!['none','half','full'].includes(casting)||!Array.isArray(saves)||saves.length!==2||new Set(saves).size!==2||saves.some(x=>!ABILITIES.includes(x)))return null;
 if(!Array.isArray(body.features)||body.features.length>60||!Array.isArray(body.spells)||body.spells.length>80)return null;
 const features=body.features.map(f=>({level:Number(f?.level),name:asText(f?.name,90),description:asText(f?.description,900)}));
 if(features.some(f=>!Number.isInteger(f.level)||f.level<1||f.level>20||!f.name))return null;
 const spells=body.spells.map(s=>({id:s?.id,name:asText(s?.name,90),level:Number(s?.level),cost:Number(s?.cost),description:asText(s?.description,1200)}));
 if(spells.some(s=>!validId(s.id)||!s.name||!Number.isInteger(s.level)||s.level<1||s.level>20||!Number.isInteger(s.cost)||s.cost<1||s.cost>12||!s.description)||new Set(spells.map(s=>s.id)).size!==spells.length||casting==='none'&&spells.length)return null;
 return {id,name,description,hit_die,primary,saves:[...saves],casting,features:features.sort((a,b)=>a.level-b.level),spells:spells.sort((a,b)=>a.level-b.level),built_in:Boolean(builtinClassCatalog()[id])};
}
export async function loadClassCatalog(db){
 const catalog=builtinClassCatalog();
 const [rows]=await db.query('SELECT id,definition_json FROM order_homebrew_classes ORDER BY id');
 for(const row of rows){
  if(RETIRED_JOB_IDS.has(row.id))continue; // Preserve stored rows for rollback but never offer retired jobs.
  const data=typeof row.definition_json==='string'?JSON.parse(row.definition_json):row.definition_json;
  const valid=validateClass(row.id,data);
  if(valid)catalog[row.id]=valid;
 }
 return catalog;
}
// Class definitions are read-only. Retained database overrides remain available to
// existing characters, but the retired Homebrew Classes editor cannot modify them.
export async function classRoute(pool,req,path){
 if(!pool)return {status:503,body:{error:'database_unavailable'}};
 const actor=await resolveSession(pool,req);
 if(!actor)return {status:401,body:{error:'not_authenticated'}};
 if(path==='/classes'&&req.method==='GET')
  return {status:200,body:{classes:await loadClassCatalog(pool)}};
 return {status:404,body:{error:'not_found'}};
}
