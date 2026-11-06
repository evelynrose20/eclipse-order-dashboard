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
 assert.match(map,/canDirect&&settingsOpen&&<div className="map-settings-panel"/);
 assert.match(map,/canDirect&&<button type="button" className=\{'map-tool '/);
 assert.match(map,/\{canDirect&&!playerView&&<div className="map-reserve"/);
 assert.match(map,/className="map-image-form"/);
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

test('Foundry-inspired map has usable controls, not inert toolbar decoration',()=>{
 for(const name of ['setMapZoom','beginPan','movingPan','startMeasurement','moveMeasurement','setGridVisible','setSettingsOpen'])
  assert.ok(map.includes(name),name+' should be implemented');
 assert.match(map,/onPointerDown=\{beginPan\}/);
 assert.match(map,/onPointerDown=\{e=>\{if\(tool==='measure'\)/);
 assert.match(map,/Distance: \{measureDistance\} grid squares/);
 assert.match(map,/aria-label="Reset map view"/);
 assert.match(map,/map-viewport/);
});
test('DM focus, scenes and contextual dice rail are interactive',()=>{
 for(const marker of ['setFocusMode','setScenesOpen','setRailMode','setRailOpen','encounter-rail-dice','aria-pressed={focusMode}'])
  assert.ok(dm.includes(marker),marker+' is missing');
 assert.match(css,/rail-collapsed/);
 assert.match(css,/scene-focus/);
});

test('map dice rail uses a compact tray rather than the full GM forms',()=>{
 const tray=read('DiceTray.jsx');
 assert.match(dm,/import DiceTray from '\.\/DiceTray\.jsx'/);
 assert.match(dm,/<DiceTray key=\{selected\.id\+'-tray'\}/);
 assert.match(dm,/onOpenFull=\{\(\)=>setSection\('dice'\)\}/);
 assert.match(dm,/useState\(false\)/);
 for(const marker of ['rollEncounterAction','parseDiceFormula','encounterRolls','dice-tray-roll-button','dice-tray-preset-grid','target_dc'])
  assert.ok(tray.includes(marker),marker);
 assert.doesNotMatch(tray,/gm-check-form|requestGMRoll|monster-library/);
});
test('encounter page prioritizes the battlefield without redundant global page intro',()=>{
 const workspace=read('LocalWorkspace.jsx');
 assert.match(workspace,/tab!=='encounters'&&<div className="page-intro"/);
 assert.match(workspace,/encounter-content/);
 assert.match(read('encounter-studio.css'),/encounter-studio-map-layout:has\(\.encounter-rail-dice\)/);
 assert.match(read('encounter-dice.css'),/dice-preset-row/);
});
