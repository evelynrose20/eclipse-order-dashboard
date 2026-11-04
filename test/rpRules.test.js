import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDiceFormula,statusLabel,canRequestTransition,sheetCheckFormula} from '../src/rpRules.js';
test('normal D&D expression',()=>{
 assert.deepEqual(parseDiceFormula(' 2D6 + 4 '),{ok:true,count:2,sides:6,mode:'normal',modifier:4,normalized:'2d6+4'});
});
test('advantage and disadvantage require 2d20',()=>{
 assert.equal(parseDiceFormula('2d20kh1+3').mode,'kh1');
 assert.equal(parseDiceFormula('2d20kl1-2').mode,'kl1');
 assert.equal(parseDiceFormula('3d20kh1').ok,false);
 assert.equal(parseDiceFormula('2d8kh1').ok,false);
});
test('limits reject malformed and excessive rolls',()=>{
 for(const expr of ['','0d20','21d20','2d999','1d20+999','1d20;drop','1d20/2']){
  assert.equal(parseDiceFormula(expr).ok,false,expr);
 }
});
test('free/bound characters preserve two directions',()=>{
 assert.equal(statusLabel(true),'Bound');
 assert.equal(statusLabel(false),'Free');
});
test('status requests require owning account or assigned handlers',()=>{
 const char={player_user_id:'user-1',handler_user_id:'handler-1'};
 assert.equal(canRequestTransition(char,'user-1','member'),true);
 assert.equal(canRequestTransition(char,'handler-1','handler'),true);
 assert.equal(canRequestTransition(char,'unrelated','member'),false);
 assert.equal(canRequestTransition(char,'unrelated','domina'),true);
 assert.equal(canRequestTransition({...char,player_user_id:null},'unrelated','domina'),false);
});

test('D&D sheet checks derive modifiers without granting extra proficiencies',()=>{
 const char={str:16,dex:12,con:8,wis:14,level:5,proficiency_bonus:3,
  saving_throws:{con:true},skills:{Perception:true,'Stealth':false}};
 assert.equal(sheetCheckFormula(char,'ability','str'),'1d20+3');
 assert.equal(sheetCheckFormula(char,'saving_throw','con'),'1d20+2');
 assert.equal(sheetCheckFormula(char,'skill','Perception'),'1d20+5');
 assert.equal(sheetCheckFormula(char,'skill','Stealth'),'1d20+1');
 assert.equal(sheetCheckFormula(char,'skill','Nonexistent'),'1d20+0');
});
