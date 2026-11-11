import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {councilCharacterSummary} from '../src/governance-live.js';

test('Council candidate comes from a character sheet, not an account display name',()=>{
 const row={id:'a1111111-1111-4111-8111-111111111111',name:'Lady Rosa Hex',player_account_id:'a2222222-2222-4222-8222-222222222222',is_active:1,approval_status:'approved',account_role:'member',
 sheet_json:JSON.stringify({name:'Lady Rosa Hex',species:'Miqo\u2019te',class_id:'ninja',level:12,specialty:'Infiltrator',rp_preferences:{private:'SECRET'},gm_notes:'SEALED',password:'SECRET'})};
 const c=councilCharacterSummary(row);
 assert.equal(c.name,'Lady Rosa Hex');
 assert.equal(c.class_name,'ninja');
 assert.equal(c.level,12);
 assert.equal(c.eligible,true);
 assert.ok(!('sheet_json' in c));
 assert.ok(!('rp_preferences' in c));
 assert.ok(!('gm_notes' in c));
 assert.ok(!('password' in c));
});
test('unlinkable or inactive character sheets appear in registry but cannot be appointed',()=>{
 for(const c of [
  {id:'unlinked',name:'Unlinked',sheet_json:{class_id:'paladin'},player_account_id:null,is_active:0,approval_status:null},
  {id:'inactive',name:'Inactive',sheet_json:{class_id:'paladin'},player_account_id:'abc',is_active:0,approval_status:'approved'}
 ])assert.equal(councilCharacterSummary(c).eligible,false);
});
test('Council UI offers a searchable character sheet picker and locked character identity rather than account dropdown',()=>{
 const ui=readFileSync(new URL('../../src/GovernancePreview.jsx',import.meta.url),'utf8');
 const backend=readFileSync(new URL('../src/governance-live.js',import.meta.url),'utf8');
 assert.match(ui,/Select character sheet/);
 assert.match(ui,/gov-character-options/);
 assert.match(ui,/c\.class_name/);
 assert.match(ui,/c\.level/);
 assert.match(ui,/Lock In/);
 assert.match(ui,/Request removal vote/);
 assert.doesNotMatch(ui,/accounts\.filter\(a=>a\.approval_status/);
 assert.doesNotMatch(ui,/account_id:e\.target\.value/);
 assert.match(backend,/holder:o\.character_name\|\|null/);
 assert.match(backend,/locked:Boolean\(o\.character_id\)/);
 assert.match(backend,/office_locked_removal_vote_required/);
 assert.match(backend,/legacy_officer_account_cannot_change/);
});

test('Domina character choice is not filtered by account ownership or approval status',()=>{
 const governance=readFileSync(new URL('../src/governance-live.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../../src/GovernancePreview.jsx',import.meta.url),'utf8');
 assert.match(governance,/LEFT JOIN accounts a ON a\.id=c\.player_account_id WHERE c\.id=\? FOR UPDATE/);
 assert.match(governance,/if\(b\.code!=='domina'&&!character\.player_account_id\)/);
 assert.match(governance,/b\.code!=='domina'&&\(!character\.is_active/);
 assert.doesNotMatch(governance,/character\.player_account_id!==actor\.id/);
 assert.match(ui,/pickingOffice\.code==='domina'\|\|c\.eligible/);
 const unlinked=councilCharacterSummary({id:'a1111111-1111-4111-8111-111111111111',name:'Elira Sakurai',player_account_id:null,sheet_json:{species:'Miqo\u2019te',class_id:'reaper',level:20}});
 assert.equal(unlinked.eligible,false);
 assert.equal(unlinked.name,'Elira Sakurai');
});
