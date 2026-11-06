import test from 'node:test';
import assert from 'node:assert/strict';
import {ATTRIBUTES,BUDGET,pointsSpent,creationIssue,characterClassGroups,editorJobPreview} from '../src/characterEditorRules.js';

const scores=Object.fromEntries(ATTRIBUTES.map(([id])=>[id,8]));
const catalog={
 'paladin':{name:'Paladin',job_role:'tank',hit_die:10,casting:'half',primary:'str',saves:['str','cha'],features:[{level:1,name:'Oathguard'},{level:3,name:'Shield Intercept'}],spells:[{id:'radiant-strike',name:'Radiant Strike',level:1,cost:1}]},
 'zephyr':{name:'Zephyr',job_role:'ranged',hit_die:8,casting:'half',primary:'dex',saves:['dex','wis'],features:[{level:1,name:'Crossbow Discipline'}],spells:[]},
 'bastion':{name:'Bastion',job_role:'tank',hit_die:12,casting:'half',primary:'str',saves:['str','con'],features:[],spells:[]},
 'viper':{name:'Viper',job_role:'melee',hit_die:8,casting:'none',primary:'dex',saves:['dex','str'],features:[],spells:[]},
 'pictomancer':{name:'Pictomancer',job_role:'caster',hit_die:6,casting:'full',primary:'int',saves:['int','cha'],features:[],spells:[]},
 'blue-mage':{name:'Blue Mage',job_role:'caster'},
 'beastmaster':{name:'Beastmaster',job_role:'ranged'},
 'warrior':{name:'Warrior',hit_die:10,casting:'none'}
};
test('job selector separates combat roles and preserves legacy options',()=>{
 const groups=characterClassGroups(catalog);
 const find=id=>groups.find(g=>g.id===id)?.jobs.map(([key])=>key)||[];
 assert.deepEqual(find('tank'),['bastion','paladin']);
 assert.deepEqual(find('ranged'),['zephyr']);
 assert.deepEqual(find('melee'),['viper']);
 assert.deepEqual(find('caster'),['pictomancer']);
 assert.deepEqual(find('legacy'),['warrior']);
 assert.ok(!groups.flatMap(g=>g.jobs.map(([id])=>id)).includes('blue-mage'));
 assert.ok(!groups.flatMap(g=>g.jobs.map(([id])=>id)).includes('beastmaster'));
});
test('new characters have an enforceable 27-point ability allocation',()=>{
 assert.equal(BUDGET,27);
 assert.equal(pointsSpent(scores),0);
 const valid={...scores,str:15,dex:14,con:13,int:12,wis:10,cha:8};
 assert.equal(pointsSpent(valid),9+7+5+4+2);
 assert.equal(creationIssue({name:'Test',class_id:'paladin',...valid},catalog),'');
 assert.match(creationIssue({name:'Test',class_id:'paladin',...valid,int:15},catalog),/budget/);
 assert.match(creationIssue({name:'Test',class_id:'paladin',...scores,wis:16},catalog),/8 to 15/);
 assert.match(creationIssue({name:'Test',class_id:'blue-mage',...scores},catalog),/class/);
});
test('job preview shows the actual level-one skills and future unlocks',()=>{
 const summary=editorJobPreview(catalog.paladin);
 assert.equal(summary.hitDie,'d10');
 assert.equal(summary.primary,'STR');
 assert.deepEqual(summary.saves,['STR','CHA']);
 assert.equal(summary.features[0].name,'Oathguard');
 assert.equal(summary.spells[0].name,'Radiant Strike');
 assert.deepEqual(summary.upcoming.map(f=>f.level),[3]);
 assert.equal(editorJobPreview(null),null);
});
