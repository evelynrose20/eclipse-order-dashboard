import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');
const workspace=read('LocalWorkspace.jsx');
const player=read('PlayerBattleView.jsx');
const dm=read('Encounters.jsx');
const map=read('BattleMap.jsx');
const css=read('encounter-studio.css');

test('player-facing encounter UI is a separate map-only scene',()=>{
 assert.match(workspace,/playerPreview\|\|!staff\?<PlayerBattleView/);
 assert.match(player,/event\.published&&IN_PROGRESS\.has\(event\.status\)/);
 assert.match(player,/<BattleMap key=\{chosen\.id\} encounter=\{chosen\} canDirect=\{false\} playerView/);
 assert.doesNotMatch(player,/DicePanel|EventEditor|EventXPRewards|MonsterTemplate|EventSignups|QuickHP/);
});
test('read-only map conceals GM configuration, reserves and exact enemy HP',()=>{
 assert.match(map,/\{!playerView&&<div className="waymark-tools"/);
 assert.match(map,/\{canDirect&&!playerView&&<div className="map-reserve"/);
 assert.match(map,/\{canDirect&&!playerView&&<form className="map-image-form"/);
 assert.match(map,/\{!playerView&&<><span className="token-health"/);
 assert.match(map,/playerView\?combatant\.name/);
});
test('DM encounters open on the map and preserve live combat and dice tools',()=>{
 assert.match(dm,/useState\('map'\)/);
 assert.match(dm,/encounter-studio-map-layout/);
 assert.match(dm,/encounter-studio-turn-list/);
 for(const value of ['BattleMap','DicePanel','EventEditor','EventSignups','rollAllInitiative','encounterTurn','QuickHP','EventXPRewards'])
  assert.ok(dm.includes(value),value);
});
test('studio retains responsive layouts and focus-visible map interactions',()=>{
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/@media\(max-width:1100px\)/);
 assert.match(read('battlemap.css'),/focus-visible/);
});
