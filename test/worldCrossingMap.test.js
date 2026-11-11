import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('dossier opens only in Inspect mode, not while planning routes',()=>{
 const source=readFileSync(new URL('../src/WorldTerritoryMap.jsx',import.meta.url),'utf8');
 assert.match(source,/if\(mode==='view'\)onSelect\(String\(s\.id\),\{open:true\}\)/);
 assert.match(source,/else if\(mode==='move'\)onSelect\(String\(s\.id\),\{open:false\}\)/);
 assert.match(source,/if\(canEdit&&drawing\)\{/);
});
test('zone crossing tool creates paired graph entrances and displays navigation',()=>{
 const source=readFileSync(new URL('../src/WorldTerritoryMap.jsx',import.meta.url),'utf8');
 const parent=readFileSync(new URL('../src/WorldAdministration.jsx',import.meta.url),'utf8');
 assert.match(source,/\['crossings','Crossings'\]/);
 assert.match(source,/\/world-admin\/crossings/);
 assert.match(source,/onNavigateZone\(otherRegion,otherZone\)/);
 assert.match(parent,/crossings=\{data\?\.crossings\|\|\[\]\}/);
 assert.match(parent,/onNavigateZone=\{/);
});
