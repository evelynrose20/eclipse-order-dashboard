import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const load=name=>readFile(new URL('../'+name,import.meta.url),'utf8');

test('new map conditions are separately recognized by editor, API, SQL and colored marker styling',async()=>{
 const [map,form,api,sql,css]=await Promise.all([
  load('src/WorldTerritoryMap.jsx'),load('src/WorldAdministration.jsx'),
  load('server/src/world-administration.js'),load('server/sql/044_world_site_conditions.sql'),
  load('src/world-territory-map.css')
 ]);
 for(const state of ['secure','abandoned','destroyed']){
  assert.ok(map.includes("'"+state+"'"),'map '+state);
  assert.ok(form.includes("'"+state+"'"),'editor '+state);
  assert.ok(api.includes("'"+state+"'"),'API '+state);
  assert.ok(sql.includes("'"+state+"'"),'migration '+state);
  assert.ok(css.includes('wtm-pin[data-state="'+state+'"]'),'status color '+state);
 }
 assert.match(api,/controlling_faction_id/);
 assert.match(api,/governing_faction_id/);
 assert.match(sql,/information_schema\.COLUMNS/i);
 assert.doesNotMatch(sql,/UPDATE world_settlements SET strategic_state/);
});
test('route planning is preview-first with explicit save and cancellation',async()=>{
 const map=await load('src/WorldTerritoryMap.jsx');
 assert.match(map,/Save new route/);
 assert.match(map,/Cancel draft/);
 assert.match(map,/wtm-planned-route/);
 assert.match(map,/setRouteEnd\(Number\(s\.id\)\)/);
 assert.doesNotMatch(map,/void saveRoute/);
 assert.match(map,/Route endpoints selected/);
 assert.match(map,/e\.stopPropagation\(\);mapClick\(e\)/);
});
test('existing roads are editable by route list with waypoint insertion and reset',async()=>{
 const map=await load('src/WorldTerritoryMap.jsx');
 for(const label of ['Existing connections','Save route changes','Reset edits','Delete route','Route type','Route name'])assert.ok(map.includes(label),label);
 assert.match(map,/next\.splice\(nearest\?\.i\?\?old\.length,0,p\)/);
 assert.match(map,/selectRoad\(chosen\)/);
 assert.match(map,/setRouteDirty\(true\)/);
});
test('railways render track/sleeper symbols distinct from road and trail',async()=>{
 const map=await load('src/WorldTerritoryMap.jsx'),css=await load('src/world-territory-map.css');
 assert.match(map,/route\.route_type==='rail'/);
 assert.match(map,/wtm-rail-ties/);
 assert.match(map,/wtm-rail-center/);
 assert.match(css,/wtm-road-rail \.wtm-rail-ties/);
 assert.match(css,/wtm-road-rail \.wtm-rail-center/);
});

test('map uses Font Awesome web-font icons and accepts production and civic markers',async()=>{
 const [map,form,server,html,css]=await Promise.all([
  load('src/WorldTerritoryMap.jsx'),load('src/WorldAdministration.jsx'),
  load('server/src/garlean-climate.js'),load('index.html'),load('src/world-territory-map.css')
 ]);
 assert.match(html,/font-awesome\/6\.7\.2\/css\/all\.min\.css/);
 assert.match(map,/fa-solid fa-/);
 assert.match(map,/<i className=\{iconFor\(s\.map_icon\)\}\/>/);
 for(const marker of ['lumber_yard','logging_camp','sawmill','quarry','workshop','warehouse','rail_station']){
  assert.ok(map.includes("'"+marker+"'"),'frontend: '+marker);
  assert.ok(server.includes("'"+marker+"'"),'server: '+marker);
 }
 assert.match(form,/ICON_OPTIONS\.map/);
 assert.match(css,/Font Awesome 6 Free/);
});
