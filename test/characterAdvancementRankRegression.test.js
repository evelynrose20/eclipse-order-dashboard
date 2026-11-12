import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('advancement shows ability progression without retired four bound ranks',()=>{
 const advancement=file('src/CharacterProgression.jsx');
 assert.match(advancement,/Character advancement/);
 assert.match(advancement,/Spend ability point/);
 assert.doesNotMatch(advancement,/Update bound rank|Rank I — Fresh Intake|rank_i|perform\('rank'/);
});
test('official bound standing remains catalog-driven in character dossier',()=>{
 const dossier=file('src/CharacterDossier.jsx');
 const api=file('server/src/characters.js');
 assert.match(dossier,/servitudeRanks\.map\(rank=>/);
 assert.match(dossier,/changeBoundRank\(e\.target\.value\)/);
 assert.match(api,/order_rank_catalog WHERE code=\? AND track='servitude'/);
});
