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
