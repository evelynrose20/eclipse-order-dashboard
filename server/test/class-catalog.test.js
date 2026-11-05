import test from 'node:test';
import assert from 'node:assert/strict';
import {builtinClassCatalog,schoolSlots,validateClass} from '../src/class-catalog.js';
test('starter classes and unlock paths are editable foundations',()=>{
 const classes=builtinClassCatalog();
 assert.equal(Object.keys(classes).length,6);
 assert.equal(classes.mage.spells[0].level,1);
 assert.equal(classes.warrior.casting,'none');
 assert.equal(classes.ranger.casting,'half');
});
test('spell resources follow full/half/non-caster progressions',()=>{
 assert.equal(schoolSlots('none',20),0);
 assert.equal(schoolSlots('half',1),0);
 assert.equal(schoolSlots('half',6),4);
 assert.equal(schoolSlots('full',1),4);
 assert.equal(schoolSlots('full',20),42);
});
test('class validation rejects invalid levels, duplicate spell ids and unsupported grants',()=>{
 const example=builtinClassCatalog().mage;
 assert.equal(validateClass('mage',example).spells.length,example.spells.length);
 assert.equal(validateClass('mage',{...example,spells:[...example.spells,example.spells[0]]}),null);
 assert.equal(validateClass('mage',{...example,spells:[{id:'bad',name:'Bad',level:21,cost:1,description:'bad'}]}),null);
 assert.equal(validateClass('warrior',{...example,casting:'none'}),null);
});
