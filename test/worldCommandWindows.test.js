import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('selected settlement inspector is a dismissible modal instead of a permanent map page section',()=>{
 const ui=readFileSync(new URL('../src/WorldAdministration.jsx',import.meta.url),'utf8');
 assert.match(ui,/inspectorOpen&&<div className="wa-inspector-overlay"/);
 assert.match(ui,/role="dialog" aria-modal="true"/);
 assert.match(ui,/onSelect=\{openInspector\}/);
 assert.match(ui,/setInspectorOpen\(false\)/);
 assert.match(ui,/event\.key==='Escape'/);
 assert.match(ui,/setSection\('civil'\)/);
 assert.match(ui,/Industry & production/);
 assert.match(ui,/Open civilian welfare/);
});
test('diplomatic council presents separate command chambers while retaining all actions',()=>{
 const ui=readFileSync(new URL('../src/WorldDiplomacyPanel.jsx',import.meta.url),'utf8');
 assert.match(ui,/wdi-command-layout/);
 for(const view of ['inbox','recovery','campaigns','relations','safeguards','history'])
  assert.match(ui,new RegExp("view==='"+view+"'"));
 assert.match(ui,/WorldRecoveryPanel/);
 assert.match(ui,/\/proposals\//);
 assert.match(ui,/\/outcomes\//);
 assert.match(ui,/\/protection/);
 assert.match(ui,/\/relations/);
});
