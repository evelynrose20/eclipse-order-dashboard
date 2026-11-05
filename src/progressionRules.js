export const ABILITIES=['str','dex','con','int','wis','cha'];
export const SCORE_COST={8:0,9:1,10:2,11:3,12:4,13:5,14:7,15:9};
export const POINT_BUDGET=27;
export const CLASSES={
 warrior:{name:'Warrior',hit_die:10,primary:'str',description:'Frontline defender'},
 rogue:{name:'Rogue',hit_die:8,primary:'dex',description:'Scout and precise attacker'},
 mage:{name:'Mage',hit_die:6,primary:'int',description:'Arcane specialist'},
 healer:{name:'Healer',hit_die:8,primary:'wis',description:'Restoration and support'},
 ranger:{name:'Ranger',hit_die:10,primary:'dex',description:'Ranged combat and tracking'},
 bard:{name:'Bard',hit_die:8,primary:'cha',description:'Inspiration and morale'}
};
export function pointCost(sheet){
 let sum=0;
 for(const ability of ABILITIES){
  const n=Number(sheet[ability]);
  if(!Number.isInteger(n)||!(n in SCORE_COST))return null;
  sum+=SCORE_COST[n];
 }
 return sum;
}
export const xpForLevel=level=>100*level*(level-1);
