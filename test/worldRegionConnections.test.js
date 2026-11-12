import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('zone placement permits regional overview and supplies a clear empty-selection explanation',()=>{
 const source=file('src/ZoneGeography.jsx'),backend=file('server/src/world-geography.js');
 assert.match(source,/const placeable=useMemo\(\(\)=>zones,\[zones\]\)/);
 assert.match(source,/All zones are positioned/);
 assert.doesNotMatch(backend,/target\.is_default/);
});
test('world admin renders connections and validates facing borders',()=>{
 const world=file('src/WorldAdministration.jsx'),routes=file('server/src/world-crossings.js'),ui=file('src/RegionConnections.jsx');
 assert.match(world,/<RegionConnections/);
 assert.match(routes,/regionConnectionAllowsBorder/);
 assert.match(ui,/Save region connection/);
 assert.match(ui,/Airship connection/);
});
