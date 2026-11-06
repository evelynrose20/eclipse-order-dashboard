// Shared presentation helpers for the character editor.
// Server-side creation and progression rules remain authoritative.
export const ATTRIBUTES=[
 ['str','Strength'],['dex','Dexterity'],['con','Constitution'],
 ['int','Intelligence'],['wis','Wisdom'],['cha','Charisma']
];
export const ROLES=[
 ['tank','Tanks'],['healer','Healers'],['melee','Melee DPS'],
 ['ranged','Physical Ranged'],['caster','Magical Ranged']
];
export const POINT_COST={8:0,9:1,10:2,11:3,12:4,13:5,14:7,15:9};
export const BUDGET=27;
const SPELLCASTING={none:'Martial techniques',half:'Hybrid / aether techniques',full:'Spellcaster'};
const LEGACY=new Set(['warrior','rogue','mage','healer','ranger','bard']);
export function characterClassGroups(catalog){
 const entries=Object.entries(catalog||{}).filter(([id,job])=>
  id!=='blue-mage'&&id!=='beastmaster'&&job&&typeof job==='object');
 const roleOf=([id,job])=>job.job_role||({
  bastion:'tank',paladin:'tank','warrior-job':'tank','dark-knight':'tank',gunbreaker:'tank',
  'white-mage':'healer',scholar:'healer',astrologian:'healer',sage:'healer',
  monk:'melee',dragoon:'melee',ninja:'melee',samurai:'melee',reaper:'melee',viper:'melee',
  'bard-job':'ranged',machinist:'ranged',dancer:'ranged',zephyr:'ranged',
  'black-mage':'caster',summoner:'caster','red-mage':'caster',pictomancer:'caster'
 })[id];
 const groups=ROLES.map(([id,label])=>({id,label,jobs:entries.filter(e=>roleOf(e)===id).sort((a,b)=>a[1].name.localeCompare(b[1].name))}));
 const other=entries.filter(e=>!roleOf(e)&&!LEGACY.has(e[0])).sort((a,b)=>a[1].name.localeCompare(b[1].name));
 const legacy=entries.filter(e=>LEGACY.has(e[0])).sort((a,b)=>a[1].name.localeCompare(b[1].name));
 if(other.length)groups.push({id:'custom',label:'Custom classes',jobs:other});
 if(legacy.length)groups.push({id:'legacy',label:'Legacy classes (existing)',jobs:legacy});
 return groups.filter(group=>group.jobs.length);
}
export function pointsSpent(form){
 let total=0;
 for(const [key] of ATTRIBUTES){
  const score=Number(form?.[key]);
  if(!Number.isInteger(score)||!Object.hasOwn(POINT_COST,score))return null;
  total+=POINT_COST[score];
 }
 return total;
}
export function editorJobPreview(job){
 if(!job)return null;
 const features=(job.features||[]).filter(f=>Number(f.level)===1);
 const spells=(job.spells||[]).filter(s=>Number(s.level)===1);
 return {
  style:SPELLCASTING[job.casting]||'Class techniques',
  hitDie:'d'+(job.hit_die||8),
  primary:(job.primary||'str').toUpperCase(),
  saves:(job.saves||[]).map(s=>s.toUpperCase()),
  features,spells,
  upcoming:[...(job.features||[]).map(f=>({...f,kind:'Technique'})),...(job.spells||[]).map(s=>({...s,kind:'Spell'}))]
   .filter(f=>Number(f.level)>1&&Number(f.level)<=20)
   .sort((a,b)=>a.level-b.level).slice(0,6)
 };
}
export function creationIssue(form,catalog){
 if(!String(form?.name||'').trim())return 'Enter a character name.';
 if(!catalog||!catalog[form.class_id])return 'Choose a class or job from the catalog.';
 const spent=pointsSpent(form);
 if(spent===null)return 'Starting ability scores must be whole numbers from 8 to 15.';
 if(spent>BUDGET)return 'Starting ability scores exceed the 27-point budget.';
 return '';
}
