import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
const editor=read('Encounters.jsx'),map=read('BattleMap.jsx'),styles=read('battlemap.css'),api=read('localApi.js');
test('DM may create player characters, hostile creatures and NPC allies',()=>{
 assert.match(editor,/<option value="ally">NPC ally · DM controlled<\/option>/);
 assert.match(editor,/<option value="player">Player character<\/option>/);
 assert.match(editor,/kind!=='player'/);
 assert.match(editor,/kind==='ally'\?'NPC ally/);
 assert.match(editor,/NPC allies<\/span>/);
});
test('saved creature templates can be deployed on either side',()=>{
 assert.match(editor,/aria-label="NPC allegiance"/);
 assert.match(editor,/addMonsterToEncounter\(chosenId,chosenMonster,savedNpcSide\)/);
 assert.match(api,/addMonsterToEncounter=\(id,monsterId,kind='npc'\)/);
});
test('NPC allies use a visibly allied but distinct map token and never a player account',()=>{
 assert.match(map,/combatant.kind==='ally'\?'npc-ally ally'/);
 assert.match(map,/map-legend-npc-ally/);
 assert.match(styles,/\.map-token\.npc-ally/);
 assert.match(map,/playerView\?combatant.name/);
 assert.doesNotMatch(map,/NPC allies.*player_user_id/);
});
