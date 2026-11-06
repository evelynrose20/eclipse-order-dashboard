import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
const editor=read('CombatantWorkspace.jsx'),map=read('BattleMap.jsx'),styles=read('battlemap.css'),api=read('localApi.js');
test('DM may create player characters, hostile creatures and NPC allies',()=>{
 assert.match(editor,/\{id:'ally',name:'NPC allies'/);
 assert.match(editor,/\{id:'player',name:'Player characters'/);
 assert.match(editor,/\{id:'npc',name:'Enemies'/);
 assert.match(editor,/kind==='player'\?/);
 assert.match(editor,/kind==='ally'\?'NPC ally'/);
});
test('saved creature templates can be deployed on either side',()=>{
 assert.match(editor,/templateSide/);
 assert.match(editor,/addMonsterToEncounter\(encounter\.id,selectedTemplate,templateSide\)/);
 assert.match(api,/addMonsterToEncounter=\(id,monsterId,kind='npc'\)/);
});
test('NPC allies use a visibly allied but distinct map token and never a player account',()=>{
 assert.match(map,/combatant.kind==='ally'\?'npc-ally ally'/);
 assert.match(map,/map-legend-npc-ally/);
 assert.match(styles,/\.map-token\.npc-ally/);
 assert.match(map,/playerView\?combatant.name/);
 assert.doesNotMatch(map,/NPC allies.*player_user_id/);
});
test('character conditions are toggled using accessible checkbox chips rather than browser multi-select',()=>{
 assert.match(editor,/type="checkbox" checked=\{\(draft.conditions\|\|\[\]\).includes\(c\)\}/);
 assert.match(editor,/className=\{'combat-condition-chip '/);
 assert.doesNotMatch(editor,/<select multiple/);
});
test('combatant setup provides quick access to an ally without traversing saved stat blocks',()=>{
 assert.match(editor,/useState\('ally'\)/);
 assert.match(editor,/＋ Add combatant/);
 assert.match(editor,/aria-pressed=\{kind===side.id\}/);
 assert.match(editor,/Add \{kind==='ally'\?'NPC ally'/);
});
