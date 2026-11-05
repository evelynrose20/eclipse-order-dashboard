// Eclipse Order's lightweight homebrew D20 progression rules.
// 27-point creation budget, scores 8–15; class controls core combat profile.
export const ABILITIES=['str','dex','con','int','wis','cha'];
export const SCORE_COST={8:0,9:1,10:2,11:3,12:4,13:5,14:7,15:9};
export const POINT_BUDGET=27;
export const MAX_LEVEL=20;
export const CLASSES={
 warrior:{name:'Warrior',hit_die:10,primary:'str',saves:['str','con'],description:'Frontline defender and heavy-weapon specialist',features:['Guard Stance','Second Wind']},
 rogue:{name:'Rogue',hit_die:8,primary:'dex',saves:['dex','int'],description:'Agility, scouting and precise attacks',features:['Sneak Attack','Cunning Action']},
 mage:{name:'Mage',hit_die:6,primary:'int',saves:['int','wis'],description:'Arcane damage, wards and investigation',features:['Arcane Bolt','Spell Focus']},
 healer:{name:'Healer',hit_die:8,primary:'wis',saves:['wis','cha'],description:'Supportive magic and restorative arts',features:['Restoration','Protective Blessing']},
 ranger:{name:'Ranger',hit_die:10,primary:'dex',saves:['str','dex'],description:'Ranged combat, tracking and exploration',features:['Hunter’s Mark','Fieldcraft']},
 bard:{name:'Bard',hit_die:8,primary:'cha',saves:['dex','cha'],description:'Support, storytelling and morale',features:['Inspiration','Song of Valor']}
};
export function pointCost(sheet){
 let total=0;
 for(const k of ABILITIES){const value=Number(sheet?.[k]);if(!Number.isInteger(value)||!Object.hasOwn(SCORE_COST,value))return null;total+=SCORE_COST[value];}
 return total;
}
export function xpForLevel(level){return 100*level*(level-1);}
export function levelForXp(xp){let level=1;while(level<MAX_LEVEL&&xp>=xpForLevel(level+1))level++;return level;}
export const abilityModifier=score=>Math.floor((Number(score||10)-10)/2);
export const proficiencyForLevel=level=>Math.min(6,2+Math.floor((level-1)/4));
export function createProgression(sheet){
 const klass=CLASSES[sheet?.class_id];
 if(!klass)return {error:'Choose a class.'};
 const spent=pointCost(sheet);
 if(spent===null||spent>POINT_BUDGET)return {error:'Ability scores must be 8–15 and spend at most 27 points.'};
 const con=abilityModifier(sheet.con);
 const hp=Math.max(1,klass.hit_die+con);
 const skills=sheet.skills&&typeof sheet.skills==='object'&&!Array.isArray(sheet.skills)?sheet.skills:{};
 return {...sheet,class_id:sheet.class_id,class_name:klass.name,progression_version:1,level:1,experience:0,
  hp,max_hp:hp,hit_dice:'1d'+klass.hit_die,proficiency_bonus:2,features:klass.features.join(', '),
  saving_throws:Object.fromEntries(ABILITIES.map(a=>[a,klass.saves.includes(a)])),skills};
}
export function applyExperience(sheet,amount){
 const klass=CLASSES[sheet.class_id];
 const prevLevel=Number(sheet.level)||1;
 const experience=Math.max(0,Math.trunc(Number(sheet.experience)||0)+amount);
 const level=levelForXp(experience);
 const levelsGained=Math.max(0,level-prevLevel);
 const maxHp=Math.max(1,Number(sheet.max_hp)||1)+levelsGained*Math.max(1,Math.floor((klass?.hit_die||8)/2)+1+abilityModifier(sheet.con));
 return {...sheet,experience,level,max_hp:maxHp,hp:Math.min(maxHp,Math.max(0,Number(sheet.hp)||0)+levelsGained*(maxHp-(Number(sheet.max_hp)||1))),
  hit_dice:klass?level+'d'+klass.hit_die:sheet.hit_dice,proficiency_bonus:proficiencyForLevel(level)};
}
