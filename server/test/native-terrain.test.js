import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('the continent renders native relief terrain by default rather than a blank grid or a reference overlay',()=>{
 const map=readFileSync(new URL('../../src/ContinentStrategyMap.jsx',import.meta.url),'utf8');
 const terrain=readFileSync(new URL('../../src/IlsabardTerrain.jsx',import.meta.url),'utf8');
 assert.match(map,/import IlsabardTerrain from/);
 assert.match(map,/showTerrain,setShowTerrain\]=useState\(true\)/);
 assert.match(map,/<IlsabardTerrain\/>/);
 assert.match(map,/!showTerrain&&<rect width=\{W\}/);
 assert.match(terrain,/ilsabard:/);
 assert.match(terrain,/aldenard:/);
 assert.match(terrain,/othard:/);
 assert.match(terrain,/snowfield:/);
 assert.match(terrain,/eastice:/);
 assert.match(terrain,/RIDGES/);
 assert.match(terrain,/pointerEvents="none"/);
 assert.doesNotMatch(terrain,/https?:\/\//);
});
