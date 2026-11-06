// Presentation-only rules for the character dossier.
// Authoritative visibility decisions still belong to the existing backend.
export const DOSSIER_TABS=Object.freeze([
 {id:'identity',label:'Identity',icon:'◇'},
 {id:'roleplay',label:'Roleplay',icon:'♡'},
 {id:'combat',label:'Combat',icon:'⚔'},
 {id:'spells',label:'Spellbook',icon:'✧'},
 {id:'possessions',label:'Possessions',icon:'▣'},
 {id:'progression',label:'Progression',icon:'◈'},
 {id:'legacy',label:'Classic sheet',icon:'▤'}
]);
export function isDossierRestricted(character,playerPreview=false){
 return Boolean(character?.collar_bound&&(playerPreview||character?.view_mode==='bound'));
}
export function dossierTabs(character,playerPreview=false){
 return isDossierRestricted(character,playerPreview)
  ? DOSSIER_TABS.filter(tab=>tab.id==='identity'||tab.id==='roleplay')
  : DOSSIER_TABS;
}
export function dossierSummary(character,playerPreview=false){
 if(!character)return null;
 if(isDossierRestricted(character,playerPreview)){
  // This small, allowlisted shape is used for every restricted dossier panel.
  return {
   restricted:true,
   name:character.name||'Unnamed character',
   specialty:character.specialty||'Unassigned',
   rank:character.rank||'Not recorded',
   assignedHandler:character.owner||'Unassigned',
   hp:character.hp??null
  };
 }
 return {
  restricted:false,name:character.name||'Unnamed character',
  species:character.species||'',specialty:character.specialty||'',
  className:character.class_name||'',level:character.level||1,
  background:character.background||'',alignment:character.alignment||'',
  rank:character.rank||'',experience:character.experience||0,
  hp:character.hp??null,maxHp:character.max_hp??null,
  armor:character.armor_class??null,speed:character.speed??null,
  abilities:Object.fromEntries(['str','dex','con','int','wis','cha'].map(k=>[k,character[k]??null])),
  personality:character.personality||'',ideals:character.ideals||'',
  bonds:character.bonds||'',flaws:character.flaws||'',
  features:character.features||'',equipment:character.inventory||'',
  notes:character.notes||'',conditions:character.conditions||'',
  spells:character.spells||'',proficiencies:character.proficiencies||''
 };
}
