import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=async p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('map editor uses POST for compatibility with standard API preflight methods',async()=>{
 const server=await source('server/src/server.js');
 const editor=await source('src/WorldTerritoryMap.jsx');
 assert.match(server,/Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS'/);
 assert.match(editor,/\/map',\{method:'POST'/);
 assert.match(editor,/\/world-admin\/settlements\//);
 assert.doesNotMatch(editor,/method:'PATCH'/);
 assert.doesNotMatch(editor,/M-10 120 C 140 150 205 280 355 252 S 605 325 914 505/);
});
test('missing world migration surfaces actionable error instead of generic failure',async()=>{
 const api=await source('server/src/world-administration.js');
 const messages=await source('src/apiErrors.js');
 assert.match(api,/ER_NO_SUCH_TABLE/);
 assert.match(api,/ER_BAD_FIELD_ERROR/);
 assert.match(api,/world_setup_required/);
 assert.match(messages,/world_setup_required:/);
 assert.match(messages,/npm run setup:local/);
});
test('Garlean territory presentation includes contoured terrain and smoother editable roads',async()=>{
 const map=await source('src/WorldTerritoryMap.jsx');
 const css=await source('src/world-territory-map.css');
 for(const s of ['smoothRoadPath','wtm-terrain','wtm-map-compass','wtm-map-title','wtm-map-corner','wtm-map-frame'])assert.ok(map.includes(s),s);
 for(const s of ['wtm-pin[data-state="occupied"]','wtm-pin[data-state="contested"]','wtm-pin[data-state="liberated"]','wtm-road-trail','wtm-map-contour'])assert.ok(map.includes(s)||css.includes(s),s);
 assert.match(map,/onPointerDown=\{e=>pointerDown\(e,s\)\}/);
 assert.match(map,/if\(junctionAction==='split'\)void splitRoute\(route,e\);else selectRoad\(route\)/);
});
test('all non-entrypoint Markdown documentation is in the docs vault and the living world TODO is linkable',async()=>{
 const home=await source('docs/00-START-HERE.md');
 const todo=await source('docs/LIVING-WORLD-TODO.md');
 const master=await source('docs/LIVING-WORLD-WAR-COMMAND-MASTER-PLAN.md');
 for(const filename of ['Operations/SERVER-README','Operations/CLOUDFLARE-LAUNCH','Governance/SYNDICATE-RANKS','Legacy/SUPABASE-SETUP','LIVING-WORLD-TODO'])assert.ok(home.includes(filename),filename);
 for(const title of ['P0 — Fix live editing','P1 — World registry','P2 — Garlean climate','P3 — Sites','P4 — Logistics','P5 — Military','P6 — War Command'])assert.ok(todo.includes(title),title);
 assert.match(master,/LIVING-WORLD-TODO/);
});
