import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('World Administration is reachable from the grouped dashboard',async()=>{
 const workspace=await readFile(new URL('../src/LocalWorkspace.jsx',import.meta.url),'utf8');
 const nav=await readFile(new URL('../src/OrderNavigation.jsx',import.meta.url),'utf8');
 assert.match(workspace,/\['world','World Administration'/);
 assert.match(workspace,/tab==='world'&&<WorldAdministration/);
 assert.match(nav,/WORLD & TERRITORY/);
 assert.match(nav,/INDUSTRY & LOGISTICS/);
});
test('Saved cross-chat world-system plan covers the entire program',async()=>{
 const plan=await readFile(new URL('../docs/LIVING-WORLD-WAR-COMMAND-MASTER-PLAN.md',import.meta.url),'utf8');
 for(const word of ['food variety','heating','weather','unrest','ceruleum','trade','transport','military','Senate','Factions of the Realm','world builder','New Cassia'])assert.ok(plan.toLowerCase().includes(word.toLowerCase()),'Missing '+word);
});
