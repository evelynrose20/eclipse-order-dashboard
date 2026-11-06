import test from 'node:test';
import assert from 'node:assert/strict';
import {builtinClassCatalog,schoolSlots,validateClass} from '../src/class-catalog.js';
test('starter classes and unlock paths are editable foundations',()=>{
 const classes=builtinClassCatalog();
 assert.equal(Object.keys(classes).length,29);
 assert.equal(classes['viper'].name,'Viper');
 assert.equal(classes['pictomancer'].name,'Pictomancer');
 assert.equal(classes['bastion'].name,'Bastion');
 assert.equal(classes['zephyr'].name,'Zephyr');
 assert.equal(classes['beastmaster'],undefined);
 assert.equal(classes['blue-mage'],undefined);
 assert.equal(classes['warrior-job'].name,'Warrior');
 assert.equal(classes.warrior.name,'Warrior');
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

test('FFXIV tabletop jobs have valid 20-level milestones and unique spells',()=>{
 const catalog=builtinClassCatalog();
 const jobs=Object.values(catalog).filter(c=>c.origin==='ffxiv_tabletop');
 assert.equal(jobs.length,23);
 for(const job of jobs){
  assert.equal(job.features.length,8,job.name);
  assert.equal(job.features[0].level,1,job.name);
  assert.equal(job.features.at(-1).level,20,job.name);
  assert.ok(job.features.every(f=>f.level>=1&&f.level<=20),job.name);
  assert.ok(job.spells.every(s=>s.level>=1&&s.level<=20&&s.cost<=12),job.name);
  assert.equal(new Set(job.spells.map(s=>s.id)).size,job.spells.length,job.name);
  assert.ok(validateClass(job.id,job),job.name+' should pass the existing editor validation');
 }
});
test('existing legacy templates are not overwritten or deleted',()=>{
 const classes=builtinClassCatalog();
 for(const legacy of ['warrior','rogue','mage','healer','ranger','bard'])assert.ok(classes[legacy],legacy);
 assert.notEqual(classes['warrior-job'].id,classes.warrior.id);
 assert.notEqual(classes['bard-job'].id,classes.bard.id);
});

test('Evercold Bastion and Zephyr have accurate themes and complete progression',()=>{
 const jobs=builtinClassCatalog();
 const tank=jobs.bastion, ranged=jobs.zephyr;
 assert.equal(tank.job_role,'tank');
 assert.equal(ranged.job_role,'ranged');
 assert.match(tank.description,/greatshields/i);
 assert.match(ranged.description,/crossbow/i);
 assert.match(ranged.description,/avian familiar/i);
 for(const job of [tank,ranged]){
  assert.deepEqual(job.features.map(f=>f.level),[1,3,5,7,10,13,16,20]);
  assert.deepEqual(job.spells.map(f=>f.level),[1,3,5,7,10,13,16,20]);
  assert.ok(validateClass(job.id,job));
 }
});
test('removed limited jobs cannot return through admin class edits',()=>{
 const example=builtinClassCatalog().bastion;
 assert.equal(validateClass('blue-mage',example),null);
 assert.equal(validateClass('beastmaster',example),null);
});
