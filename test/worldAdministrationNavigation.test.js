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

test('Industry hosts military installations while event-linked construction stays accessible from events',async()=>{
 const workspace=await readFile(new URL('../src/LocalWorkspace.jsx',import.meta.url),'utf8');
 const industry=await readFile(new URL('../src/IndustrySitesPanel.jsx',import.meta.url),'utf8');
 const world=await readFile(new URL('../src/WorldAdministration.jsx',import.meta.url),'utf8');
 assert.doesNotMatch(workspace,/\['construction','Construction Projects'/);
 assert.match(workspace,/tab==='construction'&&<ConstructionProjects/);
 assert.match(workspace,/onOpenConstruction=\{id=>\{setConstructionEventId\(id\);setTab\('construction'\)/);
 assert.match(industry,/\['projects','Facility projects'/);
 assert.match(industry,/\['military','Military installations'/);
 assert.match(industry,/tab==='military'&&<MilitaryInstallationsPanel/);
 assert.doesNotMatch(industry,/\['campaigns','Campaign projects'/);
 assert.match(world,/IndustrySitesPanel request=\{request\} onChanged=\{load\} userId=\{userId\}/);
});
