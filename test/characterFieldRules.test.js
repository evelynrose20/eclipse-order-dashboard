import test from 'node:test';
import assert from 'node:assert/strict';
import {splitCharacterName,joinCharacterName,skillBonus,selectedGameProficiencies,otherProficiencyNotes,updateProficiencySelection,classArmor,formatSigned,ALIGNMENTS,GAME_PROFICIENCIES} from '../src/characterFieldRules.js';
import {createProgression,applyExperience,classArmor as serverClassArmor,xpForLevel} from '../server/src/progression.js';
import {builtinClassCatalog} from '../server/src/class-catalog.js';

test('first and last names round-trip without losing multiword surnames',()=>{
 assert.deepEqual(splitCharacterName('Astra de Moonveil'),{first:'Astra',last:'de Moonveil'});
 assert.equal(joinCharacterName(' Astra ',' de Moonveil '),'Astra de Moonveil');
 assert.deepEqual(splitCharacterName('Astra'),{first:'Astra',last:''});
});
test('checklists are FFXIV disciplines and preserve existing freeform proficiency notes',()=>{
 const values=new Set(GAME_PROFICIENCIES.map(([,item])=>item));
 for(const discipline of ['Carpenter','Blacksmith','Armorer','Goldsmith','Leatherworker','Weaver','Alchemist','Culinarian','Miner','Botanist','Fisher'])assert.ok(values.has(discipline));
 const original='A custom older field\nBlacksmith';
 const updated=updateProficiencySelection(original,'Miner',true);
 assert.deepEqual(selectedGameProficiencies(updated),['Blacksmith','Miner']);
 assert.equal(otherProficiencyNotes(updated),'A custom older field');
 assert.ok(!selectedGameProficiencies(updateProficiencySelection(updated,'Blacksmith',false)).includes('Blacksmith'));
 assert.equal(ALIGNMENTS.length,9);
});
test('skill proficiency has an actual roll modifier',()=>{
 const sheet={str:10,dex:10,wis:10,level:1,skills:{Perception:true,Stealth:false}};
 assert.equal(skillBonus(sheet,'Perception'),2);
 assert.equal(skillBonus(sheet,'Stealth'),0);
 assert.equal(skillBonus({...sheet,level:9},'Perception'),4);
 assert.equal(formatSigned(skillBonus(sheet,'Stealth')),'+0');
});
test('job and level calculate Armor Class and starting HP',()=>{
 const paladin=builtinClassCatalog().paladin;
 const spellcaster=builtinClassCatalog()['black-mage'];
 const neutral={class_id:'paladin',str:10,dex:10,con:10,int:10,wis:10,cha:10,level:20,experience:99999,hp:9000,armor_class:99};
 const start=createProgression(neutral,paladin);
 assert.equal(start.hp,10);
 assert.equal(start.armor_class,12);
 assert.equal(start.level,1);
 assert.equal(classArmor('paladin',paladin,{dex:10,level:1}),serverClassArmor({class_id:'paladin',dex:10,level:1},paladin));
 const advanced=applyExperience(start,xpForLevel(6),paladin);
 assert.equal(advanced.level,6);
 assert.equal(advanced.armor_class,13);
 assert.ok(advanced.max_hp>start.max_hp);
 assert.equal(serverClassArmor({class_id:'black-mage',dex:10,level:1},spellcaster),10);
});
