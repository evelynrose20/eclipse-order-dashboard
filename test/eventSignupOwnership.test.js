import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
const board=read('EventBoard.jsx');
const signups=read('EventPlanning.jsx');
const workspace=read('LocalWorkspace.jsx');
const dossier=read('CharacterDossier.jsx');

test('event signup lists only characters owned by signed-in player and gives an actionable empty state',()=>{
 assert.match(signups,/characters\.filter\(c=>c\.player_user_id===userId\)/);
 assert.match(signups,/No characters linked to your account/);
 assert.match(signups,/LINK AN UNASSIGNED CHARACTER/);
 assert.match(signups,/onLinkCharacter\(linkCandidate\)/);
 assert.match(signups,/unlinkedCharacters\.some\(c=>c\.id===linkCandidate\)/);
 assert.doesNotMatch(signups,/No applications yet\. Publish the event to open registration/);
 assert.match(signups,/event\.published\?'No applications yet\.'/);
});

test('character ownership is not confused with fictional binding status',()=>{
 assert.match(board,/!c\.player_user_id&&!c\.collar_bound/);
 assert.match(board,/onLinkCharacter=\{onLinkCharacter\}/);
 assert.match(dossier,/No player account linked/);
 assert.match(dossier,/Link to my account/);
 assert.match(dossier,/!character\.player_user_id&&!character\.collar_bound/);
});

test('self-linking is staff-authorized and refreshes the owned character list',()=>{
 assert.match(workspace,/if\(!admin\)return/);
 assert.match(workspace,/!found\|\|found\.player_user_id\|\|found\.collar_bound/);
 assert.match(workspace,/method:'POST',body:\{player_user_id:profile\.id,handler_user_id:found\.handler_user_id\|\|null\}/);
 assert.match(workspace,/await load\(\)/);
 assert.match(workspace,/canLinkCharacters=\{admin\}/);
 assert.match(workspace,/onLinkToMe=\{linkToMe\}/);
});

test('DM signup restrictions are explained instead of presenting an unusable selector',()=>{
 assert.match(signups,/isEventDirector\?<div className="signup-eligibility-note"/);
 assert.match(signups,/Encounters & dice → Combatants/);
 assert.match(board,/selected\.created_by===userId/);
});
