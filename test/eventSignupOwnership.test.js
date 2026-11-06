import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
const board=read('EventBoard.jsx');
const signups=read('EventPlanning.jsx');
const workspace=read('LocalWorkspace.jsx');
const dossier=read('CharacterDossier.jsx');
const editor=read('InlineSheetEditor.jsx');

test('event registration still selects only characters owned by the signed-in account',()=>{
 assert.match(signups,/characters\.filter\(c=>c\.player_user_id===userId\)/);
 assert.match(signups,/No characters linked to your account/);
 assert.match(signups,/event\.published\?'No applications yet\.'/);
 assert.doesNotMatch(signups,/Link to my account|LINK AN UNASSIGNED CHARACTER/);
});

test('character account ownership is automatic, not an editable player choice',()=>{
 assert.doesNotMatch(editor,/set\('player_user_id'/);
 assert.doesNotMatch(editor,/<select value=\{form\.player_user_id/);
 assert.match(editor,/Automatically linked to your account/);
 assert.doesNotMatch(workspace,/const linkToMe=|onLinkToMe=|onLinkCharacter=|canLinkCharacters=/);
 assert.doesNotMatch(dossier,/Link to my account|onLinkToMe/);
 assert.doesNotMatch(board,/unlinkedCharacters|onLinkCharacter/);
});

test('staff DM registration remains separate from member signups',()=>{
 assert.match(signups,/isEventDirector\?<div className="signup-eligibility-note"/);
 assert.match(signups,/Encounters & dice → Combatants/);
 assert.match(board,/selected\.created_by===userId/);
});
