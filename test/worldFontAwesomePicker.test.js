import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validMapIcon} from '../server/src/garlean-climate.js';

test('extended map categories and safe Free Solid names persist through the API allowlist',()=>{
 for(const id of ['lumber_yard','logging_camp','sawmill','forest','orchard','ranch','fishery','ceruleum_plant','drilling_rig','rail_depot','logging_road','military_base','lighthouse'])assert.equal(validMapIcon(id),true,id);
 assert.equal(validMapIcon('fa-tree'),true);
 assert.equal(validMapIcon('fa-train'),true);
 assert.equal(validMapIcon('fa-tree text-danger'),false);
 assert.equal(validMapIcon('fa-<script>'),false);
 assert.equal(validMapIcon('fa-'),false);
});
test('the existing site-wide Font Awesome picker is searchable with safe custom icon input',async()=>{
 const source=await readFile(new URL('../src/MapIconPicker.jsx',import.meta.url),'utf8');
 assert.match(source,/type="search"/);
 assert.match(source,/sanitizeFontAwesomeName/);
 assert.match(source,/fontawesome\.com\/search/);
 assert.match(source,/onChange\(id\)/);
 assert.match(source,/fa-\[a-z0-9-\]/);
});
test('regular and graph territory views share the expanded icon categories',async()=>{
 const map=await readFile(new URL('../src/WorldTerritoryMap.jsx',import.meta.url),'utf8');

 for(const id of ['forest','ceruleum_plant','rail_depot'])assert.ok(map.includes("'"+id+"'"),id);
 assert.match(map,/name\.slice\(3\)/);
 assert.match(map,/networkSegments/);
});
