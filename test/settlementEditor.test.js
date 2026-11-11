import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const world=readFileSync(new URL('../src/WorldAdministration.jsx',import.meta.url),'utf8');
const editor=readFileSync(new URL('../src/SettlementEditor.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/settlement-editor.css',import.meta.url),'utf8');

test('new settlement editor replaces generic settlement form while leaving region and zone editors alone',()=>{
 assert.match(world,/editType==='settlement'&&<SettlementEditor/);
 assert.match(world,/editType!=='settlement'&&<div className="wa-overlay"/);
 assert.match(world,/onSave=\{save\}/);
 assert.match(world,/simulatedIds=\{simulatedIds\}/);
 assert.match(world,/previewOutlook=\{previewOutlook\}/);
});
test('settlement editor retains all original fields separated into four management panels',()=>{
 for(const name of ['overview','factions','map','civic'])
  assert.match(editor,new RegExp(name+":\\["));
 for(const key of ['directory_faction_id','governing_faction_id','controlling_faction_id','supporting_faction_id','map_icon','map_x','map_y','name','description','region_id','zone_id','strategic_state','population','housing_capacity','workforce','housing','food_days','food_variety','food_access','heating_coverage','insulation','weather_exposure','medical_access','security_score','civil_stability','unrest','simulation_enabled'])
  assert.ok(editor.includes(key),'Settlement editor missing '+key);
});
test('editor maintains safeguards for NPC terrain margins and simulation-managed civic records',()=>{
 assert.match(editor,/simulatedIds\?\.has/);
 assert.match(editor,/disabled=\{simulated\|\|\(playerCity/);
 assert.match(editor,/\['population','workforce','housing_capacity'\]/);
 assert.match(editor,/Number\(editing\.map_x\)>=3/);
 assert.match(editor,/Number\(editing\.map_y\)<=97/);
 assert.match(editor,/Mountains are not buildable terrain/);
 assert.match(editor,/Automatic cycles must be configured separately/);
 assert.match(editor,/onSubmit=\{onSave\}/);
});
test('window supports section navigation, sticky footer and closing without losing other dashboard content',()=>{
 assert.match(editor,/se-navigation/);
 assert.match(editor,/se-footer/);
 assert.match(editor,/event\.key==='Escape'/);
 assert.match(css,/\.se-window/);
 assert.match(css,/\.se-main\{overflow:auto/);
 assert.match(css,/\.se-footer/);
});
