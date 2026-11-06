import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const board=readFileSync(new URL('../src/EventBoard.jsx',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../src/LocalWorkspace.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/event-board.css',import.meta.url),'utf8');
test('Events & signups uses its own member noticeboard, not the GM encounter workspace',()=>{
 assert.match(workspace,/tab==='events'&&<EventBoard/);
 assert.match(workspace,/tab==='encounters'&&<Encounters/);
 assert.doesNotMatch(board,/BattleMap|DicePanel|MonsterTemplate|EventXPRewards|EventEditor/);
});
test('event board displays real published events and preserves member-only registrations',()=>{
 assert.match(board,/listEncounters\(\)/);
 assert.match(board,/\.filter\(e=>e\.published\)/);
 assert.match(board,/event\.description/);
 assert.match(board,/event\.location/);
 assert.match(board,/event\.signup_count/);
 assert.match(board,/EventSignups/);
 assert.match(board,/ownOnly previewOnly=\{previewOnly\}/);
 assert.match(board,/canDirect=\{false\}/);
 assert.match(board,/selectedId/);
});
test('event board is responsive and gives controls keyboard focus styles',()=>{
 assert.match(css,/@media\(max-width:820px\)/);
 assert.match(css,/focus-visible/);
 assert.match(board,/aria-pressed/);
 assert.match(board,/aria-expanded/);
});
