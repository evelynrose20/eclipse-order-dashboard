import test from 'node:test';
import assert from 'node:assert/strict';
import {CLASSES,pointCost,createProgression,applyExperience,xpForLevel,levelForXp,skillProficiencyCount,MAX_SKILL_PROFICIENCIES} from '../src/progression.js';
test('six classes define core combat rules',()=>{assert.equal(Object.keys(CLASSES).length,6);assert.equal(CLASSES.warrior.hit_die,10)});
test('creation costs and min/max enforce 27 points',()=>{
 assert.equal(pointCost({str:8,dex:8,con:8,int:8,wis:8,cha:8}),0);
 assert.equal(pointCost({str:15,dex:15,con:15,int:8,wis:8,cha:8}),27);
 assert.equal(pointCost({str:16,dex:8,con:8,int:8,wis:8,cha:8}),null);
 assert.equal(createProgression({class_id:'rogue',str:15,dex:15,con:15,int:15,wis:8,cha:8}).error!==undefined,true);
});
test('new characters always start level one even when client submits boosted level or XP',()=>{
 const character=createProgression({class_id:'warrior',str:15,dex:14,con:13,int:12,wis:10,cha:8,level:20,experience:99999,hp:999});
 assert.equal(character.level,1);assert.equal(character.experience,0);
 assert.equal(character.hp,11);assert.equal(character.max_hp,11);
 assert.equal(character.proficiency_bonus,2);
 assert.equal(character.saving_throws.str,true);
});
test('XP increases levels and HP predictably',()=>{
 const c=createProgression({class_id:'mage',str:8,dex:10,con:12,int:15,wis:14,cha:8});
 const next=applyExperience(c,xpForLevel(3));
 assert.equal(levelForXp(next.experience),3);assert.equal(next.level,3);
 assert.equal(next.proficiency_bonus,2);assert.ok(next.max_hp>c.max_hp);
});

test('character creation accepts three trained skills and rejects a fourth',()=>{
 const base={class_id:'warrior',str:10,dex:10,con:10,int:10,wis:10,cha:10};
 const three={Acrobatics:true,Stealth:true,Perception:true,Arcana:false};
 assert.equal(MAX_SKILL_PROFICIENCIES,3);
 assert.equal(skillProficiencyCount(three),3);
 assert.equal(createProgression({...base,skills:three}).error,undefined);
 assert.match(createProgression({...base,skills:{...three,Arcana:true}}).error,/3 skill/);
});
