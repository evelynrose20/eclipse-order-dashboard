// Fast client-side feedback only. SQL RPCs remain authoritative.
export function parseDiceFormula(input){
 const normalized=String(input||'').toLowerCase().replace(/\s+/g,'');
 const match=/^([1-9][0-9]?)d(4|6|8|10|12|20|100)(kh1|kl1)?([+-][0-9]{1,2})?$/.exec(normalized);
 if(!match)return {ok:false,error:'Use a formula like 1d20+5 or 2d20kh1+3.'};
 const count=Number(match[1]),sides=Number(match[2]),mode=match[3]||'normal',modifier=Number(match[4]||0);
 if(count>20 || (mode!=='normal' && (count!==2||sides!==20)))return {ok:false,error:'Maximum 20 dice; advantage/disadvantage requires exactly 2d20.'};
 return {ok:true,count,sides,mode,modifier,normalized};
}
export function statusLabel(bound){return bound?'Bound':'Free'}
export function canRequestTransition(character,userId,role){
 if(!character?.player_user_id)return false;
 return character.player_user_id===userId||
 ['domina','high_command'].includes(role)||
 (role==='handler'&&character.handler_user_id===userId);
}

export const DND_SKILL_ABILITIES={
 'Acrobatics':'dex','Animal Handling':'wis','Arcana':'int','Athletics':'str','Deception':'cha',
 'History':'int','Insight':'wis','Intimidation':'cha','Investigation':'int','Medicine':'wis',
 'Nature':'int','Perception':'wis','Performance':'cha','Persuasion':'cha','Religion':'int',
 'Sleight of Hand':'dex','Stealth':'dex','Survival':'wis'
};
export function sheetCheckFormula(character,kind,selection){
 if(!character)return '1d20+0';
 const ability=kind==='skill'?DND_SKILL_ABILITIES[selection]:selection;
 if(!['str','dex','con','int','wis','cha'].includes(ability))return '1d20+0';
 const score=Number(character[ability]??10);
 const base=Math.floor((Number.isFinite(score)?score:10)-10)/2;
 const baseMod=Math.floor(base);
 const level=Math.max(1,Number(character.level)||1);
 const prof=Number.isFinite(Number(character.proficiency_bonus))?Number(character.proficiency_bonus):Math.min(6,2+Math.floor((level-1)/4));
 const proficiency=kind==='skill'?Boolean(character.skills?.[selection]):kind==='saving_throw'?Boolean(character.saving_throws?.[ability]):false;
 const modifier=baseMod+(proficiency?prof:0);
 const normalized=Math.max(-99,Math.min(99,Math.trunc(modifier)));
 return '1d20'+(normalized>=0?'+':'')+normalized;
}
