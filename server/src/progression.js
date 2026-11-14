// Imperium Noctis's tabletop character progression rules.
// 27-point creation budget, scores 8–15; class controls core combat profile.
export const ABILITIES=['str','dex','con','int','wis','cha'];
export const SCORE_COST={8:0,9:1,10:2,11:3,12:4,13:5,14:7,15:9};
export const POINT_BUDGET=27;
export const MAX_LEVEL=20;
export const MAX_SKILL_PROFICIENCIES=3;
export function skillProficiencyCount(skills){return skills&&typeof skills==='object'&&!Array.isArray(skills)?Object.values(skills).filter(value=>value===true).length:0;}
export const CLASSES={
 warrior:{name:'Warrior',hit_die:10,primary:'str',saves:['str','con'],description:'Frontline defender and heavy-weapon specialist',features:['Guard Stance','Second Wind'],unlocks:{3:'Shield Bash',7:'Rallying Cry',11:'Iron Resolve',15:'Last Stand'}},
 rogue:{name:'Rogue',hit_die:8,primary:'dex',saves:['dex','int'],description:'Agility, scouting and precise attacks',features:['Sneak Attack','Cunning Action'],unlocks:{3:'Shadowstep',7:'Evasion',11:'Ambush Expert',15:'Perfect Opening'}},
 mage:{name:'Mage',hit_die:6,primary:'int',saves:['int','wis'],description:'Arcane damage, wards and investigation',features:['Arcane Bolt','Spell Focus'],unlocks:{3:'Arcane Ward',7:'Spell Echo',11:'Greater Invocation',15:'Arcane Mastery'}},
 healer:{name:'Healer',hit_die:8,primary:'wis',saves:['wis','cha'],description:'Supportive magic and restorative arts',features:['Restoration','Protective Blessing'],unlocks:{3:'Cleansing Rite',7:'Group Mend',11:'Sanctuary',15:'Miracle'}},
 ranger:{name:'Ranger',hit_die:10,primary:'dex',saves:['str','dex'],description:'Ranged combat, tracking and exploration',features:['Hunter’s Mark','Fieldcraft'],unlocks:{3:'Trick Shot',7:'Wild Instinct',11:'Volley',15:'Master Tracker'}},
 bard:{name:'Bard',hit_die:8,primary:'cha',saves:['dex','cha'],description:'Support, storytelling and morale',features:['Inspiration','Song of Valor'],unlocks:{3:'Ballad of Courage',7:'Soothing Verse',11:'Heroic Chorus',15:'Legendary Performance'}}
};
export function pointCost(sheet){
 let total=0;
 for(const k of ABILITIES){const value=Number(sheet?.[k]);if(!Number.isInteger(value)||!Object.hasOwn(SCORE_COST,value))return null;total+=SCORE_COST[value];}
 return total;
}
export function xpForLevel(level){return 100*level*(level-1);}
export function levelForXp(xp){let level=1;while(level<MAX_LEVEL&&xp>=xpForLevel(level+1))level++;return level;}
export const abilityModifier=score=>Math.floor((Number(score??10)-10)/2);
export function classArmor(sheet,klass){
 const role=klass?.job_role;
 const tank=role==='tank'||['warrior','paladin','warrior-job','dark-knight','gunbreaker','bastion'].includes(sheet?.class_id);
 const level=Math.min(20,Math.max(1,Number(sheet?.level)||1));
 return Math.max(5,10+abilityModifier(sheet?.dex)+(tank?2:0)+Math.floor((level-1)/5));
}
export const proficiencyForLevel=level=>Math.min(6,2+Math.floor((level-1)/4));
export function unlockedClassFeatures(classId,level,definition=CLASSES[classId]){
 if(!definition)return [];
 return Array.isArray(definition.features)&&definition.features[0]&&typeof definition.features[0]==='object'?
  definition.features.filter(f=>f.level<=level).map(f=>f.name):
  [...(definition.features||[]),...Object.entries(definition.unlocks||{}).filter(([required])=>Number(required)<=level).map(([,name])=>name)];
}
export function createProgression(sheet,definition){
 const klass=definition||CLASSES[sheet?.class_id];
 if(!klass)return {error:'Choose a class.'};
 const spent=pointCost(sheet);
 if(spent===null||spent>POINT_BUDGET)return {error:'Ability scores must be 8–15 and spend at most 27 points.'};
 if(skillProficiencyCount(sheet.skills)>MAX_SKILL_PROFICIENCIES)return {error:'Choose no more than 3 skill proficiencies.'};
 const con=abilityModifier(sheet.con);
 const hp=Math.max(1,klass.hit_die+con);
 const skills=sheet.skills&&typeof sheet.skills==='object'&&!Array.isArray(sheet.skills)?sheet.skills:{};
 return {...sheet,class_id:sheet.class_id,class_name:klass.name,progression_version:1,level:1,experience:0,
  hp,max_hp:hp,armor_class:classArmor({...sheet,level:1},klass),hit_dice:'1d'+klass.hit_die,proficiency_bonus:2,features:unlockedClassFeatures(sheet.class_id,1,klass).join(', '),
  ability_points:0,class_features:unlockedClassFeatures(sheet.class_id,1,klass),
  spell_points:klass.casting==='full'?4:0,max_spell_points:klass.casting==='full'?4:0,
  saving_throws:Object.fromEntries(ABILITIES.map(a=>[a,klass.saves.includes(a)])),skills};
}
export function applyExperience(sheet,amount,definition){
 const klass=definition||CLASSES[sheet.class_id];
 const prevLevel=Number(sheet.level)||1;
 const experience=Math.max(0,Math.trunc(Number(sheet.experience)||0)+amount);
 const level=levelForXp(experience);
 const levelsGained=Math.max(0,level-prevLevel);
 const milestones=[4,8,12,16,19];
 const pointsGained=milestones.filter(n=>n>prevLevel&&n<=level).length*2;
 const maxHp=Math.max(1,Number(sheet.max_hp)||1)+levelsGained*Math.max(1,Math.floor((klass?.hit_die||8)/2)+1+abilityModifier(sheet.con));
 const pool=(casting,lvl)=>casting==='full'?2+2*lvl:casting==='half'?(lvl<2?0:1+Math.floor(lvl/2)):0;
 const oldLimit=Number.isInteger(sheet.max_spell_points)?sheet.max_spell_points:pool(klass?.casting,prevLevel);
 const oldCurrent=Number.isInteger(sheet.spell_points)?sheet.spell_points:oldLimit;
 const newLimit=pool(klass?.casting,level);
 return {...sheet,experience,level,armor_class:classArmor({...sheet,level},klass),class_features:unlockedClassFeatures(sheet.class_id,level,klass),
  max_spell_points:newLimit,spell_points:Math.min(newLimit,oldCurrent+Math.max(0,newLimit-oldLimit)),ability_points:(Number(sheet.ability_points)||0)+pointsGained,max_hp:maxHp,hp:Math.min(maxHp,Math.max(0,Number(sheet.hp)||0)+levelsGained*(maxHp-(Number(sheet.max_hp)||1))),
  hit_dice:klass?level+'d'+klass.hit_die:sheet.hit_dice,proficiency_bonus:proficiencyForLevel(level)};
}
