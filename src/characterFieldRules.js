// Character-editor selections and derived tabletop presentation.
// Server-side progression remains authoritative for combat attributes.
export const SPECIALIZATIONS=[
 'Unassigned','Enforcer','Alchemist','Smuggler','Informant','Infiltrator',
 'Merchant','Diplomat','Medic','Scout','Artisan','Investigator','Bodyguard'
];
export const ALIGNMENTS=[
 'Lawful Good','Neutral Good','Chaotic Good',
 'Lawful Neutral','True Neutral','Chaotic Neutral',
 'Lawful Evil','Neutral Evil','Chaotic Evil'
];
export const GAME_PROFICIENCIES=[
 ['Languages','Eorzean (Common)'],['Languages','Hingan'],['Languages','Doman'],['Languages','Garlean'],
 ['Crafting','Carpenter'],['Crafting','Blacksmith'],['Crafting','Armorer'],
 ['Crafting','Goldsmith'],['Crafting','Leatherworker'],['Crafting','Weaver'],
 ['Crafting','Alchemist'],['Crafting','Culinarian'],
 ['Gathering','Miner'],['Gathering','Botanist'],['Gathering','Fisher']
];
export const SKILL_ABILITIES={
 Acrobatics:'dex','Animal Handling':'wis',Arcana:'int',Athletics:'str',Deception:'cha',
 History:'int',Insight:'wis',Intimidation:'cha',Investigation:'int',Medicine:'wis',
 Nature:'int',Perception:'wis',Performance:'cha',Persuasion:'cha',Religion:'int',
 'Sleight of Hand':'dex',Stealth:'dex',Survival:'wis'
};
export function splitCharacterName(value){
 const pieces=String(value||'').trim().split(/\s+/).filter(Boolean);
 return {first:pieces.shift()||'',last:pieces.join(' ')};
}
export function joinCharacterName(first,last){
 return [String(first||'').trim(),String(last||'').trim()].filter(Boolean).join(' ');
}
export function skillBonus(character,skill){
 const ability=SKILL_ABILITIES[skill];
 if(!ability)return null;
 const score=Number(character?.[ability]??10);
 const modifier=Math.floor(((Number.isFinite(score)?score:10)-10)/2);
 const lvl=Math.max(1,Math.min(20,Number(character?.level)||1));
 const proficiency=Number.isFinite(Number(character?.proficiency_bonus))?Number(character.proficiency_bonus):Math.min(6,2+Math.floor((lvl-1)/4));
 return modifier+(character?.skills?.[skill]?proficiency:0);
}
export function formatSigned(value){return (value>=0?'+':'')+value;}
export function selectedGameProficiencies(value){
 const rows=String(value||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 return GAME_PROFICIENCIES.map(([,value])=>value).filter(value=>rows.includes(value));
}
export function otherProficiencyNotes(value){
 const choices=new Set(GAME_PROFICIENCIES.map(([,item])=>item));
 return String(value||'').split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!choices.has(s)).join('\n');
}
export function updateProficiencySelection(original,value,checked){
 const selected=new Set(selectedGameProficiencies(original));
 if(checked)selected.add(value);else selected.delete(value);
 return [...selected,otherProficiencyNotes(original)].filter(Boolean).join('\n');
}
export function classArmor(classId,definition,character){
 const dex=Number(character?.dex??10);
 const dexMod=Math.floor((dex-10)/2);
 const tank=['paladin','warrior-job','dark-knight','gunbreaker','bastion','warrior'].includes(classId)||definition?.job_role==='tank';
 const level=Math.min(20,Math.max(1,Number(character?.level)||1));
 return Math.max(5,10+dexMod+(tank?2:0)+Math.floor((level-1)/5));
}
