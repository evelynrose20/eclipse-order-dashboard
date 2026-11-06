import test from 'node:test';
import assert from 'node:assert/strict';
import {dossierTabs,dossierSummary,isDossierRestricted} from '../src/characterDossierRules.js';

const base={
 id:'synthetic-character',name:'Astra Moonveil',species:'Viera',class_name:'Mage',
 specialty:'Apothecary',level:7,experience:800,hp:19,max_hp:32,
 collar_bound:false,view_mode:'full',str:8,dex:13,con:12,int:17,wis:14,cha:11,
 background:'Fictional origin',personality:'Curious',inventory:'Rare reagent',
 notes:'Staff-only note: fake secret',spells:'Meteor'
};
test('full permitted records expose the redesigned dossier sections',()=>{
 const tabs=dossierTabs(base).map(x=>x.id);
 assert.deepEqual(tabs,['identity','roleplay','combat','spells','possessions','progression','legacy']);
 assert.equal(dossierSummary(base).className,'Mage');
 assert.equal(dossierSummary(base).equipment,'Rare reagent');
});
test('bound character preview hides mechanical and private data',()=>{
 const bound={...base,collar_bound:true,view_mode:'bound',rank:'Bound',owner:'Demo Handler'};
 assert.equal(isDossierRestricted(bound),true);
 assert.deepEqual(dossierTabs(bound).map(x=>x.id),['identity','roleplay']);
 const safe=dossierSummary(bound);
 for(const key of ['notes','spells','equipment','abilities','experience','background','personality','className','level'])
  assert.equal(Object.hasOwn(safe,key),false,key+' must not leak into restricted view');
 assert.equal(safe.assignedHandler,'Demo Handler');
});
test('member preview restricts bound character even if supplied a full staff record',()=>{
 const staffView={...base,collar_bound:true,view_mode:'full'};
 assert.equal(isDossierRestricted(staffView,false),false);
 assert.equal(isDossierRestricted(staffView,true),true);
 assert.equal(dossierTabs(staffView,true).some(t=>t.id==='legacy'),false);
});
test('unbound members retain the normal dossier view',()=>{
 assert.equal(isDossierRestricted({...base,view_mode:'full'},true),false);
});
test('missing character produces no accidentally detailed dossier',()=>{
 assert.equal(dossierSummary(null),null);
 assert.deepEqual(dossierTabs(null).map(x=>x.id),dossierTabs(base).map(x=>x.id));
});
