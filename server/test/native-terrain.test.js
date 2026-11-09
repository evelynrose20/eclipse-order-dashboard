import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pointInPolygon,safelyOffshore} from '../../src/terrain-geography.js';

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

test('islands never intersect or sit on mainland coastlines',()=>{
 const mainland=[[0,0],[200,0],[200,200],[0,200]];
 assert.equal(pointInPolygon([100,100],mainland),true);
 assert.equal(pointInPolygon([300,300],mainland),false);
 assert.equal(safelyOffshore([100,100,8,8], [mainland]),false,'island centered inland');
 assert.equal(safelyOffshore([205,80,12,10], [mainland]),false,'island touching shore');
 assert.equal(safelyOffshore([235,80,12,10], [mainland]),true,'island separated by sea');
});
test('terrain validates island candidates against every mainland',()=>{
 const terrain=readFileSync(new URL('../../src/IlsabardTerrain.jsx',import.meta.url),'utf8');
 assert.match(terrain,/ISLANDS\.filter\(island=>safelyOffshore/);
 assert.match(terrain,/offshoreIslands\.map/);
 assert.doesNotMatch(terrain,/\{ISLANDS\.map/);
});


test('terrain includes independently illustrated biomes consistent with the second visual reference',()=>{
 const atlas=readFileSync(new URL('../../src/AtlasBiomeRelief.jsx',import.meta.url),'utf8');
 const terrain=readFileSync(new URL('../../src/IlsabardTerrain.jsx',import.meta.url),'utf8');
 assert.match(terrain,/import AtlasBiomeRelief/);
 assert.match(terrain,/<AtlasBiomeRelief paths=\{paths\}\/>/);
 assert.match(atlas,/ils-west-lava/);
 assert.match(atlas,/ils-north-snow/);
 assert.match(atlas,/ils-dry-east/);
 assert.match(atlas,/ils-volcano/);
 assert.match(atlas,/forestDetails/);
 assert.match(atlas,/peakDetails/);
 assert.match(atlas,/clipPath="url\(#ils-clip-all\)"/);
});
