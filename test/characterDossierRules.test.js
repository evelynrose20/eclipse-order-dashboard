import test from 'node:test';
import assert from 'node:assert/strict';
import {dossierTabs,dossierSummary,isDossierRestricted,defaultDossierTab,canViewCharacterChamber} from '../src/characterDossierRules.js';

const base={
 id:'synthetic-character',name:'Astra Moonveil',species:'Viera',class_name:'Mage',
 specialty:'Apothecary',level:7,experience:800,hp:19,max_hp:32,
 collar_bound:false,view_mode:'full',str:8,dex:13,con:12,int:17,wis:14,cha:11,
 background:'Fictional origin',personality:'Curious',inventory:'Rare reagent',
 notes:'Staff-only note: fake secret',spells:'Meteor'
};
test('full permitted records expose the redesigned dossier sections',()=>{
 const tabs=dossierTabs(base).map(x=>x.id);
 assert.deepEqual(tabs,['legacy','identity','roleplay','combat','spells','possessions','progression']);
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

test('classic sheet is the main default for permitted characters',()=>{
 assert.equal(defaultDossierTab(base),'legacy');
 assert.equal(dossierTabs(base)[0].id,'legacy');
 assert.equal(defaultDossierTab({...base,collar_bound:true,view_mode:'bound'}),'identity');
 assert.equal(defaultDossierTab({...base,collar_bound:true,view_mode:'full'},true),'identity');
});

test('authorized staff can open Chamber for other players unbound and bound characters',()=>{
 const other={...base,player_user_id:'another-player'};
 assert.equal(canViewCharacterChamber(other,'staff',{staff:true}),true);
 assert.equal(canViewCharacterChamber({...other,collar_bound:true},'staff',{staff:true}),true);
});
test('members cannot view another player Chamber solely because a character is bound',()=>{
 const other={...base,player_user_id:'another-player',collar_bound:true};
 assert.equal(canViewCharacterChamber(other,'member'),false);
 assert.equal(canViewCharacterChamber(other,'staff',{staff:true,playerPreview:true}),false);
 assert.equal(canViewCharacterChamber(other,'staff',{staff:false}),false);
});
test('character owner always sees their Chamber record including in player preview',()=>{
 const own={...base,player_user_id:'member'};
 assert.equal(canViewCharacterChamber(own,'member'),true);
 assert.equal(canViewCharacterChamber(own,'member',{playerPreview:true}),true);
 assert.equal(canViewCharacterChamber(null,'member',{staff:true}),false);
});
